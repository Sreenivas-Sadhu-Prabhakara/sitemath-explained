/*
 * sitemath-explained — the numbers asserted on the page, and the pure functions
 * that derive them. These mirror the live sitemath engine's formulas exactly
 * (see data/engine.js in the sitemath app): area math, band → litres, the
 * pack-fill minimizer, and integer-mm tile math. Nothing is fabricated — the
 * coverage bands are the same manufacturer-cited figures the app ships.
 *
 * Dual export: browser global (window.Facts) + Node tests (module.exports).
 * All money is out of scope here — sitemath is quantities only, never prices.
 */
'use strict';

/* exact definitional constant: 1 ft = 0.3048 m → 1 m² = 10.7639 sq ft */
var SQFT_PER_M2 = 10.7639;

/* half-up rounding to 2 decimals (matches the app's round2) */
function round2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/* gross wall area of a rectangular room: 2 × (L + W) × H */
function wallArea(L, W, H) {
  return round2(2 * (L + W) * H);
}

/* ceiling area = L × W. Door/window deductions NEVER touch this. */
function ceilingArea(L, W) {
  return round2(L * W);
}

/* net paintable WALL area: gross minus each opening area, floored at 0 */
function netWallArea(gross, deductions) {
  var net = gross;
  for (var i = 0; i < deductions.length; i++) net -= deductions[i];
  return round2(Math.max(0, net));
}

/*
 * Convert a TDS coverage band (sq.ft/L, published at an n-coat basis) to
 * m²/L per single coat: one litre paints X sq.ft n times over → X × n sq.ft/L.
 */
function bandToM2PerCoat(bandSqftPerL, coatsBasis) {
  return {
    min: (bandSqftPerL.min * coatsBasis) / SQFT_PER_M2,
    max: (bandSqftPerL.max * coatsBasis) / SQFT_PER_M2
  };
}

/*
 * Litres for `coats` coats over `areaM2`. Worst case (max litres) uses the
 * band MINIMUM coverage; best case (min litres) uses band MAXIMUM coverage.
 */
function litresBand(areaM2, coats, m2PerCoat) {
  var spread = areaM2 * coats;
  return { min: round2(spread / m2PerCoat.max), max: round2(spread / m2PerCoat.min) };
}

/* putty kg for a total-application band in m²/kg (coats baked into the band) */
function puttyKg(areaM2, bandM2PerKg) {
  return { min: round2(areaM2 / bandM2PerKg.max), max: round2(areaM2 / bandM2PerKg.min) };
}

/*
 * Pack-fill minimizer. Round `need` (L or kg) UP to real pack sizes.
 * Ranking: least total volume ≥ need → fewest packs → prefer larger packs.
 * Returns { packSize: count, … } with only non-zero counts. Integer centi-units
 * avoid float drift. Same algorithm as the app's engine.packFill.
 */
function packFill(need, packs) {
  var sizes = packs.slice().sort(function (a, b) { return b - a; });
  var needC = Math.round(need * 100);
  if (needC <= 0) return {};
  var best = null;
  var maxTotal = needC + sizes[0] * 100;

  function better(a, b) {
    if (a.total !== b.total) return a.total < b.total;
    var at = a.counts.reduce(function (s, c) { return s + c; }, 0);
    var bt = b.counts.reduce(function (s, c) { return s + c; }, 0);
    if (at !== bt) return at < bt;
    for (var i = 0; i < sizes.length; i++) {
      if (a.counts[i] !== b.counts[i]) return a.counts[i] > b.counts[i];
    }
    return false;
  }

  (function rec(i, counts, total) {
    if (total >= needC) {
      var cand = { total: total, counts: counts.slice() };
      if (!best || better(cand, best)) best = cand;
      return;
    }
    if (i >= sizes.length) return;
    var sizeC = sizes[i] * 100;
    var maxN = Math.ceil((maxTotal - total) / sizeC);
    for (var n = maxN; n >= 0; n--) {
      counts[i] = n;
      rec(i + 1, counts, total + n * sizeC);
    }
    counts[i] = 0;
  })(0, new Array(sizes.length).fill(0), 0);

  var out = {};
  if (best) sizes.forEach(function (s, i) { if (best.counts[i] > 0) out[s] = best.counts[i]; });
  return out;
}

/* tiles from a direct m² area — integer-mm arithmetic, one single ceil. */
function tileCountFromArea(areaM2, tileLmm, tileWmm, wastagePct) {
  var areaMm2 = Math.round(areaM2 * 1e6);
  var w10 = Math.round(wastagePct * 10);       // tenths of a percent, integer
  return Math.ceil((areaMm2 * (1000 + w10)) / (tileLmm * tileWmm * 1000));
}

/* boxes of N tiles + spares left over */
function boxes(tiles, perBox) {
  var b = Math.ceil(tiles / perBox);
  return { boxes: b, spare: b * perBox - tiles };
}

/* ---------------- the canonical worked example shown on the page ----------------
 * A 4.0 × 3.0 m room, 3.0 m high, one door (0.9 × 2.1 m) and one window
 * (1.2 × 1.2 m), ceiling included. Painted with an economy interior emulsion
 * whose CITED band is 130–150 sq.ft/L at a 2-coat basis (Asian Paints Tractor
 * Emulsion PIS, verified 2026-07-23). Floor tiled in 600 × 600 mm tiles, 5%
 * straight-lay wastage, 4 tiles per box. Every figure below is re-derived by
 * the functions above in test/facts.test.js. */
var ROOM = {
  L: 4.0, W: 3.0, H: 3.0,
  openings: [
    { w: 0.9, h: 2.1 },   // door
    { w: 1.2, h: 1.2 }    // window
  ]
};

/* cited coverage bands — the SAME numbers the app's corpus ships (not invented) */
var TRACTOR_BAND = { min: 130, max: 150 };   // sq.ft/L, 2-coat basis
var TRACTOR_COATS = 2;
var BIRLA_PUTTY = { min: 1.86, max: 2.04 };  // m²/kg, total application

/* pack ladders */
var EMULSION_PACKS = [20, 10, 4, 1];         // litres
var PUTTY_PACKS = [40, 5];                    // kg

/* derived, asserted-on-page facts */
var GROSS_WALL = wallArea(ROOM.L, ROOM.W, ROOM.H);                       // 42.00 m²
var DEDUCTIONS = ROOM.openings.map(function (o) { return round2(o.w * o.h); });
var NET_WALL = netWallArea(GROSS_WALL, [
  ROOM.openings[0].w * ROOM.openings[0].h,
  ROOM.openings[1].w * ROOM.openings[1].h
]);                                                                       // 38.67 m²
var CEILING = ceilingArea(ROOM.L, ROOM.W);                                // 12.00 m²

var TRACTOR_M2_PER_COAT = bandToM2PerCoat(TRACTOR_BAND, TRACTOR_COATS);
var WALL_LITRES = litresBand(NET_WALL, 2, TRACTOR_M2_PER_COAT);           // 2.77–3.20 L
var WALL_BUY = packFill(WALL_LITRES.max, EMULSION_PACKS);                 // { 4: 1 }

var TILE_AREA_M2 = 12.0;                                                   // = L × W floor
var TILE_COUNT = tileCountFromArea(TILE_AREA_M2, 600, 600, 5);            // 35
var TILE_BOXES = boxes(TILE_COUNT, 4);                                     // 9 boxes, 1 spare

var FACTS = {
  grossWall: GROSS_WALL,           // 42.00
  deductions: DEDUCTIONS,          // [1.89, 1.44]
  netWall: NET_WALL,               // 38.67
  ceiling: CEILING,                // 12.00
  wallLitres: WALL_LITRES,         // { min: 2.77, max: 3.20 }
  wallBuy: WALL_BUY,               // { 4: 1 }  (one 4 L tin)
  tileArea: TILE_AREA_M2,          // 12.00
  tileCount: TILE_COUNT,           // 35
  tileBoxes: TILE_BOXES            // { boxes: 9, spare: 1 }
};

var API = {
  SQFT_PER_M2: SQFT_PER_M2,
  round2: round2,
  wallArea: wallArea,
  ceilingArea: ceilingArea,
  netWallArea: netWallArea,
  bandToM2PerCoat: bandToM2PerCoat,
  litresBand: litresBand,
  puttyKg: puttyKg,
  packFill: packFill,
  tileCountFromArea: tileCountFromArea,
  boxes: boxes,
  ROOM: ROOM,
  TRACTOR_BAND: TRACTOR_BAND,
  TRACTOR_COATS: TRACTOR_COATS,
  BIRLA_PUTTY: BIRLA_PUTTY,
  EMULSION_PACKS: EMULSION_PACKS,
  PUTTY_PACKS: PUTTY_PACKS,
  FACTS: FACTS
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
} else {
  globalThis.Facts = API;
}
