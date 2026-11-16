# E2E Testing Infrastructure & 4-Tier Specification (`TEST_INFRA.md`)

**Project**: Dungeon-Delver — Scary First Floor  
**Methodology**: Requirement-Driven, Opaque-Box, Progressive 4-Tier E2E Testing  
**Runtime**: Node.js `v24.22.2` (native `fetch`, `WebSocket`, `node:zlib`) + `/usr/bin/chromium` (`156.x`, headless SwiftShader WebGL via CDP) + live `node server.js` (pre-allocated ephemeral `PORT`)

---

## 1. Opaque-Box Architecture & Engineering Invariants

1. **Zero Internal Coupling**:
   - All tests under `tests/e2e/**` are strictly opaque-box. They MUST NOT import any file from `js/**`, inspect/mutate module-internal state, inject `Math.random` overrides, or mock application/server logic.
   - All interactions occur exclusively through HTTP (`server.js`), CDP `Input.dispatchKeyEvent` / `Input.dispatchMouseEvent`, DOM observation, and CDP composited screenshots (`Page.captureScreenshot`).
2. **Ephemeral Server Port Allocation**:
   - `server.js` reads `process.env.PORT` (default `8085`) and logs the passed port string (meaning `PORT=0` logs `http://localhost:0` even when OS-bound). Additionally, `EADDRINUSE` retries attach duplicate `'listening'` callbacks.
   - Therefore, `tests/e2e/lib/serverManager.mjs` pre-allocates a free TCP port on `127.0.0.1` via `net.createServer().listen(0)`, closes the probe socket, spawns `node server.js` with `PORT=<freePort>`, and polls `GET http://127.0.0.1:<freePort>/` until HTTP `200`.
3. **Headless Chromium CDP & Offline Font Resilience**:
   - Chromium launches once per run with:
     `--headless=new --no-sandbox --disable-gpu-sandbox --use-gl=angle --use-angle=swiftshader --enable-webgl --enable-unsafe-swiftshader --ignore-gpu-blocklist --window-size=1280,800 --remote-debugging-port=0`
   - Each test case runs in an isolated `Target.createBrowserContext` + `Target.createTarget` session and disposes its context on completion.
   - External Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com` in `index.html`) are intercepted via CDP `Fetch.enable` (aborted or fulfilled cleanly in `~20ms`) so offline/sandboxed runs never stall. Missing `/favicon.ico` 404s are explicitly whitelisted while any `Runtime.exceptionThrown`, `console.error`, or local asset failure fails the test.
   - Because synchronous Three.js r160 module load + dual WebGL shader compilation takes `1.5s–7.4s` under SwiftShader, initial page load readiness uses a `>= 20s` timeout.
4. **Composited WebGL Vision (`preserveDrawingBuffer: false`)**:
   - The app's `WebGLRenderer` instances omit `preserveDrawingBuffer: true`, so outside-RAF `canvas.toDataURL()` reads all-black pixels.
   - `tests/e2e/lib/vision.mjs` captures true rendered WebGL + HUD frames via CDP `Page.captureScreenshot` and decodes PNG scanlines in pure Node (`node:zlib`) to compute luminance, center hero torchlight halos, fog-of-war reveals, peripheral movement vs wall-block deltas, low-HP crimson vignette borders, and clickable room beacons.
5. **Strict M5 Contracts vs Composite Selector Adapters**:
   - **Strict M5 Contracts** (must fail genuinely with crisp diagnostics until M1–M5 land, and pass 100% after):
     - `#hudRoom` banner present and updates per room (`Entrance` -> `Room 1` -> `Rooms 2–6`)
     - `.log-msg.dread` room discovery whispers in `#advLog`
     - Small Entrance -> narrow North doorway -> `Room 1` -> `Rooms 2–6` with strict `'monster'` OR `'trap'` mutual exclusion (never both, never empty) -> Floor 1 Exit Victory modal
     - Nav-grid wall/closed-door collision, WASD & Arrow movement, cross-wall suppression
     - Retryable failed doors (failure never permanently resolves door)
     - Floor 1 monster species (`skeleton`, `crypt_ghoul`, `crypt_spider`, `shadow_wraith`), usable `Ancient Bone Ring`, `btnDismissCombat` listener cleanup, and Flee re-engagement
     - True `0-HP` trap lethality (no `Math.max(1, ...)` 1-HP clamp) + clean Entrance respawn
     - Full `switchToAdventure()` reset (`gold=0`, `xp=0`, consumables restored, `#advLog` cleared)
     - Universal Warrior & Mage torchlight + Room 1 fog-of-war lift + South-wall cutaway + low-HP crimson pulse/damage flash
   - **Composite Selector Adapters** (accommodate equivalent baseline vs M5 DOM IDs without false negatives):
     - Forge CTA: `#btnStartForge, #btnCreator`
     - Encounter options & dismiss: `#encOptionsList .encounter-choice-btn, #encOptionsList .choice-btn` and `#btnDismissEncounter, #btnCloseEncounter`
     - Adventure HUD readers: `#hudHp, #advHpText`, `#hudMp, #advMpText`, `#hudXp, #advXp`, `#hudGold, #advGold`, `#hudConsumables, #advItemSlot`
     - Combat actions: direct `#btnAttack` / `#btnSpecial` / `#btnDefend` / `#btnItem` / `#btnFlee` if visible, else existing two-step `#btnTabAttack` / `#btnTabDefend` / `#btnTabItems` / `#btnTabFlee` -> `#combatSubmenu .combat-action-btn`
     - Victory UI: `#victoryModal` or `#encounterModal` displaying Floor 1 completion / exit victory with Play Again / Return to Title actions.

---

## 2. Feature Inventory Traceability (`N = 12` Requirement Areas)

| RA ID | Requirement Area | Mapped `PROJECT.md § Feature Inventory` | Observable Verification Scope |
|---|---|---|---|
| **RA-01** | HTTP Static Server, Asset Integrity & App Boot | `server.js`, `package.json`, `PROJECT.md § 6` | HTTP `200`/`404`, MIME headers, `Cache-Control`, traversal guard, `PORT`/`EADDRINUSE`, offline fonts, zero `pageerror` |
| **RA-02** | Title Screen, Lore Modal & Audio HUD Controls | Features #7, #13, `§ 6` | `#screenStart`, `#viewportStart`, `#titleLogoStage`, `#loreModal`, audio toggles, volume slider, `M` shortcut |
| **RA-03** | Character Forge Customization & Live Stat Calculation | `index.html`, `§ 6` | `#screenCreator`, `#viewportCreator`, 6 ancestries, 2 classes, style/color palettes, stats, `#btnRandomize`, turntable |
| **RA-04** | Entry Transitions & Per-Run State Isolation | Features #4, #12, `§ 6` | `#btnQuickDelve`, `#btnEnterDungeon`, `#btnSwitchMode`, `#btnReturnTitle`, full `gold`/`xp`/`#advLog` reset |
| **RA-05** | Floor 1 Spatial Graph, Small Entrance & Room 1 Discovery | Features #1, #8, #10, #13 | Small Entrance spawn, `#hudRoom`, narrow North doorway -> `Room 1`, `.log-msg.dread`, fog-of-war lift, South cutaway |
| **RA-06** | Multi-Room Progression (`Rooms 2–6`) & Exclusive Monster-or-Trap Rule | Features #1, #2, `ORIGINAL_REQUEST.md` | `Rooms 2–6` reachability, strict `'monster'` OR `'trap'` exclusivity, non-empty rooms, room-bounded aggro |
| **RA-07** | Nav-Grid Movement, Wall/Door Collision & Controls | Features #3, #11, `§ 5, § 6` | `WASD`, `Arrow` keys, `#viewportAdventure` click-to-move, outer walls, locked doors, cross-wall suppression |
| **RA-08** | Retryable Doors & D20 Skill Check Modal | Features #3, #4, #11, #12 | `#encounterModal` door checks, D20 dice arithmetic, failed door retryability, successful unlock opens passage |
| **RA-09** | Floor 1 Monster Roster, Combat Arena & Consumables | Features #4, #6, #12, #13 | `skeleton`, `crypt_ghoul`, `crypt_spider`, `shadow_wraith`, Attack/Special/Defend/Items/Flee, `Ancient Bone Ring`, `#btnDismissCombat` |
| **RA-10** | Trap Archetypes, Disarm Mechanics & True 0-HP Lethality | Features #2, #4, #9, #11, #12 | `spike_pit`, `pendulum_scythe`, `dart_wall`, `blood_rune`, disarm vs step damage (`8–15`), **0-HP lethality (no 1-HP clamp)** + respawn |
| **RA-11** | Horror Lighting, Universal Torchlight, Vignette & Audio Fail-Safe | Features #7, #8, #9, #10, #13 | Dark crypt luminance, Warrior+Mage torchlight, fog-of-war, `#screenAdventure` vignette + crimson low-HP pulse + damage flash, muted audio |
| **RA-12** | Floor 1 Exit Victory & Fresh Replay Lifecycle | Features #1, #4, #12, #13 | Floor 1 Exit Seal/Stairs -> Victory UI, completion summary, Play Again & Return to Title full reset |

*(Feature #5 `npm test` unit suite covers Floor 1 connectivity, collision, door gating, room exclusivity, and per-run cloning internally; its observable end-user invariants are tested opaque-box across RA-04, RA-05, RA-06, RA-07, and RA-12.)*

---

## 3. 4-Tier Coverage Matrix (`140` Total Tests)

- **Tier 1 (Feature Coverage)**: `5` tests per RA × `12` RAs = **`60` tests** (`>= 5/feature` ✅)
- **Tier 2 (Boundary & Corner Cases)**: `5` tests per RA × `12` RAs = **`60` tests** (`>= 5/feature` ✅)
- **Tier 3 (Cross-Feature Combinations)**: **`14` tests** (`>= N = 12` ✅)
- **Tier 4 (Real-World Application Scenarios)**: **`6` tests** (`>= max(5, ceil(12/2)) = 6` ✅)

### 3.1 Tier 1 — Feature Coverage (`60` Tests)

| Test ID | RA | Description & Pass Criteria |
|---|---|---|
| `T1-RA01-01` | RA-01 | `GET /` returns `200`, `text/html; charset=utf-8`, `Cache-Control: no-cache`, containing `#screenStart`, `#screenCreator`, `#screenAdventure`. |
| `T1-RA01-02` | RA-01 | `GET` JS/JSON assets (`/vendor/three.module.js`, `/package.json`, `/js/stats.js`, `/js/combat.js`) return `200` with valid MIME types. |
| `T1-RA01-03` | RA-01 | `GET` PNG assets (`/dungeon_delver_chronicles-of-phusza.png`, `/dungeon_delver_logo_small.png`) return `200`, `image/png`, and valid PNG magic header. |
| `T1-RA01-04` | RA-01 | Dedicated `node server.js` spawned with `PORT=<freePort>` binds `<freePort>` and logs `http://localhost:<freePort>`. |
| `T1-RA01-05` | RA-01 | Chromium loads `/` with `#screenStart` visible, `#viewportStart canvas` rendered, `0` `pageerror`, `0` `console.error`, `0` local asset errors. |
| `T1-RA02-01` | RA-02 | Boot shows `#screenStart`, hides `#mainHeader`/`#screenCreator`/`#screenAdventure`, and renders animated non-black `#viewportStart canvas` pixels. |
| `T1-RA02-02` | RA-02 | Clicking `#titleLogoStage` triggers crystal pulse visual/class feedback without errors. |
| `T1-RA02-03` | RA-02 | Clicking `#btnShowLore` displays `#loreModal`; clicking `#btnCloseLore` hides `#loreModal`. |
| `T1-RA02-04` | RA-02 | `#btnStartMusicToggle`, `#btnStartSfxToggle`, and `#musicVolumeSlider` update audio toggle labels and slider state cleanly. |
| `T1-RA02-05` | RA-02 | Pressing `M` on `#screenStart` toggles music mute state cleanly on `#btnStartMusicToggle` and `#audioPromptPill`. |
| `T1-RA03-01` | RA-03 | Clicking `#btnStartForge, #btnCreator` opens `#screenCreator` + `#mainHeader` and renders 3D pedestal hero in `#viewportCreator canvas`. |
| `T1-RA03-02` | RA-03 | Typing `"Bromdur"` into `#heroNameInput` updates `#heroNameBadge` to `"Bromdur"`. |
| `T1-RA03-03` | RA-03 | Clicking all 6 `[data-ancestry]` cards updates `.active`, `#heroancestryClassBadge`, `#racialPerkTitle`, and stat bars/values. |
| `T1-RA03-04` | RA-03 | Toggling `[data-class="warrior"]` vs `[data-class="mage"]` updates `#classAbilityTitle`, shifts HP/STR vs MP/INT, and alters 3D hero screenshot. |
| `T1-RA03-05` | RA-03 | Clicking `#btnRandomize` updates hero configuration; clicking `#btnRotateLeft`/`#btnRotateRight` rotates `#viewportCreator` 3D pixels. |
| `T1-RA04-01` | RA-04 | Clicking `#btnQuickDelve` enters `#screenAdventure`, shows `#btnSwitchMode`, hides `#btnRandomize`, and mounts 1 `#viewportAdventure canvas`. |
| `T1-RA04-02` | RA-04 | Forging `Elf` `Mage` `"Elarion"` and clicking `#btnEnterDungeon` transfers name, `"Elf Mage"`, and exact HP/MP to Adventure HUD. |
| `T1-RA04-03` | RA-04 | Clicking `#btnSwitchMode` returns to Forge; clicking `#btnEnterDungeon` relaunches a fresh `#viewportAdventure canvas`. |
| `T1-RA04-04` | RA-04 | Clicking `#btnReturnTitle` from Adventure returns to `#screenStart` and hides `#mainHeader`. |
| `T1-RA04-05` | RA-04 | Re-entering Adventure after gaining XP/gold or log entries resets `#hudGold, #advGold`, `#hudXp, #advXp` to `0`, restores HP/MP, and clears `#advLog`. |
| `T1-RA05-01` | RA-05 | Entering Adventure displays `#hudRoom` indicating Floor 1 Entrance (`Floor 1` + `Entrance/Threshold/Vestibule`). |
| `T1-RA05-02` | RA-05 | Hero spawns inside a small Entrance vestibule where lateral `A`/`D` wall contact occurs rapidly (tighter lateral span than Room 1). |
| `T1-RA05-03` | RA-05 | Moving North (`KeyW` / North click) passes through narrow North doorway and transitions `#hudRoom` into `Room 1`. |
| `T1-RA05-04` | RA-05 | Crossing into `Room 1` appends a `.log-msg.dread` discovery whisper in `#advLog` and lifts Room 1 fog-of-war brightness. |
| `T1-RA05-05` | RA-05 | Moving near South walls of Entrance and Room 1 keeps South-facing walls low/cutaway so center hero & torchlight stay unobstructed. |
| `T1-RA06-01` | RA-06 | Advancing past Room 1 traverses `>= 5` interconnected rooms (`Rooms 2–6`, yielding `>= 7` distinct `#hudRoom` names across Floor 1). |
| `T1-RA06-02` | RA-06 | Entering each subsequent room updates `#hudRoom` and logs a corresponding `.log-msg.dread` room entry whisper. |
| `T1-RA06-03` | RA-06 | Every `'monster'` room visited in `Rooms 2–6` engages `#combatModal` and produces zero trap hazards within that same room. |
| `T1-RA06-04` | RA-06 | Every `'trap'` room visited in `Rooms 2–6` triggers trap hazard/disarm `#encounterModal` and produces zero `#combatModal` fights within that same room. |
| `T1-RA06-05` | RA-06 | Every post-Room-1 chamber visited is non-empty (each exposes either monster combat or trap hazard). |
| `T1-RA07-01` | RA-07 | `KeyW`/`KeyA`/`KeyS`/`KeyD` inputs move the hero along cardinal axes and cross Entrance -> Room 1 via `KeyW`. |
| `T1-RA07-02` | RA-07 | `ArrowUp`/`ArrowLeft`/`ArrowDown`/`ArrowRight` inputs steer hero identically and traverse Entrance -> Room 1. |
| `T1-RA07-03` | RA-07 | Clicking ground coordinates in `#viewportAdventure` steers the hero via click-to-move from Entrance into Room 1. |
| `T1-RA07-04` | RA-07 | Holding `KeyA` / `KeyD` against Entrance outer walls stops movement at wall bounds without clipping outside or into adjacent rooms. |
| `T1-RA07-05` | RA-07 | Walking into a locked progression doorway blocks `#hudRoom` transition while locked and opens the door `#encounterModal`. |
| `T1-RA08-01` | RA-08 | Locked door triggers `#encounterModal` with door title/story and `>= 2` `.encounter-choice-btn, .choice-btn` options with `[STAT +MOD vs DC XX]`. |
| `T1-RA08-02` | RA-08 | Selecting a door choice runs `#diceRollStage`, reveals `#rollFormula`, `#d20Value`, outcome banner, and `#btnDismissEncounter, #btnCloseEncounter`. |
| `T1-RA08-03` | RA-08 | Failing a door check keeps `#hudRoom` unchanged, keeps doorway blocked, logs failure, and re-approaching re-opens `#encounterModal` (retryable). |
| `T1-RA08-04` | RA-08 | Passing the D20 door check unlocks the doorway, logs success, and allows walking freely into the next room (`#hudRoom` updates). |
| `T1-RA08-05` | RA-08 | Forging an Orc Warrior vs Elf Mage produces stat-consistent `[STR +MOD]` and `[INT +MOD]` badges in `#encounterModal`. |
| `T1-RA09-01` | RA-09 | Approaching a Floor 1 monster opens `#combatModal` with non-blank 3D `#combatViewport3D`, HP/MP bars, `#combatTurnBadge`, and `#combatLogBox`. |
| `T1-RA09-02` | RA-09 | Basic Attack updates `#combatD20Val`, logs roll math, runs enemy turn (logging `specialAttackName` if triggered), and advances `Round`. |
| `T1-RA09-03` | RA-09 | Class Special (`Whirlwind Cleave` / `Firebolt Flare`) deducts MP (`15` / `18`) consistently in combat card and Adventure HUD. |
| `T1-RA09-04` | RA-09 | Defend action boosts AC by `+4`, shows Guard buff, restores `+4 MP`, mitigates enemy damage, and resets on next round. |
| `T1-RA09-05` | RA-09 | Defeating a monster displays `VICTORY!`, awards `#hudXp, #advXp` & `#hudGold, #advGold`, clears monster, and `#btnDismissCombat` closes cleanly. |
| `T1-RA10-01` | RA-10 | Trap rooms expose Floor 1 traps from the 4 archetypes (`spike_pit`, `pendulum_scythe`, `dart_wall`, `blood_rune`) with modal/log output. |
| `T1-RA10-02` | RA-10 | Disarmable trap `#encounterModal` offers `>= 2` stat alternatives (`AGI`/`INT`/`STR`/`VIT`). |
| `T1-RA10-03` | RA-10 | Passing a trap disarm/evade check avoids damage, logs disarm/evasion, and renders the trap safe to cross. |
| `T1-RA10-04` | RA-10 | Failing a trap check or stepping onto an armed trap deals `8–15` HP damage and logs trap injury in `#advLog`. |
| `T1-RA10-05` | RA-10 | **True 0-HP Lethality**: Triggering a trap while HP `<= 10` reduces HP to `0` (NOT clamped to `1`) and triggers clean Entrance respawn (`#hudRoom` = Entrance). |
| `T1-RA11-01` | RA-11 | `#viewportAdventure` screenshot displays dark horror dungeon tones (dark ambient regions, non-flat lighting). |
| `T1-RA11-02` | RA-11 | **Universal Torchlight**: Both `Warrior` and `Mage` heroes emit a warm central light halo (`center patch luminance > dark wall corners`). |
| `T1-RA11-03` | RA-11 | **Fog-of-War**: Before entering Room 1, ahead chamber appears shrouded/dark; stepping into Room 1 lifts shroud visibly. |
| `T1-RA11-04` | RA-11 | `#screenAdventure` displays vignette framing; dropping HP below low-HP threshold triggers visible crimson low-HP pulse styling/border redness. |
| `T1-RA11-05` | RA-11 | Taking damage triggers brief flash/shake feedback; `#btnMusicToggle` (`M`) and `#btnSoundToggle` work inside Adventure without errors. |
| `T1-RA12-01` | RA-12 | Reaching Floor 1 Exit Seal/Stairs opens Floor 1 Exit Victory UI (`#victoryModal` or `#encounterModal` victory screen). |
| `T1-RA12-02` | RA-12 | Victory UI displays Floor 1 completion message and run stats (XP / Gold). |
| `T1-RA12-03` | RA-12 | Selecting Play Again / New Delve from Victory UI starts a fresh Floor 1 run at Entrance (`XP=0`, `Gold=0`, full HP/MP, cleared `#advLog`). |
| `T1-RA12-04` | RA-12 | Selecting Return to Title from Victory UI closes Victory UI, disposes `#viewportAdventure`, and shows `#screenStart`. |
| `T1-RA12-05` | RA-12 | Fresh post-victory run resets previously unlocked doors to locked and restores cleared Room 1/2 encounters. |

### 3.2 Tier 2 — Boundary & Corner Cases (`60` Tests)

| Test ID | RA | Description & Pass Criteria |
|---|---|---|
| `T2-RA01-01` | RA-01 | `GET /does-not-exist.js` returns `404 Not Found` (`text/plain`) while subsequent `GET /` still succeeds (`200`). |
| `T2-RA01-02` | RA-01 | Directory URLs `GET /js/` and `GET /vendor/` return `404` (`!stats.isFile()`). |
| `T2-RA01-03` | RA-01 | Path traversal URLs (`/../../etc/passwd`, `/..%2f..%2fetc/hosts`, `/js/../../etc/passwd`) return `404`. |
| `T2-RA01-04` | RA-01 | Query-string URLs (`/?run=1`, `/index.html?v=99`, `/dungeon_delver_logo_small.png?cb=1`) return `200` with exact MIME types. |
| `T2-RA01-05` | RA-01 | `EADDRINUSE`: second `server.js` started on occupied `PORT` auto-binds `PORT + 1`; aborting external fonts via CDP `Fetch` boots with `0` `pageerror`. |
| `T2-RA02-01` | RA-02 | Opening, closing, and re-opening `#loreModal` works cleanly; clicking modal backdrop blocks click-through to `#btnQuickDelve`. |
| `T2-RA02-02` | RA-02 | `#musicVolumeSlider` at boundary values (`0`, `50`, `100`) operates with zero runtime or audio exceptions. |
| `T2-RA02-03` | RA-02 | Rapidly toggling `#btnStartMusicToggle` and `#btnStartSfxToggle` 5 times leaves predictable button text and zero exceptions. |
| `T2-RA02-04` | RA-02 | Clicking `#audioPromptPill` handles gesture wake cleanly without throwing errors. |
| `T2-RA02-05` | RA-02 | Narrow viewport (`390x844`) keeps Title action buttons (`#btnStartForge, #btnCreator`, `#btnQuickDelve`, `#btnShowLore`) visible and clickable. |
| `T2-RA03-01` | RA-03 | Empty (`""`) or whitespace (`"   "`) `#heroNameInput` falls back to `"Hero"`; typing `25` chars clamps at `16` chars (`maxlength="16"`). |
| `T2-RA03-02` | RA-03 | Clicking a `[data-hair-style]` unchecks `#checkHelm`; re-checking `#checkHelm` restores headgear state cleanly. |
| `T2-RA03-03` | RA-03 | Selecting `Dwarf` while `Type A` and `None` beard are active auto-selects `[data-beard-style="3"]`. |
| `T2-RA03-04` | RA-03 | Cycling `[data-body-type]`, `[data-beard-style]`, `#skinPalette .color-dot`, `#hairPalette .color-dot`, `#armorPalette .color-dot` updates `.active` cleanly. |
| `T2-RA03-05` | RA-03 | Boundary hero names (unicode/spaces trimmed, `16`-char max) plus dragging pointer across `#viewportCreator` rotates 3D model cleanly. |
| `T2-RA04-01` | RA-04 | Forge Warrior -> Enter Adventure -> `#btnSwitchMode` -> Mage -> Enter Adventure replaces HP/MP ceilings without Warrior carryover. |
| `T2-RA04-02` | RA-04 | 3 rapid cycles of Adventure <-> Forge leave strictly `1` `<canvas>` in `#viewportAdventure` and zero WebGL errors. |
| `T2-RA04-03` | RA-04 | Run A interacts/clears Room 1 -> Return to Title -> Quick Delve Run B starts with Room 1 encounters/doors isolated (`createFloor1Run()`). |
| `T2-RA04-04` | RA-04 | Extremes: `Dwarf Warrior` HP (`287`) strictly `>` `Elf Mage` HP (`72`), while `Elf Mage` MP (`355`) strictly `>` `Dwarf Warrior` MP (`30`). |
| `T2-RA04-05` | RA-04 | Resizing viewport (`1280x800` -> `960x640` -> `1280x800`) inside Adventure preserves canvas dimensions and HUD visibility. |
| `T2-RA05-01` | RA-05 | Moving North while pressed against Entrance side wall hits narrow doorway jamb; centering laterally passes through into Room 1. |
| `T2-RA05-02` | RA-05 | Stepping South from Room 1 back to Entrance updates `#hudRoom` back to Entrance without duplicating `.log-msg.dread` spam. |
| `T2-RA05-03` | RA-05 | Idling `2.5s` at spawn inside Entrance triggers zero traps/combats and keeps `#hudRoom` on Entrance. |
| `T2-RA05-04` | RA-05 | Lateral width probe confirms Room 1 permits wider unobstructed horizontal travel than the narrow Entrance vestibule. |
| `T2-RA05-05` | RA-05 | Entrance & Room 1 scary props/dust render cleanly with zero WebGL errors/exceptions. |
| `T2-RA06-01` | RA-06 | Re-entering an already-cleared monster chamber neither respawns the slain monster nor spawns a trap there. |
| `T2-RA06-02` | RA-06 | Re-entering an already-disarmed/triggered trap chamber neither re-triggers infinitely nor spawns a monster there. |
| `T2-RA06-03` | RA-06 | Forward connectivity check: every chamber along Floor 1 progression unlocks path toward the Exit with zero dead-end softlocks. |
| `T2-RA06-04` | RA-06 | Room-bounded aggro: hugging a shared wall/closed door from the previous room does NOT trigger the next room's monster early. |
| `T2-RA06-05` | RA-06 | Run 1 vs Run 2 verify identical Floor 1 invariants (Entrance -> Room 1 -> >=5 exclusive monster/trap rooms -> Exit) with zero cross-run leak. |
| `T2-RA07-01` | RA-07 | Simultaneous diagonal keys (`KeyW`+`KeyD`, `KeyW`+`KeyA`) slide cleanly along walls without clipping or NaN stall. |
| `T2-RA07-02` | RA-07 | Issuing `#viewportAdventure` click-to-move followed immediately by `KeyS` interrupts A* path cleanly in favor of manual keyboard control. |
| `T2-RA07-03` | RA-07 | Clicking far outer black void / outside wall corners handles path clamping cleanly without teleporting through walls or throwing errors. |
| `T2-RA07-04` | RA-07 | Holding `WASD` / `Arrow` keys while `#encounterModal` or `#combatModal` is open does not move the hero behind the modal. |
| `T2-RA07-05` | RA-07 | Pressing against exterior walls separating adjacent rooms does not cross-wall trigger encounters on the far side. |
| `T2-RA08-01` | RA-08 | Double-clicking a choice button in `#encounterModal` during `#diceRollStage` triggers only a single D20 roll. |
| `T2-RA08-02` | RA-08 | Multiple consecutive failed door attempts keep `#encounterModal` retryable on return without permanent lockout. |
| `T2-RA08-03` | RA-08 | Walking back and forth through an already-unlocked doorway does not re-open the locked-door `#encounterModal`. |
| `T2-RA08-04` | RA-08 | Displayed D20 math satisfies `1 <= raw <= 20`, `total === raw + mod`, and `Nat 20` / `Nat 1` outcome banners match rules. |
| `T2-RA08-05` | RA-08 | Failed door check never produces negative HP (`HP >= 0`) and always leaves encounter dismiss button usable. |
| `T2-RA09-01` | RA-09 | Fleeing combat closes `#combatModal` and clears `activeEncounterId`, letting the hero re-approach and re-engage the same monster. |
| `T2-RA09-02` | RA-09 | When MP < Special cost, Special attack button is disabled while Attack, Defend, and Flee remain active. |
| `T2-RA09-03` | RA-09 | Using consumables decrements count (`Lesser Healing Potion`, `Mana Draught`), handles empty belt cleanly, and `Ancient Bone Ring` applies real effect when acquired/used. |
| `T2-RA09-04` | RA-09 | Traversing Floor 1 monster rooms exposes distinct Floor 1 monster species (`skeleton`, `crypt_ghoul`, `crypt_spider`, `shadow_wraith`) with valid `#combatViewport3D` renders. |
| `T2-RA09-05` | RA-09 | Losing a combat shows `RESTORE & RETREAT TO ENTRANCE`, revives at Entrance, and winning a *subsequent* battle dismisses cleanly without firing stale defeat retreat (`btnDismissCombat` cleanup). |
| `T2-RA10-01` | RA-10 | Standing over or re-crossing a `disarmed` or already-`triggered` trap does not loop damage every frame. |
| `T2-RA10-02` | RA-10 | After a `0-HP` trap defeat respawns hero at Entrance, zero lingering `#encounterModal` blocks Entrance controls. |
| `T2-RA10-03` | RA-10 | Fresh full-HP hero (`>= 70 HP`) survives a single Floor 1 trap trigger (`damage in [8..15]` HP). |
| `T2-RA10-04` | RA-10 | Floor 1 trap rooms exhibit multiple distinct trap types/descriptions across the 4 archetypes (`spike_pit`, `pendulum_scythe`, `dart_wall`, `blood_rune`). |
| `T2-RA10-05` | RA-10 | Trap boundary: hitting trap with `HP > damage` leaves hero alive in room; hitting trap with `HP <= damage` drops HP to `0` and retreats to Entrance. |
| `T2-RA11-01` | RA-11 | Traversing all Floor 1 rooms never triggers WebGL light-limit or shader errors in console (`<= 8` active `PointLight` budget). |
| `T2-RA11-02` | RA-11 | Performing movement, door checks, traps, and combat while Music & SFX are both muted executes with `0` exceptions. |
| `T2-RA11-03` | RA-11 | Headless WebAudio autoplay blocking across Title -> Forge -> Adventure -> Combat produces `0` `unhandledrejection` or `pageerror`. |
| `T2-RA11-04` | RA-11 | Accumulating 10+ `#advLog` events keeps `#advLog` scrollable with visible newest entries and zero HUD overlap. |
| `T2-RA11-05` | RA-11 | Healing or respawning back above low-HP threshold clears the low-HP crimson pulse state on `#screenAdventure`. |
| `T2-RA12-01` | RA-12 | Cannot reach Floor 1 Exit Seal without traversing & unlocking prerequisite Floor 1 progression doors. |
| `T2-RA12-02` | RA-12 | Holding WASD / clicking canvas while Victory modal is open triggers zero background hazards or duplicate Victory modals. |
| `T2-RA12-03` | RA-12 | Two consecutive Victory completions (`Run 1 -> Play Again -> Run 2`) succeed cleanly without WebGL context loss or stale banners. |
| `T2-RA12-04` | RA-12 | Returning from Victory to Forge (`#btnSwitchMode`) and changing hero class/ancestry launches a clean new delve. |
| `T2-RA12-05` | RA-12 | Post-victory Play Again leaves all modal overlays (`#encounterModal`, `#combatModal`, `#victoryModal`) hidden (`display: none`). |

### 3.3 Tier 3 — Cross-Feature Combinations (`14` Pairwise Tests, `>= 12`)

| Test ID | Interacting RAs | Multi-Feature Interaction Verified |
|---|---|---|
| `T3-01` | RA-03 + RA-09 + RA-11 | Warrior vs Mage class combat skills (`Whirlwind Cleave` vs `Firebolt Flare`) + universal torchlight halo on both classes |
| `T3-02` | RA-03 + RA-08 + RA-09 | Dwarf Warrior vs Elf Mage stat modifiers in `#encounterModal` badges + combat HP/MP/AC |
| `T3-03` | RA-05 + RA-07 + RA-08 | Entrance wall collision + narrow North doorway -> Room 1 + failed door stays blocked until retry succeeds |
| `T3-04` | RA-06 + RA-07 + RA-10 | Mixed WASD + click-to-move navigation into trap room + disarm/step damage + zero monsters in trap room |
| `T3-05` | RA-08 + RA-09 + RA-11 | Low-HP crimson pulse activation -> `#combatModal` healing item (`Lesser Healing Potion`) -> pulse clears |
| `T3-06` | RA-09 + RA-10 + RA-11 | Combat Flee at low HP -> lethal `0-HP` trap hit -> Entrance respawn -> re-engage fled monster cleanly |
| `T3-07` | RA-02 + RA-03 + RA-04 + RA-11 | Mute Music+SFX on Title -> Forge hero -> Adventure doors & combat muted with zero errors |
| `T3-08` | RA-04 + RA-05 + RA-09 + RA-12 | Quick Delve -> defeat monster (`XP/Gold > 0`) -> `#btnSwitchMode` Forge edit -> re-enter resets `XP=0, Gold=0, #advLog` |
| `T3-09` | RA-06 + RA-09 + RA-10 | Combat defeat retreat -> return and win subsequent combat -> `#btnDismissCombat` listener cleanup verified |
| `T3-10` | RA-01 + RA-02 + RA-05 + RA-11 | Offline Google Fonts aborted via CDP `Fetch` + Title -> Forge -> Room 1 boot + South cutaway + fog-of-war lift |
| `T3-11` | RA-05 + RA-07 + RA-11 | Viewport resize mid-exploration along South walls + unobstructed hero torchlight + intact `#hudRoom` |
| `T3-12` | RA-06 + RA-08 + RA-09 | Locked door / shared wall cross-wall aggro suppression until door unlocks and hero enters next chamber |
| `T3-13` | RA-03 + RA-04 + RA-12 | Mid-dungeon consumables / item bonuses across Rooms 2–5 -> Floor 1 Exit Victory |
| `T3-14` | RA-04 + RA-06 + RA-12 | Floor 1 Exit Victory -> Return to Title -> Lore modal -> Quick Delve Run 2 starts shrouded in Entrance |

### 3.4 Tier 4 — Real-World Application Scenarios (`6` Full E2E Campaigns, `>= max(5, N/2)`)

| Test ID | Scenario | End-to-End Flow |
|---|---|---|
| `T4-01` | Classic Warrior Full Campaign & Replay | Title -> Forge `Dwarf Warrior` `"Bromdur"` -> Small Entrance -> Narrow North Doorway -> `Room 1` -> `Rooms 2–6` (verify exclusive monster-or-trap rooms, door unlocks, combat specials, traps) -> Floor 1 Exit Victory -> Play Again -> verify fresh Run 2 at Entrance |
| `T4-02` | Quick Delve Random Hero -> Lore -> Full Clear -> Title | Title -> Crystal Pulse + `#loreModal` -> `#btnQuickDelve` -> full Floor 1 clear -> Exit Victory -> Return to Title -> verify `#screenStart` & canvas disposal |
| `T4-03` | Arcane Elf Mage Torchlight & MP Tactics Delve | Title -> Forge `Elf Mage` `"Elarion"` -> verify Mage torchlight in Entrance -> Room 1 -> MP management (`Arcane Bolt`, `Firebolt Flare`, `Defend`, `Mana Draught`) + high-INT/AGI D20 checks across Rooms 2–6 -> Exit Victory |
| `T4-04` | Resilient Delver: Flee + 0-HP Trap Lethality -> Full Clear | Title -> low-HP hero -> Entrance -> Room 1 -> take damage & Flee -> trigger lethal `0-HP` trap -> verify Entrance respawn -> resume & re-engage fled monster -> clear Floor 1 -> Exit Victory |
| `T4-05` | Click-to-Move A* Navigation & Door Retry Campaign | Title -> Quick Delve -> navigate Entrance -> Room 1 -> Rooms 2–6 primarily with `#viewportAdventure` click-to-move, retrying failed door checks until unlocked -> clear Floor 1 -> Exit Victory |
| `T4-06` | Silent Night: Offline Fonts + Muted Audio + Mid-Run Forge Reset -> Full Clear | Offline fonts aborted + muted audio -> Quick Delve -> Room 1 -> `#btnSwitchMode` to Forge (`Orc Warrior`) -> verify full reset -> complete Floor 1 -> Exit Victory with `0` errors |

---

## 4. Runner Commands (`tests/e2e/run.mjs`)

- `node tests/e2e/run.mjs --tier 1` *(60 Feature Coverage tests)*
- `node tests/e2e/run.mjs --tier 2` *(60 Boundary & Corner Case tests)*
- `node tests/e2e/run.mjs --tier 3` *(14 Cross-Feature Combination tests)*
- `node tests/e2e/run.mjs --tier 4` *(6 Real-World Application Scenario tests)*
- `node tests/e2e/run.mjs --all` *(All 140 tests sequentially across Tiers 1 -> 2 -> 3 -> 4)*
- Optional flags: `--id <substr>`, `--timeout <ms>`, `--keep-artifacts`
- Exit code `0` iff `failed === 0 && total > 0`; `1` otherwise.
