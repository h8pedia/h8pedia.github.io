/* eslint-disable */
// @ts-nocheck
// =========================
// AUTH SYSTEM — Signup, Login, Session Management
// Email verification enabled
// Adapted to Ghost Lock Ban System
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
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function generateToken() {
    return Date.now().toString(36) +
      Math.random().toString(36).slice(2) +
      Math.random().toString(36).slice(2);
  }

  async function signup(username, email, password) {
    username = username.trim().toLowerCase();
    email = email.trim().toLowerCase();

    if (!username || username.length < 3)
      return { ok: false, error: "Username must be at least 3 characters." };

    if (!email.endsWith("@students.hackleyschool.org"))
      return { ok: false, error: "You must use a Hackley email." };

    if (!password || password.length < 6)
      return { ok: false, error: "Password must be at least 6 characters." };

    var existing = await window.db.get("/users/" + username);
    if (existing)
      return { ok: false, error: "Username already taken." };

    var allUsers = await window.db.get("/users") || {};
    for (var u in allUsers)
      if (allUsers[u].email === email)
        return { ok: false, error: "This email is already registered." };

    var hashedPw = await hashPassword(password);
    var verificationToken = generateToken();

    var userData = {
      username: username,
      email: email,
      password: hashedPw,
      role: "user",
      verified: false,
      verificationToken: verificationToken,
      banned: false,
      banReason: null,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      bio: "",
      articlesCreated: 0,
      editsCount: 0
    };

    await window.db.set("/users/" + username, userData);

    // Send verification email
    var verifyLink =
      window.location.origin +
      "/verify.html?user=" +
      encodeURIComponent(username) +
      "&token=" +
      encodeURIComponent(verificationToken);

    await emailjs.send(
      "service_lytp94p",
      "template_7sfa1uk",
      {
        to_email: email,
        username: username,
        verification_link: verifyLink
      }
    );

    return {
      ok: true,
      message: "Account created! Please check your email to verify."
    };
  }

  async function login(username, password) {
    username = username.trim().toLowerCase();

    if (!username || !password)
      return { ok: false, error: "Please enter username and password." };

    var userData = await window.db.get("/users/" + username);
    if (!userData)
      return { ok: false, error: "User not found." };

    // CHECK BAN STATUS FIRST
    if (userData.banned) {
      var reason = userData.banReason || "Access Denied";
      window.BanSystem.ban(username, reason);
      return { ok: false, error: "This account has been banned." };
    }

    var hashedPw = await hashPassword(password);
    if (userData.password !== hashedPw)
      return { ok: false, error: "Incorrect password." };

    if (!userData.verified)
      return { ok: false, error: "Please verify your email first." };

    var token = generateToken();

    localStorage.setItem(SESSION_KEY, username);
    localStorage.setItem(TOKEN_KEY, token);

    await window.db.update("/users/" + username, {
      lastLogin: new Date().toISOString()
    });

    return {
      ok: true,
      username: username,
      role: userData.role
    };
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
    isLoggedIn,
    getUser,
    getToken,
    signup,
    login,
    logout,
    hashPassword
  };
})();

window.Auth = Auth;
