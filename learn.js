/* Quest Room learning: YouTube lessons in the small player, a dictionary pop-up and a word bank.
   Talks to app.js through window.QR and plays videos through window.Focus (focus.js). */
(function () {
"use strict";
var Q = window.QR, F = window.Focus; if (!Q || !F) return;
var $ = function (id) { return document.getElementById(id); };
var esc = Q.esc;
var GAPS = [1, 2, 4, 7, 14, 30]; // days until a word comes back, per box
var searchOn = null, results = null, searching = false, lnFilter = "todo", review = null;

/* ---------- styles ---------- */
var css = document.createElement("style");
css.textContent =
  ".ln-search{flex-wrap:nowrap}.ln-search input{flex:1;min-width:0}" +
  ".ln-hint{font-size:13px;color:var(--muted);margin:10px 0 0}" +
  ".vgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-top:12px}" +
  ".vcard{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;min-width:0;text-align:left;padding:0}" +
  ".vcard img,.vrow img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#000}" +
  ".vcard .vt{padding:8px 10px 2px;font-weight:600;font-size:13px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
  ".vcard .vc{padding:0 10px 8px;font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
  ".vcard .va{display:flex;gap:6px;padding:0 10px 10px;margin-top:auto}" +
  ".vrow{display:grid;grid-template-columns:96px minmax(0,1fr) auto;gap:12px;align-items:center;background:var(--card);border-radius:14px;padding:8px;border:1px solid transparent}" +
  ".vrow img{border-radius:8px}.vrow.now{border-color:var(--lamp)}" +
  ".vrow b{display:block;font-size:14px;font-weight:600;line-height:1.3;overflow-wrap:anywhere}" +
  ".vrow small{display:block;font-size:12px;color:var(--muted)}" +
  ".vrow .vnote{font-size:13px;color:var(--text);margin-top:4px;font-style:italic;overflow-wrap:anywhere}" +
  ".vrow .acts{display:flex;gap:4px;align-items:center}" +
  ".words{display:flex;flex-direction:column}" +
  ".wrow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;align-items:center;padding:9px 0;border-top:1px solid var(--line)}" +
  ".wrow:first-child{border-top:none}" +
  ".wrow button.wopen{background:none;border:none;padding:0;text-align:left;color:inherit;min-width:0}" +
  ".wrow b{font-family:var(--f-game);font-weight:500;font-size:17px;color:var(--lilac)}" +
  ".wrow p{margin:2px 0 0;font-size:13px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
  ".wdue{font-size:11px;color:var(--dusk);font-weight:600;margin-left:6px}" +
  ".lnm{position:fixed;inset:0;z-index:40;background:#0a070dcc;display:flex;align-items:flex-end;justify-content:center;padding:16px;animation:lnfade .2s ease}" +
  "@media (min-width:641px){.lnm{align-items:center}}" +
  "@keyframes lnfade{from{opacity:0}}" +
  ".lnm .card{background:var(--wall);border:1px solid var(--line);border-radius:18px;width:min(520px,100%);max-height:calc(100dvh - 32px);overflow:auto;padding:18px;box-shadow:0 20px 50px #0008}" +
  ".lnm .top{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}" +
  ".lnm .top .grow{flex:1;min-width:0}" +
  ".lnm h3{margin:0;font-family:var(--f-display);font-weight:400;font-size:34px;line-height:1.05;overflow-wrap:anywhere}" +
  ".lnm .phon{font-family:var(--f-game);color:var(--lilac);font-size:15px;display:flex;gap:8px;align-items:center;margin-top:4px}" +
  ".lnm .pos{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--lamp);font-weight:700;margin:14px 0 4px}" +
  ".lnm ol{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;font-size:15px;line-height:1.4}" +
  ".lnm .ex{display:block;color:var(--muted);font-style:italic;font-size:14px;margin-top:2px}" +
  ".lnm .syn{font-size:13px;color:var(--muted);margin-top:6px}.lnm .syn .linkish{font-size:13px;color:var(--lilac);display:inline}" +
  ".lnm .save{margin-top:16px;padding-top:14px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px}" +
  ".lnm select{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:9px 10px;color:var(--text)}" +
  ".lnm textarea,.lnm input[type=text]{width:100%;box-sizing:border-box;font:inherit;font-size:16px;background:var(--night);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:10px}" +
  ".lnm textarea{min-height:76px;resize:vertical}" +
  ".lnm .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}" +
  ".lnm .mine{background:var(--card);border-radius:12px;padding:10px 12px;font-size:14px}" +
  ".lnm .mine small{display:block;color:var(--muted);font-size:12px;margin-bottom:2px}" +
  ".lnm .big{font-family:var(--f-display);font-size:44px;text-align:center;margin:18px 0 6px;overflow-wrap:anywhere}" +
  ".lnm .count{font-family:var(--f-game);color:var(--muted);font-size:13px}" +
  ".lnm .center{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:14px}" +
  "@media (max-width:640px){.vgrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.vcard .va .ghost{padding:5px 9px}.vrow{grid-template-columns:72px minmax(0,1fr)}.vrow .acts{grid-column:1/-1;justify-content:flex-end}}";
document.head.appendChild(css);

/* ---------- data ---------- */
function L() { var S = Q.S(); if (!S.learn || typeof S.learn !== "object") S.learn = {}; if (!Array.isArray(S.learn.videos)) S.learn.videos = []; if (!Array.isArray(S.learn.words)) S.learn.words = []; return S.learn; }
function today() { return Q.dkey(); }
function addDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return Q.dkey(d); }
function vid(v) { return v.id || v.list; }
function findVideo(k) { return L().videos.find(function (v) { return vid(v) === k; }); }
function findWord(w) { w = String(w).toLowerCase(); return L().words.find(function (x) { return x.w.toLowerCase() === w; }); }
function due() { var t = today(); return L().words.filter(function (x) { return (x.next || "") <= t; }); }
function thumb(v) { return v.thumb || (v.id ? "https://i.ytimg.com/vi/" + v.id + "/mqdefault.jpg" : ""); }
function parseYT(u) {
  u = String(u || "").trim(); var m;
  if ((m = u.match(/[?&]list=([\w-]{10,})/)) && !/[?&]v=/.test(u)) return { list: m[1] };
  if ((m = u.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/live\/|\/shorts\/)([\w-]{11})/))) return { id: m[1] };
  if (/^[\w-]{11}$/.test(u)) return { id: u };
  return null;
}

/* ---------- the screen (built once, so typing is never wiped) ---------- */
var host = $("c-learn");
host.innerHTML =
  '<section class="panel" aria-labelledby="dict-h"><div class="ph"><h2 id="dict-h">Dictionary</h2><span class="meta">English</span></div>' +
  '<form class="form ln-search" id="dict-form"><input id="dict-in" placeholder="Look up a word" aria-label="Word to look up" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"><button class="btn" type="submit">Look up</button></form>' +
  '<p class="ln-hint">Save a word and write your own sentence with it: <b class="xp">+' + Q.xp("tiny") + ' XP</b>. Saved words come back for review.</p></section>' +
  '<section class="panel" aria-labelledby="wb-h"><div class="ph"><h2 id="wb-h">Word bank</h2><span class="meta num" id="wb-count"></span><button class="btn soft" id="wb-review" style="margin-left:auto" hidden>Review</button></div>' +
  '<div class="words" id="wb-list"></div></section>' +
  '<section class="panel" aria-labelledby="yt-h"><div class="ph"><h2 id="yt-h">YouTube lessons</h2><span class="meta">Plays in the small player</span></div>' +
  '<form class="form ln-search" id="yt-form" hidden><input id="yt-q" placeholder="Search YouTube, e.g. how to price design work" aria-label="Search YouTube" autocomplete="off" enterkeyhint="search"><button class="btn" type="submit">Search</button></form>' +
  '<div id="yt-results"></div>' +
  '<form class="form ln-search" id="yt-add" style="margin-top:10px"><input id="yt-url" placeholder="Or paste a YouTube link" aria-label="YouTube link" autocomplete="off"><button class="btn soft" type="submit">Add</button></form>' +
  '<p class="ln-hint" id="yt-hint">Tap <b>Done</b> in the player when you finish, and write one line about what you learned: <b class="xp">+' + Q.xp("easy") + ' XP</b>.</p></section>' +
  '<section class="panel" aria-labelledby="ym-h"><div class="ph"><h2 id="ym-h">Your lessons</h2></div><div class="filters" id="ym-filter"></div><div class="list" id="ym-list"></div></section>';

/* ---------- drawing ---------- */
function render() {
  var lw = L().words, d = due(), now = F.playing();
  $("wb-count").textContent = lw.length ? lw.length + (lw.length === 1 ? " word" : " words") : "";
  $("wb-review").hidden = !d.length; $("wb-review").textContent = "Review " + d.length;
  var sorted = lw.slice().sort(function (a, b) { return (b.added || 0) - (a.added || 0); });
  $("wb-list").innerHTML = sorted.length ? sorted.map(function (x) {
    var isDue = (x.next || "") <= today();
    return '<div class="wrow"><button class="wopen" data-wopen="' + esc(x.w) + '"><b>' + esc(x.w) + '</b>' + (isDue ? '<span class="wdue">due</span>' : '') + '<p>' + esc(x.def || "") + '</p></button>' +
      '<button class="ibtn" data-wdel="' + esc(x.w) + '" aria-label="Remove ' + esc(x.w) + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  }).join("") : '<div class="muted" style="font-size:13px">No words yet. Look one up above and save it.</div>';

  $("yt-form").hidden = !searchOn;
  if (searchOn === false) $("yt-hint").innerHTML = 'Search turns on once your YouTube key is added. For now, paste links. Tap <b>Done</b> in the player when you finish: <b class="xp">+' + Q.xp("easy") + ' XP</b>.';
  $("yt-results").innerHTML = searching ? '<p class="ln-hint">Searching…</p>' : results ? (results.length ? '<div class="vgrid">' + results.map(function (r, i) {
    var have = findVideo(r.id);
    return '<div class="vcard"><button class="ibtn" data-rplay="' + i + '" style="padding:0;display:block;border-radius:0" aria-label="Play ' + esc(r.title) + '"><img src="' + esc(r.thumb) + '" alt="" loading="lazy"></button>' +
      '<div class="vt">' + esc(r.title) + '</div><div class="vc">' + esc(r.channel) + '</div>' +
      '<div class="va"><button class="btn" data-rplay="' + i + '" style="padding:6px 12px;font-size:13px">Play</button>' +
      (have ? '<span class="muted" style="font-size:12px;align-self:center">Saved</span>' : '<button class="ghost" data-rsave="' + i + '">Save</button>') + '</div></div>';
  }).join("") + '</div><div class="center"><button class="ghost" data-rclear="1">Clear results</button></div>' : '<p class="ln-hint">Nothing found. Try other words.</p>') : '';

  var vs = L().videos, todo = vs.filter(function (v) { return !v.done; }), done = vs.filter(function (v) { return v.done; });
  $("ym-filter").innerHTML = [["todo", "To watch · " + todo.length], ["done", "Done · " + done.length]].map(function (f) { return '<button data-ymf="' + f[0] + '" aria-pressed="' + (lnFilter === f[0]) + '">' + f[1] + '</button>'; }).join("");
  var list = (lnFilter === "done" ? done.slice().sort(function (a, b) { return (b.doneAt || 0) - (a.doneAt || 0); }) : todo);
  $("ym-list").innerHTML = list.length ? list.map(function (v) {
    var k = vid(v);
    return '<div class="vrow' + (now === k ? " now" : "") + '"><img src="' + esc(thumb(v)) + '" alt="" loading="lazy">' +
      '<div style="min-width:0"><b>' + esc(v.title) + '</b><small>' + esc(v.channel || (v.list ? "Playlist" : "")) + (v.done ? " · done " + new Date(v.doneAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "") + '</small>' +
      (v.note ? '<div class="vnote">"' + esc(v.note) + '"</div>' : '') + '</div>' +
      '<div class="acts"><button class="btn soft" data-vplay="' + esc(k) + '" style="padding:6px 12px;font-size:13px">' + (now === k ? "Playing" : v.done ? "Watch again" : "Play") + '</button>' +
      '<button class="ibtn" data-vdel="' + esc(k) + '" aria-label="Remove ' + esc(v.title) + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>';
  }).join("") : '<div class="muted" style="font-size:13px">' + (lnFilter === "done" ? "Finished lessons show up here with your notes." : "Search or paste a link, then tap Save or Play.") + '</div>';
}

/* ---------- pop-up card ---------- */
var modal = null, lastFocus = null;
function openModal(html) {
  closeModal(true); lastFocus = document.activeElement;
  modal = document.createElement("div"); modal.className = "lnm"; modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true");
  modal.innerHTML = '<div class="card">' + html + '</div>';
  document.body.appendChild(modal);
  var f = modal.querySelector("[autofocus]") || modal.querySelector("button"); if (f) f.focus();
}
function closeModal(quiet) { if (!modal) return; modal.remove(); modal = null; if (!quiet && lastFocus && lastFocus.focus) lastFocus.focus(); }
var X = '<button class="ibtn" data-lnclose="1" aria-label="Close"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';

/* ---------- dictionary ---------- */
var entry = null; // the word open in the pop-up
function lookUp(word) {
  word = String(word || "").trim().toLowerCase().replace(/[^a-z' -]/g, "").slice(0, 40);
  if (!word) return;
  openModal('<div class="top"><div class="grow"><h3>' + esc(word) + '</h3><div class="phon">Looking it up…</div></div>' + X + '</div>');
  fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(word)).then(function (r) {
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("dict " + r.status);
    return r.json();
  }).then(function (j) {
    if (!modal) return;
    var saved = findWord(word);
    if (!j || !j.length) {
      entry = null;
      openModal('<div class="top"><div class="grow"><h3>' + esc(word) + '</h3></div>' + X + '</div><p class="muted">No meaning found. Check the spelling, or try the simple form of the word (for example "run", not "running").</p>' +
        (saved ? savedBox(saved) : ''));
      return;
    }
    entry = shape(word, j); showEntry();
  }).catch(function () {
    var saved = findWord(word);
    if (modal) openModal('<div class="top"><div class="grow"><h3>' + esc(word) + '</h3></div>' + X + '</div><p class="muted">Could not reach the dictionary. Check your internet and try again.</p>' + (saved ? savedBox(saved) : ''));
  });
}
function shape(word, j) {
  var e = { w: j[0].word || word, phon: "", audio: "", meanings: [] };
  j.forEach(function (x) {
    if (!e.phon && x.phonetic) e.phon = x.phonetic;
    (x.phonetics || []).forEach(function (p) {
      if (!e.phon && p.text) e.phon = p.text;
      if (p.audio && (!e.audio || /-(us|uk)\.mp3$/.test(p.audio) && !/-(us|uk)\.mp3$/.test(e.audio))) e.audio = p.audio;
    });
    (x.meanings || []).forEach(function (m) {
      var have = e.meanings.find(function (y) { return y.pos === m.partOfSpeech; });
      if (!have) { have = { pos: m.partOfSpeech, defs: [], syn: [] }; e.meanings.push(have); }
      (m.definitions || []).forEach(function (d) { if (have.defs.length < 3) have.defs.push({ d: d.definition, ex: d.example || "" }); });
      (m.synonyms || []).forEach(function (s) { if (have.syn.length < 6 && have.syn.indexOf(s) < 0) have.syn.push(s); });
    });
  });
  if (e.audio && e.audio.indexOf("//") === 0) e.audio = "https:" + e.audio;
  return e;
}
function savedBox(x) {
  return '<div class="save"><div class="label">In your word bank</div>' +
    (x.mine ? '<div class="mine"><small>Your sentence</small>' + esc(x.mine) + '</div>' : '<div class="muted" style="font-size:13px">No sentence yet.</div>') + '</div>';
}
function showEntry() {
  var e = entry, saved = findWord(e.w);
  var h = '<div class="top"><div class="grow"><h3>' + esc(e.w) + '</h3><div class="phon">' + esc(e.phon || "") +
    (e.audio ? '<button class="ghost" data-say="1" aria-label="Hear how to say it">▶ Hear it</button>' : '') + '</div></div>' + X + '</div>';
  e.meanings.forEach(function (m) {
    h += '<div class="pos">' + esc(m.pos) + '</div><ol>' + m.defs.map(function (d) { return '<li>' + esc(d.d) + (d.ex ? '<span class="ex">"' + esc(d.ex) + '"</span>' : '') + '</li>'; }).join("") + '</ol>' +
      (m.syn.length ? '<div class="syn">Similar: ' + m.syn.map(function (s) { return '<button class="linkish" data-lookup="' + esc(s) + '">' + esc(s) + '</button>'; }).join(", ") + '</div>' : '');
  });
  if (saved) h += savedBox(saved) + (saved.mine ? '' : sentenceForm(e.w, "Add your sentence"));
  else h += sentenceForm(e.w, "Save word");
  openModal(h);
}
function sentenceForm(w, label) {
  return '<form class="save" id="w-save" data-w="' + esc(w) + '"><label class="label" for="w-mine">Write your own sentence with "' + esc(w) + '"</label>' +
    '<textarea id="w-mine" placeholder="Using it once is how it sticks." maxlength="300"></textarea>' +
    '<div class="row"><button class="btn" type="submit">' + label + '</button><span class="muted" style="font-size:12px">With a sentence: +' + Q.xp("tiny") + ' XP. Without: saved, no XP.</span></div></form>';
}
function saveWord(w, mine) {
  var x = findWord(w), first = !x;
  if (!x) {
    var m = entry && entry.w.toLowerCase() === w.toLowerCase() && entry.meanings[0];
    x = { w: w, def: m ? m.defs[0].d : "", pos: m ? m.pos : "", phon: entry ? entry.phon : "", audio: entry ? entry.audio : "", added: Date.now(), box: 0, next: addDays(1) };
    L().words.push(x);
  }
  var xp = 0;
  if (mine) { x.mine = mine; xp = Q.award("learn:w:" + w.toLowerCase(), "tiny", "learning", "sk-words", "New word: " + w); }
  Q.change();
  if (xp) { Q.cheer(); Q.toast("<b>+" + xp + " XP</b> · \"" + esc(w) + "\" is in your word bank"); }
  else Q.toast(first ? "\"" + esc(w) + "\" saved. Add a sentence later for XP." : "Sentence saved");
  showEntry();
}

/* ---------- word review ---------- */
function startReview() {
  var list = due().slice().sort(function () { return Math.random() - .5; });
  if (!list.length) { Q.toast("No words to review today."); return; }
  review = { list: list.slice(0, 15), i: 0, knew: 0, show: false }; showCard();
}
function showCard() {
  var r = review, x = r.list[r.i];
  if (!x) return endReview();
  openModal('<div class="top"><div class="grow"><div class="count">Word ' + (r.i + 1) + ' of ' + r.list.length + '</div></div>' + X + '</div>' +
    '<div class="big">' + esc(x.w) + '</div>' +
    (r.show
      ? '<div style="text-align:center">' + (x.pos ? '<div class="pos">' + esc(x.pos) + '</div>' : '') + '<p style="margin:0 0 10px;font-size:16px">' + esc(x.def || "") + '</p>' +
        (x.mine ? '<div class="mine" style="text-align:left"><small>Your sentence</small>' + esc(x.mine) + '</div>' : '') +
        '<div class="center"><button class="ghost" data-rv="no">Not yet</button><button class="btn" data-rv="yes" autofocus>I knew it</button></div></div>'
      : '<div class="center"><p class="muted" style="width:100%;text-align:center;margin:0 0 4px">Say what it means, out loud or in your head.</p><button class="btn" data-rv="show" autofocus>Show meaning</button></div>'));
}
function endReview() {
  var r = review; review = null;
  var xp = r.i >= Math.min(5, r.list.length) ? Q.award("learn:rev:" + today(), "easy", "learning", "sk-words", "Word review") : 0;
  Q.change();
  openModal('<div class="top"><div class="grow"><h3>Review done</h3></div>' + X + '</div>' +
    '<p style="font-size:16px">You knew <b>' + r.knew + '</b> of ' + r.list.length + '.' + (xp ? ' <b class="xp">+' + xp + ' XP</b>' : '') + '</p>' +
    '<p class="muted" style="font-size:14px">Words you knew come back later and later. Words you missed come back tomorrow.</p>' +
    '<div class="center"><button class="btn" data-lnclose="1" autofocus>Close</button></div>');
  if (xp) Q.cheer();
}

/* ---------- lessons ---------- */
function play(v) {
  var k = vid(v);
  if (F.playing() === k) { F.close(); return; }
  F.play(v.list ? { list: v.list } : { id: v.id }, v.title, { learn: k });
}
function saveVideo(v) { if (findVideo(vid(v))) return findVideo(vid(v)); var o = { title: v.title, channel: v.channel || "", thumb: v.thumb || "", added: Date.now(), done: false }; if (v.list) o.list = v.list; else o.id = v.id; L().videos.unshift(o); return o; }
function doneForm(k) {
  var v = findVideo(k); if (!v) return;
  var skills = Q.S().skills, pick = v.skill || "sk-mind";
  openModal('<div class="top"><div class="grow"><div class="label">Lesson done</div><h3 style="font-size:24px">' + esc(v.title) + '</h3></div>' + X + '</div>' +
    '<form class="save" id="v-done" data-k="' + esc(k) + '" style="border:none;margin:0;padding:0">' +
    '<label class="label" for="v-note">What did you learn? One line is enough.</label>' +
    '<textarea id="v-note" maxlength="400" placeholder="e.g. Price by the result for the client, not by the hours." autofocus>' + esc(v.note || "") + '</textarea>' +
    '<label class="label" for="v-skill">Which skill did it grow?</label>' +
    '<select id="v-skill">' + skills.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === pick ? " selected" : "") + '>' + esc(s.name) + '</option>'; }).join("") + '</select>' +
    '<div class="row"><button class="btn" type="submit">Save · +' + Q.xp("easy") + ' XP</button></div></form>');
}

/* ---------- events ---------- */
document.addEventListener("click", function (e) {
  if (modal && e.target === modal) { review = null; closeModal(); return; }
  var b = e.target.closest("button"); if (!b) return;
  var d = b.dataset;
  if (d.lnclose) { review = null; closeModal(); return; }
  if (d.say) { if (entry && entry.audio) { try { new Audio(entry.audio).play(); } catch (er) {} } return; }
  if (d.lookup) { lookUp(d.lookup); return; }
  if (d.wopen) { lookUp(d.wopen); return; }
  if (d.wdel) {
    var arr = L().words, i = arr.findIndex(function (x) { return x.w === d.wdel; }), gone = arr[i]; if (i < 0) return;
    arr.splice(i, 1); Q.change(); Q.toast("Word removed. XP you earned stays.", function () { L().words.splice(i, 0, gone); Q.change(); }); return;
  }
  if (b.id === "wb-review") { startReview(); return; }
  if (d.rv && review) {
    var x = review.list[review.i];
    if (d.rv === "show") { review.show = true; showCard(); return; }
    if (d.rv === "yes") { review.knew++; x.box = Math.min((x.box || 0) + 1, GAPS.length - 1); x.next = addDays(GAPS[x.box]); }
    else { x.box = 0; x.next = addDays(1); }
    review.i++; review.show = false; showCard(); return;
  }
  if (d.rplay !== undefined) { var r = results && results[+d.rplay]; if (r) play(r); return; }
  if (d.rsave !== undefined) { var r2 = results && results[+d.rsave]; if (!r2) return; saveVideo(r2); Q.change(); Q.toast("Saved to Your lessons"); return; }
  if (d.rclear) { results = null; $("yt-q").value = ""; render(); return; }
  if (d.ymf) { lnFilter = d.ymf; render(); return; }
  if (d.vplay) { var v = findVideo(d.vplay); if (v) play(v); return; }
  if (d.vdel) {
    var vs = L().videos, j = vs.findIndex(function (x) { return vid(x) === d.vdel; }), g = vs[j]; if (j < 0) return;
    if (F.playing() === d.vdel) F.close();
    vs.splice(j, 1); Q.change(); Q.toast("Lesson removed. XP you earned stays.", function () { L().videos.splice(j, 0, g); Q.change(); }); return;
  }
  if (d.lndone) {
    var k = d.lndone, have = findVideo(k);
    if (!have && results) { var rr = results.find(function (x) { return x.id === k; }); if (rr) { saveVideo(rr); Q.change(); } }
    doneForm(k); return;
  }
});
document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal) { review = null; closeModal(); } });
document.addEventListener("submit", function (e) {
  var f = e.target;
  if (f.id === "dict-form") { e.preventDefault(); var w = $("dict-in").value; lookUp(w); $("dict-in").value = ""; $("dict-in").blur(); return; }
  if (f.id === "w-save") { e.preventDefault(); saveWord(f.dataset.w, $("w-mine").value.trim()); return; }
  if (f.id === "v-done") {
    e.preventDefault();
    var k = f.dataset.k, v = findVideo(k), note = $("v-note").value.trim();
    if (!v) return;
    if (note.length < 5) { Q.toast("Write one short line about what you learned."); $("v-note").focus(); return; }
    var sk = Q.S().skills.find(function (s) { return s.id === $("v-skill").value; }) || { id: "sk-mind", domain: "learning" };
    var wasDone = v.done;
    v.note = note; v.skill = sk.id; v.done = true; v.doneAt = v.doneAt || Date.now();
    var xp = Q.award("learn:v:" + k, "easy", sk.domain, sk.id, "Lesson: " + v.title);
    closeModal(); if (F.playing() === k) F.close();
    lnFilter = "done"; Q.change();
    if (xp) { Q.cheer(); Q.toast("<b>+" + xp + " XP</b> · Lesson done. Nice."); } else Q.toast(wasDone ? "Note updated" : "Lesson saved");
    return;
  }
  if (f.id === "yt-form") {
    e.preventDefault(); var q = $("yt-q").value.trim(); if (!q || searching) return;
    searching = true; render();
    fetch("/api/yt?q=" + encodeURIComponent(q), { credentials: "same-origin" }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) { searching = false; if (!x.ok) { results = null; Q.toast(esc(x.j.error || "Search did not work.")); } else results = x.j.items || []; render(); })
      .catch(function () { searching = false; render(); Q.toast("Could not reach the server. Check your internet."); });
    return;
  }
  if (f.id === "yt-add") {
    e.preventDefault(); var v2 = parseYT($("yt-url").value);
    if (!v2) { Q.toast("That does not look like a YouTube video link."); return; }
    var k2 = vid(v2); if (findVideo(k2)) { Q.toast("That one is already in Your lessons."); return; }
    $("yt-url").value = "";
    var o = saveVideo({ id: v2.id, list: v2.list, title: v2.list ? "YouTube playlist" : "YouTube video" });
    lnFilter = "todo"; Q.change(); Q.toast("Added to Your lessons");
    fetch("/api/yt?id=" + encodeURIComponent(k2), { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.title) return; o.title = j.title; o.channel = j.channel || ""; if (j.thumb && !o.id) o.thumb = j.thumb; Q.change();
    }).catch(function () {});
  }
});
window.addEventListener("qr-player", function () { if (!$("v-learn").hidden) render(); });

fetch("/api/yt", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : { on: false }; }).then(function (j) { searchOn = !!j.on; render(); }).catch(function () { searchOn = false; render(); });

window.Learn = { render: render, lookUp: lookUp };
render();
})();
