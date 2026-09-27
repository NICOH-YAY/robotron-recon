# Scope record: Robotron: 2084, reconstructed

Game: Robotron: 2084 (Williams Electronics, 1982; Eugene Jarvis and Larry DeMar), waves 1 to 4. Evidence: source code, [historicalsource/robotron](https://github.com/historicalsource/robotron) (6809 assembly). Reuse terms: the repository has no license file, so I reconstructed the rules by reading the source and copied none of its code, art or sound. The original is credited here and on the title screen.

AI-use disclosure: the reconstruction code and this record were drafted with Claude (Anthropic) in Claude Code from my direction. I chose the scope, checked each citation against the source, and answer for errors.

**Play:** https://nicoh-yay.github.io/robotron-recon/ (WASD moves, arrow keys or the mouse fire)

## Bounded scope

The core loop is one wave. The player stands in the middle of an arena, grunts close in from every side, electrodes sit still, hulks hunt the family, and the wave ends when the last grunt dies. You have three lives, and a wave you die in comes back with whoever was still standing. After wave 4 the game plays waves 1 to 4 again, 15% faster each time round, so a run has no fixed end and a game ends only when the lives run out.

Left out: brains and their progs, spheroids and enforcers, quarks and tanks, the high score table, attract mode, and the arcade's exact sprites and sounds. The first wave with brains is wave 5, which is why this scope stops at 4.

## Rule and source map

Labels: `code`, `manual`, `observed`, `assumed` (Week 2 Recap).

| Rule | Evidence |
|---|---|
| Wave 1 has 15 grunts, 5 electrodes, 1 mommy, 1 daddy, 0 mikeys, 0 hulks | `code`, RRG23.ASM:634-644 (WVTAB rows ROBCNT, PSTCNT, MOMCNT, DADCNT, KIDCNT, HLKCNT, first column) |
| Waves 2 to 4 follow the next three columns of the same rows | `code`, RRG23.ASM:634-644 |
| Grunt step timer starts at 20 on wave 1 and 15 after | `code`, RRG23.ASM:598 (ROBSPD) |
| Grunts speed up during a wave | `code` that the timer is rewritten mid-wave, RRG23.ASM:454-458 and 854-856; `assumed` for my rate (one frame faster every 5 seconds) |
| How the ROBSPD timer turns into pixels per frame | `assumed`, calibrated so a wave 1 grunt crosses the arena in about 9 seconds (`GRUNT_SCALE` in js/sim.js) |
| Hulk step timer 8, 8, 7, 7 | `code`, RRG23.ASM:613 (HLKSPD) |
| A grunt is worth 100 | `code`, RRP8.ASM:237 (`LDD #$0110` in ROBKIL); `$0210` is marked "SCORE 1K" at RRC11.ASM:203, which fixes the encoding |
| An electrode is worth 0 | `code`, RRP8.ASM:254 (`LDD #0` in PSTKIL). This is my reading of the assembly and has not been checked in play |
| Rescues pay 1000, 2000, 3000, 4000, then 5000 each | `code`, RRH11.ASM:498-503 (SVITAB), capped by `CMPA #5` at RRH11.ASM:457 |
| The rescue count resets with each new life | `code`, RRG23.ASM:672 (`CLR SAVCNT` in PLINIT) |
| Hulks can't be killed; shots shove them | `manual` (Williams' instructions), not yet traced in code |
| Hulks kill the family; grunts don't | `manual`, not yet traced in code |
| Extra man every 25,000 | `manual` (the factory default setting), not traced |
| Three men per game | `manual`, factory default |
| The loop repeats waves 1 to 4 at +15% speed | `assumed`. This is my scope decision, not the arcade's behavior |

## Acceptance trace

Seed 3, wave 1, one grunt placed 20 pixels above the player, mommy 3 pixels right, daddy 5 pixels right, no electrodes or hulks.

1. Fire up for one frame. The shot hits the grunt: score 0 → 100, grunts 1 → 0.
2. Move right for six frames. The player touches mommy: rescue count 0 → 1, score 100 → 1100. Then daddy: rescue count 1 → 2, score 1100 → 3100.
3. With no grunts left, the state goes `play` → `clear`, and 60 frames later wave 1 → 2 with 17 grunts, 15 electrodes and 5 hulks.

`node agent/run.cjs` runs this trace, the wave-1 count check, the boundary check and a replay check, then benchmarks the baseline agent.

## The agent boundary

A playing agent gets `observe()` and `act({ move, fire }, frames)` from `js/agent-api.js` and nothing else. The observation lists positions a person could see on the screen, rounded to whole pixels, plus score, lives and wave. The agent never gets the random seed, the wave table, the grunt timers or the simulation object. So it can't know where the next wave will spawn before a person could. The environment object is frozen and holds the simulation in a closure, and `agent/run.cjs` fails if an observation carries any field outside the allowed list or contains the names of the hidden values. In the browser the same interface is `window.robotron`.

## What the baseline agent showed

The first calibration let the baseline agent reach wave 78 without losing a life, which told me the grunts were far too slow. After recalibration it averages about wave 13 over 30 seeded games and loses all three lives in a little over a minute of game time. Its aim is perfect and its reactions are instant, so human players should die much earlier. That is `assumed` until people play it.

## Open questions

- Does the electrode really score 0? The assembly says so on my reading, and an arcade playthrough would settle it.
- The grunt acceleration rate is a guess. The source rewrites ROBSPD during a wave, and I haven't traced how fast.
