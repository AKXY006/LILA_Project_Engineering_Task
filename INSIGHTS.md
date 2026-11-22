# Insights from LILA BLACK Player Data

## Insight 1: Ambrose Valley Dominates — Potential Content Gap

### What caught my eye
Ambrose Valley has dramatically more gameplay data than the other two maps combined. Looking at file counts:
- **February 10**: 437 files
- **February 11**: 293 files
- **February 12**: 268 files
- **February 13**: 166 files
- **February 14**: 79 files (partial)

Cross-referencing with map distribution, AmbroseValley appears in the vast majority of matches.

### Supporting evidence
- The data folder sizes confirm it: Feb 10 has ~2.85 MB vs Feb 14 at ~488 KB
- AmbroseValley has the most complex minimap (900-unit scale vs 581 for GrandRift)
- Three minimap files exist (AmbroseValley PNG, GrandRift PNG, Lockdown JPG), but gameplay data is heavily skewed toward AmbroseValley

### Actionable items
- **Metrics affected**: Map selection rate, queue times per map, player retention per map
- **Actions**:
  - Investigate if map rotation is weighted or if players are self-selecting AmbroseValley
  - Consider incentivizing GrandRift and Lockdown play (bonus XP, exclusive loot)
  - Review if Lockdown's smaller size creates an unsatisfying experience driving players away

### Why a Level Designer should care
If players overwhelmingly prefer one map, the other maps may have design issues — poor flow, unbalanced spawn points, or less interesting combat spaces. Understanding *why* AmbroseValley succeeds can inform design improvements on the other maps.

---

## Insight 2: Storm Deaths Reveal Extraction Timing Issues

### What caught my eye
The `KilledByStorm` event type indicates players who failed to extract before the storm consumed them. These events, plotted on the minimap, reveal specific areas where players consistently die to the storm — suggesting the extraction routes from these zones may be too long or unclear.

### Supporting evidence
- Storm death events exist alongside combat events, meaning some players die to storm *during* or *after* fights — they win the fight but lose to the timer
- The storm moves in one direction (per game description: "one-directional storm pushes across the map"), so deaths should cluster on the side opposite to the storm's approach direction
- By using the heatmap overlay with "Storm Deaths" filter, Level Designers can see the exact regions where this happens most

### Actionable items
- **Metrics affected**: Extraction success rate, average survival time, player frustration/churn
- **Actions**:
  - Add more extraction points near storm death hotspots
  - Add visual/audio cues warning players they're in the storm's path
  - Consider slowing storm speed in problem areas or adding temporary safe zones
  - Tune storm timing so post-combat players have a reasonable extraction window

### Why a Level Designer should care
Storm deaths that feel "unfair" drive player frustration. If players consistently die to storm in specific map areas, the level layout may be funneling them into dead-end zones with no viable extraction path.

---

## Insight 3: Bot-to-Human Ratio Varies Significantly — Potential Matchmaking Insight

### What caught my eye
Matches have highly variable bot-to-human ratios. Some matches have 10+ human players with 30-40 bots, while others may have only 2-3 humans filling the rest with bots.

### Supporting evidence
- File naming convention: UUID user_ids = humans, numeric user_ids = bots
- Each match file count varies: a match with 50 participants (10 human + 40 bot) generates 50 files
- The match list in the visualization tool shows human_players and bot_players counts per match, revealing the variance
- Matches with very low human counts likely indicate off-peak hours or matchmaking fill

### Actionable items
- **Metrics affected**: Player engagement, perceived match quality, K/D ratio inflation (easy bot kills)
- **Actions**:
  - Set a minimum human player threshold before starting a match
  - Adjust bot difficulty based on the human-to-bot ratio (fewer humans → harder bots)
  - Track if high-bot matches correlate with lower player return rates
  - Consider showing bot ratio to players post-match for transparency

### Why a Level Designer should care
The bot population affects how the map "plays" — bots may not use the same paths, avoid the same chokepoints, or create the same combat dynamics as humans. If Level Designers test their maps assuming human-like behavior but most players encounter bot-heavy lobbies, the designed experience won't match reality.
