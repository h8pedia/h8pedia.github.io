/* eslint-disable */
// @ts-nocheck
// =========================
// BAN SYSTEM — Multi-layer persistent ban enforcement
// Uses: cookies, localStorage, sessionStorage, IndexedDB, IP fingerprinting
// Depends on: firebase-api.js (db)
// =========================
var BanSystem = (function() {
  var BAN_KEY = "h8pedia_ban_flag";
  var BAN_COOKIE = "h8pedia_banned";
  var BAN_DB_NAME = "h8pedia_bans";
  var BAN_STORE = "ban_store";
  var COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 10;

  function setCookie(name, value, maxAge) {
    document.cookie = name + "=" + value + "; path=/; max-age=" + maxAge + "; SameSite=Lax";
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return match ? match[2] : null;
  }

  function openBanDB() {
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(BAN_DB_NAME, 1);
      req.onupgradeneeded = function() {
        var idb = req.result;
        if (!idb.objectStoreNames.contains(BAN_STORE)) {
          idb.createObjectStore(BAN_STORE);
        }
      };
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { reject(req.error); };
    });
  }

  async function setIDB(key, value) {
    try {
      var idb = await openBanDB();
      var tx = idb.transaction(BAN_STORE, "readwrite");
      tx.objectStore(BAN_STORE).put(value, key);
      return new Promise(function(res, rej) {
        tx.oncomplete = res;
        tx.onerror = rej;
      });
    } catch(e) { /* silent */ }
  }

  async function getIDB(key) {
    try {
      var idb = await openBanDB();
      var tx = idb.transaction(BAN_STORE, "readonly");
      var req = tx.objectStore(BAN_STORE).get(key);
      return new Promise(function(res) {
        req.onsuccess = function() { res(req.result); };
        req.onerror = function() { res(null); };
      });
    } catch(e) {
      return null;
    }
  }

  function getBrowserFingerprint() {
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("h8pedia_fp", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("h8pedia_fp", 4, 17);
    var canvasData = canvas.toDataURL();

    var raw = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || "",
      navigator.platform || "",
      canvasData
    ].join("|");

    var hash = 0;
    for (var i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    }
    return "fp_" + Math.abs(hash).toString(36);
  }

  async function getIPAddress() {
    try {
      var res = await fetch("https://api.ipify.org?format=json");
      var data = await res.json();
      return data.ip || null;
    } catch(e) {
      return null;
    }
  }

  async function writeBanLocally(reason) {
    var banData = JSON.stringify({
      banned: true,
      reason: reason || "Banned",
      timestamp: new Date().toISOString()
    });

    try { localStorage.setItem(BAN_KEY, banData); } catch(e) {}
    try { localStorage.setItem(BAN_KEY + "_2", "1"); } catch(e) {}
    try { sessionStorage.setItem(BAN_KEY, banData); } catch(e) {}

    setCookie(BAN_COOKIE, "1", COOKIE_MAX_AGE);
    setCookie(BAN_COOKIE + "_r", encodeURIComponent(reason || "Banned"), COOKIE_MAX_AGE);

    await setIDB(BAN_KEY, banData);
  }

  async function isLocallyBanned() {
    try {
      var ls = localStorage.getItem(BAN_KEY);
      if (ls) return JSON.parse(ls);
      if (localStorage.getItem(BAN_KEY + "_2") === "1") return { banned: true, reason: "Banned" };
    } catch(e) {}

    try {
      var ss = sessionStorage.getItem(BAN_KEY);
      if (ss) return JSON.parse(ss);
    } catch(e) {}

    if (getCookie(BAN_COOKIE) === "1") {
      var reason = decodeURIComponent(getCookie(BAN_COOKIE + "_r") || "Banned");
      return { banned: true, reason: reason };
    }

    try {
      var idbVal = await getIDB(BAN_KEY);
      if (idbVal) return JSON.parse(idbVal);
    } catch(e) {}

    return null;
  }

  async function banUser(username, reason) {
    var ip = await getIPAddress();
    var fp = getBrowserFingerprint();
    var banRecord = {
      username: username,
      reason: reason || "Banned by moderator",
      bannedAt: new Date().toISOString(),
      ip: ip || "unknown",
      fingerprint: fp
    };

    await window.db.set("/bans/users/" + username, banRecord);

    if (ip) {
      var safeIp = ip.replace(/\./g, "_");
      await window.db.set("/bans/ips/" + safeIp, banRecord);
    }

    await window.db.set("/bans/fingerprints/" + fp, banRecord);
    await window.db.update("/users/" + username, { banned: true, banReason: reason || "Banned by moderator" });
  }

  async function isServerBanned() {
    var username = localStorage.getItem("h8pedia_username");
    if (username) {
      var userBan = await window.db.get("/bans/users/" + username);
      if (userBan) return userBan;

      var userData = await window.db.get("/users/" + username);
      if (userData && userData.banned) return { banned: true, reason: userData.banReason || "Banned" };
    }

    try {
      var ip = await getIPAddress();
      if (ip) {
        var safeIp = ip.replace(/\./g, "_");
        var ipBan = await window.db.get("/bans/ips/" + safeIp);
        if (ipBan) return ipBan;
      }
    } catch(e) {}

    var fp = getBrowserFingerprint();
    var fpBan = await window.db.get("/bans/fingerprints/" + fp);
    if (fpBan) return fpBan;

    return null;
  }

  async function checkBan() {
    var localBan = await isLocallyBanned();
    if (localBan && localBan.banned) {
      return localBan;
    }

    var serverBan = await isServerBanned();
    if (serverBan) {
      await writeBanLocally(serverBan.reason || "Banned");
      return serverBan;
    }

    return null;
  }

  async function enforceBan() {
    var ban = await checkBan();
    if (ban) {
      await writeBanLocally(ban.reason || "Banned");
      showBanScreen(ban.reason || "You have been permanently banned from h8pedia.");
      return true;
    }
    return false;
  }

  function showBanScreen(reason) {
    document.body.innerHTML = "";
    document.body.style.cssText = "margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#1a1a2e;font-family:Georgia,serif;";

    var container = document.createElement("div");
    container.style.cssText = "text-align:center;max-width:500px;padding:48px;background:#16213e;border-radius:12px;border:1px solid #e94560;";
    container.innerHTML =
      '<h1 style="color:#e94560;font-size:28px;margin-bottom:16px;">Access Denied</h1>' +
      '<p style="color:#a0a0b0;font-size:16px;line-height:1.6;margin-bottom:24px;">' +
        'Your account has been permanently suspended from h8pedia.' +
      '</p>' +
      '<div style="background:#0f3460;padding:16px;border-radius:8px;border-left:4px solid #e94560;">' +
        '<p style="color:#ccc;font-size:14px;margin:0;"><strong style="color:#e94560;">Reason:</strong> ' + escapeHTML(reason) + '</p>' +
      '</div>' +
      '<p style="color:#666;font-size:13px;margin-top:24px;">' +
        'This ban is permanent and cannot be circumvented.<br>' +
        'Contact administration if you believe this is an error.' +
      '</p>';
    document.body.appendChild(container);
  }

  function escapeHTML(str) {
    var div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  async function registerIdentity(username) {
    var ip = await getIPAddress();
    var fp = getBrowserFingerprint();

    await window.db.update("/users/" + username, {
      lastIP: ip || "unknown",
      fingerprint: fp,
      lastLogin: new Date().toISOString()
    });

    if (ip) {
      var safeIp = ip.replace(/\./g, "_");
      var existing = await window.db.get("/identity/ips/" + safeIp) || {};
      existing[username] = true;
      await window.db.set("/identity/ips/" + safeIp, existing);
    }

    var existingFp = await window.db.get("/identity/fingerprints/" + fp) || {};
    existingFp[username] = true;
    await window.db.set("/identity/fingerprints/" + fp, existingFp);
  }

  return {
    banUser: banUser,
    checkBan: checkBan,
    enforceBan: enforceBan,
    writeBanLocally: writeBanLocally,
    isLocallyBanned: isLocallyBanned,
    isServerBanned: isServerBanned,
    registerIdentity: registerIdentity,
    getIPAddress: getIPAddress,
    getBrowserFingerprint: getBrowserFingerprint,
    escapeHTML: escapeHTML
  };
})();
