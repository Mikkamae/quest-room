/* Quest Room screens. Game rules live in game.js; this file draws and saves. */
(function () {
"use strict";
var G = window.Game, $ = function (id) { return document.getElementById(id); };
var S = G.fresh();
var DOM = {}; G.DOMAINS.forEach(function (d) { DOM[d.id] = d; });
var DIFF = {}; G.DIFFS.forEach(function (d) { DIFF[d.id] = d; });
// Three separate levels. Each one only counts XP from its own life areas.
var TRACKS = [
  { id: "free", name: "Freelance Creative", short: "Freelance", doms: ["career", "finances"], color: "#f2b45a", note: "Craft + Wealth" },
  { id: "scholar", name: "Scholar", short: "Scholar", doms: ["learning"], color: "#b7a2e6", note: "Wisdom" },
  { id: "hero", name: "Hero", short: "Hero", doms: ["health", "home", "creativity"], color: "#e88466", note: "Vitality + Harmony + Spirit" }
];
var TRANKS = [[1, "E"], [5, "D"], [10, "C"], [15, "B"], [20, "A"], [30, "S"]];
function trackLevel(t) {
  var per = Math.max(10, +S.settings.perLevel || 100), xp = 0;
  t.doms.forEach(function (d) { xp += G.domainXp(S, d); });
  var l = Math.floor(xp / per) + 1, rank = "E";
  TRANKS.forEach(function (r) { if (l >= r[0]) rank = r[1]; });
  return { level: l, rank: rank, into: xp % per, per: per, xp: xp };
}
function lvls() { return TRACKS.map(function (t) { return trackLevel(t).level; }); }
// Returns a "Level up!" message if any track went up, or "" if none did.
function lvlUp(before) {
  var after = lvls();
  for (var i = 0; i < TRACKS.length; i++) if (after[i] > before[i]) return "Level up! <b>" + TRACKS[i].name + "</b> reached <b>Level " + after[i] + "</b>";
  return "";
}
// One-time fix: studying ads is business, so it moves from Wisdom to Craft (old XP too).
function tracksFix() {
  if (S.settings.tracks1) return false;
  S.settings.tracks1 = true;
  if (!S.skills.some(function (k) { return k.id === "sk-craft"; })) S.skills.push({ id: "sk-craft", name: "Ad study", domain: "career" });
  S.quests.forEach(function (q) {
    if (q.domain !== "learning" || !/^look at one ad/i.test(q.title)) return;
    q.domain = "career"; if (q.skill === "sk-mind") q.skill = "sk-craft";
    var pre = "quest:" + q.id;
    S.ledger.forEach(function (e) { if ((e.k === pre || e.k.indexOf(pre + ":") === 0) && e.d === "learning") { e.d = "career"; if (e.s === "sk-mind") e.s = "sk-craft"; } });
  });
  return true;
}
var REPEAT = { once: "One time", daily: "Every day", weekly: "Every week" };
var tab = "home", qStatus = "active", qDomain = "all", editing = null, confirmReward = null, busy = false;

function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
var I = {
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
  star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  starOn: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  edit: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  box: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18v4H3zM5 11v9h14v-9M10 15h4"/></svg>',
  play: '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>',
  trophy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/></svg>'
};

/* ---------- Train tab: added to the page here ---------- */
(function addTrain() {
  var css = document.createElement("style");
  css.textContent =
    ".levels{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
    ".levels button{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px;font-weight:600;text-align:left;display:flex;flex-direction:column;gap:2px}" +
    ".levels button small{font-weight:400;color:var(--muted);font-size:12px}" +
    ".levels button[aria-pressed=\"true\"]{border-color:#e88466;background:#e884661a;color:#e88466}" +
    ".wweek{display:flex;gap:6px;align-items:center;margin-top:14px;flex-wrap:wrap;font-size:13px;color:var(--muted)}" +
    ".pip{width:28px;height:10px;border-radius:99px;background:#ffffff14}.pip.on{background:#e88466}" +
    ".workout{background:var(--card);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px}" +
    ".workout.done{border:1px solid #93cf8c66}" +
    ".w-head{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}" +
    ".w-title{font-family:var(--f-display);font-size:24px;line-height:1.1}" +
    ".ex{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 12px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}" +
    ".ex b{font-weight:600;font-size:14px;line-height:1.3}" +
    ".ex .rx{font-family:var(--f-game);color:#e88466;font-size:14px;white-space:nowrap}" +
    ".ex small{grid-column:1/-1;color:var(--muted);font-size:12px;margin-top:-4px}" +
    ".dots{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}" +
    ".dot{min-width:44px;height:36px;border-radius:10px;border:1px solid var(--line);background:var(--night);color:var(--muted);font-size:12px;font-family:var(--f-game);padding:0 8px}" +
    ".dot[aria-pressed=\"true\"]{background:#e88466;border-color:#e88466;color:#2a1a0c}" +
    ".w-foot{display:flex;gap:10px;align-items:center;flex-wrap:wrap}" +
    ".rest{display:flex;gap:8px;align-items:center;flex-wrap:wrap}" +
    ".rest .num{font-size:22px;min-width:64px}" +
    ".safety{font-size:13px;color:var(--muted);margin:0}";
  document.head.appendChild(css);
  var nav = document.querySelector(".tabs"), before = nav.querySelector('[data-tab="character"]');
  var btn = document.createElement("button"); btn.className = "tab"; btn.dataset.tab = "train";
  btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/></svg>Train';
  nav.insertBefore(btn, before);
  var sec = document.createElement("section"); sec.id = "v-train"; sec.className = "col"; sec.setAttribute("aria-label", "Train"); sec.hidden = true;
  sec.innerHTML =
    '<section class="panel" aria-labelledby="tr-h"><div class="ph"><h2 id="tr-h">Calisthenics</h2><span class="meta" id="tr-xp"></span></div>' +
    '<div class="levels" id="tr-levels"></div><div class="wweek" id="tr-week"></div>' +
    '<p class="muted" style="font-size:13px;margin:10px 0 0" id="tr-note"></p></section>' +
    '<section class="panel" aria-labelledby="rest-h"><div class="ph"><h2 id="rest-h">Rest timer</h2></div><div class="rest">' +
    '<span class="num" id="rest-left">0:00</span><button class="ghost" data-rest="60">60 sec</button><button class="ghost" data-rest="90">90 sec</button><button class="ghost" data-rest="120">2 min</button><button class="ghost" data-rest="0">Stop</button></div></section>' +
    '<div class="col" id="tr-list"></div>' +
    '<section class="panel"><p class="safety">Warm up for 5 minutes first: arm circles, leg swings, light jumping jacks. Feeling tired is normal. Sharp pain is not, so stop that exercise. Too easy? Do the top number of reps on every set for two workouts, then move to Intermediate.</p></section>';
  document.getElementById("v-missions").after(sec);

  /* Grow: plan + languages. Group tabs so the bar stays at four. */
  var css2 = document.createElement("style");
  css2.textContent =
    ".subtabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px}" +
    ".subtabs::-webkit-scrollbar{display:none}" +
    ".subtabs button{flex:none;background:var(--wall);border:1px solid var(--line);border-radius:999px;padding:7px 14px;font-size:14px;font-weight:600;color:var(--muted)}" +
    ".subtabs button[aria-current=\"page\"]{color:var(--lamp);border-color:var(--lamp);background:#f2b45a14}" +
    ".plan-row{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--line)}" +
    ".plan-row:first-child{border-top:none}" +
    ".plan-row .d{font-family:var(--f-game);color:var(--muted)}.plan-row.today .d{color:var(--lamp)}" +
    ".chips{display:flex;gap:6px;flex-wrap:wrap}" +
    ".pchip{border:1px solid var(--line);background:var(--night);color:var(--muted);border-radius:999px;padding:5px 10px;font-size:12px;font-weight:600}" +
    ".pchip[aria-pressed=\"true\"]{color:#2a1a0c;border-color:transparent;background:var(--c)}" +
    ".mins{font-family:var(--f-game);font-size:13px;color:var(--muted);white-space:nowrap}.mins.hi{color:var(--dusk)}" +
    ".today-item{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:12px;align-items:center;background:var(--card);border-radius:14px;padding:10px 12px}" +
    ".today-item.done{opacity:.62}" +
    ".today-item .q-icon{font-size:12px}" +
    ".course-head{display:flex;gap:14px;align-items:center;flex-wrap:wrap}" +
    ".links{display:flex;flex-direction:column;gap:6px;margin-top:12px;font-size:13px}.links a{color:var(--lilac)}" +
    ".week-card{background:var(--card);border-radius:16px;overflow:hidden}" +
    ".week-card>button{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;background:none;border:none;padding:14px 16px;text-align:left}" +
    ".week-card .wk{font-family:var(--f-game);font-size:13px;color:var(--c);white-space:nowrap}" +
    ".week-card .wt{font-weight:600}" +
    ".week-card.current{border:1px solid color-mix(in srgb, var(--c) 50%, transparent)}" +
    ".lessons{padding:0 16px 14px;display:flex;flex-direction:column}" +
    ".lesson{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}" +
    ".lesson b{font-weight:600;font-size:14px}.lesson p{grid-column:1;margin:0;font-size:13px;color:var(--muted);overflow-wrap:anywhere}" +
    ".lesson .tick{grid-row:1 / span 2;grid-column:2}.lesson.done .tick{background:var(--leaf);border-color:var(--leaf);color:var(--night)}" +
    ".lesson.done b{text-decoration:line-through;text-decoration-color:#f4eadf66;color:var(--muted)}" +
    ".lesson.next b{color:var(--c)}";
  document.head.appendChild(css2);
  /* Day look: a light room in the morning and afternoon. Night keeps the dark room. */
  var css3 = document.createElement("style");
  var L = ":root[data-ui=\"light\"] ";
  css3.textContent =
    L + "{--night:#f3ebe1;--wall:#fffaf4;--card:#f6ede3;--card2:#ecdfd1;--line:#e2d2c1;--lamp:#a6600e;--dusk:#b24d2c;--lilac:#6a52ad;--leaf:#3b8236;--text:#2b1f2c;--muted:#6c5c66;color-scheme:light}" +
    L + ".btn," + L + ".pbtn," + L + ".step.done .node{color:#fff}" +
    L + ".greet p{color:#2b1f2cd9}" + L + ".greet .label{color:#2b1f2c}" +
    L + ".greet h1," + L + ".greet p," + L + ".greet .label{text-shadow:0 1px 14px #fffaf4}" +
    L + ".levelcard{background:#fffaf4e0}" +
    L + ".bar," + L + ".mini," + L + ".wcol," + L + ".badge .ic," + L + ".pip{background:#2b1f2c14}" +
    L + ".quest.done .q-title{text-decoration-color:#2b1f2c66}" +
    L + ".ibtn:hover{background:#2b1f2c0d}" +
    L + ".q-icon," + L + ".tag," + L + ".area .attr," + L + ".week-card .wk{color:color-mix(in srgb, var(--c) 55%, #1d1220)}" +
    L + ".skill .num," + L + ".course-head .num{color:color-mix(in srgb, var(--c) 55%, #1d1220)!important}" +
    L + "#radar text{filter:brightness(.55)}" + L + "#radar polygon,"+ L + "#radar line{stroke:#d9c7b5}" +
    L + ".vinyl{background:radial-gradient(circle,var(--lamp) 0 14%,#fffaf4 15% 18%,#ecdfd1 19% 100%)}" +
    L + ".subtabs button[aria-current=\"page\"]{background:#a6600e14}" +
    "@media (max-width:640px){" + L + ".tabs{background:#fffaf4f2}}" +
    ".hero{--floor:72px}.hero .hero-inner{padding-bottom:calc(18px + var(--floor))}" +
    ".catpick{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
    ".catpick button{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px;display:flex;align-items:center;gap:10px;text-align:left;font-weight:600}" +
    ".catpick button small{display:block;font-weight:400;color:var(--muted);font-size:12px}" +
    ".catpick button[aria-pressed=\"true\"]{border-color:var(--lamp);background:color-mix(in srgb, var(--lamp) 10%, var(--card))}" +
    ".catpic{width:48px;height:48px;flex:none;background-repeat:no-repeat;background-size:192px auto;image-rendering:pixelated}" +
    ".cat-bubble{position:absolute;z-index:3;max-width:min(240px,70%);background:#17111ced;color:#f4eadf;border:1px solid #f2b45a88;border-radius:14px;padding:9px 12px;font-family:var(--f-game);font-size:14px;line-height:1.35;cursor:pointer;box-shadow:0 6px 18px #0006}" +
    ".cat-bubble::after{content:'';position:absolute;left:var(--tail,50%);bottom:-7px;width:12px;height:12px;margin-left:-6px;background:#17111ced;border-right:1px solid #f2b45a88;border-bottom:1px solid #f2b45a88;transform:rotate(45deg)}" +
    ".cat-bubble.pop{animation:bubpop .25s ease-out}@keyframes bubpop{from{transform:translateY(6px) scale(.92);opacity:0}}" +
    "@media (prefers-reduced-motion: reduce){.cat-bubble.pop{animation:none}}";
  document.head.appendChild(css3);
  var rulesPanel = document.getElementById("rules").closest(".panel"), room = document.createElement("section");
  room.className = "panel"; room.setAttribute("aria-labelledby", "room-h");
  room.innerHTML = '<div class="ph"><h2 id="room-h">Your room</h2></div>' +
    '<div class="label" style="margin-bottom:8px">Which cat is you?</div><div class="catpick" id="cat-pick"></div>' +
    '<div class="label" style="margin:16px 0 8px">Room light</div><div class="filters" id="look-pick" style="margin:0"></div>' +
    '<p class="muted" style="font-size:13px;margin:12px 0 0">The room follows the real time: morning, afternoon, evening and night. Your cat stays awake while you play, and the other cat naps. After a minute with no taps, both go to sleep. Tap a cat on Home for a message.</p>';
  rulesPanel.before(room);
  /* Pitch tracker (in Quests) and backup (in Me) */
  var css4 = document.createElement("style");
  css4.textContent =
    ".pstats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}" +
    ".pstat{background:var(--card);border-radius:12px;padding:10px;text-align:center}" +
    ".pstat b{display:block;font-family:var(--f-game);font-size:22px;font-weight:500;color:var(--lamp)}" +
    ".pstat small{color:var(--muted);font-size:12px}" +
    ".pitch{background:var(--card);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;border:1px solid transparent}" +
    ".pitch.due{border-color:var(--dusk)}" +
    ".p-top{display:flex;gap:10px;align-items:flex-start}" +
    ".p-brand{font-weight:600;font-size:16px;overflow-wrap:anywhere}" +
    ".p-sub{font-size:13px;color:var(--muted);overflow-wrap:anywhere}.p-sub a{color:var(--lilac)}" +
    ".p-note{font-size:13px;margin:0;overflow-wrap:anywhere}" +
    ".p-acts{display:flex;gap:6px;flex-wrap:wrap}" +
    ".p-acts .btn{padding:6px 12px;font-size:13px}" +
    ".pst{font-size:12px;font-weight:600;border-radius:999px;padding:2px 9px;white-space:nowrap;color:var(--c);background:color-mix(in srgb, var(--c) 16%, transparent)}" +
    ".duetag{color:var(--dusk);font-weight:600}" +
    ".filelabel{cursor:pointer;display:inline-flex;align-items:center}" +
    "@media (max-width:640px){.pstats{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
    /* the two smaller levels under the main one */
    ".lv-more{display:grid;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid color-mix(in srgb, var(--text) 12%, transparent)}" +
    ".lvm{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:4px 10px;align-items:center;font-size:13px}" +
    ".lvm b{font-weight:600}.lvm .num{font-family:var(--f-game);color:var(--c)}" +
    ".lvm .mbar{grid-column:1/-1;height:6px;border-radius:999px;background:color-mix(in srgb, var(--text) 10%, transparent);overflow:hidden}" +
    ".lvm .mbar i{display:block;height:100%;background:var(--c);border-radius:inherit;transition:width .5s ease}" +
    ".lvm small{color:var(--muted);font-size:11px;text-align:right}" +
    ".tracks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px}" +
    ".trk-card{background:var(--card);border-radius:12px;padding:10px 12px;border-top:3px solid var(--c);min-width:0}" +
    ".trk-card .tn{font-size:12px;color:var(--c);font-weight:600}.trk-card b{display:block;font-family:var(--f-game);font-size:20px;font-weight:500}" +
    ".trk-card small{display:block;color:var(--muted);font-size:11px}" +
    ".trk-card .mbar{height:5px;border-radius:999px;margin-top:6px;background:color-mix(in srgb, var(--text) 10%, transparent);overflow:hidden}.trk-card .mbar i{display:block;height:100%;background:var(--c)}" +
    ":root[data-ui=\"light\"] .lvm .num,:root[data-ui=\"light\"] .trk-card .tn{color:color-mix(in srgb, var(--c) 62%, #000)}" +
    "@media (max-width:640px){.tracks{grid-template-columns:minmax(0,1fr)}}";
  document.head.appendChild(css4);
  (function () { // add the Scholar and Hero rows to the level card on Home
    var lc = document.querySelector(".levelcard"); if (!lc || $("lv-more")) return;
    var m = document.createElement("div"); m.className = "lv-more"; m.id = "lv-more"; lc.appendChild(m);
    var tr = document.createElement("div"); tr.className = "tracks"; tr.id = "tracks";
    var ar = $("radar"); if (ar) ar.parentNode.insertBefore(tr, ar);
  })();
  var data = document.createElement("section");
  data.className = "panel"; data.setAttribute("aria-labelledby", "data-h");
  data.innerHTML = '<div class="ph"><h2 id="data-h">Your data</h2><span class="meta" id="backup-last"></span></div>' +
    '<p class="muted" style="font-size:14px;margin:0 0 12px">Download a copy of everything: quests, XP, coins, lessons, workouts and pitches. Keep it somewhere safe, like your Google Drive.</p>' +
    '<div class="t-actions"><button class="btn" data-backup="1">Download backup</button>' +
    '<label class="ghost filelabel">Restore from a backup<input type="file" accept=".json,application/json" id="restore-in" hidden></label></div>' +
    '<div id="restore-box"></div>';
  rulesPanel.before(data);
  var pv = document.createElement("section"); pv.id = "v-pitches"; pv.className = "col"; pv.setAttribute("aria-label", "Pitches"); pv.hidden = true;
  pv.innerHTML =
    '<section class="panel" aria-labelledby="p-h"><div class="ph"><h2 id="p-h">Pitch tracker</h2><span class="meta" id="p-due"></span></div>' +
    '<div class="pstats" id="p-stats"></div><p class="muted" style="font-size:13px;margin:12px 0 0" id="p-goal"></p></section>' +
    '<section class="panel" aria-labelledby="pa-h"><div class="ph"><h2 id="pa-h">Add a brand</h2></div>' +
    '<form class="form" id="p-add"><input class="grow" id="pa-brand" placeholder="Brand name" required aria-label="Brand name">' +
    '<input class="grow" id="pa-contact" placeholder="Link, @handle or email (optional)" aria-label="Where to reach them">' +
    '<select id="pa-channel" aria-label="Where you pitch them"><option>Instagram DM</option><option>Email</option><option>LinkedIn</option><option>Other</option></select>' +
    '<select id="pa-status" aria-label="Pitched yet?"><option value="idea">Not pitched yet</option><option value="pitched">I pitched them today</option></select>' +
    '<input class="grow" id="pa-note" placeholder="Note, e.g. what you offered (optional)" aria-label="Note">' +
    '<button class="btn" type="submit">Add brand</button></form></section>' +
    '<section class="panel" aria-labelledby="pl2-h"><div class="ph"><h2 id="pl2-h">Your brands</h2><span class="meta" id="p-count"></span></div>' +
    '<div class="filters" id="p-filter"></div><div class="list" id="p-list"></div></section>';
  document.getElementById("v-missions").after(pv);
  var mk = function (id, label, html) { var el = document.createElement("section"); el.id = id; el.className = "col"; el.setAttribute("aria-label", label); el.hidden = true; el.innerHTML = html; return el; };
  var plan = mk("v-plan", "Weekly plan",
    '<section class="panel" aria-labelledby="pl-h"><div class="ph"><h2 id="pl-h">Your week</h2><span class="meta">Tap to switch a day on or off</span></div><div id="pl-rows"></div></section>' +
    '<section class="panel"><div class="ph"><h2>How the week works</h2></div><div id="pl-notes" class="muted" style="font-size:14px;display:flex;flex-direction:column;gap:8px"></div></section>');
  var igbo = mk("v-igbo", "Igbo", '<div class="col" id="c-igbo"></div>');
  var jp = mk("v-japanese", "Japanese", '<div class="col" id="c-japanese"></div>');
  var learn = mk("v-learn", "Learning", '<div class="col" id="c-learn"></div>');
  sec.after(plan); plan.after(igbo); igbo.after(jp); jp.after(learn);
  sec.before(plan);
  var sub = document.createElement("div"); sub.className = "subtabs"; sub.id = "subtabs"; sub.setAttribute("role", "tablist");
  nav.after(sub);
  var today = document.createElement("section"); today.className = "panel"; today.setAttribute("aria-labelledby", "td-h");
  today.innerHTML = '<div class="ph"><h2 id="td-h">Today\'s plan</h2><span class="meta num" id="td-min"></span></div><div class="list" id="td-list"></div>';
  var homeCol = document.querySelector("#v-home .grid2 .col"); homeCol.insertBefore(today, homeCol.firstChild);
  var ICON = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    quests: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    grow: '<path d="M12 21v-9M12 12C12 7 8 4 4 4c0 5 3 8 8 8zM12 14c0-4 3-7 8-7 0 4-3 7-8 7z"/>',
    me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'
  };
  nav.innerHTML = [["home", "Home"], ["quests", "Quests"], ["grow", "Grow"], ["me", "Me"]].map(function (g) {
    return '<button class="tab" data-group="' + g[0] + '"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICON[g[0]] + '</svg>' + g[1] + '</button>';
  }).join("");
})();
var VIEWS = ["home", "quests", "missions", "pitches", "plan", "learn", "train", "igbo", "japanese", "character", "rewards"];
var GROUPS = { home: [["home", "Home"]], quests: [["quests", "Quest board"], ["missions", "Missions"], ["pitches", "Pitches"]], grow: [["plan", "This week"], ["learn", "Learning"], ["train", "Train"], ["igbo", "Igbo"], ["japanese", "Japanese"]], me: [["character", "Character"], ["rewards", "Rewards"]] };
var lastInGroup = { home: "home", quests: "quests", grow: "plan", me: "character" };
function groupOf(v) { for (var g in GROUPS) if (GROUPS[g].some(function (x) { return x[0] === v; })) return g; return "home"; }
var openWeek = {};

function opts(list, val) { return list.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === val ? " selected" : "") + '>' + esc(o[1]) + '</option>'; }).join(""); }
function domainOpts(v) { return opts(G.DOMAINS.map(function (d) { return [d.id, d.name]; }), v); }
function diffOpts(v) { return opts(G.DIFFS.map(function (d) { return [d.id, d.name + " · " + G.questXp(S, { diff: d.id }) + " XP"]; }), v); }
function skillOpts(v, domain) {
  var l = [["", "No skill"]].concat(S.skills.filter(function (k) { return !domain || k.domain === domain; }).map(function (k) { return [k.id, k.name]; }));
  return opts(l, v);
}
function missionOpts(v) { return opts([["", "No mission"]].concat(S.missions.filter(function (m) { return m.status !== "archived"; }).map(function (m) { return [m.id, m.title]; })), v); }

/* ---------- saving ---------- */
var LS = "mae-quest-room-v2", saveTimer = null, pending = false;
function setSave(t) { $("save").textContent = t; }
function save() {
  clearTimeout(saveTimer); pending = true; setSave("Saving…");
  try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {}
  saveTimer = setTimeout(push, 600);
}
function push() {
  return fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: S }), credentials: "same-origin" })
    .then(function (r) {
      if (r.status === 401) { pending = false; showGate("You were signed out. Get a new code to keep playing."); return; }
      if (!r.ok) throw new Error("save " + r.status);
      pending = false; setSave("Saved");
    }).catch(function () { setSave("Not saved yet. Retrying…"); clearTimeout(saveTimer); saveTimer = setTimeout(push, 5000); });
}
function loadLocal() { try { var t = localStorage.getItem(LS); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
function change() { save(); render(); }

/* ---------- toast with undo ---------- */
var tt, undoFn = null;
function toast(html, undo) {
  $("toast-t").innerHTML = html; undoFn = undo || null; $("toast-undo").hidden = !undo;
  $("toast").classList.add("show"); clearTimeout(tt); tt = setTimeout(function () { $("toast").classList.remove("show"); undoFn = null; }, undo ? 5000 : 2400);
}
$("toast-undo").onclick = function () { if (undoFn) { undoFn(); undoFn = null; } $("toast").classList.remove("show"); };

/* ---------- quest actions ---------- */
function find(id) { return S.quests.find(function (q) { return q.id === id; }); }
function doQuest(id) {
  if (busy) return; busy = true; setTimeout(function () { busy = false; }, 250); // stops double taps
  var q = find(id); if (!q) return;
  var before = lvls(), now = new Date();
  if (G.isDone(S, q, now)) {
    if (G.undo(S, q, now)) { toast("Quest undone. XP taken back."); change(); }
    return;
  }
  var r = G.complete(S, q, now); if (!r) return;
  var msg = lvlUp(before); cheer();
  if (!msg && r.bonus) msg = "Mission complete! <b>+" + (r.xp + r.bonus) + " XP</b>";
  else if (!msg) msg = "<b>+" + r.xp + " XP</b> · +" + r.coin + " coins";
  toast(msg, function () { G.undo(S, q, now); change(); });
  change();
}

function questRow(q, o) {
  o = o || {};
  var now = new Date(), d = DOM[q.domain] || DOM.career, done = G.isDone(S, q, now), sk = S.skills.find(function (k) { return k.id === q.skill; });
  var pinned = (S.days[G.dkey(now)] || { featured: [] }).featured.indexOf(q.id) >= 0;
  var h = '<div class="quest' + (done ? " done" : "") + (q.boss ? " boss" : "") + '" style="--c:' + d.color + '">' +
    '<div class="q-icon">' + esc(d.attr.slice(0, 2)) + '</div>' +
    '<div style="min-width:0"><div class="q-title">' + esc(q.title) + '</div><div class="q-sub">' +
    '<span class="tag">' + esc(d.attr) + '</span>' +
    '<span class="xp">+' + G.questXp(S, q) + ' XP</span>' +
    (q.boss ? '<span class="tag" style="--c:#e88466">Weekly boss</span>' : (q.repeat !== "once" ? '<span>' + REPEAT[q.repeat] + '</span>' : '')) +
    (sk ? '<span>' + esc(sk.name) + '</span>' : '') +
    (q.min && !done && q.status === "active" ? '<button class="linkish" data-start="' + q.id + '">' + I.play + ' Start ' + q.min + ' min</button>' : '') +
    '</div></div><div class="q-act">';
  if (o.board && q.status !== "archived") {
    h += '<button class="ibtn" data-pin="' + q.id + '" aria-pressed="' + pinned + '" aria-label="' + (pinned ? "Unpin from tonight" : "Pin to tonight") + '">' + (pinned ? I.starOn : I.star) + '</button>' +
      '<button class="ibtn" data-edit="' + q.id + '" aria-label="Edit">' + I.edit + '</button>';
  }
  if (q.status === "archived") h += '<button class="ghost" data-restore="' + q.id + '">Bring back</button>';
  else h += '<button class="tick" data-tick="' + q.id + '" aria-pressed="' + done + '" aria-label="' + (done ? "Undo " : "Complete ") + esc(q.title) + '">' + I.check + '</button>';
  h += '</div>';
  if (editing === q.id) {
    h += '<form class="editor form" data-editform="' + q.id + '">' +
      '<input class="grow" name="title" value="' + esc(q.title) + '" required aria-label="Quest name">' +
      '<select name="domain" aria-label="Life area">' + domainOpts(q.domain) + '</select>' +
      '<select name="diff" aria-label="Difficulty">' + diffOpts(q.diff) + '</select>' +
      '<select name="repeat" aria-label="How often">' + opts([["once", "One time"], ["daily", "Every day"], ["weekly", "Every week"]], q.repeat) + '</select>' +
      '<select name="skill" aria-label="Skill">' + skillOpts(q.skill) + '</select>' +
      '<select name="mission" aria-label="Mission">' + missionOpts(q.mission || "") + '</select>' +
      '<label class="muted" style="display:flex;gap:6px;align-items:center;font-size:13px">Minutes <input type="number" name="min" min="0" max="180" step="5" value="' + (q.min || 0) + '"></label>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;width:100%"><button class="btn" type="submit">Save</button><button class="ghost" type="button" data-cancel>Cancel</button>' +
      '<button class="ghost" type="button" data-archive="' + q.id + '" style="margin-left:auto">Archive</button></div></form>';
  }
  return h + '</div>';
}

/* ---------- screens ---------- */
function renderTop() {
  applyLook();
  var L = trackLevel(TRACKS[0]);
  $("coins").textContent = G.coins(S); $("r-coins").textContent = G.coins(S);
  var ws = G.weekStart(new Date()), n = 0;
  for (var i = 0; i < 7; i++) { var d = new Date(ws); d.setDate(ws.getDate() + i); if (G.dayCount(S, d) > 0) n++; }
  $("played").textContent = n + "/7";
  $("lv").textContent = L.level; $("rank").textContent = "Rank " + L.rank;
  $("xpbar").firstElementChild.style.width = (L.into / L.per * 100) + "%";
  $("xptext").textContent = L.into + " / " + L.per + " XP"; $("xpnext").textContent = "to level " + (L.level + 1);
  if ($("lv-more")) $("lv-more").innerHTML = TRACKS.slice(1).map(function (t) {
    var T = trackLevel(t);
    return '<div class="lvm" style="--c:' + t.color + '"><b>' + t.name + '</b><span class="num">Lv ' + T.level + ' · ' + T.rank + '</span><small>' + T.into + '/' + T.per + '</small>' +
      '<div class="mbar"><i style="width:' + (T.into / T.per * 100) + '%"></i></div></div>';
  }).join("");
  var grp = groupOf(tab); lastInGroup[grp] = tab;
  document.querySelectorAll(".tab").forEach(function (b) { if (b.dataset.group === grp) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  var subs = GROUPS[grp];
  $("subtabs").hidden = subs.length < 2;
  $("subtabs").innerHTML = subs.length < 2 ? "" : subs.map(function (x) { return '<button data-tab="' + x[0] + '"' + (x[0] === tab ? ' aria-current="page"' : "") + '>' + x[1] + '</button>'; }).join("");
  VIEWS.forEach(function (t) { $("v-" + t).hidden = t !== tab; });
}

function renderHome() {
  var now = new Date(), h = now.getHours(), ph = phaseOf(now);
  $("hello").textContent = (h < 5 ? "Late night" : ph === "morning" ? "Good morning" : ph === "day" ? "Good afternoon" : "Good evening") + ", Mae";
  $("e-h").textContent = "How is your energy " + (ph === "morning" || ph === "day" ? "today?" : "tonight?");
  $("date").textContent = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  var dd = S.days[G.dkey(now)] || {};
  document.querySelectorAll("#energy button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.energy === dd.energy); });
  var note = { low: "Low-energy mode is on. Tonight's three are your smallest quests. Rest is not failure.", high: "Feeling strong? Try a big step from your main mission." }[dd.energy];
  $("e-note").hidden = !note; $("e-note").textContent = note || "";
  renderToday();
  var f = G.featured(S, now);
  $("featured").innerHTML = f.length ? f.map(function (x) { return questRow(x.q); }).join("") : '<div class="empty">Every quest is done for tonight. Rest well, hero.</div>';
  $("f-count").textContent = f.filter(function (x) { return G.isDone(S, x.q, now); }).length + "/" + f.length;
  // main mission
  var m = S.missions.find(function (x) { return x.main && x.status !== "archived"; }) || S.missions.find(function (x) { return x.status === "active"; });
  if (!m) $("mainmission").innerHTML = '<div class="empty">No mission yet. Start one in Missions.</div>';
  else {
    var p = G.missionProgress(S, m.id), next = G.missionQuests(S, m.id).find(function (q) { return q.repeat === "once" && q.status === "active"; });
    $("mainmission").innerHTML = '<div class="m-title">' + esc(m.title) + '</div>' +
      '<div class="bar"><i style="width:' + (p.pct * 100) + '%"></i></div>' +
      '<div class="bar-cap"><span class="num">' + p.done + ' of ' + p.total + ' steps</span><span>' + (m.status === "done" ? "Complete" : "In progress") + '</span></div>' +
      (next ? '<div style="margin-top:14px"><div class="label" style="margin-bottom:6px">Next step</div>' + questRow(next) + '</div>' : '');
  }
  // week bars
  var ws = G.weekStart(now), names = ["M", "T", "W", "T", "F", "S", "S"], total = 0, counts = [];
  for (var i = 0; i < 7; i++) { var d = new Date(ws); d.setDate(ws.getDate() + i); var c = G.dayCount(S, d); counts.push([d, c]); total += c; }
  var max = Math.max(3, Math.max.apply(null, counts.map(function (x) { return x[1]; })));
  $("week").innerHTML = counts.map(function (x, i) {
    return '<div class="wday' + (G.dkey(x[0]) === G.dkey(now) ? " today" : "") + '" title="' + x[1] + ' quests"><div class="wcol"><i style="height:' + (x[1] / max * 100) + '%"></i></div><small>' + names[i] + '</small></div>';
  }).join("");
  $("wtotal").textContent = total + (total === 1 ? " quest" : " quests");
}

function renderQuests() {
  var now = new Date();
  var stat = [["active", "Active"], ["habits", "Habits"], ["done", "Done"], ["archived", "Archived"]];
  $("q-status").innerHTML = stat.map(function (s) { return '<button data-qstatus="' + s[0] + '" aria-pressed="' + (qStatus === s[0]) + '">' + s[1] + '</button>'; }).join("");
  $("q-domain").innerHTML = '<button data-qdomain="all" aria-pressed="' + (qDomain === "all") + '">All areas</button>' +
    G.DOMAINS.map(function (d) { return '<button data-qdomain="' + d.id + '" style="--c:' + d.color + '" aria-pressed="' + (qDomain === d.id) + '">' + esc(d.attr) + '</button>'; }).join("");
  var list = S.quests.filter(function (q) {
    if (qDomain !== "all" && q.domain !== qDomain) return false;
    if (qStatus === "archived") return q.status === "archived";
    if (q.status === "archived") return false;
    if (qStatus === "habits") return q.repeat !== "once";
    if (qStatus === "done") return q.repeat === "once" ? q.status === "done" : G.isDone(S, q, now);
    return q.repeat === "once" ? q.status === "active" : true;
  });
  $("qb-count").textContent = list.length + (list.length === 1 ? " quest" : " quests");
  $("qlist").innerHTML = list.length ? list.map(function (q) { return questRow(q, { board: true }); }).join("") :
    '<div class="empty">' + ({ active: "No active quests here. Add one above.", habits: "No habits yet. Add a quest that repeats every day or week.", done: "Nothing finished here yet.", archived: "Nothing archived." }[qStatus]) + '</div>';
}

function renderMissions() {
  var ms = S.missions.filter(function (m) { return m.status !== "archived"; }).sort(function (a, b) { return (b.main ? 1 : 0) - (a.main ? 1 : 0) || (a.status === "done") - (b.status === "done"); });
  $("mlist").innerHTML = ms.length ? ms.map(function (m) {
    var p = G.missionProgress(S, m.id), qs = G.missionQuests(S, m.id), next = qs.findIndex(function (q) { return q.repeat === "once" && q.status === "active"; });
    return '<section class="mission' + (m.main ? " main" : "") + '">' +
      '<div class="m-head"><div style="flex:1;min-width:0"><div class="label">' + (m.main ? "Main mission" : "Mission") + (m.status === "done" ? " · Complete" : "") + '</div><div class="m-title">' + esc(m.title) + '</div></div>' +
      '<div class="q-act">' + (m.main ? '' : '<button class="ibtn" data-mmain="' + m.id + '" aria-label="Make main mission">' + I.star + '</button>') +
      '<button class="ibtn" data-marchive="' + m.id + '" aria-label="Archive mission">' + I.box + '</button></div></div>' +
      '<div><div class="bar" style="margin-top:0"><i style="width:' + (p.pct * 100) + '%"></i></div><div class="bar-cap"><span class="num">' + p.done + '/' + p.total + ' steps</span><span>Bonus ' + (S.settings.missionBonus || 0) + ' XP when all are done</span></div></div>' +
      (qs.length ? '<ol class="steps">' + qs.map(function (q, i) {
        var done = G.isDone(S, q, new Date());
        return '<li class="step' + (done ? " done" : "") + (i === next ? " next" : "") + '"><button class="node" data-tick="' + q.id + '" aria-label="' + (done ? "Undo step: " : "Complete step: ") + esc(q.title) + '">' + (done ? "✓" : (i + 1)) + '</button>' +
          '<span class="s-title">' + esc(q.title) + '</span><span class="xp" style="font-size:13px">+' + G.questXp(S, q) + '</span></li>';
      }).join("") + '</ol>' : '<div class="empty">No steps yet. Add the first one below.</div>') +
      '<form class="form" data-mstep="' + m.id + '"><input class="grow" name="title" placeholder="Add a step" required aria-label="Step name"><select name="diff" aria-label="Difficulty">' + diffOpts("standard") + '</select><button class="btn soft" type="submit">Add step</button></form>' +
      '</section>';
  }).join("") : '<div class="panel"><div class="empty">No missions yet. Start one above.</div></div>';
}

function renderTrain() {
  var now = new Date(), lvl = (S.training && S.training.level) || "beginner", P = G.PROGRAMS[lvl];
  $("tr-levels").innerHTML = ["beginner", "intermediate"].map(function (k) {
    var p = G.PROGRAMS[k];
    return '<button data-level="' + k + '" aria-pressed="' + (k === lvl) + '">' + p.name + '<small>' + p.workouts.length + ' workouts · +' + G.questXp(S, { diff: p.diff }) + ' XP each</small></button>';
  }).join("");
  var n = G.weekWorkouts(S, now), pips = "";
  for (var i = 0; i < G.WEEK_GOAL; i++) pips += '<span class="pip' + (i < n ? " on" : "") + '"></span>';
  $("tr-week").innerHTML = pips + '<span>' + Math.min(n, G.WEEK_GOAL) + ' of ' + G.WEEK_GOAL + ' workouts this week' + (n >= G.WEEK_GOAL ? ' · bonus won' : ' · +' + G.WEEK_BONUS + ' XP bonus at ' + G.WEEK_GOAL) + '</span>';
  $("tr-note").textContent = P.note;
  $("tr-xp").textContent = "Calisthenics XP: " + G.skillXp(S, "sk-cali");
  $("tr-list").innerHTML = P.workouts.map(function (w) {
    var done = G.workoutDone(S, w.id, now), total = 0, got = 0;
    var rows = w.ex.map(function (e, i) {
      var have = G.setsDone(S, w.id, i, now), dots = ""; total += e[1]; got += Math.min(have, e[1]);
      for (var k = 1; k <= e[1]; k++) dots += '<button class="dot" data-set="' + w.id + "|" + i + "|" + k + '" aria-pressed="' + (k <= have) + '" aria-label="' + esc(e[0]) + ' set ' + k + '">Set ' + k + '</button>';
      return '<div class="ex"><b>' + esc(e[0]) + '</b><span class="rx">' + e[1] + ' × ' + esc(e[2]) + '</span><small>' + esc(e[3]) + '</small><div class="dots">' + dots + '</div></div>';
    }).join("");
    return '<section class="workout' + (done ? " done" : "") + '"><div class="w-head"><div style="flex:1;min-width:0"><div class="label">' + esc(w.focus) + '</div><div class="w-title">' + esc(w.name) + '</div></div>' +
      '<span class="num muted" style="font-size:13px">' + got + '/' + total + ' sets</span></div>' + rows +
      '<div class="w-foot">' + (done ? '<span class="pos" style="font-weight:600">Done today ✓</span><button class="ghost" data-unfinish="' + w.id + '">Undo</button>'
        : '<button class="btn" data-finish="' + w.id + '">Finish workout · +' + G.workoutXp(S, w.id) + ' XP</button>' + (got < total ? '<span class="muted" style="font-size:12px">You can finish early. Any effort counts.</span>' : '')) + '</div></section>';
  }).join("");
}
var restInt = null;
function rest(sec) {
  clearInterval(restInt); restInt = null;
  if (!sec) { $("rest-left").textContent = "0:00"; return; }
  var end = Date.now() + sec * 1000;
  var tick = function () {
    var left = Math.max(0, Math.round((end - Date.now()) / 1000));
    $("rest-left").textContent = Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
    if (!left) { clearInterval(restInt); restInt = null; chime(); toast("Rest over. Next set!"); }
  };
  tick(); restInt = setInterval(tick, 250);
}


var DAYN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], PLANC = { train: "#e88466", igbo: "#b7a2e6", japanese: "#7fc8c2" };
function dayMinutes(items) { return G.questMinutes(S) + items.reduce(function (a, k) { return a + G.PLAN_ITEMS[k].minutes; }, 0); }
function renderPlan() {
  var now = new Date(), order = [1, 2, 3, 4, 5, 6, 0];
  $("pl-rows").innerHTML = order.map(function (wd) {
    var d = new Date(now); d.setDate(now.getDate() + ((wd - now.getDay() + 7) % 7));
    var items = G.planFor(S, d), m = dayMinutes(items);
    return '<div class="plan-row' + (wd === now.getDay() ? " today" : "") + '"><span class="d">' + DAYN[wd] + '</span><div class="chips">' +
      Object.keys(G.PLAN_ITEMS).map(function (k) { return '<button class="pchip" style="--c:' + PLANC[k] + '" data-plan="' + k + '|' + wd + '" aria-pressed="' + (items.indexOf(k) >= 0) + '">' + G.PLAN_ITEMS[k].name + '</button>'; }).join("") +
      '</div><span class="mins' + (m > 150 ? " hi" : "") + '">' + m + ' min</span></div>';
  }).join("");
  var qm = G.questMinutes(S);
  $("pl-notes").innerHTML = [
    "Every night: your quest hour (" + qm + " min). The minutes on each day add training and languages on top.",
    "Igbo is your main language: 20 minutes in the evening, 4 lessons and 1 family talk a week.",
    "Japanese is light: 10 minutes in the morning, 3 times a week, so it never pushes Igbo out.",
    "Training is " + G.PLAN_ITEMS.train.minutes + " minutes after work. Keep a rest day between workouts.",
    "Sunday is for rest and your weekly boss. Missing a day never takes XP away.",
    "Days over 150 minutes turn orange. That is a lot after a full work day, so move something if it feels heavy."
  ].map(function (t) { return '<span>' + esc(t) + '</span>'; }).join("");
}
function courseIcon(lang) { return lang === "igbo" ? "Ig" : "日"; }
function renderCourse(lang) {
  var c = G.COURSES[lang], p = G.courseProgress(S, lang), col = PLANC[lang];
  if (openWeek[lang] === undefined) openWeek[lang] = p.next ? p.next.w : 0;
  var head = '<section class="panel" style="--c:' + col + '"><div class="course-head"><div class="q-icon" style="width:48px;height:48px;font-size:16px">' + courseIcon(lang) + '</div>' +
    '<div style="flex:1;min-width:0"><div class="label">' + (lang === "igbo" ? "Main language" : "Light language") + '</div><div class="m-title">' + esc(c.name) + '</div></div>' +
    '<span class="num" style="color:' + col + '">' + G.skillXp(S, c.skill) + ' XP</span></div>' +
    '<div class="bar"><i style="width:' + (p.pct * 100) + '%;background:' + col + '"></i></div><div class="bar-cap"><span class="num">' + p.done + '/' + p.total + ' lessons</span><span>+' + G.UNIT_BONUS + ' XP for each finished week</span></div>' +
    '<p class="muted" style="font-size:13px;margin:12px 0 0">' + esc(c.about) + '</p>' +
    (lang === "igbo" ? '<p style="font-size:13px;margin:8px 0 0;color:var(--lilac)">Tones matter. Check every new word on Nkọwa okwu, which shows the tone marks and plays the sound.</p>' : '') +
    '<div class="links">' + c.links.map(function (k) { return '<a href="' + G.LINKS[k][1] + '" target="_blank" rel="noopener">' + esc(G.LINKS[k][0]) + '</a>'; }).join("") + '</div></section>';
  var weeks = c.weeks.map(function (wk, w) {
    var wp = G.weekProgress(S, lang, w), open = openWeek[lang] === w, cur = p.next && p.next.w === w;
    var h = '<section class="week-card' + (cur ? " current" : "") + '" style="--c:' + col + '"><button data-week="' + lang + '|' + w + '" aria-expanded="' + open + '">' +
      '<span class="wk">Week ' + (w + 1) + '</span><span class="wt">' + esc(wk.t) + '</span><span class="num muted" style="font-size:13px">' + (wp.done === wp.total ? "✓" : wp.done + "/" + wp.total) + '</span></button>';
    if (open) h += '<div class="lessons">' + wk.l.map(function (l, i) {
      var done = G.lessonDone(S, lang, w, i), next = p.next && p.next.w === w && p.next.i === i;
      return '<div class="lesson' + (done ? " done" : "") + (next ? " next" : "") + '"><b>' + esc(l[0]) + ' <span class="xp" style="font-size:12px">+' + G.lessonXp(S, lang, w, i) + '</span></b>' +
        '<button class="tick" data-lesson="' + lang + '|' + w + '|' + i + '" aria-pressed="' + done + '" aria-label="' + (done ? "Undo " : "Complete ") + esc(l[0]) + '">' + I.check + '</button><p>' + esc(l[1]) + '</p></div>';
    }).join("") + '</div>';
    return h + '</section>';
  }).join("");
  $("c-" + lang).innerHTML = head + weeks;
}
function renderToday() {
  var now = new Date(), items = G.planFor(S, now), rows = [];
  items.forEach(function (k) {
    var it = G.PLAN_ITEMS[k], done, sub, go = k;
    if (k === "train") {
      done = G.doneToday(S, "workout:", now);
      var lvl = (S.training && S.training.level) || "beginner";
      sub = G.PROGRAMS[lvl].name + " workout · " + it.minutes + " min";
    } else {
      done = G.doneToday(S, "lesson:" + k + ":", now);
      var cp = G.courseProgress(S, k), nx = cp.next ? G.COURSES[k].weeks[cp.next.w].l[cp.next.i][0] : "Course complete";
      sub = (done ? "Done today" : "Next: " + nx) + " · " + it.minutes + " min";
    }
    rows.push('<div class="today-item' + (done ? " done" : "") + '" style="--c:' + PLANC[k] + '"><div class="q-icon">' + (k === "train" ? "Tr" : courseIcon(k)) + '</div>' +
      '<div style="min-width:0"><div class="q-title">' + esc(it.name) + ' <span class="muted" style="font-size:12px;font-weight:400">· ' + esc(it.when) + '</span></div><div class="q-sub">' + esc(sub) + '</div></div>' +
      (done ? '<span class="pos" style="font-weight:700">✓</span>' : '<button class="ghost" data-tab="' + go + '">Open</button>') + '</div>');
  });
  var due = dueList().length;
  if (due) rows.unshift('<div class="today-item" style="--c:#e88466"><div class="q-icon">Pi</div>' +
    '<div style="min-width:0"><div class="q-title">Follow-ups due</div><div class="q-sub">' + due + (due === 1 ? " brand is" : " brands are") + ' waiting for a short follow-up</div></div>' +
    '<button class="ghost" data-tab="pitches">Open</button></div>');
  $("td-list").innerHTML = rows.length ? rows.join("") : '<div class="empty">Nothing extra planned today. Just your quests, or rest.</div>';
  $("td-min").textContent = dayMinutes(items) + " min";
}

/* ---------- pitch tracker ---------- */
// XP keys start with "quest:" so pitches count as quests for nights played and achievements.
var pFilter = "all";
var PST = { idea: ["To pitch", "#a99aa3"], pitched: ["Waiting", "#f2b45a"], replied: ["Replied", "#b7a2e6"], call: ["Talking", "#7fc8c2"], won: ["Client won", "#93cf8c"], closed: ["Closed", "#a99aa3"] };
function pitches() { if (!Array.isArray(S.pitches)) S.pitches = []; return S.pitches; }
function addDays(d, n) { return G.dkey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); }
function dayLabel(k) { if (!k) return ""; var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function isDue(p) { return p.status === "pitched" && p.followUpAt && p.followUpAt <= G.dkey(); }
function dueList() { return pitches().filter(isDue); }
function pAward(key, diff, note) {
  if (G.net(S, key, "xp") > 0) return 0;
  var xp = G.questXp(S, { diff: diff }), coin = Math.round(xp * (+S.settings.coinRate || 0)), now = Date.now();
  S.ledger.push({ k: key, t: "xp", a: xp, at: now, d: "career", s: "sk-sales", n: note });
  if (coin) S.ledger.push({ k: key, t: "coin", a: coin, at: now, n: note });
  return xp;
}
function pUnaward(key) {
  var xp = G.net(S, key, "xp"), coin = G.net(S, key, "coin"), now = Date.now();
  if (xp > 0) S.ledger.push({ k: key, t: "xp", a: -xp, at: now, d: "career", s: "sk-sales", n: "Undo pitch step" });
  if (coin > 0) S.ledger.push({ k: key, t: "coin", a: -coin, at: now, n: "Undo pitch step" });
}
function pitchAct(id, act) {
  var list = pitches(), p = list.find(function (x) { return x.id === id; }); if (!p) return;
  var snap = JSON.stringify(p), now = new Date(), today = G.dkey(now), base = "quest:pitch:" + p.id + ":", got = [], xp = 0, msg = "";
  var give = function (k, diff, note) { var a = pAward(base + k, diff, note); if (a) { got.push(base + k); xp += a; } };
  if (act === "pitched") { p.status = "pitched"; p.pitchedAt = today; p.followUps = 0; p.followUpAt = addDays(now, 3); give("sent", "standard", "Pitched " + p.brand); msg = "Pitch sent! Follow up on " + dayLabel(p.followUpAt) + " if they are quiet."; }
  else if (act === "followup") { p.followUps = (p.followUps || 0) + 1; p.lastFollowUp = today; p.followUpAt = p.followUps < 2 ? addDays(now, 4) : ""; give("fu" + p.followUps, "easy", "Followed up with " + p.brand); msg = p.followUps < 2 ? "Followed up. Next check: " + dayLabel(p.followUpAt) + "." : "Last follow-up done. If they stay quiet, close it and move on."; }
  else if (act === "replied") { p.status = "replied"; p.repliedAt = today; p.followUpAt = ""; give("reply", "challenging", p.brand + " replied"); msg = "A reply! That is real progress."; }
  else if (act === "call") { p.status = "call"; give("call", "standard", "Talking with " + p.brand); msg = "Nice. Send your price and plan next."; }
  else if (act === "won") { p.status = "won"; p.wonAt = today; give("won", "major", "Won " + p.brand + " as a client"); msg = "You won a client! Go tick the mission steps too."; }
  else if (act === "close") { p.status = "closed"; p.followUpAt = ""; msg = "Closed. No XP lost. On to the next brand."; }
  else if (act === "reopen") { p.status = p.repliedAt ? "replied" : p.pitchedAt ? "pitched" : "idea"; if (p.status === "pitched" && (p.followUps || 0) < 2) p.followUpAt = today; msg = "Reopened."; }
  else return;
  p.updated = Date.now();
  if (xp) cheer();
  toast((xp ? "<b>+" + xp + " XP</b> · " : "") + esc(msg), function () {
    var i = pitches().findIndex(function (x) { return x.id === id; }); if (i >= 0) pitches()[i] = JSON.parse(snap);
    got.forEach(pUnaward); change();
  });
  change();
}
function contactHtml(c) {
  if (!c) return "";
  if (/^https?:\/\/\S+$/i.test(c)) return '<a href="' + esc(c) + '" target="_blank" rel="noopener">' + esc(c.replace(/^https?:\/\/(www\.)?/i, "")) + '</a>';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return '<a href="mailto:' + esc(c) + '">' + esc(c) + '</a>';
  return esc(c);
}
function pitchCard(p) {
  var st = PST[p.status] || PST.idea, due = isDue(p), dates = [], acts = [];
  if (p.pitchedAt) dates.push("Pitched " + dayLabel(p.pitchedAt));
  if (p.followUps) dates.push(p.followUps + (p.followUps === 1 ? " follow-up" : " follow-ups"));
  if (p.status === "pitched" && p.followUpAt) dates.push(due ? '<span class="duetag">Follow up today</span>' : "Follow up " + dayLabel(p.followUpAt));
  if (p.status === "pitched" && !p.followUpAt) dates.push("Waiting after 2 follow-ups");
  if (p.wonAt) dates.push("Won " + dayLabel(p.wonAt));
  var X = function (diff) { return " · +" + G.questXp(S, { diff: diff }); };
  var b = function (act, label, main) { return '<button class="' + (main ? "btn" : "ghost") + '" data-pact="' + p.id + "|" + act + '">' + label + '</button>'; };
  if (p.status === "idea") acts.push(b("pitched", "I pitched them" + X("standard"), 1));
  if (p.status === "pitched") { if ((p.followUps || 0) < 2) acts.push(b("followup", "I followed up" + X("easy"), due)); acts.push(b("replied", "They replied" + X("challenging"), !due)); acts.push(b("close", "Close")); }
  if (p.status === "replied") { acts.push(b("call", "We are talking" + X("standard"), 1)); acts.push(b("won", "Won the client" + X("major"))); acts.push(b("close", "Close")); }
  if (p.status === "call") { acts.push(b("won", "Won the client" + X("major"), 1)); acts.push(b("close", "Close")); }
  if (p.status === "closed") acts.push(b("reopen", "Reopen"));
  return '<div class="pitch' + (due ? " due" : "") + '"><div class="p-top"><div style="flex:1;min-width:0"><div class="p-brand">' + esc(p.brand) + '</div>' +
    '<div class="p-sub">' + esc(p.channel || "") + (p.contact ? " · " + contactHtml(p.contact) : "") + '</div></div>' +
    '<span class="pst" style="--c:' + st[1] + '">' + st[0] + '</span><button class="ibtn" data-pdel="' + p.id + '" aria-label="Remove ' + esc(p.brand) + '">' + I.box + '</button></div>' +
    (dates.length ? '<div class="p-sub">' + dates.join(" · ") + '</div>' : '') +
    (p.note ? '<p class="p-note">' + esc(p.note) + '</p>' : '') +
    (acts.length ? '<div class="p-acts">' + acts.join("") + '</div>' : '') + '</div>';
}
function renderPitches() {
  var list = pitches(), sent = list.filter(function (p) { return p.pitchedAt; }).length;
  var replies = list.filter(function (p) { return p.repliedAt || p.status === "replied" || p.status === "call" || p.status === "won"; }).length;
  var won = list.filter(function (p) { return p.status === "won"; }).length, due = dueList().length;
  $("p-stats").innerHTML = [[sent, "Pitched"], [replies, "Replies"], [sent ? Math.round(replies / sent * 100) + "%" : "–", "Reply rate"], [won, "Clients won"]]
    .map(function (s) { return '<div class="pstat"><b>' + s[0] + '</b><small>' + s[1] + '</small></div>'; }).join("");
  $("p-due").textContent = due ? due + " follow-up" + (due === 1 ? "" : "s") + " due" : "";
  $("p-goal").textContent = (sent < 10 ? "Mission step: send 10 pitches. You have sent " + sent + " of 10. " : "You have passed 10 pitches. Keep going until one says yes. ") +
    "If a brand is quiet after 3 days, send one short, friendly follow-up. The app reminds you on Home.";
  var F = [["all", "All"], ["idea", "To pitch"], ["pitched", "Waiting"], ["talking", "Replied"], ["won", "Won"], ["closed", "Closed"]];
  $("p-filter").innerHTML = F.map(function (f) { return '<button data-pfilter="' + f[0] + '" aria-pressed="' + (pFilter === f[0]) + '">' + f[1] + '</button>'; }).join("");
  var show = list.filter(function (p) {
    if (pFilter === "all") return true;
    if (pFilter === "talking") return p.status === "replied" || p.status === "call";
    return p.status === pFilter;
  }).slice().sort(function (a, b) { return (isDue(b) ? 1 : 0) - (isDue(a) ? 1 : 0) || (b.updated || 0) - (a.updated || 0); });
  $("p-count").textContent = show.length + (show.length === 1 ? " brand" : " brands");
  $("p-list").innerHTML = show.length ? show.map(pitchCard).join("") :
    '<div class="empty">' + (list.length ? "No brands here." : "No brands yet. Add the first brand you want to work with above.") + '</div>';
}

/* ---------- backup ---------- */
var pendingRestore = null;
function downloadBackup() {
  S.settings.lastBackup = Date.now();
  var blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" }), a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "quest-room-backup-" + G.dkey() + ".json";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  toast("Backup downloaded. Keep the file somewhere safe."); change();
}
function renderBackup() {
  var lb = S.settings.lastBackup;
  $("backup-last").textContent = lb ? "Last backup: " + new Date(lb).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "No backup yet";
  if (!pendingRestore) { $("restore-box").innerHTML = ""; return; }
  var o = pendingRestore, xp = o.ledger.filter(function (e) { return e.t === "xp"; }).reduce(function (s, e) { return s + e.a; }, 0);
  $("restore-box").innerHTML = '<div class="confirm" style="margin-top:12px"><span>This backup has <b>' + Math.max(0, xp) + ' XP</b> and ' + o.quests.length + ' quests. Restoring replaces everything in the app now. Continue?</span>' +
    '<button class="btn" data-rsyes="1">Yes, restore it</button><button class="ghost" data-rsno="1">Cancel</button></div>';
}
document.addEventListener("change", function (e) {
  if (e.target.id !== "restore-in") return;
  var f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
  var rd = new FileReader();
  rd.onload = function () {
    var o = null; try { o = JSON.parse(rd.result); } catch (x) {}
    if (!o || o.v !== 2 || !Array.isArray(o.ledger) || !Array.isArray(o.quests)) { toast("That file is not a Quest Room backup."); return; }
    pendingRestore = o; render();
  };
  rd.readAsText(f);
});

function renderCharacter() {
  renderBackup();
  $("c-level").textContent = G.xpTotal(S) + " XP in total";
  if ($("tracks")) $("tracks").innerHTML = TRACKS.map(function (t) {
    var T = trackLevel(t);
    return '<div class="trk-card" style="--c:' + t.color + '"><span class="tn">' + t.name + '</span><b>Lv ' + T.level + ' · Rank ' + T.rank + '</b><small>' + t.note + ' · ' + T.xp + ' XP</small>' +
      '<div class="mbar"><i style="width:' + (T.into / T.per * 100) + '%"></i></div></div>';
  }).join("");
  var vals = G.DOMAINS.map(function (d) { return G.domainXp(S, d.id); });
  var top = Math.max(100, Math.ceil(Math.max.apply(null, vals) / 100) * 100);
  var cx = 170, cy = 148, R = 100, n = 6;
  var pt = function (i, r) { var a = (-90 + i * 60) * Math.PI / 180; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  var g = "";
  [0.25, 0.5, 0.75, 1].forEach(function (f) { g += '<polygon points="' + G.DOMAINS.map(function (_, i) { return pt(i, R * f).join(","); }).join(" ") + '" fill="none" stroke="#3b2e41"/>'; });
  G.DOMAINS.forEach(function (_, i) { var p = pt(i, R); g += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="#3b2e41"/>'; });
  g += '<polygon points="' + vals.map(function (v, i) { return pt(i, Math.max(5, v / top * R)).join(","); }).join(" ") + '" fill="#f2b45a2e" stroke="#f2b45a" stroke-width="2" stroke-linejoin="round"/>';
  G.DOMAINS.forEach(function (d, i) {
    var p = pt(i, Math.max(5, vals[i] / top * R)); g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="' + d.color + '"/>';
    var l = pt(i, R + 20), anchor = Math.abs(l[0] - cx) < 4 ? "middle" : (l[0] > cx ? "start" : "end");
    g += '<text x="' + l[0] + '" y="' + (l[1] + 4) + '" text-anchor="' + anchor + '" font-size="13" font-weight="600" font-family="Figtree, sans-serif" fill="' + d.color + '">' + d.attr + '</text>';
  });
  g += '<text x="' + (cx + 4) + '" y="' + (cy - R + 12) + '" font-size="9" fill="#a99aa3" font-family="Figtree, sans-serif">' + top + '</text>';
  $("radar").innerHTML = g;
  $("radar").setAttribute("aria-label", "Life area chart: " + G.DOMAINS.map(function (d, i) { return d.attr + " " + vals[i] + " XP"; }).join(", "));
  $("areas").innerHTML = G.DOMAINS.map(function (d, i) {
    var x = vals[i]; return '<div class="area" style="--c:' + d.color + '"><span class="attr">' + d.attr + ' · Lv ' + (Math.floor(x / 100) + 1) + '</span><b>' + esc(d.name) + '</b><span class="num muted" style="font-size:12px">' + x + ' XP</span><div class="mini"><i style="width:' + (x % 100) + '%"></i></div></div>';
  }).join("");
  $("skills").innerHTML = S.skills.length ? S.skills.map(function (k) {
    var x = G.skillXp(S, k.id), d = DOM[k.domain] || DOM.career;
    return '<div class="skill" style="--c:' + d.color + '"><div style="min-width:0"><b>' + esc(k.name) + '</b> <span class="tag">' + esc(d.attr) + '</span><div class="mini"><i style="width:' + (x % 100) + '%"></i></div></div>' +
      '<span class="num" style="color:' + d.color + '">Lv ' + (Math.floor(x / 100) + 1) + ' · ' + x + '</span><button class="ibtn" data-delskill="' + k.id + '" aria-label="Remove skill ' + esc(k.name) + '">' + I.box + '</button></div>';
  }).join("") : '<div class="empty">No skills yet.</div>';
  var a = G.achievements(S), topLv = Math.max.apply(null, lvls());
  a.forEach(function (x) { if (x.id === "lv5") { x.desc = "Reach level 5 in any of your 3 levels"; x.got = topLv >= 5; } });
  $("a-count").textContent = a.filter(function (x) { return x.got; }).length + "/" + a.length;
  $("badges").innerHTML = a.map(function (x) { return '<div class="badge' + (x.got ? " got" : "") + '"><div class="ic">' + I.trophy + '</div><b>' + esc(x.name) + '</b><small>' + esc(x.desc) + '</small></div>'; }).join("");
  var you = youCat();
  $("cat-pick").innerHTML = [["calico", "Calico", "Orange, black and white"], ["tabby", "Tabby", "Brown and white"]].map(function (c) {
    return '<button data-cat="' + c[0] + '" aria-pressed="' + (you === c[0]) + '"><span class="catpic" aria-hidden="true" style="background-image:url(/sprites/cat-' + c[0] + '.png);background-position:-48px -192px"></span><span>' + c[1] + '<small>' + c[2] + '</small></span></button>';
  }).join("");
  var lk = S.settings.look === "night" ? "night" : "auto";
  $("look-pick").innerHTML = [["auto", "Follow the time"], ["night", "Always night"]].map(function (o) { return '<button data-look="' + o[0] + '" aria-pressed="' + (lk === o[0]) + '">' + o[1] + '</button>'; }).join("");
  if (!$("rules").contains(document.activeElement)) {
    $("rules").innerHTML = G.DIFFS.map(function (d) { return '<label>' + d.name + ' quest XP<input type="number" min="0" max="500" data-rule="xp.' + d.id + '" value="' + S.settings.xp[d.id] + '"></label>'; }).join("") +
      '<label>XP per level<input type="number" min="10" max="5000" data-rule="perLevel" value="' + S.settings.perLevel + '"></label>' +
      '<label>Mission bonus XP<input type="number" min="0" max="1000" data-rule="missionBonus" value="' + S.settings.missionBonus + '"></label>' +
      '<label>Coins per XP<input type="number" min="0" max="5" step="0.1" data-rule="coinRate" value="' + S.settings.coinRate + '"></label>';
  }
}

function renderRewards() {
  var c = G.coins(S);
  $("rlist").innerHTML = S.rewards.length ? S.rewards.map(function (r) {
    var h = '<div class="reward"><span style="min-width:0;overflow-wrap:anywhere">' + esc(r.title) + '</span><span class="cost">' + r.cost + ' c</span>' +
      '<div class="q-act"><button class="buy" data-claim="' + r.id + '"' + (c < r.cost ? " disabled" : "") + '>Claim</button><button class="ibtn" data-delreward="' + r.id + '" aria-label="Remove ' + esc(r.title) + '">' + I.box + '</button></div>';
    if (confirmReward === r.id) h += '<div class="confirm"><span>Spend ' + r.cost + ' coins on this?</span><button class="btn" data-yes="' + r.id + '">Yes, claim it</button><button class="ghost" data-no>Not now</button></div>';
    else if (c < r.cost) h += '<div class="muted" style="grid-column:1/-1;font-size:12px">' + (r.cost - c) + ' more coins to go</div>';
    return h + '</div>';
  }).join("") : '<div class="empty">Add a reward that you really want.</div>';
  var red = G.redemptions(S).slice(0, 10);
  $("rhist").innerHTML = red.length ? red.map(function (e) { return '<div><span>' + esc(e.n) + ' <span class="muted">· ' + new Date(e.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) + '</span></span><span class="num neg">' + e.a + ' c</span></div>'; }).join("") : '<div class="muted">Nothing claimed yet.</div>';
  var xs = S.ledger.filter(function (e) { return e.t === "xp"; }).slice(-15).reverse();
  $("xhist").innerHTML = xs.length ? xs.map(function (e) { return '<div><span>' + esc(e.n) + ' <span class="muted">· ' + new Date(e.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) + '</span></span><span class="num ' + (e.a < 0 ? "neg" : "pos") + '">' + (e.a > 0 ? "+" : "") + e.a + '</span></div>'; }).join("") : '<div class="muted">Finish a quest to see XP here.</div>';
}

function render() {
  renderTop();
  if (tab === "home") renderHome();
  else if (tab === "quests") renderQuests();
  else if (tab === "missions") renderMissions();
  else if (tab === "pitches") renderPitches();
  else if (tab === "train") renderTrain();
  else if (tab === "plan") renderPlan();
  else if (tab === "learn") { if (window.Learn) window.Learn.render(); }
  else if (tab === "igbo" || tab === "japanese") renderCourse(tab);
  else if (tab === "character") renderCharacter();
  else if (tab === "rewards") renderRewards();
}
function go(t) {
  tab = t; editing = null; confirmReward = null;
  try { history.replaceState(null, "", "#" + t); } catch (e) {}
  render(); window.scrollTo(0, 0);
  if (t === "home") { build(); if (reduce) draw(0); }
}

/* ---------- events ---------- */
document.addEventListener("click", function (e) {
  var b = e.target.closest("button"); if (!b || b.closest("#gate")) return;
  var d = b.dataset, now = new Date();
  if (d.group) return go(lastInGroup[d.group] || GROUPS[d.group][0][0]);
  if (d.tab) return go(d.tab);
  if (d.cat) { S.settings.cat = d.cat; lastPet = Date.now(); return change(); }
  if (d.pact) { if (busy) return; busy = true; setTimeout(function () { busy = false; }, 300); var pa = d.pact.split("|"); return pitchAct(pa[0], pa[1]); }
  if (d.pfilter) { pFilter = d.pfilter; return render(); }
  if (d.pdel) {
    var pl = pitches(), pi = pl.findIndex(function (x) { return x.id === d.pdel; }), pp2 = pl[pi]; if (pi < 0) return;
    pl.splice(pi, 1); toast("Brand removed. XP you earned stays.", function () { pitches().splice(pi, 0, pp2); change(); }); return change();
  }
  if (d.backup) return downloadBackup();
  if (d.rsno) { pendingRestore = null; return render(); }
  if (d.rsyes) {
    if (!pendingRestore) return;
    S = G.load(pendingRestore); pitches(); tracksFix(); pendingRestore = null; openWeek = {};
    toast("Backup restored."); return change();
  }
  if (d.look) { S.settings.look = d.look === "night" ? "night" : ""; applyLook(); return change(); }
  if (d.week) { var wp2 = d.week.split("|"); openWeek[wp2[0]] = openWeek[wp2[0]] === +wp2[1] ? -1 : +wp2[1]; return render(); }
  if (d.plan) {
    var pp = d.plan.split("|"), key = pp[0], wd = +pp[1]; S.plan = S.plan || G.defaultPlan(); var arr = S.plan[key] = S.plan[key] || [];
    var ix = arr.indexOf(wd); if (ix >= 0) arr.splice(ix, 1); else arr.push(wd); return change();
  }
  if (d.lesson) {
    if (busy) return; busy = true; setTimeout(function () { busy = false; }, 300);
    var lp2 = d.lesson.split("|"), lg = lp2[0], lw = +lp2[1], li = +lp2[2];
    if (G.lessonDone(S, lg, lw, li)) { G.undoLesson(S, lg, lw, li); toast("Lesson undone. XP taken back."); return change(); }
    var lb = lvls(), lr = G.completeLesson(S, lg, lw, li); if (!lr) return;
    var lu = lvlUp(lb); cheer();
    toast(lu ? lu : (lr.bonus ? "Week complete! <b>+" + (lr.xp + lr.bonus) + " XP</b>" : "<b>+" + lr.xp + " XP</b> · +" + lr.coin + " coins"),
      function () { G.undoLesson(S, lg, lw, li); change(); });
    if (lr.bonus && lw + 1 < G.COURSES[lg].weeks.length) openWeek[lg] = lw + 1;
    return change();
  }
  if (d.go) return go(d.go);
  if (d.tick) return doQuest(d.tick);
  if (d.start) { var q = find(d.start); if (q) startFor(q); return; }
  if (d.energy) { var day = G.day(S, now); day.energy = day.energy === d.energy ? "" : d.energy; return change(); }
  if (d.pin) { if (!G.toggleFeature(S, d.pin, now)) toast("Tonight already has three pinned. Unpin one first."); return change(); }
  if (d.edit) { editing = editing === d.edit ? null : d.edit; return render(); }
  if (b.hasAttribute("data-cancel")) { editing = null; return render(); }
  if (d.archive) { var a = find(d.archive); a.status = "archived"; editing = null; toast("Quest archived", function () { a.status = "active"; change(); }); return change(); }
  if (d.restore) { var rq = find(d.restore); rq.status = "active"; return change(); }
  if (d.qstatus) { qStatus = d.qstatus; return render(); }
  if (d.qdomain) { qDomain = d.qdomain; return render(); }
  if (d.mmain) { S.missions.forEach(function (m) { m.main = m.id === d.mmain; }); return change(); }
  if (d.marchive) {
    var m = S.missions.find(function (x) { return x.id === d.marchive; }), prev = m.status;
    m.status = "archived"; toast("Mission archived", function () { m.status = prev; change(); }); return change();
  }
  if (d.delskill) {
    var ki = S.skills.findIndex(function (k) { return k.id === d.delskill; }), kk = S.skills[ki];
    S.skills.splice(ki, 1); toast("Skill removed. Its past XP stays in your history.", function () { S.skills.splice(ki, 0, kk); change(); }); return change();
  }
  if (d.level) { S.training = S.training || {}; S.training.level = d.level; return change(); }
  if (d.set) {
    var ps = d.set.split("|"), cur = G.setsDone(S, ps[0], +ps[1], now), k2 = +ps[2];
    G.setSets(S, ps[0], +ps[1], cur >= k2 ? k2 - 1 : k2, now); return change();
  }
  if (d.rest !== undefined) return rest(+d.rest);
  if (d.finish) {
    if (busy) return; busy = true; setTimeout(function () { busy = false; }, 400);
    var before = lvls(), wr = G.completeWorkout(S, d.finish, now); if (!wr) return;
    var wu = lvlUp(before), wid = d.finish; cheer();
    toast(wu ? wu : (wr.bonus ? "Training week complete! <b>+" + (wr.xp + wr.bonus) + " XP</b>" : "Workout done! <b>+" + wr.xp + " XP</b> · +" + wr.coin + " coins"),
      function () { G.undoWorkout(S, wid, now); change(); });
    return change();
  }
  if (d.unfinish) { G.undoWorkout(S, d.unfinish, now); toast("Workout undone. XP taken back."); return change(); }
  if (d.claim) { confirmReward = d.claim; return render(); }
  if (b.hasAttribute("data-no")) { confirmReward = null; return render(); }
  if (d.yes) {
    if (busy) return; busy = true; setTimeout(function () { busy = false; }, 400);
    var r = S.rewards.find(function (x) { return x.id === d.yes; }), res = G.redeem(S, r); confirmReward = null;
    if (!res.ok) { toast("You need " + res.need + " more coins for this."); return render(); }
    toast("Enjoy it: <b>" + esc(r.title) + "</b>", function () { G.unredeem(S, res.key); change(); }); return change();
  }
  if (d.delreward) {
    var ri = S.rewards.findIndex(function (x) { return x.id === d.delreward; }), rr = S.rewards[ri];
    S.rewards.splice(ri, 1); toast("Reward removed", function () { S.rewards.splice(ri, 0, rr); change(); }); return change();
  }
});
document.addEventListener("submit", function (e) {
  var f = e.target; if (f.closest("#gate")) return;
  e.preventDefault();
  if (f.id === "q-add") {
    var t = $("qa-title").value.trim(); if (!t) return;
    var dom = $("qa-domain").value, sk = S.skills.find(function (k) { return k.domain === dom; });
    S.quests.unshift({ id: "q-" + G.uid(), title: t, domain: dom, skill: "", diff: $("qa-diff").value, repeat: $("qa-repeat").value, min: 0, status: "active", created: Date.now() });
    $("qa-title").value = ""; qStatus = $("qa-repeat").value === "once" ? "active" : "habits"; qDomain = "all";
    toast("Quest added. Tap the pencil to add a skill, mission or timer."); return change();
  }
  if (f.dataset.editform) {
    var q = find(f.dataset.editform), fd = new FormData(f), oldMission = q.mission;
    q.title = String(fd.get("title")).trim() || q.title; q.domain = fd.get("domain"); q.diff = fd.get("diff"); q.repeat = fd.get("repeat");
    q.skill = fd.get("skill") || ""; q.mission = fd.get("mission") || undefined; q.min = Math.max(0, Math.min(180, +fd.get("min") || 0));
    if (q.mission && q.repeat !== "once") q.repeat = "once";
    if (q.mission && oldMission !== q.mission) q.order = G.missionQuests(S, q.mission).length;
    [oldMission, q.mission].forEach(function (m) { if (m) G.missionCheck(S, m); });
    editing = null; toast("Quest saved"); return change();
  }
  if (f.id === "m-add") {
    var mt = $("ma-title").value.trim(); if (!mt) return;
    S.missions.push({ id: "m-" + G.uid(), title: mt, main: !S.missions.some(function (m) { return m.main && m.status !== "archived"; }), status: "active", created: Date.now() });
    $("ma-title").value = ""; toast("Mission started. Add its first step."); return change();
  }
  if (f.dataset.mstep) {
    var fd2 = new FormData(f), st = String(fd2.get("title")).trim(); if (!st) return;
    var mid = f.dataset.mstep;
    S.quests.push({ id: "q-" + G.uid(), title: st, domain: "career", skill: "", diff: fd2.get("diff"), repeat: "once", min: 0, status: "active", created: Date.now(), mission: mid, order: G.missionQuests(S, mid).length });
    G.missionCheck(S, mid); return change();
  }
  if (f.id === "sk-add") {
    var sn = $("sk-name").value.trim(); if (!sn) return;
    S.skills.push({ id: "sk-" + G.uid(), name: sn, domain: $("sk-domain").value }); $("sk-name").value = ""; return change();
  }
  if (f.id === "p-add") {
    var br = $("pa-brand").value.trim(); if (!br) return;
    var np = { id: "p-" + G.uid(), brand: br, contact: $("pa-contact").value.trim(), channel: $("pa-channel").value, note: $("pa-note").value.trim(), status: "idea", followUps: 0, created: Date.now(), updated: Date.now() };
    pitches().unshift(np); $("pa-brand").value = ""; $("pa-contact").value = ""; $("pa-note").value = "";
    pFilter = "all";
    if ($("pa-status").value === "pitched") return pitchAct(np.id, "pitched");
    toast("Brand added. Tap \"I pitched them\" once you send the message."); return change();
  }
  if (f.id === "r-add") {
    var rt = $("ra-title").value.trim(); if (!rt) return;
    S.rewards.push({ id: G.uid(), title: rt, cost: Math.max(5, Math.round(+$("ra-cost").value || 50)) }); $("ra-title").value = ""; return change();
  }
});
document.addEventListener("change", function (e) {
  var el = e.target; if (!el.dataset || !el.dataset.rule) return;
  var v = Math.max(0, +el.value || 0), path = el.dataset.rule.split(".");
  if (path[0] === "xp") S.settings.xp[path[1]] = Math.round(v); else S.settings[path[0]] = path[0] === "coinRate" ? v : Math.round(v);
  if (path[0] === "perLevel" && S.settings.perLevel < 10) S.settings.perLevel = 10;
  toast("Rule saved. New numbers count from now on."); change();
});

/* ---------- focus timer: the Pomodoro and music pop-up live in /focus.js ---------- */
function startFor(q) { if (tab !== "home") go("home"); if (window.Focus) window.Focus.startFor(q); }

/* ---------- room sounds ---------- */
var AC = null, master = null, playing = false, chordTimer = null, ci = 0;
var CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
function audio() {
  if (AC) return AC;
  var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return null;
  AC = new Ctx(); master = AC.createGain(); master.gain.value = 0; master.connect(AC.destination);
  var len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), ch = buf.getChannelData(0), b0 = 0, b1 = 0, b2 = 0;
  for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; b0 = .99765 * b0 + w * .099; b1 = .963 * b1 + w * .2965; b2 = .57 * b2 + w * 1.0526; ch[i] = (b0 + b1 + b2 + w * .1848) * .11; }
  var src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
  var hp = AC.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 400;
  var lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5200;
  var rg = AC.createGain(); rg.gain.value = .5;
  src.connect(hp); hp.connect(lp); lp.connect(rg); rg.connect(master); src.start();
  return AC;
}
function note(m, t, dur, vol) {
  var f = 440 * Math.pow(2, (m - 69) / 12), o = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter();
  o.type = "triangle"; o2.type = "sine"; o.frequency.value = f; o2.frequency.value = f * 2.001; lp.type = "lowpass"; lp.frequency.value = 1400;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
  o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master); o.start(t); o2.start(t); o.stop(t + dur + .1); o2.stop(t + dur + .1);
}
function chord() {
  if (!AC || !playing) return;
  var t = AC.currentTime + .05, c = CHORDS[ci++ % CHORDS.length];
  note(c[0] - 12, t, 4.5, .07); c.forEach(function (m, i) { note(m, t + i * .11, 3.8, .035); });
  if (Math.random() < .6) note(c[3] + 12, t + 1.6, 2.2, .025);
}
function setVol() { if (master && AC) master.gain.setTargetAtTime(playing ? (+$("mvol").value / 100) * .9 : 0, AC.currentTime, .4); }
$("mplay").onclick = function () {
  if (!audio()) { toast("Sounds are not supported in this browser"); return; }
  if (AC.state === "suspended") AC.resume();
  playing = !playing; setVol();
  $("vinyl").classList.toggle("spin", playing);
  $("mplay").setAttribute("aria-label", playing ? "Pause room sounds" : "Play room sounds");
  $("mico").innerHTML = playing ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : '<path d="M7 4l13 8-13 8z"/>';
  clearInterval(chordTimer); if (playing) { chord(); chordTimer = setInterval(chord, 4200); }
};
$("mvol").oninput = setVol;
function chime() {
  if (!audio()) return; if (AC.state === "suspended") AC.resume();
  var wasOff = !playing; if (wasOff) master.gain.value = .6;
  var t = AC.currentTime + .05; [72, 76, 79, 84].forEach(function (m, i) { note(m, t + i * .18, 1.6, .09); });
  if (wasOff) setTimeout(function () { if (!playing) master.gain.setTargetAtTime(0, AC.currentTime, .3); }, 2400);
}

/* ---------- window scene: follows the time of day, with two cats on the floor ---------- */
var cv = $("scene"), cx2 = cv.getContext("2d"), W = 0, H = 0, WH = 0, FLOOR = 72, SC = 2, stars = [], wins = [], clouds = [], seed = 7;
var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
function phaseOf(d) { var h = d.getHours() + d.getMinutes() / 60; return h >= 5 && h < 11 ? "morning" : h >= 11 && h < 17 ? "day" : h >= 17 && h < 20 ? "evening" : "night"; }
function curLook() { return S.settings.look === "night" ? "night" : phaseOf(new Date()); }
function applyLook() {
  var p = curLook(), r = document.documentElement;
  if (r.dataset.time !== p) {
    r.dataset.time = p; r.dataset.ui = p === "morning" || p === "day" ? "light" : "dark";
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = r.dataset.ui === "light" ? "#f3ebe1" : "#17111c";
    if (reduce && W) draw(0);
  }
  return p;
}
var LOOKS = {
  morning: { sky: [[0, "#8dbbe3"], [.55, "#b9d6ec"], [.82, "#f6d6c0"], [1, "#fbe2b4"]], sun: [.84, .24, .065, "#fff4d2", "#ffe2a6"], moon: 0, stars: 0,
    bld: "#8d9dbb", lit: .05, litc: ["#fff6dc", "#f4e6c4"], frame: "#efe3d3", floor: "#d6b089", plank: "#c49c74", sill: "#e6d5c1", clouds: .9, birds: 3, lamp: 0, fade: "255,250,244", rug: "#cdbbe6", bed: ["#e3a9b9", "#f4d3dc"], leaf: "#5f8f5a", pot: "#c07a52", stand: "#9b7a5f" },
  day: { sky: [[0, "#6aa9df"], [.6, "#9cc9ec"], [1, "#d6ebf7"]], sun: [.8, .18, .06, "#fffbea", "#fff3c4"], moon: 0, stars: 0,
    bld: "#7488aa", lit: 0, litc: ["#fff", "#fff"], frame: "#efe3d3", floor: "#cfa67b", plank: "#bd9369", sill: "#e6d5c1", clouds: 1, birds: 1, lamp: 0, fade: "255,250,244", rug: "#cdbbe6", bed: ["#e3a9b9", "#f4d3dc"], leaf: "#5f8f5a", pot: "#c07a52", stand: "#9b7a5f" },
  evening: { sky: [[0, "#1d1430"], [.38, "#4a2b4e"], [.62, "#b5566a"], [.78, "#f08a5d"], [1, "#f6b265"]], sun: [.68, .76, .07, "#ffd48e", "#ffc270"], moon: 1, stars: .7,
    bld: "#2a1a2e", lit: .32, litc: ["#f2b45a", "#ffd99a"], frame: "#120c16", floor: "#2c1d27", plank: "#24171f", sill: "#1a1120", clouds: 0, birds: 0, lamp: 1, fade: "23,17,28", rug: "#3b2b49", bed: ["#5a3550", "#774866"], leaf: "#120c16", pot: "#120c16", stand: "#120c16" },
  night: { sky: [[0, "#0e0b1d"], [.45, "#1f1838"], [.75, "#3b2547"], [1, "#5c2d4b"]], sun: null, moon: 1.15, stars: 1,
    bld: "#1d1424", lit: .45, litc: ["#f2b45a", "#ffd99a"], frame: "#0f0a13", floor: "#261922", plank: "#1e141b", sill: "#160f1a", clouds: 0, birds: 0, lamp: 1, fade: "23,17,28", rug: "#33263f", bed: ["#4e2e47", "#6a3f5c"], leaf: "#0f0a13", pot: "#0f0a13", stand: "#0f0a13" }
};
function build() {
  var r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  if (!r.width || !r.height) return;
  SC = r.width >= 700 ? 3 : 2; FLOOR = SC * 26 + 20;
  cv.parentNode.style.setProperty("--floor", FLOOR + "px");
  r = cv.getBoundingClientRect(); W = r.width; H = r.height; WH = H - FLOOR;
  cv.width = W * dpr; cv.height = H * dpr; cx2.setTransform(dpr, 0, 0, dpr, 0, 0);
  seed = 7; stars = []; wins = []; clouds = [];
  for (var i = 0; i < 90; i++) stars.push({ x: rnd() * W, y: rnd() * WH * .5, r: rnd() * 1.2 + .3, p: rnd() * 6 });
  for (i = 0; i < 4; i++) clouds.push({ x: rnd(), y: .06 + rnd() * .3, s: .7 + rnd() * .6, v: 5 + rnd() * 8 });
  var x = -10, base = WH;
  while (x < W + 20) {
    var bw = 24 + rnd() * 46, bh = WH * (.14 + rnd() * .3), b = { x: x, w: bw, h: bh, top: base - bh, lights: [] };
    for (var wy = b.top + 8; wy < base - 6; wy += 11) for (var wx = x + 5; wx < x + bw - 6; wx += 9) b.lights.push([wx, wy, rnd() < .5 ? 0 : 1, rnd() * 8, rnd()]);
    wins.push(b); x += bw + 2 + rnd() * 6;
  }
}
var HEART = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];
function heart(c, x, y, s, a) {
  c.globalAlpha = a; c.fillStyle = "#ef6f8e";
  HEART.forEach(function (row, j) { for (var i = 0; i < row.length; i++) if (row[i] === "X") c.fillRect(x + (i - 3.5) * s, y + j * s, s, s); });
  c.globalAlpha = 1;
}
function draw(t) {
  if (!W || !H || tab !== "home") return;
  var c = cx2, P = LOOKS[curLook()], i, sec = t / 1000;
  var g = c.createLinearGradient(0, 0, 0, WH); P.sky.forEach(function (s) { g.addColorStop(s[0], s[1]); });
  c.fillStyle = g; c.fillRect(0, 0, W, WH);
  if (P.stars) stars.forEach(function (s) { c.globalAlpha = P.stars * (.35 + .35 * Math.sin(t / 900 + s.p)); c.fillStyle = "#fff3e2"; c.beginPath(); c.arc(s.x, s.y, s.r, 0, 7); c.fill(); });
  c.globalAlpha = 1;
  if (P.stars >= 1 && !reduce) { // a shooting star now and then
    var k = (t % 11000) / 11000, n = Math.floor(t / 11000);
    if (k < .08) { var q = k / .08, x0 = W * (.15 + ((n * .37) % 1) * .5), y0 = WH * .08;
      var sg2 = c.createLinearGradient(x0 + q * 140 - 40, y0 + q * 50 - 14, x0 + q * 140, y0 + q * 50);
      sg2.addColorStop(0, "#fff3e200"); sg2.addColorStop(1, "#fff3e2"); c.strokeStyle = sg2; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x0 + q * 140 - 40, y0 + q * 50 - 14); c.lineTo(x0 + q * 140, y0 + q * 50); c.stroke(); }
  }
  if (P.sun) {
    var sx = W * P.sun[0], sy = WH * P.sun[1], sr = WH * P.sun[2], sg = c.createRadialGradient(sx, sy, 4, sx, sy, WH * .55);
    sg.addColorStop(0, P.sun[4]); sg.addColorStop(.15, P.sun[4] + "88"); sg.addColorStop(1, P.sun[4] + "00");
    c.fillStyle = sg; c.fillRect(0, 0, W, WH);
    c.fillStyle = P.sun[3]; c.beginPath(); c.arc(sx, sy, sr, 0, 7); c.fill();
  }
  if (P.moon) {
    var mr = 13 * P.moon, mx = W * .88, my = WH * .17;
    c.fillStyle = "#fbe9cf"; c.beginPath(); c.arc(mx, my, mr, 0, 7); c.fill();
    c.fillStyle = P.sky[0][1]; c.beginPath(); c.arc(mx + mr * .46, my - mr * .23, mr * .92, 0, 7); c.fill();
  }
  if (P.clouds) clouds.forEach(function (cl) {
    var span = W + 260, x = ((cl.x * span + sec * cl.v) % span) - 130, y = WH * cl.y, s = cl.s * 22;
    c.fillStyle = "rgba(255,255,255," + (.8 * P.clouds) + ")";
    c.beginPath(); c.ellipse(x, y, s * 1.6, s * .55, 0, 0, 7); c.ellipse(x - s * .7, y - s * .2, s * .7, s * .5, 0, 0, 7); c.ellipse(x + s * .4, y - s * .45, s * .8, s * .65, 0, 0, 7); c.fill();
  });
  for (i = 0; i < P.birds; i++) {
    var bx = ((sec * 24 + i * 70) % (W + 160)) - 80, by = WH * .6 + i * 9 + Math.sin(sec * .8 + i) * 4, fl = Math.sin(t / 130 + i * 2) * 3;
    c.strokeStyle = "#4a5670"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(bx - 6, by - fl); c.lineTo(bx, by); c.lineTo(bx + 6, by - fl); c.stroke();
  }
  c.fillStyle = P.bld; wins.forEach(function (b) { c.fillRect(b.x, b.top, b.w, b.h); });
  if (P.lit) wins.forEach(function (b) { b.lights.forEach(function (l) { if (l[4] >= P.lit) return; c.globalAlpha = reduce ? .85 : (.6 + .4 * Math.sin(t / 1500 + l[3])); c.fillStyle = P.litc[l[2]]; c.fillRect(l[0], l[1], 4, 5); }); });
  c.globalAlpha = 1;
  var lx = Math.max(22, W * .06), lampY = WH - 34;
  if (P.lamp) { var lg = c.createRadialGradient(lx, lampY, 0, lx, lampY, W * .55); lg.addColorStop(0, "#f2b45a55"); lg.addColorStop(1, "#f2b45a00"); c.fillStyle = lg; c.fillRect(0, 0, W, H); }
  var tg = c.createLinearGradient(0, WH * .3, 0, WH); tg.addColorStop(0, "rgba(" + P.fade + ",0)"); tg.addColorStop(1, "rgba(" + P.fade + "," + (P.lamp ? .85 : .72) + ")");
  c.fillStyle = tg; c.fillRect(0, 0, W, WH);
  c.strokeStyle = P.frame; c.lineWidth = 10; c.strokeRect(5, 5, W - 10, WH - 5);
  c.lineWidth = 6; c.beginPath(); c.moveTo(W * .5, 0); c.lineTo(W * .5, WH); c.moveTo(0, WH * .46); c.lineTo(W, WH * .46); c.stroke();
  // floor
  c.fillStyle = P.floor; c.fillRect(0, WH, W, FLOOR);
  c.fillStyle = P.plank; for (i = 1; i < 3; i++) c.fillRect(0, WH + FLOOR * i / 3, W, 2);
  for (i = 0; i < 3; i++) for (var px = (i % 2) * 60 + 40; px < W; px += 120) c.fillRect(px, WH + FLOOR * i / 3, 2, FLOOR / 3);
  c.fillStyle = P.sill; c.fillRect(0, WH - 4, W, 10);
  if (P.lamp) { var fg = c.createRadialGradient(lx, H, 0, lx, H, W * .5); fg.addColorStop(0, "#f2b45a40"); fg.addColorStop(1, "#f2b45a00"); c.fillStyle = fg; c.fillRect(0, WH, W, FLOOR); }
  var floorY = H - Math.round(FLOOR * .28);
  c.fillStyle = P.rug; c.beginPath(); c.ellipse(W * .45, floorY - 2, Math.min(W * .24, 170), FLOOR * .2, 0, 0, 7); c.fill();
  var bedX = W * .78; c.fillStyle = P.bed[0]; c.beginPath(); c.ellipse(bedX, floorY - 3, 21 * SC, 6 * SC, 0, 0, 7); c.fill();
  c.fillStyle = P.bed[1]; c.beginPath(); c.ellipse(bedX, floorY - 3, 16 * SC, 3.6 * SC, 0, 0, 7); c.fill();
  // lamp and plant
  c.fillStyle = P.stand; c.fillRect(lx - 2, lampY, 4, floorY - lampY); c.fillRect(lx - 12, floorY - 3, 24, 4);
  c.beginPath(); c.moveTo(lx - 20, lampY); c.lineTo(lx + 20, lampY); c.lineTo(lx + 11, lampY - 26); c.lineTo(lx - 11, lampY - 26); c.closePath(); c.fill();
  if (P.lamp) { c.fillStyle = "#f2b45acc"; c.beginPath(); c.ellipse(lx, lampY, 18, 4, 0, 0, 7); c.fill(); }
  var pX = W - 22, pY = floorY;
  c.fillStyle = P.leaf; for (i = 0; i < 7; i++) { var a = -Math.PI / 2 + (i - 3) * .32 + (reduce ? 0 : Math.sin(t / 1400 + i) * .03); c.beginPath(); c.ellipse(pX + Math.cos(a) * 20, pY - 22 + Math.sin(a) * 24, 5, 16, a + Math.PI / 2, 0, 7); c.fill(); }
  c.fillStyle = P.pot; c.fillRect(pX - 11, pY - 22, 22, 22);
  // cats
  pets.forEach(function (p) { drawCat(c, p, floorY, t); });
  placeBubble();
}

/* ---------- cats ---------- */
var SHEETS = { calico: { foot: 22, rows: 8 }, tabby: { foot: 24, rows: 8 } };
Object.keys(SHEETS).forEach(function (k) { var im = new Image(); im.onload = function () { if (reduce && W) draw(0); }; im.src = "/sprites/cat-" + k + ".png"; SHEETS[k].img = im; });
function youCat() { return S.settings.cat === "tabby" ? "tabby" : "calico"; }
var pets = [{ kind: "calico", fx: .3 }, { kind: "tabby", fx: .58 }].map(function (p, i) { p.dir = i ? -1 : 1; p.st = "sit"; p.t = .3; p.dur = 2 + i * 2.5; p.hop = 0; p.hearts = []; return p; });
// Your cat stays awake while you play with it; the other cat naps on the bed.
// After a minute without a tap (or a finished quest), your cat goes to bed too.
var IDLE_MS = 60000, lastPet = Date.now();
function napTime() { return Date.now() - lastPet > IDLE_MS; }
function shouldSleep(p) { return !(p.awake > 0) && (p.kind !== youCat() || napTime()); }
function bedFx(p) { return .78 + (p.kind === "calico" ? -1 : 1) * (9 * SC) / Math.max(W, 1); }
function walkTo(p, fx) { p.st = "walk"; p.tx = fx; p.dir = fx > p.fx ? 1 : -1; p.t = 0; }
function think(p) {
  var was = p.st; p.t = 0; p.wantSleep = shouldSleep(p);
  if (p.wantSleep) {
    var bx = bedFx(p); if (Math.abs(p.fx - bx) > .01) return walkTo(p, bx);
    if (was !== "lie" && was !== "sleep") { p.st = "lie"; p.dur = .9; return; }   // curl up first
    p.st = "sleep"; p.dur = 30; return;
  }
  if (p.kind !== youCat()) { p.st = "sit"; p.dur = 2; return; }                   // the other cat just sits, then naps again
  var r = Math.random();
  if (r < .45) return walkTo(p, .12 + Math.random() * .62);
  if (r < .7) { p.st = "sit"; p.dur = 3 + Math.random() * 4; }
  else if (r < .87 || SHEETS[p.kind].rows < 8) { p.st = "groom"; p.dur = 2.4 + Math.random() * 2; }
  else { p.st = "lie"; p.dur = 6 + Math.random() * 6; }
}
function update(p, dt) {
  if (!W) return;                                    // wait until the room has a size
  p.t += dt; if (p.hop) p.hop = Math.max(0, p.hop - dt);
  if (p.awake > 0) p.awake -= dt;
  if (p.st !== "walk" && shouldSleep(p) !== p.wantSleep) think(p);   // time to nap, or time to wake up
  p.hearts = p.hearts.filter(function (h) { h.a += dt; return h.a < 1.4; });
  if (p.st === "walk") {
    p.fx += p.dir * (13 * SC / Math.max(W, 1)) * dt;
    if ((p.dir > 0 && p.fx >= p.tx) || (p.dir < 0 && p.fx <= p.tx)) { p.fx = p.tx; p.st = "sit"; p.t = 0; p.dur = 1.5 + Math.random() * 2; }
  } else if (p.t >= p.dur) think(p);
}
function frameOf(p) {
  var t = p.t, tab8 = SHEETS[p.kind].rows === 8;
  if (p.hop) return [4, 2];
  if (p.st === "walk") return [p.dir > 0 ? 1 : 3, Math.floor(t * 6) % 4];
  if (p.st === "groom") return [5, Math.floor(t * 5) % 4];
  if (p.st === "lie") return tab8 ? [6, Math.min(3, Math.floor(t * 5))] : [4, 1];
  if (p.st === "sleep") return tab8 ? [7, Math.floor(t * 1.2) % 2] : [4, 1];
  return [4, t < .3 ? 0 : 1 + Math.floor(t * 1.2) % 3];
}
function drawCat(c, p, floorY, t) {
  var sh = SHEETS[p.kind], im = sh.img; if (!im || !im.complete || !im.naturalWidth) return;
  var f = frameOf(p), s = 32 * SC, x = Math.round(p.fx * W - s / 2), y = floorY - sh.foot * SC;
  if (p.hop) y -= Math.round(Math.abs(Math.sin(p.hop * 8.5)) * 4 * SC * Math.min(1, p.hop));
  c.imageSmoothingEnabled = false; c.drawImage(im, f[1] * 32, f[0] * 32, 32, 32, x, y, s, s);
  var headY = floorY - 22 * SC;
  if (p.st === "sleep" && !p.hop) {
    c.fillStyle = document.documentElement.dataset.ui === "light" ? "#6c5c66" : "#d8c8e8"; c.font = (5 * SC) + "px 'Pixelify Sans', monospace";
    var z = reduce ? 0 : (t / 1000) % 2; c.globalAlpha = reduce ? .8 : Math.max(0, 1 - z / 2);
    c.fillText("z", p.fx * W + 6 * SC + z * 4, headY - z * 8); c.globalAlpha = 1;
  }
  p.hearts.forEach(function (h) { if (h.a > 0) heart(c, p.fx * W, headY - 6 * SC - h.a * 14, SC / 2 + .5, Math.max(0, 1 - h.a / 1.4)); });
}
function mew(k) {
  if (!audio()) return; if (AC.state === "suspended") AC.resume();
  var t = AC.currentTime + .02, o = AC.createOscillator(), gn = AC.createGain(), f = AC.createBiquadFilter();
  o.type = "triangle"; f.type = "lowpass"; f.frequency.value = 2400;
  o.frequency.setValueAtTime(620 * k, t); o.frequency.linearRampToValueAtTime(980 * k, t + .09); o.frequency.exponentialRampToValueAtTime(520 * k, t + .32);
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(.1, t + .03); gn.gain.exponentialRampToValueAtTime(.001, t + .36);
  o.connect(f); f.connect(gn); gn.connect(AC.destination); o.start(t); o.stop(t + .4);
}
function poke(p, n) { if (p.st !== "walk") { p.st = "sit"; p.t = .3; p.dur = 3; } p.wantSleep = false; p.hop = 1; for (var i = 0; i < n; i++) p.hearts.push({ a: -i * .25 }); if (reduce) draw(0); }
function cheer() { lastPet = Date.now(); pets.forEach(function (p) { if (p.kind === youCat()) poke(p, 2); }); }

/* ---------- tap a cat: it wakes up, says something, then meows ---------- */
var CAT_LINES = [
  "Small steps still move you forward.", "Done is better than perfect. Ship it.", "One pitch today beats ten pitches someday.",
  "You don't need to feel ready. You just need to start.", "Hard days count too. Showing up is the win.",
  "Your future clients are out there, scrolling. Go find them.", "Every no brings you closer to a yes.",
  "Rest is part of the plan, not a break from it.", "Be proud of how far you've come this month.",
  "Slow progress is still progress.", "You are the main character. Act like it.", "Nobody is watching you fail. They're busy. Go try.",
  "Tip: start your pitch with their problem, not your skills.", "Tip: a short message gets read. A long one gets saved for later. Forever.",
  "Tip: look at one ad today and ask, 'Who is this for?'", "Tip: put your best piece first in your portfolio.",
  "Tip: follow up once. Most replies come after the second message.", "Tip: write your price down before the call, so you don't shrink it.",
  "Tip: say one new Igbo word out loud today. Then use it on someone.", "Tip: in Igbo, the tone changes the meaning. Check it on Nkọwa okwu.",
  "Tip: write your name in katakana. メイ. You're welcome.", "Tip: drink some water. Cats know these things.",
  "Tip: during push-ups, keep your body in one straight line.", "Tip: slow reps build more strength than fast ones.",
  "Tip: if a quest feels too big, split it into a tiny one.", "Tip: pick 3 quests for today. Not 10. Three.",
  "Mrrp. I believe in you. Also, I'm hungry.", "I'd help, but I don't have thumbs.", "Have you tried turning it off and napping?",
  "I knocked a pen off your desk. You're welcome.", "If I fits, I sits. If you start, you finish.", "Purr. That's cat for 'keep going'.",
  "I watched you work today. Very impressive. For a human.", "Quick stretch? I do ten a day and look how relaxed I am.",
  "The best time to start was yesterday. The second best is now.", "A river cuts rock by not stopping.",
  "You can't pour from an empty cup. Fill yours first.", "Big things grow from small daily habits.",
  "Ndewo! Did you practise your Igbo today?", "Your portfolio grows one piece at a time. Add the next one."
];
var lineBag = [];
function dynamicLine() {
  var now = new Date(), left = G.available(S, now).length, c = G.coins(S), plan = G.planFor(S, now);
  var pick = [left ? left + (left === 1 ? " quest is" : " quests are") + " still open today. Start with the smallest one." : "Every quest is done today. Nap with me?",
    c >= 40 ? "You have " + c + " coins. Treat yourself in Rewards. You earned it." : "Finish a few quests and you'll have coins for a treat.",
    plan.length ? "Today's plan: " + plan.map(function (k) { return G.PLAN_ITEMS[k].name; }).join(", ") + "." : "Nothing big planned today. Just your quests, or rest."];
  return pick[Math.floor(Math.random() * pick.length)];
}
function nextLine() {
  if (Math.random() < .25) return dynamicLine();
  if (!lineBag.length) { lineBag = CAT_LINES.slice(); for (var i = lineBag.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = lineBag[i]; lineBag[i] = lineBag[j]; lineBag[j] = t; } }
  return lineBag.pop();
}
var bubble = document.createElement("div"); bubble.className = "cat-bubble"; bubble.setAttribute("role", "status"); bubble.hidden = true;
cv.parentNode.appendChild(bubble);
var bubbleFor = null, bubbleT = null;
function placeBubble() {
  if (!bubbleFor || bubble.hidden) return;
  var floorY = H - Math.round(FLOOR * .28), bw = bubble.offsetWidth || 200;
  var x = Math.max(8, Math.min(W - bw - 8, bubbleFor.fx * W - bw / 2));
  bubble.style.left = x + "px"; bubble.style.top = Math.max(6, floorY - 30 * SC - bubble.offsetHeight) + "px";
  bubble.style.setProperty("--tail", Math.max(14, Math.min(bw - 14, bubbleFor.fx * W - x)) + "px");
}
function catSays(p, wasAsleep) {
  bubbleFor = p;
  bubble.textContent = (wasAsleep ? "*yawn* " : "") + nextLine();
  bubble.hidden = false; bubble.classList.remove("pop"); void bubble.offsetWidth; bubble.classList.add("pop");
  placeBubble();
  clearTimeout(bubbleT); bubbleT = setTimeout(function () { bubble.hidden = true; bubbleFor = null; }, 6500);
  // a meow (or two) after the message, a little different each time
  var k = (p.kind === "tabby" ? .9 : 1.15) * (.9 + Math.random() * .25), n = Math.random() < .3 ? 2 : 1, d = 350 + Math.random() * 450;
  for (var i = 0; i < n; i++) setTimeout(function () { mew(k * (.95 + Math.random() * .1)); }, d + i * 380);
}
bubble.addEventListener("click", function () { bubble.hidden = true; bubbleFor = null; });
cv.parentNode.addEventListener("click", function (e) {
  if (e.target.closest(".levelcard, button, a, .cat-bubble")) return;
  var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, floorY = H - Math.round(FLOOR * .28), hit = null;
  pets.forEach(function (p) { if (!hit && Math.abs(x - p.fx * W) < 13 * SC && y > floorY - 24 * SC && y < floorY + 6) hit = p; });
  if (!hit) return;
  var wasAsleep = hit.st === "sleep" || hit.st === "lie";
  lastPet = Date.now();
  if (hit.kind !== youCat()) hit.awake = 7;     // the other cat wakes up just long enough to talk
  poke(hit, 1); catSays(hit, wasAsleep);
});
var lastT = 0;
function loop(t) {
  t = t || 0; var dt = Math.min(.1, Math.max(0, (t - lastT) / 1000)); lastT = t;
  if (tab === "home" && !document.hidden) { pets.forEach(function (p) { update(p, dt); }); draw(t); }
  if (!reduce) requestAnimationFrame(loop);
}
var rz; addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { build(); if (reduce) draw(0); }, 120); });

var QUOTES = ["Small steps, every night. Same person, higher level.", "You built this game. Now go play it.", "Lazy days end one quest at a time.", "Every pitch is practice. Every reply is loot.", "The first client is the hardest boss. You have the gear.", "Rest is part of the game too."];
$("quote").textContent = QUOTES[new Date().getDate() % QUOTES.length];

/* ---------- sign-in ---------- */
function msg(t, k) { var m = $("g-msg"); m.textContent = t; m.className = "msg" + (k ? " " + k : ""); }
function showApp() {
  $("gate").hidden = true; $("app").hidden = false;
  $("qa-domain").innerHTML = domainOpts("career"); $("qa-diff").innerHTML = diffOpts("easy"); $("sk-domain").innerHTML = domainOpts("learning");
  if (tracksFix()) save();
  render(); build(); if (reduce) draw(0);
}
function showGate(note) {
  $("app").hidden = true; $("gate").hidden = false; $("g-email").hidden = false; $("g-code").hidden = true;
  msg(note || "", ""); setTimeout(function () { $("g-email-in").focus(); }, 50);
}
function loadState() {
  return fetch("/api/state", { credentials: "same-origin", cache: "no-store" }).then(function (r) {
    if (r.status === 401) return false;
    if (!r.ok) throw new Error("load " + r.status);
    return r.json().then(function (j) {
      if (j.state && j.state.v === 2) { S = G.load(j.state); try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} setSave("Saved"); }
      else { S = G.load(loadLocal()); save(); }
      return true;
    });
  });
}
function boot() {
  var h = (location.hash || "").slice(1); if (VIEWS.indexOf(h) >= 0) tab = h;
  loadState().then(function (ok) { if (ok) showApp(); else showGate(""); }).catch(function () {
    var local = loadLocal();
    if (local) { S = G.load(local); showApp(); setSave("Offline. Showing your last save."); }
    else showGate("Could not reach the server. Check your internet and try again.");
  });
}
$("g-email").addEventListener("submit", function (e) {
  e.preventDefault();
  var email = $("g-email-in").value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) { msg("Type a full email address.", "err"); return; }
  $("g-send").disabled = true; msg("Sending…", "");
  fetch("/api/request-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email }) })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok) { msg(j.error || "Could not send the code. Try again.", "err"); return; }
      $("g-email").hidden = true; $("g-code").hidden = false;
      $("g-code-note").textContent = "If that is your email, a code is on its way. It works for 10 minutes.";
      msg("", ""); $("g-code-in").value = ""; $("g-code-in").focus();
    }); })
    .catch(function () { msg("Could not reach the server. Check your internet.", "err"); })
    .then(function () { $("g-send").disabled = false; });
});
$("g-code-in").addEventListener("input", function (e) {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
  if (e.target.value.length === 6) $("g-code").requestSubmit();
});
$("g-code").addEventListener("submit", function (e) {
  e.preventDefault();
  var code = $("g-code-in").value;
  if (code.length !== 6) { msg("The code has 6 numbers.", "err"); return; }
  $("g-verify").disabled = true; msg("Checking…", "");
  fetch("/api/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code }), credentials: "same-origin" })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok) { msg(j.error || "That did not work. Try again.", "err"); $("g-code-in").select(); return; }
      msg("You're in.", "ok");
      return loadState().then(function (ok) { if (ok) showApp(); else msg("Signed in, but your save could not load. Refresh the page.", "err"); });
    }); })
    .catch(function () { msg("Could not reach the server. Check your internet.", "err"); })
    .then(function () { $("g-verify").disabled = false; });
});
$("g-back").onclick = function () { $("g-code").hidden = true; $("g-email").hidden = false; msg("", ""); $("g-email-in").focus(); };
$("signout").onclick = function () {
  var p = pending ? (clearTimeout(saveTimer), push()) : Promise.resolve();
  p.then(function () { return fetch("/api/logout", { method: "POST", credentials: "same-origin" }).catch(function () {}); })
    .then(function () { showGate("You are signed out."); });
};
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState !== "visible" || $("app").hidden || pending) return;
  loadState().then(function (ok) { if (ok) render(); else showGate("You were away for more than 4 days. Get a new code to come back in."); }).catch(function () {});
});

window.QR = {
  S: function () { return S; }, change: function () { change(); }, toast: toast, esc: esc, find: find, chime: chime, cheer: cheer,
  isDone: function (q) { return G.isDone(S, q, new Date()); }, doQuest: doQuest, dkey: G.dkey, xp: function (diff) { return G.questXp(S, { diff: diff }); },
  award: function (key, diff, dom, skill, note) {
    if (G.net(S, key, "xp") > 0) return 0;
    var xp = G.questXp(S, { diff: diff }), coin = Math.round(xp * (+S.settings.coinRate || 0)), now = Date.now();
    S.ledger.push({ k: key, t: "xp", a: xp, at: now, d: dom, s: skill || "", n: note });
    if (coin) S.ledger.push({ k: key, t: "coin", a: coin, at: now, n: note });
    return xp;
  }
};
(function () { // focus.js first (the player), then learn.js (uses the player)
  var fs = document.createElement("script"); fs.src = "/focus.js?v=2";
  fs.onload = function () { var ls = document.createElement("script"); ls.src = "/learn.js?v=1"; document.body.appendChild(ls); };
  document.body.appendChild(fs);
})();
loop(0); boot();
var lastDay = G.dkey() + phaseOf(new Date()); setInterval(function () { var k = G.dkey() + phaseOf(new Date()); if (k !== lastDay) { lastDay = k; render(); } }, 60000);
})();
