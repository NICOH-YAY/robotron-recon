# Robotron: 2084, reconstructed

**Play:** https://nicoh-yay.github.io/robotron-recon/

A browser reconstruction of the first four waves of Williams' Robotron: 2084 (1982), rebuilt by reading the original 6809 source at [historicalsource/robotron](https://github.com/historicalsource/robotron). WASD moves, the arrow keys (or the mouse) fire in eight directions. Clear the grunts, save the family, and keep going, since the waves loop back faster each time.

**Agents can play it.** In the browser, `robotron.start()`, `robotron.act({ move: [dx, dy], fire: [dx, dy] }, frames)` and `robotron.observe()`. In Node, `require('./js/agent-api.js').makeEnv(seed)`. Press WATCH AGENT to see the baseline agent play. `node agent/run.cjs` runs the checks and a benchmark.

The rules, their sources and the agent boundary are in [SCOPE.md](SCOPE.md). No code, art or sound from the original is copied; the source repository has no license, so only the rules were reconstructed. Credit to Eugene Jarvis and Larry DeMar.

AI-use disclosure: drafted with Claude (Anthropic) in Claude Code from my direction.
