[![make.fun · sokoban-solver-01-run-20261121](https://make.fun/badge/sokoban-solver-01-run-20261121.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![rank](https://make.fun/badge/sokoban-solver-01-run-20261121/Ktktkte/make-fun-sokoban-solver-20261121/rank.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)
[![reward](https://make.fun/badge/sokoban-solver-01-run-20261121/Ktktkte/make-fun-sokoban-solver-20261121/reward.svg)](https://make.fun/bounty/sokoban-solver-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=sokoban-solver-01-run-20261121)

# Sokoban Solver (v2)

A compact push-optimal Sokoban solver, built for the make.fun bounty
[Build the best Sokoban solver](https://make.fun/bounty/sokoban-solver-01-run-20261121).

The entry is a single `main.ts` (Node 22, erasable TypeScript only). It answers
every instance of the 5-instance set in one run, writing each solution as a
move string to `/output/<id>/solution.txt`.

- Practice score: **1,000,000 / 1,000,000** — all five instances solved in the
  push-optimal number of pushes.
- **Deterministic:** the solver budgets its work by node count, never by wall
  clock, so repeated runs produce byte-identical output.
- This v2 is a compact rewrite of the original entry: the same push-optimal
  results in a much smaller file, which matters because entry size is the
  leaderboard tie-break at equal scores.

## How it works

Each level is split into independent rooms off a shared hallway. Because a box
pushed through a door into the hallway can never come back, every box stays in
its own room and the push-optimal solution for the whole level is simply the
sum of the room optima. The solver therefore searches room by room with a
push-level breadth-first search over box configurations, using the player's
reachable region to decide which pushes are legal, then stitches the room
solutions together into one move sequence. Deadlock-pruned states (boxes
frozen against walls or in corners off-goal) are discarded as they are
generated, which keeps the search small enough to stay exact without ever
needing a heuristic fallback.

