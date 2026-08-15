/* ============================================================
   game.js — Color Mixer: match a target swatch by eye with
   hue / saturation / lightness sliders, no numbers until you
   lock in. Five colors per round, later ones muted (the eye
   drifts most on near-neutrals). Scored by CIE76 ΔE in Lab —
   perceptual distance, not slider distance.
   ============================================================ */
(function () {
  'use strict';

  var SLUG = 'colors';
  var ITEMS_PER_ROUND = 5;
  var START = { h: 180, s: 50, l: 50 }; /* every item starts mid-teal */
  var ZERO_AT = 32; /* ΔE where the score hits 0 — "plainly a different color" */

  /* ---- pure scoring math: HSL triples in, 0–100 out; no DOM ----
     Standard pipeline: hsl → sRGB → linear RGB → XYZ (D65) → Lab. */

  /* NaN folds to the low end, never the high one — a broken number must
     not be able to buy a good score anywhere downstream of here. */
  function clamp(v, lo, hi) {
    v = Number(v);
    if (isNaN(v)) return lo;
    return Math.min(hi, Math.max(lo, v));
  }

  /* h 0–360, s/l 0–100 → [r, g, b] each 0–1, still gamma-encoded */
  function hslToRgb(h, s, l) {
    h = Number(h);
    if (!isFinite(h)) h = 0; /* NaN/±Infinity % 360 is NaN, which would poison the channels */
    h = ((h % 360) + 360) % 360;
    s = clamp(s, 0, 100) / 100;
    l = clamp(l, 0, 100) / 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2;
    var r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return [r + m, g + m, b + m];
  }

  /* sRGB gamma decode: linear toe below 0.04045, 2.4 curve above */
  function srgbToLinear(u) {
    return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
  }

  /* linear RGB → XYZ (sRGB primaries, D65, scaled so white Y = 100) */
  function linearRgbToXyz(r, g, b) {
    return [
      (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) * 100,
      (0.2126729 * r + 0.7151522 * g + 0.0721750 * b) * 100,
      (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) * 100
    ];
  }

  /* XYZ → CIE Lab, D65 white point 95.047 / 100 / 108.883 */
  function xyzToLab(x, y, z) {
    var EPS = 216 / 24389, KAPPA = 24389 / 27;
    function f(t) { return t > EPS ? Math.pow(t, 1 / 3) : (KAPPA * t + 16) / 116; }
    var fx = f(x / 95.047), fy = f(y / 100), fz = f(z / 108.883);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  function hslToLab(h, s, l) {
    var rgb = hslToRgb(h, s, l);
    var xyz = linearRgbToXyz(srgbToLinear(rgb[0]), srgbToLinear(rgb[1]), srgbToLinear(rgb[2]));
    return xyzToLab(xyz[0], xyz[1], xyz[2]);
  }

  /* CIE76: plain Euclidean distance in Lab */
  function deltaE76(lab1, lab2) {
    var dL = lab1[0] - lab2[0], da = lab1[1] - lab2[1], db = lab1[2] - lab2[2];
    return Math.sqrt(dL * dL + da * da + db * db);
  }

  /* {h,s,l} pairs in, ΔE out — hue wraparound comes free via Lab */
  function hslDeltaE(a, b) {
    return deltaE76(hslToLab(a.h, a.s, a.l), hslToLab(b.h, b.s, b.l));
  }

  /* ΔE ≤ JND → 100 (a perceptually identical match IS perfect),
     then linear down to 0 at ZERO_AT — continuous, no cliff at the JND */
  var JND = 2; /* CIE76 just-noticeable difference ≈ 2.3; we snap at 2 */
  function itemScore(dE) {
    return 100 * clamp(1 - (dE - JND) / (ZERO_AT - JND), 0, 1);
  }

  /* Which axis carried the miss? Lab triples ([L,a,b]) in, a small
     report out: lightness vs chroma (saturation) vs hue, by comparing
     |ΔL|, |ΔC| and the hue residual in the a/b plane. */
  function missAxis(targetLab, mixLab) {
    var dL = mixLab[0] - targetLab[0];
    var da = mixLab[1] - targetLab[1];
    var db = mixLab[2] - targetLab[2];
    var cT = Math.sqrt(targetLab[1] * targetLab[1] + targetLab[2] * targetLab[2]);
    var cM = Math.sqrt(mixLab[1] * mixLab[1] + mixLab[2] * mixLab[2]);
    var dC = cM - cT;
    var dH = Math.sqrt(Math.max(0, da * da + db * db - dC * dC));
    var aL = Math.abs(dL), aC = Math.abs(dC);
    if (aL >= aC && aL >= dH) {
      return { axis: 'lightness', dir: dL > 0 ? 'lighter' : 'darker', amt: aL };
    }
    if (aC >= dH) {
      return { axis: 'saturation', dir: dC > 0 ? 'more saturated' : 'duller', amt: aC };
    }
    return { axis: 'hue', dir: '', amt: dH };
  }

  function roundScore(scores) {
    var sum = 0, i;
    for (i = 0; i < scores.length; i++) sum += scores[i];
    return scores.length ? sum / scores.length : 0;
  }

  /* ---- end pure scoring math ---- */

  var hint = document.getElementById('hint');
  var toast = document.getElementById('toast');
  var hudRound = document.getElementById('hudRound');
  var hudScore = document.getElementById('hudScore');
  var hudBest = document.getElementById('hudBest');
  var swTarget = document.getElementById('swTarget');
  var swMix = document.getElementById('swMix');
  var valsTarget = document.getElementById('valsTarget');
  var valsMix = document.getElementById('valsMix');
  var closeFill = document.getElementById('closeFill');
  var verdict = document.getElementById('verdict');
  var recapEl = document.getElementById('recap');
  var slH = document.getElementById('slH');
  var slS = document.getElementById('slS');
  var slL = document.getElementById('slL');
  var btnLock = document.getElementById('btnLock');
  var btnNext = document.getElementById('btnNext');
  var btnRound = document.getElementById('btnRound');

  ArtDaily.init({ slug: SLUG });

  /* ---- theme-aware inks (re-read on every repaint) ---- */
  function inks() {
    var cs = getComputedStyle(document.documentElement);
    return {
      good: cs.getPropertyValue('--grade-good').trim() || cs.getPropertyValue('--mint').trim(),
      mid: cs.getPropertyValue('--grade-mid').trim() || cs.getPropertyValue('--sunny').trim(),
      bad: cs.getPropertyValue('--grade-bad').trim() || cs.getPropertyValue('--coral').trim(),
    };
  }

  /* ---- round state ---- */
  var round = 0, itemIdx = 0, itemScores = [], playing = false, locked = false;
  var target = { h: 0, s: 0, l: 0 };
  var mix = { h: START.h, s: START.s, l: START.l };
  var lastResult = null; /* { dE, score } for the currently locked item */
  var roundItems = []; /* { target, mix, score } per locked item, for the recap */

  function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

  /* ramp: vivid mid-range first, then muted, ending near-neutral —
     desaturated targets are far harder to judge by eye */
  function makeTarget(idx) {
    var h = randInt(0, 359);
    if (idx < 2) return { h: h, s: randInt(55, 90), l: randInt(40, 65) };
    if (idx === 2) return { h: h, s: randInt(25, 55), l: randInt(30, 72) };
    if (idx === 3) return { h: h, s: randInt(10, 30), l: randInt(25, 76) };
    return { h: h, s: randInt(3, 15), l: randInt(20, 80) };
  }

  function cssColor(c) { return 'hsl(' + c.h + ', ' + c.s + '%, ' + c.l + '%)'; }
  function tripleText(c) { return '· h ' + c.h + ' s ' + c.s + ' l ' + c.l; }

  function gradeColor(score, c) {
    return score >= 80 ? c.good : score >= 50 ? c.mid : c.bad;
  }

  function phrase(score) {
    if (score >= 90) return 'dead on.';
    if (score >= 70) return 'close — squint at the pair.';
    if (score >= 40) return 'in the neighborhood.';
    return 'way off.';
  }

  /* one teaching sentence from the missAxis report */
  function missText(m) {
    if (m.axis === 'hue') return 'biggest miss: hue — the temperature, not the value.';
    return 'biggest miss: ' + m.axis + ' — yours ' + m.dir + ' by ' + Math.round(m.amt) + '.';
  }

  /* ---- painting: swatches always, reveal gauge only when locked ---- */
  function draw() {
    var c = inks();
    swTarget.style.background = cssColor(target);
    swMix.style.background = cssColor(mix);
    if (locked && lastResult) {
      var col = gradeColor(lastResult.score, c);
      closeFill.style.height = Math.round(lastResult.score) + '%';
      closeFill.style.background = col;
      verdict.style.color = col;
    } else {
      closeFill.style.height = '0%';
      verdict.style.color = '';
    }
  }

  function setSlidersDisabled(off) {
    slH.disabled = off;
    slS.disabled = off;
    slL.disabled = off;
  }

  function nextItem() {
    locked = false;
    lastResult = null;
    target = makeTarget(itemIdx);
    mix = { h: START.h, s: START.s, l: START.l };
    slH.value = String(START.h);
    slS.value = String(START.s);
    slL.value = String(START.l);
    setSlidersDisabled(false);
    valsTarget.textContent = '';
    valsMix.textContent = '';
    verdict.textContent = '';
    btnLock.hidden = false;
    btnNext.hidden = true;
    /* near-neutral targets make the hue slider feel dead — say why */
    hint.textContent = 'color ' + (itemIdx + 1) + ' of ' + ITEMS_PER_ROUND +
      (target.s <= 15
        ? ' — near-neutral: hue barely matters here, nail the value.'
        : ' — slide until your mix melts into the target, then lock it in.');
    draw();
  }

  function newRound() {
    round += 1;
    itemIdx = 0;
    itemScores = [];
    roundItems = [];
    playing = true;
    hudRound.textContent = String(round);
    hudScore.textContent = '–';
    recapEl.hidden = true;
    recapEl.innerHTML = '';
    setRoundBtnLabel(true);
    nextItem();
  }

  /* ---- input → ΔE → score ---- */
  function readSliders() {
    mix = { h: +slH.value, s: +slS.value, l: +slL.value };
  }

  function onSlide() {
    if (!playing || locked) return;
    readSliders();
    draw();
  }
  slH.addEventListener('input', onSlide);
  slS.addEventListener('input', onSlide);
  slL.addEventListener('input', onSlide);

  function lockIn() {
    if (!playing || locked) return;
    readSliders();
    locked = true;
    var tLab = hslToLab(target.h, target.s, target.l);
    var mLab = hslToLab(mix.h, mix.s, mix.l);
    var dE = deltaE76(tLab, mLab);
    var score = itemScore(dE);
    itemScores.push(score);
    roundItems.push({ target: target, mix: mix, score: score });
    lastResult = { dE: dE, score: score };
    setSlidersDisabled(true);
    /* the reveal: both triples, the miss distance, which axis missed, the gauge */
    valsTarget.textContent = tripleText(target);
    valsMix.textContent = tripleText(mix);
    var vt = 'ΔE ' + Math.round(dE) + ' · ' + Math.round(score) + '/100 — ' + phrase(score);
    if (dE > JND) vt += ' ' + missText(missAxis(tLab, mLab));
    verdict.textContent = vt;
    btnLock.hidden = true;
    if (itemIdx + 1 < ITEMS_PER_ROUND) {
      btnNext.hidden = false;
      btnNext.focus();
      hint.textContent = 'locked — study the pair, then take the next color.';
    } else {
      finishRound();
      btnRound.focus();
    }
    draw();
  }
  btnLock.addEventListener('click', lockIn);

  btnNext.addEventListener('click', function () {
    if (!playing || !locked) return;
    itemIdx += 1;
    nextItem();
    slH.focus();
  });

  function finishRound() {
    playing = false;
    var res = ArtDaily.report(roundScore(itemScores));
    hudScore.textContent = String(res.score);
    hudBest.textContent = res.best === null ? '–' : String(res.best);
    hint.textContent = 'round done — “new round” mixes five fresh colors.';
    renderRecap();
    setRoundBtnLabel(false);
    showToast((res.isNewBest ? 'new best! ' : 'round score ') + res.score + ' / 100', res.isNewBest);
  }

  /* round-end recap: the five target-over-mix pairs, side by side */
  function renderRecap() {
    recapEl.innerHTML = '';
    var t = document.createElement('p');
    t.className = 'mix-recap-title';
    t.textContent = 'recap — target on top, your mix underneath';
    recapEl.appendChild(t);
    for (var i = 0; i < roundItems.length; i++) {
      var it = roundItems[i];
      var cell = document.createElement('div');
      cell.className = 'mix-recap-item';
      var pair = document.createElement('div');
      pair.className = 'mix-recap-pair';
      pair.title = 'target ' + tripleText(it.target).slice(2) + ' / mix ' + tripleText(it.mix).slice(2);
      var a = document.createElement('i');
      a.style.background = cssColor(it.target);
      var b = document.createElement('i');
      b.style.background = cssColor(it.mix);
      pair.appendChild(a);
      pair.appendChild(b);
      var sc = document.createElement('span');
      sc.className = 'mix-recap-score';
      sc.textContent = String(Math.round(it.score));
      cell.appendChild(pair);
      cell.appendChild(sc);
      recapEl.appendChild(cell);
    }
    recapEl.hidden = false;
  }

  /* mid-round the button is a restart (it discards the round) — say so */
  function setRoundBtnLabel(inProgress) {
    btnRound.innerHTML = (inProgress ? 'restart round ' : 'new round ') + '<span aria-hidden="true">↻</span>';
  }

  var toastTimer = null;
  function showToast(msg, celebrate) {
    toast.innerHTML = '';
    var s = document.createElement('span');
    s.className = celebrate ? 'toast-accent' : '';
    s.textContent = msg;
    toast.appendChild(s);
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 2200);
  }

  /* ---- chrome wiring ---- */
  btnRound.addEventListener('click', newRound);

  var btnHow = document.getElementById('btnHow');
  var howTo = document.getElementById('howTo');
  btnHow.addEventListener('click', function () {
    howTo.hidden = !howTo.hidden;
    btnHow.setAttribute('aria-expanded', String(!howTo.hidden));
  });

  ArtDaily.onTheme(draw);
  window.addEventListener('resize', draw);

  /* ---- boot ---- */
  var best = ArtDaily.best();
  hudBest.textContent = best === null ? '–' : String(best);
  newRound();
})();
