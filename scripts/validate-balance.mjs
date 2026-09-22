import {
  ENEMY_UNLOCK_WAVE,
  waveEnemyCount,
  enemyCaps,
  buildEnemyRoster,
  stageFinaleAnchor,
  waveHasCarrier,
  carrierIndexForWave,
  shouldDropArsenal,
  rosterThreat,
} from '../src/balanceSystem.js';

function assert(condition, message, data) {
  if (!condition) {
    throw new Error(data ? `${message}: ${JSON.stringify(data)}` : message);
  }
}

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const expectedCounts = [4,5,6,5,6,7,6,7,8,7,8,9];
const finaleAnchors = new Map([
  [3, 'scout'],
  [6, 'hunter'],
  [9, 'breacher'],
  [12, 'heavy'],
]);

const curve = [];

for (let wave = 1; wave <= 12; wave++) {
  const stage = Math.floor((wave - 1) / 3) + 1;
  const waveInStage = ((wave - 1) % 3) + 1;
  const count = waveEnemyCount(stage, waveInStage);

  assert(
    count === expectedCounts[wave - 1],
    `Wave ${wave} enemy count changed unexpectedly`,
    { count, expected: expectedCounts[wave - 1] }
  );

  const caps = enemyCaps(wave, count);
  const samples = 500;
  let threatSum = 0;

  for (let sample = 0; sample < samples; sample++) {
    const roster = buildEnemyRoster({
      stage,
      wave,
      waveInStage,
      count,
      rng: seeded(wave * 10000 + sample + 1),
    });

    assert(roster.length === count, `Wave ${wave} roster length mismatch`, roster);

    const counts = {};
    for (const type of roster) {
      counts[type] = (counts[type] || 0) + 1;
      assert(
        wave >= ENEMY_UNLOCK_WAVE[type],
        `Wave ${wave} spawned ${type} before unlock`,
        roster
      );
      assert(
        counts[type] <= (caps[type] || 0),
        `Wave ${wave} exceeded ${type} cap`,
        { roster, caps }
      );
    }

    const anchor = finaleAnchors.get(wave);
    if (anchor) {
      assert(
        roster[roster.length - 1] === anchor,
        `Wave ${wave} finale anchor must be ${anchor}`,
        roster
      );
    }

    threatSum += rosterThreat(roster);
  }

  const averageThreat = threatSum / samples;
  const carrier = waveHasCarrier(waveInStage);
  const carrierIndex = carrierIndexForWave(count, waveInStage);

  assert(
    carrier === (waveInStage >= 2),
    `Wave ${wave} carrier cadence mismatch`
  );
  assert(
    carrier ? carrierIndex >= 1 && carrierIndex < count : carrierIndex === -1,
    `Wave ${wave} carrier index invalid`,
    { carrier, carrierIndex, count }
  );

  curve.push({
    wave,
    stage,
    waveInStage,
    count,
    averageThreat,
    carrier,
    anchor: stageFinaleAnchor(stage, waveInStage),
  });
}

// Inside each stage, pressure should increase wave by wave.
for (let stage = 1; stage <= 4; stage++) {
  const rows = curve.filter(row => row.stage === stage);
  assert(
    rows[0].averageThreat < rows[1].averageThreat &&
    rows[1].averageThreat < rows[2].averageThreat,
    `Stage ${stage} does not ramp smoothly`,
    rows
  );
}

// Stage openings should become progressively harder, while still offering a
// small breather compared with the previous finale.
for (let stage = 2; stage <= 4; stage++) {
  const currentStart = curve.find(row => row.stage === stage && row.waveInStage === 1);
  const previousStart = curve.find(row => row.stage === stage - 1 && row.waveInStage === 1);
  const previousFinale = curve.find(row => row.stage === stage - 1 && row.waveInStage === 3);

  assert(
    currentStart.averageThreat > previousStart.averageThreat,
    `Stage ${stage} opening did not increase over prior stage opening`,
    { previousStart, currentStart }
  );
  assert(
    currentStart.averageThreat < previousFinale.averageThreat,
    `Stage ${stage} opening lost the intended breather`,
    { previousFinale, currentStart }
  );
}

// No adjacent wave should introduce a pathological threat spike.
for (let i = 1; i < curve.length; i++) {
  const ratio = curve[i].averageThreat / curve[i - 1].averageThreat;
  assert(
    ratio < 1.5,
    `Threat spike from wave ${curve[i - 1].wave} to ${curve[i].wave} is too large`,
    { ratio, previous: curve[i - 1], current: curve[i] }
  );
}

// Heavy units are impossible before wave 8, and capped at one through wave 12.
for (let wave = 1; wave <= 7; wave++) {
  const stage = Math.floor((wave - 1) / 3) + 1;
  const waveInStage = ((wave - 1) % 3) + 1;
  const roster = buildEnemyRoster({
    stage,
    wave,
    waveInStage,
    count: waveEnemyCount(stage, waveInStage),
    rng: () => 0.999999,
  });
  assert(!roster.includes('heavy'), `Heavy appeared too early on wave ${wave}`, roster);
}
for (let wave = 8; wave <= 12; wave++) {
  const count = waveEnemyCount(Math.floor((wave - 1) / 3) + 1, ((wave - 1) % 3) + 1);
  const caps = enemyCaps(wave, count);
  assert(caps.heavy === 1, `Heavy cap must stay at one through wave 12`, { wave, caps });
}

// Arsenal progression cannot be indefinitely denied by RNG.
let misses = 0;
for (let i = 0; i < 2; i++) {
  const roll = shouldDropArsenal({ weaponTier: 1, misses, rng: () => 0.99 });
  assert(!roll.arsenal, 'Arsenal pity triggered too early', { i, roll });
  misses = roll.nextMisses;
}
const guaranteed = shouldDropArsenal({ weaponTier: 1, misses, rng: () => 0.99 });
assert(guaranteed.arsenal, 'Third eligible drop must trigger arsenal pity', guaranteed);
assert(guaranteed.nextMisses === 0, 'Arsenal pity must reset miss counter', guaranteed);

const firstNineCarriers = curve.slice(0, 9).filter(row => row.carrier).length;
assert(
  firstNineCarriers === 6,
  'First nine waves should contain six field-module carriers',
  { firstNineCarriers }
);

console.log('PASS balance curve');
console.table(curve.map(row => ({
  wave: row.wave,
  stage: row.stage,
  local: row.waveInStage,
  enemies: row.count,
  threat: Number(row.averageThreat.toFixed(2)),
  carrier: row.carrier ? 'yes' : 'no',
  anchor: row.anchor || '-',
})));
