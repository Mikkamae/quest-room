// Shared helpers for the Quest Room server routes.
const crypto = require("crypto");

const IDLE_DAYS = 4; // sign out after this many days without using the app
const COOKIE = "qr_session";

function env(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : "";
}

function sha(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// Call one of the locked database functions. Every function checks APP_SECRET.
async function rpc(fn, args) {
  const url = env("SUPABASE_URL") + "/rest/v1/rpc/" + fn;
  const key = env("SUPABASE_ANON_KEY");
  const res = await fetch(url, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ p_secret: env("APP_SECRET") }, args || {}))
  });
  const text = await res.text();
  if (!res.ok) throw new Error("db " + fn + " " + res.status + " " + text.slice(0, 200));
  return text ? JSON.parse(text) : null;
}

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return "";
}

function setSession(res, token) {
  res.setHeader("Set-Cookie",
    COOKIE + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + (60 * 60 * 24 * 60));
}
function clearSession(res) {
  res.setHeader("Set-Cookie", COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
}

// Returns the token hash if the session is still alive, else "".
async function session(req) {
  const token = readCookie(req, COOKIE);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return "";
  const hash = sha(token);
  const alive = await rpc("qr_touch", { p_token_hash: hash, p_idle_days: IDLE_DAYS });
  return alive ? hash : "";
}

async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return await new Promise(resolve => {
    let data = "";
    req.on("data", c => { data += c; if (data.length > 2e6) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch (e) { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch (e) { return false; }
}

module.exports = { IDLE_DAYS, env, sha, rpc, session, setSession, clearSession, body, send, sameOrigin, crypto };
