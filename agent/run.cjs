// Headless checks and an agent benchmark.
// usage: node agent/run.cjs [episodes]
const assert = require('assert');
const Sim = require('../js/sim.js');
const { makeEnv, ALLOWED } = require('../js/agent-api.js');
const { policy } = require('../js/greedy.js');

// 1. the first frame of wave 1 matches WVTAB column 1 (RRG23.ASM)
{
	const obs = makeEnv(1).observe();
	assert.strictEqual(obs.grunts.length, 15, 'ROBCNT wave 1');
	assert.strictEqual(obs.electrodes.length, 5, 'PSTCNT wave 1');
	assert.strictEqual(obs.hulks.length, 0, 'HLKCNT wave 1');
	assert.strictEqual(obs.humans.length, 2, 'MOMCNT + DADCNT + KIDCNT wave 1');
	console.log('ok   wave 1 counts match the wave table');
}
// 2. the boundary: an observation holds only allowed fields, and nothing hidden leaks
{
	const env = makeEnv(7);
	const obs = env.act({ move: [1, 0], fire: [0, -1] }, 10);
	const extra = Object.keys(obs).filter((k) => !ALLOWED.includes(k));
	assert.deepStrictEqual(extra, [], 'extra fields: ' + extra.join(','));
	const text = JSON.stringify(obs);
	for(const secret of ['seed', 'rand', 'timer', 'gruntTimer', 'nextLife', 'saved', 'events']) {
		assert(!text.includes('"' + secret + '"'), 'leaked ' + secret);
	}
	assert(Object.isFrozen(env) && !('g' in env) && !('sim' in env), 'env exposes the simulation');
	console.log('ok   observations hold only what the screen shows');
}
// 3. scoring matches the source: a grunt is 100, rescues go 1000, 2000 ...
{
	const s = Sim.create(3);
	const g = s.g;
	g.grunts = [{ x: g.player.x, y: g.player.y - 20, t: 0 }];
	g.electrodes = []; g.hulks = [];
	g.humans = [{ x: g.player.x + 3, y: g.player.y, kind: 'mommy', dx: 0, dy: 0, t: 999 },
		{ x: g.player.x + 5, y: g.player.y, kind: 'daddy', dx: 0, dy: 0, t: 999 }];
	s.step({ move: [0, 0], fire: [0, -1] });
	for(let i = 0; i < 6; i++) s.step({ move: [1, 0], fire: [0, 0] });
	assert.strictEqual(g.score, 100 + 1000 + 2000, 'score was ' + g.score);
	console.log('ok   grunt 100, first rescue 1000, second 2000');
}
// 4. same seed, same inputs, same game
{
	const run = () => { const e = makeEnv(42); let o; for(let i = 0; i < 300; i++) o = e.act(policy(e.observe())); return JSON.stringify(o); };
	assert.strictEqual(run(), run());
	console.log('ok   runs replay exactly from a seed');
}
// 5. the baseline agent, over many seeds
const episodes = parseInt(process.argv[2] || '30', 10);
const results = [];
for(let seed = 1; seed <= episodes; seed++) {
	const env = makeEnv(seed);
	let obs = env.observe(), steps = 0, rescues = 0, lastScore = 0;
	while(obs.state !== 'over' && steps < 60 * 60 * 10) {
		obs = env.act(policy(obs), 2);
		steps += 2;
	}
	results.push({ seed, wave: obs.wave, score: obs.score, minutes: +(steps / 3600).toFixed(1) });
}
const avg = (k) => (results.reduce((a, r) => a + r[k], 0) / results.length).toFixed(1);
const reached = (w) => results.filter((r) => r.wave >= w).length;
console.log(`\nbaseline agent, ${episodes} games: mean wave ${avg('wave')}, mean score ${avg('score')}, mean ${avg('minutes')} min`);
console.log(`reached wave 2: ${reached(2)}/${episodes}   wave 3: ${reached(3)}/${episodes}   wave 5 (second loop): ${reached(5)}/${episodes}`);
