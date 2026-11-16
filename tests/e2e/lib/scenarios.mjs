import {
    readAdventureHud,
    requireRoomBanner,
    detectOpenModal
} from './dom.mjs';
import { readEncounterModal, resolveEncounterModal } from './encounterDriver.mjs';
import { readCombatState, runCombat } from './combatDriver.mjs';
import {
    calibrateIdleRms,
    enterRoom1,
    stepMove,
    RoomTracker
} from './navigator.mjs';
import {
    decodePng,
    computeMeanLuminance,
    computePatchLuminance,
    computeRmsDelta,
    findWalkableBeacons
} from './vision.mjs';

export async function assertFloor1Boot(page) {
    return requireRoomBanner(page, 1500);
}

export async function verifyDungeonTorchLighting(page) {
    const png = decodePng(await page.screenshot());
    const playBand = {
        x: Math.floor(png.width * 0.05),
        y: Math.floor(png.height * 0.28),
        width: Math.floor(png.width * 0.90),
        height: Math.floor(png.height * 0.44)
    };
    const bandLum = computeMeanLuminance(png, playBand, 2);
    const center = computePatchLuminance(png, 0.50, 0.52, 0.08, 1);
    const corners = [
        computePatchLuminance(png, 0.12, 0.34, 0.07, 2),
        computePatchLuminance(png, 0.88, 0.34, 0.07, 2),
        computePatchLuminance(png, 0.12, 0.68, 0.07, 2),
        computePatchLuminance(png, 0.88, 0.68, 0.07, 2)
    ];
    const minCorner = Math.min(...corners.map((c) => c.mean));
    const avgCorner = corners.reduce((s, c) => s + c.mean, 0) / corners.length;

    return {
        bandLum,
        center,
        corners,
        minCorner,
        avgCorner,
        haloDelta: center.mean - minCorner
    };
}

/**
 * Navigates opaque-box from current Adventure position until a modal of desired kind opens:
 * - targetKind: 'door' | 'combat' | 'trap' | 'shrine'
 * Leaves the target modal OPEN and returns metadata!
 */
export async function seekModalKind(page, targetKind, {
    maxSteps = 65,
    timeoutMs = 95000
} = {}) {
    await assertFloor1Boot(page);
    const tracker = new RoomTracker();
    const idleRms = await calibrateIdleRms(page, 220);
    const deadline = Date.now() + timeoutMs;

    // For traps, after entering Room 1, probe East/West side chambers first (avoids portcullis+skeleton)
    const dirs = targetKind === 'trap'
        ? [['KeyW'], ['KeyD'], ['KeyA'], ['KeyS']]
        : [['KeyW'], ['KeyD'], ['KeyA'], ['KeyS']];
    let dirIdx = 0;
    let probedRoom1Side = false;
    let consecutiveNoMove = 0;

    for (let step = 0; step < maxSteps && Date.now() < deadline; step++) {
        let open = await detectOpenModal(page);
        if (open === 'combat' && targetKind === 'combat') {
            const hud = await readAdventureHud(page);
            return { kind: 'combat', roomName: hud.roomText, combat: await readCombatState(page), tracker };
        }
        if (open === 'encounter') {
            const enc = await readEncounterModal(page);
            if (enc.kind === targetKind) {
                const hud = await readAdventureHud(page);
                return { kind: targetKind, roomName: hud.roomText, encounter: enc, tracker };
            }
            await resolveEncounterModal(page, { strategy: 'optimal' });
        } else if (open === 'combat') {
            await runCombat(page, 'win');
        }

        const hudBefore = await readAdventureHud(page);
        if (
            targetKind === 'trap' &&
            !probedRoom1Side &&
            !/entrance|threshold|vestibule/i.test(hudBefore.roomText)
        ) {
            probedRoom1Side = true;
            // Step forward slightly to mid-Room 1 then bias East toward Gallery of Swinging Blades
            await page.holdKeys(['KeyW'], 420);
            dirIdx = 1; // KeyD
        }

        let clickPos = null;
        if (step % 4 === 3) {
            const shot = decodePng(await page.screenshot());
            const beacons = findWalkableBeacons(shot);
            if (beacons.length > 0) clickPos = beacons[step % beacons.length];
        }

        const shotBefore = decodePng(await page.screenshot());
        if (clickPos) {
            await page.clickAt(clickPos.x, clickPos.y);
            await page.sleep(520);
        } else {
            await page.holdKeys(dirs[dirIdx % dirs.length], 420);
        }

        open = await detectOpenModal(page);
        const hudAfter = await readAdventureHud(page);
        tracker.recordState(hudAfter, hudBefore);

        if (open === 'combat') {
            if (targetKind === 'combat') {
                return { kind: 'combat', roomName: hudAfter.roomText, combat: await readCombatState(page), tracker };
            }
            await runCombat(page, 'win');
            consecutiveNoMove = 0;
            continue;
        }

        if (open === 'encounter') {
            const enc = await readEncounterModal(page);
            if (enc.kind === targetKind) {
                return { kind: targetKind, roomName: hudAfter.roomText, encounter: enc, tracker };
            }
            await resolveEncounterModal(page, { strategy: 'optimal' });
            consecutiveNoMove = 0;
            continue;
        }

        if (targetKind === 'trap') {
            const newest = hudAfter.logs.slice(0, Math.max(0, hudAfter.logs.length - hudBefore.logs.length));
            if (
                newest.some((l) => !l.isDread && /trap|spike|scythe|pendulum|dart|blood\s*rune|damage/i.test(l.text)) ||
                (hudAfter.hp < hudBefore.hp && newest.some((l) => !l.isDread))
            ) {
                return {
                    kind: 'trap-step',
                    roomName: hudAfter.roomText,
                    hudBefore,
                    hudAfter,
                    logsAdded: newest,
                    tracker
                };
            }
        }

        const shotAfter = decodePng(await page.screenshot());
        const rms = computeRmsDelta(shotBefore, shotAfter);
        const moved = (hudAfter.roomText !== hudBefore.roomText) || rms >= Math.max(7.2, idleRms * 1.42);
        if (!moved) {
            consecutiveNoMove++;
            if (consecutiveNoMove >= 10) {
                throw new Error(`Navigator stalled seeking '${targetKind}' (${consecutiveNoMove} unmoving steps in "${hudAfter.roomText}")`);
            }
            dirIdx = (dirIdx + 1) % dirs.length;
        } else {
            consecutiveNoMove = 0;
            if (hudAfter.roomText !== hudBefore.roomText) {
                if (targetKind !== 'trap') dirIdx = 0;
            }
        }
    }

    throw new Error(`Could not encounter target modal '${targetKind}' within ${maxSteps} opaque-box navigation steps`);
}

export async function muteMusicAndSfxOnTitle(page) {
    for (let i = 0; i < 3; i++) {
        const txt = await page.eval(() => document.getElementById('btnStartMusicToggle')?.textContent?.trim() || '');
        if (/muted/i.test(txt)) break;
        await page.click('#btnStartMusicToggle');
        await page.sleep(100);
    }
    const sfxTxt = await page.eval(() => document.getElementById('btnStartSfxToggle')?.textContent?.trim() || '');
    if (!sfxTxt.includes('🔇')) {
        await page.click('#btnStartSfxToggle');
        await page.sleep(100);
    }
    return page.eval(() => ({
        music: document.getElementById('btnStartMusicToggle')?.textContent?.trim() || '',
        sfx: document.getElementById('btnStartSfxToggle')?.textContent?.trim() || ''
    }));
}

export { enterRoom1, stepMove };
