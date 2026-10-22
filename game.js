/* Quest Room game rules. Pure functions over one state object, no screen code.
   The XP ledger is the source of truth: totals are always added up from it. */
(function (root) {
  "use strict";

  var DOMAINS = [
    { id: "career",     name: "Career & Craft",           attr: "Craft",    color: "#f2b45a" },
    { id: "finances",   name: "Finances",                 attr: "Wealth",   color: "#93cf8c" },
    { id: "health",     name: "Health & Vitality",        attr: "Vitality", color: "#e88466" },
    { id: "learning",   name: "Knowledge & Learning",     attr: "Wisdom",   color: "#b7a2e6" },
    { id: "home",       name: "Home & Personal Life",     attr: "Harmony",  color: "#e7a3b8" },
    { id: "creativity", name: "Creativity & Exploration", attr: "Spirit",   color: "#7fc8c2" }
  ];
  var DIFFS = [
    { id: "tiny", name: "Tiny" }, { id: "easy", name: "Easy" }, { id: "standard", name: "Standard" },
    { id: "challenging", name: "Challenging" }, { id: "major", name: "Major" }
  ];
  var RANKS = [[1, "E"], [5, "D"], [10, "C"], [15, "B"], [20, "A"], [30, "S"]];

  function uid() { return Math.random().toString(36).slice(2, 10); }
  function dkey(d) {
    d = d || new Date();
    var z = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
  }
  function weekStart(d) {
    var x = new Date(d || new Date()); x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x;
  }
  function wkey(d) { return "W" + dkey(weekStart(d)); }

  function fresh() {
    var mainId = "m-client";
    var s = {
      v: 2,
      settings: { xp: { tiny: 5, easy: 10, standard: 20, challenging: 35, major: 50 }, perLevel: 100, coinRate: 0.5, missionBonus: 50 },
      skills: [
        { id: "sk-sales", name: "Sales", domain: "career" },
        { id: "sk-money", name: "Money", domain: "finances" },
        { id: "sk-mind", name: "Mind", domain: "learning" },
        { id: "sk-words", name: "Words", domain: "learning" },
        { id: "sk-cali", name: "Calisthenics", domain: "health" },
        { id: "sk-igbo", name: "Igbo", domain: "learning" },
        { id: "sk-jp", name: "Japanese", domain: "learning" }
      ],
      training: { level: "beginner" },
      plan: { train: [1, 3, 5], igbo: [1, 2, 4, 5, 6], japanese: [2, 3, 6] },
      quests: [],
      missions: [{ id: mainId, title: "Land my first paying freelance client", main: true, status: "active", created: Date.now() }],
      rewards: [
        { id: uid(), title: "One episode of a show", cost: 40 },
        { id: uid(), title: "One hour of gaming", cost: 60 },
        { id: uid(), title: "A sweet treat", cost: 80 },
        { id: uid(), title: "A solo date out", cost: 250 }
      ],
      ledger: [],
      days: {} // "YYYY-MM-DD": { energy: "low"|"steady"|"high", featured: [questIds] }
    };
    var q = function (title, domain, skill, diff, repeat, min, extra) {
      var o = { id: "q-" + uid(), title: title, domain: domain, skill: skill || "", diff: diff, repeat: repeat, min: min || 0, status: "active", created: Date.now() };
      for (var k in (extra || {})) o[k] = extra[k];
      s.quests.push(o);
    };
    q("Write one short message pitching your work", "career", "sk-sales", "standard", "daily", 30);
    q("Learn one money idea, like how to set your price", "finances", "sk-money", "easy", "daily", 20);
    q("Look at one ad and ask why it works", "learning", "sk-mind", "easy", "daily", 20);
    q("Learn one new word and use it once", "learning", "sk-words", "easy", "daily", 20);
    q("Pitch one real brand directly", "career", "sk-sales", "challenging", "weekly", 45, { boss: true });
    var steps = [
      ["Pick the one service you will sell first", "standard"],
      ["Get your portfolio link ready to share", "standard"],
      ["List 20 brands you could help", "standard"],
      ["Send 10 pitch messages", "challenging"],
      ["Get your first reply", "challenging"],
      ["Have a call or chat with a lead", "challenging"],
      ["Send your price and plan", "challenging"],
      ["Get paid", "major"]
    ];
    steps.forEach(function (st, i) { q(st[0], "career", "sk-sales", st[1], "once", 0, { mission: mainId, order: i }); });
    return s;
  }

  function load(o) {
    if (!o || typeof o !== "object" || o.v !== 2) return fresh();
    var f = fresh();
    o.settings = Object.assign({}, f.settings, o.settings || {});
    o.settings.xp = Object.assign({}, f.settings.xp, (o.settings && o.settings.xp) || {});
    ["skills", "quests", "missions", "rewards", "ledger"].forEach(function (k) { if (!Array.isArray(o[k])) o[k] = []; });
    if (!o.days || typeof o.days !== "object") o.days = {};
    if (!o.training || typeof o.training !== "object") o.training = { level: "beginner" };
    [["sk-cali", "Calisthenics", "health"], ["sk-igbo", "Igbo", "learning"], ["sk-jp", "Japanese", "learning"]].forEach(function (k) {
      if (!o.skills.some(function (x) { return x.id === k[0]; })) o.skills.push({ id: k[0], name: k[1], domain: k[2] });
    });
    if (!o.plan || typeof o.plan !== "object") o.plan = { train: [1, 3, 5], igbo: [1, 2, 4, 5, 6], japanese: [2, 3, 6] };
    return o;
  }

  /* ---------- ledger ---------- */
  // Each entry: { k: key, t: "xp"|"coin", a: amount, at: time, d: domain, s: skill, n: note }
  function net(s, key, type) {
    var sum = 0;
    for (var i = 0; i < s.ledger.length; i++) { var e = s.ledger[i]; if (e.k === key && e.t === type) sum += e.a; }
    return sum;
  }
  function total(s, type, filter) {
    var sum = 0;
    for (var i = 0; i < s.ledger.length; i++) { var e = s.ledger[i]; if (e.t === type && (!filter || filter(e))) sum += e.a; }
    return sum;
  }
  function xpTotal(s) { return Math.max(0, total(s, "xp")); }
  function coins(s) { return Math.max(0, total(s, "coin")); }
  function domainXp(s, id) { return Math.max(0, total(s, "xp", function (e) { return e.d === id; })); }
  function skillXp(s, id) { return Math.max(0, total(s, "xp", function (e) { return e.s === id; })); }

  function level(s) {
    var per = Math.max(10, +s.settings.perLevel || 100), xp = xpTotal(s);
    var l = Math.floor(xp / per) + 1, rank = "E";
    RANKS.forEach(function (r) { if (l >= r[0]) rank = r[1]; });
    return { level: l, rank: rank, into: xp % per, per: per, xp: xp };
  }

  /* ---------- quests ---------- */
  function questXp(s, q) { return Math.max(0, Math.round(+s.settings.xp[q.diff] || 0)); }
  function periodKey(q, d) {
    if (q.repeat === "daily") return "quest:" + q.id + ":" + dkey(d);
    if (q.repeat === "weekly") return "quest:" + q.id + ":" + wkey(d);
    return "quest:" + q.id;
  }
  function isDone(s, q, d) { return net(s, periodKey(q, d), "xp") > 0 || (q.repeat === "once" && q.status === "done"); }

  // Returns a short result for the toast, or null if nothing changed (a repeat click).
  function complete(s, q, d) {
    var key = periodKey(q, d);
    if (net(s, key, "xp") > 0) return null; // already awarded: never twice
    var xp = questXp(s, q), now = Date.now(), coin = Math.round(xp * (+s.settings.coinRate || 0));
    s.ledger.push({ k: key, t: "xp", a: xp, at: now, d: q.domain, s: q.skill || "", n: q.title });
    if (coin) s.ledger.push({ k: key, t: "coin", a: coin, at: now, n: q.title });
    if (q.repeat === "once") { q.status = "done"; q.doneAt = now; }
    var bonus = q.mission ? missionCheck(s, q.mission) : 0;
    return { xp: xp, coin: coin, bonus: bonus, key: key };
  }
  // Undo writes reversing entries, so the history stays complete.
  function undo(s, q, d) {
    var key = periodKey(q, d), xp = net(s, key, "xp"), coin = net(s, key, "coin"), now = Date.now();
    if (xp <= 0 && q.status !== "done") return null;
    if (xp > 0) s.ledger.push({ k: key, t: "xp", a: -xp, at: now, d: q.domain, s: q.skill || "", n: "Undo: " + q.title });
    if (coin > 0) s.ledger.push({ k: key, t: "coin", a: -coin, at: now, n: "Undo: " + q.title });
    if (q.repeat === "once") { q.status = "active"; delete q.doneAt; }
    if (q.mission) missionCheck(s, q.mission);
    return { xp: xp };
  }

  /* ---------- missions ---------- */
  function missionQuests(s, id) {
    return s.quests.filter(function (q) { return q.mission === id && q.status !== "archived"; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0) || a.created - b.created; });
  }
  function missionProgress(s, id) {
    var qs = missionQuests(s, id).filter(function (q) { return q.repeat === "once"; });
    var done = qs.filter(function (q) { return q.status === "done"; }).length;
    return { done: done, total: qs.length, pct: qs.length ? done / qs.length : 0 };
  }
  // A small one-time bonus when every step is done; taken back if a step is undone.
  function missionCheck(s, id) {
    var m = s.missions.find(function (x) { return x.id === id; }); if (!m) return 0;
    var p = missionProgress(s, id), key = "mission:" + id, has = net(s, key, "xp");
    var bonus = Math.round(+s.settings.missionBonus || 0), now = Date.now();
    if (p.total && p.done === p.total) {
      m.status = "done"; m.doneAt = m.doneAt || now;
      if (has <= 0 && bonus) { s.ledger.push({ k: key, t: "xp", a: bonus, at: now, n: "Mission complete: " + m.title }); return bonus; }
    } else {
      if (m.status === "done") m.status = "active";
      if (has > 0) s.ledger.push({ k: key, t: "xp", a: -has, at: now, n: "Mission reopened: " + m.title });
    }
    return 0;
  }

  /* ---------- rewards ---------- */
  function redeem(s, r) {
    var c = coins(s);
    if (c < r.cost) return { ok: false, need: r.cost - c };
    var now = Date.now();
    s.ledger.push({ k: "reward:" + r.id + ":" + now, t: "coin", a: -r.cost, at: now, n: r.title, r: r.id });
    return { ok: true, key: "reward:" + r.id + ":" + now };
  }
  function unredeem(s, key) {
    var c = net(s, key, "coin"); if (c >= 0) return false;
    s.ledger.push({ k: key, t: "coin", a: -c, at: Date.now(), n: "Undo reward" }); return true;
  }
  function redemptions(s) {
    var out = [];
    s.ledger.forEach(function (e) { if (e.t === "coin" && e.k.indexOf("reward:") === 0 && e.a < 0 && net(s, e.k, "coin") < 0) out.push(e); });
    return out.reverse();
  }

  /* ---------- days, featured quests, energy ---------- */
  function day(s, d) { var k = dkey(d); if (!s.days[k]) s.days[k] = { energy: "", featured: [] }; return s.days[k]; }
  function available(s, d) {
    return s.quests.filter(function (q) { return q.status === "active" && !isDone(s, q, d); });
  }
  var ORDER = { tiny: 0, easy: 1, standard: 2, challenging: 3, major: 4 };
  // Suggestions are chosen once per day (and again if the energy changes), so a quest
  // you just finished stays on the list, ticked, instead of jumping away.
  function featured(s, d) {
    var dd = day(s, d), byId = function (id) { return s.quests.find(function (q) { return q.id === id; }); };
    var picks = (dd.featured || []).map(byId).filter(function (q) { return q && q.status !== "archived"; });
    if (!Array.isArray(dd.auto) || dd.autoFor !== (dd.energy || "")) {
      var low = dd.energy === "low";
      var rest = s.quests.filter(function (q) { return q.status === "active" && picks.indexOf(q) < 0 && !isDone(s, q, d); });
      rest.sort(function (a, b) {
        if (low) return ORDER[a.diff] - ORDER[b.diff];
        var da = a.repeat === "daily" ? 0 : 1, db = b.repeat === "daily" ? 0 : 1;
        return da - db || ORDER[a.diff] - ORDER[b.diff];
      });
      dd.auto = rest.slice(0, 3).map(function (q) { return q.id; }); dd.autoFor = dd.energy || "";
    }
    var auto = dd.auto.map(byId).filter(function (q) { return q && q.status !== "archived" && picks.indexOf(q) < 0; });
    if (picks.length + auto.length < 3) { // top up if a suggestion was removed
      s.quests.forEach(function (q) {
        if (picks.length + auto.length < 3 && q.status === "active" && picks.indexOf(q) < 0 && auto.indexOf(q) < 0 && !isDone(s, q, d)) auto.push(q);
      });
    }
    return picks.concat(auto).slice(0, 3).map(function (q) { return { q: q, picked: picks.indexOf(q) >= 0 }; });
  }
  function toggleFeature(s, id, d) {
    var dd = day(s, d), i = dd.featured.indexOf(id);
    if (i >= 0) { dd.featured.splice(i, 1); return true; }
    if (dd.featured.length >= 3) return false;
    dd.featured.push(id); return true;
  }
  function dayCount(s, d) { // quests finished on a given day
    var start = new Date(d); start.setHours(0, 0, 0, 0); var end = start.getTime() + 864e5, keys = {};
    s.ledger.forEach(function (e) { if (e.t === "xp" && (e.k.indexOf("quest:") === 0 || e.k.indexOf("workout:") === 0 || e.k.indexOf("lesson:") === 0) && e.at >= start.getTime() && e.at < end) keys[e.k] = 1; });
    return Object.keys(keys).filter(function (k) { return net(s, k, "xp") > 0; }).length;
  }

  /* ---------- achievements (worked out from history, so they never disappear) ---------- */
  function achievements(s) {
    var awards = {}, played = {};
    s.ledger.forEach(function (e) {
      if (e.t === "xp" && e.a > 0 && e.k.indexOf("quest:") === 0) { awards[e.k] = 1; played[dkey(new Date(e.at))] = 1; }
    });
    var n = Object.keys(awards).length, lv = level(s).level;
    var mDone = s.ledger.some(function (e) { return e.k.indexOf("mission:") === 0 && e.a > 0; });
    var rew = s.ledger.some(function (e) { return e.k.indexOf("reward:") === 0 && e.a < 0; });
    var wk = {}; s.ledger.forEach(function (e) { if (e.t === "xp" && e.k.indexOf("workout:") === 0 && net(s, e.k, "xp") > 0) wk[e.k] = 1; });
    var nw = Object.keys(wk).length, week = s.ledger.some(function (e) { return e.k.indexOf("trainweek:") === 0 && e.a > 0; });
    var lessons = function (lang) { var k = {}; s.ledger.forEach(function (e) { if (e.k.indexOf("lesson:" + lang + ":") === 0 && net(s, e.k, "xp") > 0) k[e.k] = 1; }); return Object.keys(k).length; };
    var units = function (lang) { var k = {}; s.ledger.forEach(function (e) { if (e.k.indexOf("unit:" + lang + ":") === 0 && net(s, e.k, "xp") > 0) k[e.k] = 1; }); return Object.keys(k).length; };
    var doms = DOMAINS.filter(function (d) { return s.ledger.some(function (e) { return e.d === d.id && e.a > 0; }); }).length;
    return [
      { id: "first", name: "First step", desc: "Finish your first quest", got: n >= 1 },
      { id: "ten", name: "Getting going", desc: "Finish 10 quests", got: n >= 10 },
      { id: "fifty", name: "Seasoned", desc: "Finish 50 quests", got: n >= 50 },
      { id: "days7", name: "Seven nights", desc: "Play on 7 different days", got: Object.keys(played).length >= 7 },
      { id: "lv5", name: "Rank up", desc: "Reach level 5", got: lv >= 5 },
      { id: "mission", name: "Mission clear", desc: "Finish a whole mission", got: mDone },
      { id: "reward", name: "Treat yourself", desc: "Claim your first reward", got: rew },
      { id: "wide", name: "Well rounded", desc: "Earn XP in all 6 life areas", got: doms >= 6 },
      { id: "wk1", name: "First sweat", desc: "Finish your first workout", got: nw >= 1 },
      { id: "wk10", name: "Strong habit", desc: "Finish 10 workouts", got: nw >= 10 },
      { id: "wkweek", name: "Training week", desc: "Do 3 workouts in one week", got: week },
      { id: "wk30", name: "Iron will", desc: "Finish 30 workouts", got: nw >= 30 },
      { id: "ig1", name: "Ndewo!", desc: "Finish your first Igbo lesson", got: lessons("igbo") >= 1 },
      { id: "ig5", name: "Halfway home", desc: "Finish 5 Igbo weeks", got: units("igbo") >= 5 },
      { id: "ig10", name: "Igbo course clear", desc: "Finish all 10 Igbo weeks", got: units("igbo") >= 10 },
      { id: "jpk", name: "Katakana master", desc: "Finish Japanese weeks 1 to 3", got: [0, 1, 2].every(function (w) { return net(s, "unit:japanese:" + w, "xp") > 0; }) }
    ];
  }

  /* ---------- calisthenics training ---------- */
  // Each exercise: [name, sets, reps, tip]. Reps like "8-12" mean: stop 1 or 2 reps before you can't do more.
  var PROGRAMS = {
    beginner: {
      name: "Beginner", diff: "standard", note: "3 workouts a week, a rest day between. Rest 60 to 90 seconds between sets.",
      workouts: [
        { id: "b-a", name: "Full body A", focus: "Push, legs, core", ex: [
          ["Incline push-ups (hands on a table or wall)", 3, "8-12", "Body in one straight line"],
          ["Bodyweight squats", 3, "12-15", "Sit back, knees follow your toes"],
          ["Backpack rows (fill a bag with books, bend forward, pull it to your belly)", 3, "10-12", "Flat back, squeeze your shoulder blades at the top"],
          ["Glute bridges", 3, "12-15", "Pause 1 second at the top"],
          ["Plank", 3, "20-30 sec", "Don't let your hips drop"]
        ] },
        { id: "b-b", name: "Full body B", focus: "Pull, legs, core", ex: [
          ["Knee push-ups", 3, "8-12", "Lower slowly, 2 seconds down"],
          ["Reverse lunges", 3, "8 each leg", "Step back, front knee over ankle"],
          ["Doorframe or towel rows", 3, "10-12", "Lean back further to make it harder"],
          ["Wall sit", 3, "30 sec", "Thighs flat, back on the wall"],
          ["Dead bugs", 3, "8 each side", "Lower back stays on the floor"]
        ] },
        { id: "b-c", name: "Full body C", focus: "Strength and balance", ex: [
          ["Push-up negatives (lower slowly from the top)", 3, "5", "Take 3 to 5 seconds to go down"],
          ["Step-ups on a sturdy step or chair", 3, "8 each leg", "Push through the heel"],
          ["Superman hold", 3, "20 sec", "Lift arms and legs, look at the floor"],
          ["Side plank", 2, "20 sec each side", "Hips high"],
          ["Calf raises", 3, "15-20", "Slow on the way down"]
        ] }
      ]
    },
    intermediate: {
      name: "Intermediate", diff: "challenging", note: "Push, pull, legs. Do each once a week, or repeat the cycle. Rest 90 seconds between sets.",
      workouts: [
        { id: "i-push", name: "Push day", focus: "Chest, shoulders, arms", ex: [
          ["Push-ups", 4, "12-20", "Full range, chest to fist height"],
          ["Dips (bars or bench)", 4, "8-12", "Shoulders down, elbows back"],
          ["Pike push-ups", 3, "6-10", "Hips high, head goes toward the floor"],
          ["Diamond push-ups", 3, "8-12", "Hands close, elbows near your sides"],
          ["Hollow body hold", 3, "20-30 sec", "Lower back pressed down"]
        ] },
        { id: "i-pull", name: "Pull day", focus: "Back, arms, grip", ex: [
          ["Pull-ups (or slow negatives)", 4, "4-8", "Chin over the bar, full hang at the bottom"],
          ["Chin-ups", 3, "4-8", "Palms facing you"],
          ["Inverted rows", 3, "10-15", "Chest to the bar"],
          ["Hanging knee raises", 3, "10-12", "No swinging"],
          ["Dead hang", 3, "30 sec", "Relax your shoulders, then pull them down"]
        ] },
        { id: "i-legs", name: "Legs and core", focus: "Legs, glutes, core", ex: [
          ["Bulgarian split squats", 3, "8-10 each leg", "Back foot on a chair"],
          ["Jump squats", 3, "10-12", "Land softly"],
          ["Single-leg glute bridges", 3, "10 each leg", "Hips stay level"],
          ["Single-leg calf raises", 3, "12-15 each leg", "Hold a wall for balance"],
          ["Tuck L-sit (on two chairs or the floor)", 4, "10-15 sec", "Push the floor away"]
        ] }
      ]
    }
  };
  function findWorkout(id) {
    var out = null;
    Object.keys(PROGRAMS).forEach(function (p) { PROGRAMS[p].workouts.forEach(function (w) { if (w.id === id) out = { w: w, p: PROGRAMS[p] }; }); });
    return out;
  }
  function workoutKey(id, d) { return "workout:" + id + ":" + dkey(d); }
  function workoutDone(s, id, d) { return net(s, workoutKey(id, d), "xp") > 0; }
  function workoutXp(s, id) { var f = findWorkout(id); return f ? questXp(s, { diff: f.p.diff }) : 0; }
  function setsDone(s, id, i, d) { var dd = s.days[dkey(d)]; return (dd && dd.sets && dd.sets[id + "." + i]) || 0; }
  function setSets(s, id, i, n, d) { var dd = day(s, d); if (!dd.sets) dd.sets = {}; dd.sets[id + "." + i] = n; }
  function weekWorkouts(s, d) {
    var ws = weekStart(d).getTime(), we = ws + 7 * 864e5, keys = {};
    s.ledger.forEach(function (e) { if (e.t === "xp" && e.k.indexOf("workout:") === 0 && e.at >= ws && e.at < we) keys[e.k] = 1; });
    return Object.keys(keys).filter(function (k) { return net(s, k, "xp") > 0; }).length;
  }
  var WEEK_GOAL = 3, WEEK_BONUS = 30;
  function weekCheck(s, d) {
    var key = "trainweek:" + wkey(d), has = net(s, key, "xp"), n = weekWorkouts(s, d), now = Date.now();
    if (n >= WEEK_GOAL && has <= 0) { s.ledger.push({ k: key, t: "xp", a: WEEK_BONUS, at: now, d: "health", s: "sk-cali", n: "Training week bonus" }); return WEEK_BONUS; }
    if (n < WEEK_GOAL && has > 0) s.ledger.push({ k: key, t: "xp", a: -has, at: now, d: "health", s: "sk-cali", n: "Training week bonus taken back" });
    return 0;
  }
  // One award per workout per day, like quests.
  function completeWorkout(s, id, d) {
    var f = findWorkout(id); if (!f) return null;
    var key = workoutKey(id, d); if (net(s, key, "xp") > 0) return null;
    var xp = workoutXp(s, id), coin = Math.round(xp * (+s.settings.coinRate || 0)), now = Date.now();
    s.ledger.push({ k: key, t: "xp", a: xp, at: now, d: "health", s: "sk-cali", n: "Workout: " + f.w.name });
    if (coin) s.ledger.push({ k: key, t: "coin", a: coin, at: now, n: "Workout: " + f.w.name });
    return { xp: xp, coin: coin, bonus: weekCheck(s, d) };
  }
  function undoWorkout(s, id, d) {
    var key = workoutKey(id, d), xp = net(s, key, "xp"), coin = net(s, key, "coin"), now = Date.now();
    if (xp <= 0) return null;
    s.ledger.push({ k: key, t: "xp", a: -xp, at: now, d: "health", s: "sk-cali", n: "Undo workout" });
    if (coin > 0) s.ledger.push({ k: key, t: "coin", a: -coin, at: now, n: "Undo workout" });
    weekCheck(s, d); return { xp: xp };
  }

  /* ---------- language courses ---------- */
  // Each lesson: [title, what to do]. Igbo words are written without tone marks on purpose:
  // check every new word on Nkọwa okwu, which shows the tones and plays the sound.
  var LINKS = {
    nkowa: ["Nkọwa okwu (Igbo dictionary with tones and audio)", "https://nkowaokwu.com/home"],
    elias: ["Harvard ELIAS Igbo course", "https://elias.fas.harvard.edu/languages"],
    tones: ["ELIAS Unit 2: Igbo sounds and tones", "https://elias.fas.harvard.edu/node/277"],
    kata: ["Tofugu: learn katakana", "https://tofugu.com/japanese/learn-katakana"],
    taekim: ["Tae Kim's guide to Japanese grammar", "https://guidetojapanese.org/learn/"]
  };
  var FAMILY = "Talk with your family member for 15 minutes using this week's words. Ask how they say them in Anambra and in Owerri, and write the differences in your notebook.";
  var COURSES = {
    igbo: {
      name: "Igbo", skill: "sk-igbo", diff: "standard", famDiff: "challenging", minutes: 20, links: ["nkowa", "elias", "tones"],
      about: "Standard Igbo, with your family's Anambra and Owerri ways noted each week. 4 lessons and 1 family talk a week.",
      weeks: [
        { t: "Sounds and tones", l: [
          ["The Igbo alphabet", "Learn the 36 letters, including ch, gb, gh, gw, kp, kw, nw, ny, sh and ṅ. Say each one out loud."],
          ["The 8 vowels", "Practice a, e, i, ị, o, ọ, u, ụ. Notice the dotted vowels: they are different sounds, not decoration."],
          ["Tones change meaning", "Open ELIAS Unit 2. Then look up 'akwa' on Nkọwa okwu and listen: one spelling, different tones, different meanings."],
          ["Your notebook", "Start an Igbo notebook. Copy 5 words from Nkọwa okwu with their tone marks and say each one 5 times."],
          ["Family talk", FAMILY] ] },
        { t: "Greetings", l: [
          ["Hello and how are you", "Learn Ndewo, Kedụ? and how to answer. Check the tones on Nkọwa okwu."],
          ["Greetings by time of day", "Learn the greetings for morning (ụtụtụ), afternoon (ehihie), evening (mgbede) and good night."],
          ["Polite words", "Learn biko (please), daalụ (thank you), nnọọ (welcome) and how to say goodbye."],
          ["Greet out loud", "Greet someone at home in Igbo at three different times today. Write down how they answered."],
          ["Family talk", FAMILY] ] },
        { t: "Introducing yourself", l: [
          ["My name is", "Learn 'Aha m bụ…' and how to ask someone's name. Use ELIAS Unit 4."],
          ["Where I am from", "Learn to say where you live and where your family is from."],
          ["Introducing others", "Learn to introduce a friend or family member: 'this is my…'."],
          ["Write your intro", "Write 4 sentences about yourself in Igbo. Read them out loud 3 times."],
          ["Family talk", FAMILY] ] },
        { t: "Numbers", l: [
          ["1 to 10", "Learn otu to iri. Check each one's tones on Nkọwa okwu."],
          ["11 to 20", "Learn how 11 to 20 are built from the numbers you know."],
          ["Tens and 100", "Learn 20, 30, 40… and 100. Say your age and phone number in Igbo."],
          ["Number practice", "Count 20 things around you out loud. Ask someone to say a number and you write it."],
          ["Family talk", FAMILY] ] },
        { t: "Family", l: [
          ["Close family", "Learn the words for mother, father, sister, brother, child. Use ELIAS Unit 8."],
          ["Wider family", "Learn the words for grandparents, aunt, uncle, cousin."],
          ["Talking about family", "Say how many sisters and brothers you have, and their names."],
          ["Family tree", "Draw your family tree and label it in Igbo."],
          ["Family talk", FAMILY] ] },
        { t: "Time, days and months", l: [
          ["Telling time", "Learn how to ask and say the time. Use ELIAS Unit 9."],
          ["Days of the week", "Learn the days of the week. Use ELIAS Unit 11."],
          ["Months", "Learn the months, and say when your birthday is."],
          ["My week", "Say out loud what day it is, the time, and what you will do tomorrow."],
          ["Family talk", FAMILY] ] },
        { t: "Daily routine", l: [
          ["Everyday actions", "Learn verbs for wake up, bathe, eat, go, work, sleep. Use ELIAS Unit 12."],
          ["Describing your day", "Make 5 sentences about your normal day."],
          ["Weather", "Learn words for sun, rain, hot and cold. Use ELIAS Unit 13."],
          ["Tell your day", "Tell someone at home about your day in Igbo, even with mistakes."],
          ["Family talk", FAMILY] ] },
        { t: "Food and the market", l: [
          ["Food words", "Learn 10 foods you eat often. Use ELIAS Unit 19."],
          ["Asking the price", "Learn how to ask how much something costs. Use ELIAS Unit 20."],
          ["Buying and bargaining", "Learn to say 'reduce it', 'I will take it' and 'it is too much'."],
          ["Market role-play", "Act out buying 3 things at a market with someone at home."],
          ["Family talk", FAMILY] ] },
        { t: "Body and directions", l: [
          ["Parts of the body", "Learn the words for head, eyes, hand, leg, stomach. Use ELIAS Unit 10."],
          ["Saying what hurts", "Learn how to say 'my head hurts'."],
          ["Directions", "Learn left, right, straight, near and far. Use ELIAS Unit 21."],
          ["Guide someone", "Explain in Igbo how to get from your room to the kitchen."],
          ["Family talk", FAMILY] ] },
        { t: "Review and a real conversation", l: [
          ["Review weeks 1 to 5", "Go through your notebook. Say every word out loud and check any tones you are unsure of."],
          ["Review weeks 6 to 9", "Do the same for the newer words. Mark the ones you keep forgetting."],
          ["Plans for the future", "Learn to say what you will do next week. Use ELIAS Unit 15."],
          ["5-minute talk", "Have a 5-minute conversation in Igbo only. Greet, introduce yourself, talk about your day."],
          ["Family talk", FAMILY] ] }
      ]
    },
    japanese: {
      name: "Japanese", skill: "sk-jp", diff: "easy", famDiff: "easy", minutes: 10, links: ["kata", "taekim"],
      about: "Light track, about 10 minutes, 3 times a week. You know hiragana, so this starts with katakana.",
      weeks: [
        { t: "Katakana part 1", l: [
          ["ア to コ", "Learn ア イ ウ エ オ and カ キ ク ケ コ with the Tofugu guide."],
          ["サ to ト", "Learn サ シ ス セ ソ and タ チ ツ テ ト. Watch out: シ and ツ look alike."],
          ["Review", "Write all 20 from memory, then check."] ] },
        { t: "Katakana part 2", l: [
          ["ナ to ホ", "Learn ナ ニ ヌ ネ ノ and ハ ヒ フ ヘ ホ."],
          ["マ to ン", "Learn マ ミ ム メ モ, ヤ ユ ヨ, ラ リ ル レ ロ, ワ ヲ ン."],
          ["Extra marks", "Learn ゛ and ゜ (ガ, パ), and the long line ー as in コーヒー (coffee)."] ] },
        { t: "Read real words", l: [
          ["Small letters", "Learn small ャ ュ ョ and small ッ, as in シャツ (shirt)."],
          ["Loanwords", "Read 10 katakana words like テレビ, パン, ゲーム and guess the English word."],
          ["Your name", "Write your name in katakana: メイ (Mae)."] ] },
        { t: "Greetings", l: [
          ["Daily greetings", "おはよう ございます (good morning), こんにちは (hello), こんばんは (good evening)."],
          ["Polite words", "ありがとう ございます (thank you), すみません (excuse me / sorry), おやすみなさい (good night)."],
          ["Say them all", "Say each greeting out loud 5 times, then use one today."] ] },
        { t: "Introduce yourself", l: [
          ["はじめまして", "はじめまして。わたしは メイ です。よろしく おねがいします。 (Nice to meet you. I am Mae.)"],
          ["X は Y です", "Learn the basic sentence: A は B です (A is B). Read Tae Kim's first grammar pages."],
          ["Questions with か", "Add か at the end to ask: がくせい ですか? (Are you a student?)"] ] },
        { t: "This, that and numbers", l: [
          ["これ それ あれ", "これ (this, near me), それ (that, near you), あれ (that, over there)."],
          ["Owning things with の", "わたしの ほん (my book). の joins two nouns."],
          ["Numbers 1 to 10", "いち に さん よん ご ろく なな はち きゅう じゅう."] ] },
        { t: "Numbers, time and money", l: [
          ["Up to 100", "Build 11 to 99 from what you know: じゅういち (11), にじゅう (20)."],
          ["Telling time", "〜じ for hours: さんじ (3 o'clock). Learn the odd ones: よじ (4), くじ (9)."],
          ["Prices", "〜えん for yen: ひゃくえん (100 yen). Ask いくら ですか? (How much is it?)"] ] },
        { t: "First verbs", l: [
          ["Polite verbs", "Learn the ます form: いきます (go), たべます (eat), のみます (drink), みます (watch)."],
          ["Saying no", "Change ます to ません: たべません (I don't eat)."],
          ["Past tense", "Change ます to ました: たべました (I ate)."] ] },
        { t: "Small words that join sentences", l: [
          ["を", "Marks what you act on: パンを たべます (I eat bread)."],
          ["に and へ", "Show where you are going or a time: がっこうに いきます."],
          ["で", "Shows where something happens: うちで たべます (I eat at home)."] ] },
        { t: "Describing and review", l: [
          ["Describing words", "い words like たかい (expensive) and な words like しずか (quiet). Learn すき (like) and きらい (dislike)."],
          ["First kanji", "Learn the days of the week kanji: 日 月 火 水 木 金 土."],
          ["Write about you", "Write 5 sentences about yourself and your day. Read them out loud."] ] }
      ]
    }
  };
  function lessonKey(lang, w, i) { return "lesson:" + lang + ":" + w + ":" + i; }
  function lessonDone(s, lang, w, i) { return net(s, lessonKey(lang, w, i), "xp") > 0; }
  function lessonXp(s, lang, w, i) {
    var c = COURSES[lang], last = i === c.weeks[w].l.length - 1;
    return questXp(s, { diff: (lang === "igbo" && last) ? c.famDiff : c.diff });
  }
  function courseProgress(s, lang) {
    var c = COURSES[lang], done = 0, total = 0, next = null;
    c.weeks.forEach(function (wk, w) { wk.l.forEach(function (_, i) { total++; if (lessonDone(s, lang, w, i)) done++; else if (!next) next = { w: w, i: i }; }); });
    return { done: done, total: total, pct: total ? done / total : 0, next: next };
  }
  function weekProgress(s, lang, w) {
    var l = COURSES[lang].weeks[w].l, done = l.filter(function (_, i) { return lessonDone(s, lang, w, i); }).length;
    return { done: done, total: l.length };
  }
  var UNIT_BONUS = 25;
  function unitCheck(s, lang, w) {
    var key = "unit:" + lang + ":" + w, has = net(s, key, "xp"), p = weekProgress(s, lang, w), now = Date.now(), c = COURSES[lang];
    if (p.done === p.total && has <= 0) { s.ledger.push({ k: key, t: "xp", a: UNIT_BONUS, at: now, d: "learning", s: c.skill, n: c.name + " week " + (w + 1) + " complete" }); return UNIT_BONUS; }
    if (p.done < p.total && has > 0) s.ledger.push({ k: key, t: "xp", a: -has, at: now, d: "learning", s: c.skill, n: c.name + " week " + (w + 1) + " reopened" });
    return 0;
  }
  function completeLesson(s, lang, w, i) {
    var c = COURSES[lang]; if (!c || !c.weeks[w] || !c.weeks[w].l[i]) return null;
    var key = lessonKey(lang, w, i); if (net(s, key, "xp") > 0) return null;
    var xp = lessonXp(s, lang, w, i), coin = Math.round(xp * (+s.settings.coinRate || 0)), now = Date.now(), title = c.name + ": " + c.weeks[w].l[i][0];
    s.ledger.push({ k: key, t: "xp", a: xp, at: now, d: "learning", s: c.skill, n: title });
    if (coin) s.ledger.push({ k: key, t: "coin", a: coin, at: now, n: title });
    return { xp: xp, coin: coin, bonus: unitCheck(s, lang, w) };
  }
  function undoLesson(s, lang, w, i) {
    var key = lessonKey(lang, w, i), xp = net(s, key, "xp"), coin = net(s, key, "coin"), now = Date.now(), c = COURSES[lang];
    if (xp <= 0) return null;
    s.ledger.push({ k: key, t: "xp", a: -xp, at: now, d: "learning", s: c.skill, n: "Undo lesson" });
    if (coin > 0) s.ledger.push({ k: key, t: "coin", a: -coin, at: now, n: "Undo lesson" });
    unitCheck(s, lang, w); return { xp: xp };
  }
  function doneToday(s, prefix, d) { // did anything with this key prefix earn XP today?
    var start = new Date(d); start.setHours(0, 0, 0, 0); var a = start.getTime(), b = a + 864e5, keys = {};
    s.ledger.forEach(function (e) { if (e.t === "xp" && e.k.indexOf(prefix) === 0 && e.at >= a && e.at < b) keys[e.k] = 1; });
    return Object.keys(keys).some(function (k) { return net(s, k, "xp") > 0; });
  }

  /* ---------- weekly plan ---------- */
  // Days use JavaScript numbers: 0 Sunday, 1 Monday ... 6 Saturday.
  var PLAN_ITEMS = {
    train: { name: "Training", when: "After work", minutes: 35 },
    igbo: { name: "Igbo", when: "Evening", minutes: 20 },
    japanese: { name: "Japanese", when: "Morning", minutes: 10 }
  };
  function defaultPlan() { return { train: [1, 3, 5], igbo: [1, 2, 4, 5, 6], japanese: [2, 3, 6] }; }
  function planFor(s, d) {
    var wd = new Date(d).getDay(), p = s.plan || defaultPlan();
    return Object.keys(PLAN_ITEMS).filter(function (k) { return (p[k] || []).indexOf(wd) >= 0; });
  }
  function questMinutes(s) {
    return s.quests.filter(function (q) { return q.status === "active" && q.repeat === "daily"; }).reduce(function (a, q) { return a + (+q.min || 0); }, 0);
  }

  var Game = {
    COURSES: COURSES, LINKS: LINKS, UNIT_BONUS: UNIT_BONUS, lessonDone: lessonDone, lessonXp: lessonXp, courseProgress: courseProgress,
    weekProgress: weekProgress, completeLesson: completeLesson, undoLesson: undoLesson, doneToday: doneToday,
    PLAN_ITEMS: PLAN_ITEMS, defaultPlan: defaultPlan, planFor: planFor, questMinutes: questMinutes,
    PROGRAMS: PROGRAMS, WEEK_GOAL: WEEK_GOAL, WEEK_BONUS: WEEK_BONUS, findWorkout: findWorkout, workoutDone: workoutDone, workoutXp: workoutXp,
    setsDone: setsDone, setSets: setSets, weekWorkouts: weekWorkouts, completeWorkout: completeWorkout, undoWorkout: undoWorkout,
    DOMAINS: DOMAINS, DIFFS: DIFFS, uid: uid, dkey: dkey, wkey: wkey, weekStart: weekStart, fresh: fresh, load: load,
    net: net, xpTotal: xpTotal, coins: coins, domainXp: domainXp, skillXp: skillXp, level: level,
    questXp: questXp, periodKey: periodKey, isDone: isDone, complete: complete, undo: undo,
    missionQuests: missionQuests, missionProgress: missionProgress, missionCheck: missionCheck,
    redeem: redeem, unredeem: unredeem, redemptions: redemptions,
    day: day, available: available, featured: featured, toggleFeature: toggleFeature, dayCount: dayCount, achievements: achievements
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Game; else root.Game = Game;
})(this);
