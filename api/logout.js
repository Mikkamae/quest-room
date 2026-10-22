const { sha, rpc, clearSession, send, sameOrigin } = require("../lib/core");

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  if (!sameOrigin(req)) return send(res, 403, { error: "Not allowed" });
  try {
    const m = /(?:^|;\s*)qr_session=([a-f0-9]{64})/.exec(req.headers.cookie || "");
    if (m) await rpc("qr_logout", { p_token_hash: sha(m[1]) });
  } catch (e) { console.error(e); }
  clearSession(res);
  return send(res, 200, { ok: true });
};
