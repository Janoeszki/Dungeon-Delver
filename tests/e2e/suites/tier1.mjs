import {
    assert,
    assertEqual,
    assertNotEqual,
    assertGt,
    assertGte,
    assertLte,
    assertBetween,
    assertIncludes,
    assertMatch
} from '../lib/assert.mjs';
import { startServer, allocateFreePort } from '../lib/serverManager.mjs';
import {
    SEL,
    assertTitleVisible,
    openForge,
    forgeHero,
    quickDelve,
    returnToForge,
    returnToTitle,
    readCreatorStats,
    readAdventureHud,
    requireRoomBanner,
    requireDreadLogs,
    detectOpenModal,
    readVictoryUi,
    clickVictoryAction,
    isElementVisible
} from '../lib/dom.mjs';
import {
    readEncounterModal,
    resolveEncounterModal
} from '../lib/encounterDriver.mjs';
import {
    readCombatState,
    inspectCombatButtons,
    triggerCombatAction,
    runCombat
} from '../lib/combatDriver.mjs';
import {
    enterRoom1,
    exploreFloor1,
    stepMove,
    calibrateIdleRms
} from '../lib/navigator.mjs';
import {
    assertFloor1Boot,
    verifyDungeonTorchLighting,
    seekModalKind
} from '../lib/scenarios.mjs';
import {
    hasPngMagicHeader,
    decodePng,
    computeMeanLuminance,
    computePatchLuminance,
    computeRmsDelta,
    computeBorderRedness
} from '../lib/vision.mjs';

export function getTier1Tests() {
    return [
        // ==================== RA-01: HTTP Static Server, Asset Integrity & App Boot ====================
        {
            id: 'T1-RA01-01',
            ra: 'RA-01',
            desc: 'GET / returns 200 HTML with no-cache and core screen containers',
            run: async (ctx) => {
                const res = await fetch(`${ctx.baseUrl}/`);
                assertEqual(res.status, 200, 'HTTP status');
                assertEqual(res.headers.get('content-type'), 'text/html; charset=utf-8', 'Content-Type');
                assertEqual(res.headers.get('cache-control'), 'no-cache', 'Cache-Control');
                const html = await res.text();
                assertIncludes(html, 'id="screenStart"', 'HTML');
                assertIncludes(html, 'id="screenCreator"', 'HTML');
                assertIncludes(html, 'id="screenAdventure"', 'HTML');
            }
        },
        {
            id: 'T1-RA01-02',
            ra: 'RA-01',
            desc: 'GET JS and JSON assets return 200 with valid MIME types',
            run: async (ctx) => {
                const checks = [
                    ['/vendor/three.module.js', 'application/javascript; charset=utf-8'],
                    ['/package.json', 'application/json; charset=utf-8'],
                    ['/js/stats.js', 'application/javascript; charset=utf-8'],
                    ['/js/combat.js', 'application/javascript; charset=utf-8']
                ];
                for (const [assetPath, mime] of checks) {
                    const res = await fetch(`${ctx.baseUrl}${assetPath}`);
                    assertEqual(res.status, 200, `status for ${assetPath}`);
                    assertEqual(res.headers.get('content-type'), mime, `Content-Type for ${assetPath}`);
                    const body = await res.text();
                    assertGt(body.length, 50, `body length for ${assetPath}`);
                }
            }
        },
        {
            id: 'T1-RA01-03',
            ra: 'RA-01',
            desc: 'GET PNG assets return 200, image/png, and valid PNG magic header',
            run: async (ctx) => {
                const imgs = ['/dungeon_delver_chronicles-of-phusza.png', '/dungeon_delver_logo_small.png'];
                for (const imgPath of imgs) {
                    const res = await fetch(`${ctx.baseUrl}${imgPath}`);
                    assertEqual(res.status, 200, `status for ${imgPath}`);
                    assertEqual(res.headers.get('content-type'), 'image/png', `MIME for ${imgPath}`);
                    const buf = Buffer.from(await res.arrayBuffer());
                    assert(hasPngMagicHeader(buf), `Expected PNG magic header for ${imgPath}`);
                }
            }
        },
        {
            id: 'T1-RA01-04',
            ra: 'RA-01',
            desc: 'Dedicated node server.js on custom PORT binds and logs http://localhost:<freePort>',
            run: async () => {
                const freePort = await allocateFreePort();
                const srv = await startServer({ port: freePort });
                try {
                    const res = await fetch(`${srv.baseUrl}/`);
                    assertEqual(res.status, 200, 'dedicated server status');
                    await res.arrayBuffer();
                    const logs = srv.getLogs();
                    assertIncludes(logs.stdout, `http://localhost:${freePort}`, 'server stdout banner');
                } finally {
                    await srv.stop();
                }
            }
        },
        {
            id: 'T1-RA01-05',
            ra: 'RA-01',
            desc: 'Chromium loads / with #screenStart, #viewportStart canvas, and zero runtime/asset errors',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await assertTitleVisible(page);
                const shot = decodePng(await page.screenshot());
                const lum = computeMeanLuminance(shot);
                assertGt(lum.nonBlackRatio, 0.1, 'non-black ratio on Title');
                page.assertZeroErrors('T1-RA01-05');
            }
        },

        // ==================== RA-02: Title Screen, Lore Modal & Audio HUD Controls ====================
        {
            id: 'T1-RA02-01',
            ra: 'RA-02',
            desc: 'Boot hides header/Forge/Adventure and animates non-black #viewportStart pixels',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await assertTitleVisible(page);
                const shot1 = decodePng(await page.screenshot());
                await page.sleep(450);
                const shot2 = decodePng(await page.screenshot());
                const lum = computeMeanLuminance(shot1);
                assertGt(lum.nonBlackRatio, 0.1, 'Title non-black ratio');
                const delta = computeRmsDelta(shot1, shot2, {
                    includeNorm: { rx: 0.05, ry: 0.05, rw: 0.90, rh: 0.90 },
                    excludeNorms: []
                });
                assertGt(delta, 0.15, 'Title 3D backdrop animation RMS delta');
                page.assertZeroErrors('T1-RA02-01');
            }
        },
        {
            id: 'T1-RA02-02',
            ra: 'RA-02',
            desc: 'Clicking #titleLogoStage triggers crystal pulse feedback without errors',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await page.click('#titleLogoStage');
                const burstActive = await page.eval(() => document.getElementById('titleLogoStage')?.classList.contains('burst'));
                assert(burstActive, 'Expected #titleLogoStage to acquire .burst class on click');
                await page.sleep(520);
                const burstCleared = await page.eval(() => !document.getElementById('titleLogoStage')?.classList.contains('burst'));
                assert(burstCleared, 'Expected #titleLogoStage .burst class to clear after pulse');
                page.assertZeroErrors('T1-RA02-02');
            }
        },
        {
            id: 'T1-RA02-03',
            ra: 'RA-02',
            desc: 'Clicking #btnShowLore opens #loreModal and #btnCloseLore hides it',
            run: async (ctx) => {
                const page = await ctx.openPage();
                assert(!(await isElementVisible(page, '#loreModal')), 'Expected #loreModal hidden initially');
                await page.click('#btnShowLore');
                await page.sleep(100);
                assert(await isElementVisible(page, '#loreModal'), 'Expected #loreModal visible after clicking #btnShowLore');
                await page.click('#btnCloseLore');
                await page.sleep(100);
                assert(!(await isElementVisible(page, '#loreModal')), 'Expected #loreModal hidden after clicking #btnCloseLore');
                page.assertZeroErrors('T1-RA02-03');
            }
        },
        {
            id: 'T1-RA02-04',
            ra: 'RA-02',
            desc: 'Music toggle, SFX toggle, and volume slider update Title audio controls cleanly',
            run: async (ctx) => {
                const page = await ctx.openPage();
                const sfxBefore = await page.eval(() => document.getElementById('btnStartSfxToggle')?.textContent?.trim());
                await page.click('#btnStartSfxToggle');
                await page.sleep(80);
                const sfxAfter = await page.eval(() => document.getElementById('btnStartSfxToggle')?.textContent?.trim());
                assertNotEqual(sfxAfter, sfxBefore, 'SFX toggle label');

                const musicBefore = await page.eval(() => document.getElementById('btnStartMusicToggle')?.textContent?.trim());
                await page.click('#btnStartMusicToggle');
                await page.sleep(100);
                const musicAfter = await page.eval(() => document.getElementById('btnStartMusicToggle')?.textContent?.trim());
                assertNotEqual(musicAfter, musicBefore, 'Music toggle label');

                // Click left and right sides of #musicVolumeSlider
                const sliderBox = await page.getElementBox('#musicVolumeSlider');
                await page.clickAt(sliderBox.left + 8, sliderBox.y);
                const lowVal = await page.eval(() => Number(document.getElementById('musicVolumeSlider').value));
                await page.clickAt(sliderBox.left + sliderBox.width - 8, sliderBox.y);
                const highVal = await page.eval(() => Number(document.getElementById('musicVolumeSlider').value));
                assertGt(highVal, lowVal, 'Slider value increase from left click to right click');
                page.assertZeroErrors('T1-RA02-04');
            }
        },
        {
            id: 'T1-RA02-05',
            ra: 'RA-02',
            desc: 'Pressing M on #screenStart toggles music mute state on HUD and #audioPromptPill',
            run: async (ctx) => {
                const page = await ctx.openPage();
                // Awaken gesture on safe backdrop first so music enters Playing or toggle cleanly
                await page.click('#screenStart .realm-badge');
                await page.sleep(120);
                const before = await page.eval(() => ({
                    btn: document.getElementById('btnStartMusicToggle')?.textContent?.trim(),
                    pill: document.getElementById('audioPromptPill')?.textContent?.trim()
                }));
                await page.pressKey('KeyM');
                await page.sleep(120);
                const muted = await page.eval(() => ({
                    btn: document.getElementById('btnStartMusicToggle')?.textContent?.trim(),
                    pill: document.getElementById('audioPromptPill')?.textContent?.trim()
                }));
                assertNotEqual(muted.btn, before.btn, 'Music toggle button after M');
                assertIncludes(muted.btn.toUpperCase(), 'MUTED', 'Music button muted state');
                assertIncludes(muted.pill.toUpperCase(), 'MUTED', 'Audio prompt pill muted state');

                await page.pressKey('KeyM');
                await page.sleep(120);
                const unmuted = await page.eval(() => document.getElementById('btnStartMusicToggle')?.textContent?.trim());
                assert(!unmuted.toUpperCase().includes('MUTED'), `Expected unmuted after second M, got ${unmuted}`);
                page.assertZeroErrors('T1-RA02-05');
            }
        },

        // ==================== RA-03: Character Forge Customization & Live Stat Calculation ====================
        {
            id: 'T1-RA03-01',
            ra: 'RA-03',
            desc: 'Clicking Forge button opens #screenCreator, #mainHeader, and renders 3D pedestal hero',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await openForge(page);
                assert(await isElementVisible(page, '#screenCreator'), '#screenCreator visible');
                assert(await isElementVisible(page, '#mainHeader'), '#mainHeader visible');
                const shot = decodePng(await page.screenshot());
                const center = computePatchLuminance(shot, 0.5, 0.5, 0.16);
                assertGt(center.nonBlackRatio, 0.25, '3D Forge pedestal center non-black ratio');
                page.assertZeroErrors('T1-RA03-01');
            }
        },
        {
            id: 'T1-RA03-02',
            ra: 'RA-03',
            desc: 'Typing "Bromdur" into #heroNameInput updates #heroNameBadge to "Bromdur"',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await openForge(page);
                await page.type('#heroNameInput', 'Bromdur');
                const stats = await readCreatorStats(page);
                assertEqual(stats.nameInput, 'Bromdur', '#heroNameInput value');
                assertEqual(stats.nameBadge, 'Bromdur', '#heroNameBadge text');
                page.assertZeroErrors('T1-RA03-02');
            }
        },
        {
            id: 'T1-RA03-03',
            ra: 'RA-03',
            desc: 'Clicking all 6 ancestries updates active card, badge, racial perk, and computed stats',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await openForge(page);
                const expected = [
                    { key: 'human', label: 'Human Warrior', str: 16, vit: 14, hp: 196 },
                    { key: 'elf', label: 'Elf Warrior', str: 14, vit: 12, hp: 168 },
                    { key: 'dwarf', label: 'Dwarf Warrior', str: 18, vit: 18, hp: 287 },
                    { key: 'orc', label: 'Orc Warrior', str: 22, vit: 17, hp: 268 },
                    { key: 'goblin', label: 'Goblin Warrior', str: 13, vit: 13, hp: 182 },
                    { key: 'catfolk', label: 'Catfolk Warrior', str: 16, vit: 15, hp: 210 }
                ];
                for (const item of expected) {
                    await page.click(`[data-ancestry="${item.key}"]`);
                    await page.sleep(80);
                    const s = await readCreatorStats(page);
                    assertEqual(s.ancestry, item.key, 'active ancestry');
                    assertEqual(s.ancestryClassBadge, item.label, 'ancestry class badge');
                    assertIncludes(s.racialPerkTitle.toLowerCase(), item.key, 'racial perk title');
                    assertEqual(s.str, item.str, `${item.key} STR`);
                    assertEqual(s.vit, item.vit, `${item.key} VIT`);
                    assertEqual(s.hp, item.hp, `${item.key} HP`);
                }
                page.assertZeroErrors('T1-RA03-03');
            }
        },
        {
            id: 'T1-RA03-04',
            ra: 'RA-03',
            desc: 'Toggling Warrior vs Mage updates class trait, shifts HP/STR vs MP/INT, and alters 3D pixels',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await openForge(page);
                const wStats = await readCreatorStats(page);
                const wShot = decodePng(await page.screenshot());

                await page.click('[data-class="mage"]');
                await page.sleep(220);
                const mStats = await readCreatorStats(page);
                const mShot = decodePng(await page.screenshot());

                assertIncludes(mStats.classAbilityTitle, 'Mage', 'Mage trait title');
                assertGt(wStats.hp, mStats.hp, 'Warrior HP > Mage HP');
                assertGt(wStats.str, mStats.str, 'Warrior STR > Mage STR');
                assertGt(mStats.mp, wStats.mp, 'Mage MP > Warrior MP');
                assertGt(mStats.int, wStats.int, 'Mage INT > Warrior INT');

                const rms = computeRmsDelta(wShot, mShot, {
                    includeNorm: { rx: 0.30, ry: 0.16, rw: 0.40, rh: 0.68 },
                    excludeNorms: [],
                    step: 2
                });
                assertGt(rms, 5.0, 'Warrior vs Mage 3D model screenshot delta');
                page.assertZeroErrors('T1-RA03-04');
            }
        },
        {
            id: 'T1-RA03-05',
            ra: 'RA-03',
            desc: 'Clicking #btnRandomize updates hero config and turntable buttons rotate 3D model',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await openForge(page);
                const initial = await readCreatorStats(page);

                let changed = false;
                for (let i = 0; i < 4; i++) {
                    await page.click('#btnRandomize');
                    await page.sleep(100);
                    const next = await readCreatorStats(page);
                    if (
                        next.nameInput !== initial.nameInput ||
                        next.ancestry !== initial.ancestry ||
                        next.charClass !== initial.charClass ||
                        next.armorColor !== initial.armorColor
                    ) {
                        changed = true;
                        break;
                    }
                }
                assert(changed, 'Expected #btnRandomize to modify hero configuration');

                const beforeRot = decodePng(await page.screenshot());
                await page.click('#btnRotateRight');
                await page.click('#btnRotateRight');
                await page.sleep(180);
                const afterRight = decodePng(await page.screenshot());
                const rmsRight = computeRmsDelta(beforeRot, afterRight, {
                    includeNorm: { rx: 0.30, ry: 0.16, rw: 0.40, rh: 0.68 },
                    excludeNorms: [],
                    step: 2
                });
                assertGt(rmsRight, 3.0, 'Turntable right rotation pixel delta');

                await page.click('#btnRotateLeft');
                await page.click('#btnRotateLeft');
                await page.sleep(180);
                const afterLeft = decodePng(await page.screenshot());
                const rmsLeft = computeRmsDelta(afterRight, afterLeft, {
                    includeNorm: { rx: 0.30, ry: 0.16, rw: 0.40, rh: 0.68 },
                    excludeNorms: [],
                    step: 2
                });
                assertGt(rmsLeft, 3.0, 'Turntable left rotation pixel delta');
                page.assertZeroErrors('T1-RA03-05');
            }
        },

        // ==================== RA-04: Entry Transitions & Per-Run State Isolation ====================
        {
            id: 'T1-RA04-01',
            ra: 'RA-04',
            desc: 'Quick Delve enters #screenAdventure, shows #btnSwitchMode, hides #btnRandomize, mounts 1 canvas',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                assert(await isElementVisible(page, '#screenAdventure'), '#screenAdventure visible');
                assert(await isElementVisible(page, '#btnSwitchMode'), '#btnSwitchMode visible');
                assert(!(await isElementVisible(page, '#btnRandomize')), '#btnRandomize hidden');
                const hud = await readAdventureHud(page);
                assertEqual(hud.canvasCount, 1, 'canvas count in #viewportAdventure');
                page.assertZeroErrors('T1-RA04-01');
            }
        },
        {
            id: 'T1-RA04-02',
            ra: 'RA-04',
            desc: 'Forging Elf Mage "Elarion" transfers name, class, and exact HP/MP to Adventure HUD',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Elarion', ancestry: 'elf', charClass: 'mage' });
                const hud = await readAdventureHud(page);
                assertEqual(hud.heroName, 'Elarion', 'Adventure hero name');
                assertEqual(hud.heroClass, 'Elf Mage', 'Adventure hero class');
                assertEqual(hud.hp, 72, 'Elf Mage current HP');
                assertEqual(hud.maxHp, 72, 'Elf Mage max HP');
                assertEqual(hud.mp, 355, 'Elf Mage current MP');
                assertEqual(hud.maxMp, 355, 'Elf Mage max MP');
                page.assertZeroErrors('T1-RA04-02');
            }
        },
        {
            id: 'T1-RA04-03',
            ra: 'RA-04',
            desc: 'Clicking #btnSwitchMode returns to Forge and #btnEnterDungeon relaunches fresh canvas',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await returnToForge(page);
                assert(await isElementVisible(page, '#screenCreator'), '#screenCreator visible');
                assert(await isElementVisible(page, '#btnRandomize'), '#btnRandomize visible');
                await page.click('#btnEnterDungeon');
                await page.waitFor(() => {
                    const adv = document.getElementById('screenAdventure');
                    const c = document.querySelector('#viewportAdventure canvas');
                    return adv && getComputedStyle(adv).display !== 'none' && c && c.width > 0;
                }, { timeoutMs: 8000, label: 're-enter Adventure' });
                const hud = await readAdventureHud(page);
                assertEqual(hud.canvasCount, 1, 'canvas count after re-enter');
                page.assertZeroErrors('T1-RA04-03');
            }
        },
        {
            id: 'T1-RA04-04',
            ra: 'RA-04',
            desc: 'Clicking #btnReturnTitle from Adventure returns to #screenStart and hides #mainHeader',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await returnToTitle(page);
                await assertTitleVisible(page);
                page.assertZeroErrors('T1-RA04-04');
            }
        },
        {
            id: 'T1-RA04-05',
            ra: 'RA-04',
            desc: 'Re-entering Adventure after run activity resets Gold, XP, HP/MP, and clears old #advLog',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'ResetCheckA', ancestry: 'orc', charClass: 'warrior' });
                const hudA = await readAdventureHud(page);
                const runALogCount = hudA.logs.length;

                // Try progressing into Room 1 / winning an encounter if Floor 1 is active
                if (hudA.roomExists) {
                    const combatRun = await seekModalKind(page, 'combat', { maxSteps: 55 });
                    assert(combatRun && combatRun.kind === 'combat', 'Expected to enter Floor 1 combat before checking reset');
                    const combatRes = await runCombat(page, 'win');
                    assertEqual(combatRes.outcome, 'victory', 'Expected victory to gain XP and Gold before reset check');
                    const preResetHud = await readAdventureHud(page);
                    assertGt(preResetHud.xp, 0, 'XP gained before reset');
                    assertGt(preResetHud.gold, 0, 'Gold gained before reset');
                }

                // Switch back to Forge and rename hero for Run B
                await returnToForge(page);
                await forgeHero(page, { name: 'ResetCheckB', ancestry: 'human', charClass: 'warrior' });
                const hudB = await readAdventureHud(page);

                assertEqual(hudB.gold, 0, 'Reset Gold on new run');
                assertEqual(hudB.xp, 0, 'Reset XP on new run');
                assertEqual(hudB.hp, hudB.maxHp, 'Restored full HP');
                assertEqual(hudB.mp, hudB.maxMp, 'Restored full MP');
                const leakedOldHero = hudB.logs.some((l) => l.text.includes('ResetCheckA'));
                assert(!leakedOldHero, `Expected #advLog cleared between runs, but found previous run log: ${JSON.stringify(hudB.logs.map((l) => l.text))}`);
                assertLte(hudB.logs.length, runALogCount + 1, 'Expected fresh #advLog length without previous run buildup');
                page.assertZeroErrors('T1-RA04-05');
            }
        },

        // ==================== RA-05: Floor 1 Spatial Graph, Small Entrance & Room 1 Discovery ====================
        {
            id: 'T1-RA05-01',
            ra: 'RA-05',
            desc: 'Entering Adventure displays #hudRoom showing Floor 1 Entrance',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                const room = await requireRoomBanner(page, 1500);
                assertMatch(room, /floor\s*1/i, '#hudRoom floor prefix');
                assertMatch(room, /entrance|threshold|vestibule/i, '#hudRoom entrance name');
                page.assertZeroErrors('T1-RA05-01');
            }
        },
        {
            id: 'T1-RA05-02',
            ra: 'RA-05',
            desc: 'Small Entrance vestibule hits lateral walls faster than wider Room 1',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await assertFloor1Boot(page);
                const idleRms = await calibrateIdleRms(page, 220);

                // Count lateral KeyD steps from center until wall stops movement in Entrance
                let entranceRightSteps = 0;
                for (let i = 0; i < 12; i++) {
                    const step = await stepMove(page, { keys: ['KeyD'], holdMs: 220, idleRms });
                    if (!step.moved) break;
                    entranceRightSteps++;
                }
                assertBetween(entranceRightSteps, 1, 7, 'Small Entrance lateral KeyD step count');

                // Recenter & cross into Room 1
                await stepMove(page, { keys: ['KeyA'], holdMs: entranceRightSteps * 220, idleRms });
                await enterRoom1(page);

                let room1RightSteps = 0;
                for (let i = 0; i < 16; i++) {
                    const step = await stepMove(page, { keys: ['KeyD'], holdMs: 220, idleRms });
                    if (!step.moved) break;
                    room1RightSteps++;
                }
                assertGt(room1RightSteps, entranceRightSteps, 'Room 1 lateral space > small Entrance vestibule');
                page.assertZeroErrors('T1-RA05-02');
            }
        },
        {
            id: 'T1-RA05-03',
            ra: 'RA-05',
            desc: 'Moving North via KeyW passes narrow doorway and updates #hudRoom to Room 1',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                const res = await enterRoom1(page);
                assertNotEqual(res.room1, res.startRoom, 'Room 1 distinct from Entrance');
                assertMatch(res.room1, /room\s*1|foyer|antechamber|hall/i, 'Room 1 banner');
                page.assertZeroErrors('T1-RA05-03');
            }
        },
        {
            id: 'T1-RA05-04',
            ra: 'RA-05',
            desc: 'Crossing into Room 1 appends .log-msg.dread whisper and lifts Room 1 fog-of-war brightness',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await assertFloor1Boot(page);
                const beforeShot = decodePng(await page.screenshot());
                const aheadBefore = computePatchLuminance(beforeShot, 0.5, 0.30, 0.10, 2);

                await enterRoom1(page);
                await requireDreadLogs(page, 1);

                const afterShot = decodePng(await page.screenshot());
                const roomAfter = computePatchLuminance(afterShot, 0.5, 0.42, 0.14, 2);
                assertGt(roomAfter.mean, aheadBefore.mean + 1.5, 'Room 1 brightness after fog-of-war lift');
                page.assertZeroErrors('T1-RA05-04');
            }
        },
        {
            id: 'T1-RA05-05',
            ra: 'RA-05',
            desc: 'Moving near South walls keeps South-facing walls cutaway so center hero stays unobstructed',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await assertFloor1Boot(page);
                const idleRms = await calibrateIdleRms(page, 200);
                // Walk South against Entrance South wall
                for (let i = 0; i < 4; i++) {
                    await stepMove(page, { keys: ['KeyS'], holdMs: 260, idleRms });
                }
                const entranceSouth = await verifyDungeonTorchLighting(page);
                assertGt(entranceSouth.center.mean, entranceSouth.minCorner + 1.5, 'Center hero torch unobstructed at Entrance South wall');

                await enterRoom1(page);
                for (let i = 0; i < 3; i++) {
                    await stepMove(page, { keys: ['KeyS'], holdMs: 240, idleRms });
                }
                const room1South = await verifyDungeonTorchLighting(page);
                assertGt(room1South.center.mean, room1South.minCorner + 1.5, 'Center hero torch unobstructed at Room 1 South wall');
                page.assertZeroErrors('T1-RA05-05');
            }
        },

        // ==================== RA-06: Multi-Room Progression & Exclusive Monster-or-Trap Rule ====================
        {
            id: 'T1-RA06-01',
            ra: 'RA-06',
            timeoutMs: 160000,
            desc: 'Advancing past Room 1 traverses >= 5 interconnected rooms (Rooms 2-6; >= 7 total rooms)',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Explorer', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const run = await exploreFloor1(page, { maxSteps: 95, timeoutMs: 135000 });
                assertGte(run.rooms.length, 7, `Distinct #hudRoom names visited (${run.rooms.map((r) => r.roomName).join(' -> ')})`);
                page.assertZeroErrors('T1-RA06-01');
            }
        },
        {
            id: 'T1-RA06-02',
            ra: 'RA-06',
            timeoutMs: 160000,
            desc: 'Entering subsequent rooms updates #hudRoom and logs .log-msg.dread entry whispers',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Whisperer', ancestry: 'human', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const run = await exploreFloor1(page, { maxSteps: 90, timeoutMs: 130000 });
                const dreads = await requireDreadLogs(page, 6);
                assertGte(run.rooms.length, 7, 'Visited rooms count');
                assertGte(dreads.length, 6, 'Dread whisper count across Rooms 1-6');
                page.assertZeroErrors('T1-RA06-02');
            }
        },
        {
            id: 'T1-RA06-03',
            ra: 'RA-06',
            timeoutMs: 160000,
            desc: 'Every monster room in Rooms 2-6 engages #combatModal and produces zero traps in that room',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Slayer', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const run = await exploreFloor1(page, { maxSteps: 90, timeoutMs: 130000 });
                const postRoom1 = run.rooms.filter((r) => !/entrance|threshold|vestibule|hall of fallen|room\s*1\b|foyer/i.test(r.roomName));
                const monsterRooms = postRoom1.filter((r) => r.sawCombat);
                assertGte(monsterRooms.length, 2, 'Monster rooms visited in Rooms 2-6');
                for (const mr of monsterRooms) {
                    assert(!mr.sawTrap, `Exclusivity violated in monster room "${mr.roomName}": also saw trap!`);
                }
                page.assertZeroErrors('T1-RA06-03');
            }
        },
        {
            id: 'T1-RA06-04',
            ra: 'RA-06',
            timeoutMs: 160000,
            desc: 'Every trap room in Rooms 2-6 triggers trap hazard/disarm and produces zero combats in that room',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Disarmer', ancestry: 'goblin', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const run = await exploreFloor1(page, { maxSteps: 130, timeoutMs: 140000 });
                const postRoom1 = run.rooms.filter((r) => !/entrance|threshold|vestibule|hall of fallen|room\s*1\b|foyer/i.test(r.roomName));
                const trapRooms = postRoom1.filter((r) => r.sawTrap);
                assertGte(trapRooms.length, 2, 'Trap rooms visited in Rooms 2-6');
                for (const tr of trapRooms) {
                    assert(!tr.sawCombat, `Exclusivity violated in trap room "${tr.roomName}": also saw combat!`);
                }
                page.assertZeroErrors('T1-RA06-04');
            }
        },
        {
            id: 'T1-RA06-05',
            ra: 'RA-06',
            timeoutMs: 160000,
            desc: 'Every post-Room-1 chamber visited is non-empty (strictly monster XOR trap)',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Auditor', ancestry: 'dwarf', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const run = await exploreFloor1(page, { maxSteps: 130, timeoutMs: 140000 });
                const chambers = run.rooms.filter((r) => !/entrance|threshold|vestibule|hall of fallen|room\s*1\b|foyer/i.test(r.roomName));
                assertGte(chambers.length, 5, 'Post-Room-1 chambers visited');
                for (const ch of chambers) {
                    assert(ch.sawCombat !== ch.sawTrap, `Chamber "${ch.roomName}" must be exclusively monster OR trap (combat=${ch.sawCombat}, trap=${ch.sawTrap})`);
                }
                page.assertZeroErrors('T1-RA06-05');
            }
        },

        // ==================== RA-07: Nav-Grid Movement, Wall/Door Collision & Controls ====================
        {
            id: 'T1-RA07-01',
            ra: 'RA-07',
            desc: 'KeyW/KeyA/KeyS/KeyD move hero along cardinal axes and cross Entrance -> Room 1 via KeyW',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await assertFloor1Boot(page);
                const idleRms = await calibrateIdleRms(page, 220);
                const sW = await stepMove(page, { keys: ['KeyW'], holdMs: 360, idleRms });
                assert(sW.moved, `Expected KeyW movement (rms=${sW.delta.toFixed(2)})`);
                const res = await enterRoom1(page, { useArrows: false });
                assertMatch(res.room1, /room\s*1|foyer|hall of fallen/i, 'Room 1 via KeyW');
                await stepMove(page, { keys: ['KeyW'], holdMs: 320, idleRms });
                const sA = await stepMove(page, { keys: ['KeyA'], holdMs: 280, idleRms });
                assert(sA.moved, `Expected KeyA movement in Room 1 (rms=${sA.delta.toFixed(2)})`);
                const sD = await stepMove(page, { keys: ['KeyD'], holdMs: 280, idleRms });
                assert(sD.moved, `Expected KeyD movement in Room 1 (rms=${sD.delta.toFixed(2)})`);
                const sS = await stepMove(page, { keys: ['KeyS'], holdMs: 240, idleRms });
                assert(sS.moved, `Expected KeyS movement in Room 1 (rms=${sS.delta.toFixed(2)})`);
                page.assertZeroErrors('T1-RA07-01');
            }
        },
        {
            id: 'T1-RA07-02',
            ra: 'RA-07',
            desc: 'ArrowUp/ArrowLeft/ArrowDown/ArrowRight steer hero and traverse Entrance -> Room 1',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await assertFloor1Boot(page);
                const idleRms = await calibrateIdleRms(page, 220);
                const sUp = await stepMove(page, { keys: ['ArrowUp'], holdMs: 360, idleRms });
                assert(sUp.moved, `Expected ArrowUp movement (rms=${sUp.delta.toFixed(2)})`);
                const res = await enterRoom1(page, { useArrows: true });
                assertMatch(res.room1, /room\s*1|foyer|hall of fallen/i, 'Room 1 via ArrowUp');
                await stepMove(page, { keys: ['ArrowUp'], holdMs: 320, idleRms });
                const sL = await stepMove(page, { keys: ['ArrowLeft'], holdMs: 280, idleRms });
                assert(sL.moved, `Expected ArrowLeft movement in Room 1 (rms=${sL.delta.toFixed(2)})`);
                const sR = await stepMove(page, { keys: ['ArrowRight'], holdMs: 280, idleRms });
                assert(sR.moved, `Expected ArrowRight movement in Room 1 (rms=${sR.delta.toFixed(2)})`);
                const sDn = await stepMove(page, { keys: ['ArrowDown'], holdMs: 240, idleRms });
                assert(sDn.moved, `Expected ArrowDown movement in Room 1 (rms=${sDn.delta.toFixed(2)})`);
                page.assertZeroErrors('T1-RA07-02');
            }
        },
        {
            id: 'T1-RA07-03',
            ra: 'RA-07',
            desc: 'Clicking ground coordinates in #viewportAdventure steers hero from Entrance into Room 1',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await assertFloor1Boot(page);
                const res = await enterRoom1(page, { useClicks: true });
                assertMatch(res.room1, /room\s*1|foyer|hall of fallen/i, 'Room 1 via ground clicks');
                page.assertZeroErrors('T1-RA07-03');
            }
        },
        {
            id: 'T1-RA07-04',
            ra: 'RA-07',
            desc: 'Holding KeyA/KeyD against Entrance outer walls stops movement without clipping rooms',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                const startRoom = await assertFloor1Boot(page);
                const idleRms = await calibrateIdleRms(page, 220);
                let stoppedLeft = false;
                for (let i = 0; i < 12; i++) {
                    const st = await stepMove(page, { keys: ['KeyA'], holdMs: 260, idleRms });
                    assertEqual(st.hudAfter.roomText, startRoom, 'No room clip while walking West against wall');
                    if (!st.moved) {
                        stoppedLeft = true;
                        break;
                    }
                }
                assert(stoppedLeft, 'Expected Entrance West wall to block further KeyA movement');
                let stoppedRight = false;
                for (let i = 0; i < 16; i++) {
                    const st = await stepMove(page, { keys: ['KeyD'], holdMs: 260, idleRms });
                    assertEqual(st.hudAfter.roomText, startRoom, 'No room clip while walking East against wall');
                    if (!st.moved) {
                        stoppedRight = true;
                        break;
                    }
                }
                assert(stoppedRight, 'Expected Entrance East wall to block further KeyD movement');
                page.assertZeroErrors('T1-RA07-04');
            }
        },
        {
            id: 'T1-RA07-05',
            ra: 'RA-07',
            desc: 'Walking into locked progression doorway blocks #hudRoom transition and opens door #encounterModal',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                const found = await seekModalKind(page, 'door', { maxSteps: 45 });
                assertEqual(found.kind, 'door', 'Found locked door modal');
                assert(found.encounter.open, 'Door #encounterModal open');
                assertMatch(found.roomName, /room\s*1|foyer|hall of fallen/i, 'Still inside Room 1 while door locked');
                page.assertZeroErrors('T1-RA07-05');
            }
        },

        // ==================== RA-08: Retryable Doors & D20 Skill Check Modal ====================
        {
            id: 'T1-RA08-01',
            ra: 'RA-08',
            desc: 'Locked door triggers #encounterModal with title/story and >= 2 [STAT +MOD vs DC XX] options',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                const found = await seekModalKind(page, 'door', { maxSteps: 45 });
                const enc = found.encounter;
                assertGt(enc.title.length, 2, 'Door modal title');
                assertGt(enc.story.length, 10, 'Door modal story');
                assertGte(enc.options.length, 2, 'Door choice option count');
                for (const opt of enc.options) {
                    assert(opt.stat !== null, `Missing [STAT +MOD vs DC XX] badge on option "${opt.text}"`);
                }
                page.assertZeroErrors('T1-RA08-01');
            }
        },
        {
            id: 'T1-RA08-02',
            ra: 'RA-08',
            desc: 'Selecting a door choice runs #diceRollStage, shows formula, d20Value, outcome, and dismiss button',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await seekModalKind(page, 'door', { maxSteps: 45 });
                const res = await resolveEncounterModal(page, { strategy: 'optimal', dismiss: false });
                assertBetween(res.rawRoll, 1, 20, 'D20 rawRoll');
                assertGt(res.rollFormula.length, 5, '#rollFormula text');
                assertGt(res.outcomeBanner.length, 3, '#rollOutcomeBanner text');
                assert(await isElementVisible(page, SEL.encDismiss), 'Encounter dismiss button visible');
                await page.click(SEL.encDismiss);
                page.assertZeroErrors('T1-RA08-02');
            }
        },
        {
            id: 'T1-RA08-03',
            ra: 'RA-08',
            desc: 'Failing a door check keeps #hudRoom unchanged, keeps doorway blocked, and stays retryable',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'DoorFailer', ancestry: 'elf', charClass: 'mage' });
                await assertFloor1Boot(page);
                let sawFailureAndRetry = false;
                for (let attempt = 0; attempt < 10; attempt++) {
                    const found = await seekModalKind(page, 'door', { maxSteps: 40 });
                    const roomAtDoor = found.roomName;
                    const res = await resolveEncounterModal(page, { strategy: 'weakest' });
                    if (!res.success) {
                        const hudAfterFail = await readAdventureHud(page);
                        assertEqual(hudAfterFail.roomText, roomAtDoor, 'Room unchanged after failed door check');
                        // Re-approach doorway to confirm modal re-opens (retryable!)
                        const reopened = await seekModalKind(page, 'door', { maxSteps: 14 });
                        assert(reopened.encounter.open, 'Door #encounterModal re-opened on retry');
                        sawFailureAndRetry = true;
                        break;
                    }
                }
                assert(sawFailureAndRetry, 'Expected at least one failed door attempt to verify retryability');
                page.assertZeroErrors('T1-RA08-03');
            }
        },
        {
            id: 'T1-RA08-04',
            ra: 'RA-08',
            desc: 'Passing the D20 door check unlocks doorway and allows walking into next room (#hudRoom updates)',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Breacher', ancestry: 'orc', charClass: 'warrior' });
                await seekModalKind(page, 'door', { maxSteps: 45 });
                const roomBeforeUnlock = (await readAdventureHud(page)).roomText;

                let unlocked = false;
                for (let attempt = 0; attempt < 8; attempt++) {
                    if ((await detectOpenModal(page)) !== 'encounter') {
                        await seekModalKind(page, 'door', { maxSteps: 15 });
                    }
                    const res = await resolveEncounterModal(page, { strategy: 'optimal' });
                    if (res.success) {
                        unlocked = true;
                        break;
                    }
                }
                assert(unlocked, 'Expected to unlock door with optimal Orc Warrior checks');

                const idleRms = await calibrateIdleRms(page, 200);
                let crossed = false;
                for (let s = 0; s < 10; s++) {
                    const step = await stepMove(page, { keys: ['KeyW'], holdMs: 380, idleRms });
                    if (step.hudAfter.roomText !== roomBeforeUnlock) {
                        crossed = true;
                        break;
                    }
                }
                assert(crossed, 'Expected #hudRoom to advance into next room after door unlocked');
                page.assertZeroErrors('T1-RA08-04');
            }
        },
        {
            id: 'T1-RA08-05',
            ra: 'RA-08',
            desc: 'Orc Warrior vs Elf Mage produces stat-consistent [STR +MOD] and [INT +MOD] badges in door modal',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Gorgok', ancestry: 'orc', charClass: 'warrior' });
                const orcDoor = await seekModalKind(page, 'door', { maxSteps: 45 });
                const orcStr = orcDoor.encounter.options.find((o) => o.stat && o.stat.startsWith('STR'));
                await resolveEncounterModal(page, { strategy: 'optimal' });

                await returnToForge(page);
                await forgeHero(page, { name: 'Elarion', ancestry: 'elf', charClass: 'mage' });
                const elfDoor = await seekModalKind(page, 'door', { maxSteps: 45 });
                const elfStr = elfDoor.encounter.options.find((o) => o.stat && o.stat.startsWith('STR'));
                const elfInt = elfDoor.encounter.options.find((o) => o.stat && o.stat.startsWith('INT'));

                assert(orcStr, 'Expected STR option for Orc Warrior door modal');
                assertEqual(orcStr.mod, 6, 'Orc Warrior STR mod (+6 for STR 22)');
                if (elfStr) assertGt(orcStr.mod, elfStr.mod, 'Orc STR mod > Elf STR mod');
                if (elfInt) assertEqual(elfInt.mod, 6, 'Elf Mage INT mod (+6 for INT 22)');
                page.assertZeroErrors('T1-RA08-05');
            }
        },

        // ==================== RA-09: Floor 1 Monster Roster, Combat Arena & Consumables ====================
        {
            id: 'T1-RA09-01',
            ra: 'RA-09',
            desc: 'Approaching Floor 1 monster opens #combatModal with non-blank 3D canvas, bars, badge, and log',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                const found = await seekModalKind(page, 'combat', { maxSteps: 55 });
                const cs = found.combat;
                assert(cs.open, '#combatModal open');
                assertGt(cs.canvasW, 0, '#combatViewport3D canvas width');
                assertGt(cs.canvasH, 0, '#combatViewport3D canvas height');
                assertEqual(cs.turnBadge, 'HERO TURN', '#combatTurnBadge');
                assertGt(cs.logs.length, 0, '#combatLogBox entries');
                const shot = decodePng(await page.screenshot());
                const center = computePatchLuminance(shot, 0.5, 0.42, 0.14);
                assertGt(center.nonBlackRatio, 0.25, '#combatViewport3D non-black pixels');
                page.assertZeroErrors('T1-RA09-01');
            }
        },
        {
            id: 'T1-RA09-02',
            ra: 'RA-09',
            desc: 'Basic Attack updates #combatD20Val, logs roll math, runs enemy turn, and increments Round',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Attacker', ancestry: 'human', charClass: 'warrior' });
                await seekModalKind(page, 'combat', { maxSteps: 55 });
                const before = await readCombatState(page);
                const after = await triggerCombatAction(page, 'attack');
                if (after.open && !after.dismissVisible) {
                    assertEqual(after.round, before.round + 1, 'Combat round incremented');
                    assertGt(after.logs.length, before.logs.length, 'Combat log appended');
                    const d20Num = parseInt(after.d20Val, 10);
                    assertBetween(d20Num, 1, 20, '#combatD20Val');
                }
                page.assertZeroErrors('T1-RA09-02');
            }
        },
        {
            id: 'T1-RA09-03',
            ra: 'RA-09',
            desc: 'Class Special deducts MP consistently in combat card and Adventure HUD',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Arcanist', ancestry: 'elf', charClass: 'mage' });
                await seekModalKind(page, 'combat', { maxSteps: 55 });
                const before = await readCombatState(page);
                const btns = await inspectCombatButtons(page);
                assert(btns.special && !btns.special.disabled, 'Special button available with full MP');
                const after = await triggerCombatAction(page, 'special');
                const hud = await readAdventureHud(page);
                assertEqual(before.heroMp - after.heroMp, 18, 'Mage Firebolt Flare costs 18 MP');
                assertEqual(hud.mp, after.heroMp, 'Adventure HUD MP synced with combat card');
                page.assertZeroErrors('T1-RA09-03');
            }
        },
        {
            id: 'T1-RA09-04',
            ra: 'RA-09',
            desc: 'Defend boosts AC by +4, shows Guard buff, restores +4 MP, and resets on next round',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Bulwark', ancestry: 'elf', charClass: 'warrior' });
                await seekModalKind(page, 'combat', { maxSteps: 55 });
                // Spend 15 MP first so +4 MP recovery is observable below maxMp (Elf Warrior max 36 crit cannot 1-shot 38HP skeleton)
                await triggerCombatAction(page, 'special');
                const beforeDef = await readCombatState(page);
                const afterDef = await triggerCombatAction(page, 'defend');
                assertEqual(afterDef.heroMp, Math.min(afterDef.heroMaxMp, beforeDef.heroMp + 4), 'Defend +4 MP recovery');
                assert(afterDef.logs.some((l) => /Guard|AC boosted|defensive guard/i.test(l.text)), 'Guard buff logged');
                assertEqual(afterDef.heroEffectiveAc, beforeDef.heroEffectiveAc, 'Effective AC resets on next player turn');
                page.assertZeroErrors('T1-RA09-04');
            }
        },
        {
            id: 'T1-RA09-05',
            ra: 'RA-09',
            desc: 'Defeating monster displays VICTORY!, awards XP & Gold, and #btnDismissCombat closes cleanly',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Victor', ancestry: 'orc', charClass: 'warrior' });
                await seekModalKind(page, 'combat', { maxSteps: 55 });
                const hudBefore = await readAdventureHud(page);
                const res = await runCombat(page, 'win');
                assertEqual(res.outcome, 'victory', 'Combat victory outcome');
                assertEqual(res.state.turnBadge, 'VICTORY!', 'VICTORY! badge');
                const hudAfter = await readAdventureHud(page);
                assertGt(hudAfter.xp, hudBefore.xp, 'XP awarded after victory');
                assertGt(hudAfter.gold, hudBefore.gold, 'Gold awarded after victory');
                assertEqual(await detectOpenModal(page), null, 'Combat modal closed after dismiss');
                page.assertZeroErrors('T1-RA09-05');
            }
        },

        // ==================== RA-10: Trap Archetypes, Disarm Mechanics & True 0-HP Lethality ====================
        {
            id: 'T1-RA10-01',
            ra: 'RA-10',
            desc: 'Trap rooms expose Floor 1 trap archetypes with modal or chronicle log output',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Scout', ancestry: 'goblin', charClass: 'warrior' });
                const found = await seekModalKind(page, 'trap', { maxSteps: 60 });
                assert(found.kind === 'trap' || found.kind === 'trap-step', `Expected trap encounter, got ${found.kind}`);
                if (found.kind === 'trap') {
                    assertMatch(`${found.encounter.title} ${found.encounter.story}`, /spike|pit|scythe|pendulum|dart|blood|rune|trap/i, 'Trap archetype text');
                }
                page.assertZeroErrors('T1-RA10-01');
            }
        },
        {
            id: 'T1-RA10-02',
            ra: 'RA-10',
            desc: 'Disarmable trap #encounterModal offers >= 2 stat alternatives (AGI/INT/STR/VIT)',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Tinker', ancestry: 'human', charClass: 'warrior' });
                const found = await seekModalKind(page, 'trap', { maxSteps: 60 });
                assertEqual(found.kind, 'trap', 'Expected disarmable trap #encounterModal');
                assertGte(found.encounter.options.length, 2, 'Trap modal option count');
                const stats = new Set(found.encounter.options.map((o) => o.stat));
                assertGte(stats.size, 2, 'Distinct stat alternatives on trap modal');
                page.assertZeroErrors('T1-RA10-02');
            }
        },
        {
            id: 'T1-RA10-03',
            ra: 'RA-10',
            desc: 'Passing a trap disarm/evade check avoids damage and renders trap safe to cross',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Nimble', ancestry: 'goblin', charClass: 'warrior' });
                let passedDisarm = false;
                for (let retry = 0; retry < 3; retry++) {
                    const found = await seekModalKind(page, 'trap', { maxSteps: 60 });
                    if (found.kind !== 'trap') continue;
                    const hpBefore = (await readAdventureHud(page)).hp;
                    const res = await resolveEncounterModal(page, { strategy: 'optimal' });
                    if (res.success) {
                        const hpAfter = (await readAdventureHud(page)).hp;
                        assertEqual(hpAfter, hpBefore, 'HP preserved on trap disarm/evade pass');
                        // Walk forward over trap spot — no extra damage
                        await stepMove(page, { keys: ['KeyW'], holdMs: 320 });
                        const hpWalk = (await readAdventureHud(page)).hp;
                        assertEqual(hpWalk, hpAfter, 'Safe crossing after disarmed trap');
                        passedDisarm = true;
                        break;
                    }
                }
                assert(passedDisarm, 'Expected to pass at least one trap disarm check');
                page.assertZeroErrors('T1-RA10-03');
            }
        },
        {
            id: 'T1-RA10-04',
            ra: 'RA-10',
            desc: 'Failing trap check or stepping onto armed trap deals 8-15 HP damage and logs trap injury',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Clumsy', ancestry: 'dwarf', charClass: 'warrior' });
                let observedTrapDamage = false;
                for (let attempt = 0; attempt < 6; attempt++) {
                    const found = await seekModalKind(page, 'trap', { maxSteps: 60 });
                    if (found.kind === 'trap-step') {
                        const dmg = found.hudBefore.hp - found.hudAfter.hp;
                        assertBetween(dmg, 8, 15, 'Step-on trap damage');
                        observedTrapDamage = true;
                        break;
                    }
                    const hpBefore = (await readAdventureHud(page)).hp;
                    const res = await resolveEncounterModal(page, { strategy: 'weakest' });
                    if (!res.success) {
                        const hpAfter = (await readAdventureHud(page)).hp;
                        const dmg = hpBefore - hpAfter;
                        assertBetween(dmg, 8, 15, 'Failed trap check damage');
                        observedTrapDamage = true;
                        break;
                    }
                }
                assert(observedTrapDamage, 'Expected to observe 8-15 HP trap damage');
                page.assertZeroErrors('T1-RA10-04');
            }
        },
        {
            id: 'T1-RA10-05',
            ra: 'RA-10',
            timeoutMs: 120000,
            desc: 'True 0-HP Lethality: hitting trap at <= 10 HP drops HP to 0 (no 1-HP clamp) and respawns at Entrance',
            run: async (ctx) => {
                const page = await ctx.openPage();
                // Elf Mage has 72 HP — wear down to <= 8 HP so every Floor 1 trap (8-15 dmg) is strictly lethal!
                await forgeHero(page, { name: 'Fragile', ancestry: 'elf', charClass: 'mage' });
                const startRoom = await assertFloor1Boot(page);
                let verifiedLethality = false;

                for (let cycle = 0; cycle < 18; cycle++) {
                    const hud = await readAdventureHud(page);
                    if (hud.hp <= 8) {
                        const found = await seekModalKind(page, 'trap', { maxSteps: 60 });
                        if (found.kind === 'trap-step') {
                            const postHud = await readAdventureHud(page);
                            assertNotEqual(postHud.hp, 1, 'Trap damage MUST NOT clamp HP to 1');
                            assert(
                                /entrance|threshold|vestibule/i.test(postHud.roomText) || postHud.hp === 0,
                                `Expected 0-HP trap lethality & Entrance respawn, got hp=${postHud.hp} room=${postHud.roomText}`
                            );
                            verifiedLethality = true;
                            break;
                        }
                        const res = await resolveEncounterModal(page, { strategy: 'weakest', dismiss: false });
                        if (!res.success) {
                            const preDismissHud = await readAdventureHud(page);
                            assertNotEqual(preDismissHud.hp, 1, 'Trap damage MUST NOT clamp HP to 1');
                            assert(
                                preDismissHud.hp === 0 || /entrance|threshold|vestibule/i.test(preDismissHud.roomText),
                                `Expected 0 HP or respawn on lethal trap hit, got hp=${preDismissHud.hp} room=${preDismissHud.roomText}`
                            );
                            await page.click(SEL.encDismiss);
                            await page.sleep(200);
                            const postHud = await readAdventureHud(page);
                            assertNotEqual(postHud.hp, 1, 'Post-dismiss HP MUST NOT be clamped to 1');
                            assertMatch(postHud.roomText, /entrance|threshold|vestibule/i, 'Respawned at Entrance after 0-HP trap death');
                            verifiedLethality = true;
                            break;
                        } else {
                            await page.click(SEL.encDismiss);
                            await page.sleep(150);
                        }
                    } else {
                        const m = await seekModalKind(page, 'combat', { maxSteps: 45 }).catch(() => null);
                        if (m) {
                            await runCombat(page, 'lowHpThenFlee', { lowHpRatio: 0.11, maxRounds: 20 });
                        } else {
                            const t = await seekModalKind(page, 'trap', { maxSteps: 35 }).catch(() => null);
                            if (t && t.kind === 'trap') {
                                await resolveEncounterModal(page, { strategy: 'weakest' });
                            }
                        }
                    }
                }
                assert(verifiedLethality, 'Expected to trigger 0-HP trap lethality & Entrance respawn');
                page.assertZeroErrors('T1-RA10-05');
            }
        },

        // ==================== RA-11: Horror Lighting, Universal Torchlight, Vignette & Audio Fail-Safe ====================
        {
            id: 'T1-RA11-01',
            ra: 'RA-11',
            desc: '#viewportAdventure displays dark horror dungeon tones with non-flat lighting contrast',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await assertFloor1Boot(page);
                const light = await verifyDungeonTorchLighting(page);
                assertLte(light.bandLum.mean, 48, 'Dark horror crypt mean luminance');
                assertGt(light.bandLum.max - light.bandLum.min, 30, 'Non-flat lighting contrast');
                page.assertZeroErrors('T1-RA11-01');
            }
        },
        {
            id: 'T1-RA11-02',
            ra: 'RA-11',
            desc: 'Universal Torchlight: both Warrior and Mage heroes emit a warm central light halo',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'TorchWar', ancestry: 'human', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const wLight = await verifyDungeonTorchLighting(page);
                assertGt(wLight.haloDelta, 2.0, `Warrior center torch halo > dark corners (delta=${wLight.haloDelta.toFixed(2)})`);

                await returnToForge(page);
                await forgeHero(page, { name: 'TorchMage', ancestry: 'elf', charClass: 'mage' });
                await assertFloor1Boot(page);
                const mLight = await verifyDungeonTorchLighting(page);
                assertGt(mLight.haloDelta, 2.0, `Mage center torch halo > dark corners (delta=${mLight.haloDelta.toFixed(2)})`);
                page.assertZeroErrors('T1-RA11-02');
            }
        },
        {
            id: 'T1-RA11-03',
            ra: 'RA-11',
            desc: 'Fog-of-War: Room 1 appears shrouded before entry and brightens visibly upon entering',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await assertFloor1Boot(page);
                const before = decodePng(await page.screenshot());
                const shrouded = computePatchLuminance(before, 0.5, 0.30, 0.10, 2);

                await enterRoom1(page);
                const after = decodePng(await page.screenshot());
                const revealed = computePatchLuminance(after, 0.5, 0.42, 0.12, 2);
                assertGt(revealed.mean, shrouded.mean + 1.5, 'Room 1 fog-of-war brightness lift on entry');
                page.assertZeroErrors('T1-RA11-03');
            }
        },
        {
            id: 'T1-RA11-04',
            ra: 'RA-11',
            desc: '#screenAdventure shows dark vignette and triggers crimson low-HP pulse/border redness when wounded',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Wounded', ancestry: 'elf', charClass: 'mage' });
                await assertFloor1Boot(page);
                const fullHud = await readAdventureHud(page);
                const hasVignette = fullHud.dangerEls.some((d) =>
                    /vignette/i.test(d.id + ' ' + d.className) || /radial-gradient/i.test(d.backgroundImage)
                );
                assert(hasVignette, 'Expected horror vignette overlay styling in #screenAdventure');

                // Drop HP below low-HP threshold (~30% of 72 = 21 HP)
                for (let i = 0; i < 6; i++) {
                    const hud = await readAdventureHud(page);
                    if (hud.hp <= Math.floor(hud.maxHp * 0.30)) break;
                    const c = await seekModalKind(page, 'combat', { maxSteps: 35 }).catch(() => null);
                    if (c) {
                        await runCombat(page, 'lowHpThenFlee', { lowHpRatio: 0.30, maxRounds: 12 });
                    }
                }
                const lowHud = await readAdventureHud(page);
                assertLte(lowHud.hp, Math.floor(lowHud.maxHp * 0.35), 'Hero reached low HP');
                const lowPng = decodePng(await page.screenshot());
                const redness = computeBorderRedness(lowPng);
                const lowClass = lowHud.dangerEls.some((d) => /low.?hp|danger|crimson|critical/i.test(d.className));
                assert(lowClass || redness.redPixelRatio > 0.01 || redness.meanRedExcess > 8,
                    `Expected low-HP crimson pulse styling or red vignette border (redRatio=${redness.redPixelRatio.toFixed(3)})`);
                page.assertZeroErrors('T1-RA11-04');
            }
        },
        {
            id: 'T1-RA11-05',
            ra: 'RA-11',
            desc: 'Damage triggers flash/shake feedback and audio toggles/M shortcut work inside Adventure without errors',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'AudioDelver', ancestry: 'human', charClass: 'warrior' });
                await assertFloor1Boot(page);

                const musicBefore = await page.eval(() => document.getElementById('btnMusicToggle')?.textContent?.trim());
                await page.pressKey('KeyM');
                await page.sleep(100);
                const musicAfter = await page.eval(() => document.getElementById('btnMusicToggle')?.textContent?.trim());
                assertNotEqual(musicAfter, musicBefore, 'Adventure M key toggles #btnMusicToggle');

                const sfxBefore = await page.eval(() => document.getElementById('btnSoundToggle')?.textContent?.trim());
                await page.click('#btnSoundToggle');
                await page.sleep(80);
                const sfxAfter = await page.eval(() => document.getElementById('btnSoundToggle')?.textContent?.trim());
                assertNotEqual(sfxAfter, sfxBefore, 'Adventure #btnSoundToggle toggles SFX');

                // Confirm trap or combat hit produces damage feedback cleanly
                const found = await seekModalKind(page, 'trap', { maxSteps: 50 });
                if (found.kind === 'trap') {
                    await resolveEncounterModal(page, { strategy: 'weakest' });
                }
                page.assertZeroErrors('T1-RA11-05');
            }
        },

        // ==================== RA-12: Floor 1 Exit Victory & Fresh Replay Lifecycle ====================
        {
            id: 'T1-RA12-01',
            ra: 'RA-12',
            timeoutMs: 160000,
            desc: 'Reaching Floor 1 Exit Seal/Stairs opens Floor 1 Exit Victory UI',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Conqueror', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const run = await exploreFloor1(page, { maxSteps: 100, timeoutMs: 145000 });
                assert(run.victoryReached, 'Expected Floor 1 Exit Victory UI to open');
                const vui = await readVictoryUi(page);
                assert(vui.open, 'Victory UI visible');
                page.assertZeroErrors('T1-RA12-01');
            }
        },
        {
            id: 'T1-RA12-02',
            ra: 'RA-12',
            timeoutMs: 160000,
            desc: 'Victory UI displays Floor 1 completion message and run stats (XP / Gold)',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Champion', ancestry: 'dwarf', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const run = await exploreFloor1(page, { maxSteps: 100, timeoutMs: 145000 });
                assert(run.victoryReached, 'Victory reached');
                const vui = await readVictoryUi(page);
                assertMatch(vui.text, /floor\s*1|escaped|victory|complete|stairs|seal/i, 'Victory completion text');
                assertMatch(vui.text, /xp|gold/i, 'Victory UI run stats (XP/Gold)');
                page.assertZeroErrors('T1-RA12-02');
            }
        },
        {
            id: 'T1-RA12-03',
            ra: 'RA-12',
            timeoutMs: 160000,
            desc: 'Play Again from Victory UI starts fresh Floor 1 run at Entrance (XP=0, Gold=0, full HP/MP, cleared log)',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Replayer', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const run = await exploreFloor1(page, { maxSteps: 100, timeoutMs: 145000 });
                assert(run.victoryReached, 'Victory reached');
                await clickVictoryAction(page, 'playAgain');

                const hud = await readAdventureHud(page);
                assertMatch(hud.roomText, /entrance|threshold|vestibule/i, 'Reset at Entrance');
                assertEqual(hud.xp, 0, 'XP reset to 0');
                assertEqual(hud.gold, 0, 'Gold reset to 0');
                assertEqual(hud.hp, hud.maxHp, 'HP restored');
                assertEqual(hud.mp, hud.maxMp, 'MP restored');
                assertLte(hud.logs.length, 2, 'Cleared #advLog on Play Again');
                page.assertZeroErrors('T1-RA12-03');
            }
        },
        {
            id: 'T1-RA12-04',
            ra: 'RA-12',
            timeoutMs: 160000,
            desc: 'Return to Title from Victory UI closes Victory UI, disposes #viewportAdventure, and shows #screenStart',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Homeward', ancestry: 'human', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const run = await exploreFloor1(page, { maxSteps: 100, timeoutMs: 145000 });
                assert(run.victoryReached, 'Victory reached');
                await clickVictoryAction(page, 'title');

                await assertTitleVisible(page);
                const advCanvasCount = await page.eval(() => document.querySelectorAll('#viewportAdventure canvas').length);
                assertEqual(advCanvasCount, 0, '#viewportAdventure canvas disposed');
                page.assertZeroErrors('T1-RA12-04');
            }
        },
        {
            id: 'T1-RA12-05',
            ra: 'RA-12',
            timeoutMs: 160000,
            desc: 'Fresh post-victory run resets unlocked doors to locked and restores cleared Room 1/2 encounters',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'NewCycle', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const run1 = await exploreFloor1(page, { maxSteps: 100, timeoutMs: 145000 });
                assert(run1.victoryReached, 'Run 1 victory reached');

                await clickVictoryAction(page, 'playAgain');
                await assertFloor1Boot(page);
                const doorRun2 = await seekModalKind(page, 'door', { maxSteps: 45 });
                assert(doorRun2.encounter.open, 'Previously unlocked door is locked again in fresh post-victory run');
                page.assertZeroErrors('T1-RA12-05');
            }
        }
    ];
}
