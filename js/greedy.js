// A baseline agent that plays from observations only. It is here to measure
// the reconstruction, not to play well: shoot the nearest grunt, back away from
// anything close, and walk to the family when it's safe.
(function(root) {
	'use strict';
	const sgn = (v) => (v > 2 ? 1 : v < -2 ? -1 : 0);
	const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

	function policy(obs) {
		const p = obs.player;
		const threats = obs.grunts.concat(obs.hulks, obs.electrodes);
		let near = null, nd = 1e9;
		for(const t of threats) { const x = d(p, t); if(x < nd) { nd = x; near = t; } }
		let aim = null, ad = 1e9;
		for(const g of obs.grunts) { const x = d(p, g); if(x < ad) { ad = x; aim = g; } }
		const fire = aim ? [sgn(aim.x - p.x), sgn(aim.y - p.y)] : [0, 0];
		let move = [0, 0];
		if(near && nd < 28) {
			move = [-sgn(near.x - p.x), -sgn(near.y - p.y)];
		} else if(obs.humans.length) {
			let h = obs.humans[0];
			for(const x of obs.humans) if(d(p, x) < d(p, h)) h = x;
			move = [sgn(h.x - p.x), sgn(h.y - p.y)];
		} else {
			move = [sgn(150 - p.x), sgn(120 - p.y)];
		}
		return { move, fire };
	}

	root.RobotronGreedy = { policy };
	if(typeof module !== 'undefined') module.exports = root.RobotronGreedy;
})(typeof window !== 'undefined' ? window : globalThis);
