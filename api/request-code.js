const { env, sha, rpc, body, send, sameOrigin, crypto } = require("../lib/core");

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  if (!sameOrigin(req)) return send(res, 403, { error: "Not allowed" });
  try {
    const { email } = await body(req);
    const asked = String(email || "").trim().toLowerCase();
    const allowed = env("ALLOWED_EMAIL").toLowerCase();

    // Same answer for any email, so the page never reveals which one is allowed.
    if (!asked || asked !== allowed) return send(res, 200, { ok: true });

    if (!env("RESEND_API_KEY")) return send(res, 503, { error: "Email sending is not set up yet." });

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const stored = await rpc("qr_store_code", { p_code_hash: sha(code + env("APP_SECRET")) });
    if (!stored) return send(res, 429, { error: "Too many codes asked for. Wait 15 minutes, then try again." });

    const html =
      '<div style="font-family:Arial,sans-serif;background:#17111c;color:#f4eadf;padding:32px;border-radius:16px;max-width:420px;margin:auto">' +
      '<p style="margin:0 0 8px;color:#a99aa3;font-size:13px;letter-spacing:2px">QUEST ROOM</p>' +
      '<h1 style="margin:0 0 16px;font-size:22px;font-weight:600">Your login code</h1>' +
      '<p style="font-size:36px;letter-spacing:10px;font-weight:700;color:#f2b45a;margin:0 0 16px">' + code + '</p>' +
      '<p style="margin:0;color:#a99aa3;font-size:14px">This code works for 10 minutes. If you did not ask for it, you can ignore this email.</p></div>';

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + env("RESEND_API_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env("EMAIL_FROM"),
        to: [allowed],
        subject: "Quest Room code: " + code,
        html,
        text: "Your Quest Room login code is " + code + ". It works for 10 minutes."
      })
    });
    if (!r.ok) {
      console.error("resend", r.status, (await r.text()).slice(0, 300));
      return send(res, 502, { error: "The email could not be sent. Try again in a minute." });
    }
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "Something went wrong. Try again." });
  }
};
