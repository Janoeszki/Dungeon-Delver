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
    readAdventureHud,
    requireDreadLogs,
    readVictoryUi,
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
    exploreFloor1
} from '../lib/navigator.mjs';
import {
    assertFloor1Boot,
    verifyDungeonTorchLighting,
    seekModalKind,
    muteMusicAndSfxOnTitle
} from '../lib/scenarios.mjs';
import {
    decodePng,
    computePatchLuminance
} from '../lib/vision.mjs';

export function getTier4Tests() {
    return [
        {
            id: 'T4-01',
            ra: 'FULL-RUN',
            timeoutMs: 180000,
            desc: 'Classic Warrior Full Campaign & Replay: Dwarf Warrior Forge -> Rooms 1-6 -> Exit Victory -> Play Again',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, {
                    name: 'Bromdur',
                    ancestry: 'dwarf',
                    charClass: 'warrior',
                    showHelm: false,
                    armorColor: '#8b0000'
                });
                const startRoom = await assertFloor1Boot(page);
                assertMatch(startRoom, /entrance|threshold|vestibule/i, 'Entrance spawn');

                const beforeR1 = decodePng(await page.screenshot());
                const shrouded = computePatchLuminance(beforeR1, 0.5, 0.30, 0.10, 2);
                const r1 = await enterRoom1(page);
                assertNotEqual(r1.room1, startRoom, 'Entered Room 1 via narrow North doorway');
                await requireDreadLogs(page, 1);
                const revealed = computePatchLuminance(decodePng(await page.screenshot()), 0.5, 0.42, 0.12, 2);
                assertGt(revealed.mean, shrouded.mean + 1.5, 'Room 1 fog-of-war revealed');

                const run = await exploreFloor1(page, { maxSteps: 135, timeoutMs: 155000, exploreWings: true });
                assert(run.victoryReached, 'Reached Floor 1 Exit Victory');
                const chambers = run.rooms.filter((r) => !/entrance|threshold|vestibule|hall of fallen|room\s*1\b|foyer/i.test(r.roomName));
                assertGte(chambers.length, 5, 'Visited >= 5 post-Room-1 chambers');
                for (const c of chambers) {
                    assert(c.sawCombat !== c.sawTrap, `Chamber "${c.roomName}" strictly monster XOR trap`);
                }

                const vui = await readVictoryUi(page);
                assert(vui.open, 'Exit Victory UI displayed');
                const hudEnd = await readAdventureHud(page);
                assertGt(hudEnd.xp, 0, 'Campaign XP > 0');
                assertGt(hudEnd.gold, 0, 'Campaign Gold > 0');

                await clickVictoryAction(page, 'playAgain');
                const hudReplay = await readAdventureHud(page);
                assertMatch(hudReplay.roomText, /entrance|threshold|vestibule/i, 'Replay reset to Entrance');
                assertEqual(hudReplay.xp, 0, 'Replay XP reset');
                assertEqual(hudReplay.gold, 0, 'Replay Gold reset');
                assertEqual(hudReplay.hp, hudReplay.maxHp, 'Replay HP restored');
                assertLte(hudReplay.logs.length, 2, 'Replay #advLog cleared');
                page.assertZeroErrors('T4-01');
            }
        },
        {
            id: 'T4-02',
            ra: 'FULL-RUN',
            timeoutMs: 180000,
            desc: 'Quick Delve Random Hero -> Lore -> Full Clear -> Return to Title with Adventure Canvas Disposed',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await assertTitleVisible(page);
                await page.click('#titleLogoStage');
                await page.sleep(100);
                await page.click('#btnShowLore');
                await page.sleep(80);
                assert(await isElementVisible(page, '#loreModal'), 'Lore opened');
                await page.click('#btnCloseLore');
                await page.sleep(80);

                await quickDelve(page);
                await assertFloor1Boot(page);
                const run = await exploreFloor1(page, { maxSteps: 120, timeoutMs: 150000, exploreWings: true });
                assert(run.victoryReached, 'Quick Delve cleared Floor 1');

                await clickVictoryAction(page, 'title');
                await assertTitleVisible(page);
                const advCanvas = await page.eval(() => document.querySelectorAll('#viewportAdventure canvas').length);
                assertEqual(advCanvas, 0, '#viewportAdventure disposed cleanly on Title return');
                page.assertZeroErrors('T4-02');
            }
        },
        {
            id: 'T4-03',
            ra: 'FULL-RUN',
            timeoutMs: 180000,
            desc: 'Arcane Elf Mage Torchlight & MP Tactics Delve -> Full Clear -> Exit Victory',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Elarion', ancestry: 'elf', charClass: 'mage' });
                await assertFloor1Boot(page);
                const mLight = await verifyDungeonTorchLighting(page);
                assertGt(mLight.haloDelta, 2.0, 'Elf Mage universal torchlight halo');

                await enterRoom1(page);
                await seekModalKind(page, 'combat', { maxSteps: 50 });
                const btns = await inspectCombatButtons(page);
                assertMatch(btns.attack.text, /arcane bolt/i, 'Mage Arcane Bolt basic attack');
                await triggerCombatAction(page, 'special');
                const afterSpec = await readCombatState(page);
                assertEqual(afterSpec.heroMaxMp - afterSpec.heroMp, 18, 'Firebolt Flare spent 18 MP');
                if (afterSpec.open && !afterSpec.dismissVisible) {
                    await triggerCombatAction(page, 'defend');
                    const afterDef = await readCombatState(page);
                    if (afterDef.open && !afterDef.dismissVisible) {
                        await triggerCombatAction(page, 'item', { itemName: 'Mana Draught' });
                    }
                    await runCombat(page, 'win');
                }

                const run = await exploreFloor1(page, { maxSteps: 120, timeoutMs: 140000, exploreWings: true });
                assert(run.victoryReached, 'Elf Mage cleared Floor 1 to Exit Victory');
                page.assertZeroErrors('T4-03');
            }
        },
        {
            id: 'T4-04',
            ra: 'FULL-RUN',
            timeoutMs: 180000,
            desc: 'Resilient Delver: Combat Flee + 0-HP Trap Lethality -> Entrance Respawn -> Re-engage -> Exit Victory',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await forgeHero(page, { name: 'Lazarus', ancestry: 'elf', charClass: 'mage' });
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
                assert(diedToTrap, 'Experienced 0-HP trap lethality and Entrance respawn');
                assertMatch((await readAdventureHud(page)).roomText, /entrance|threshold|vestibule/i, 'Respawned at Entrance');

                // Recover/continue and clear Floor 1 to Exit Victory
                const run = await exploreFloor1(page, { maxSteps: 125, timeoutMs: 140000, exploreWings: false });
                assert(run.victoryReached, 'Recovered from trap death and cleared Floor 1 Exit Victory');
                page.assertZeroErrors('T4-04');
            }
        },
        {
            id: 'T4-05',
            ra: 'FULL-RUN',
            timeoutMs: 180000,
            desc: 'Click-to-Move A* Navigation & Door Retry Campaign -> Full Floor 1 Exit Victory',
            run: async (ctx) => {
                const page = await ctx.openPage();
                await quickDelve(page);
                await assertFloor1Boot(page);
                const run = await exploreFloor1(page, {
                    maxSteps: 135,
                    timeoutMs: 155000,
                    primarilyClicks: true,
                    exploreWings: true,
                    doorFailFirst: true
                });
                assert(run.victoryReached, 'Click-to-move A* navigation reached Exit Victory');
                await requireDreadLogs(page, 4);
                page.assertZeroErrors('T4-05');
            }
        },
        {
            id: 'T4-06',
            ra: 'FULL-RUN',
            timeoutMs: 180000,
            desc: 'Silent Night: Offline Fonts Aborted + Muted Audio + Mid-Run Forge Reset -> Orc Warrior Full Clear',
            run: async (ctx) => {
                const page = await ctx.openPage({ fontMode: 'abort' });
                await muteMusicAndSfxOnTitle(page);
                await quickDelve(page);
                await enterRoom1(page);

                await returnToForge(page);
                await forgeHero(page, { name: 'Kragh', ancestry: 'orc', charClass: 'warrior' });
                const hReset = await readAdventureHud(page);
                assertMatch(hReset.roomText, /entrance|threshold|vestibule/i, 'Reset at Entrance after Forge switch');
                assertEqual(hReset.xp, 0, 'XP reset');
                assertEqual(hReset.gold, 0, 'Gold reset');
                assertEqual(hReset.dreadLogs.length, 0, 'Room 1 dread whisper cleared on reset');

                const run = await exploreFloor1(page, { maxSteps: 125, timeoutMs: 145000, exploreWings: true });
                assert(run.victoryReached, 'Completed Floor 1 Exit Victory silently offline');
                assertGt(page.interceptedFonts.length, 0, 'Google Fonts aborted offline');
                page.assertZeroErrors('T4-06');
            }
        }
    ];
}
