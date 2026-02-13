/* eslint-disable */
// @ts-nocheck
// =========================
// BAN SYSTEM — "GHOST LOCK" REVAMP
// Strategy: "Survivor" Persistence (Cache/SW) + Fallbacks.
// Ignores IP/Hardware (Identical Environment).
// =========================

var BanSystem = (function() {
  // --- CONFIG ---
  var BAN_KEY = "___h8_ban_lock___";
  var BAN_CACHE = "h8_ban_vault";
  var BAN_FILE = "./ban_marker.json"; // <--- YOU MUST CREATE THIS FILE
  var REASON = "Access Denied";

  // --- STORAGE HELPERS ---
  function _setCookie(n, v) { document.cookie = n + "=" + v + ";path=/;max-age=999999999"; }
  function _getCookie(n) { return (document.cookie.match(new RegExp("(^| )" + n + "=([^;]+)")) || [])[2]; }
  
  // 1. CACHE STORAGE (The "Ghost")
  async function _writeCache(reason) {
    try {
      var c = await caches.open(BAN_CACHE);
      await c.put(BAN_FILE, new Response(JSON.stringify({ banned: 1, r: reason }), { headers: {'ct':'application/json'} }));
    } catch(e){}
  }
  async function _readCache() {
    try {
      var c = await caches.open(BAN_CACHE);
      var r = await c.match(BAN_FILE);
      return r ? (await r.json()) : null;
    } catch(e){ return null; }
  }

  // 2. SERVICE WORKER
  function _writeSW(reason) {
    try { navigator.serviceWorker.controller.postMessage({t: 'BAN', r: reason}); } catch(e){}
  }

  // 3. STANDARD FALLBACK
  function _writeAll(reason) {
    var d = JSON.stringify({b:1, r:reason});
    try { localStorage.setItem(BAN_KEY, d); } catch(e){}
    try { sessionStorage.setItem(BAN_KEY, d); } catch(e){}
    try { window.name = d; } catch(e){}
    _setCookie(BAN_KEY, "1");
  }

  // --- CORE ---
  async function _lock(reason) {
    await _writeCache(reason);
    _writeSW(reason);
    _writeAll(reason);
    _kill(reason);
  }

  async function _check() {
    // 1. Cache
    var x = await _readCache();
    if(x && x.banned) return x.r;
    // 2. Cookie
    if(_getCookie(BAN_KEY)) return REASON;
    // 3. Local
    try { if(JSON.parse(localStorage.getItem(BAN_KEY)).b) return REASON; } catch(e){}
    // 4. Window
    try { if(JSON.parse(window.name).b) return REASON; } catch(e){}
    return null;
  }

  async function _syncServer() {
    var u = localStorage.getItem("h8pedia_username");
    if(u && window.db) {
      try {
        var d = await window.db.get("/users/" + u);
        if(d && d.banned) await _lock(d.banReason || REASON);
      } catch(e){}
    }
  }

  function _kill(msg) {
    window.stop();
    document.body.innerHTML = '<div style="display:flex;height:100vh;background:#000;color:red;align-items:center;justify-content:center;font-family:sans-serif;"><h1>BANNED: ' + (msg||REASON) + '</h1></div>';
  }

  // --- API ---
  return {
    banUser: function(user, reason) {
      if(window.db) window.db.update("/users/" + user, { banned: true, banReason: reason });
      _lock(reason || REASON);
    },
    init: function() {
      _check().then(function(r) {
        if(r) _kill(r);
        else _syncServer();
      });
    }
  };
})();
