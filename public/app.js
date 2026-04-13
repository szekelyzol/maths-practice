'use strict';

// ── State ──────────────────────────────────────────────────────────
let settings       = {};
let problems       = [];
let idx            = 0;
let triesLeft      = 2;
let attempts       = 0;
let sessionResults = [];

// Clock interaction state
// phase: null | 'hour-placing' | 'hour-placed' | 'minute-placing' | 'both-placed'
let clockPhase      = null;
let clockPlacedMin  = null;   // placed minute-hand angle in degrees
let clockPlacedHour = null;   // placed hour-hand angle in degrees
let clockDragging    = false;
let clockDragTarget  = null;   // 'minute' | 'hour'
let clockDragPrevDeg = null;   // angle at previous frame

// ── Audio ──────────────────────────────────────────────────────────
let actx = null;

function getCtx() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

function tone(ctx, freq, type, start, dur, vol) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function playSadTrombone() {
  const ctx = getCtx();
  const seq = [[440, .22], [370, .22], [311, .22], [220, .8]];
  let t = ctx.currentTime + 0.05;
  for (const [f, d] of seq) {
    tone(ctx, f, 'sawtooth', t, d, 0.26);
    t += d * 0.88;
  }
}

function playFanfare() {
  const ctx = getCtx();
  const seq = [[262, .1], [330, .1], [392, .1], [523, .12], [523, .5]];
  let t = ctx.currentTime + 0.05;
  for (const [f, d] of seq) {
    tone(ctx, f, 'triangle', t, d + 0.1, 0.36);
    t += d;
  }
}

// ── Confetti ───────────────────────────────────────────────────────
let rafId = null;

function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const palette = ['#90EE90','#FFB3BA','#ADD8E6','#FFD700','#E6CCFF','#FFB347','#FF9999','#B0E0FF'];

  const pieces = Array.from({ length: 150 }, () => ({
    x:     Math.random() * canvas.width,
    y:    -10 - Math.random() * 140,
    vx:   (Math.random() - 0.5) * 7,
    vy:    3 + Math.random() * 5,
    color: palette[Math.random() * palette.length | 0],
    w:     7 + Math.random() * 9,
    h:     4 + Math.random() * 5,
    rot:   Math.random() * 360,
    rs:   (Math.random() - 0.5) * 12,
    rect:  Math.random() < 0.6,
  }));

  if (rafId) cancelAnimationFrame(rafId);

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of pieces) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.13; p.rot += p.rs;
      if (p.y < canvas.height + 20) alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      if (p.rect) ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      else { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (alive) rafId = requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  tick();
}

// ── Helpers ────────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }
function show(id) { el(id).classList.remove('hidden'); }
function hide(id) { el(id).classList.add('hidden'); }
function pad2(n) { return String(n).padStart(2, '0'); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ── Hungarian time text generator ─────────────────────────────────
const HU_HOUR = ['egy','kettő','három','négy','öt','hat','hét','nyolc','kilenc','tíz','tizenegy','tizenkettő'];
const HU_MIN  = {1:'egy',2:'két',3:'három',4:'négy',5:'öt',6:'hat',7:'hét',8:'nyolc',9:'kilenc',10:'tíz',11:'tizenegy',12:'tizenkét',13:'tizenhárom',14:'tizennégy'};
function huH(h) { return HU_HOUR[h - 1]; }
function huM(m) { return HU_MIN[m]; }

function generateTimeText(hour, minute) {
  const nh = hour + 1; // next hour (2–12); hour is 1–11
  let variants;

  if (minute === 0) {
    variants = [`${huH(hour)} óra`, `pontosan ${huH(hour)} óra`, `${huH(hour)} óra van`];
  } else if (minute <= 7) {
    const n = minute;
    variants = [
      `${huH(hour)} óra múlt ${huM(n)} perccel`,
      `${huH(hour)} óra ${huM(n)} perc`,
    ];
  } else if (minute <= 14) {
    const n = 15 - minute;
    variants = [
      `negyed ${huH(nh)} előtt ${huM(n)} perccel`,
      `${huM(n)} perccel negyed ${huH(nh)} előtt`,
      `${huM(n)} perc múlva negyed ${huH(nh)}`,
    ];
  } else if (minute === 15) {
    variants = [`negyed ${huH(nh)}`, `pontosan negyed ${huH(nh)}`];
  } else if (minute <= 22) {
    const n = minute - 15;
    variants = [
      `negyed ${huH(nh)} múlt ${huM(n)} perccel`,
    ];
  } else if (minute <= 29) {
    const n = 30 - minute;
    variants = [
      `fél ${huH(nh)} előtt ${huM(n)} perccel`,
      `${huM(n)} perccel fél ${huH(nh)} előtt`,
      `${huM(n)} perc múlva fél ${huH(nh)}`,
    ];
  } else if (minute === 30) {
    variants = [`fél ${huH(nh)}`, `pontosan fél ${huH(nh)}`];
  } else if (minute <= 37) {
    const n = minute - 30;
    variants = [
      `fél ${huH(nh)} múlt ${huM(n)} perccel`,
    ];
  } else if (minute <= 44) {
    const n = 45 - minute;
    variants = [
      `háromnegyed ${huH(nh)} előtt ${huM(n)} perccel`,
      `${huM(n)} perccel háromnegyed ${huH(nh)} előtt`,
      `${huM(n)} perc múlva háromnegyed ${huH(nh)}`,
    ];
  } else if (minute === 45) {
    variants = [`háromnegyed ${huH(nh)}`, `pontosan háromnegyed ${huH(nh)}`];
  } else if (minute <= 52) {
    const n = minute - 45;
    variants = [
      `háromnegyed ${huH(nh)} múlt ${huM(n)} perccel`,
    ];
  } else {
    const n = 60 - minute;
    variants = [
      `${huM(n)} perc múlva ${huH(nh)} óra`,
      `${huM(n)} perccel ${huH(nh)} előtt`,
      `${huH(nh)} óra előtt ${huM(n)} perccel`,
    ];
  }
  return variants[randInt(0, variants.length - 1)];
}

// ── Problem generation — clock ─────────────────────────────────────
// mode: 'read'  → show hands, user types time
//       'set'   → show digital time, user places hands by dragging
//       'text'  → show Hungarian text, user places hands by dragging
function makeClockProblem(mode) {
  const hour   = randInt(1, 11);
  // For text mode bias toward quarter-zone minutes for richer vocabulary;
  // for read/set use any minute.
  const minute = mode === 'text'
    ? [randInt(0,7), randInt(8,22), randInt(23,37), randInt(38,52), randInt(53,59)][randInt(0,4)]
    : randInt(0, 59);
  const amAnswer = `${hour}:${pad2(minute)}`;
  const pmAnswer = `${hour + 12}:${pad2(minute)}`;
  const type = mode === 'set' ? 'clk-set' : mode === 'text' ? 'clk-text' : 'clk-read';
  return {
    type,
    hour,
    minute,
    amAnswer,
    pmAnswer,
    display:  `🕐 ${amAnswer}`,
    dom:      type,
    textDesc: mode === 'text' ? generateTimeText(hour, minute) : null,
  };
}

// ── Problem generation — math ──────────────────────────────────────
function numForPos(pos, ops) {
  const prev = pos > 0          ? ops[pos - 1] : null;
  const next = pos < ops.length ? ops[pos]     : null;
  if (prev === '*' || next === '*') return randInt(0, settings.timesTableMax);
  return randInt(settings.minNumber, settings.maxNumber);
}

// Division is always a clean 2-clause problem.
// Remainder is allowed (0 ≤ remainder < divisor); quotient is always a whole number.
function makeDivisionProblem() {
  const divisor   = randInt(1, Math.max(1, settings.timesTableMax));
  const quotient  = randInt(0, settings.timesTableMax);
  const remainder = randInt(0, divisor - 1);   // 0 when divisor=1
  const dividend  = divisor * quotient + remainder;
  const display     = `${dividend} ÷ ${divisor}`;
  const displayHtml = `${dividend} <span class="op-sign op-div">÷</span> ${divisor}`;
  const correctStr  = remainder > 0 ? `${quotient} (m. ${remainder})` : `${quotient}`;
  return { type: 'math', display, displayHtml, answer: quotient, remainder, correctStr, dom: 'div' };
}

function tryOneMathProblem(mathOps) {
  const mc = settings.maxClauses;
  const nc = mc === 2 ? 2 : (Math.random() < 0.5 ? 2 : 3);
  const no = nc - 1;

  const ops  = Array.from({ length: no }, () =>
    mathOps[randInt(0, mathOps.length - 1)]
  );

  // If division landed in this problem, hand off to the clean division generator
  if (ops.includes('/')) return makeDivisionProblem();

  const nums = Array.from({ length: nc }, (_, i) => numForPos(i, ops));

  // Plain text display — used in summary / history tables
  let display = String(nums[0]);
  for (let i = 0; i < no; i++) {
    const sym = ops[i] === '*' ? '×' : ops[i];
    display += ` ${sym} ${nums[i + 1]}`;
  }

  // HTML display — each operator sign gets its own colour span
  const opClass = { '+': 'op-add', '-': 'op-sub', '*': 'op-mul' };
  let displayHtml = nums[0].toString();
  for (let i = 0; i < no; i++) {
    const sym = ops[i] === '*' ? '×' : ops[i];
    displayHtml += ` <span class="op-sign ${opClass[ops[i]]}">${sym}</span> ${nums[i + 1]}`;
  }

  let evalStr = String(nums[0]);
  for (let i = 0; i < no; i++) evalStr += ` ${ops[i]} ${nums[i + 1]}`;

  // eslint-disable-next-line no-new-func
  const answer = Function(`'use strict'; return (${evalStr})`)();

  const unique = [...new Set(ops)];
  let dom = 'mix';
  if (unique.length === 1) {
    dom = ops[0] === '+' ? 'add' : ops[0] === '-' ? 'sub' : 'mul';
  }

  return { type: 'math', display, displayHtml, answer, dom };
}

function makeMathProblem(mathOps) {
  // Retry until both constraints are satisfied; cap at 50 attempts.
  for (let i = 0; i < 50; i++) {
    const p = tryOneMathProblem(mathOps);
    if (!settings.allowNegative && p.answer < 0) continue;
    if (p.answer > settings.maxResult) continue;
    return p;
  }
  return tryOneMathProblem(mathOps);
}

function makeRelationProblem(mathOps) {
  // Left side: use checked math ops; if only division, use clean division only
  const nonDivOps   = mathOps.filter(o => o !== '/');
  const hasDivision = mathOps.includes('/');
  const useDivision = hasDivision && (nonDivOps.length === 0 || Math.random() < 0.25);

  let leftDisplay, leftHtml, leftAnswer;

  if (useDivision) {
    const divisor  = randInt(1, Math.max(1, settings.timesTableMax));
    const quotient = randInt(1, settings.timesTableMax);
    leftAnswer  = quotient;
    leftDisplay = `${divisor * quotient} ÷ ${divisor}`;
    leftHtml    = `${divisor * quotient} <span class="op-sign op-div">÷</span> ${divisor}`;
  } else {
    const safeOps = nonDivOps.length > 0 ? nonDivOps : ['+', '-'];
    const p = makeMathProblem(safeOps);
    leftAnswer  = p.answer;
    leftDisplay = p.display;
    leftHtml    = p.displayHtml;
  }

  // Right side: balanced 1/3 each for <, =, >
  let outcome, rightNumber;
  for (let i = 0; i < 20; i++) {
    outcome = ['<', '=', '>'][randInt(0, 2)];
    if (outcome === '=') {
      rightNumber = leftAnswer;
    } else {
      const maxDelta = Math.max(2, Math.min(10, Math.ceil(Math.abs(leftAnswer) * 0.3) + 1));
      const delta    = randInt(1, maxDelta);
      rightNumber = outcome === '<' ? leftAnswer + delta : leftAnswer - delta;
    }
    if (settings.allowNegative || rightNumber >= 0) break;
  }
  if (!settings.allowNegative && rightNumber < 0) { outcome = '='; rightNumber = leftAnswer; }

  return {
    type:        'rel',
    dom:         'rel',
    display:     `${leftDisplay} ? ${rightNumber}`,
    displayHtml: leftHtml,
    leftAnswer,
    rightNumber,
    relation:    outcome,
    correctStr:  `${leftDisplay} ${outcome} ${rightNumber}`,
  };
}

function makeProblem() {
  const mathOps    = settings.operations.filter(o => !o.startsWith('clk-') && o !== 'rel');
  const hasClkRead = settings.operations.includes('clk-read');
  const hasClkSet  = settings.operations.includes('clk-set');
  const hasClkText = settings.operations.includes('clk-text');
  const hasRel     = settings.operations.includes('rel');
  const hasMath    = mathOps.length > 0;

  const pool = [];
  if (hasMath)    pool.push('math');
  if (hasClkRead) pool.push('clk-read');
  if (hasClkSet)  pool.push('clk-set');
  if (hasClkText) pool.push('clk-text');
  if (hasRel)     pool.push('rel');

  const pick = pool[randInt(0, pool.length - 1)];
  if (pick === 'clk-read') return makeClockProblem('read');
  if (pick === 'clk-set')  return makeClockProblem('set');
  if (pick === 'clk-text') return makeClockProblem('text');
  if (pick === 'rel')      return makeRelationProblem(mathOps);
  return makeMathProblem(mathOps);
}

function generateProblems() {
  problems = Array.from({ length: settings.numProblems }, makeProblem);
}

// ── View routing ───────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  el(`view-${name}`).classList.add('active');
}

// ── Settings persistence ───────────────────────────────────────────
function saveSettings() {
  localStorage.setItem('mathSettings', JSON.stringify({
    minNumber:     settings.minNumber,
    maxNumber:     settings.maxNumber,
    maxResult:     settings.maxResult,
    timesTableMax: settings.timesTableMax,
    numProblems:   settings.numProblems,
    operations:    settings.operations,
    maxClauses:    settings.maxClauses,
    allowNegative: settings.allowNegative,
  }));
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('mathSettings') || 'null');
    if (!s) return;
    if (s.minNumber     !== undefined) el('min-number').value = s.minNumber;
    if (s.maxNumber     !== undefined) el('max-number').value = s.maxNumber;
    if (s.maxResult     !== undefined) el('max-result').value = s.maxResult;
    if (s.timesTableMax !== undefined) el('times-table-max').value = s.timesTableMax;
    if (s.numProblems   !== undefined) el('num-problems').value = s.numProblems;
    if (s.operations) {
      el('op-add').checked      = s.operations.includes('+');
      el('op-sub').checked      = s.operations.includes('-');
      el('op-mul').checked      = s.operations.includes('*');
      el('op-div').checked      = s.operations.includes('/');
      el('op-clk-read').checked  = s.operations.includes('clk-read');
      el('op-clk-set').checked   = s.operations.includes('clk-set');
      el('op-clk-text').checked  = s.operations.includes('clk-text');
      el('op-rel').checked       = s.operations.includes('rel');
      // migrate legacy 'clock' setting
      if (s.operations.includes('clock')) {
        el('op-clk-read').checked = true;
        el('op-clk-set').checked  = true;
      }
    }
    if (s.maxClauses) {
      const radio = document.querySelector(`input[name="max-clauses"][value="${s.maxClauses}"]`);
      if (radio) radio.checked = true;
    }
    if (s.allowNegative !== undefined) el('allow-negative').checked = s.allowNegative;
    syncToggleOpacity();
  } catch (_) {}
}

// ── Setup ──────────────────────────────────────────────────────────
function syncToggleOpacity() {
  document.querySelectorAll('.op-toggle').forEach(label => {
    const cb = label.querySelector('input[type="checkbox"]');
    label.classList.toggle('unchecked', !cb.checked);
  });
}

function startSession() {
  const ops = [];
  if (el('op-add').checked) ops.push('+');
  if (el('op-sub').checked) ops.push('-');
  if (el('op-mul').checked) ops.push('*');
  if (el('op-div').checked)      ops.push('/');
  if (el('op-clk-read').checked) ops.push('clk-read');
  if (el('op-clk-set').checked)  ops.push('clk-set');
  if (el('op-clk-text').checked) ops.push('clk-text');
  if (el('op-rel').checked)      ops.push('rel');

  if (!ops.length) { alert('Válassz legalább egy műveletet!'); return; }

  const rawMin = parseInt(el('min-number').value,      10);
  const rawMax = parseInt(el('max-number').value,      10);
  const rawRes = parseInt(el('max-result').value,      10);
  const rawTT  = parseInt(el('times-table-max').value, 10);
  const rawN   = parseInt(el('num-problems').value,    10);
  const rawMC  = parseInt(document.querySelector('input[name="max-clauses"]:checked').value, 10);

  settings = {
    minNumber:     Math.max(0,   isNaN(rawMin) ? 0   : rawMin),
    maxNumber:     Math.max(1,   isNaN(rawMax) ? 70  : rawMax),
    maxResult:     Math.max(1,   isNaN(rawRes) ? 100 : rawRes),
    timesTableMax: Math.max(1,   isNaN(rawTT)  ? 10  : rawTT),
    numProblems:   Math.min(100, Math.max(1, isNaN(rawN) ? 10 : rawN)),
    operations:    ops,
    maxClauses:    rawMC || 2,
    allowNegative: el('allow-negative').checked,
  };

  if (settings.minNumber > settings.maxNumber)
    [settings.minNumber, settings.maxNumber] = [settings.maxNumber, settings.minNumber];

  saveSettings();
  generateProblems();
  idx            = 0;
  sessionResults = [];
  showView('practice');
  showProblem();
}

// ── Render SVG clock ───────────────────────────────────────────────
// placedMinDeg / placedHourDeg: visual angles in degrees (null = don't draw)
function renderClock(placedMinDeg, placedHourDeg) {
  const R = 100;

  function toRad(deg) { return (deg - 90) * Math.PI / 180; }
  function pt(deg, r) {
    const rad = toRad(deg);
    return [+(Math.cos(rad) * r).toFixed(2), +(Math.sin(rad) * r).toFixed(2)];
  }

  // 60 tick marks
  let ticks = '';
  for (let i = 0; i < 60; i++) {
    const isHour = i % 5 === 0;
    const [x1, y1] = pt(i * 6, isHour ? R - 14 : R - 7);
    const [x2, y2] = pt(i * 6, R);
    ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" `
           + `stroke="${isHour ? '#999' : '#D8D8D8'}" `
           + `stroke-width="${isHour ? 2.5 : 1.2}" stroke-linecap="round"/>`;
  }

  // Hour numbers 1–12
  let nums = '';
  for (let i = 1; i <= 12; i++) {
    const [nx, ny] = pt(i * 30, R - 25);
    nums += `<text x="${nx}" y="${ny}" `
          + `text-anchor="middle" dominant-baseline="central" `
          + `font-size="13" font-weight="700" fill="#444" `
          + `font-family="system-ui,sans-serif">${i}</text>`;
  }

  let hands = '';
  if (placedMinDeg !== null) {
    const [mx, my]   = pt(placedMinDeg, 82);
    const [mbx, mby] = pt(placedMinDeg + 180, 18);
    hands += `<line x1="${mbx}" y1="${mby}" x2="${mx}" y2="${my}"
          stroke="#555" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (placedHourDeg !== null) {
    const [hx, hy]   = pt(placedHourDeg, 60);
    const [hbx, hby] = pt(placedHourDeg + 180, 16);
    hands += `<line x1="${hbx}" y1="${hby}" x2="${hx}" y2="${hy}"
          stroke="#2C2C2C" stroke-width="7" stroke-linecap="round"/>`;
  }

  el('clock-svg').innerHTML = `
    <circle r="${R}" fill="white" stroke="#D4D4D4" stroke-width="2.5"/>
    ${ticks}
    ${nums}
    ${hands}
    <circle r="7"   fill="#2C2C2C"/>
    <circle r="3.5" fill="white"/>
  `;
}

// ── Clock interaction helpers ──────────────────────────────────────
function svgClickAngle(event) {
  const svg  = el('clock-svg');
  const rect = svg.getBoundingClientRect();
  const cx   = rect.left + rect.width  / 2;
  const cy   = rect.top  + rect.height / 2;
  let deg = Math.atan2(event.clientX - cx, -(event.clientY - cy)) * 180 / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

function angleDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// ── Show problem ───────────────────────────────────────────────────
function showProblem() {
  const p   = problems[idx];
  triesLeft = 2;
  attempts  = 0;

  const isClock = p.type.startsWith('clk-');
  const cardSuffix = isClock ? ' op-clk'
    : p.type === 'rel'  ? ' op-rel'
    : p.type === 'math' ? ` op-${p.dom}`
    : '';
  el('problem-card').className = `card problem-card${cardSuffix}`;
  el('prog-fill').style.width  = (idx / problems.length * 100) + '%';
  el('prog-label').textContent = `${idx + 1} / ${problems.length}`;
  el('feedback-msg').textContent = '';
  refreshDots();

  if (p.type === 'clk-read') {
    show('clock-mode');
    show('clock-answer');
    hide('clock-text-desc');
    hide('clock-step-hint');

    hide('clock-actions');
    hide('math-mode');
    hide('math-answer');
    hide('rel-mode');
    hide('rel-answer');

    clockPhase = null;
    el('clock-svg').classList.remove('interactive');
    el('clock-prompt').textContent = 'Mit mutat az óra?';
    renderClock(p.minute * 6, (p.hour % 12) * 30 + p.minute * 0.5);

    clearSplitTime('am-h', 'am-m');
    clearSplitTime('pm-h', 'pm-m');
    disableSplitTime('am-h', 'am-m', false);
    disableSplitTime('pm-h', 'pm-m', false);
    el('clock-check-btn').disabled = false;
    el('am-h').focus();

  } else if (p.type === 'clk-set' || p.type === 'clk-text') {
    show('clock-mode');
    show('clock-step-hint');
    hide('clock-answer');

    hide('clock-actions');
    hide('math-mode');
    hide('math-answer');
    hide('rel-mode');
    hide('rel-answer');

    if (p.type === 'clk-text') {
      show('clock-text-desc');
      hide('clock-prompt');
      el('clock-text-desc').textContent = p.textDesc;
    } else {
      hide('clock-text-desc');
      show('clock-prompt');
      el('clock-prompt').textContent = `Állítsd be: ${p.amAnswer} / ${p.pmAnswer}`;
    }

    // Pre-place both hands at 13:00 (hour hand at 30°, minute hand at 0°)
    clockPlacedHour = 30;
    clockPlacedMin  = 0;
    clockDragging   = false;
    clockDragTarget = null;
    clockPhase      = 'active';
    el('clock-svg').classList.add('interactive');
    renderClock(clockPlacedMin, clockPlacedHour);
    show('clock-actions');
    hide('clock-next-btn');
    show('clock-confirm-btn');
    el('clock-step-hint').textContent = 'Húzd a mutatókat a megfelelő helyre!';

  } else if (p.type === 'rel') {
    show('rel-mode');
    show('rel-answer');
    hide('math-mode');
    hide('math-answer');
    hide('clock-mode');
    hide('clock-answer');

    el('rel-expr').innerHTML      = p.displayHtml;
    el('rel-right').textContent   = p.rightNumber;
    el('rel-btn-lt').disabled     = false;
    el('rel-btn-eq').disabled     = false;
    el('rel-btn-gt').disabled     = false;

  } else {
    show('math-mode');
    show('math-answer');
    hide('clock-mode');
    hide('clock-answer');
    hide('rel-mode');
    hide('rel-answer');

    el('problem-expr').innerHTML = p.displayHtml;
    el('answer-input').value    = '';
    el('answer-input').disabled = false;
    el('check-btn').disabled    = false;

    if (p.dom === 'div') {
      show('remainder-group');
      el('remainder-input').value    = '';
      el('remainder-input').disabled = false;
    } else {
      hide('remainder-group');
    }

    el('answer-input').focus();
  }
}

function refreshDots() {
  for (let i = 0; i < 2; i++) {
    el(`dot-${i}`).className = 'try-dot ' + (i < triesLeft ? 'on' : 'off');
  }
}

// ── Answer checking — math ─────────────────────────────────────────
function checkAnswer() {
  const p = problems[idx];

  const input   = el('answer-input');
  const val     = input.value.trim();
  if (!val) return;

  const userAns = parseInt(val, 10);
  if (isNaN(userAns)) { el('feedback-msg').textContent = 'Egész számot adj meg!'; return; }

  // ── Division with optional remainder ────────────────────────────
  if (p.dom === 'div') {
    const remStr = el('remainder-input').value.trim();

    // If there is a remainder but the field is empty, nudge without consuming a try
    if (p.remainder > 0 && remStr === '') {
      el('feedback-msg').textContent = 'Add meg a maradékot is!';
      el('remainder-input').focus();
      return;
    }

    const userRem = remStr === '' ? 0 : parseInt(remStr, 10);
    if (remStr !== '' && isNaN(userRem)) {
      el('feedback-msg').textContent = 'Egész számot adj meg!';
      return;
    }

    attempts++;

    const quotientOk  = userAns === p.answer;
    // Empty remainder field is accepted when the problem has no remainder
    const remainderOk = p.remainder === 0
      ? (remStr === '' || userRem === 0)
      : userRem === p.remainder;

    if (quotientOk && remainderOk) {
      const userStr = p.remainder > 0 ? `${userAns} (m. ${userRem})` : `${userAns}`;
      el('feedback-msg').textContent    = 'Helyes! 🎉';
      input.disabled                    = true;
      el('remainder-input').disabled    = true;
      el('check-btn').disabled          = true;
      playFanfare();
      launchConfetti();
      sessionResults.push({ problem: p, userAns: userStr, attempts, correct: true });
      setTimeout(nextProblem, 1800);
    } else {
      triesLeft--;
      refreshDots();
      playSadTrombone();
      shakeCard();

      if (triesLeft === 0) {
        el('feedback-msg').textContent = `A helyes válasz: ${p.correctStr}. Tovább!`;
        input.disabled                  = true;
        el('remainder-input').disabled  = true;
        el('check-btn').disabled        = true;
        const userStr = p.remainder > 0 ? `${userAns} (m. ${userRem})` : `${userAns}`;
        sessionResults.push({ problem: p, userAns: userStr, attempts, correct: false });
          setTimeout(nextProblem, 2600);
      } else {
        let msg;
        if (!quotientOk && !remainderOk) {
          msg = 'A hányados és a maradék is helytelen.';
          input.value                    = '';
          el('remainder-input').value    = '';
          input.focus();
        } else if (!quotientOk) {
          msg = 'A hányados helytelen.';
          input.value = '';
          input.focus();
        } else {
          msg = 'A maradék helytelen.';
          el('remainder-input').value = '';
          el('remainder-input').focus();
        }
        el('feedback-msg').textContent = `${msg} Még ${triesLeft} próba.`;
      }
    }
    return;
  }

  // ── Regular math (non-division) ─────────────────────────────────
  attempts++;

  if (userAns === p.answer) {
    el('feedback-msg').textContent = 'Helyes! 🎉';
    input.disabled = true;
    el('check-btn').disabled = true;
    playFanfare();
    launchConfetti();
    sessionResults.push({ problem: p, userAns: String(userAns), attempts, correct: true });
    setTimeout(nextProblem, 1800);
  } else {
    triesLeft--;
    refreshDots();
    playSadTrombone();
    shakeCard();
    if (triesLeft === 0) {
      el('feedback-msg').textContent = `A helyes válasz: ${p.answer}. Tovább!`;
      input.disabled = true;
      el('check-btn').disabled = true;
      sessionResults.push({ problem: p, userAns: String(userAns), attempts, correct: false });
      setTimeout(nextProblem, 2600);
    } else {
      el('feedback-msg').textContent = `Nem sikerült — még ${triesLeft} próba.`;
      input.value = '';
      input.focus();
    }
  }
}

// ── Answer checking — clock read (type the time) ──────────────────
function readSplitTime(hId, mId) {
  const hVal = el(hId).value.trim();
  const mVal = el(mId).value.trim();
  if (hVal === '' || mVal === '') return null;
  const h   = parseInt(hVal, 10);
  const min = parseInt(mVal, 10);
  if (isNaN(h) || isNaN(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, min };
}

function clearSplitTime(hId, mId) {
  el(hId).value = '';
  el(mId).value = '';
}

function disableSplitTime(hId, mId, disabled) {
  el(hId).disabled = disabled;
  el(mId).disabled = disabled;
}

function checkClockAnswer() {
  const p = problems[idx];

  const am = readSplitTime('am-h', 'am-m');
  const pm = readSplitTime('pm-h', 'pm-m');

  if (!am && !pm) return;
  if (!am || !pm) {
    el('feedback-msg').textContent = 'Töltsd ki mindkét időpontot!';
    return;
  }

  const amOk = am.h === p.hour      && am.min === p.minute;
  const pmOk = pm.h === p.hour + 12 && pm.min === p.minute;

  const amStr = `${am.h}:${String(am.min).padStart(2,'0')}`;
  const pmStr = `${pm.h}:${String(pm.min).padStart(2,'0')}`;

  attempts++;

  if (amOk && pmOk) {
    el('feedback-msg').textContent = 'Helyes! 🎉';
    disableSplitTime('am-h', 'am-m', true);
    disableSplitTime('pm-h', 'pm-m', true);
    el('clock-check-btn').disabled = true;
    playFanfare();
    launchConfetti();
    sessionResults.push({ problem: p, userAns: `${amStr} / ${pmStr}`, attempts, correct: true });
    setTimeout(nextProblem, 1800);
  } else {
    triesLeft--;
    refreshDots();
    playSadTrombone();
    shakeCard();

    if (triesLeft === 0) {
      el('feedback-msg').textContent =
        `A helyes időpont: ${p.amAnswer} és ${p.pmAnswer}.`;
      disableSplitTime('am-h', 'am-m', true);
      disableSplitTime('pm-h', 'pm-m', true);
      el('clock-check-btn').disabled = true;
      sessionResults.push({ problem: p, userAns: `${amStr} / ${pmStr}`, attempts, correct: false });
      setTimeout(nextProblem, 2600);
    } else {
      let msg = '';
      if (!amOk && !pmOk) {
        msg = 'Mindkettő helytelen.';
        clearSplitTime('am-h', 'am-m');
        clearSplitTime('pm-h', 'pm-m');
        el('am-h').focus();
      } else if (!amOk) {
        msg = 'A délelőtti idő helytelen.';
        clearSplitTime('am-h', 'am-m');
        el('am-h').focus();
      } else {
        msg = 'A délutáni idő helytelen.';
        clearSplitTime('pm-h', 'pm-m');
        el('pm-h').focus();
      }
      el('feedback-msg').textContent = `${msg} Még ${triesLeft} próba.`;
    }
  }
}

// ── Answer checking — relation ────────────────────────────────────
function checkRelationAnswer(userRel) {
  const p = problems[idx];
  attempts++;

  if (userRel === p.relation) {
    el('feedback-msg').textContent = 'Helyes! 🎉';
    el('rel-btn-lt').disabled = true;
    el('rel-btn-eq').disabled = true;
    el('rel-btn-gt').disabled = true;
    playFanfare();
    launchConfetti();
    sessionResults.push({ problem: p, userAns: userRel, attempts, correct: true });
    setTimeout(nextProblem, 1800);
  } else {
    triesLeft--;
    refreshDots();
    playSadTrombone();
    shakeCard();

    if (triesLeft === 0) {
      el('feedback-msg').textContent = `A helyes jel: ${p.relation}. Tovább!`;
      el('rel-btn-lt').disabled = true;
      el('rel-btn-eq').disabled = true;
      el('rel-btn-gt').disabled = true;
      sessionResults.push({ problem: p, userAns: userRel, attempts, correct: false });
      setTimeout(nextProblem, 2600);
    } else {
      el('feedback-msg').textContent = `Nem ez! Még ${triesLeft} próba.`;
      // Disable the wrong button so the user can't repeat it
      const btnId = userRel === '<' ? 'rel-btn-lt' : userRel === '=' ? 'rel-btn-eq' : 'rel-btn-gt';
      el(btnId).disabled = true;
    }
  }
}

// ── Clock drag interaction (clk-set / clk-text) ───────────────────
// Angular threshold (degrees) within which a click "grabs" a placed hand
const HAND_GRAB_DEG = 20;


function startDrag(target) {
  clockDragging    = true;
  clockDragTarget  = target;
  clockDragPrevDeg = null;
  document.addEventListener('mousemove', onClockDragMove);
  document.addEventListener('mouseup',  onClockDragEnd);
}

function onClockMousedown(event) {
  if (clockPhase !== 'active') return;
  const p = problems[idx];
  if (!p || (p.type !== 'clk-set' && p.type !== 'clk-text')) return;

  event.preventDefault();

  const deg = svgClickAngle(event);

  const nearMin  = angleDiff(deg, clockPlacedMin)  <= HAND_GRAB_DEG;
  const nearHour = angleDiff(deg, clockPlacedHour) <= HAND_GRAB_DEG;

  if (nearMin) {
    startDrag('minute');  // minute takes priority when arms overlap
  } else if (nearHour) {
    startDrag('hour');
  }
}

function onClockDragMove(event) {
  if (!clockDragging) return;
  const deg = svgClickAngle(event);

  if (clockDragPrevDeg === null) {
    clockDragPrevDeg = deg;
    return;
  }

  // Shortest-path delta between frames — handles 0°/360° wrap cleanly
  let delta = deg - clockDragPrevDeg;
  if (delta >  180) delta -= 360;
  if (delta < -180) delta += 360;
  clockDragPrevDeg = deg;

  if (clockDragTarget === 'minute') {
    clockPlacedMin  = (clockPlacedMin  + delta      + 360) % 360;
    clockPlacedHour = (clockPlacedHour + delta / 12 + 360) % 360;
  } else {
    clockPlacedHour = (clockPlacedHour + delta       + 360) % 360;
    clockPlacedMin  = (clockPlacedMin  + delta * 12  + 360) % 360;
  }
  renderClock(clockPlacedMin, clockPlacedHour);
}

function onClockDragEnd() {
  clockDragging   = false;
  clockDragTarget = null;
  document.removeEventListener('mousemove', onClockDragMove);
  document.removeEventListener('mouseup',  onClockDragEnd);
}


function onClockNextBtn() { /* no-op: Következő button is hidden in new flow */ }

function checkClockHandsAnswer() {
  const p = problems[idx];
  if (!p) return;

  const correctMinDeg  = p.minute * 6;
  const correctHourDeg = (p.hour % 12) * 30 + p.minute * 0.5;

  const minOk  = angleDiff(clockPlacedMin,  correctMinDeg)  <= 5;
  const hourOk = angleDiff(clockPlacedHour, correctHourDeg) <= 10;

  attempts++;

  if (minOk && hourOk) {
    clockPhase = null;
    el('clock-svg').classList.remove('interactive');
    hide('clock-step-hint');
    hide('clock-actions');
    el('feedback-msg').textContent = 'Helyes! 🎉';
    playFanfare();
    launchConfetti();
    const userStr = `${p.amAnswer} / ${p.pmAnswer}`;
    sessionResults.push({ problem: p, userAns: userStr, attempts, correct: true });
    setTimeout(nextProblem, 1800);
  } else {
    triesLeft--;
    refreshDots();
    playSadTrombone();
    shakeCard();

    if (triesLeft === 0) {
      clockPhase = null;
      el('clock-svg').classList.remove('interactive');
      hide('clock-step-hint');
      hide('clock-actions');
      el('feedback-msg').textContent = `A helyes időpont: ${p.amAnswer} / ${p.pmAnswer}.`;
      renderClock(correctMinDeg, correctHourDeg);
      sessionResults.push({ problem: p, userAns: '–', attempts, correct: false });
      setTimeout(nextProblem, 3000);
    } else {
      let msg = '';
      if (!minOk && !hourOk) msg = 'Mindkét mutató helytelen.';
      else if (!hourOk)      msg = 'Az óramutató helytelen.';
      else                   msg = 'A percmutató helytelen.';
      el('feedback-msg').textContent = `${msg} Még ${triesLeft} próba.`;

      // Reset to hour-placing
      // Reset both hands to default 13:00 position
      clockPlacedHour = 30;
      clockPlacedMin  = 0;
      renderClock(clockPlacedMin, clockPlacedHour);
    }
  }
}

// ── Shared helpers ─────────────────────────────────────────────────
function shakeCard() {
  const card = el('problem-card');
  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
  card.addEventListener('animationend', () => card.classList.remove('shake'), { once: true });
}

function nextProblem() {
  idx++;
  if (idx >= problems.length) showSummary();
  else showProblem();
}

// ── Summary ────────────────────────────────────────────────────────
function showSummary() {
  const correct = sessionResults.filter(r => r.correct).length;
  const wrong   = sessionResults.length - correct;
  const perfect = correct === sessionResults.length;

  el('summary-title').textContent = perfect ? 'Tökéletes kör! 🏆' : 'Kör vége!';

  el('summary-boxes').innerHTML = `
    <div class="s-box correct"><div class="s-num">${correct}</div><div class="s-lbl">Helyes</div></div>
    <div class="s-box wrong"><div class="s-num">${wrong}</div><div class="s-lbl">Hibás</div></div>
  `;

  const rows = sessionResults.map(r => {
    const correctAns = r.problem.correctStr ?? String(r.problem.answer);
    const isClock = r.problem.type.startsWith('clk-');
    const isRel   = r.problem.type === 'rel';
    const prob = isClock
      ? (r.problem.type === 'clk-text'
          ? `🕐 ${r.problem.textDesc} (${r.problem.amAnswer})`
          : `🕐 ${r.problem.amAnswer} / ${r.problem.pmAnswer}`)
      : isRel
      ? r.problem.correctStr
      : `${r.problem.display} = ${correctAns}`;
    return `
      <tr>
        <td class="op-${r.problem.dom}">${prob}</td>
        <td>${r.userAns}</td>
        <td>${r.attempts}</td>
        <td class="${r.correct ? 'r-ok' : 'r-fail'}">${r.correct ? '✓' : '✗'}</td>
      </tr>`;
  }).join('');

  el('summary-table-wrap').innerHTML = `
    <table>
      <thead><tr><th>Feladat</th><th>A te válaszod</th><th>Próbák</th><th>Eredmény</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  showView('summary');
  if (perfect) launchConfetti();
}

// ── Boot ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  el('start-btn').addEventListener('click', startSession);
  el('exit-btn').addEventListener('click', () => showView('setup'));
  el('check-btn').addEventListener('click', checkAnswer);
  el('clock-check-btn').addEventListener('click', checkClockAnswer);
  el('new-session-btn').addEventListener('click', () => showView('setup'));

  // Enter key shortcuts (math)
  el('answer-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const remGroup = el('remainder-group');
      if (!remGroup.classList.contains('hidden') && !el('remainder-input').value.trim()) {
        el('remainder-input').focus();
      } else {
        checkAnswer();
      }
    }
  });
  el('remainder-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') checkAnswer();
  });

  // Clock read: auto-advance + Enter key
  el('am-h').addEventListener('input', () => {
    if (el('am-h').value.length >= 2) el('am-m').focus();
  });
  el('am-m').addEventListener('input', () => {
    if (el('am-m').value.length >= 2) el('pm-h').focus();
  });
  el('pm-h').addEventListener('input', () => {
    if (el('pm-h').value.length >= 2) el('pm-m').focus();
  });
  el('pm-m').addEventListener('input', () => {
    if (el('pm-m').value.length >= 2) checkClockAnswer();
  });
  ['am-h','am-m','pm-h','pm-m'].forEach(id => {
    el(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') checkClockAnswer();
    });
  });

  // Relation buttons
  el('rel-btn-lt').addEventListener('click', () => checkRelationAnswer('<'));
  el('rel-btn-eq').addEventListener('click', () => checkRelationAnswer('='));
  el('rel-btn-gt').addEventListener('click', () => checkRelationAnswer('>'));

  // Clock drag interaction (set / text modes)
  el('clock-svg').addEventListener('mousedown', onClockMousedown);

  // Clock action buttons
  el('clock-next-btn').addEventListener('click', onClockNextBtn);
  el('clock-confirm-btn').addEventListener('click', checkClockHandsAnswer);

  document.querySelectorAll('.op-toggle input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', syncToggleOpacity);
  });
  syncToggleOpacity();
});
