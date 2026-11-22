# Insights from LILA BLACK Player Data

## Insight 1: Ambrose Valley carries most of the observed play

**What caught my eye:** 566 of 796 matches (71.1%) are Ambrose Valley, compared with 171 Lockdown and 59 Grand Rift.

**Evidence:** It accounts for 61,013 rows and 217 observed human IDs. Its Southwest and Northwest quadrants contain 36,180 of 48,754 all-player traffic samples (74.2%). This makes it both the primary balancing surface and the map with the strongest sample confidence.

**Actionable:** Validate the 566-match map-weighting hypothesis, then compare player retention and match quality with and without rotation weighting. Add a loot-quality and spawn fairness pass to Ambrose Valley first because it has the most impact.

**Metrics:** map match share, map queue time, 30-day retention by map, and post-match abandonment.

**Why it matters:** Level changes need to be prioritized by actual exposure. Grand Rift's only 59 matches currently have too little signal for confident layout conclusions.

---

## Insight 2: Human traffic and loot cluster in a few southwest/south zones

**What caught my eye:** On Ambrose Valley, the largest human-traffic and loot hotspots are near minimap pixels (408, 808), (360, 888), and (600, 568).

**Evidence:** The (408, 808) cell has 484 human-traffic samples and 179 loot events; the (360, 888) cell has 385 human-traffic samples and 346 loot events. Human traffic in SW/NW is concentrated while the NE quadrant receives only 3,747 of 36,189 human samples (10.4%).

**Actionable:** Inspect these areas for cover, rotation options, and loot balance. Test whether NE should receive denser looting or safer traversal, and move or split loot if the concentrated SW loot point is creating predictable fights.

**Metrics:** loot acquisition per player, time-to-first encounter, deaths per 10 minutes, quadrant utilization, and player concentration entropy.

**Why it matters:** Persistent low-use and high-use zones can indicate strong map funnels or underused geometry. Designers can correct imbalance before tuning the whole map.

---

## Insight 3: A small number of death and storm hotspots are identifiable

**What caught my eye:** The all-death heatmap concentrates around Ambrose Valley cells (424, 488), (360, 568), and (424, 504), while Lockdown has 17 storm deaths but Grand Rift only five.

**Evidence:** Those three Ambrose Valley cells contain 42 combined death events, led by 16 at (424, 488). The dataset has 39 total storm deaths: 17 Ambrose Valley, 17 Lockdown, and 5 Grand Rift.

**Actionable:** Place cover and extraction cues around repeated death zones, and compare storm-death location by match phase. If storm deaths repeatedly occur far from extraction routes, adjust extraction access or warning timing rather than adding more loot.

**Metrics:** storm-death rate, extraction success, match survival time, and death location by match phase.

**Why it matters:** Repeated storm deaths are more actionable than isolated combat deaths because they indicate whether the map communicates danger and supports viable extraction routes.
