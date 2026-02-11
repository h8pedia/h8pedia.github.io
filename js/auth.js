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
    if (!email.endsWith("@students.hackleyschool.org")) {
      return { ok: false, error: "You must use a Hackley email (@students.hackleyschool.org)." };
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
    var fp = window.BanSystem.getBrowserFingerprint();

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
      verified: true,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      fingerprint: fp,
      bio: "",
      articlesCreated: 0,
      editsCount: 0
    };

    await window.db.set("/users/" + username, userData);
    await window.BanSystem.registerIdentity(username);

    localStorage.setItem(SESSION_KEY, username);
    localStorage.setItem(TOKEN_KEY, token);

    return { ok: true, username: username };
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

    // FIX: Check for both 'banned' boolean and 'status' string
    var isBanned = (userData.banned === true) || (userData.status === "banned");
    if (isBanned) {
      var reason = userData.banReason || userData.reason || "Banned";
      await window.BanSystem.writeBanLocally(reason);
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
    getUserData: getUserData,
    isModerator: isModerator,
    hashPassword: hashPassword
  };
})();
