/* Quest Room focus: an animated Pomodoro timer and a music pop-up (YouTube or rain sounds).
   Talks to app.js through window.QR. */
(function () {
"use strict";
var Q = window.QR; if (!Q) return;
var $ = function (id) { return document.getElementById(id); };
var KEY = "qr-pomo-v1";
var PRESETS = { "25": { name: "25 / 5", f: 25, s: 5, l: 15 }, "50": { name: "50 / 10", f: 50, s: 10, l: 20 }, "15": { name: "15 / 5", f: 15, s: 5, l: 15 } };
var PHASE = { focus: "Focus", short: "Short break", long: "Long break" };
// Lofi Girl restarts some streams with new links, so the main one follows whatever her channel has live.
var STATIONS = [
  { name: "Lofi hip hop", sub: "Lofi Girl · live", v: { live: "UCSJ4gkVC6NrvII8umztf0Ow" } },
  { name: "Sleepy lofi", sub: "Lofi Girl · live", v: { id: "JD-kMIpDfnY" } },
  { name: "Synthwave", sub: "Lofi Girl · live", v: { id: "4xDzrJKXOOY" } },
  { name: "Look, I'm Focused", sub: "Pomodoro sessions", v: { list: "UUx8jVRAtxBY8f0y-VH-NfhA" } }
];
function vkey(v) { return v.live || v.list || v.id; }
function watchUrl(v) {
  return v.live ? "https://www.youtube.com/channel/" + v.live + "/live" : v.list ? "https://www.youtube.com/playlist?list=" + v.list : "https://www.youtube.com/watch?v=" + v.id;
}
var C = 2 * Math.PI * 88;

/* ---------- styles ---------- */
var css = document.createElement("style");
css.textContent =
  ".pomo{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;align-items:center;--pc:var(--lamp)}" +
  ".pomo[data-phase=\"short\"],.pomo[data-phase=\"long\"]{--pc:var(--leaf)}" +
  ".pring{position:relative;width:176px;height:176px}" +
  ".pring .rsvg{width:100%;height:100%;transform:rotate(-90deg);overflow:visible}" +
  ".pring .trk{stroke:color-mix(in srgb, var(--text) 9%, transparent)}" +
  ".pring .arc{stroke:var(--pc);transition:stroke-dashoffset .3s linear,stroke .4s}" +
  ".pring .glow{stroke:var(--pc);opacity:0;filter:blur(6px);transition:stroke-dashoffset .3s linear}" +
  ".pomo.run .pring .glow{animation:breathe 4s ease-in-out infinite}" +
  "@keyframes breathe{0%,100%{opacity:.15}50%{opacity:.55}}" +
  ".pring .head{fill:var(--pc);transition:transform .3s linear}" +
  ".pcenter{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}" +
  ".pm-phase{font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--pc)}" +
  ".pm-time{font-family:var(--f-game);font-size:40px;line-height:1}" +
  ".pm-dots{display:flex;gap:5px;margin-top:6px}" +
  ".pm-dots i{width:9px;height:9px;border-radius:50%;background:color-mix(in srgb, var(--text) 14%, transparent)}.pm-dots i.on{background:var(--lamp)}" +
  ".tomato{position:absolute;right:-4px;top:-4px;width:34px;height:34px;image-rendering:pixelated}" +
  ".pomo.run .tomato{animation:wobble 1.6s ease-in-out infinite}" +
  ".pomo[data-phase=\"short\"] .tomato,.pomo[data-phase=\"long\"] .tomato{animation:none;transform:rotate(-12deg) translateY(2px)}" +
  "@keyframes wobble{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg) translateY(-2px)}}" +
  ".pm-for{font-size:13px;color:var(--muted)}.pm-for b{color:var(--text);font-weight:600}" +
  ".pm-presets{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}" +
  ".pm-presets button{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:4px 11px;font-size:12px;font-family:var(--f-game)}" +
  ".pm-presets button[aria-pressed=\"true\"]{border-color:var(--lamp);color:var(--lamp)}" +
  ".pm-note{margin-top:10px;font-size:13px;color:var(--leaf);display:flex;gap:8px;align-items:center;flex-wrap:wrap}" +
  ".stations{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}" +
  ".station{display:flex;flex-direction:column;gap:2px;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:9px 11px;min-width:0}" +
  ".station b{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.station small{font-size:11px;color:var(--muted)}" +
  ".station[aria-pressed=\"true\"]{border-color:var(--lamp);background:color-mix(in srgb, var(--lamp) 10%, var(--card))}" +
  ".mine{display:flex;gap:6px;align-items:center}.mine .station{flex:1}" +
  ".mhead{display:flex;align-items:baseline;gap:8px;margin:16px 0 8px}.mhead .label{flex:1}" +
  ".ytpop{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom, 0px));z-index:25;width:min(360px,calc(100vw - 32px));background:var(--wall);border:1px solid var(--line);border-radius:16px;box-shadow:0 18px 40px #0007;overflow:hidden;animation:popin .25s ease}" +
  ".ytpop.learn{width:min(520px,calc(100vw - 32px))}.ytpop.learn .ytbar{flex-wrap:wrap}.ytpop.learn .ytbar b{flex:1 1 100%;margin-bottom:2px}.ytpop.learn .ytbar [data-lndone]{margin-right:auto}" +
  "@keyframes popin{from{transform:translateY(16px);opacity:0}}" +
  ".ytbar{display:flex;align-items:center;gap:6px;padding:8px 8px 8px 12px}" +
  ".ytbar a.ghost{color:var(--muted)}.ytbar b{flex:1;min-width:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
  ".ytbar .eq{display:flex;gap:2px;align-items:flex-end;height:14px}.ytbar .eq i{width:3px;background:var(--lamp);border-radius:2px;animation:eq 1s ease-in-out infinite}" +
  ".ytbar .eq i:nth-child(2){animation-delay:-.3s}.ytbar .eq i:nth-child(3){animation-delay:-.6s}" +
  "@keyframes eq{0%,100%{height:4px}50%{height:14px}}" +
  ".ytbody{aspect-ratio:16/9;background:#000}.ytbody iframe{width:100%;height:100%;border:0;display:block}" +
  ".ytpop.min .ytbody{height:1px;aspect-ratio:auto;opacity:0;overflow:hidden}" +
  "body.pop{padding-bottom:calc(64px + var(--popH,0px))}body.pop .toast{bottom:calc(36px + var(--popH,0px))}" +
  "@media (max-width:640px){body.pop .toast{bottom:calc(96px + var(--popH,0px) + env(safe-area-inset-bottom, 0px))}}" +
  "@media (max-width:640px){body.pop{padding-bottom:calc(112px + var(--popH,0px) + env(safe-area-inset-bottom, 0px))}}" +
  "@media (max-width:640px){.ytpop{bottom:calc(84px + env(safe-area-inset-bottom, 0px));right:16px}" +
  ".pomo{grid-template-columns:minmax(0,1fr);justify-items:center;text-align:center}.pm-presets,.pomo .t-actions,.pm-note{justify-content:center}}" +
  "@media (prefers-reduced-motion:reduce){.pomo .tomato,.pring .glow,.ytbar .eq i{animation:none!important}}";
document.head.appendChild(css);

/* ---------- build the panel (keeps the rain player from app.js) ---------- */
var panel = $("t-h").closest(".panel");
var music = panel.querySelector(".music"), vol = panel.querySelector(".vol");
var TOMATO = '<svg class="tomato" viewBox="0 0 12 12" aria-hidden="true" shape-rendering="crispEdges">' +
  '<rect x="5" y="0" width="1" height="2" fill="#5f8f5a"/><rect x="3" y="1" width="2" height="1" fill="#5f8f5a"/><rect x="6" y="1" width="3" height="1" fill="#5f8f5a"/>' +
  '<rect x="3" y="2" width="6" height="1" fill="#e2563f"/><rect x="2" y="3" width="8" height="1" fill="#e2563f"/><rect x="1" y="4" width="10" height="5" fill="#e2563f"/>' +
  '<rect x="2" y="9" width="8" height="1" fill="#c8402d"/><rect x="3" y="10" width="6" height="1" fill="#c8402d"/><rect x="2" y="4" width="2" height="2" fill="#f58a6f"/></svg>';
panel.innerHTML =
  '<div class="ph"><h2 id="t-h">Focus</h2><span class="meta" id="pm-today"></span></div>' +
  '<div class="pomo" id="pomo" data-phase="focus">' +
    '<div class="pring">' +
      '<svg class="rsvg" viewBox="0 0 200 200" aria-hidden="true"><circle class="trk" cx="100" cy="100" r="88" fill="none" stroke-width="10"/>' +
      '<circle class="glow" id="pm-glow" cx="100" cy="100" r="88" fill="none" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + C + '"/>' +
      '<circle class="arc" id="pm-arc" cx="100" cy="100" r="88" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + C + '"/>' +
      '<g id="pm-head" class="head"><circle cx="188" cy="100" r="7"/></g></svg>' +
      '<div class="pcenter"><div class="pm-phase" id="pm-phase">Focus</div><div class="pm-time num" id="pm-time" role="timer">25:00</div><div class="pm-dots" id="pm-dots" aria-label="Rounds"></div></div>' +
      TOMATO +
    '</div>' +
    '<div style="min-width:0">' +
      '<div class="pm-for" id="pm-for"></div>' +
      '<div class="pm-presets" id="pm-presets"></div>' +
      '<div class="t-actions"><button class="btn" id="pm-go">Start</button><button class="ghost" id="pm-skip">Skip</button><button class="ghost" id="pm-reset">Reset</button></div>' +
      '<div class="pm-note" id="pm-note" hidden></div>' +
    '</div>' +
  '</div>' +
  '<div class="mhead"><div class="label">Music</div><span class="muted" style="font-size:12px">Opens in a small player</span></div>' +
  '<div class="stations" id="pm-stations"></div>' +
  '<div class="mhead"><div class="label">Your videos</div></div>' +
  '<div class="list" id="pm-mine" style="gap:6px"></div>' +
  '<form class="form" id="pm-add" style="margin-top:8px"><input class="grow" id="pm-url" placeholder="Paste a YouTube link" aria-label="YouTube link"><input id="pm-name" placeholder="Name (optional)" aria-label="Name for this video" style="flex:1 1 120px"><button class="btn soft" type="submit">Add</button></form>' +
  '<div class="mhead"><div class="label">No-data option</div></div>';
if (music) panel.appendChild(music);
if (vol) panel.appendChild(vol);

/* ---------- timer state ---------- */
var st = load();
function load() {
  var d = null; try { d = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  if (!d || !PRESETS[d.preset]) d = { preset: "25", phase: "focus", round: 0, running: false, endAt: 0, left: 0, quest: null };
  if (!d.left) d.left = len(d) * 60;
  return d;
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
function len(s) { var p = PRESETS[s.preset]; return s.phase === "focus" ? p.f : s.phase === "short" ? p.s : p.l; }
function total() { return len(st) * 60; }
function leftNow() { return st.running ? Math.max(0, (st.endAt - Date.now()) / 1000) : st.left; }
function fmt(s) { s = Math.ceil(s); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
function dayPoms() { var dd = Q.S().days[Q.dkey()]; return (dd && dd.poms) || 0; }
function dayMins() { var dd = Q.S().days[Q.dkey()]; return (dd && dd.pomMin) || 0; }

function draw() {
  var left = leftNow(), T = total(), frac = Math.min(1, Math.max(0, 1 - left / T));
  $("pomo").dataset.phase = st.phase; $("pomo").classList.toggle("run", st.running);
  $("pm-phase").textContent = PHASE[st.phase];
  $("pm-time").textContent = fmt(left);
  var off = C * frac; // the ring empties as time runs out
  $("pm-arc").style.strokeDashoffset = off; $("pm-glow").style.strokeDashoffset = off;
  $("pm-head").style.transform = "rotate(" + (frac * 360) + "deg)"; $("pm-head").style.transformOrigin = "100px 100px";
  var dots = ""; for (var i = 0; i < 4; i++) dots += '<i class="' + (i < st.round % 4 || (st.round && st.round % 4 === 0 && st.phase === "long") ? "on" : "") + '"></i>';
  $("pm-dots").innerHTML = dots;
  $("pm-go").textContent = st.running ? "Pause" : (left < T ? "Resume" : "Start");
  var q = st.quest && Q.find(st.quest);
  $("pm-for").innerHTML = q ? "Focusing on <b>" + Q.esc(q.title) + "</b>" : (st.phase === "focus" ? "Tap <b>Start</b>, or tap <b>Start</b> on a quest to link it." : "Stand up, drink water, look away from the screen.");
  var n = dayPoms(); $("pm-today").textContent = n ? n + (n === 1 ? " round" : " rounds") + " today · " + dayMins() + " min" : "";
  document.title = st.running ? fmt(left) + " · " + PHASE[st.phase] + " · Quest Room" : "Quest Room";
}
function drawPresets() {
  $("pm-presets").innerHTML = Object.keys(PRESETS).map(function (k) { return '<button data-pmset="' + k + '" aria-pressed="' + (st.preset === k) + '">' + PRESETS[k].name + '</button>'; }).join("");
}
function startRun() { if (st.running) return; st.endAt = Date.now() + leftNow() * 1000; st.running = true; $("pm-note").hidden = true; persist(); draw(); }
function pause() { if (!st.running) return; st.left = leftNow(); st.running = false; persist(); draw(); }
function setPhase(ph) { st.phase = ph; st.running = false; st.left = total(); st.endAt = 0; persist(); draw(); }
function finishPhase(natural) {
  var was = st.phase;
  if (was === "focus") {
    if (natural) {
      var S = Q.S(), k = Q.dkey(), dd = S.days[k] = S.days[k] || { energy: "", featured: [] };
      dd.poms = (dd.poms || 0) + 1; dd.pomMin = (dd.pomMin || 0) + len(st);
      var q = st.quest && Q.find(st.quest);
      var xp = Q.award("focus:" + k + ":" + dd.poms, "tiny", q ? q.domain : "learning", q ? q.skill : "sk-mind", "Focus round" + (q ? ": " + q.title : ""));
      Q.chime(); Q.cheer(); Q.change();
      Q.toast("<b>+" + xp + " XP</b> · Focus round done! Take your break.");
      if (q && !Q.isDone(q)) { $("pm-note").hidden = false; $("pm-note").innerHTML = '<span>Did you finish the quest?</span><button class="ghost" data-pmmark="1">Mark it done</button>'; }
    }
    st.round += 1;
    setPhase(st.round % 4 === 0 ? "long" : "short");
  } else {
    if (natural) { Q.chime(); Q.toast("Break over. Ready for the next round?"); }
    if (was === "long") st.round = 0;
    setPhase("focus");
  }
}
var tick = 0;
setInterval(function () { tick++; if ($("app").hidden) return; if (st.running && leftNow() <= 0) finishPhase(true); else if (st.running || tick % 8 === 0) draw(); }, 250);
document.addEventListener("visibilitychange", function () { if (!document.hidden && !$("app").hidden && st.running && leftNow() <= 0) finishPhase(true); });

/* ---------- music pop-up ---------- */
var pop = null, nowId = null;
function videos() { var s = Q.S().settings; if (!Array.isArray(s.videos)) s.videos = []; return s.videos; }
function parseYT(u) {
  u = String(u || "").trim(); var m;
  if ((m = u.match(/[?&]list=([\w-]{10,})/)) && !/[?&]v=/.test(u)) return { list: m[1] };
  if ((m = u.match(/\/channel\/UC([\w-]{22})/))) return { list: "UU" + m[1] }; // a channel's uploads
  if (/youtube\.com\/@/.test(u)) return { handle: true };
  if ((m = u.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/live\/|\/shorts\/)([\w-]{11})/))) return { id: m[1] };
  if (/^[\w-]{11}$/.test(u)) return { id: u };
  return null;
}
function embedSrc(v) {
  if (v.live) return "https://www.youtube.com/embed/live_stream?channel=" + encodeURIComponent(v.live) + "&autoplay=1&playsinline=1";
  var base = "https://www.youtube-nocookie.com/embed/";
  return (v.list ? base + "videoseries?list=" + encodeURIComponent(v.list) + "&" : base + encodeURIComponent(v.id) + "?") + "autoplay=1&playsinline=1&rel=0";
}
// One player for the whole app: music from Focus, or a lesson from Learning (opt.learn adds a Done button).
function openPlayer(v, name, opt) {
  opt = opt || {};
  if (!pop) { pop = document.createElement("div"); pop.className = "ytpop"; pop.id = "ytpop"; pop.setAttribute("role", "region"); document.body.appendChild(pop); }
  pop.setAttribute("aria-label", opt.learn ? "Lesson player" : "Music player");
  pop.classList.remove("min"); pop.classList.toggle("learn", !!opt.learn); nowId = vkey(v);
  pop.innerHTML = '<div class="ytbar">' + (opt.learn ? '' : '<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>') + '<b>' + Q.esc(name) + '</b>' +
    (opt.learn ? '<button class="ghost" data-lndone="' + Q.esc(opt.learn) + '" style="color:var(--leaf);border-color:var(--leaf)" aria-label="I finished this video">Done</button>' : '') +
    '<a class="ghost" href="' + watchUrl(v) + '" target="_blank" rel="noopener" style="text-decoration:none" aria-label="Open on YouTube if the player does not work">YouTube</a>' +
    '<button class="ghost" data-ytmin="1" aria-label="Make the player small">Hide</button><button class="ghost" data-ytclose="1" aria-label="Close the player">Close</button></div>' +
    '<div class="ytbody"><iframe src="' + embedSrc(v) + '" title="' + Q.esc(name) + '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
  room(); drawMusic();
}
function closePlayer() { if (pop) { pop.remove(); pop = null; } nowId = null; room(); drawMusic(); }
function room() { // leave space at the bottom of the page so the player never covers buttons
  document.body.classList.toggle("pop", !!pop);
  if (pop) document.body.style.setProperty("--popH", pop.offsetHeight + "px");
  try { window.dispatchEvent(new Event("qr-player")); } catch (e) {}
}
addEventListener("resize", room);
function drawMusic() {
  $("pm-stations").innerHTML = STATIONS.map(function (s, i) { return '<button class="station" data-st="' + i + '" aria-pressed="' + (nowId === vkey(s.v)) + '"><b>' + Q.esc(s.name) + '</b><small>' + s.sub + '</small></button>'; }).join("");
  var mine = videos();
  $("pm-mine").innerHTML = mine.length ? mine.map(function (v, i) {
    var key = vkey(v);
    return '<div class="mine"><button class="station" data-ymine="' + i + '" aria-pressed="' + (nowId === key) + '"><b>' + Q.esc(v.name) + '</b><small>' + (v.list ? "Playlist" : "Video") + '</small></button>' +
      '<button class="ibtn" data-ydel="' + i + '" aria-label="Remove ' + Q.esc(v.name) + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  }).join("") : '<div class="muted" style="font-size:13px">Add a body-doubling or study-with-me video you like. It plays in the same small player.</div>';
}

/* ---------- events ---------- */
document.addEventListener("click", function (e) {
  var b = e.target.closest("button"); if (!b) return;
  var d = b.dataset;
  if (b.id === "pm-go") { if (st.running) pause(); else startRun(); return; }
  if (b.id === "pm-skip") { finishPhase(false); return; }
  if (b.id === "pm-reset") { st.running = false; st.left = total(); persist(); draw(); return; }
  if (d.pmset) { if (st.preset === d.pmset) return; st.preset = d.pmset; if (!st.running) st.left = total(); else st.endAt = Date.now() + Math.min(leftNow(), total()) * 1000; persist(); drawPresets(); draw(); return; }
  if (d.pmmark) { if (st.quest) { var q = Q.find(st.quest); if (q && !Q.isDone(q)) Q.doQuest(q.id); } $("pm-note").hidden = true; st.quest = null; persist(); draw(); return; }
  if (d.st !== undefined) { var s = STATIONS[+d.st]; if (!s) return; if (nowId === vkey(s.v)) closePlayer(); else openPlayer(s.v, s.name); return; }
  if (d.ymine !== undefined) { var v = videos()[+d.ymine]; if (!v) return; if (nowId === vkey(v)) closePlayer(); else openPlayer(v, v.name); return; }
  if (d.ydel !== undefined) { var arr = videos(), i = +d.ydel, gone = arr[i]; arr.splice(i, 1); Q.change(); drawMusic(); Q.toast("Video removed", function () { videos().splice(i, 0, gone); Q.change(); drawMusic(); }); return; }
  if (d.ytmin) { pop.classList.toggle("min"); b.textContent = pop.classList.contains("min") ? "Show" : "Hide"; room(); return; }
  if (d.ytclose) { closePlayer(); return; }
});
document.addEventListener("submit", function (e) {
  if (e.target.id !== "pm-add") return;
  var v = parseYT($("pm-url").value);
  if (!v) { Q.toast("That does not look like a YouTube link."); return; }
  if (v.handle) { Q.toast("Channel links with @ cannot play here. Open one of their videos and paste that link."); return; }
  v.name = $("pm-name").value.trim() || (v.list ? "My playlist " : "My video ") + (videos().length + 1);
  videos().push(v); $("pm-url").value = ""; $("pm-name").value = ""; Q.change(); drawMusic();
  openPlayer(v, v.name);
});

window.Focus = {
  play: function (v, name, opt) { openPlayer(v, name, opt); },
  close: closePlayer,
  playing: function () { return nowId; },
  startFor: function (q) {
    st.quest = q.id; if (st.phase !== "focus") { st.phase = "focus"; st.left = total(); st.running = false; }
    startRun(); $("t-h").scrollIntoView({ behavior: "smooth", block: "center" });
  }
};
drawPresets(); draw(); drawMusic();
})();
