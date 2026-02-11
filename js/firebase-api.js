/* eslint-disable */
// @ts-nocheck
// =========================
// FirebaseAPI — REST wrapper for Firebase RTDB
// =========================
function FirebaseAPI(databaseUrl) {
  this.baseURL = databaseUrl.endsWith("/") ? databaseUrl : databaseUrl + "/";
  this.jsonHeaders = { "Content-Type": "application/json" };
}

FirebaseAPI.prototype.request = async function(path, options) {
  var url = this.baseURL + path + ".json";
  try {
    var res = await fetch(url, options || {});
    if (!res.ok) return null;
    return res.status === 200 ? res.json() : true;
  } catch(e) {
    return null;
  }
};

FirebaseAPI.prototype.get = function(path) {
  return this.request(path);
};

FirebaseAPI.prototype.set = function(path, data) {
  return this.request(path, {
    method: "PUT",
    headers: this.jsonHeaders,
    body: JSON.stringify(data)
  });
};

FirebaseAPI.prototype.push = function(path, data) {
  return this.request(path, {
    method: "POST",
    headers: this.jsonHeaders,
    body: JSON.stringify(data)
  });
};

FirebaseAPI.prototype.update = function(path, data) {
  return this.request(path, {
    method: "PATCH",
    headers: this.jsonHeaders,
    body: JSON.stringify(data)
  });
};

FirebaseAPI.prototype.delete = function(path) {
  return this.request(path, { method: "DELETE" });
};

FirebaseAPI.prototype.generateId = function() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
};

var db = new FirebaseAPI("https://h8pedia-default-rtdb.firebaseio.com/");
