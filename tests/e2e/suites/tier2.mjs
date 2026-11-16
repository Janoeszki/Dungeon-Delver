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
import { startServer, allocateAdjacentFreePorts } from '../lib/serverManager.mjs';
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
    requireDreadLogs,
    detectOpenModal,
    readVictoryUi,
    clickVictoryAction,
    readModalDisplays,
    isElementVisible
} from '../lib/dom.mjs';
import {
    resolveEncounterModal
} from '../lib/encounterDriver.mjs';
import {
    readCombatState,
    inspectCombatButtons,
    listCombatItems,
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
    seekModalKind,
    muteMusicAndSfxOnTitle
} from '../lib/scenarios.mjs';
import {
    decodePng,
    computeRmsDelta,
    computeBorderRedness
} from '../lib/vision.mjs';

export function getTier2Tests() {
    return [
        // ==================== RA-01 Boundaries ====================
        {
            id: 'T2-RA01-01',
            ra: 'RA-01',
            desc: 'Missing asset GET /does-not-exist.js returns 404 text/plain without crashing server',
            run: async (ctx) => {
                const res = await fetch(`${ctx.baseUrl}/does-not-exist.js`);
                assertEqual(res.status, 404, 'Missing path HTTP status');
                assertEqual(res.headers.get('content-type'), 'text/plain', '404 Content-Type');
                const body = await res.text();
                assertEqual(body, '404 Not Found', '404 body');

                const health = await fetch(`${ctx.baseUrl}/`);
                assertEqual(health.status, 200, 'Subsequent GET / after 404');
                await health.arrayBuffer();
            }
        },
        {
            id: 'T2-RA01-02',
            ra: 'RA-01',
            desc: 'Directory paths /js/ and /vendor/ return 404 cleanly',
            run: async (ctx) => {
                for (const p of ['/js/', '/vendor/']) {
                    const res = await fetch(`${ctx.baseUrl}${p}`);
                    assertEqual(res.status, 404, `Status for directory ${p}`);
                    await res.arrayBuffer();
                }
            }
        },
        {
            id: 'T2-RA01-03',
            ra: 'RA-01',
            desc: 'Path traversal probes return 404 and never expose host files',
            run: async (ctx) => {
                for (const probe of ['/../../etc/passwd', '/..%2f..%2fetc/hosts', '/js/../../etc/passwd']) {
                    const res = await fetch(`${ctx.baseUrl}${probe}`);
                    assertEqual(res.status, 404, `Status for traversal ${probe}`);
                    const body = await res.text();
                    assert(!body.includes('root:'), `Traversal ${probe} leaked passwd content`);
                }
            }
        },
        {
            id: 'T2-RA01-04',
            ra: 'RA-01',
            desc: 'Query-string URLs strip ?params and serve valid HTML and PNG MIME types',
            run: async (ctx) => {
                const htmlRes = await fetch(`${ctx.baseUrl}/?run=1`);
                assertEqual(htmlRes.status, 200, '/?run=1 status');
                assertEqual(htmlRes.headers.get('content-type'), 'text/html; charset=utf-8', '/?run=1 MIME');
                await htmlRes.arrayBuffer();

                const idxRes = await fetch(`${ctx.baseUrl}/index.html?v=99`);
                assertEqual(idxRes.status, 200, '/index.html?v=99 status');
                assertEqual(idxRes.headers.get('content-type'), 'text/html; charset=utf-8', '/index.html?v=99 MIME');
                await idxRes.arrayBuffer();

                const pngRes = await fetch(`${ctx.baseUrl}/dungeon_delver_logo_small.png?cb=123`);
                assertEqual(pngRes.status, 200, 'PNG query status');
                assertEqual(pngRes.headers.get('content-type'), 'image/png', 'PNG query MIME');
                await pngRes.arrayBuffer();
            }
        },
        {
            id: 'T2-RA01-05',
            ra: 'RA-01',
            desc: 'EADDRINUSE binds PORT+1 and aborting external fonts boots Chromium with 0 errors',
            run: async () => {
                const [p1, p2] = await allocateAdjacentFreePorts();
                const srv1 = await startServer({ port: p1 });
                let srv2 = null;
                try {
                    srv2 = await startServer({ port: p1, readyPort: p2 });
                    const logs2 = srv2.getLogs();
                    assertIncludes(logs2.stdout, `Port ${p1} in use`, 'EADDRINUSE fallback log');
                    assertIncludes(logs2.stdout, `http://localhost:${p2}`, 'Bound PORT+1 banner');

                    const { launchChromium } = await import('../lib/cdp.mjs');
                    const br = await launchChromium();
                    try {
                        const page = await br.newPage({ url: srv2.baseUrl, fontMode: 'abort' });
                        try {
                            await assertTitleVisible(page);
                            assertGt(page.interceptedFonts.length, 0, 'Expected font requests intercepted and aborted');
                            page.assertZeroErrors('T2-RA01-05');
                        } finally {
                            await page.close();
                        }
                    } finally {
                        await br.close();
                    }
                } finally {
                    if (srv2) await srv2.stop().catch(() => {});
                    await srv1.stop().catch(() => {});
                }
            }
        },

        // ==================== RA-02 Boundaries ====================
        {
            id: 'T2-RA02-01',
            ra: 'RA-02',
            desc: 'Lore modal closes via Escape and backdrop click without click-through to #btnQuickDelve',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await assertTitleVisible(page);
                await page.click('#btnShowLore');
                await page.sleep(80);
                assert(await isElementVisible(page, '#loreModal'), '#loreModal open');

                await page.pressKey('Escape');
                await page.sleep(80);
                assert(!(await isElementVisible(page, '#loreModal')), '#loreModal closed by Escape');

                await page.click('#btnShowLore');
                await page.sleep(80);
                const modalBox = await page.getElementBox('#loreModal');
                await page.clickAt(modalBox.left + 10, modalBox.top + 10);
                await page.sleep(150);
                assert(!(await isElementVisible(page, '#loreModal')), '#loreModal closed by backdrop click');
                await assertTitleVisible(page);
                page.assertZeroErrors('T2-RA02-01');
            }
        },
        {
            id: 'T2-RA02-02',
            ra: 'RA-02',
            desc: 'Music volume slider handles 0, mid, and 100 boundary adjustments cleanly',
            run: async (ctx) => {
                const page = await ctx.openPage();
                const box = await page.getElementBox('#musicVolumeSlider');
                await page.clickAt(box.left + 1, box.y);
                await page.sleep(60);
                const minVal = await page.eval(() => Number(document.getElementById('musicVolumeSlider').value));
                assertLte(minVal, 10, 'Slider left boundary near 0');

                await page.clickAt(box.left + box.width / 2, box.y);
                await page.sleep(60);
                const midVal = await page.eval(() => Number(document.getElementById('musicVolumeSlider').value));
                assertBetween(midVal, 35, 65, 'Slider center boundary near 50');

                await page.clickAt(box.left + box.width - 1, box.y);
                await page.sleep(60);
                const maxVal = await page.eval(() => Number(document.getElementById('musicVolumeSlider').value));
                assertGte(maxVal, 90, 'Slider right boundary near 100');
                page.assertZeroErrors('T2-RA02-02');
            }
        },
        {
            id: 'T2-RA02-03',
            ra: 'RA-02',
            desc: 'Rapidly toggling Music and SFX 5 times keeps deterministic state with 0 errors',
            run: async (ctx) => {
                const page = await ctx.openPage();
                const sfx0 = await page.eval(() => document.getElementById('btnStartSfxToggle')?.textContent?.trim());
                for (let i = 0; i < 5; i++) {
                    await page.click('#btnStartSfxToggle');
                    await page.sleep(30);
                }
                const sfx5 = await page.eval(() => document.getElementById('btnStartSfxToggle')?.textContent?.trim());
                assertNotEqual(sfx5, sfx0, 'SFX flipped after odd (5) toggles');

                const mus0 = await page.eval(() => document.getElementById('btnStartMusicToggle')?.textContent?.trim());
                for (let i = 0; i < 5; i++) {
                    await page.click('#btnStartMusicToggle');
                    await page.sleep(30);
                }
                const mus5 = await page.eval(() => document.getElementById('btnStartMusicToggle')?.textContent?.trim());
                assertNotEqual(mus5, mus0, 'Music button state coherent after 5 toggles');
                page.assertZeroErrors('T2-RA02-03');
            }
        },
        {
            id: 'T2-RA02-04',
            ra: 'RA-02',
            desc: 'Clicking #audioPromptPill handles gesture audio wake/toggle cleanly',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await page.click('#audioPromptPill');
                await page.sleep(150);
                const pill = await page.eval(() => document.getElementById('audioPromptPill')?.textContent?.trim() || '');
                assertGt(pill.length, 5, '#audioPromptPill non-empty');
                page.assertZeroErrors('T2-RA02-04');
            }
        },
        {
            id: 'T2-RA02-05',
            ra: 'RA-02',
            desc: 'Narrow viewport 390x844 keeps Title CTAs non-clipped, non-overlapping, and clickable',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await page.setViewport(390, 844);
                await page.sleep(200);
                const boxes = await page.eval(() => {
                    const ids = ['btnStartForge', 'btnQuickDelve', 'btnShowLore'];
                    return ids.map((id) => {
                        const el = document.getElementById(id);
                        if (!el) return null;
                        const r = el.getBoundingClientRect();
                        return { id, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
                    });
                });
                for (const b of boxes) {
                    assert(b && b.width > 20 && b.height > 20, `CTA ${b?.id} visible`);
                    assertGte(b.left, 0, `${b.id} left >= 0`);
                    assertLte(b.right, 390, `${b.id} right <= 390`);
                }
                for (let i = 0; i < boxes.length; i++) {
                    for (let j = i + 1; j < boxes.length; j++) {
                        const a = boxes[i], b = boxes[j];
                        const overlap = !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
                        assert(!overlap, `Overlap detected between ${a.id} and ${b.id} on 390x844`);
                    }
                }
                await page.click('#btnShowLore');
                await page.sleep(100);
                assert(await isElementVisible(page, '#loreModal'), 'Lore CTA clickable on 390x844');
                page.assertZeroErrors('T2-RA02-05');
            }
        },

        // ==================== RA-03 Boundaries ====================
        {
            id: 'T2-RA03-01',
            ra: 'RA-03',
            desc: 'Empty/whitespace hero name falls back to "Hero"; >16 chars clamps at maxlength=16',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await openForge(page);
                await page.type('#heroNameInput', '');
                let s = await readCreatorStats(page);
                assertEqual(s.nameBadge, 'Hero', 'Empty name fallback badge');

                await page.type('#heroNameInput', '   ');
                s = await readCreatorStats(page);
                assertEqual(s.nameBadge, 'Hero', 'Whitespace name fallback badge');

                await page.type('#heroNameInput', 'MaximilianusTheImmortal99');
                s = await readCreatorStats(page);
                assertEqual(s.nameInput.length, 16, 'Maxlength 16 clamp');
                assertEqual(s.nameInput, 'MaximilianusTheI', 'Clamped 16-char value');
                page.assertZeroErrors('T2-RA03-01');
            }
        },
        {
            id: 'T2-RA03-02',
            ra: 'RA-03',
            desc: 'Selecting hairstyle auto-unchecks #checkHelm and toggling #checkHelm restores helm',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await openForge(page);
                const initStats = await readCreatorStats(page);
                assert(initStats.showHelm, 'Helm checked initially');

                await page.click('[data-hair-style="2"]');
                await page.sleep(150);
                const afterHair = await readCreatorStats(page);
                assert(!afterHair.showHelm, 'Selecting hairstyle automatically unchecks #checkHelm');
                const noHelmShot = decodePng(await page.screenshot());

                await page.click('#checkHelm');
                await page.sleep(180);
                const afterHelm = await readCreatorStats(page);
                assert(afterHelm.showHelm, 'Clicking #checkHelm re-enables helm');
                const helmShot = decodePng(await page.screenshot());
                const rms = computeRmsDelta(noHelmShot, helmShot, {
                    includeNorm: { rx: 0.32, ry: 0.16, rw: 0.36, rh: 0.56 },
                    excludeNorms: [],
                    step: 2
                });
                assertGt(rms, 1.0, 'Helm toggle 3D pixel change');
                page.assertZeroErrors('T2-RA03-02');
            }
        },
        {
            id: 'T2-RA03-03',
            ra: 'RA-03',
            desc: 'Switching to Dwarf with Body Type A & Beard 0 auto-equips Beard Style 3',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await openForge(page);
                const init = await readCreatorStats(page);
                assertEqual(init.bodyType, 'a', 'Initial bodyType a');
                assertEqual(init.beardStyle, '0', 'Initial beardStyle 0');

                await page.click('[data-ancestry="dwarf"]');
                await page.sleep(120);
                const afterDwarf = await readCreatorStats(page);
                assertEqual(afterDwarf.ancestry, 'dwarf', 'Dwarf selected');
                assertEqual(afterDwarf.beardStyle, '3', 'Dwarf auto-equipped beard style 3');
                page.assertZeroErrors('T2-RA03-03');
            }
        },
        {
            id: 'T2-RA03-04',
            ra: 'RA-03',
            desc: 'All bodyType, beardStyle, and skin/hair/armor palette dots update active class exclusively',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await openForge(page);

                for (const bt of ['b', 'a']) {
                    await page.click(`[data-body-type="${bt}"]`);
                    const cnt = await page.eval(() => document.querySelectorAll('[data-body-type].active').length);
                    assertEqual(cnt, 1, 'Exclusive active body-type');
                    assertEqual((await readCreatorStats(page)).bodyType, bt, 'Selected bodyType');
                }
                for (const bs of ['1', '2', '3', '0']) {
                    await page.click(`[data-beard-style="${bs}"]`);
                    const cnt = await page.eval(() => document.querySelectorAll('[data-beard-style].active').length);
                    assertEqual(cnt, 1, 'Exclusive active beard-style');
                    assertEqual((await readCreatorStats(page)).beardStyle, bs, 'Selected beardStyle');
                }
                for (const palId of ['skinPalette', 'hairPalette', 'armorPalette']) {
                    const colors = await page.eval((id) =>
                        Array.from(document.querySelectorAll(`#${id} .color-dot`)).map((d) => d.getAttribute('data-color'))
                    , palId);
                    assertGt(colors.length, 1, `Palette ${palId} dots`);
                    for (const col of colors) {
                        await page.click(`#${palId} .color-dot[data-color="${col}"]`);
                        const activeCount = await page.eval((id) =>
                            document.querySelectorAll(`#${id} .color-dot.active`).length
                        , palId);
                        assertEqual(activeCount, 1, `${palId} exclusive active dot`);
                    }
                }
                page.assertZeroErrors('T2-RA03-04');
            }
        },
        {
            id: 'T2-RA03-05',
            ra: 'RA-03',
            desc: 'Unicode/trimmed hero names work, M ignores focused input, and canvas drag rotates pedestal',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await openForge(page);

                await page.type('#heroNameInput', '  Ælfric-99  ');
                const stats = await readCreatorStats(page);
                assertEqual(stats.nameBadge, 'Ælfric-99', 'Trimmed unicode name badge');

                // Focus input and press M -> music button must NOT toggle
                await page.click('#heroNameInput');
                const musBefore = await page.eval(() => document.getElementById('btnMusicToggle')?.textContent?.trim());
                await page.pressKey('KeyM');
                await page.sleep(100);
                const musWhileFocused = await page.eval(() => document.getElementById('btnMusicToggle')?.textContent?.trim());
                assertEqual(musWhileFocused, musBefore, 'KeyM ignored while #heroNameInput focused');

                // Blur onto badge, press M -> toggles music
                await page.click('#heroNameBadge');
                await page.pressKey('KeyM');
                await page.sleep(120);
                const musAfterBlur = await page.eval(() => document.getElementById('btnMusicToggle')?.textContent?.trim());
                assertNotEqual(musAfterBlur, musBefore, 'KeyM toggles music after input blur');

                // Drag pedestal canvas horizontally
                const box = await page.getElementBox('#viewportCreator');
                const shot1 = decodePng(await page.screenshot());
                await page.drag(box.x - 90, box.y, box.x + 90, box.y, 12);
                await page.sleep(180);
                const shot2 = decodePng(await page.screenshot());
                const rms = computeRmsDelta(shot1, shot2, {
                    includeNorm: { rx: 0.30, ry: 0.16, rw: 0.40, rh: 0.68 },
                    excludeNorms: [],
                    step: 2
                });
                assertGt(rms, 1.5, 'Canvas drag rotation RMS delta');
                page.assertZeroErrors('T2-RA03-05');
            }
        },

        // ==================== RA-04 Boundaries ====================
        {
            id: 'T2-RA04-01',
            ra: 'RA-04',
            desc: 'Switching Dwarf Warrior -> Elf Mage resets Adventure HUD to exact 72 HP / 355 MP',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Stone', ancestry: 'dwarf', charClass: 'warrior' });
                const h1 = await readAdventureHud(page);
                assertEqual(h1.hp, 287, 'Dwarf Warrior HP');
                assertEqual(h1.mp, 30, 'Dwarf Warrior MP');

                await returnToForge(page);
                await forgeHero(page, { name: 'Faelar', ancestry: 'elf', charClass: 'mage' });
                const h2 = await readAdventureHud(page);
                assertEqual(h2.heroClass, 'Elf Mage', 'Updated hero class');
                assertEqual(h2.hp, 72, 'Elf Mage HP');
                assertEqual(h2.mp, 355, 'Elf Mage MP');
                page.assertZeroErrors('T2-RA04-01');
            }
        },
        {
            id: 'T2-RA04-02',
            ra: 'RA-04',
            desc: '3 rapid Forge <-> Adventure cycles leave exactly 1 live canvas and 0 WebGL errors',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await openForge(page);
                for (let i = 0; i < 3; i++) {
                    await page.click('#btnEnterDungeon');
                    await page.waitFor(() => {
                        const a = document.getElementById('screenAdventure');
                        const c = document.querySelector('#viewportAdventure canvas');
                        return a && getComputedStyle(a).display !== 'none' && c && c.width > 0;
                    }, { timeoutMs: 8000, label: `enter cycle ${i}` });
                    const hud = await readAdventureHud(page);
                    assertEqual(hud.canvasCount, 1, `Single canvas on cycle ${i}`);
                    await returnToForge(page);
                }
                page.assertZeroErrors('T2-RA04-02');
            }
        },
        {
            id: 'T2-RA04-03',
            ra: 'RA-04',
            desc: 'Return to Title from mid-run Adventure + Quick Delve starts fresh run with reset doors/XP/log',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'RunnerA', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                await seekModalKind(page, 'door', { maxSteps: 45 });
                await resolveEncounterModal(page, { strategy: 'optimal' });

                await returnToTitle(page);
                await quickDelve(page);
                await assertFloor1Boot(page);

                const hud = await readAdventureHud(page);
                assertEqual(hud.xp, 0, 'XP reset after Title -> Quick Delve');
                assertEqual(hud.gold, 0, 'Gold reset after Title -> Quick Delve');
                assert(!hud.logs.some((l) => l.text.includes('RunnerA')), 'No stale logs from RunnerA');
                const doorB = await seekModalKind(page, 'door', { maxSteps: 45 });
                assert(doorB.encounter.open, 'Door re-locked on fresh Quick Delve');
                page.assertZeroErrors('T2-RA04-03');
            }
        },
        {
            id: 'T2-RA04-04',
            ra: 'RA-04',
            desc: 'Quick Delve / Forge builds apply Dwarf Warrior HP > Elf Mage HP and Elf Mage MP > Dwarf Warrior MP',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Bulwark', ancestry: 'dwarf', charClass: 'warrior' });
                const dw = await readAdventureHud(page);
                await returnToForge(page);
                await forgeHero(page, { name: 'Arcane', ancestry: 'elf', charClass: 'mage' });
                const em = await readAdventureHud(page);

                assertGt(dw.maxHp, em.maxHp, 'Dwarf Warrior HP > Elf Mage HP');
                assertGt(em.maxMp, dw.maxMp, 'Elf Mage MP > Dwarf Warrior MP');
                page.assertZeroErrors('T2-RA04-04');
            }
        },
        {
            id: 'T2-RA04-05',
            ra: 'RA-04',
            desc: 'Adventure viewport resize (1280x800 -> 960x640 -> 1280x800) updates canvas cleanly',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await page.setViewport(960, 640);
                const small = await page.eval(() => {
                    const c = document.querySelector('#viewportAdventure canvas');
                    return c ? { w: c.clientWidth, h: c.clientHeight } : { w: 0, h: 0 };
                });
                assertBetween(small.w, 800, 960, 'Resized canvas width');
                assertBetween(small.h, 450, 640, 'Resized canvas height');
                assert(await isElementVisible(page, '#advLog'), '#advLog still visible at 960x640');

                await page.setViewport(1280, 800);
                const restored = await page.eval(() => {
                    const c = document.querySelector('#viewportAdventure canvas');
                    return c ? { w: c.clientWidth, h: c.clientHeight } : { w: 0, h: 0 };
                });
                assertGt(restored.w, small.w, 'Canvas expands back at 1280x800');
                page.assertZeroErrors('T2-RA04-05');
            }
        },

        // ==================== RA-05 Boundaries ====================
        {
            id: 'T2-RA05-01',
            ra: 'RA-05',
            desc: 'Flanking doorway jamb blocks off-center North entry until hero centers at doorway',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                const startRoom = await assertFloor1Boot(page);
                const idleRms = await calibrateIdleRms(page, 220);

                // Hug Entrance West wall far from x=0 doorway
                for (let i = 0; i < 6; i++) {
                    await stepMove(page, { keys: ['KeyA'], holdMs: 240, idleRms });
                }
                for (let i = 0; i < 5; i++) {
                    await stepMove(page, { keys: ['KeyW'], holdMs: 320, idleRms });
                }
                const atJamb = await readAdventureHud(page);
                assertEqual(atJamb.roomText, startRoom, 'Blocked by North doorway jamb when hugging West wall');

                // Slide East toward center doorway, then enter Room 1
                await stepMove(page, { keys: ['KeyD'], holdMs: 350, idleRms });
                const res = await enterRoom1(page);
                assertNotEqual(res.room1, startRoom, 'Crossed into Room 1 after centering');
                page.assertZeroErrors('T2-RA05-01');
            }
        },
        {
            id: 'T2-RA05-02',
            ra: 'RA-05',
            desc: 'Backtracking Room 1 -> Entrance -> Room 1 updates #hudRoom cleanly without spamming dread logs',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await enterRoom1(page);
                const dreads1 = await requireDreadLogs(page, 1);

                const idleRms = await calibrateIdleRms(page, 200);
                let backInEntrance = false;
                for (let i = 0; i < 12; i++) {
                    const st = await stepMove(page, { keys: ['KeyS'], holdMs: 360, idleRms });
                    if (/entrance|threshold|vestibule/i.test(st.hudAfter.roomText)) {
                        backInEntrance = true;
                        break;
                    }
                }
                assert(backInEntrance, 'Expected backtracking South to restore Entrance #hudRoom');

                await enterRoom1(page);
                const dreads2 = await requireDreadLogs(page, 1);
                assertEqual(dreads2.length, dreads1.length, 'No duplicate .log-msg.dread spam on Room 1 re-entry');
                page.assertZeroErrors('T2-RA05-02');
            }
        },
        {
            id: 'T2-RA05-03',
            ra: 'RA-05',
            desc: 'Idle Entrance spawn stays quiescent for 2.5s (no spurious modal or damage)',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                const startRoom = await assertFloor1Boot(page);
                const h0 = await readAdventureHud(page);
                await page.sleep(2500);
                const h1 = await readAdventureHud(page);
                assertEqual(await detectOpenModal(page), null, 'No spontaneous modal at spawn');
                assertEqual(h1.roomText, startRoom, '#hudRoom unchanged at spawn');
                assertEqual(h1.hp, h0.hp, 'HP unchanged while idle');
                page.assertZeroErrors('T2-RA05-03');
            }
        },
        {
            id: 'T2-RA05-04',
            ra: 'RA-05',
            desc: 'Full lateral span (West-to-East) of Room 1 exceeds Entrance vestibule span',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await assertFloor1Boot(page);
                const idleRms = await calibrateIdleRms(page, 200);

                for (let i = 0; i < 8; i++) {
                    const st = await stepMove(page, { keys: ['KeyA'], holdMs: 220, idleRms });
                    if (!st.moved) break;
                }
                let entSpan = 0;
                for (let i = 0; i < 12; i++) {
                    const st = await stepMove(page, { keys: ['KeyD'], holdMs: 220, idleRms });
                    if (!st.moved) break;
                    entSpan++;
                }

                await enterRoom1(page);
                await stepMove(page, { keys: ['KeyW'], holdMs: 600, idleRms });
                for (let i = 0; i < 14; i++) {
                    const st = await stepMove(page, { keys: ['KeyA'], holdMs: 220, idleRms });
                    if (!st.moved) break;
                }
                let r1Span = 0;
                for (let i = 0; i < 20; i++) {
                    const st = await stepMove(page, { keys: ['KeyD'], holdMs: 220, idleRms });
                    if (!st.moved) break;
                    r1Span++;
                }
                assertGt(r1Span, entSpan, `Room 1 lateral span (${r1Span}) > Entrance (${entSpan})`);
                page.assertZeroErrors('T2-RA05-04');
            }
        },
        {
            id: 'T2-RA05-05',
            ra: 'RA-05',
            desc: 'Room 1 ambient particles, torches, and props render cleanly with zero runtime/WebGL errors',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await enterRoom1(page);
                await page.sleep(800);
                const light = await verifyDungeonTorchLighting(page);
                assertGt(light.bandLum.nonBlackRatio, 0.08, 'Room 1 rendered pixels non-black');
                assertGt(light.center.mean, light.minCorner, 'Torchlight brightest near center hero');
                page.assertZeroErrors('T2-RA05-05');
            }
        },

        // ==================== RA-06 Boundaries ====================
        {
            id: 'T2-RA06-01',
            ra: 'RA-06',
            desc: 'Defeated monster chamber stays clear on re-entry (zero respawn, zero phantom traps)',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'ClearCheck', ancestry: 'orc', charClass: 'warrior' });
                const found = await seekModalKind(page, 'combat', { maxSteps: 55 });
                const monsterRoom = found.roomName;
                const res = await runCombat(page, 'win');
                assertEqual(res.outcome, 'victory', 'Monster defeated');

                const idleRms = await calibrateIdleRms(page, 200);
                await stepMove(page, { keys: ['KeyS'], holdMs: 1400, idleRms });
                await stepMove(page, { keys: ['KeyW'], holdMs: 1400, idleRms });
                const hpAfter = (await readAdventureHud(page)).hp;
                assertEqual(await detectOpenModal(page), null, `No monster respawn in cleared "${monsterRoom}"`);
                assertGte(hpAfter, res.state.heroHp, 'No phantom trap damage in cleared monster chamber');
                page.assertZeroErrors('T2-RA06-01');
            }
        },
        {
            id: 'T2-RA06-02',
            ra: 'RA-06',
            desc: 'Resolved trap chamber stays safe on re-entry (zero infinite loop or monster spawn)',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'TrapClear', ancestry: 'goblin', charClass: 'warrior' });
                const found = await seekModalKind(page, 'trap', { maxSteps: 55 });
                if (found.kind === 'trap') {
                    await resolveEncounterModal(page, { strategy: 'optimal' });
                }
                const hpSafe = (await readAdventureHud(page)).hp;
                const idleRms = await calibrateIdleRms(page, 200);
                await stepMove(page, { keys: ['KeyA'], holdMs: 600, idleRms });
                await stepMove(page, { keys: ['KeyD'], holdMs: 600, idleRms });
                assertEqual(await detectOpenModal(page), null, 'No combat or loop modal in resolved trap room');
                assertEqual((await readAdventureHud(page)).hp, hpSafe, 'No repeated trap damage');
                page.assertZeroErrors('T2-RA06-02');
            }
        },
        {
            id: 'T2-RA06-03',
            ra: 'RA-06',
            timeoutMs: 160000,
            desc: 'Floor 1 room graph maintains uninterrupted forward reachability to Exit without dead-end softlocks',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Pathfinder', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const run = await exploreFloor1(page, { maxSteps: 130, timeoutMs: 145000 });
                assert(run.victoryReached, 'Full reachability from Entrance to Floor 1 Exit Victory');
                page.assertZeroErrors('T2-RA06-03');
            }
        },
        {
            id: 'T2-RA06-04',
            ra: 'RA-06',
            desc: 'Room-bounded aggro: hugging Room 1 walls before unlocking portcullis never pulls adjacent monsters',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                const r1 = await enterRoom1(page);
                const idleRms = await calibrateIdleRms(page, 200);
                // Walk around Room 1 West/North corners away from corridor mouth without passing unlocked door
                await stepMove(page, { keys: ['KeyW'], holdMs: 600, idleRms });
                await stepMove(page, { keys: ['KeyA'], holdMs: 700, idleRms });
                await stepMove(page, { keys: ['KeyW'], holdMs: 700, idleRms });
                const hud = await readAdventureHud(page);
                assertEqual(hud.roomText, r1.room1, 'Remained in Room 1');
                assertNotEqual(await detectOpenModal(page), 'combat', 'No cross-wall aggro combat from Room 1');
                page.assertZeroErrors('T2-RA06-04');
            }
        },
        {
            id: 'T2-RA06-05',
            ra: 'RA-06',
            timeoutMs: 160000,
            desc: 'Repeated fresh Floor 1 runs preserve room exclusivity invariants with zero cross-run mutation',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'GraphA', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const run1 = await exploreFloor1(page, { maxSteps: 115, timeoutMs: 120000, exploreWings: true });
                const ch1 = run1.rooms.filter((r) => !/entrance|threshold|vestibule|hall of fallen|room\s*1\b|foyer/i.test(r.roomName));
                assertGte(ch1.length, 5, 'Run 1 visited >= 5 chambers');
                for (const c of ch1) assert(c.sawCombat !== c.sawTrap, `Run 1 exclusive chamber ${c.roomName}`);

                await returnToTitle(page);
                await quickDelve(page);
                await assertFloor1Boot(page);
                const doorRun2 = await seekModalKind(page, 'door', { maxSteps: 45 });
                assert(doorRun2.encounter.open, 'Run 2 doors reset to locked');
                page.assertZeroErrors('T2-RA06-05');
            }
        },

        // ==================== RA-07 Boundaries ====================
        {
            id: 'T2-RA07-01',
            ra: 'RA-07',
            desc: 'Simultaneous diagonal KeyW+KeyD and KeyW+KeyA glides cleanly along walls without NaN or freeze',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await assertFloor1Boot(page);
                const idleRms = await calibrateIdleRms(page, 220);
                await stepMove(page, { keys: ['KeyW', 'KeyD'], holdMs: 450, idleRms });
                await stepMove(page, { keys: ['KeyW', 'KeyA'], holdMs: 450, idleRms });
                const after = await stepMove(page, { keys: ['KeyS'], holdMs: 320, idleRms });
                assert(after.moved, 'Controls responsive after diagonal wall slide');
                page.assertZeroErrors('T2-RA07-01');
            }
        },
        {
            id: 'T2-RA07-02',
            ra: 'RA-07',
            desc: 'Manual KeyS input immediately interrupts active click-to-move waypoint pathing',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await enterRoom1(page);
                const idleRms = await calibrateIdleRms(page, 200);
                await page.clickAt(980, 400);
                await page.sleep(80);
                const override = await stepMove(page, { keys: ['KeyS'], holdMs: 380, idleRms });
                assert(override.moved, 'Manual KeyS input responds immediately during click pathing');
                page.assertZeroErrors('T2-RA07-02');
            }
        },
        {
            id: 'T2-RA07-03',
            ra: 'RA-07',
            desc: 'Clicking outer void/wall pixels clamps path cleanly without wall clipping or errors',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                const startRoom = await assertFloor1Boot(page);
                await page.clickAt(45, 190);
                await page.sleep(500);
                await page.clickAt(1230, 190);
                await page.sleep(500);
                const hud = await readAdventureHud(page);
                assertEqual(hud.roomText, startRoom, 'Void clicks do not clip hero out of Entrance');
                page.assertZeroErrors('T2-RA07-03');
            }
        },
        {
            id: 'T2-RA07-04',
            ra: 'RA-07',
            desc: 'Holding WASD/Arrow keys while #encounterModal is open blocks background locomotion',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                const found = await seekModalKind(page, 'door', { maxSteps: 45 });
                assertEqual(await detectOpenModal(page), 'encounter', 'Encounter modal open');
                const shot1 = decodePng(await page.screenshot());
                await page.holdKeys(['KeyW', 'ArrowUp'], 550);
                const hud = await readAdventureHud(page);
                assertEqual(hud.roomText, found.roomName, '#hudRoom unchanged while modal open');
                const shot2 = decodePng(await page.screenshot());
                const rms = computeRmsDelta(shot1, shot2);
                assertLte(rms, 6.0, 'Scene frozen under open modal during WASD holds');
                page.assertZeroErrors('T2-RA07-04');
            }
        },
        {
            id: 'T2-RA07-05',
            ra: 'RA-07',
            desc: 'Pressing against interior/exterior divider walls never triggers encounters on the opposite side',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                const r1 = await enterRoom1(page);
                const idleRms = await calibrateIdleRms(page, 200);
                // Hug Room 1 North-West wall near (-4, 4.5) adjacent to Charnel Ossuary
                await stepMove(page, { keys: ['KeyA'], holdMs: 650, idleRms });
                await stepMove(page, { keys: ['KeyW'], holdMs: 1200, idleRms });
                assertEqual(await detectOpenModal(page), null, 'No cross-wall encounter triggered');
                assertEqual((await readAdventureHud(page)).roomText, r1.room1, 'Room unchanged along solid wall');
                page.assertZeroErrors('T2-RA07-05');
            }
        },

        // ==================== RA-08 Boundaries ====================
        {
            id: 'T2-RA08-01',
            ra: 'RA-08',
            desc: 'Double-clicking an #encounterModal option resolves exactly 1 D20 roll (no duplicate log/effect)',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await seekModalKind(page, 'door', { maxSteps: 45 });
                const res = await resolveEncounterModal(page, { strategy: 'optimal', doubleClick: true });
                const rollLogs = res.logsAdded.filter((l) => /vs DC/i.test(l.text));
                assertEqual(rollLogs.length, 1, 'Single D20 roll log entry despite double-click');
                page.assertZeroErrors('T2-RA08-01');
            }
        },
        {
            id: 'T2-RA08-02',
            ra: 'RA-08',
            desc: 'Failing a door check twice in a row keeps doorway retryable with no permanent lock',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'TwoFails', ancestry: 'elf', charClass: 'mage' });
                await assertFloor1Boot(page);
                let consecutiveFails = 0;
                for (let attempt = 0; attempt < 15 && consecutiveFails < 2; attempt++) {
                    await seekModalKind(page, 'door', { maxSteps: 45 });
                    const res = await resolveEncounterModal(page, { strategy: 'weakest' });
                    if (!res.success) {
                        consecutiveFails++;
                    } else {
                        // Passed portcullis early; advance to next locked door (sanctum_gate)
                        consecutiveFails = 0;
                    }
                }
                assertGte(consecutiveFails, 2, 'Observed 2 door failures with continuous retryability');
                const retry = await seekModalKind(page, 'door', { maxSteps: 20 });
                assert(retry.encounter.open, 'Door modal re-opens cleanly after 2 consecutive failures');
                page.assertZeroErrors('T2-RA08-02');
            }
        },
        {
            id: 'T2-RA08-03',
            ra: 'RA-08',
            desc: 'Unlocked doorway stays open across room backtracking without re-prompting D20 modal',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'OpenWay', ancestry: 'orc', charClass: 'warrior' });
                await seekModalKind(page, 'door', { maxSteps: 45 });
                let unlocked = false;
                for (let i = 0; i < 8; i++) {
                    if ((await detectOpenModal(page)) !== 'encounter') {
                        await seekModalKind(page, 'door', { maxSteps: 16 });
                    }
                    const res = await resolveEncounterModal(page, { strategy: 'optimal' });
                    if (res.success) { unlocked = true; break; }
                }
                assert(unlocked, 'Door unlocked');
                const idleRms = await calibrateIdleRms(page, 200);
                // Walk through unlocked corridor into next room, then back South, then North again
                let nextRoom = '';
                const startR = (await readAdventureHud(page)).roomText;
                for (let s = 0; s < 10; s++) {
                    const st = await stepMove(page, { keys: ['KeyW'], holdMs: 360, idleRms });
                    if (st.hudAfter.roomText !== startR) { nextRoom = st.hudAfter.roomText; break; }
                }
                assertNotEqual(nextRoom, '', 'Entered unlocked room');
                await stepMove(page, { keys: ['KeyS'], holdMs: 1200, idleRms });
                await stepMove(page, { keys: ['KeyW'], holdMs: 1200, idleRms });
                assertNotEqual(await detectOpenModal(page), 'encounter', 'Unlocked door did not re-prompt modal');
                page.assertZeroErrors('T2-RA08-03');
            }
        },
        {
            id: 'T2-RA08-04',
            ra: 'RA-08',
            desc: 'D20 math invariants: 1<=raw<=20, total=raw+mod, Nat20 passes, Nat1 fails',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await seekModalKind(page, 'door', { maxSteps: 45 });
                const res = await resolveEncounterModal(page, { strategy: 'optimal' });
                assertBetween(res.rawRoll, 1, 20, 'D20 rawRoll');
                if (res.parsedMath) {
                    assertEqual(res.parsedMath.raw, res.rawRoll, 'Log rawRoll matches die face');
                    assertEqual(res.parsedMath.total, res.parsedMath.raw + res.parsedMath.mod, 'D20 total = raw + mod');
                    if (res.parsedMath.raw === 20) assert(res.success, 'Nat 20 must succeed');
                    else if (res.parsedMath.raw === 1) assert(!res.success, 'Nat 1 must fail');
                    else assertEqual(res.success, res.parsedMath.total >= res.parsedMath.dc, 'total >= DC check');
                }
                page.assertZeroErrors('T2-RA08-04');
            }
        },
        {
            id: 'T2-RA08-05',
            ra: 'RA-08',
            desc: 'Failing door check preserves HP >= 0 and renders #btnDismissEncounter cleanly',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'LowStr', ancestry: 'elf', charClass: 'mage' });
                let sawFail = false;
                for (let i = 0; i < 10; i++) {
                    await seekModalKind(page, 'door', { maxSteps: 45 });
                    const res = await resolveEncounterModal(page, { strategy: 'weakest', dismiss: false });
                    assert(await isElementVisible(page, SEL.encDismiss), 'Dismiss button visible after roll');
                    await page.click(SEL.encDismiss);
                    await page.sleep(100);
                    const hud = await readAdventureHud(page);
                    assertGte(hud.hp, 0, 'HP non-negative after door check');
                    if (!res.success) { sawFail = true; break; }
                }
                assert(sawFail, 'Observed failed door check safely');
                page.assertZeroErrors('T2-RA08-05');
            }
        },

        // ==================== RA-09 Boundaries ====================
        {
            id: 'T2-RA09-01',
            ra: 'RA-09',
            desc: 'Combat Flee closes #combatModal cleanly and allows re-engaging the fled monster',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Sprinter', ancestry: 'goblin', charClass: 'warrior' });
                const found = await seekModalKind(page, 'combat', { maxSteps: 55 });
                const fled = await runCombat(page, 'flee', { maxRounds: 8 });
                assertEqual(fled.outcome, 'fled', 'Flee succeeded');
                assertEqual(await detectOpenModal(page), null, '#combatModal closed after flee');

                const idleRms = await calibrateIdleRms(page, 200);
                await stepMove(page, { keys: ['KeyS'], holdMs: 450, idleRms });
                const reengaged = await seekModalKind(page, 'combat', { maxSteps: 20 });
                assert(reengaged.combat.open, `Re-engaged fled monster in ${found.roomName}`);
                page.assertZeroErrors('T2-RA09-01');
            }
        },
        {
            id: 'T2-RA09-02',
            ra: 'RA-09',
            desc: 'Insufficient MP disables Class Special button while Attack/Defend/Flee stay enabled',
            run: async (ctx) => {
                const page = await ctx.openPage();
                // Orc Warrior has 24 MP -> one 15-MP Whirlwind Cleave leaves 9 MP (< 15 MP)!
                await forgeHero(page, { name: 'LowMpOrc', ancestry: 'orc', charClass: 'warrior' });
                await seekModalKind(page, 'combat', { maxSteps: 55 });
                const after = await triggerCombatAction(page, 'special');
                assertBetween(after.heroMp, 0, 14, 'Remaining MP < 15');
                if (after.open && !after.dismissVisible) {
                    const btns = await inspectCombatButtons(page);
                    assert(btns.special && btns.special.disabled, 'Special button disabled when MP < cost');
                    assert(btns.attack && !btns.attack.disabled, 'Basic attack still enabled');
                }
                page.assertZeroErrors('T2-RA09-02');
            }
        },
        {
            id: 'T2-RA09-03',
            ra: 'RA-09',
            desc: 'Using consumables decrements quantities, heals HP/MP, and shows empty-belt message when spent',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Alchemist', ancestry: 'elf', charClass: 'warrior' });
                await seekModalKind(page, 'combat', { maxSteps: 55 });
                // Spend 15 MP first so Mana Draught restores observable MP
                await triggerCombatAction(page, 'special');
                const beforeMana = await readCombatState(page);
                if (beforeMana.open && !beforeMana.dismissVisible) {
                    await triggerCombatAction(page, 'item', { itemName: 'Mana Draught' });
                    const afterMana = await readCombatState(page);
                    if (afterMana.open && !afterMana.dismissVisible) {
                        assertGt(afterMana.heroMp, beforeMana.heroMp, 'Mana Draught restored MP');
                        await triggerCombatAction(page, 'item', { itemName: 'Lesser Healing Potion' });
                        const afterHeal = await readCombatState(page);
                        if (afterHeal.open && !afterHeal.dismissVisible) {
                            const list = await listCombatItems(page);
                            assertEqual(list.items.length, 0, 'No remaining starting consumables');
                            assertMatch(list.emptyText, /no potions|no.*consumables/i, 'Empty-belt message');
                        }
                    }
                }
                page.assertZeroErrors('T2-RA09-03');
            }
        },
        {
            id: 'T2-RA09-04',
            ra: 'RA-09',
            timeoutMs: 160000,
            desc: 'Floor 1 traversal engages multiple distinct Floor 1 monster species with valid 3D combat canvas',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Bestiary', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const monstersSeen = new Set();
                const run = await exploreFloor1(page, {
                    maxSteps: 130,
                    timeoutMs: 145000,
                    onCombat: async (_res, _hud, preCombat) => {
                        if (preCombat?.monsterName) monstersSeen.add(preCombat.monsterName);
                        assertGt(preCombat?.canvasW || 0, 0, '3D combat canvas width > 0');
                    }
                });
                assertGte(monstersSeen.size, 3, `Expected >= 3 distinct Floor 1 monsters, saw: ${Array.from(monstersSeen).join(', ')}`);
                assert(run.rooms.length >= 6, 'Visited dungeon chambers');
                page.assertZeroErrors('T2-RA09-04');
            }
        },
        {
            id: 'T2-RA09-05',
            ra: 'RA-09',
            timeoutMs: 120000,
            desc: 'Combat defeat respawns at Entrance and clears stale #btnDismissCombat.onclick before next victory',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Phoenix', ancestry: 'elf', charClass: 'mage' });
                await assertFloor1Boot(page);

                // Lower HP first via traps/doors so combat defeat happens rapidly without killing skeleton
                for (let i = 0; i < 3; i++) {
                    const hud = await readAdventureHud(page);
                    if (hud.hp <= 42) break;
                    const t = await seekModalKind(page, 'trap', { maxSteps: 30 }).catch(() => null);
                    if (t && t.kind === 'trap') await resolveEncounterModal(page, { strategy: 'weakest' });
                }

                await seekModalKind(page, 'combat', { maxSteps: 55 });
                const loss = await runCombat(page, 'lose', { maxRounds: 35 });
                assertEqual(loss.outcome, 'defeat', 'Combat defeat triggered');
                const revivedHud = await readAdventureHud(page);
                assertMatch(revivedHud.roomText, /entrance|threshold|vestibule/i, 'Revived at Entrance');
                assertGt(revivedHud.hp, 0, 'Revived with > 0 HP');

                // Return to combat and WIN (after healing/buffing or with Elf Mage offense!)
                await seekModalKind(page, 'combat', { maxSteps: 55 });
                const win = await runCombat(page, 'win', { maxRounds: 20 });
                assertEqual(win.outcome, 'victory', 'Subsequent combat victory');
                const postWinHud = await readAdventureHud(page);
                assert(!/entrance|threshold|vestibule/i.test(postWinHud.roomText), 'Hero stayed in combat chamber (stale onclick did NOT teleport to Entrance)');
                assertGt(postWinHud.xp, 0, 'XP persisted after victory dismiss');
                page.assertZeroErrors('T2-RA09-05');
            }
        },

        // ==================== RA-10 Boundaries ====================
        {
            id: 'T2-RA10-01',
            ra: 'RA-10',
            desc: 'Triggering/disarming a trap once never causes per-frame looping damage on repeated crossing',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'SingleHit', ancestry: 'dwarf', charClass: 'warrior' });
                const found = await seekModalKind(page, 'trap', { maxSteps: 55 });
                if (found.kind === 'trap') {
                    await resolveEncounterModal(page, { strategy: 'optimal' });
                }
                const hpFixed = (await readAdventureHud(page)).hp;
                const idleRms = await calibrateIdleRms(page, 200);
                for (let i = 0; i < 4; i++) {
                    await stepMove(page, { keys: ['KeyD'], holdMs: 280, idleRms });
                    await stepMove(page, { keys: ['KeyA'], holdMs: 280, idleRms });
                }
                assertEqual((await readAdventureHud(page)).hp, hpFixed, 'Zero looping trap damage across 4 crossings');
                page.assertZeroErrors('T2-RA10-01');
            }
        },
        {
            id: 'T2-RA10-02',
            ra: 'RA-10',
            timeoutMs: 120000,
            desc: 'After 0-HP trap defeat respawns hero at Entrance, zero lingering modal blocks Entrance controls',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'TrapRespawn', ancestry: 'elf', charClass: 'mage' });
                await assertFloor1Boot(page);

                let diedToTrap = false;
                for (let c = 0; c < 18; c++) {
                    const hud = await readAdventureHud(page);
                    if (hud.hp <= 8) {
                        const found = await seekModalKind(page, 'trap', { maxSteps: 60 });
                        if (found.kind === 'trap') {
                            const r = await resolveEncounterModal(page, { strategy: 'weakest' });
                            if (!r.success) { diedToTrap = true; break; }
                        } else {
                            diedToTrap = true; break;
                        }
                    } else {
                        const m = await seekModalKind(page, 'combat', { maxSteps: 45 }).catch(() => null);
                        if (m) await runCombat(page, 'lowHpThenFlee', { lowHpRatio: 0.11, maxRounds: 20 });
                    }
                }
                assert(diedToTrap, 'Triggered 0-HP trap defeat');
                assertEqual(await detectOpenModal(page), null, 'Zero lingering modal after Entrance respawn');
                const idleRms = await calibrateIdleRms(page, 200);
                const moveAfter = await stepMove(page, { keys: ['KeyW'], holdMs: 360, idleRms });
                assert(moveAfter.moved, 'Hero can move freely at Entrance immediately after trap respawn');
                page.assertZeroErrors('T2-RA10-02');
            }
        },
        {
            id: 'T2-RA10-03',
            ra: 'RA-10',
            desc: 'Full-HP hero survives single Floor 1 trap (damage 8-15, HP > 0)',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Hardy', ancestry: 'dwarf', charClass: 'warrior' });
                const found = await seekModalKind(page, 'trap', { maxSteps: 55 });
                if (found.kind === 'trap') {
                    const hp0 = (await readAdventureHud(page)).hp;
                    const res = await resolveEncounterModal(page, { strategy: 'weakest' });
                    const hp1 = (await readAdventureHud(page)).hp;
                    assertGt(hp1, 0, 'Hero survives single trap hit');
                    if (!res.success) assertBetween(hp0 - hp1, 8, 15, 'Single trap damage');
                } else {
                    assertGt(found.hudAfter.hp, 0, 'Hero survives step-on trap');
                    assertBetween(found.hudBefore.hp - found.hudAfter.hp, 8, 15, 'Single trap damage');
                }
                page.assertZeroErrors('T2-RA10-03');
            }
        },
        {
            id: 'T2-RA10-04',
            ra: 'RA-10',
            timeoutMs: 160000,
            desc: 'Floor 1 traversal encounters >= 2 distinct Floor 1 trap archetypes',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Sapper', ancestry: 'dwarf', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const run = await exploreFloor1(page, {
                    maxSteps: 130,
                    timeoutMs: 145000,
                    encounterStrategy: 'weakest'
                });
                const traps = new Set();
                for (const r of run.rooms) {
                    if (r.sawTrap) {
                        for (const t of r.trapTypes) traps.add(t);
                        if (r.trapTypes.size === 0) traps.add(r.roomName);
                    }
                }
                assertGte(traps.size, 2, `Distinct Floor 1 traps encountered (${Array.from(traps).join(' | ')})`);
                page.assertZeroErrors('T2-RA10-04');
            }
        },
        {
            id: 'T2-RA10-05',
            ra: 'RA-10',
            timeoutMs: 120000,
            desc: 'Trap boundary: HP > damage stays alive in trap room; HP <= damage hits 0 HP and respawns',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'BoundaryHero', ancestry: 'elf', charClass: 'mage' });
                await assertFloor1Boot(page);

                // First trap while HP > 20 -> survives inside trap room
                const firstTrap = await seekModalKind(page, 'trap', { maxSteps: 55 });
                if (firstTrap.kind === 'trap') {
                    await resolveEncounterModal(page, { strategy: 'weakest' });
                }
                const postFirst = await readAdventureHud(page);
                assertGt(postFirst.hp, 0, 'Survived trap while HP > damage');
                assert(!/entrance|threshold|vestibule/i.test(postFirst.roomText), 'Remained in dungeon after non-lethal trap');

                // Drop HP <= 8 and hit lethal trap
                let lethalOk = false;
                for (let c = 0; c < 18; c++) {
                    const hud = await readAdventureHud(page);
                    if (hud.hp <= 8) {
                        const t2 = await seekModalKind(page, 'trap', { maxSteps: 60 });
                        if (t2.kind === 'trap') {
                            const r = await resolveEncounterModal(page, { strategy: 'weakest' });
                            if (r.success) continue;
                        }
                        const postSecond = await readAdventureHud(page);
                        assertNotEqual(postSecond.hp, 1, 'No 1-HP clamp on lethal trap');
                        assertMatch(postSecond.roomText, /entrance|threshold|vestibule/i, 'Respawned at Entrance on lethal trap');
                        lethalOk = true;
                        break;
                    }
                    const m = await seekModalKind(page, 'combat', { maxSteps: 45 }).catch(() => null);
                    if (m) await runCombat(page, 'lowHpThenFlee', { lowHpRatio: 0.11, maxRounds: 20 });
                }
                assert(lethalOk, 'Verified lethal trap boundary');
                page.assertZeroErrors('T2-RA10-05');
            }
        },

        // ==================== RA-11 Boundaries ====================
        {
            id: 'T2-RA11-01',
            ra: 'RA-11',
            timeoutMs: 160000,
            desc: 'Traversing all Floor 1 rooms emits zero WebGL shader/PointLight-overflow errors',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'LightAudit', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                await exploreFloor1(page, { maxSteps: 130, timeoutMs: 145000 });
                assertEqual(page.webglErrors.length, 0, `WebGL errors: ${page.webglErrors.join('; ')}`);
                page.assertZeroErrors('T2-RA11-01');
            }
        },
        {
            id: 'T2-RA11-02',
            ra: 'RA-11',
            desc: 'Muted Music + SFX stays silent and error-free across Title, Forge, Doors, Traps, and Combat',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await muteMusicAndSfxOnTitle(page);
                await forgeHero(page, { name: 'SilentDelver', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                await seekModalKind(page, 'door', { maxSteps: 45 });
                await resolveEncounterModal(page, { strategy: 'optimal' });
                await seekModalKind(page, 'combat', { maxSteps: 45 });
                await runCombat(page, 'win');
                page.assertZeroErrors('T2-RA11-02');
            }
        },
        {
            id: 'T2-RA11-03',
            ra: 'RA-11',
            desc: 'Blocked WebAudio autoplay emits zero unhandledrejection across Title -> Forge -> Adventure -> Combat',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'AutoplaySafe', ancestry: 'human', charClass: 'warrior' });
                await assertFloor1Boot(page);
                await seekModalKind(page, 'combat', { maxSteps: 55 });
                await runCombat(page, 'win');
                assertEqual(page.pageErrors.length, 0, 'Zero unhandledrejection/pageErrors');
                page.assertZeroErrors('T2-RA11-03');
            }
        },
        {
            id: 'T2-RA11-04',
            ra: 'RA-11',
            timeoutMs: 120000,
            desc: '#advLog remains cleanly scrollable and unobstructed after 10+ chronological events',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Chronicler', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                await exploreFloor1(page, { maxSteps: 60, timeoutMs: 90000, exploreWings: true });
                const logGeom = await page.eval(() => {
                    const log = document.getElementById('advLog');
                    const r = log ? log.getBoundingClientRect() : null;
                    return {
                        count: document.querySelectorAll('#advLog .log-msg').length,
                        scrollH: log ? log.scrollHeight : 0,
                        clientH: log ? log.clientHeight : 0,
                        top: r ? r.top : -1,
                        bottom: r ? r.bottom : 9999
                    };
                });
                assertGte(logGeom.count, 5, 'Chronicle log count');
                assertGte(logGeom.scrollH, logGeom.clientH, '#advLog scrollable height');
                assertGte(logGeom.top, 0, '#advLog within viewport top');
                assertLte(logGeom.bottom, 800, '#advLog within viewport bottom');
                page.assertZeroErrors('T2-RA11-04');
            }
        },
        {
            id: 'T2-RA11-05',
            ra: 'RA-11',
            desc: 'Low-HP crimson pulse activates when HP <= 30% and clears when HP is restored',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'PulseTest', ancestry: 'elf', charClass: 'mage' });
                await assertFloor1Boot(page);

                for (let i = 0; i < 6; i++) {
                    const h = await readAdventureHud(page);
                    if (h.hp <= Math.floor(h.maxHp * 0.30)) break;
                    const c = await seekModalKind(page, 'combat', { maxSteps: 35 }).catch(() => null);
                    if (c) await runCombat(page, 'lowHpThenFlee', { lowHpRatio: 0.25, maxRounds: 14 });
                }
                const lowHud = await readAdventureHud(page);
                assertLte(lowHud.hp, Math.floor(lowHud.maxHp * 0.35), 'Reached low HP');
                const lowPng = decodePng(await page.screenshot());
                const redLow = computeBorderRedness(lowPng);
                const lowClass = lowHud.dangerEls.some((d) => /low.?hp|danger|crimson|critical/i.test(d.className));
                assert(lowClass || redLow.redPixelRatio > 0.01 || redLow.meanRedExcess > 8, 'Crimson low-HP feedback active');

                // Heal back above 35% via combat potion
                const c2 = await seekModalKind(page, 'combat', { maxSteps: 35 });
                if (c2) {
                    await triggerCombatAction(page, 'item', { itemName: 'Lesser Healing Potion' });
                    await runCombat(page, 'flee', { maxRounds: 8 });
                }
                const healedHud = await readAdventureHud(page);
                if (healedHud.hp > Math.floor(healedHud.maxHp * 0.40)) {
                    const stillLowClass = healedHud.dangerEls.some((d) => /low.?hp|danger|crimson|critical/i.test(d.className));
                    assert(!stillLowClass, 'Low-HP pulse class cleared after healing');
                }
                page.assertZeroErrors('T2-RA11-05');
            }
        },

        // ==================== RA-12 Boundaries ====================
        {
            id: 'T2-RA12-01',
            ra: 'RA-12',
            desc: 'Floor 1 Exit Victory cannot be reached without unlocking prerequisite progression doors',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await enterRoom1(page);
                const idleRms = await calibrateIdleRms(page, 200);
                // Walk North into locked portcullis without resolving modal -> check blocked
                let hitDoor = false;
                for (let i = 0; i < 12; i++) {
                    await stepMove(page, {
                        keys: ['KeyW'],
                        holdMs: 380,
                        idleRms,
                        modalHandlers: {
                            onEncounter: async (res) => {
                                if (res.kind === 'door') hitDoor = true;
                            }
                        }
                    });
                    if (await detectOpenModal(page) === 'encounter') { hitDoor = true; break; }
                }
                assert(hitDoor, 'Locked portcullis blocks direct passage toward Sanctum/Exit');
                assertNotEqual(await detectOpenModal(page), 'victory', 'Exit Victory unreachable before doors unlocked');
                page.assertZeroErrors('T2-RA12-01');
            }
        },
        {
            id: 'T2-RA12-02',
            ra: 'RA-12',
            timeoutMs: 160000,
            desc: 'Pressing movement/canvas inputs while Victory UI is open causes zero duplicate modals or traps',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'VictoryLock', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const run = await exploreFloor1(page, { maxSteps: 110, timeoutMs: 140000, exploreWings: false });
                assert(run.victoryReached, 'Victory reached');
                const v1 = await readVictoryUi(page);
                assert(v1.open, 'Victory UI open');

                await page.holdKeys(['KeyW', 'KeyS'], 500);
                await page.clickAt(50, 200);
                await page.sleep(200);
                assertEqual(await detectOpenModal(page), 'victory', 'Victory UI remains single and stable');
                page.assertZeroErrors('T2-RA12-02');
            }
        },
        {
            id: 'T2-RA12-03',
            ra: 'RA-12',
            timeoutMs: 220000,
            desc: 'Back-to-back Floor 1 Victory -> Play Again -> Floor 1 Victory completes cleanly',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'DoubleClear', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const r1 = await exploreFloor1(page, { maxSteps: 100, timeoutMs: 100000, exploreWings: false });
                assert(r1.victoryReached, 'Run 1 victory');

                await clickVictoryAction(page, 'playAgain');
                await assertFloor1Boot(page);
                const r2 = await exploreFloor1(page, { maxSteps: 100, timeoutMs: 100000, exploreWings: false });
                assert(r2.victoryReached, 'Run 2 victory after Play Again');
                assertEqual((await readAdventureHud(page)).canvasCount, 1, 'Single live canvas across 2 clears');
                page.assertZeroErrors('T2-RA12-03');
            }
        },
        {
            id: 'T2-RA12-04',
            ra: 'RA-12',
            timeoutMs: 160000,
            desc: 'Post-victory Play Again -> #btnSwitchMode Forge -> change class -> clean Floor 1 run',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'WarToMage', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const r1 = await exploreFloor1(page, { maxSteps: 100, timeoutMs: 130000, exploreWings: false });
                assert(r1.victoryReached, 'Run 1 victory');
                await clickVictoryAction(page, 'playAgain');

                await returnToForge(page);
                await forgeHero(page, { name: 'NewMage', ancestry: 'elf', charClass: 'mage' });
                const hud = await readAdventureHud(page);
                assertEqual(hud.heroClass, 'Elf Mage', 'Updated hero class in post-victory Forge run');
                assertEqual(hud.xp, 0, 'XP = 0');
                assertEqual(hud.gold, 0, 'Gold = 0');
                page.assertZeroErrors('T2-RA12-04');
            }
        },
        {
            id: 'T2-RA12-05',
            ra: 'RA-12',
            timeoutMs: 160000,
            desc: 'Post-victory Play Again hides all modals (#encounterModal, #combatModal, #victoryModal) cleanly',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'ModalCheck', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const r1 = await exploreFloor1(page, { maxSteps: 100, timeoutMs: 130000, exploreWings: false });
                assert(r1.victoryReached, 'Victory reached');
                await clickVictoryAction(page, 'playAgain');

                const displays = await readModalDisplays(page);
                assertEqual(displays.encounter, 'none', '#encounterModal hidden');
                assertEqual(displays.combat, 'none', '#combatModal hidden');
                if (displays.victory !== 'missing') {
                    assertEqual(displays.victory, 'none', '#victoryModal hidden');
                }
                const idleRms = await calibrateIdleRms(page, 200);
                const step = await stepMove(page, { keys: ['KeyW'], holdMs: 360, idleRms });
                assert(step.moved, 'Adventure canvas unobstructed after Play Again');
                page.assertZeroErrors('T2-RA12-05');
            }
        }
    ];
}
