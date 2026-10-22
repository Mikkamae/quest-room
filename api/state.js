const { rpc, session, clearSession, body, send, sameOrigin } = require("../lib/core");

module.exports = async (req, res) => {
  try {
    const s = await session(req);
    if (!s) { clearSession(res); return send(res, 401, { error: "Please sign in." }); }

    if (req.method === "GET") {
      const state = await rpc("qr_get_state");
      return send(res, 200, { state: state || null });
    }
    if (req.method === "PUT") {
      if (!sameOrigin(req)) return send(res, 403, { error: "Not allowed" });
      const { state } = await body(req);
      if (!state || typeof state !== "object") return send(res, 400, { error: "Nothing to save." });
      await rpc("qr_save_state", { p_state: state });
      return send(res, 200, { ok: true, at: Date.now() });
    }
    return send(res, 405, { error: "Use GET or PUT" });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "Could not reach your save file." });
  }
};
