'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../data/facts.js');

/* ---- area math: gross wall, deductions, net wall, ceiling ---- */
test('gross wall = 2 × (L + W) × H', () => {
  assert.equal(F.wallArea(4.0, 3.0, 3.0), 42.00);      // 2×7×3
  assert.equal(F.FACTS.grossWall, 42.00);
});

test('opening deductions subtract from WALL only, never the ceiling', () => {
  // door 0.9×2.1 = 1.89, window 1.2×1.2 = 1.44, sum = 3.33
  assert.deepEqual(F.FACTS.deductions, [1.89, 1.44]);
  assert.equal(F.FACTS.netWall, F.round2(42.00 - 3.33));  // 38.67
  assert.equal(F.FACTS.netWall, 38.67);
  // ceiling is L×W and is unaffected by the openings
  assert.equal(F.ceilingArea(4.0, 3.0), 12.00);
  assert.equal(F.FACTS.ceiling, 12.00);
});

test('net wall floors at 0 (openings never make it negative)', () => {
  assert.equal(F.netWallArea(5, [3, 4]), 0);
});

/* ---- band → litres: the honest min–max range ---- */
test('sq.ft/L band at 2-coat basis → m²/L per single coat', () => {
  // 130 sq.ft/L × 2 coats ÷ 10.7639 = 24.1548… m²/L per coat
  const perCoat = F.bandToM2PerCoat({ min: 130, max: 150 }, 2);
  assert.ok(Math.abs(perCoat.min - (130 * 2) / 10.7639) < 1e-9);
  assert.ok(Math.abs(perCoat.max - (150 * 2) / 10.7639) < 1e-9);
});

test('litres for 38.67 m² of wall at 2 coats of Tractor Emulsion = 2.77–3.20 L', () => {
  const perCoat = F.bandToM2PerCoat(F.TRACTOR_BAND, F.TRACTOR_COATS);
  const litres = F.litresBand(38.67, 2, perCoat);
  // worst case uses band MINIMUM coverage → more litres
  assert.equal(litres.min, 2.77);
  assert.equal(litres.max, 3.20);
  assert.deepEqual(F.FACTS.wallLitres, { min: 2.77, max: 3.20 });
  assert.ok(litres.max > litres.min, 'worst case must exceed best case');
});

/* ---- pack-fill minimizer: round UP to real tins ---- */
test('pack-fill: worst-case 3.20 L rounds up to exactly one 4 L tin', () => {
  assert.deepEqual(F.packFill(3.20, F.EMULSION_PACKS), { 4: 1 });
  assert.deepEqual(F.FACTS.wallBuy, { 4: 1 });
});

test('pack-fill prefers least total volume, then fewest tins, then larger tins', () => {
  // 2.77 L → 3×1 L (3 L total) beats 1×4 L (4 L total): least total wins
  assert.deepEqual(F.packFill(2.77, F.EMULSION_PACKS), { 1: 3 });
  // 12.0 L → 1×10 + 2×1 = 12 L, 3 packs (least total, fewest packs)
  assert.deepEqual(F.packFill(12.0, F.EMULSION_PACKS), { 10: 1, 1: 2 });
  // 14.0 L → 1×10 + 1×4 = 14 L exactly, 2 packs
  assert.deepEqual(F.packFill(14.0, F.EMULSION_PACKS), { 10: 1, 4: 1 });
  // 5.0 L → 1×4 + 1×1 = 5 L exactly
  assert.deepEqual(F.packFill(5.0, F.EMULSION_PACKS), { 4: 1, 1: 1 });
});

test('pack-fill always covers the need (never buys short) and never overshoots by a whole largest pack', () => {
  for (let needC = 1; needC <= 6000; needC++) {
    const need = needC / 100;
    const buy = F.packFill(need, F.EMULSION_PACKS);
    let total = 0;
    for (const size in buy) total += Number(size) * buy[size];
    assert.ok(total >= need - 1e-9, 'covers need at ' + need);
    assert.ok(total < need + 20, 'no full-largest-pack overshoot at ' + need);
  }
});

test('putty kg for 38.67 m² from Birla band (1.86–2.04 m²/kg), rounded to 5/40 kg bags', () => {
  const kg = F.puttyKg(38.67, F.BIRLA_PUTTY);
  assert.equal(kg.min, 18.96);   // 38.67 / 2.04
  assert.equal(kg.max, 20.79);   // 38.67 / 1.86
  // worst case 20.79 kg → 5×5 kg bags = 25 kg (least total vs 1×40)
  assert.deepEqual(F.packFill(kg.max, F.PUTTY_PACKS), { 5: 5 });
});

/* ---- tiles: integer-mm math, one round-up, box-of-N ---- */
test('tiles for 12 m² in 600×600 mm at 5% wastage = exactly 35 tiles', () => {
  // 12 / 0.36 = 33.33…, ×1.05 = 35.0000…, single ceil → 35
  assert.equal(F.tileCountFromArea(12, 600, 600, 5), 35);
  assert.equal(F.FACTS.tileCount, 35);
});

test('35 tiles in boxes of 4 = 9 boxes with 1 spare', () => {
  assert.deepEqual(F.boxes(35, 4), { boxes: 9, spare: 1 });
  assert.deepEqual(F.FACTS.tileBoxes, { boxes: 9, spare: 1 });
});

test('diagonal 10% wastage needs more tiles than straight 5%', () => {
  const straight = F.tileCountFromArea(12, 600, 600, 5);   // 35
  const diagonal = F.tileCountFromArea(12, 600, 600, 10);  // 37
  assert.equal(diagonal, 37);
  assert.ok(diagonal > straight);
});

test('tile math uses a single ceil (no double rounding): boxes cover every tile', () => {
  for (let a = 1; a <= 60; a++) {
    const tiles = F.tileCountFromArea(a, 600, 600, 5);
    const b = F.boxes(tiles, 4);
    assert.ok(b.boxes * 4 >= tiles, 'boxes cover tiles at ' + a + ' m²');
    assert.ok(b.boxes * 4 - tiles === b.spare && b.spare >= 0 && b.spare < 4);
  }
});
