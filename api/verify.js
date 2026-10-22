const { env, sha, rpc, setSession, body, send, sameOrigin, crypto } = require("../lib/core");

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  if (!sameOrigin(req)) return send(res, 403, { error: "Not allowed" });
  try {
    const { code } = await body(req);
    const clean = String(code || "").replace(/\D/g, "");
    if (clean.length !== 6) return send(res, 400, { error: "The code has 6 numbers." });

    const token = crypto.randomBytes(32).toString("hex");
    const result = await rpc("qr_verify_code", {
      p_code_hash: sha(clean + env("APP_SECRET")),
      p_token_hash: sha(token)
    });
    if (result === "ok") { setSession(res, token); return send(res, 200, { ok: true }); }
    if (result === "wrong") return send(res, 401, { error: "That code is not right. Check the email and try again." });
    if (result === "locked") return send(res, 401, { error: "Too many wrong tries. Ask for a new code." });
    return send(res, 401, { error: "This code has run out. Ask for a new one." });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "Something went wrong. Try again." });
  }
};
