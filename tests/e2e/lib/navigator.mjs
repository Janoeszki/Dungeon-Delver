import {
    readAdventureHud,
    requireRoomBanner,
    detectOpenModal
} from './dom.mjs';
import { resolveEncounterModal } from './encounterDriver.mjs';
import { readCombatState, runCombat } from './combatDriver.mjs';
import { decodePng, computeRmsDelta, findWalkableBeacons } from './vision.mjs';

export const DEFAULT_MOVE_RMS_THRESHOLD = 7.2;

const DIR_KEYS = {
    N: ['KeyW'],
    E: ['KeyD'],
    W: ['KeyA'],
    S: ['KeyS']
};

const DIR_CLICK = {
    N: { x: 640, y: 235 },
    E: { x: 960, y: 400 },
    W: { x: 320, y: 400 },
    S: { x: 640, y: 560 }
};

const OPPOSITE_DIR = {
    N: 'S',
    S: 'N',
    E: 'W',
    W: 'E'
};

export async function calibrateIdleRms(page, waitMs = 350) {
    const a = decodePng(await page.screenshot());
    await page.sleep(waitMs);
    const b = decodePng(await page.screenshot());
    return computeRmsDelta(a, b);
}

export async function handleActiveModal(page, {
    encounterStrategy = 'optimal',
    combatTactic = 'win',
    stopOnVictory = true,
    doorFailFirst = false,
    onEncounter = null,
    onCombat = null,
    onVictory = null,
    roomTracker = null,
    stateFlags = null
} = {}) {
    const modal = await detectOpenModal(page);
    if (!modal) return null;

    if (modal === 'victory') {
        if (onVictory) await onVictory();
        return { type: 'victory', stop: stopOnVictory };
    }

    const hudBefore = await readAdventureHud(page);
    const roomKey = hudBefore.roomText || 'unknown';
    const rec = roomTracker ? roomTracker.ensure(roomKey) : null;

    if (modal === 'combat') {
        if (rec) rec.sawCombat = true;
        const preCombat = await readCombatState(page);
        if (rec && preCombat.monsterName) rec.monsterNames.add(preCombat.monsterName);
        const result = await runCombat(page, combatTactic);
        if (onCombat) await onCombat(result, hudBefore, preCombat);
        return { type: 'combat', result, monsterName: preCombat.monsterName || '' };
    }

    if (modal === 'encounter') {
        let chosenStrategy = encounterStrategy;
        if (doorFailFirst && stateFlags && !stateFlags.triedWeakDoor) {
            const peek = await (await import('./encounterDriver.mjs')).readEncounterModal(page);
            if (peek.kind === 'door') {
                chosenStrategy = 'weakest';
                stateFlags.triedWeakDoor = true;
            }
        }
        const result = await resolveEncounterModal(page, { strategy: chosenStrategy });
        if (rec) {
            if (result.kind === 'door') rec.doorsEncountered.push(result);
            if (result.kind === 'trap') {
                rec.sawTrap = true;
                if (result.title) rec.trapTypes.add(result.title);
            }
            if (result.kind === 'exit') rec.sawExit = true;
        }
        if (onEncounter) await onEncounter(result, hudBefore);

        const postModal = await detectOpenModal(page);
        if (postModal === 'victory') {
            if (onVictory) await onVictory();
            return { type: 'victory', encounter: result, stop: stopOnVictory };
        }
        return { type: 'encounter', result };
    }

    return null;
}

export class RoomTracker {
    constructor() {
        this.rooms = new Map();
        this.order = [];
        this.transitions = [];
    }

    ensure(roomName) {
        const key = roomName || 'Unknown';
        if (!this.rooms.has(key)) {
            const rec = {
                roomName: key,
                dreadLogged: false,
                sawCombat: false,
                sawTrap: false,
                sawExit: false,
                monsterNames: new Set(),
                trapTypes: new Set(),
                doorsEncountered: [],
                visitCount: 0
            };
            this.rooms.set(key, rec);
            this.order.push(key);
        }
        return this.rooms.get(key);
    }

    recordState(hud, prevHud = null) {
        if (!hud.roomText) return;
        const rec = this.ensure(hud.roomText);
        if (!prevHud || prevHud.roomText !== hud.roomText) {
            rec.visitCount += 1;
            if (prevHud && prevHud.roomText) {
                this.transitions.push({ from: prevHud.roomText, to: hud.roomText });
            }
        }
        if (prevHud && hud.dreadLogs.length > prevHud.dreadLogs.length) {
            rec.dreadLogged = true;
        } else if (hud.dreadLogs.some((txt) => {
            const core = hud.roomText.replace(/^floor\s*\d+\s*[-—:]\s*/i, '').trim();
            return core && txt.toLowerCase().includes(core.toLowerCase().split(/[\s:]+/)[0]);
        })) {
            rec.dreadLogged = true;
        }

        // Detect step-on trap damage or log text (ignoring .dread room discovery whispers)
        if (prevHud) {
            const newest = hud.logs.slice(0, Math.max(0, hud.logs.length - prevHud.logs.length));
            const trapLog = newest.find(
                (l) => !l.isDread && /trap|spike|scythe|pendulum|dart|blood\s*rune|snare/i.test(l.text)
            );
            if (trapLog || (hud.hp < prevHud.hp && newest.some((l) => !l.isDread && /damage/i.test(l.text)))) {
                rec.sawTrap = true;
                if (trapLog) rec.trapTypes.add(trapLog.text);
            }
        }
    }

    list() {
        return this.order.map((k) => this.rooms.get(k));
    }
}

export async function stepMove(page, {
    keys = ['KeyW'],
    clickPos = null,
    holdMs = 360,
    idleRms = 4.9,
    tracker = null,
    modalHandlers = {}
} = {}) {
    const handledBefore = await handleActiveModal(page, { ...modalHandlers, roomTracker: tracker });
    if (handledBefore && handledBefore.stop) {
        return { moved: false, delta: 0, modal: handledBefore, stopped: true };
    }

    const hudBefore = await readAdventureHud(page);
    if (tracker) tracker.recordState(hudBefore, null);

    const shotBefore = decodePng(await page.screenshot());
    if (clickPos) {
        await page.clickAt(clickPos.x, clickPos.y);
        await page.sleep(holdMs);
    } else {
        await page.holdKeys(keys, holdMs);
    }

    const modalCheck = await handleActiveModal(page, { ...modalHandlers, roomTracker: tracker });
    const shotAfter = decodePng(await page.screenshot());
    const hudAfter = await readAdventureHud(page);
    if (tracker) tracker.recordState(hudAfter, hudBefore);

    const delta = computeRmsDelta(shotBefore, shotAfter);
    const threshold = Math.max(DEFAULT_MOVE_RMS_THRESHOLD, idleRms * 1.42);
    const roomChanged = Boolean(hudBefore.roomText && hudAfter.roomText && hudBefore.roomText !== hudAfter.roomText);

    return {
        moved: roomChanged || delta >= threshold,
        delta,
        threshold,
        roomChanged,
        hudBefore,
        hudAfter,
        modal: modalCheck,
        stopped: Boolean(modalCheck && modalCheck.stop)
    };
}

export async function enterRoom1(page, {
    useArrows = false,
    useClicks = false,
    maxAttempts = 18
} = {}) {
    const startRoom = await requireRoomBanner(page, 1500);
    if (!/entrance|threshold|vestibule/i.test(startRoom)) {
        throw new Error(`Expected initial #hudRoom to indicate Floor 1 Entrance, got "${startRoom}"`);
    }

    const idleRms = await calibrateIdleRms(page, 250);
    const tracker = new RoomTracker();
    const northKey = useArrows ? 'ArrowUp' : 'KeyW';
    const leftKey = useArrows ? 'ArrowLeft' : 'KeyA';
    const rightKey = useArrows ? 'ArrowRight' : 'KeyD';

    let lateralOffset = 0;
    let stuckCount = 0;
    for (let i = 0; i < maxAttempts; i++) {
        let step;
        if (useClicks) {
            step = await stepMove(page, { clickPos: { x: 640, y: 265 }, holdMs: 550, idleRms, tracker });
        } else {
            step = await stepMove(page, { keys: [northKey], holdMs: 420, idleRms, tracker });
        }

        if (step.hudAfter.roomText && step.hudAfter.roomText !== startRoom) {
            return {
                startRoom,
                room1: step.hudAfter.roomText,
                hud: step.hudAfter,
                stepsUsed: i + 1
            };
        }

        if (!step.moved) {
            stuckCount++;
            const sweepKey = (lateralOffset % 2 === 0) ? leftKey : rightKey;
            await stepMove(page, { keys: [sweepKey], holdMs: 220, idleRms, tracker });
            lateralOffset++;
            if (stuckCount >= 8) break;
        } else {
            stuckCount = 0;
        }
    }

    const finalHud = await readAdventureHud(page);
    throw new Error(
        `Failed to cross from Entrance ("${startRoom}") into Room 1 after ${maxAttempts} attempts (still in "${finalHud.roomText}")`
    );
}

async function moveDir(page, dir, { primarilyClicks, holdMs = 420, idleRms, tracker, modalHandlers }) {
    let clickPos = null;
    if (primarilyClicks) {
        clickPos = DIR_CLICK[dir];
    }
    return stepMove(page, {
        keys: DIR_KEYS[dir],
        clickPos,
        holdMs: clickPos ? Math.max(holdMs, 520) : holdMs,
        idleRms,
        tracker,
        modalHandlers
    });
}

export async function exploreFloor1(page, {
    maxSteps = 130,
    timeoutMs = 150000,
    primarilyClicks = false,
    exploreWings = true,
    doorFailFirst = false,
    encounterStrategy = 'optimal',
    combatTactic = 'win',
    onStep = null,
    onEncounter = null,
    onCombat = null
} = {}) {
    await requireRoomBanner(page, 1500);
    const tracker = new RoomTracker();
    const idleRms = await calibrateIdleRms(page, 220);
    const deadline = Date.now() + timeoutMs;

    let victoryReached = false;
    const modalEvents = [];
    const stateFlags = { triedWeakDoor: false };

    const handlers = {
        encounterStrategy,
        combatTactic,
        stopOnVictory: true,
        doorFailFirst,
        stateFlags,
        onEncounter: async (res, hud) => {
            modalEvents.push({ type: 'encounter', room: hud.roomText, res });
            if (onEncounter) await onEncounter(res, hud);
        },
        onCombat: async (res, hud, preCombat) => {
            modalEvents.push({ type: 'combat', room: hud.roomText, res, monsterName: preCombat?.monsterName || '' });
            if (onCombat) await onCombat(res, hud, preCombat);
        },
        onVictory: async () => {
            victoryReached = true;
        }
    };

    const roomState = new Map();
    const initHud = await readAdventureHud(page);
    tracker.recordState(initHud, null);
    roomState.set(initHud.roomText, {
        entryDir: 'N',
        parentRoom: null,
        returnDir: null,
        centerSwept: true,
        dirsToTry: ['N'],
        nextIdx: 0
    });

    let steps = 0;
    let consecutiveNoMove = 0;
    let lastRoom = initHud.roomText;

    const ensureDfsState = (roomName, entryDir, parentRoom) => {
        if (!roomState.has(roomName)) {
            const isEntrance = /entrance|threshold|vestibule/i.test(roomName);
            const isWing = entryDir === 'W' || entryDir === 'E';
            const dirsToTry = isEntrance
                ? ['N']
                : (isWing ? [] : (exploreWings ? ['W', 'E', 'N'] : ['N']));
            roomState.set(roomName, {
                entryDir,
                parentRoom,
                returnDir: parentRoom ? OPPOSITE_DIR[entryDir] : null,
                centerSwept: isEntrance,
                dirsToTry,
                nextIdx: 0
            });
        }
        return roomState.get(roomName);
    };

    while (steps < maxSteps && Date.now() < deadline && !victoryReached) {
        const open = await detectOpenModal(page);
        if (open === 'victory') {
            victoryReached = true;
            break;
        }

        const curHud = await readAdventureHud(page);
        const curRoom = curHud.roomText || lastRoom;
        const st = roomState.get(curRoom) || ensureDfsState(curRoom, 'N', null);

        // 1. On newly entered room, step inward toward center to engage room monster/trap & reach wing axis
        if (!st.centerSwept) {
            st.centerSwept = true;
            const inwardDir = st.entryDir || 'N';
            for (let k = 0; k < 2 && steps < maxSteps && !victoryReached; k++) {
                steps++;
                const r = await moveDir(page, inwardDir, { primarilyClicks, holdMs: 420, idleRms, tracker, modalHandlers: handlers });
                if (onStep) await onStep(steps, r, tracker);
                if (r.stopped || victoryReached) { victoryReached = true; break; }
                if (r.hudAfter.roomText && r.hudAfter.roomText !== curRoom) {
                    ensureDfsState(r.hudAfter.roomText, inwardDir, curRoom);
                    break;
                }
            }
            if (victoryReached) break;
            const afterSweepHud = await readAdventureHud(page);
            if (afterSweepHud.roomText !== curRoom) continue;

            // If wing room and no encounter triggered yet, check beacon or brief N/S probe
            const rec = tracker.ensure(curRoom);
            if ((inwardDir === 'W' || inwardDir === 'E') && !rec.sawCombat && !rec.sawTrap) {
                const shot = decodePng(await page.screenshot());
                const beacons = findWalkableBeacons(shot);
                if (beacons.length > 0) {
                    steps++;
                    const rb = await stepMove(page, { clickPos: beacons[0], holdMs: 550, idleRms, tracker, modalHandlers: handlers });
                    if (rb.stopped || victoryReached) { victoryReached = true; break; }
                } else {
                    for (const extraDir of [inwardDir, 'N', 'S']) {
                        if (rec.sawCombat || rec.sawTrap) break;
                        steps++;
                        const re = await moveDir(page, extraDir, { primarilyClicks, holdMs: 320, idleRms, tracker, modalHandlers: handlers });
                        if (re.stopped || victoryReached) { victoryReached = true; break; }
                    }
                }
            }
            continue;
        }

        // 2. Probe next unexplored exit direction in current room
        if (st.nextIdx < st.dirsToTry.length) {
            const dir = st.dirsToTry[st.nextIdx];
            const perpDirs = (dir === 'W' || dir === 'E') ? ['S', 'N', 'S', 'S', 'N', 'N'] : ['A', 'D', 'A', 'A', 'D', 'D'];
            let perpIdx = 0;
            let transitioned = false;
            let blockedCount = 0;

            for (let attempt = 0; attempt < 9 && steps < maxSteps && !victoryReached; attempt++) {
                steps++;
                let clickOverride = null;
                if (primarilyClicks && attempt % 3 === 2) {
                    const shot = decodePng(await page.screenshot());
                    const beacons = findWalkableBeacons(shot);
                    if (beacons.length > 0) clickOverride = beacons[0];
                }
                const r = clickOverride
                    ? await stepMove(page, { clickPos: clickOverride, holdMs: 520, idleRms, tracker, modalHandlers: handlers })
                    : await moveDir(page, dir, { primarilyClicks, holdMs: 420, idleRms, tracker, modalHandlers: handlers });

                if (onStep) await onStep(steps, r, tracker);
                if (r.stopped || victoryReached) { victoryReached = true; break; }

                const nextRoom = r.hudAfter.roomText;
                if (nextRoom && nextRoom !== curRoom) {
                    consecutiveNoMove = 0;
                    // Transitioned to another room
                    if (!roomState.has(nextRoom)) {
                        ensureDfsState(nextRoom, dir, curRoom);
                        st.nextIdx++;
                        transitioned = true;
                        break;
                    } else {
                        // Already explored this room (e.g. accidental backtrack), step back once
                        steps++;
                        await moveDir(page, OPPOSITE_DIR[dir], { primarilyClicks, holdMs: 420, idleRms, tracker, modalHandlers: handlers });
                        st.nextIdx++;
                        transitioned = true;
                        break;
                    }
                }

                // Failed door check: retry same direction!
                if (r.modal && r.modal.type === 'encounter' && r.modal.result.kind === 'door' && !r.modal.result.success) {
                    blockedCount = 0;
                    consecutiveNoMove = 0;
                    continue;
                }

                if (!r.moved && !r.modal) {
                    blockedCount++;
                    consecutiveNoMove++;
                    if (consecutiveNoMove >= 12) {
                        throw new Error(`Navigator stalled in "${curRoom}" across ${consecutiveNoMove} steps without movement or modal`);
                    }
                    // Sweep perpendicular along wall to align with narrow 2-unit corridor mouth
                    if (perpIdx < perpDirs.length) {
                        const nud = perpDirs[perpIdx++];
                        const nudgeDir = nud === 'A' ? 'W' : (nud === 'D' ? 'E' : nud);
                        steps++;
                        await moveDir(page, nudgeDir, { primarilyClicks, holdMs: 220, idleRms, tracker, modalHandlers: handlers });
                    } else if (blockedCount >= 4) {
                        // No passage in this direction
                        break;
                    }
                } else {
                    blockedCount = 0;
                    consecutiveNoMove = 0;
                }
            }

            if (!transitioned && !victoryReached) {
                st.nextIdx++;
            }
            continue;
        }

        // 3. All directions probed in current room -> backtrack to parentRoom OR sweep current room for exit
        if (st.parentRoom && st.returnDir) {
            const backDir = st.returnDir;
            const perpDirs = (backDir === 'W' || backDir === 'E') ? ['S', 'N', 'S', 'S', 'N', 'N'] : ['W', 'E', 'W', 'W', 'E', 'E'];
            let perpIdx = 0;
            let returned = false;

            for (let attempt = 0; attempt < 9 && steps < maxSteps && !victoryReached; attempt++) {
                steps++;
                const r = await moveDir(page, backDir, { primarilyClicks, holdMs: 420, idleRms, tracker, modalHandlers: handlers });
                if (onStep) await onStep(steps, r, tracker);
                if (r.stopped || victoryReached) { victoryReached = true; break; }
                if (r.hudAfter.roomText && r.hudAfter.roomText !== curRoom) {
                    returned = true;
                    // Step slightly inward into parent room to re-center before probing next dir
                    steps++;
                    await moveDir(page, backDir, { primarilyClicks, holdMs: 560, idleRms, tracker, modalHandlers: handlers });
                    break;
                }
                if (!r.moved && perpIdx < perpDirs.length) {
                    steps++;
                    await moveDir(page, perpDirs[perpIdx++], { primarilyClicks, holdMs: 220, idleRms, tracker, modalHandlers: handlers });
                }
            }
            if (!returned) {
                // Force clear parentRoom to prevent infinite backtrack retry
                st.parentRoom = null;
            }
            continue;
        }

        // 4. Final room (e.g., Sanctum) — push North / click beacons to hit Exit Seal
        const shot = decodePng(await page.screenshot());
        const beacons = findWalkableBeacons(shot);
        steps++;
        const fin = beacons.length > 0
            ? await stepMove(page, { clickPos: beacons[0], holdMs: 550, idleRms, tracker, modalHandlers: handlers })
            : await moveDir(page, 'N', { primarilyClicks, holdMs: 420, idleRms, tracker, modalHandlers: handlers });
        if (fin.stopped || victoryReached) {
            victoryReached = true;
            break;
        }
        if (!fin.moved && !fin.modal) {
            consecutiveNoMove++;
            if (consecutiveNoMove >= 10) break;
        } else {
            consecutiveNoMove = 0;
        }
    }

    const victoryUi = await readVictoryUiSafe(page);
    return {
        victoryReached: victoryReached || victoryUi.open,
        rooms: tracker.list(),
        transitions: tracker.transitions,
        modalEvents,
        finalHud: await readAdventureHud(page)
    };
}

async function readVictoryUiSafe(page) {
    const modal = await detectOpenModal(page);
    return { open: modal === 'victory' };
}
