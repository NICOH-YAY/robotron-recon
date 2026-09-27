// The only way a playing agent touches the game.
// An agent gets observe() and act(). It never gets the simulation object, the
// random seed, or the wave table, so it can only know what a person could see
// on the screen. The same file serves the browser (window.robotron) and Node.
(function(root) {
	'use strict';
	const Sim = root.RobotronSim || (typeof require !== 'undefined' ? require('./sim.js') : null);

	// the fields an observation may contain. anything else is a leak
	const ALLOWED = ['frame', 'wave', 'score', 'lives', 'state', 'player', 'grunts', 'electrodes', 'hulks', 'humans', 'shots'];

	const pt = (o) => ({ x: Math.round(o.x), y: Math.round(o.y) });

	function observe(g) {
		return {
			frame: g.frame,
			wave: g.wave,
			score: g.score,
			lives: g.lives,
			state: g.state,
			player: pt(g.player),
			grunts: g.grunts.map(pt),
			electrodes: g.electrodes.map(pt),
			hulks: g.hulks.map(pt),
			humans: g.humans.map((h) => Object.assign(pt(h), { kind: h.kind })),
			shots: g.shots.map(pt)
		};
	}

	const clamp = (v) => Math.max(-1, Math.min(1, Math.round(Number(v) || 0)));

	// makeEnv(seed) or makeEnv(existingSim). The seed stays inside this closure
	function makeEnv(seedOrSim) {
		const sim = (seedOrSim && seedOrSim.step) ? seedOrSim : Sim.create(seedOrSim);
		return Object.freeze({
			observe: () => observe(sim.g),
			// action: { move: [dx, dy], fire: [dx, dy] }. frames: how long to hold it, 1 to 30
			act(action, frames) {
				action = action || {};
				const a = {
					move: [clamp((action.move || [])[0]), clamp((action.move || [])[1])],
					fire: [clamp((action.fire || [])[0]), clamp((action.fire || [])[1])]
				};
				const n = Math.max(1, Math.min(30, frames | 0 || 1));
				for(let i = 0; i < n; i++) sim.step(a);
				return observe(sim.g);
			},
			arena: { width: Sim.W, height: Sim.H }
		});
	}

	root.RobotronAgentAPI = { makeEnv, observe, ALLOWED };
	if(typeof module !== 'undefined') module.exports = root.RobotronAgentAPI;
})(typeof window !== 'undefined' ? window : globalThis);
