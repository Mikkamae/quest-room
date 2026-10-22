// Daily keep-alive, run by Vercel Cron, so the free database never goes to sleep.
const { env, rpc, send } = require("../lib/core");

module.exports = async (req, res) => {
  const secret = env("CRON_SECRET");
  if (!secret || req.headers.authorization !== "Bearer " + secret) return send(res, 401, { error: "Not allowed" });
  try {
    await rpc("qr_ping");
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "Ping failed" });
  }
};
