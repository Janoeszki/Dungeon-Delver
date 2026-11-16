# Project: Dungeon-Delver — Scary First Floor

## Architecture
- **Runtime Stack**: Zero-build, zero-npm-dependency vanilla ES Modules (`"type": "module"`) served by Node.js static server (`server.js`, default port `8085`, overrides via `PORT`) using vendored Three.js r160 (`vendor/three.module.js`).
- **Dual-Track Organization**:
  - **Implementation Track**: Data-driven Floor 1 topology + nav-grid + encounter/trap factory (`js/floor1Layout.js`, `js/encounters.js`) -> Monster & Combat expansion (`js/combat.js`) + Horror Soundscape (`js/audio.js`, `js/music.js`) -> Multi-room 3D Overworld Engine (`js/dungeonWorld.js`, `js/overworldProps.js`) -> Game Controller, HUD, Modals & Docs (`index.html`, `README.md`) -> Final Milestone (E2E Tiers 1-4 + Tier 5 Hardening).
  - **E2E Testing Track**: Opaque-box, requirement-driven browser & end-user E2E suite (`TEST_INFRA.md`, `tests/e2e/`, `TEST_READY.md`) exercising `server.js` + headless Chromium WebGL (`--enable-unsafe-swiftshader`).
- **Data Flow**:
  - Screen 0 (`TitleSceneApp`) / Screen 1 (`CharacterCreatorApp`) -> `switchToAdventure()` in `index.html` resets player & run state, instantiates `DungeonWorldApp(viewportAdventure, heroConfig, callbacks)` with a fresh cloned Floor 1 state (`createFloor1Run()`).
  - `DungeonWorldApp` builds 3D multi-room geometry from `FLOOR_1`, maintains a 2D walkable nav-grid + A* pathfinder + door blockers, animates overworld monsters/traps + player torchlight + room discovery fog-of-war, and invokes callbacks on encounter/trap/door/room/exit events.
  - `index.html` routes encounters to `#encounterModal` (D20 multi-stat skill/disarm/door checks) or `#combatModal` (`CombatStage3D`), handles trap lethality & defeat respawn via `adventureApp.respawnAtEntrance()`, updates `#hudRoom`/vignette/dread log, and handles Floor 1 Exit victory.

## Code Layout
| Path | Owner Milestone | Purpose |
|------|-----------------|---------|
| `js/floor1Layout.js` | M1 | Pure Floor 1 spatial definition (small entrance -> Room 1 -> Rooms 2-6 -> exit), 2D nav-grid compiler, A* pathfinder, wall/door collision, room-exclusivity validator |
| `js/encounters.js` | M1 | Immutable factory `createFloor1Run()` & monster/trap/door/shrine/exit definitions; zero mutable module-level globals |
| `package.json` | M1 | Adds `"test": "node --test tests/unit/*.test.js"` without adding external npm dependencies |
| `tests/unit/floor1.test.js` | M1 | Node unit tests for Floor 1 connectivity, door gating, collision, room exclusivity, and cloned run state |
| `js/combat.js` | M2 | `MONSTERS` (`skeleton`, `crypt_ghoul`, `crypt_spider`, `shadow_wraith`), `CONSUMABLE_ITEMS` (fixes `Ancient Bone Ring`), `CombatStage3D` models & `playMonsterDefeat` scale fix |
| `tests/unit/combat.test.js` | M2 | Node unit tests for monster balance/schemas, consumables, and `CombatStage3D` model support |
| `js/audio.js` | M3 | `SoundController` horror/trap/door/monster/discovery Web Audio SFX |
| `js/music.js` | M3 | `MusicController` scary Floor 1 dread cues / ambient crypt enhancements |
| `tests/unit/audio.test.js` | M3 | Node unit tests with mock `AudioContext` verifying all SFX & music methods fail-safe |
| `js/dungeonWorld.js` | M4 | `DungeonWorldApp` multi-room 3D geometry, South-wall cutaway, collision/A*, WASD + click movement, dark lighting/player torchlight/room fog-of-war/pooled `PointLight`s |
| `js/overworldProps.js` | M4 | Modular 3D builders for overworld monsters (`crypt_ghoul`, `crypt_spider`, `shadow_wraith`), 4 animated trap types, and scary crypt props/particles |
| `tests/unit/dungeonWorld.test.js` | M4 | Node unit tests for overworld contracts, entity coverage, light budget, and approach/visibility logic |
| `index.html` | M5 | Full `switchToAdventure()` reset, retryable doors, trap lethality, flee/defeat fixes, item bonuses, Floor 1 Exit modal, horror HUD/vignette/dread log |
| `README.md` | M5 | Synchronized documentation of project structure, Floor 1 features, and test commands |
| `tests/unit/controller.test.js` | M5 | Node tests verifying controller HTML/script contracts & zero syntax/DOM-hook mismatches |
| `TEST_INFRA.md` | E2E Track | Requirement-driven opaque-box E2E architecture & coverage matrix |
| `tests/e2e/**` | E2E Track | Headless Chromium CDP + `server.js` E2E test runner and Tiers 1-4 test cases |
| `TEST_READY.md` | E2E Track | Completion signal & runner command for Final Milestone Phase 1 |
| `server.js`, `js/stats.js`, `js/dice.js`, `js/characterBuilder.js`, `js/characterCreator.js`, `js/titleScene.js`, `vendor/three.module.js` | Unmodified (preserve contracts) | Existing core server, character forge, dice, stats, title screen, Three.js r160 |

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Floor 1 Spatial Graph & Small Entrance | Data-driven Floor 1 topology starting at a tight, small entrance vestibule leading via a narrow doorway into a first main room (`Room 1`), followed by 5 interconnected rooms (`Rooms 2-6`) leading to a Floor 1 Exit Seal/Stairs | M1 | `ORIGINAL_REQUEST.md`, Survey 1/2/3 |
| 2 | Exclusive Monster-or-Trap Room Rule & Validator | Every room following the first chamber is strictly typed as `'monster'` OR `'trap'` (never both in the same room, never empty), enforced by `validateFloor1()` and supporting optional seeded theme selection | M1 | `ORIGINAL_REQUEST.md`, Survey 2/3 |
| 3 | 2D Nav-Grid, A* Pathfinding & Door/Wall Collision | Rasterized walkable grid, wall/pillar/closed-door bounding boxes, doorway gating (`unlocksDoor`), and pathfinding around corners so players cannot clip through walls or skip locked doors | M1 | Survey 1/2/3 |
| 4 | Per-Run Cloned Encounter & Trap Factory | Replace mutable global `ENCOUNTERS` singleton with pure `createFloor1Run()` factory supporting `kind: 'combat' | 'trap' | 'door' | 'shrine' | 'exit'`, explicit trap states (`armed|revealed|triggered|disarmed`), and multi-stat D20 choices | M1 | Survey 1/2/3 |
| 5 | Unit Test Harness (`npm test`) | Add `"test": "node --test tests/unit/*.test.js"` in `package.json` and Node tests verifying Floor 1 connectivity, collision, door blocking, room exclusivity, and state isolation | M1 | Survey 1/2 |
| 6 | Scary Floor 1 Monster Roster & Combat Fixes | Activate `crypt_ghoul` + add 2 new scary Level-1 monsters (`crypt_spider`, `shadow_wraith`) with balanced stats and articulated 3D `CombatStage3D` models; support `specialAttackName` in enemy combat turns; fix `Ancient Bone Ring` and `playMonsterDefeat` scale | M2 | Survey 1/2/3 |
| 7 | Horror Soundscape & Dread Music | Synthesize Web Audio horror/trap/door/monster/discovery SFX in `js/audio.js` and deepen Floor 1 dread atmosphere/stingers in `js/music.js` | M3 | Survey 2/3 |
| 8 | Multi-Room 3D Geometry & South-Wall Cutaway | Render Floor 1 entrance, corridors, rooms, arches, and doors from `js/floor1Layout.js`; keep South-facing walls low/cutaway (`h <= 1.4` or dynamic fade) so the `(x, 14, z+10)` camera never hides the hero | M4 | Survey 2/3 |
| 9 | Overworld Monsters, Idle/Aggro & Trap 3D Visuals | Render `skeleton`, `crypt_ghoul`, `crypt_spider`, and `shadow_wraith` in overworld with idle motion, player-facing, and room-bounded aggro; render 4 distinct scary trap types (`spike_pit`, `pendulum_scythe`, `dart_wall`, `blood_rune`) with subtle diegetic cues and trigger animations | M4 | Survey 1/2/3 |
| 10 | Scary Lighting, Universal Torchlight, Fog-of-War & Props | Lower `AmbientLight`/`DirectionalLight` and thicken `FogExp2`; attach flickering player torch `PointLight` to ALL classes (Warrior + Mage); shroud undiscovered rooms until entered; pool `PointLight`s (`<= 8` active); add skulls, bones, chains, bloodstains, cobwebs, dust/spore particles | M4 | Survey 1/2/3 |
| 11 | Nav-Grid Movement, WASD/Click Approach & Respawn API | Enforce wall/closed-door collision and A* pathing in `DungeonWorldApp`; support WASD/Arrow movement alongside click-to-move; compute unobstructed encounter approach vectors; prevent cross-wall triggers; expose `respawnAtEntrance()`, `unlockDoor()`, and `getCurrentRoom()` | M4 | Survey 1/2/3 |
| 12 | Trap Lethality, Retryable Doors, Flee/Reset & Item Fixes | Remove `Math.max(1, ...)` non-lethal clamp and trigger clean entrance retreat/defeat on `0 HP`; keep failed doors retryable; clear `activeEncounterId` on Flee/Defeat; full `switchToAdventure()` run reset (`gold`, `xp`, `inventory`, `consumables`, `#advLog`); apply passive item bonuses; handle `victory: true` / Floor 1 Exit | M5 | Survey 1/2/3 |
| 13 | Horror HUD, Vignette, Room Banner & README Sync | Add `#hudRoom` current-room banner, `#screenAdventure` dark vignette + low-HP crimson pulse + damage flash/shake, `.log-msg.dread` room whispers, trap/door/monster SFX wiring, fix `btnDismissCombat` listener, and sync `README.md` | M5 | Survey 1/2/3 |
| 14 | Full Dual-Track E2E Pass & Tier 5 Adversarial Hardening | Pass 100% of E2E Tiers 1-4 (`TEST_READY.md`) against headless Chromium WebGL + `server.js`, then run Tier 5 white-box adversarial hardening | M6 | Project Pattern |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Floor 1 Layout, Nav-Grid & Encounter/Trap Factory | `js/floor1Layout.js`, `js/encounters.js`, `package.json`, `tests/unit/floor1.test.js` | none | IN_PROGRESS (gen5 compound closure `sub_orch_wave1_r4` `01f5c1de5f4cbbe890560c6c06fa2aff`) |
| M2 | Monster Roster & Combat Expansion | `js/combat.js`, `tests/unit/combat.test.js` | none | IN_PROGRESS (`sub_orch_wave1_r4` `01f5c1de5f4cbbe890560c6c06fa2aff`) |
| M3 | Horror Soundscape & Audio Engine | `js/audio.js`, `js/music.js`, `tests/unit/audio.test.js` | none | IN_PROGRESS (`sub_orch_wave1_r4` `01f5c1de5f4cbbe890560c6c06fa2aff`) |
| M4 | 3D Multi-Room Dungeon World & Horror Lighting | `js/dungeonWorld.js`, `js/overworldProps.js`, `tests/unit/dungeonWorld.test.js` | M1, M2, M3 (contracts) | IN_PROGRESS (`sub_orch_m4_r4` `4d5bd25af4619f7d6aa714d467432c69`) |
| M5 | Controller Wiring, Trap Lethality, HUD & Docs | `index.html`, `README.md`, `tests/unit/controller.test.js` | M1, M2, M3, M4 | PLANNED |
| M6 | Final Milestone: E2E Pass (Tiers 1-4) & Tier 5 Hardening | Whole codebase + `TEST_READY.md` | M5, E2E Track | PLANNED |
| E2E | E2E Testing Track (Opaque-Box Browser Suite) | `TEST_INFRA.md`, `tests/e2e/**`, `TEST_READY.md` | none | IN_PROGRESS (`sub_orch_e2e_r4` `baf76360f1762ccfedd6f5b38f82a50f`) |

## Interface Contracts

### 1. Floor 1 Layout & Nav-Grid (`js/floor1Layout.js` <-> `js/encounters.js`, `js/dungeonWorld.js`, `index.html`)
- **Floor 1 Topology (`FLOOR_1`)**:
  - `id: 1`, `name: 'Floor 1: The Charnel Threshold'`
  - `spawnPoint: { x: number, z: number }` (centered inside the small entrance vestibule)
  - `gridSize: 1.0` or `2.0` (consistent nav-grid cell size, e.g., `1.0` unit for crisp narrow doorways & small entrance geometry)
  - `rooms: RoomDef[]`:
    - `id`: string (e.g., `'entrance'`, `'room_1_foyer'`, `'room_2_blades'`, `'room_3_charnel'`, `'room_4_cistern'`, `'room_5_lair'`, `'room_6_sanctum'`)
    - `name`: string (human-readable room title shown in `#hudRoom`)
    - `role`: `'entrance' | 'entry_room' | 'chamber' | 'sanctum'`
    - `inhabitantType`: `'none' | 'monster' | 'trap'`
      - `entrance`: `inhabitantType: 'none'`, small footprint (e.g., `4`–`5` units wide by `5`–`6` units deep) leading directly North via a narrow doorway into `entry_room` (`room_1_foyer`, larger e.g. `10×10`).
      - **Invariant**: Every room following `entry_room` (`role === 'chamber' || role === 'sanctum'`) MUST have `inhabitantType === 'monster'` OR `inhabitantType === 'trap'`, strictly mutually exclusive!
    - `bounds`: `{ minX, maxX, minZ, maxZ }`
    - `discoveredInitially`: boolean (`true` for `'entrance'`, `false` for subsequent rooms)
    - `whisper`: string (creepy first-entry chronicle text)
    - `ambientTint`: hex number, `torchSpots`: `Array<{ x, z, color?, intensity? }>`, `propAnchors`: array of scary prop descriptors
  - `corridors: Array<{ id, bounds: { minX, maxX, minZ, maxZ }, connects: [roomA, roomB] }>`
  - `doors: Array<{ id, x, z, width, axis: 'x'|'z', connects: [roomA, roomB], initiallyLocked: boolean, encounterId?: string }>`
  - `walls: Array<{ minX, maxX, minZ, maxZ, height, isSouthFace?: boolean }>`
  - **Pure Exported Functions**:
    - `createFloor1Layout(options = {})` -> returns cloned layout (supports deterministic default and optional `{ seed, randomizeThemes }` where post-entry rooms roll `'monster'` vs `'trap'`)
    - `validateFloor1(layout)` -> `{ valid: boolean, errors: string[] }`: verifies small entrance -> `entry_room`, `>= 4` following rooms, strict `'monster' | 'trap'` mutual exclusion, non-empty room assignment, and full graph/nav-grid reachability from `spawnPoint` to every room & exit when doors are unlocked.
    - `buildNavGrid(layout, unlockedDoorIds = new Set())` -> grid object with `isWalkableWorld(x, z)`, `findPath(startPos, goalPos)`, `clampWalkable(pos, prevPos, unlockedDoorIds)`, `getRoomAt(x, z)`, `computeApproachPoint(fromPos, targetPos, distance, unlockedDoorIds)`.

### 2. Encounters & Traps Factory (`js/encounters.js` <-> `js/dungeonWorld.js`, `index.html`)
- `TRAP_ARCHETYPES`: defines at least 4 distinct Floor 1 traps (`spike_pit`, `pendulum_scythe`, `dart_wall`, `blood_rune`), each with `trapType`, scary description, balanced Level-1 damage (`8`–`15` HP), and `>= 2` stat options (`AGI`/`INT`/`STR`/`VIT` alternatives).
- `createFloor1Run(options = {})`: returns `{ floor, encounters, doors, rooms }` as deep-cloned fresh objects per run (never mutating module-level constants).
- Each encounter object has:
  - `id`, `name`, `roomId`, `kind: 'combat' | 'trap' | 'door' | 'shrine' | 'exit'`
  - `pos: { x, y, z }`, `triggerRadius` (default `~2.1`–`2.3`, suppressed through walls)
  - For `'combat'`: `isCombat: true`, `monsterId` (`'skeleton' | 'crypt_ghoul' | 'crypt_spider' | 'shadow_wraith'`), `monsterScale`, `aggroRadius`
  - For `'trap'`: `trapType`, `trapState: 'armed' | 'revealed' | 'triggered' | 'disarmed'`, `disarmable: true`, `stepTrigger: boolean`, `options`
  - For `'door'`: `doorId`, `reward.unlocksDoor: true`, retryable on failure
  - For `'exit'`: `reward.victory: true` (Floor 1 completion trigger)
  - `resolved: boolean` (ONLY set `true` when actually conquered/disarmed/opened/looted — NEVER on failed door checks or combat flee!)

### 3. Monsters & Combat (`js/combat.js` <-> `js/dungeonWorld.js`, `index.html`)
- `MONSTERS` includes `skeleton`, `crypt_ghoul`, `crypt_spider` (`Crypt Widow`, e.g., ~30 HP, AC 12, +3 hit, `1d6+2`), `shadow_wraith` (`Hollow Wraith`, e.g., ~42 HP, AC 13, +4 hit, `1d8+2`).
- `CONSUMABLE_ITEMS` includes `'Ancient Bone Ring'` (e.g., `{ name, type: 'heal'|'ward'|'buff', desc, value }` or treated consistently as usable/equippable — zero dead inventory items!).
- `CombatStage3D.buildMonsterModel(monsterId)` builds distinct articulated 3D models for all 4 `MONSTERS` keys.
- `CombatStage3D.playMonsterDefeat()` scales relative to `this.enemyScale` properly (`combat.js:807` fix).
- `MONSTERS[id]` supports `specialAttackName` and `specialChance` for `executeEnemyTurn` in `index.html`.

### 4. Horror Audio & Music (`js/audio.js`, `js/music.js` <-> `js/dungeonWorld.js`, `index.html`)
- `sound` (`SoundController` in `js/audio.js`) preserves all existing methods and adds fail-safe (no-op if muted or no Web Audio API) methods:
  - `playTrapTrigger()`, `playTrapDisarm()`, `playDoorOpen()`, `playDoorLocked()`, `playMonsterGrowl()`, `playDreadStinger()`, `playRoomDiscover()`
- `music` (`MusicController` in `js/music.js`) preserves `playTrack('title' | 'crypt', opts)`, `tryStart(...)`, `stop()`, `setMuted()`, and supports eerie Floor 1 dread variation / `triggerStinger(kind)` cleanly.

### 5. Overworld 3D World (`js/dungeonWorld.js`, `js/overworldProps.js` <-> `index.html`)
- Constructor accepts `new DungeonWorldApp(container, heroConfig, onEncounter, onStatsUpdate, runDataOrCallbacks)` — backwards-compatible with 4 args (auto-calling `createFloor1Run()`) OR options object `{ onRoomEnter, onTrapStep, onFloorVictory }`.
- Public methods on `DungeonWorldApp`:
  - `resolveEncounterVisual(encounterId, success, opts)` — marks visual/state resolved ONLY on `success === true` (or disarm/defeat), opens door if `unlocksDoor`, updates trap visual (`revealed`/`triggered`/`disarmed`) without locking out doors.
  - `unlockDoor(doorId)` — updates nav-grid passability + animates door opening.
  - `respawnAtEntrance()` — moves hero to `floor.spawnPoint`, clears `targetPos`/`path`, clears `activeEncounterId` (with brief re-trigger grace).
  - `clearActiveEncounter()` — resets `activeEncounterId = null` (used on combat flee/defeat).
  - `getCurrentRoom()` -> current `RoomDef | null`.
  - `getRunSummary()` -> `{ currentRoomId, discoveredRooms, clearedEncounters, floorId }`.
  - `dispose()` — cleans up RAF, ResizeObserver, pointer/keyboard listeners, and Three.js resources.
- Camera & Lighting invariants:
  - South-facing room/corridor walls kept low/cutaway (`height <= 1.4` or translucent fade) so `(player.x, 14, player.z + 10)` camera never obscures the hero.
  - All hero classes (Warrior & Mage) carry a flickering torch/lantern `PointLight`.
  - Active `PointLight` count in scene capped at `<= 8` via proximity/room pooling.

### 6. User-Facing Browser Entry Points & HUD (`index.html` <-> End Users & E2E Track)
- Serve via `node server.js` (`PORT` env supported, default `8085`).
- Entry paths: Title (`#screenStart`) -> `#btnQuickDelve` OR `#btnCreator` -> `#btnEnterDungeon` -> `#screenAdventure` + `#viewportAdventure` `<canvas>`.
- Visible HUD elements in `#screenAdventure`:
  - `#hudRoom`: displays current room name & floor indicator (e.g., `Floor 1 — Entrance: Cracked Threshold`).
  - `#hudHp`, `#hudMp`, `#hudXp`, `#hudGold`, `#hudConsumables`, `#advLog` (logs room entries `.log-msg.dread`, trap triggers, door unlocks, combat outcomes).
  - Movement controls: click-to-move on `#viewportAdventure` AND keyboard WASD / Arrow keys (`KeyW`/`ArrowUp`, etc.).
  - Modals: `#encounterModal` (choices `.choice-btn`, `#btnCloseEncounter`), `#combatModal` (`#btnAttack`, `#btnSpecial`, `#btnDefend`, `#btnItem`, `#btnFlee`, `#btnDismissCombat`), Floor 1 Victory / Exit completion UI (`#victoryModal` or `#encounterModal` victory action allowing Play Again / Return to Title).
