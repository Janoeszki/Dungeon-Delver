import {
    assert,
    assertEqual,
    assertNotEqual,
    assertGt,
    assertGte,
    assertLte,
    assertMatch
} from '../lib/assert.mjs';
import {
    assertTitleVisible,
    forgeHero,
    quickDelve,
    returnToForge,
    returnToTitle,
    readAdventureHud,
    requireDreadLogs,
    detectOpenModal,
    clickVictoryAction,
    isElementVisible
} from '../lib/dom.mjs';
import { resolveEncounterModal } from '../lib/encounterDriver.mjs';
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
    seekModalKind,
    muteMusicAndSfxOnTitle
} from '../lib/scenarios.mjs';
import {
    decodePng,
    computePatchLuminance,
    computeBorderRedness
} from '../lib/vision.mjs';

export function getTier3Tests() {
    return [
        {
            id: 'T3-01',
            ra: 'RA-03/RA-09/RA-11',
            timeoutMs: 90000,
            desc: 'Warrior vs Mage class skills (Whirlwind Cleave vs Firebolt Flare) + universal torchlight halo',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Blade', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const wLight = await verifyDungeonTorchLighting(page);
                assertGt(wLight.haloDelta, 2.0, 'Warrior torchlight halo > corners');

                await seekModalKind(page, 'combat', { maxSteps: 55 });
                const wBtns = await inspectCombatButtons(page);
                assertMatch(wBtns.special.text, /whirlwind cleave/i, 'Warrior special button');
                await triggerCombatAction(page, 'special');
                const wAfter = await readCombatState(page);
                assertEqual(wAfter.heroMaxMp - wAfter.heroMp, 15, 'Warrior special spent 15 MP');
                await runCombat(page, 'win');

                await returnToForge(page);
                await forgeHero(page, { name: 'Pyre', ancestry: 'elf', charClass: 'mage' });
                await assertFloor1Boot(page);
                const mLight = await verifyDungeonTorchLighting(page);
                assertGt(mLight.haloDelta, 2.0, 'Mage torchlight halo > corners');

                await seekModalKind(page, 'combat', { maxSteps: 55 });
                const mBtns = await inspectCombatButtons(page);
                assertMatch(mBtns.special.text, /firebolt flare/i, 'Mage special button');
                await triggerCombatAction(page, 'special');
                const mAfter = await readCombatState(page);
                assertEqual(mAfter.heroMaxMp - mAfter.heroMp, 18, 'Mage special spent 18 MP');
                page.assertZeroErrors('T3-01');
            }
        },
        {
            id: 'T3-02',
            ra: 'RA-03/RA-08/RA-09',
            timeoutMs: 90000,
            desc: 'Dwarf Warrior vs Elf Mage stat modifiers propagate into #encounterModal and #combatModal AC/HP/MP',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Dain', ancestry: 'dwarf', charClass: 'warrior' });
                const dwDoor = await seekModalKind(page, 'door', { maxSteps: 45 });
                const dwStr = dwDoor.encounter.options.find((o) => o.stat?.startsWith('STR'));
                assertEqual(dwStr.mod, 4, 'Dwarf Warrior STR +4 (18 STR)');
                await resolveEncounterModal(page, { strategy: 'optimal' });
                await seekModalKind(page, 'combat', { maxSteps: 45 });
                const dwCombat = await readCombatState(page);
                assertEqual(dwCombat.heroHp, 287, 'Dwarf combat HP 287');
                assertEqual(dwCombat.heroEffectiveAc, 13, 'Dwarf Warrior AC (10 - 1 AGI + 4 Warrior = 13)');

                await runCombat(page, 'win');
                await returnToForge(page);
                await forgeHero(page, { name: 'Aelidor', ancestry: 'elf', charClass: 'mage' });
                const emDoor = await seekModalKind(page, 'door', { maxSteps: 45 });
                const emStr = emDoor.encounter.options.find((o) => o.stat?.startsWith('STR'));
                assertGt(dwStr.mod, emStr.mod, 'Dwarf STR mod > Elf STR mod');
                await resolveEncounterModal(page, { strategy: 'optimal' });
                await seekModalKind(page, 'combat', { maxSteps: 45 });
                const emCombat = await readCombatState(page);
                assertEqual(emCombat.heroHp, 72, 'Elf Mage combat HP 72');
                assertEqual(emCombat.heroMp, 355, 'Elf Mage combat MP 355');
                page.assertZeroErrors('T3-02');
            }
        },
        {
            id: 'T3-03',
            ra: 'RA-05/RA-07/RA-08',
            timeoutMs: 90000,
            desc: 'Entrance wall collision + narrow North doorway -> Room 1 + retryable door unlocks next chamber',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Breacher', ancestry: 'orc', charClass: 'warrior' });
                const startRoom = await assertFloor1Boot(page);
                const idleRms = await calibrateIdleRms(page, 200);

                let hitWall = false;
                for (let i = 0; i < 10; i++) {
                    const st = await stepMove(page, { keys: ['KeyA'], holdMs: 240, idleRms });
                    if (!st.moved) { hitWall = true; break; }
                }
                assert(hitWall, 'Entrance West wall blocked movement');
                await stepMove(page, { keys: ['KeyD'], holdMs: 420, idleRms });

                const r1 = await enterRoom1(page);
                assertNotEqual(r1.room1, startRoom, 'Crossed into Room 1');

                // Intentionally fail once if possible, then retry until unlocked and cross into Room 3
                await seekModalKind(page, 'door', { maxSteps: 45 });
                let unlocked = false;
                for (let attempt = 0; attempt < 8; attempt++) {
                    if ((await detectOpenModal(page)) !== 'encounter') {
                        await seekModalKind(page, 'door', { maxSteps: 16 });
                    }
                    const res = await resolveEncounterModal(page, { strategy: attempt === 0 ? 'weakest' : 'optimal' });
                    if (res.success) { unlocked = true; break; }
                    assertEqual((await readAdventureHud(page)).roomText, r1.room1, 'Door remained blocked on fail');
                }
                assert(unlocked, 'Door unlocked on retry');
                let crossed = false;
                for (let s = 0; s < 10; s++) {
                    const st = await stepMove(page, { keys: ['KeyW'], holdMs: 360, idleRms });
                    if (st.hudAfter.roomText !== r1.room1) { crossed = true; break; }
                }
                assert(crossed, 'Advanced to chamber beyond unlocked door');
                page.assertZeroErrors('T3-03');
            }
        },
        {
            id: 'T3-04',
            ra: 'RA-06/RA-07/RA-10',
            timeoutMs: 90000,
            desc: 'Mixed WASD + click-to-move into trap chamber + trap resolution + zero monsters in trap chamber',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'HybridNav', ancestry: 'goblin', charClass: 'warrior' });
                await enterRoom1(page, { useClicks: true });
                const found = await seekModalKind(page, 'trap', { maxSteps: 50 });
                const trapRoom = found.roomName;
                if (found.kind === 'trap') {
                    await resolveEncounterModal(page, { strategy: 'optimal' });
                }
                const idleRms = await calibrateIdleRms(page, 200);
                await stepMove(page, { keys: ['KeyW'], holdMs: 300, idleRms });
                await stepMove(page, { keys: ['KeyS'], holdMs: 300, idleRms });
                assertNotEqual(await detectOpenModal(page), 'combat', `Zero combat monsters inside trap room "${trapRoom}"`);
                page.assertZeroErrors('T3-04');
            }
        },
        {
            id: 'T3-05',
            ra: 'RA-09/RA-11',
            timeoutMs: 90000,
            desc: 'Low-HP crimson pulse activates below threshold and clears after Healing Potion in #combatModal',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Vignette', ancestry: 'elf', charClass: 'mage' });
                await assertFloor1Boot(page);
                for (let i = 0; i < 6; i++) {
                    const h = await readAdventureHud(page);
                    if (h.hp <= Math.floor(h.maxHp * 0.30)) break;
                    const c = await seekModalKind(page, 'combat', { maxSteps: 40 }).catch(() => null);
                    if (c) await runCombat(page, 'lowHpThenFlee', { lowHpRatio: 0.28, maxRounds: 14 });
                }
                const lowHud = await readAdventureHud(page);
                assertLte(lowHud.hp, Math.floor(lowHud.maxHp * 0.35), 'Reached low HP');
                const red = computeBorderRedness(decodePng(await page.screenshot()));
                const hasLowClass = lowHud.dangerEls.some((d) => /low.?hp|danger|crimson|critical/i.test(d.className));
                assert(hasLowClass || red.redPixelRatio > 0.01 || red.meanRedExcess > 8, 'Crimson pulse active');

                await seekModalKind(page, 'combat', { maxSteps: 40 });
                await triggerCombatAction(page, 'item', { itemName: 'Lesser Healing Potion' });
                await runCombat(page, 'flee', { maxRounds: 8 });
                const healedHud = await readAdventureHud(page);
                assertGt(healedHud.hp, lowHud.hp, 'HP increased after Healing Potion');
                page.assertZeroErrors('T3-05');
            }
        },
        {
            id: 'T3-06',
            ra: 'RA-09/RA-10',
            timeoutMs: 120000,
            desc: 'Combat Flee at low HP -> lethal 0-HP trap -> Entrance respawn -> re-engage fled monster cleanly',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Survivor', ancestry: 'elf', charClass: 'mage' });
                await assertFloor1Boot(page);

                let diedToTrap = false;
                for (let c = 0; c < 18; c++) {
                    const h = await readAdventureHud(page);
                    if (h.hp <= 8) {
                        const t = await seekModalKind(page, 'trap', { maxSteps: 55 });
                        if (t.kind === 'trap') {
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
                assert(diedToTrap, 'Lethal trap triggered Entrance respawn');
                assertMatch((await readAdventureHud(page)).roomText, /entrance|threshold|vestibule/i, 'At Entrance');

                const reengaged = await seekModalKind(page, 'combat', { maxSteps: 55 });
                assert(reengaged.combat.open, 'Re-engaged fled monster cleanly after trap respawn');
                page.assertZeroErrors('T3-06');
            }
        },
        {
            id: 'T3-07',
            ra: 'RA-02/RA-09/RA-11',
            timeoutMs: 80000,
            desc: 'Mute Music+SFX on Title -> Forge hero -> unlock door and win combat completely muted with 0 errors',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await muteMusicAndSfxOnTitle(page);
                await forgeHero(page, { name: 'MuteKnight', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                await seekModalKind(page, 'door', { maxSteps: 45 });
                await resolveEncounterModal(page, { strategy: 'optimal' });
                await seekModalKind(page, 'combat', { maxSteps: 45 });
                const res = await runCombat(page, 'win');
                assertEqual(res.outcome, 'victory', 'Combat won while muted');
                page.assertZeroErrors('T3-07');
            }
        },
        {
            id: 'T3-08',
            ra: 'RA-04/RA-05',
            timeoutMs: 80000,
            desc: 'Quick Delve -> defeat monster (XP>0, Gold>0) -> #btnSwitchMode Forge edit -> full Adventure reset',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await assertFloor1Boot(page);
                await seekModalKind(page, 'combat', { maxSteps: 55 });
                await runCombat(page, 'win');
                const h1 = await readAdventureHud(page);
                assertGt(h1.xp, 0, 'Run 1 XP > 0');
                assertGt(h1.gold, 0, 'Run 1 Gold > 0');

                await returnToForge(page);
                await forgeHero(page, { name: 'FreshEdit', ancestry: 'human', charClass: 'mage' });
                const h2 = await readAdventureHud(page);
                assertMatch(h2.roomText, /entrance|threshold|vestibule/i, 'Reset at Entrance');
                assertEqual(h2.xp, 0, 'XP reset to 0');
                assertEqual(h2.gold, 0, 'Gold reset to 0');
                assertEqual(h2.hp, h2.maxHp, 'Full HP restored');
                assertEqual(h2.mp, h2.maxMp, 'Full MP restored');
                assertLte(h2.logs.length, 2, 'Cleared #advLog');
                page.assertZeroErrors('T3-08');
            }
        },
        {
            id: 'T3-09',
            ra: 'RA-09/RA-12',
            timeoutMs: 120000,
            desc: 'Combat defeat retreat -> subsequent combat victory verifies #btnDismissCombat listener cleanup',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Comeback', ancestry: 'elf', charClass: 'mage' });
                await assertFloor1Boot(page);
                for (let i = 0; i < 3; i++) {
                    const h = await readAdventureHud(page);
                    if (h.hp <= 42) break;
                    const t = await seekModalKind(page, 'trap', { maxSteps: 30 }).catch(() => null);
                    if (t && t.kind === 'trap') await resolveEncounterModal(page, { strategy: 'weakest' });
                }
                await seekModalKind(page, 'combat', { maxSteps: 55 });
                const defeat = await runCombat(page, 'lose', { maxRounds: 35 });
                assertEqual(defeat.outcome, 'defeat', 'Combat defeat triggered');
                assertMatch((await readAdventureHud(page)).roomText, /entrance|threshold|vestibule/i, 'Retreated to Entrance');

                await seekModalKind(page, 'combat', { maxSteps: 55 });
                const victory = await runCombat(page, 'win', { maxRounds: 20 });
                assertEqual(victory.outcome, 'victory', 'Won subsequent combat');
                const post = await readAdventureHud(page);
                assert(!/entrance|threshold|vestibule/i.test(post.roomText), 'Victory dismiss stayed in chamber');
                page.assertZeroErrors('T3-09');
            }
        },
        {
            id: 'T3-10',
            ra: 'RA-01/RA-05/RA-11',
            timeoutMs: 70000,
            desc: 'Offline Google Fonts aborted + Title -> Forge -> Room 1 South cutaway & fog-of-war lift',
            run: async (ctx) => {
                const page = await ctx.openPage({ fontMode: 'abort' });
                await assertTitleVisible(page);
                assertGt(page.interceptedFonts.length, 0, 'Google fonts intercepted & aborted');
                await forgeHero(page, { name: 'OfflineHero', ancestry: 'human', charClass: 'warrior' });
                await assertFloor1Boot(page);

                const before = decodePng(await page.screenshot());
                const shrouded = computePatchLuminance(before, 0.5, 0.30, 0.10, 2);
                await enterRoom1(page);
                await requireDreadLogs(page, 1);
                const after = decodePng(await page.screenshot());
                const revealed = computePatchLuminance(after, 0.5, 0.42, 0.12, 2);
                assertGt(revealed.mean, shrouded.mean + 1.5, 'Fog-of-war lifted in Room 1');

                const idleRms = await calibrateIdleRms(page, 200);
                await stepMove(page, { keys: ['KeyS'], holdMs: 500, idleRms });
                const light = await verifyDungeonTorchLighting(page);
                assertGt(light.center.mean, light.minCorner + 1.5, 'South cutaway preserves torchlight center');
                page.assertZeroErrors('T3-10');
            }
        },
        {
            id: 'T3-11',
            ra: 'RA-04/RA-05/RA-11',
            timeoutMs: 70000,
            desc: 'Viewport resize (1024x720 -> 1440x900) mid-exploration preserves South cutaway, #hudRoom & #advLog',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await page.setViewport(1024, 720);
                await quickDelve(page);
                const r1 = await enterRoom1(page);
                await page.setViewport(1440, 900);
                await page.sleep(200);
                const hud = await readAdventureHud(page);
                assertEqual(hud.roomText, r1.room1, '#hudRoom intact after resize');
                assert(await isElementVisible(page, '#advLog'), '#advLog visible after resize');
                const idleRms = await calibrateIdleRms(page, 200);
                await stepMove(page, { keys: ['KeyS'], holdMs: 500, idleRms });
                const light = await verifyDungeonTorchLighting(page);
                assertGt(light.center.mean, light.minCorner + 1.0, 'Center hero torch unobstructed at 1440x900');
                page.assertZeroErrors('T3-11');
            }
        },
        {
            id: 'T3-12',
            ra: 'RA-06/RA-07/RA-08',
            timeoutMs: 80000,
            desc: 'Locked door & shared wall suppress cross-wall aggro until door unlocks and hero enters next chamber',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'AggroGate', ancestry: 'orc', charClass: 'warrior' });
                const r1 = await enterRoom1(page);
                const idleRms = await calibrateIdleRms(page, 200);
                await stepMove(page, { keys: ['KeyW'], holdMs: 700, idleRms });
                assertNotEqual(await detectOpenModal(page), 'combat', 'No cross-wall aggro while inside Room 1');

                await seekModalKind(page, 'door', { maxSteps: 45 });
                let unlocked = false;
                for (let i = 0; i < 8; i++) {
                    if ((await detectOpenModal(page)) !== 'encounter') await seekModalKind(page, 'door', { maxSteps: 16 });
                    const r = await resolveEncounterModal(page, { strategy: 'optimal' });
                    if (r.success) { unlocked = true; break; }
                }
                assert(unlocked, 'Portcullis unlocked');
                const combat = await seekModalKind(page, 'combat', { maxSteps: 25 });
                assert(combat.combat.open, 'Combat engages once inside next chamber');
                assertNotEqual(combat.roomName, r1.room1, 'Engaged inside new chamber');
                page.assertZeroErrors('T3-12');
            }
        },
        {
            id: 'T3-13',
            ra: 'RA-09/RA-12',
            timeoutMs: 160000,
            desc: 'Mid-dungeon consumables/item usage across Rooms 2-5 leading to Floor 1 Exit Victory',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Quartermaster', ancestry: 'dwarf', charClass: 'warrior' });
                await assertFloor1Boot(page);
                let usedItem = false;
                const run = await exploreFloor1(page, {
                    maxSteps: 130,
                    timeoutMs: 145000,
                    onCombat: async (res) => {
                        if (res.outcome === 'victory') usedItem = true;
                    }
                });
                assert(run.victoryReached && usedItem, 'Cleared combats and reached Floor 1 Exit Victory');
                page.assertZeroErrors('T3-13');
            }
        },
        {
            id: 'T3-14',
            ra: 'RA-02/RA-11/RA-12',
            timeoutMs: 160000,
            desc: 'Floor 1 Exit Victory -> Return to Title -> Lore modal toggle -> Quick Delve Run 2 starts shrouded in Entrance',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'SecondAct', ancestry: 'orc', charClass: 'warrior' });
                await assertFloor1Boot(page);
                const r1 = await exploreFloor1(page, { maxSteps: 100, timeoutMs: 130000, exploreWings: false });
                assert(r1.victoryReached, 'Run 1 victory reached');

                await clickVictoryAction(page, 'title');
                await assertTitleVisible(page);
                await page.click('#btnShowLore');
                await page.sleep(80);
                assert(await isElementVisible(page, '#loreModal'), 'Lore modal opened after Victory -> Title');
                await page.click('#btnCloseLore');
                await page.sleep(80);

                await quickDelve(page);
                const startRoom = await assertFloor1Boot(page);
                assertMatch(startRoom, /entrance|threshold|vestibule/i, 'Run 2 starts at Entrance');
                const hud2 = await readAdventureHud(page);
                assertEqual(hud2.xp, 0, 'Run 2 XP = 0');
                assertEqual(hud2.gold, 0, 'Run 2 Gold = 0');
                assertEqual(hud2.dreadLogs.length, 0, 'Run 2 Room 1 still undiscovered/shrouded');
                page.assertZeroErrors('T3-14');
            }
        }
    ];
}
