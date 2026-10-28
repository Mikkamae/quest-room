// YouTube search for the Learning tab. The key stays here on the server (YOUTUBE_KEY in Vercel).
// GET /api/yt          -> { on: true|false }  (is search switched on?)
// GET /api/yt?q=words  -> { items: [{ id, title, channel, thumb }] }
// GET /api/yt?id=VIDEO  -> { title, channel, thumb }  (for pasted links)
const { env, session, clearSession, send } = require("../lib/core");

function decode(s) {
  return String(s || "").replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos);/gi, function (m, e) {
    var map = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    if (map[e.toLowerCase()]) return map[e.toLowerCase()];
    var n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return isFinite(n) ? String.fromCodePoint(n) : m;
  });
}

module.exports = async (req, res) => {
  if (req.method !== "GET") return send(res, 405, { error: "Use GET" });
  try {
    const s = await session(req);
    if (!s) { clearSession(res); return send(res, 401, { error: "Please sign in." }); }
    const key = env("YOUTUBE_KEY");
    const q = String(new URL(req.url, "http://x").searchParams.get("q") || "").trim().slice(0, 120);
    const id = String(new URL(req.url, "http://x").searchParams.get("id") || "");
    if (id) { // name of a pasted video or playlist (no key needed)
      if (!/^[\w-]{11,64}$/.test(id)) return send(res, 400, { error: "Bad link" });
      const link = id.length === 11 ? "https://www.youtube.com/watch?v=" + id : "https://www.youtube.com/playlist?list=" + id;
      const o = await fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(link));
      if (!o.ok) return send(res, 404, { error: "Video not found" });
      const oj = await o.json().catch(() => ({}));
      return send(res, 200, { title: decode(oj.title), channel: decode(oj.author_name), thumb: oj.thumbnail_url || "" });
    }
    if (!q) return send(res, 200, { on: !!key });
    if (!key) return send(res, 503, { error: "Search is off until the YouTube key is added." });

    const u = new URL("https://www.googleapis.com/youtube/v3/search");
    u.search = new URLSearchParams({
      part: "snippet", type: "video", videoEmbeddable: "true", safeSearch: "moderate",
      maxResults: "12", relevanceLanguage: "en", q: q, key: key
    }).toString();
    const r = await fetch(u);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const reason = (j.error && j.error.errors && j.error.errors[0] && j.error.errors[0].reason) || "";
      console.error("yt search", r.status, reason);
      if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") return send(res, 429, { error: "YouTube search is used up for today. It comes back tomorrow. You can still paste links." });
      return send(res, 502, { error: "YouTube search did not work. Check the key in Vercel." });
    }
    const items = (j.items || []).filter(x => x.id && x.id.videoId).map(x => ({
      id: x.id.videoId,
      title: decode(x.snippet.title),
      channel: decode(x.snippet.channelTitle),
      thumb: (x.snippet.thumbnails && (x.snippet.thumbnails.medium || x.snippet.thumbnails.default) || {}).url || ""
    }));
    return send(res, 200, { items });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "YouTube search did not work. Try again." });
  }
};
