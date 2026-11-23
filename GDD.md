# BOJU BOJU: Hunt & Seek — Game Design Document (GDD)

**Version:** 0.1 (Phase 0 design baseline)
**Status:** GDD complete, awaiting decisions / "next phase" to begin implementation

**Inspiration:** Original "paint-to-hide" multiplayer hide-and-seek (paint your body to blend into the environment). No copied names, characters, maps, assets, or UI from existing games.

## 0. Product Summary

### High concept
A web-based 3D multiplayer hide-and-seek game where **Chameleons (Hiders)** paint a plain white humanoid body, strike a pose, and blend into richly detailed environments while **Hunters (Seekers)** search and tag/shoot suspicious spots before time runs out. Bold, in-plain-sight camouflage is rewarded.

### Pillars
- **Blend to win:** Painting, posing, and stillness create skillful camouflage and memorable "how did I miss that?" moments.
- **Readable fairness:** Clear rules, server-enforced voice/round logic, and anti-frustration balance (no spray-and-pray, no invisible cheats).
- **Clip-worthy social play:** Friends-vs-others rooms, hero hiding spots, MVP highlights, and shareable moments.
- **Web-first, scalable:** Runs in-browser on desktop/mobile with progressive quality; authoritative server for round/score-critical events.

### Target experience
- 4-12 players: fast, intimate matches (primary tuning target).
- Up to 20 players (10v10): larger, zone-scaled matches with higher prop density and more seekers.
- Session length: ~7-9 minutes per round including lobby/results.

## 1. Technical Direction & Current Baseline

### Target stack (from spec)
- **Frontend:** React + TypeScript + Three.js / React Three Fiber (+ physics/helpers as needed)
- **Backend:** FastAPI (Python), WebSockets for realtime game/room events
- **Database:** PostgreSQL (production), migrations/models for users/rooms/matches/reports/assets metadata
- **Voice:** LiveKit (FastAPI mints tokens; server-side channel/subscription enforcement)
- **Deployment:** Render (API web service, web static site, managed Postgres; optional Redis/LiveKit infra as configured)

### Current baseline in this repo (prototype)
- Monorepo: pps/web (Vite/React/R3F/Rapier/Zustand), pps/api (FastAPI/SQLAlchemy async/WebSockets), packages/shared/*.
- Auth, lobby/rooms, invite code/link, friend team preferences, quick match/public rooms implemented.
- Round phases exist in simplified form (lobby -> hiding/prep-like -> seeking -> ended), server-balanced teams, server-side phase/team/elimination events; movement/state relay is lightweight and not fully authoritative/anti-cheat.
- In-memory room/game state (single-instance oriented), SQLite local default / Postgres-compatible config; Redis optional with fallback.
- Current arena has basic chameleon/hunter visuals, simple paint color + pose/form camouflage and lock, tap/click tag interaction, mobile/virtual controls, and procedural animation polish.
- **Gap to this GDD:** no full body UV paint canvas/eyedropper/upload-once texture pipeline, no pose wheel/limb adjust/shimmer/LoS scoring, no hitscan gun/ammo/penalties, no LiveKit voice/noise-ping system, no production map pipeline/art/baked lighting/25MB budget enforcement, no moderation/content checks/clip capture/telemetry-balanced 20-player maps yet.

## 2. Core Gameplay

### 2.1 Teams and match sizes
| Setting | Value | Notes |
|---|---|---|
| Max players per room | 20 | 10 Hiders, 10 Seekers (ideal) |
| Supported room sizes | 4-20 | Must feel good at 4-12; auto-balance teams |
| Team ratio target | ~50/50 | For odd counts, configurable bias (default: +1 Hider in small casual rooms, +1 Seeker in competitive) |
| Scaling | Dynamic | Scale active map zones, prop density, seeker ammo/count pressure, and spawn spread by player count |

### 2.2 Characters
- **Hider (Chameleon):** Plain **white low-poly humanoid** base. Must paint body and choose pose to match surroundings. Unpainted white areas (elbows, hands, backs of legs, etc.) are intentional tells.
- **Seeker (Hunter):** Distinct readable silhouette/equipment; gameplay focus on observation, movement, and disciplined shots.
- **Lobby customization:** Player name and **body shape/type only** (not body paint color). Cosmetic unlocks later (poses, brush effects, hats) must not grant camouflage pay-to-win.

### 2.3 Round flow
1. **Lobby**
   - Ready up, join via link/code/quick match/public list.
   - Map vote (from available pool; weighted/random fallback).
   - Select body type/name/cosmetic shape-only options.
   - Host chooses room voice-rule preset and configurable round settings (within allowed bounds).
2. **Prep Phase** (default **75s**, configurable)
   - Hiders spawn into map, explore, pick a spot, paint, pose, and lock in.
   - Seekers wait in a **sealed spawn room** with countdown; cannot see map.
   - Hider paint is local/WIP; other players see neutral/white body during prep.
3. **Seek Phase** (default **300s / 5 min**, configurable)
   - Seekers released with guns and hunt.
   - Hider painting locked at prep end; hiders must remain still to preserve camouflage advantage.
   - Eliminated hiders become spectators (free-fly cam, spectator-only voice channel).
4. **Results**
   - Scoreboard, MVP highlights, replay-moment screenshot/clip marker, awards, return to lobby.

### 2.4 Hider rules
- **Paint lock:** No repainting during Seek Phase.
- **Pose system:** Pose wheel with **12-15 preset poses** (e.g. stand, lean wall, crouch ball, flat floor, arms up, side profile, hug pillar, T-pose, sit, kneel, peek-low, stretch, crate-huddle, wall-press; final set tuned per rig/map readability). Limited limb-adjust mode planned later.
- **Lock-in:** Key press freezes pose/placement state for camouflage.
- **Movement/shimmer:** While seekers are within **line of sight**, movement causes a subtle **shimmer outline visible to seekers for 2s** (refreshes on continued movement; server-validated visibility context where feasible).
- **In-plain-sight scoring:** Hiders earn points **every second** they are inside a seeker's **field of view** (within **15 m**, unobstructed) without being shot. Rewards bold hiding.
- **Survival bonus:** Awarded if alive when timer ends (scaled by time survived / boldness metrics).

### 2.5 Seeker rules
- **Gun:** Hitscan, **limited ammo** (default 12), **slow reload**, short fire cooldown.
- **Elimination:** Hitting a valid hider eliminates them.
- **Miss penalty (anti-spray, configurable):** Shooting a non-hider costs penalty (default: consume ammo + brief movement/aim slow; optional HP/time/score penalty variants by mode/preset).
- **Scoring:** Points per elimination + **first-spot assist** points for pinging a hider for teammates (assist credit only; elimination still requires a shot).
- **Post-elimination:** Eliminated hiders become spectators with free-fly camera and spectator-only voice channel.

### 2.6 Optional game modes (design now, implement later)
| Mode | Core change | Design intent |
|---|---|---|
| Tag Mode | No guns, touch/contact to catch | Family-friendly/lower-intensity |
| Chaos Mode | Everyone hears everyone nearby (voice rules relaxed) | Party/social clips |
| Streamer Mode | Viewers vote on twists/events; host controls | Streaming engagement |
| Speed Round | 30s prep, shorter seek timer | Fast rounds/high tempo |

## 3. Paint System (Web Implementation)

### 3.1 Paint panel UX
- Toggle key: **F** (rebindable). Opens paint workspace with **mirror/character preview**; rotate preview with mouse/touch drag.
- **Tools:** Brush (size, softness), eraser, fill bucket, undo/redo (**20 steps**), symmetry toggle (left/right mirror), full color picker + recent-colors strip.
- **Eyedropper (critical):** Pick color directly from 3D world by sampling rendered scene at crosshair (**render-target pixel read**). Must be fast and frame-budget aware.
- **Hold-up helper:** Toggle showing nearby surface behind player as faint overlay for pattern matching; **limited use and/or disabled in ranked/competitive presets**.
- **Mobile (later):** Touch painting with simplified tool set and larger hit targets.

### 3.2 Body regions and feedback
- UV-mapped character with independent paint areas: head, torso, arms, hands, legs, feet (and subregions as needed for clarity).
- Highlight unpainted white areas with warning indicator.
- Show **Paint Completeness %** to teach beginners (avoid obvious white elbows/hands/backs of legs).

### 3.3 Technical pipeline
- **Per-hider texture:** 512x512 canvas (256x256 on low quality/mobile/perf mode).
- **Local-first during prep:** No network paint stroke traffic while editing.
- **Visibility during prep:** Other players see only white/neutral body (prevents live copying).
- **Upload-once at prep end:** Compress texture (PNG or WebP, target **< ~60 KB**), upload once to server, server validates and relays to clients.
- **Runtime:** Apply as lit material texture reacting to environment lighting; mipmaps/LOD as needed for performance.

### 3.4 Server validation and moderation
- Validate max size, dimensions, format, and rate limits; reject malformed payloads.
- Automated content check pipeline (configurable provider/rules) + **report button** for offensive drawings.
- Store texture hash and texture/artifact reference for moderator review/audit; retain per policy.
- Abuse controls: cooldowns, repeat-offender restrictions, room/kick/ban hooks.

### 3.5 Lighting and anti-advantage rendering
- Lit materials with baked lighting and soft shadows so paint blends naturally.
- No seeker-only shader/material advantage.
- Consider subtle film grain/post effect on seeker view to reduce pixel-scanning/cheat readability (tunable for accessibility).

## 4. Maps

### 4.1 Global map design rules
- **Paint-friendly richness:** Mix of patterns (tiles, wallpaper, wood grain, fabric, graffiti, foliage, mosaics), varied lighting (bright/dim/colored/shadows), and multiple surface scales.
- **Balance:** Avoid large flat single-color expanses everywhere and avoid pure visual noise everywhere.
- **Size/layout (20 players):** ~120-180 m across, multiple floors/zones, **>= 25 distinct hide zones**, and loops so seekers cannot cover everything from one spot.
- **Hero spots:** 2-3 iconic, clip-worthy hiding places per map.
- **Spawns:** Sealed seeker room; hiders spread across **6+ spawn points**.
- **Performance budget:** Instanced props, baked lighting, LOD, target **< ~25 MB per map** payload.
- **Data:** Map metadata file (name, size, recommended players, spawn points, hide-zone tags) and server collision/nav/LoS data as required.

### 4.2 Original map concepts (build 1 first)
1. **Open-Air Market Street** *(Phase E first real map)*: stalls, fabric rolls, fruit crates, tarpaulins, painted signs, narrow alleys, generator corner. Strong color/pattern variety.
2. **Wedding Hall:** ankara/aso-ebi patterned tablecloths, decor walls, stage, buffet area, colored party lights. Bold patterned painting and dynamic lighting.
3. **Danfo Bus Depot:** buses with graffiti/stripes, tires, oil drums, workshop, rusty metal textures. Gritty high-contrast hiding.
4. **Old School Compound:** classrooms, chalkboards, corridors, field with trees, murals. Indoor/outdoor mix, beginner-friendly.
5. **Beach Resort:** pool, cabanas, palms, striped umbrellas, rooftop bar. Bright open light, harder blending, high-risk/high-reward.

### 4.3 Map editor concept (later)
- glTF import + zone tagging workflow for community submissions.
- Validation pipeline (perf/size/collision/spawn/hide-zone requirements) before publishing.

## 5. Mic / Voice Communication (LiveKit)

### 5.1 Architecture and enforcement
- **Provider:** LiveKit; **FastAPI mints tokens**.
- **Server-side enforcement only:** Channel membership and subscription permissions controlled by server/room rules (never trust clients).
- Recompute permissions on phase changes, team changes, elimination/spectate transitions, mute/mod actions.

### 5.2 Channels by phase
| Phase | Who hears whom | Behavior |
|---|---|---|
| Lobby / Results | Everyone | Open voice |
| Prep Phase | Hiders↔Hiders, Seekers↔Seekers | Team-only, no cross-team audio |
| Seek Phase (Hiders) | Hiders↔Hiders (proximity) | 3D spatial audio, falloff to silence at ~15 m; walls muffle with low-pass filter |
| Seek Phase (Seekers) | Seekers↔Seekers | Team radio by default (optional proximity toggle by preset/config) |
| Seek Phase (Cross-team) | Seekers do **not** hear hiders directly | Hider speech generates server-side **Noise Event** via hidden LiveKit participant (active-speaker/audio levels): louder speech => larger/fuzzier ping direction on seeker HUD + faint muffled spatial sound within ~10 m |
| Spectators | Spectators only | Living players never hear spectators |

### 5.3 Room voice-rule presets (host-selected, shown in lobby)
| Preset | Rules |
|---|---|
| FAIR (default) | Standard phase/team/proximity/noise-ping rules above |
| CHAOS | Everyone hears everyone in proximity (including cross-team near range) |
| SILENT HIDERS | Hiders cannot speak after prep ends; seekers keep radio |
| STREAMER | Viewers muted by default; host can unmute selected viewers (with safety controls) |

### 5.4 Controls and safety
- Voice **OFF/muted by default** for new users with clear enable prompt; **push-to-talk default (V)** with open-mic option.
- Visible mic/transmit icon; speaking indicator above nameplates only for allowed audiences.
- User options: disable voice entirely, per-player mute/volume, block, mute-all.
- **Reporting:** Button stores last **30s metadata** (who/when/room/context) for moderators; **no audio recording** without explicit legal/consent design.
- Moderation: hosts/mods can mute/kick; auto-mute after repeated reports; minimum age/safety notice in terms; clear mic permission and HTTPS handling with friendly errors.

## 6. Scoring, Balance, and Config

### 6.1 Scoring model (design defaults)
- **Hider in-plain-sight:** +hider_fov_points_per_sec while inside any seeker's FOV, within 15 m, unobstructed, not shot (server-evaluated intervals).
- **Hider survival:** +hider_survival_bonus at round end if alive (optionally scaled by survival time / exposure time).
- **Seeker elimination:** +seeker_elim_points per valid hider eliminated.
- **Seeker first-spot assist:** +seeker_assist_points for valid ping/spot assist (shot still required for elimination credit chain as designed).
- **Seeker miss penalty:** ammo loss always; configurable additional slow/HP/score penalty for non-hider hits.

### 6.2 Balance/config table (server-authoritative defaults, tunable)
| Key | Default | Range/notes |
|---|---:|---|
| oom.max_players | 20 | 4-20 |
| 	eams.max_hiders | 10 | Derived by room size/balance rules |
| 	eams.max_seekers | 10 | Derived by room size/balance rules |
| ound.prep_seconds | 75 | 30-120 configurable |
| ound.seek_seconds | 300 | 120-600 configurable |
| ound.results_seconds | 20 | 10-45 |
| hider.paint_lock_on_prep_end | true | Always true in standard modes |
| hider.pose_count_target | 12-15 | Preset poses in wheel |
| hider.lock_key | L / pose-lock action | Rebindable |
| hider.shimmer_duration_ms | 2000 | Triggered on movement while in seeker LoS |
| hider.fov_score_distance_m | 15 | Unobstructed, within seeker FOV |
| hider.fov_points_per_sec | 2 | Tuning via telemetry |
| hider.survival_bonus | 150 | Flat or scaled variant |
| seeker.gun_mode | hitscan | — |
| seeker.ammo | 12 | Per magazine/loadout |
| seeker.reload_seconds | 2.0 | Slow reload |
| seeker.fire_cooldown_ms | 350 | Prevent spam, maintain skill |
| seeker.elim_points | 100 | Per valid elimination |
| seeker.assist_points | 25 | First-spot/ping assist |
| seeker.miss_penalty_ammo | 1 | Always on hit attempt resolved as miss/non-hider |
| seeker.miss_penalty_slow_ms | 600 | Configurable |
| seeker.miss_penalty_score | 0 | Optional competitive variant |
| paint.texture_size_high | 512 | px square |
| paint.texture_size_low | 256 | px square |
| paint.upload_max_bytes | 61440 | ~60 KB compressed |
| paint.undo_steps | 20 | Local editor |
| oice.preset_default | FAIR | FAIR/CHAOS/SILENT HIDERS/STREAMER |
| oice.hider_proximity_m | 15 | Seek-phase hider proximity |
| oice.cross_team_muffle_m | 10 | Faint muffled spatial on noise event |
| oice.ptt_default_key | V | Rebindable, PTT default |
| map.target_payload_mb | 25 | Per map budget target |

*All values are initial tuning targets and must be adjustable per room preset/mode and refined from telemetry.*

## 7. Social and Growth Features (design now, build later)
- **Access:** Join by link and room codes, public quick-match, public servers list with language tags.
- **Auto-clip system:** Capture best moments (e.g. seeker walked past a hider, survived 60s in plain sight) as ~10s video/GIF with share button (e.g. X).
- **Engagement:** Daily challenges (example: "Hide as a wall tile in the Wedding Hall"), leaderboards (best camouflage score, most eliminations), cosmetic unlocks (poses, brush effects, hats).
- **Streamer tools:** Viewer join mode, room overlays, spectator-friendly camera.

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Offensive/abusive paint textures | Safety/moderation/legal/community harm | Upload validation, automated checks, report flow, hash+storage for review, rate limits, sanctions |
| Voice abuse/harassment | Player safety/churn | Default-muted onboarding, PTT default, per-user controls, server-enforced channel rules, metadata reports, host/mod tools, auto-mute |
| Client cheating (wallhacks, aim/shot spoofing, pigment/LoS spoofing) | Fairness/integrity | Server-authoritative round/elim/score-critical checks where possible, validation, anomaly detection, progressive hardening |
| Performance on low-end/mobile browsers | Accessibility/reach | LOD/instancing/baked lighting, texture size tiers, quality presets, payload budgets, simplified mobile UX |
| Network/instance limits (current in-memory rooms) | Reliability/scale | Single-instance constraints documented; evolve to shared state/pubsub or dedicated match service for horizontal scale |
| Eyedropper/render-read cost | Frame drops/input lag | Throttled sampling, render-target readback optimization/fallback, UI feedback |
| Content/asset production scope (5 maps, art, audio) | Schedule/quality | Greybox-first phases, one polished first map (Market Street), reusable prop/material pipeline |
| LiveKit cost/ops complexity | Hosting cost/availability | Preset fallbacks (text/pings-only modes), regional/usage planning, observability |

## 9. Implementation Phases (stop after each phase and wait for "next phase")

| Phase | Goal | Key deliverables | Exit criteria |
|---|---|---|---|
| **A** | Greybox + hider paint tool (single-player/local feel) | Greybox test space; paint panel (F), mirror preview, brush/eraser/fill/undo-redo/symmetry/picker/recent, eyedropper, hold-up helper; UV body regions + completeness warning; pose wheel/lock-in basics | Player can paint/pose/lock locally with completeness feedback in greybox |
| **B** | Multiplayer sync + texture upload/relay | Player sync improvements; prep-end compress/upload-once pipeline; server validation/relay; others see neutral during prep then applied texture | Multiple clients see consistent locked appearances after prep |
| **C** | Round flow, seeker gun, LoS scoring, eliminations | Full prep/seek/results loop; hitscan gun/ammo/reload/cooldown; miss penalties; LoS+distance+obstruction scoring; elimination/spectate transitions; scoreboard basics | Playable hiders-vs-seekers round with server-tracked outcomes/scoring |
| **D** | LiveKit voice + channel/preset rules + noise pings | Token minting, server-side subscriptions by phase/preset/team/proximity; PTT/UI indicators/controls; hider proximity spatial+muffle; seeker radio; cross-team noise events -> HUD ping + muffled cue; spectator channel | Voice rules enforced per FAIR/CHAOS/SILENT HIDERS/STREAMER in test rooms |
| **E** | First real map (Open-Air Market Street) | Art pass, baked lighting, props/material variety, hero spots, spawns/hide zones, metadata/collision, performance budget pass | Map playable, performant, and supports paint-to-hide gameplay |
| **F** | Moderation, reports, paint content checks, clip capture | Report flows/metadata, mod tools hooks, automated paint checks + review storage, auto-clip/replay-moment capture MVP | Safety/reporting and basic shareable moments operational |
| **G** | More maps, balance tuning, launch checklist | Additional maps, telemetry-driven tuning, UX/polish, load/perf/security checks, deployment/runbook | Launch-ready candidate with tuned defaults |

### Phase A implementation note (for "next phase")
Phase A will extend the current prototype (not discard it): evolve existing greybox/arena, player rig, store/UI, and networking seams toward the GDD paint/pose/lock requirements while keeping current room/auth flow usable where practical.

## 10. Decisions Needed From Me (please confirm before/during implementation)

1. **Scope priority:** Implement strictly in phase order (A→G) with minimal detours, or allow opportunistic fixes/refactors when touching systems?
2. **Single-player Phase A form:** Should Phase A paint/pose practice run in the existing /play sandbox route, a new dedicated route/mode, or both?
3. **Paint fidelity in Phase A:** Target full UV body painting (texture canvas per region/unwrapped humanoid) now, or an intermediate "regional/material paint + pattern stamps" step before full UV? (full UV is higher effort but aligns best).
4. **Authoritative gameplay depth:** For Phase C+, how far should server authority go initially (phase/elim/score authoritative only vs server-validated shots/LoS/movement reconciliation)?
5. **Voice infrastructure:** Do you already have LiveKit (cloud/self-host) credentials/URL for Phase D, or should Phase D be built behind a feature flag/mock interface first?
6. **Paint moderation/content checks:** Preferred approach for automated checks in Phase F (external moderation API, simple heuristic/manual queue MVP, or both)? Any hosting/compliance constraints?
7. **Art/assets pipeline:** Will you provide/create 3D map/prop assets (or commission them), or should implementation use procedural/kitbashed greybox-to-stylized assets produced in-code where possible?
8. **Persistence scope:** Which features need DB persistence early (match history, leaderboards, cosmetics, reports, texture artifacts) vs later phases?
9. **Map/editor timing:** Keep map editor as late-phase concept only, or reserve data/schema decisions earlier to avoid rework?
10. **Platform target for MVP:** Desktop-first acceptable for Phases A-E with mobile best-effort, or must mobile be fully supported earlier (especially touch painting/controls)?
11. **Room scale rollout:** Keep current smaller-room tuning stable first and expand to 20-player scaling in a specific phase, or target 20-player-capable architecture decisions immediately?

---
**GDD complete.** Implementation will proceed **phase by phase** and stop after each phase for your "next phase" confirmation.

