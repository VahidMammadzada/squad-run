# Design: Daily cup, weekly league and rival kits (M4a)

Status: draft for approval. Trimmed version of M4 in `docs/design/club-meta.md` (5.7 and 10). Items marked **[call]** are decisions I made without the owner; the rest are the owner's.

## Why

The owner's picture: a player wants their club near the top of the league, because a high finish pays **fans**, and fans unlock the better items (stars, stadium tiers, prestige wardrobe items). The daily cup is the reason to open the game every day; the weekly table is the reason the days add up.

It also fixes a gap: today nothing in a run looks like "a match against someone". Rival kits make the opposition visible.

## What gets built

### 1. Weekly league (8 clubs)
- A **season** is one UTC week (Monday 00:00 UTC to Sunday 23:59 UTC). Season id = that week's number.
- 8 clubs: the player's club and 7 generated rivals. Rival names, kit colours and strength are seeded by the season id (fictional names only; no real clubs or players).
- Table order: by points only. Ties are broken by a fixed seeded rival order, with the player ahead of any rival on equal points **[call]**.
- Rival points are **a pure function of (season id, rival, day)**, so nothing is stored. A rival earns the same 0–5 points per day scale as the player (below). Rivals vary in strength so first place is competitive but reachable by a player who plays most days.
- The table shown today = rivals' points for every day up to and including today, plus the player's own points from cups they played.
- Days the player skips add nothing to their points. Nothing is ever taken away.

### 2. Daily cup (one seeded level)
- One cup per UTC day, a normal run (gates, defenders, coins, shootout) against that day's rival club (the rival in the table that the day seeds).
- **Layout** is seeded by the day, not by the player's level **[call]**. **Difficulty** follows the player's current level so the squad and keeper feel familiar **[call]**.
- **Scoring, out of 5 points per day:**
  - Result, 0–3: shootout goals vs the rival's goal count for the day (seeded). Win 3, draw 1, loss 0.
  - Squad bonus, 0 or 1: reached the shootout with at least a set share of a "par" squad for the generated layout.
  - Goals bonus, 0 or 1: scored at least a set number of goals, even in a loss.
- The first run that **reaches the shootout** each day is the scored one **[call]**. Dying before the shootout doesn't use up the day's attempt, so no one is locked out. Further runs the same day are practice: no points, no table change.
- The cup never touches `level`, never advances the main progression, and is never forced.
- Coins collected in a cup are kept like any run **[call]**. Fans are **not** granted per cup; they only come from the end-of-season payout.

### 3. End-of-season payout
- When the player opens the game in a new season, the previous season is finalized once: their final place pays a one-time **fan bonus** (1st pays most). Shown with a small results panel in the stadium.
- Needs at least one scored cup that season **[call]**, otherwise no payout.
- Fans only ever go up: a bad finish pays less, never negative.
- Payout goes through `Progress` so the score sent via `sendScore` matches `fans` in the save, only after a successful save.
- Payout amounts live in `src/club/balance.ts` and are tuned with `economy.test.ts`, so the table can't skip the fan gates (500 / 800 / 1000 / 1200 / 1500 / 2000 / 2500) much faster than normal play.

### 4. Rival kits
- In the cup level, defenders and the keeper wear the day's rival kit (shirt/shorts/socks colours from the rival, seeded).
- Normal levels also get a seeded rival kit per level number so every run shows an opponent **[call]**. This is cosmetic only; `generateLevel(n)` output for tests stays unchanged (the kit comes from a separate seeded function).

### 5. Where the player finds it
- A new **CUP** stall on the stadium concourse **[call]**: opens a bottom sheet with today's rival, the 8-club table, your points today and this week, days left in the season, and a PLAY CUP button.
- The Title screen shows nothing new in v1.

## Goals
- A reason to open the game each day, with an obvious week-long chase.
- Rival kits visible in every run.
- All rules pure and unit-tested (season id, day number, rival generation, points, table, payout), no Phaser/Three in the logic. Follows the repo pattern (`src/club/`).

## Non-goals
- No relegation or divisions, no promotion tiers.
- No sponsors, no cup rewards in coins beyond normal pickups, no rewarded ads in v1 **[call]**.
- No server, no real clubs or names, no network calls.
- No daily streaks or penalties for missing days.

## Anti-goals (would make this a failure)
- Fans ever decreasing, or the score sent to YouTube not matching the save.
- A player who ignores the cup being worse off, blocked, or nagged.
- The table feeling scripted or obviously fake (rivals should have varied weeks).
- Breaking `generateLevel(n)` stability or existing tests.

## Constraints (from CLAUDE.md)
- Save: bump `SAVE_VERSION` to 6 and teach `sanitizeSave` the v5 shape; `sanitizeSave` never throws. New data is small: season id, per-day cup results for the current season (day, points), and the last season id already paid.
- Time: all date logic takes `now` as an argument (pure, testable); UTC day/week. The device clock can be changed; accepted since there is no server **[call]**.
- Pitch pixels / units rule unchanged; only `src/three/` touches 3D units.
- Ads: starting a cup is a natural break; use the same interstitial rules as `startNextLevel` without allowing two ads for one break **[call, builder to confirm against `adPolicy`]**.
- Pause/audio/SDK rules unchanged. No new network calls.

## Decisions from the owner (after the builder check)
- **Unlock:** the CUP stall appears once the player reaches level 4 (`level >= 4`). Before that it is absent from the concourse, and no season data is created.
- **Competitiveness target:** a player who plays 6–7 days a week finishes 1st about half of seasons and otherwise 2nd or 3rd; a player who plays 3–4 days usually lands mid-table. Rival strength and payout amounts are tuned to this, and the economy simulation checks it with players who play N days a week.

## Calls made after the builder check (all **[call]**)
- **Cup runs are risk-free for the club.** They do not call `completeLevel` or `failRun`, so they don't change star fitness, injuries, `level`, campaign timers or merch accrual. A cup game over offers RETRY or back to the stadium, with no revive.
- **Layout vs difficulty.** Add a separate seeded entry point that reuses the normal generator's structure with the day as the seed and the player's level as difficulty. `generateLevel(n)` output must stay identical. "Par squad" is computed from the generated layout.
- **When the day is fixed.** The UTC day (and season) is fixed when the cup run starts. The score is recorded when the shootout resolves; if the app is closed or paused before that, nothing is recorded and the day's attempt stays unused. A squad that reaches the shootout with 0 players is a game over, not a scored loss.
- **Clock oddities.** If `now` is earlier than the stored season, ignore the rewind and never lower anything. If seasons were skipped, pay the stored season once, then start the current one.
- **Rival colours.** Rival kit colours are picked from a palette filtered for contrast against the squad kit and the gate colours, so defenders stay readable.

## Left to the builder
- The exact number formulas: rival goal count and daily rival points distribution, "par" squad, goal threshold, payout amounts, rival name/colour generator.
- How the cup mode is passed into `GameScene` and how its result reaches `LevelComplete`/stadium (the cup is not a normal `completeLevel`).
- Layout of the CUP sheet and table, within `clubUi.ts` widgets and the art-direction skill.
- Test plan, including extending the economy simulation with a player who plays N days a week.
