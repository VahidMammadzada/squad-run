# Design: Club meta layer ("Squad Run FC")

Status: **draft for planning**. Items marked **[DECIDE]** are open; each has a recommended default so planning can proceed if left as is.

## 1. Summary

Wrap the runner in a light football-club management layer, inspired by browser manager games like 11x11. The player owns a club and a stadium. Every run earns coins and **fans**. Fans are the long-term score and the YouTube leaderboard value. Coins are spent in a stadium "club hub" with vendor booths (training, merch, doctor, marketing, scout) and on star players. Those players and upgrades change the next run, which closes the loop.

## 2. Why

- **Coins run out of purpose.** Today the only spend is 8 kits (5,050 coins in total). Once they're bought, coins and the "×3 coins" rewarded ad are worthless.
- **Retention.** Goals that last across sessions (fans, stadium, roster) give a reason to come back. On Playables, more sessions mean more ad views and better ranking.
- **More rewarded-ad moments** that players choose because they want them (heal now, double merch income), never forced.

## 3. Design pillars (rules every feature must pass)

1. **Everything feeds the run.** Each club feature must visibly change the next run. If it only lives in menus, cut it.
2. **Runner first, menus light.** A player who never opens the club can still play happily. The hub is one tap away, never a forced stop after every level.
3. **No hard blocks.** Injuries, fatigue and timers slow you down at most. There is always a free way to keep playing, and rewarded ads only speed things up (certification rule).
4. **Counted in levels, not hours.** Playables can't send notifications, so durations ("3 levels") beat real-time timers.
5. **Simple numbers.** Flat prices and small integer stats. No hidden formulas the player can't predict.
6. **Simulated world.** There is no server: rivals, the transfer market and the league are all generated locally, deterministically where possible.

## 4. Core loop

```
 Title ──► Run (gates, defenders, coins) ──► Shootout ──► Level Complete
   ▲                                                        │  coins + fans
   │                      ┌─────────── NEXT LEVEL ◄─────────┤
   │                      ▼                                 │
   └──────────────── Club Hub ◄──────────── CLUB ───────────┘
                     spend coins: upgrades, star players, heal, campaigns
```

Level Complete gains a third button, **CLUB**, next to NEXT LEVEL and MENU. Title gets a CLUB button, replacing or sitting next to SHOP. The existing kit shop moves into the hub as the **Merch store**.

## 5. Systems

### 5.1 Fans (progress, and the score)

- Earned on level complete: `fans = goals × FANS_PER_GOAL × fanMultiplier`.
  - `fanMultiplier = 1 + star popularity bonus + stadium bonus + active campaign`.
- A failed run earns no fans.
- **Fans only ever go up.** This keeps the score rule simple: the value sent by `sendScore` must equal a stored value. Fans replace `bestScore` as the value sent to YouTube.
- **Fans are the club's progress number first and the leaderboard value second.** The design must work even if the leaderboard is ignored (see 5.1.1).

#### 5.1.1 Why raise fans? (the motivation)

A number that only goes up and unlocks nothing is not a goal. Fans are tied into the club in four ways:

1. **Gate:** stadium tiers and the better star players need a fan count as well as coins (e.g. tier 3 needs 500 fans). Coins buy the item, fans decide what the club may buy, so grinding coins alone can't skip ahead.
2. **Income:** merch income is `fans × stadium tier`, so more fans means more coins per level.
3. **Recruitment:** high-popularity stars only sign with a club that has enough fans, so the roster is something to work toward.
4. **Rank (M4):** league divisions have fan thresholds, and each rival club has a fan count to beat.

**Gate strength (decided):** hard gates only on the big items: stadium tiers 3 to 5 and top-popularity stars. Everything cheap (upgrades, kits, tiers 1 to 2, ordinary stars, Doctor, Marketing) is open to anyone with the coins. A locked item shows its fan requirement and a progress bar, so the target is always visible.

Fans come from goals × multiplier, so players raise them by scoring more goals per level, keeping the active star fit, and running marketing campaigns. Gate thresholds live in `src/club/balance.ts`.
- **[DECIDE] Can fans be lost?** E.g. losing streaks or an injured star. Recommend **no** for v1, because losing fans plus a monotonic leaderboard gets confusing.
- Starting value for existing players on migration: `fans = (level − 1) × 20`, so veterans don't start at zero.
- 3D tie-in: crowd density in the stands scales with fans relative to stadium capacity.

### 5.2 Stadium

- Tiers 1 to 5, bought with coins (rising prices) once the club has enough fans (see 5.1.1).
- Each tier raises **capacity**: the share of seats filled in the 3D stands, plus a merch income bonus.
- Each tier also unlocks hub booths: tier 1 has Training and Merch, tier 2 adds Doctor, tier 3 Marketing, tier 4 Scout.
- 3D tie-in: bigger, more colourful stands and more banners per tier, using existing canvas textures.
- **[DECIDE]** Does capacity cap fans, or only how many show in the stands? Recommend **visual and income only, no cap**, since a cap feels like a punishment.

### 5.3 Training ground (upgrades)

Upgrades bought with coins, each with a few levels at rising prices. These are the "Phase 3 upgrades" from the monetization plan, themed as part of the club.

| Upgrade | Effect per level | Levels |
|---|---|---|
| Youth academy | +1 starting squad | 5 |
| Finishing | −1 players per goal (minimum 2) | 3 |
| Fitness coach | Fatigue drains slower | 3 |
| Coin magnet | +10% coin pickup radius | 3 |

### 5.4 Star players

- A **roster** of up to 5 stars. One is **active** and becomes the squad leader on the pitch: a distinct look, a name tag and a coloured ring.
- Stats (small integers):
  - **Popularity** 1 to 5: + fan multiplier.
  - **Skill**: one from the list below.
  - **Fitness** 0 to 100.
- Bought from a **transfer list** of 3 generated candidates, refreshed every N levels. Price comes from popularity and skill.
- Names are generated (seeded name parts). **No real player or club names**, for licensing and YouTube's advertiser-friendly rules.
- **Skill list for v1** (each a hook in `GameScene` or the pure rules):

| Skill | Effect in the run |
|---|---|
| Shield | Ignores the first defender hit |
| Sharpshooter | −1 players per goal in the shootout |
| Rally | +3 starting squad |
| Magnet | Bigger coin pickup radius |
| Showman | +50% fans from this level |

- **[DECIDE] Skills in v1, or popularity only?** Recommend **including skills**. It's the strongest link between the club and the run (pillar 1).

### 5.5 Fitness and injuries

- The active star loses fitness each level played (less with a Fitness coach) and regains it slowly while resting on the bench.
- At low fitness, the skill effect weakens.
- **Injury:** each game over has a chance to injure the active star for N levels. While injured they can't be active. The game still runs with the default leader, so this is never a hard block.
- **[DECIDE]** Should a fatigue or "mental" state make healing cost more? Recommend **not in v1**: a flat doctor price, plus the rewarded option. Variable pricing is hard to balance and hard to read.

### 5.6 Club hub (vendor booths)

One screen showing a stylized stadium concourse with tappable booths. Each booth opens a small panel, not a new full scene.

| Booth | Does | Rewarded-ad option |
|---|---|---|
| Training | Buy upgrades (5.3) | — |
| Merch store | Kits (existing shop) and passive income: coins pile up per level from fans × stadium tier, then "Collect" | Collect ×2 ▶ |
| Doctor | Heal an injury or restore fitness for coins | Heal now ▶ (free, once per injury) |
| Marketing | Campaigns: pay coins for "+50% fans for the next 3 levels" (one active at a time) | Extend +2 levels ▶ |
| Scout | Shows the transfer list, refreshed every N levels | Refresh now ▶ |
| Sponsors (later) | Contracts with goals like "score 20 goals in 5 levels" for coins | — |

The hub shows the coin and fan totals at the top, plus a "PLAY NEXT" button.

### 5.7 League and seasons (later milestone)

- Levels are grouped into seasons of about 10 levels. Each level is a match against a generated rival club, whose defenders and keeper wear the rival's kit.
- A season-end table is computed from the player's results against simulated rivals. Promotion to the next division gives a fan bonus.
- A daily cup could use a level seeded by the date.

## 6. Economy (starting numbers, to be tuned)

- **Income today:** about 40 to 100 coins per level (pickups plus 5 per goal), more with ×3.
- **Target:** the first meaningful purchase in 2 to 3 levels, a stadium tier every 10 to 15 levels, and a new star every 5 to 8 levels.
- All prices and rates live in one data file (`src/club/balance.ts`). A pure simulation test plays 100 levels with "casual" and "skilled" models and prints income vs spend, like the existing difficulty sim.
- The ×3 coins and merch ×2 rewards scale with income, so ads stay worth watching all game.

## 7. Ads integration

- All rewarded options go through `createRewardedButton` with new `REWARD_IDS` entries (stable ids, never renamed).
- **Hub to game is a natural break.** `adPolicy` may run an interstitial on "PLAY NEXT", using the same cadence as NEXT LEVEL. It counts as the same level-completed event, so a player can't get two ads by going through the hub.
- No interstitial when entering the hub. The player is about to spend, so don't interrupt.

## 8. Save data (v2)

Bump `SAVE_VERSION` to 2. `sanitizeSave` must still read v1 and never throw.

```ts
interface SaveDataV2 {
    version: 2;
    level: number;
    coins: number;
    fans: number;               // leaderboard value; only increases
    bestScore: number;          // kept for display ("best goals"), no longer sent
    unlockedKits: string[];
    selectedKit: string;
    stadiumTier: number;        // 1..5
    upgrades: Record<string, number>;          // upgrade id -> level
    roster: StarPlayer[];       // <= 5
    activeStar: string | null;
    transferList: { refreshedAtLevel: number; candidates: StarPlayer[] };
    merch: { pending: number }; // uncollected coins
    campaign: { id: string; levelsLeft: number } | null;
}
interface StarPlayer { id: string; name: string; popularity: number; skill: SkillId; fitness: number; injuredLevels: number; }
```

- **v1 to v2 migration:** keep coins, kits and level; `fans = (level − 1) × 20`; tier 1; empty roster.
- `sendScore(fans)` is sent only after a successful save, as `Progress.completeLevel` does now.
- **Low priority [DECIDE]:** the YouTube score will hold old "best goals" values next to new fan totals if the game ships first with goals. Public docs don't say how prominent the score is or whether it can be reset. Decide before launch which number is sent, and don't change its meaning after real players have scores. Ask Playables support whenever convenient; it does not block M1.

## 9. Architecture

- **Pure logic** (no Phaser or Three, unit tested), in new `src/club/`:
  - `balance.ts`: prices and rates.
  - `fans.ts`: fan gain and multipliers.
  - `players.ts`: generation, pricing, fitness and injury.
  - `upgrades.ts`, `merch.ts`, `campaigns.ts`.
  - `runModifiers.ts`: a single function that turns club state into a `RunModifiers` object (`startSquadBonus`, `perGoalDelta`, `shieldHits`, `coinRadiusMult`, `fanMult`).
- **`GameScene`** reads only `RunModifiers`, never club state directly. That keeps the runner testable and the coupling to one point.
- **`Progress`** gets the club mutators (`buyUpgrade`, `buyStar`, `setActiveStar`, `heal`, `collectMerch`, `startCampaign`), each saving on change as today.
- **Scenes:** a new `ClubScene` (the hub with panels as containers). `ShopScene` becomes the Merch panel or is reused from it. `LevelCompleteScene` and `TitleScene` gain CLUB buttons. `devStart` gains `?scene=Club`.
- **3D:**
  - `World3D` takes `crowdFill` (0–1) and `stadiumTier` for the stands.
  - `SquadView` takes a leader style (hair or boot colour, name tag) for the active star.
- **Art:** follow `.claude/skills/art-direction`. The hub needs a concourse backdrop and booth icons drawn on canvas in `src/art/textures.ts`. Verify with the capture skill.

## 10. Milestones

Each milestone ships on its own, and the game stays fully playable after each.

**M1: Fans and hub shell (vertical slice)**
- Save v2 and migration.
- Fans are earned and shown on Level Complete and the HUD, and become the leaderboard value.
- `ClubScene` with **Training** (4 upgrades) and **Merch** (existing kits plus passive income with "Collect ×2 ▶").
- CLUB buttons; crowd density follows fans.
- *Done when:* a v1 save migrates cleanly, the upgrades change the run, and the sim shows a purchase every 2–3 levels.

**M2: Star players**
- Roster, active star as leader, the 5 skills through `RunModifiers`.
- Scout booth (transfer list).
- Fitness, injuries, Doctor booth with "Heal now ▶".

**M3: Stadium and marketing**
- Stadium tiers with 3D changes and booth unlocks.
- Marketing campaigns with "Extend ▶".

**M4: League (optional)**
- Seasons, rival clubs, promotion, sponsors, daily cup.

## 11. Open questions (with recommended defaults)

1. Can fans decrease? → **No** (v1).
2. Does stadium capacity cap fans? → **No**, visuals and merch income only.
3. Skills in v1? → **Yes**, 5 simple run effects.
4. Variable healing cost from fatigue or morale? → **No**, flat price plus rewarded heal.
5. Does the Scout exist from M2, or does the transfer list sit in the hub? → **Scout booth in M2**, as the transfer list.
6. Does the kit shop stay a separate scene? → **No**, it becomes the Merch booth.
7. Leaderboard reset at launch? → Low priority. Send fans from the first launch so no reset is needed; ask support when convenient.
8. Club name and badge picked by the player? → Nice to have in M3; random generated name at first.

## 12. Out of scope

Real-money purchases (not available on Playables yet; reportedly tested in 2027), multiplayer or real trading, real-time timers, real player or club names, and any network calls besides the SDK.
