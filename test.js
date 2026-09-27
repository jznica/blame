// Headless check: every map is solvable and every learner improves. Run: node test.js
const { World, Agent, PRESETS, ALGOS } = require('./core.js');

let failures = 0;
const base = { alpha: 0.5, gamma: 0.95, epsilon: 0.1, lambda: 0.9, maxSteps: 500 };

for (const [key, preset] of Object.entries(PRESETS)) {
  const world = World.fromRows(preset.rows);
  const vstar = world.optimalValues(base.gamma)[world.start];
  console.log(`\n${preset.name}  (V* at start = ${vstar.toFixed(3)})`);
  if (!(vstar > 0)) { console.log('  FAIL: goal unreachable'); failures++; }

  for (const algo of Object.keys(ALGOS)) {
    const p = { ...base, alpha: algo === 'mc' ? 0.1 : base.alpha };
    let first = 0, last = 0;
    const seeds = 5, E = preset.episodes;
    for (let seed = 1; seed <= seeds; seed++) {
      const ag = new Agent(world.clone(), algo, p, seed * 7919);
      for (let e = 0; e < E; e++) {
        const r = ag.runEpisode().disc;
        if (e < 10) first += r / (10 * seeds);
        if (e >= E - 20) last += r / (20 * seeds);
      }
    }
    // On the cliff, on-policy learners trade return for safety under exploration, so only require improvement.
    const ok = last > first && (key === 'cliff' || last > 0.4 * vstar);
    if (!ok) failures++;
    console.log(`  ${ALGOS[algo].padEnd(13)} first10=${first.toFixed(3)}  last20=${last.toFixed(3)}  ${ok ? 'ok' : 'FAIL'}`);
  }
}

// Discount-factor lesson: with optimistic starts, gamma 0.9 should pick the coin (4), 0.99 the chest (2).
const decoy = World.fromRows(PRESETS.decoy.rows);
function greedyOutcome(ag) {
  let s = decoy.start;
  for (let i = 0; i < 100; i++) { s = decoy.move(s, ag.greedy(s)); if (decoy.isTerminal(s)) return decoy.cells[s]; }
  return 'loop';
}
for (const [g, want] of [[0.9, 4], [0.99, 2]]) {
  let hits = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const ag = new Agent(decoy.clone(), 'q', { ...base, gamma: g, epsilon: 0.1, optimism: 1 }, seed * 31);
    for (let e = 0; e < 300; e++) ag.runEpisode();
    if (greedyOutcome(ag) === want) hits++;
  }
  const ok = hits >= 9; if (!ok) failures++;
  console.log(`\ndecoy gamma=${g}: greedy policy picks the ${want === 2 ? 'chest' : 'coin'} in ${hits}/10 seeds  ${ok ? 'ok' : 'FAIL'}`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
