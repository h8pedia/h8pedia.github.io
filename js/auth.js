/* eslint-disable */
// @ts-nocheck
// =========================
// AUTH SYSTEM — Signup, Login, Session Management
// Depends on: firebase-api.js (db), ban-system.js (BanSystem)
// =========================
var Auth = (function() {
  var SESSION_KEY = "h8pedia_username";
  var TOKEN_KEY = "h8pedia_token";

  function isLoggedIn() {
    return !!localStorage.getItem(SESSION_KEY);
  }

  function getUser() {
    return localStorage.getItem(SESSION_KEY);
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  async function hashPassword(password) {
    var encoder = new TextEncoder();
    var data = encoder.encode(password + "h8pedia_salt_2024");
    var hashBuffer = await crypto.subtle.digest("SHA-256", data);
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(function(b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  function generateToken() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  async function signup(username, email, password) {
    username = username.trim().toLowerCase();
    email = email.trim().toLowerCase();

    if (!username || username.length < 3) {
      return { ok: false, error: "Username must be at least 3 characters." };
    }
    if (!email.endsWith("@hackley.org")) {
      return { ok: false, error: "You must use a Hackley email (@hackley.org)." };
    }
    if (!password || password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters." };
    }

    var existing = await window.db.get("/users/" + username);
    if (existing) {
      return { ok: false, error: "Username already taken." };
    }

    var allUsers = await window.db.get("/users") || {};
    for (var u in allUsers) {
      if (allUsers[u].email === email) {
        return { ok: false, error: "This email is already registered." };
      }
    }

    var ban = await window.BanSystem.checkBan();
    if (ban) {
      await window.BanSystem.writeBanLocally(ban.reason);
      return { ok: false, error: "You are banned from h8pedia." };
    }

    var hashedPw = await hashPassword(password);
    var token = generateToken();
    var ip = await window.BanSystem.getIPAddress();
    var fp = window.BanSystem.getBrowserFingerprint();

    if (ip) {
      var safeIp = ip.replace(/\./g, "_");
      var ipBan = await window.db.get("/bans/ips/" + safeIp);
      if (ipBan) {
        await window.BanSystem.writeBanLocally(ipBan.reason || "Banned");
        return { ok: false, error: "You are banned from h8pedia." };
      }
    }
    var fpBan = await window.db.get("/bans/fingerprints/" + fp);
    if (fpBan) {
      await window.BanSystem.writeBanLocally(fpBan.reason || "Banned");
      return { ok: false, error: "You are banned from h8pedia." };
    }

    var userData = {
      username: username,
      email: email,
      password: hashedPw,
      role: "user",
      verified: false,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      lastIP: ip || "unknown",
      fingerprint: fp,
      bio: "",
      articlesCreated: 0,
      editsCount: 0
    };

    await window.db.set("/users/" + username, userData);
    await window.BanSystem.registerIdentity(username);

    var verifyCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    await window.db.set("/verification/" + username, {
      code: verifyCode,
      email: email,
      createdAt: new Date().toISOString()
    });

    localStorage.setItem(SESSION_KEY, username);
    localStorage.setItem(TOKEN_KEY, token);

    return { ok: true, username: username, verifyCode: verifyCode };
  }

  async function login(username, password) {
    username = username.trim().toLowerCase();

    if (!username || !password) {
      return { ok: false, error: "Please enter username and password." };
    }

    var ban = await window.BanSystem.checkBan();
    if (ban) {
      await window.BanSystem.writeBanLocally(ban.reason);
      return { ok: false, error: "You are banned from h8pedia." };
    }

    var userData = await window.db.get("/users/" + username);
    if (!userData) {
      return { ok: false, error: "User not found." };
    }

    if (userData.banned) {
      await window.BanSystem.writeBanLocally(userData.banReason || "Banned");
      return { ok: false, error: "This account has been banned." };
    }

    var hashedPw = await hashPassword(password);
    if (userData.password !== hashedPw) {
      return { ok: false, error: "Incorrect password." };
    }

    var token = generateToken();
    localStorage.setItem(SESSION_KEY, username);
    localStorage.setItem(TOKEN_KEY, token);

    await window.BanSystem.registerIdentity(username);
    await window.db.update("/users/" + username, { lastLogin: new Date().toISOString() });

    return { ok: true, username: username, role: userData.role, verified: userData.verified };
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "index.html";
  }

  async function verifyEmail(code) {
    var username = getUser();
    if (!username) return { ok: false, error: "Not logged in." };

    var record = await window.db.get("/verification/" + username);
    if (!record) return { ok: false, error: "No verification pending." };

    if (record.code !== code.toUpperCase()) {
      return { ok: false, error: "Invalid verification code." };
    }

    await window.db.update("/users/" + username, { verified: true });
    await window.db.delete("/verification/" + username);
    return { ok: true };
  }

  async function getUserData(username) {
    username = username || getUser();
    if (!username) return null;
    return await window.db.get("/users/" + username);
  }

  async function isModerator() {
    var username = getUser();
    if (!username) return false;
    var data = await window.db.get("/users/" + username);
    return data && (data.role === "moderator" || data.role === "admin");
  }

  return {
    isLoggedIn: isLoggedIn,
    getUser: getUser,
    getToken: getToken,
    signup: signup,
    login: login,
    logout: logout,
    verifyEmail: verifyEmail,
    getUserData: getUserData,
    isModerator: isModerator,
    hashPassword: hashPassword
  };
})();
