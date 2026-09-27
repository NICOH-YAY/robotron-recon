// Robotron: 2084 reconstruction. The rules, with no screen and no keyboard.
// Runs the same in the browser and in Node, so an agent can play it headless.
// Every number that comes from Williams' 1982 source cites its file and line
// in historicalsource/robotron. Numbers without a citation are labeled in SCOPE.md.
(function(root) {
	'use strict';

	const W = 300, H = 240;          // arena size in game pixels
	const R = 5;                     // touch radius for everything
	const GRUNT_SCALE = 3.3;         // calibration: wave 1 grunts cross the arena in about 9 seconds

	// WVTAB, RRG23.ASM:596-653. One column per wave; this reconstruction covers waves 1-4
	// and then plays them again faster (see SCOPE.md, "the loop").
	const WAVES = {
		grunts:     [15, 17, 22, 34],  // ROBCNT
		electrodes: [5, 15, 25, 25],   // PSTCNT
		mommies:    [1, 1, 2, 2],      // MOMCNT
		daddies:    [1, 1, 2, 2],      // DADCNT
		kids:       [0, 1, 2, 2],      // KIDCNT
		hulks:      [0, 5, 6, 7],      // HLKCNT
		gruntTimer: [20, 15, 15, 15],  // ROBSPD (frames between grunt steps, bigger is slower)
		hulkTimer:  [8, 8, 7, 7]       // HLKSPD
	};
	const POINTS = {
		grunt: 100,                            // LDD #$0110 in ROBKIL, RRP8.ASM ($0210 is marked "SCORE 1K" in RRC11.ASM)
		electrode: 0,                          // LDD #0 in PSTKIL, RRP8.ASM
		rescue: [1000, 2000, 3000, 4000, 5000] // SVITAB, RRH11.ASM, capped at 5 by CMPA #5 just above it
	};

	// seeded random numbers so a run can be replayed exactly
	function rng(seed) {
		let s = seed >>> 0 || 1;
		return () => {
			s ^= s << 13; s >>>= 0;
			s ^= s >> 17;
			s ^= s << 5; s >>>= 0;
			return s / 4294967296;
		};
	}

	function create(seed) {
		const rand = rng(seed === undefined ? 2084 : seed);
		const g = {
			frame: 0, wave: 1, score: 0, lives: 3, nextLife: 25000,
			saved: 0,                // SAVCNT: rescues this life, sets the next bonus
			player: { x: W / 2, y: H / 2, aimX: 0, aimY: -1, cool: 0 },
			shots: [], grunts: [], electrodes: [], hulks: [], humans: [], popups: [],
			state: 'play',           // 'play' | 'dead' | 'clear' | 'over'
			timer: 0, events: []
		};

		const col = () => (g.wave - 1) % 4;
		const speedUp = () => 1 + 0.15 * Math.floor((g.wave - 1) / 4);
		const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

		// a free place to spawn: away from the player and from everything already placed,
		// so nothing touches on the first frame and the wave starts with the table's counts
		let placed = [];
		function spot(minFromPlayer) {
			for(let i = 0; i < 400; i++) {
				const x = 10 + rand() * (W - 20), y = 10 + rand() * (H - 20);
				if(Math.hypot(x - g.player.x, y - g.player.y) <= minFromPlayer) continue;
				if(placed.some((o) => Math.hypot(o.x - x, o.y - y) < 12)) continue;
				const pt = { x, y };
				placed.push(pt);
				return pt;
			}
			return { x: 10, y: 10 };
		}

		function startWave(keepCounts) {
			const c = col();
			g.player.x = W / 2;
			g.player.y = H / 2;
			g.shots = [];
			g.saved = 0;               // PLINIT clears SAVCNT, RRG23.ASM
			const counts = keepCounts || {
				grunts: WAVES.grunts[c], electrodes: WAVES.electrodes[c], hulks: WAVES.hulks[c],
				humans: [
					...Array(WAVES.mommies[c]).fill('mommy'),
					...Array(WAVES.daddies[c]).fill('daddy'),
					...Array(WAVES.kids[c]).fill('mikey')
				]
			};
			placed = [];
			g.grunts = Array.from({ length: counts.grunts }, () => Object.assign(spot(60), { t: Math.floor(rand() * 20) }));
			g.electrodes = Array.from({ length: counts.electrodes }, () => spot(45));
			g.hulks = Array.from({ length: counts.hulks }, () => Object.assign(spot(70), { t: 0, dx: 0, dy: 0 }));
			g.humans = counts.humans.map((kind) => Object.assign(spot(30), { kind, dx: 0, dy: 0, t: 0 }));
			// ROBSPD is a timer; how it becomes pixels per frame is my calibration, not the source (SCOPE.md)
			g.gruntTimer = WAVES.gruntTimer[c] / GRUNT_SCALE / speedUp();
			g.hulkTimer = WAVES.hulkTimer[c] / speedUp();
			g.waveFrame = 0;
			g.state = 'play';
			g.events.push({ type: 'wave', wave: g.wave });
		}

		function addScore(n, x, y) {
			g.score += n;
			if(n) g.popups.push({ x, y, text: String(n), life: 45 });
			while(g.score >= g.nextLife) {
				g.lives++;
				g.nextLife += 25000;
				g.events.push({ type: 'extra-life' });
			}
		}

		function kill() {
			g.state = 'dead';
			g.timer = 90;
			g.events.push({ type: 'death' });
		}

		// one sixtieth of a second. input: { move: [dx, dy], fire: [dx, dy] }, each part -1, 0 or 1
		function step(input) {
			input = input || {};
			g.frame++;
			g.popups = g.popups.filter((p) => --p.life > 0);

			if(g.state !== 'play') {
				if(g.state === 'over') return;
				if(--g.timer > 0) return;
				if(g.state === 'dead') {
					g.lives--;
					if(g.lives <= 0) {
						g.state = 'over';
						g.events.push({ type: 'game-over', score: g.score, wave: g.wave });
						return;
					}
					// the wave comes back with whoever is still standing
					startWave({
						grunts: g.grunts.length, electrodes: g.electrodes.length, hulks: g.hulks.length,
						humans: g.humans.map((h) => h.kind)
					});
				} else {
					g.wave++;
					startWave();
				}
				return;
			}

			g.waveFrame++;
			const p = g.player;
			const mv = input.move || [0, 0];
			const ml = Math.hypot(mv[0], mv[1]);
			if(ml) {
				p.x = Math.max(4, Math.min(W - 4, p.x + mv[0] / ml * 1.25));
				p.y = Math.max(4, Math.min(H - 4, p.y + mv[1] / ml * 1.25));
			}

			// the fire stick shoots in eight directions, one shot every 5 frames
			const fr = input.fire || [0, 0];
			if(p.cool > 0) p.cool--;
			if((fr[0] || fr[1]) && p.cool === 0 && g.shots.length < 6) {
				const fl = Math.hypot(fr[0], fr[1]);
				g.shots.push({ x: p.x, y: p.y, dx: fr[0] / fl * 6, dy: fr[1] / fl * 6 });
				p.aimX = fr[0]; p.aimY = fr[1];
				p.cool = 5;
			}
			for(const s of g.shots) { s.x += s.dx; s.y += s.dy; }
			g.shots = g.shots.filter((s) => s.x > 0 && s.x < W && s.y > 0 && s.y < H);

			// grunts step toward you, and speed up the longer a wave lasts
			const accel = Math.max(1.5, g.gruntTimer - g.waveFrame / 300);
			for(const gr of g.grunts) {
				if(++gr.t >= accel) {
					gr.t = 0;
					gr.x += Math.sign(p.x - gr.x) * 3;
					gr.y += Math.sign(p.y - gr.y) * 3;
				}
			}

			// hulks go after the family, can't be killed, and get shoved by shots
			for(const h of g.hulks) {
				if(++h.t >= g.hulkTimer) {
					h.t = 0;
					let target = null, best = 1e9;
					for(const hu of g.humans) { const d = dist(h, hu); if(d < best) { best = d; target = hu; } }
					if(!target) target = p;
					if(rand() < 0.2) { h.dx = Math.sign(target.x - h.x); h.dy = 0; }
					else if(rand() < 0.25) { h.dx = 0; h.dy = Math.sign(target.y - h.y); }
					h.x = Math.max(4, Math.min(W - 4, h.x + h.dx * 2));
					h.y = Math.max(4, Math.min(H - 4, h.y + h.dy * 2));
				}
			}

			// the family wanders
			for(const hu of g.humans) {
				if(--hu.t <= 0) {
					hu.t = 40 + Math.floor(rand() * 60);
					const a = Math.floor(rand() * 8) * Math.PI / 4;
					hu.dx = Math.round(Math.cos(a)) * 0.4;
					hu.dy = Math.round(Math.sin(a)) * 0.4;
				}
				hu.x += hu.dx; hu.y += hu.dy;
				if(hu.x < 6 || hu.x > W - 6) hu.dx = -hu.dx;
				if(hu.y < 6 || hu.y > H - 6) hu.dy = -hu.dy;
			}

			// shots
			for(const s of g.shots) {
				for(const gr of g.grunts) {
					if(!s.dead && !gr.dead && dist(s, gr) < R) { s.dead = gr.dead = true; addScore(POINTS.grunt, gr.x, gr.y); }
				}
				for(const e of g.electrodes) {
					if(!s.dead && !e.dead && dist(s, e) < R) { s.dead = e.dead = true; addScore(POINTS.electrode, e.x, e.y); }
				}
				for(const h of g.hulks) {
					if(!s.dead && dist(s, h) < R + 1) { s.dead = true; h.x += Math.sign(s.dx) * 4; h.y += Math.sign(s.dy) * 4; }
				}
			}
			// grunts that walk into electrodes die with them, for no points
			for(const gr of g.grunts) {
				for(const e of g.electrodes) {
					if(!gr.dead && !e.dead && dist(gr, e) < R) { gr.dead = e.dead = true; }
				}
			}
			// hulks crush the family
			for(const hu of g.humans) {
				for(const h of g.hulks) {
					if(!hu.dead && dist(hu, h) < R) {
						hu.dead = true;
						g.popups.push({ x: hu.x, y: hu.y, text: 'skull', life: 60 });
						g.events.push({ type: 'human-lost', kind: hu.kind });
					}
				}
			}
			// you rescue the family by touching them
			for(const hu of g.humans) {
				if(!hu.dead && dist(hu, p) < R + 1) {
					hu.dead = true;
					g.saved = Math.min(5, g.saved + 1);
					addScore(POINTS.rescue[g.saved - 1], hu.x, hu.y);
					g.events.push({ type: 'rescue', kind: hu.kind, points: POINTS.rescue[g.saved - 1] });
				}
			}
			g.shots = g.shots.filter((s) => !s.dead);
			g.grunts = g.grunts.filter((x) => !x.dead);
			g.electrodes = g.electrodes.filter((x) => !x.dead);
			g.humans = g.humans.filter((x) => !x.dead);

			// anything hostile touching you ends this life
			for(const list of [g.grunts, g.electrodes, g.hulks]) {
				for(const e of list) if(dist(e, p) < R) { kill(); return; }
			}

			// a wave ends when the last grunt is gone. hulks and electrodes don't count
			if(g.grunts.length === 0) {
				g.state = 'clear';
				g.timer = 60;
				g.events.push({ type: 'wave-clear', wave: g.wave });
			}
		}

		startWave();
		return { g, step, W, H };
	}

	root.RobotronSim = { create, WAVES, POINTS, W, H };
	if(typeof module !== 'undefined') module.exports = root.RobotronSim;
})(typeof window !== 'undefined' ? window : globalThis);
