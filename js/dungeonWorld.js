import * as THREE from '../vendor/three.module.js';
import { CharacterBuilder } from './characterBuilder.js';
import { sound } from './audio.js';
import { music } from './music.js';
import { createFloor1Layout, buildNavGrid } from './floor1Layout.js';
import { createFloor1Run } from './encounters.js';
import {
    buildOverworldMonster,
    updateOverworldMonster,
    buildTrapProp,
    updateTrapPropVisual,
    buildDoorProp,
    updateDoorPropVisual,
    buildShrineProp,
    buildExitSealProp,
    buildRoomPropAnchor,
    buildTorchSconceMesh,
    buildBeacon,
    buildDustMotesSystem,
    disposeObject3D
} from './overworldProps.js';

export const MAX_SCENE_POINT_LIGHTS = 8;
export const DEFAULT_ENV_LIGHT_POOL_SIZE = 6;

/**
 * Generates a Node-safe procedural pixel-art stone flagstone DataTexture (zero DOM dependencies).
 */
export function createStoneFloorTexture(repeatX = 2, repeatY = 2) {
    const size = 32;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            const tileY = Math.floor(y / 8);
            const xOff = (tileY % 2) * 8;
            const tx = (x + xOff) % 16;
            const ty = y % 8;
            const isMortar = tx <= 1 || ty <= 1;

            const h = Math.sin((x + 1) * 12.9898 + (y + 1) * 78.233) * 43758.5453;
            const noise = (h - Math.floor(h)) * 22 - 11;
            const tileIdx = (Math.floor((x + xOff) / 16) + tileY) % 3;
            const tileBoost = tileIdx === 0 ? -18 : (tileIdx === 1 ? 16 : 36);

            let r;
            let g;
            let b;
            if (isMortar) {
                r = 16;
                g = 20;
                b = 28;
            } else {
                r = Math.max(36, Math.min(185, 102 + tileBoost + noise));
                g = Math.max(44, Math.min(200, 118 + tileBoost + noise));
                b = Math.max(58, Math.min(220, 145 + tileBoost + noise));
            }
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
        }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, repeatX), Math.max(1, repeatY));
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
}

/**
 * Generates a Node-safe procedural dark stone brick wall DataTexture.
 */
export function createStoneWallTexture(repeatX = 2, repeatY = 2) {
    const size = 32;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            const row = Math.floor(y / 8);
            const xOff = (row % 2) * 8;
            const bx = (x + xOff) % 16;
            const by = y % 8;
            const isMortar = bx <= 1 || by <= 1;

            const h = Math.sin((x + 3) * 19.13 + (y + 5) * 47.71) * 29183.17;
            const noise = (h - Math.floor(h)) * 18 - 9;
            const brickTone = ((Math.floor((x + xOff) / 16) + row * 2) % 3) * 18;

            let r;
            let g;
            let b;
            if (isMortar) {
                r = 14;
                g = 18;
                b = 26;
            } else {
                r = Math.max(32, Math.min(170, 82 + brickTone + noise));
                g = Math.max(38, Math.min(185, 96 + brickTone + noise));
                b = Math.max(50, Math.min(205, 120 + brickTone + noise));
            }
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
        }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, repeatX), Math.max(1, repeatY));
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
}

/**
 * Normalizes hero configuration across both CharacterCreator schema (`charClass`, `ancestry`)
 * and test fixtures (`classKey`, `race`).
 */
export function normalizeHeroConfig(heroConfig = {}) {
    const cfg = heroConfig && typeof heroConfig === 'object' ? heroConfig : {};
    const rawClass = cfg.charClass || cfg.classKey || 'warrior';
    const charClass = String(rawClass).toLowerCase();
    const rawAncestry = cfg.ancestry || cfg.race || 'human';
    const ancestry = String(rawAncestry).toLowerCase();

    return {
        ...cfg,
        name: typeof cfg.name === 'string' && cfg.name.trim() ? cfg.name : 'Delver',
        charClass,
        classKey: charClass,
        ancestry,
        race: ancestry,
        bodyType: cfg.bodyType || 'a',
        hairStyle: cfg.hairStyle ?? 0,
        beardStyle: cfg.beardStyle ?? 0,
        showHelm: cfg.showHelm !== undefined ? Boolean(cfg.showHelm) : true,
        skinColor: cfg.skinColor ?? 0xd8a888,
        hairColor: cfg.hairColor ?? 0x3b281c,
        clothColor: cfg.clothColor ?? 0x7f1d1d,
        armorColor: cfg.armorColor ?? 0x64748b
    };
}

/**
 * Resolves WASD / Arrow key state into a normalized 2D XZ movement vector.
 */
export function resolveKeyboardDirection(pressedKeys) {
    if (!pressedKeys) return { x: 0, z: 0 };

    const has = (code) => {
        if (pressedKeys instanceof Set) return pressedKeys.has(code);
        if (Array.isArray(pressedKeys)) return pressedKeys.includes(code);
        if (typeof pressedKeys === 'object') return Boolean(pressedKeys[code]);
        return false;
    };

    let dx = 0;
    let dz = 0;

    if (has('KeyW') || has('ArrowUp') || has('w') || has('W')) dz -= 1;
    if (has('KeyS') || has('ArrowDown') || has('s') || has('S')) dz += 1;
    if (has('KeyA') || has('ArrowLeft') || has('a') || has('A')) dx -= 1;
    if (has('KeyD') || has('ArrowRight') || has('d') || has('D')) dx += 1;

    if (dx === 0 && dz === 0) return { x: 0, z: 0 };

    const len = Math.hypot(dx, dz);
    return { x: dx / len, z: dz / len };
}

/**
 * Ensures South-facing cutaway walls never exceed camera sightline threshold (<= 1.4, clamped <= 1.2).
 */
export function clampSouthWallHeight(wall) {
    if (!wall || typeof wall !== 'object') return 4.0;
    const h = Number.isFinite(wall.height) && wall.height > 0 ? wall.height : (wall.isSouthFace ? 1.2 : 4.0);
    if (wall.isSouthFace) {
        return Math.min(1.2, Math.max(0.1, h));
    }
    return h;
}

export function shouldAddWallTrim(wall) {
    return Boolean(wall && !wall.isSouthFace);
}

/**
 * Selects up to `maxTotalPointLights - playerLightsCount` closest discovered environmental
 * PointLight candidates so total active/instantiated PointLights in the scene stay strictly <= 8.
 */
export function selectPooledLights(arg1 = {}, arg2 = null, arg3 = null) {
    let playerLightsCount = 1;
    let candidates = [];
    let playerPos = { x: 0, z: 0 };
    let maxTotalPointLights = MAX_SCENE_POINT_LIGHTS;
    let maxEnvLights = null;

    if (Array.isArray(arg1)) {
        candidates = arg1;
        playerPos = arg2 || { x: 0, z: 0 };
        maxEnvLights = typeof arg3 === 'number' ? arg3 : DEFAULT_ENV_LIGHT_POOL_SIZE;
    } else if (arg1 && typeof arg1 === 'object') {
        playerLightsCount = Number.isFinite(arg1.playerLightsCount) ? Math.max(0, arg1.playerLightsCount) : 1;
        candidates = Array.isArray(arg1.candidates) ? arg1.candidates : [];
        playerPos = arg1.playerPos || { x: 0, z: 0 };
        maxTotalPointLights = Number.isFinite(arg1.maxTotalPointLights)
            ? Math.max(0, arg1.maxTotalPointLights)
            : MAX_SCENE_POINT_LIGHTS;
        maxEnvLights = Number.isFinite(arg1.maxEnvLights) ? Math.max(0, arg1.maxEnvLights) : null;
    }

    const remainingBudget = Math.max(0, maxTotalPointLights - playerLightsCount);
    const cap = maxEnvLights !== null ? Math.min(remainingBudget, maxEnvLights) : remainingBudget;
    if (cap <= 0) return [];

    const px = Number.isFinite(playerPos.x) ? playerPos.x : 0;
    const pz = Number.isFinite(playerPos.z) ? playerPos.z : 0;

    const eligible = [];
    for (const cand of candidates) {
        if (!cand || cand.discovered === false || cand.enabled === false) continue;
        if (!Number.isFinite(cand.x) || !Number.isFinite(cand.z)) continue;
        const distSq = (cand.x - px) ** 2 + (cand.z - pz) ** 2;
        eligible.push({ cand, distSq });
    }

    eligible.sort((a, b) => a.distSq - b.distSq);
    return eligible.slice(0, cap).map((entry) => entry.cand);
}

/**
 * Initializes room discovery / fog-of-war state.
 */
export function createRoomDiscoveryState(rooms = [], initialRoomId = 'entrance') {
    const list = Array.isArray(rooms) ? rooms : [];
    const roomsById = new Map();
    const discoveredRoomIds = new Set();

    for (const room of list) {
        if (!room || !room.id) continue;
        roomsById.set(room.id, room);
        if (room.discoveredInitially === true || room.id === initialRoomId) {
            discoveredRoomIds.add(room.id);
        }
    }

    if (initialRoomId && roomsById.has(initialRoomId)) {
        discoveredRoomIds.add(initialRoomId);
    }

    return {
        roomsById,
        discoveredRoomIds,
        currentRoomId: roomsById.has(initialRoomId) ? initialRoomId : null,
        lastRoomId: roomsById.has(initialRoomId) ? initialRoomId : null
    };
}

/**
 * Steps room discovery state from player world position using `navGrid.getRoomAt`.
 */
export function stepRoomDiscovery(state, pos, navGrid) {
    if (!state || !pos || !navGrid || typeof navGrid.getRoomAt !== 'function') {
        return {
            room: null,
            currentRoomId: state?.currentRoomId || null,
            firstDiscovery: false,
            enteredRoom: false,
            discoveredRoomIds: state?.discoveredRoomIds || new Set()
        };
    }

    const room = navGrid.getRoomAt(pos.x, pos.z);
    state.currentRoomId = room ? room.id : null;

    if (!room) {
        return {
            room: null,
            currentRoomId: null,
            firstDiscovery: false,
            enteredRoom: false,
            discoveredRoomIds: state.discoveredRoomIds
        };
    }

    const firstDiscovery = !state.discoveredRoomIds.has(room.id);
    if (firstDiscovery) {
        state.discoveredRoomIds.add(room.id);
    }
    const enteredRoom = firstDiscovery || state.lastRoomId !== room.id;
    state.lastRoomId = room.id;

    return {
        room,
        currentRoomId: room.id,
        firstDiscovery,
        enteredRoom,
        discoveredRoomIds: state.discoveredRoomIds
    };
}

/**
 * Filters encounters that are valid to trigger at `playerPos`, preventing cross-wall triggers,
 * closed-door bypasses, triggered-trap re-triggers, and failed-modal infinite loops.
 */
export function filterTriggerableEncounters({
    encounters = [],
    playerPos,
    currentRoomId = null,
    navGrid,
    unlockedDoorIds = new Set(),
    activeEncounterId = null,
    cooldownMap = null,
    nowMs = 0,
    isMoving = true
} = {}) {
    if (!Array.isArray(encounters) || !playerPos || !Number.isFinite(playerPos.x) || !Number.isFinite(playerPos.z)) {
        return [];
    }

    const candidates = [];

    for (const enc of encounters) {
        if (!enc || enc.resolved === true) continue;
        if (activeEncounterId && enc.id === activeEncounterId) continue;

        if (enc.kind === 'trap' && (enc.trapState === 'triggered' || enc.trapState === 'disarmed')) {
            continue;
        }

        if (!enc.pos || !Number.isFinite(enc.pos.x) || !Number.isFinite(enc.pos.z)) continue;

        const radius = Number.isFinite(enc.triggerRadius) ? enc.triggerRadius : 2.1;
        const dist = Math.hypot(playerPos.x - enc.pos.x, playerPos.z - enc.pos.z);
        if (dist > radius) continue;

        if (cooldownMap instanceof Map && cooldownMap.has(enc.id)) {
            const cd = cooldownMap.get(enc.id);
            const untilMs = typeof cd === 'number' ? cd : (cd?.untilMs || 0);
            if (nowMs < untilMs) continue;
            if (cd && typeof cd === 'object' && cd.requireMoveOrExit) {
                const exitedRadius = dist > radius + 0.35;
                if (!exitedRadius && !isMoving) {
                    continue;
                }
            }
        }

        if (navGrid && typeof navGrid.hasLineOfSight === 'function') {
            const losOk = navGrid.hasLineOfSight(playerPos, enc.pos, {
                includeClosedDoors: true,
                unlockedDoorIds,
                ignoreDoorIds: enc.doorId ? [enc.doorId] : null
            });
            if (!losOk) continue;
        } else if (currentRoomId && enc.roomId && enc.kind !== 'door' && enc.roomId !== currentRoomId) {
            continue;
        }

        candidates.push({ enc, dist });
    }

    candidates.sort((a, b) => a.dist - b.dist);
    return candidates.map((c) => c.enc);
}

/**
 * Advances room-bounded monster aggro/patrol. Monsters only aggro when the hero is in the
 * same room with clear LOS within `aggroRadius`, and are clamped strictly inside `roomBounds`.
 */
export function stepMonsterAggro(
    monsterEntry,
    playerPos,
    playerRoomId,
    roomBounds,
    navGrid,
    delta = 0.016,
    unlockedDoorIds = new Set()
) {
    if (!monsterEntry || !monsterEntry.pos) {
        return { pos: { x: 0, z: 0 }, isAggro: false, moved: false, rotationY: 0 };
    }

    const cur = { x: monsterEntry.pos.x, z: monsterEntry.pos.z };
    const home = monsterEntry.homePos || cur;
    if (monsterEntry.resolved) {
        return { pos: cur, isAggro: false, moved: false, rotationY: monsterEntry.rotationY || 0 };
    }

    const dt = Number.isFinite(delta) && delta > 0 ? Math.min(delta, 0.1) : 0;
    const inset = 0.45;
    const clampToRoom = (p) => {
        if (!roomBounds) return { x: p.x, z: p.z };
        const minX = roomBounds.minX + inset;
        const maxX = roomBounds.maxX - inset;
        const minZ = roomBounds.minZ + inset;
        const maxZ = roomBounds.maxZ - inset;
        return {
            x: minX <= maxX ? Math.max(minX, Math.min(maxX, p.x)) : (roomBounds.minX + roomBounds.maxX) / 2,
            z: minZ <= maxZ ? Math.max(minZ, Math.min(maxZ, p.z)) : (roomBounds.minZ + roomBounds.maxZ) / 2
        };
    };

    const distToPlayer = playerPos
        ? Math.hypot(playerPos.x - cur.x, playerPos.z - cur.z)
        : Infinity;
    const aggroRadius = Number.isFinite(monsterEntry.aggroRadius) ? monsterEntry.aggroRadius : 5.0;
    const inSameRoom = Boolean(playerRoomId && monsterEntry.roomId && playerRoomId === monsterEntry.roomId);
    const hasLos = Boolean(
        inSameRoom &&
        playerPos &&
        (!navGrid || navGrid.hasLineOfSight(cur, playerPos, { includeClosedDoors: true, unlockedDoorIds }))
    );

    const isAggro = Boolean(inSameRoom && hasLos && distToPlayer <= aggroRadius);
    const speed = Number.isFinite(monsterEntry.speed) ? monsterEntry.speed : 2.35;

    let nextPos = cur;
    let moved = false;
    let rotationY = monsterEntry.rotationY || 0;

    if (isAggro && playerPos) {
        const dx = playerPos.x - cur.x;
        const dz = playerPos.z - cur.z;
        rotationY = Math.atan2(dx, dz);

        const stopDist = Math.max(1.15, (monsterEntry.triggerRadius || 2.2) * 0.58);
        if (distToPlayer > stopDist && dt > 0) {
            const step = Math.min(distToPlayer - stopDist, speed * dt);
            if (step > 1e-4) {
                const dirX = dx / distToPlayer;
                const dirZ = dz / distToPlayer;
                const candidate = clampToRoom({ x: cur.x + dirX * step, z: cur.z + dirZ * step });
                const walked = navGrid && typeof navGrid.clampWalkable === 'function'
                    ? navGrid.clampWalkable(candidate, cur, unlockedDoorIds)
                    : candidate;
                nextPos = clampToRoom(walked);
                moved = Math.hypot(nextPos.x - cur.x, nextPos.z - cur.z) > 1e-4;
            }
        }
    } else {
        const hdx = home.x - cur.x;
        const hdz = home.z - cur.z;
        const distHome = Math.hypot(hdx, hdz);
        if (distHome > 0.08 && dt > 0) {
            rotationY = Math.atan2(hdx, hdz);
            const step = Math.min(distHome, speed * 0.75 * dt);
            const candidate = clampToRoom({
                x: cur.x + (hdx / distHome) * step,
                z: cur.z + (hdz / distHome) * step
            });
            const walked = navGrid && typeof navGrid.clampWalkable === 'function'
                ? navGrid.clampWalkable(candidate, cur, unlockedDoorIds)
                : candidate;
            nextPos = clampToRoom(walked);
            moved = Math.hypot(nextPos.x - cur.x, nextPos.z - cur.z) > 1e-4;
        } else {
            rotationY = 0;
        }
    }

    return { pos: nextPos, isAggro, moved, rotationY };
}

/**
 * Computes an unobstructed A* path plan for click-to-move (either ground or encounter click).
 */
export function resolveClickMovePlan({
    clickPoint = null,
    clickedEncounterId = null,
    playerPos,
    encounters = [],
    navGrid,
    unlockedDoorIds = new Set()
} = {}) {
    if (!navGrid || !playerPos) {
        return { type: 'none', encounterId: null, target: null, waypoints: [] };
    }

    if (clickedEncounterId) {
        const enc = encounters.find((e) => e.id === clickedEncounterId);
        if (enc && !enc.resolved) {
            const approach = navGrid.computeApproachPoint(playerPos, enc.pos, 1.5, unlockedDoorIds);
            if (!approach) {
                return { type: 'blocked', encounterId: enc.id, target: null, waypoints: [] };
            }
            const waypoints = navGrid.findPath(playerPos, approach, { snapGoal: true, unlockedDoorIds });
            if (waypoints.length > 0) {
                return { type: 'encounter', encounterId: enc.id, target: approach, waypoints };
            }
            return { type: 'blocked', encounterId: enc.id, target: null, waypoints: [] };
        }
    }

    if (clickPoint && Number.isFinite(clickPoint.x) && Number.isFinite(clickPoint.z)) {
        const waypoints = navGrid.findPath(playerPos, clickPoint, { snapGoal: true, unlockedDoorIds });
        if (waypoints.length > 0) {
            return {
                type: 'ground',
                encounterId: null,
                target: waypoints[waypoints.length - 1],
                waypoints
            };
        }
    }

    return { type: 'none', encounterId: null, target: null, waypoints: [] };
}

export function computeTrapVisualState(enc, success) {
    if (success === true) return 'disarmed';
    if (success === false) return 'triggered';
    return enc?.trapState || 'armed';
}

/**
 * Pure state transition logic for encounter resolution.
 * Keeps failed doors (`enc.kind === 'door' || enc.retryable`) `resolved = false`.
 */
export function applyEncounterResolution(enc, success, opts = {}) {
    if (!enc) {
        return { resolved: false, trapState: null, unlockDoorId: null, victory: false, hideBeacon: false };
    }

    if (enc.kind === 'door' || enc.retryable) {
        const shouldUnlock = Boolean(success === true || opts?.unlocksDoor);
        enc.resolved = shouldUnlock;
        return {
            resolved: shouldUnlock,
            trapState: null,
            unlockDoorId: shouldUnlock ? (enc.doorId || null) : null,
            victory: false,
            retryable: true,
            hideBeacon: shouldUnlock
        };
    }

    if (enc.kind === 'trap') {
        const trapState = computeTrapVisualState(enc, success);
        enc.trapState = trapState;
        enc.resolved = true;
        return {
            resolved: true,
            trapState,
            unlockDoorId: null,
            victory: false,
            hideBeacon: true
        };
    }

    if (enc.kind === 'exit') {
        const resolved = Boolean(success === true || opts?.resolved === true);
        enc.resolved = resolved;
        return {
            resolved,
            trapState: null,
            unlockDoorId: null,
            victory: resolved,
            hideBeacon: resolved
        };
    }

    const resolved = Boolean(success === true || opts?.resolved === true);
    enc.resolved = resolved;
    return {
        resolved,
        trapState: null,
        unlockDoorId: null,
        victory: false,
        hideBeacon: resolved
    };
}

/**
 * 3D Multi-Room Dungeon Crawl Adventure World
 */
export class DungeonWorldApp {
    constructor(container, heroConfig, onEncounterTrigger, onPlayerStatsUpdate, runDataOrCallbacks = {}) {
        this.container = container;
        this.heroConfig = normalizeHeroConfig(heroConfig);
        this.onEncounterTrigger = onEncounterTrigger;
        this.onPlayerStatsUpdate = onPlayerStatsUpdate;

        const opts = runDataOrCallbacks && typeof runDataOrCallbacks === 'object' ? runDataOrCallbacks : {};
        const isDirectRunData = Boolean(opts.floor && Array.isArray(opts.encounters));

        this.callbacks = {
            onRoomEnter: typeof opts.onRoomEnter === 'function' ? opts.onRoomEnter : null,
            onTrapStep: typeof opts.onTrapStep === 'function' ? opts.onTrapStep : null,
            onDoorUnlock: typeof opts.onDoorUnlock === 'function' ? opts.onDoorUnlock : null,
            onFloorVictory: typeof opts.onFloorVictory === 'function'
                ? opts.onFloorVictory
                : (typeof opts.onExitVictory === 'function' ? opts.onExitVictory : null),
            onEncounterFail: typeof opts.onEncounterFail === 'function' ? opts.onEncounterFail : null,
            isInputBlocked: typeof opts.isInputBlocked === 'function' ? opts.isInputBlocked : null
        };

        if (isDirectRunData) {
            this.runData = opts;
        } else if (opts.runData && opts.runData.floor && Array.isArray(opts.runData.encounters)) {
            this.runData = opts.runData;
        } else {
            this.runData = createFloor1Run({
                seed: opts.seed ?? null,
                randomizeThemes: Boolean(opts.randomizeThemes)
            });
        }

        this.floor = this.runData.floor || createFloor1Layout();
        this.layout = this.floor;
        this.encounters = Array.isArray(this.runData.encounters) ? this.runData.encounters : [];
        this.doors = Array.isArray(this.runData.doors) ? this.runData.doors : (this.floor.doors || []);
        this.rooms = Array.isArray(this.runData.rooms) ? this.runData.rooms : (this.floor.rooms || []);

        this.unlockedDoorIds = new Set();
        for (const d of this.doors) {
            if (d && d.initiallyLocked === false) {
                this.unlockedDoorIds.add(d.id);
            }
        }
        this.navGrid = buildNavGrid(this.floor, this.unlockedDoorIds);

        this.discoveryState = createRoomDiscoveryState(this.rooms, 'entrance');
        this.discoveredRoomIds = this.discoveryState.discoveredRoomIds;
        this.currentRoom = this.rooms.find((r) => r.id === 'entrance') || this.rooms[0] || null;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        this.builder = new CharacterBuilder();

        // Player state
        const sp = this.floor.spawnPoint || { x: 0, z: 21 };
        this.player = null;
        this.playerModel = null;
        this.playerTorchLight = null;
        this.playerTorchFlame = null;
        this.isMoving = false;
        this.targetPos = new THREE.Vector3(sp.x, 0, sp.z);
        this.path = [];
        this.moveSpeed = 5.4;
        this.walkCycle = 0;
        this.footstepTimer = 0;
        this.elapsedTime = 0;

        // Lighting & atmosphere
        this.ambientLight = null;
        this.moonLight = null;
        this.moonLightTarget = null;
        this.envLightPool = [];
        this.lightCandidates = [];
        this.torchEntries = [];
        this.torches = [];
        this.dustMotes = null;

        // Rooms, shrouds, doors, interactables
        this.roomVisuals = new Map();
        this.walkableFloorMeshes = [];
        this.clickableEncounterMeshes = [];
        this.doorEntries = [];
        this.interactables = [];

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.floorPlane = null;
        this.activeEncounterId = null;
        this.cooldownMap = new Map();
        this._respawnGraceUntil = 0;
        this.clickReticle = null;

        // Controls & lifecycle
        this.keysPressed = new Set();
        this.paused = false;
        this.disposed = false;
        this.rafId = null;
        this._resizeObserver = null;
        this._onResize = null;
        this._onPointerDown = null;
        this._onKeyDown = null;
        this._onKeyUp = null;
        this._onBlur = null;

        const headless = Boolean(opts.headless) || !this.container;
        if (!headless) {
            this.initScene();
            this.buildDungeonEnvironment();
            this.spawnEncounters();
            this.spawnPlayer();
            this.refreshVisibilityAndLights(0, true);
            this.setupEventListeners();

            if (typeof window !== 'undefined') {
                window.__dungeonWorld = this;
            }
            this.animate();
        }
    }

    initScene() {
        const width = this.container.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280);
        const height = this.container.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800);
        const sp = this.floor.spawnPoint || { x: 0, z: 21 };

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x040509);
        this.scene.fog = new THREE.FogExp2(0x040509, 0.056);

        // Isometric perspective camera tracking player at (x, 14, z + 10)
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        this.camera.position.set(sp.x, 14, sp.z + 10);
        this.camera.lookAt(sp.x, 1.0, sp.z);

        // WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(width, height);
        const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
        this.renderer.setPixelRatio(Math.min(dpr, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Dim Horror Ambient (<= 0.24) & Moon DirectionalLight (<= 0.34) tracking player
        this.ambientLight = new THREE.AmbientLight(0x283652, 0.24);
        this.scene.add(this.ambientLight);

        this.moonLightTarget = new THREE.Object3D();
        this.moonLightTarget.position.set(sp.x, 0, sp.z);
        this.scene.add(this.moonLightTarget);

        this.moonLight = new THREE.DirectionalLight(0x5e82b5, 0.34);
        this.moonLight.position.set(sp.x + 10, 20, sp.z + 10);
        this.moonLight.target = this.moonLightTarget;
        this.moonLight.castShadow = true;
        this.moonLight.shadow.mapSize.width = 1024;
        this.moonLight.shadow.mapSize.height = 1024;
        this.moonLight.shadow.camera.near = 0.5;
        this.moonLight.shadow.camera.far = 45;
        this.moonLight.shadow.camera.left = -14;
        this.moonLight.shadow.camera.right = 14;
        this.moonLight.shadow.camera.top = 14;
        this.moonLight.shadow.camera.bottom = -14;
        this.scene.add(this.moonLight);

        // Pooled environmental PointLights (strictly <= 6 so + player lights <= 8 total)
        for (let i = 0; i < DEFAULT_ENV_LIGHT_POOL_SIZE; i++) {
            const pLight = new THREE.PointLight(0xff9933, 0, 15, 1.2);
            pLight.visible = false;
            pLight.castShadow = false;
            this.scene.add(pLight);
            this.envLightPool.push(pLight);
        }

        // Click Reticle
        const reticleGeo = new THREE.RingGeometry(0.28, 0.42, 4);
        const reticleMat = new THREE.MeshBasicMaterial({
            color: 0xffcf40,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0
        });
        this.clickReticle = new THREE.Mesh(reticleGeo, reticleMat);
        this.clickReticle.rotation.x = -Math.PI / 2;
        this.clickReticle.position.y = 0.04;
        this.scene.add(this.clickReticle);
    }

    buildDungeonEnvironment() {
        const wallTex = createStoneWallTexture(2, 1);
        const wallMat = new THREE.MeshLambertMaterial({ color: 0xc2cde0, map: wallTex, flatShading: true });
        const trimMat = new THREE.MeshLambertMaterial({ color: 0x3b4860, flatShading: true });
        const southCapMat = new THREE.MeshLambertMaterial({ color: 0x2c3648, flatShading: true });

        // 1. Rooms: textured stone flagstone floors, grid overlays, props, sconces, fog-of-war shrouds
        for (const room of this.rooms) {
            const b = room.bounds;
            const w = b.maxX - b.minX;
            const d = b.maxZ - b.minZ;
            const cx = (b.minX + b.maxX) / 2;
            const cz = (b.minZ + b.maxZ) / 2;

            const roomFloorTex = createStoneFloorTexture(Math.max(1, w / 2), Math.max(1, d / 2));
            const roomFloorMat = new THREE.MeshLambertMaterial({
                color: 0xd2dced,
                map: roomFloorTex,
                flatShading: true
            });
            const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), roomFloorMat);
            slab.position.set(cx, -0.1, cz);
            slab.receiveShadow = true;
            slab.name = `Floor_${room.id}`;
            slab.userData = { isWalkableFloor: true, roomId: room.id };
            this.scene.add(slab);
            this.walkableFloorMeshes.push(slab);
            if (!this.floorPlane) this.floorPlane = slab;

            // Stone grid lines for clear movement contrast
            const gridDiv = Math.max(2, Math.round(Math.max(w, d) / 2));
            const gridSize = Math.max(w, d);
            const grid = new THREE.GridHelper(gridSize, gridDiv, 0x35435c, 0x222c3d);
            grid.scale.set(w / gridSize, 1, d / gridSize);
            grid.position.set(cx, 0.012, cz);
            this.scene.add(grid);

            // Group containing props & sconces hidden while room is shrouded
            const visualGroup = new THREE.Group();
            visualGroup.name = `RoomVisuals_${room.id}`;
            const isDiscovered = this.discoveredRoomIds.has(room.id);
            visualGroup.visible = isDiscovered;
            this.scene.add(visualGroup);

            // Scary crypt props from layout propAnchors
            if (Array.isArray(room.propAnchors)) {
                for (const anchor of room.propAnchors) {
                    const prop = buildRoomPropAnchor(anchor);
                    visualGroup.add(prop);
                }
            }

            // Wall sconces (zero PointLights embedded — feed lightCandidates instead)
            if (Array.isArray(room.torchSpots)) {
                for (const spot of room.torchSpots) {
                    const sconce = buildTorchSconceMesh(spot);
                    visualGroup.add(sconce.group);
                    const entry = {
                        roomId: room.id,
                        flame: sconce.flame,
                        x: spot.x,
                        y: 2.6,
                        z: spot.z + 0.35,
                        color: spot.color || 0xff9933,
                        intensity: (spot.intensity || 1.2) * 10.5,
                        distance: 16,
                        decay: 1.15,
                        discovered: isDiscovered
                    };
                    this.torchEntries.push(entry);
                    this.torches.push(entry);
                    this.lightCandidates.push(entry);
                }
            }

            // Fog-of-war shroud for undiscovered rooms
            const floorVeilMat = new THREE.MeshBasicMaterial({
                color: 0x020306,
                transparent: true,
                opacity: isDiscovered ? 0 : 0.94,
                depthWrite: false
            });
            const floorVeil = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.2, d + 0.2), floorVeilMat);
            floorVeil.rotation.x = -Math.PI / 2;
            floorVeil.position.set(cx, 0.045, cz);

            const canopyMat = new THREE.MeshBasicMaterial({
                color: 0x030408,
                transparent: true,
                opacity: isDiscovered ? 0 : 0.84,
                depthWrite: false
            });
            const canopy = new THREE.Mesh(new THREE.BoxGeometry(w, 1.9, d), canopyMat);
            canopy.position.set(cx, 1.0, cz);

            const shroudGroup = new THREE.Group();
            shroudGroup.name = `Shroud_${room.id}`;
            shroudGroup.add(floorVeil, canopy);
            shroudGroup.visible = !isDiscovered;
            this.scene.add(shroudGroup);

            this.roomVisuals.set(room.id, {
                room,
                visualGroup,
                shroudGroup,
                floorVeil,
                floorVeilMat,
                canopyMat,
                fadeProgress: isDiscovered ? 1 : 0
            });
        }

        // 2. Corridors
        for (const corr of this.floor.corridors || []) {
            const b = corr.bounds;
            const w = b.maxX - b.minX;
            const d = b.maxZ - b.minZ;
            const cx = (b.minX + b.maxX) / 2;
            const cz = (b.minZ + b.maxZ) / 2;

            const corrTex = createStoneFloorTexture(Math.max(1, w / 2), Math.max(1, d / 2));
            const corrMat = new THREE.MeshLambertMaterial({
                color: 0xbac6da,
                map: corrTex,
                flatShading: true
            });
            const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), corrMat);
            slab.position.set(cx, -0.1, cz);
            slab.receiveShadow = true;
            slab.name = `Corridor_${corr.id}`;
            slab.userData = { isWalkableFloor: true, corridorId: corr.id };
            this.scene.add(slab);
            this.walkableFloorMeshes.push(slab);

            const gridDiv = Math.max(2, Math.round(Math.max(w, d)));
            const gSize = Math.max(w, d);
            const grid = new THREE.GridHelper(gSize, gridDiv, 0x2f3b52, 0x1e2636);
            grid.scale.set(w / gSize, 1, d / gSize);
            grid.position.set(cx, 0.012, cz);
            this.scene.add(grid);
        }

        // 3. Walls with South-wall cutaway invariant (isSouthFace height <= 1.2, NO tall trim)
        for (const wall of this.floor.walls || []) {
            const w = wall.maxX - wall.minX;
            const d = wall.maxZ - wall.minZ;
            const cx = (wall.minX + wall.maxX) / 2;
            const cz = (wall.minZ + wall.maxZ) / 2;
            const h = clampSouthWallHeight(wall);

            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
            mesh.position.set(cx, h / 2, cz);
            mesh.castShadow = !wall.isSouthFace;
            mesh.receiveShadow = true;
            mesh.userData = {
                isWall: true,
                isSouthFace: Boolean(wall.isSouthFace),
                wallHeight: h
            };
            this.scene.add(mesh);

            if (shouldAddWallTrim(wall)) {
                const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.22, d + 0.08), trimMat);
                trim.position.set(cx, h + 0.11, cz);
                this.scene.add(trim);
            } else {
                // Flush dark coping strictly inside h <= 1.2
                const coping = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.06, d + 0.04), southCapMat);
                coping.position.set(cx, h - 0.03, cz);
                this.scene.add(coping);
            }
        }

        // 4. Doors
        for (const doorDef of this.doors) {
            const doorEntry = buildDoorProp(doorDef);
            doorEntry.group.position.set(doorDef.x, 0, doorDef.z);
            doorEntry.doorDef = doorDef;
            if (this.unlockedDoorIds.has(doorDef.id)) {
                updateDoorPropVisual(doorEntry, true, 1);
            }
            this.scene.add(doorEntry.group);
            this.doorEntries.push(doorEntry);
        }

        // 5. Floating Dust Motes across Floor 1 bounds
        this.dustMotes = buildDustMotesSystem({
            bounds: { minX: -18, maxX: 18, minZ: -35, maxZ: 25 },
            count: 140
        });
        this.scene.add(this.dustMotes.points);
    }

    spawnEncounters() {
        for (const enc of this.encounters) {
            const propGroup = new THREE.Group();
            propGroup.position.set(enc.pos.x, 0, enc.pos.z);
            propGroup.userData = {
                encounterId: enc.id,
                isEncounter: true,
                kind: enc.kind
            };

            let propEntry = null;

            if (enc.kind === 'combat') {
                propEntry = buildOverworldMonster(enc.monsterId || 'skeleton', enc.monsterScale || 1.0);
                propGroup.add(propEntry.group);
            } else if (enc.kind === 'trap') {
                propEntry = buildTrapProp(enc.trapType || 'spike_pit', enc.trapState || 'armed');
                propGroup.add(propEntry.group);
            } else if (enc.kind === 'door') {
                const doorEntry = this.doorEntries.find((d) => d.doorId === enc.doorId);
                if (doorEntry) {
                    doorEntry.group.userData.encounterId = enc.id;
                    doorEntry.group.userData.isEncounter = true;
                }
                // Hitbox proxy at doorway so clicking doorway registers cleanly
                const hitProxy = new THREE.Mesh(
                    new THREE.BoxGeometry(2.0, 2.4, 0.8),
                    new THREE.MeshBasicMaterial({ visible: false })
                );
                hitProxy.position.y = 1.2;
                propGroup.add(hitProxy);
                propEntry = doorEntry || { group: hitProxy };
            } else if (enc.kind === 'exit') {
                propEntry = buildExitSealProp(enc);
                propGroup.add(propEntry.group);
                this.lightCandidates.push({
                    roomId: enc.roomId,
                    x: enc.pos.x,
                    y: 1.4,
                    z: enc.pos.z,
                    color: 0xfbbf24,
                    intensity: 6.5,
                    distance: 10,
                    decay: 1.2,
                    discovered: this.discoveredRoomIds.has(enc.roomId)
                });
            } else {
                // Shrine (moonwell / sarcophagus / monolith)
                propEntry = buildShrineProp(enc);
                propGroup.add(propEntry.group);
                this.lightCandidates.push({
                    roomId: enc.roomId,
                    x: enc.pos.x,
                    y: 1.2,
                    z: enc.pos.z,
                    color: 0x2dd4bf,
                    intensity: 5.5,
                    distance: 9,
                    decay: 1.2,
                    discovered: this.discoveredRoomIds.has(enc.roomId)
                });
            }

            const beacon = buildBeacon(0xffcf40, 0x38bdf8);
            beacon.position.y = 2.4;
            beacon.visible = !enc.resolved && (enc.kind !== 'trap' || enc.trapState === 'revealed');
            propGroup.add(beacon);

            this.scene.add(propGroup);

            const item = {
                enc,
                group: propGroup,
                propEntry,
                beacon,
                homePos: { x: enc.pos.x, z: enc.pos.z },
                roomBounds: this.rooms.find((r) => r.id === enc.roomId)?.bounds || null,
                isAggro: false,
                lastGrowlMs: 0,
                rotationY: 0
            };
            this.interactables.push(item);
        }
    }

    spawnPlayer() {
        const sp = this.floor.spawnPoint || { x: 0, z: 21 };
        this.player = new THREE.Group();
        this.player.name = 'PlayerHero';
        this.player.position.set(sp.x, 0, sp.z);

        this.playerModel = this.builder.createCharacter(this.heroConfig);
        this.player.add(this.playerModel.group);

        // Universal flickering torch/lantern rig attached on shoulder/hip for ALL classes (Warrior + Mage)
        const torchRig = new THREE.Group();
        torchRig.name = 'PlayerTorchRig';
        torchRig.position.set(0.35, 1.35, 0.28);

        const lanternCage = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.05, 0.16, 6),
            new THREE.MeshLambertMaterial({ color: 0x4b5563, flatShading: true })
        );
        const flameMesh = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.065, 0),
            new THREE.MeshBasicMaterial({ color: 0xffaa33 })
        );
        flameMesh.position.y = 0.04;
        torchRig.add(lanternCage, flameMesh);
        this.playerTorchFlame = flameMesh;

        this.playerTorchLight = new THREE.PointLight(0xff9b3d, 22.0, 16.5, 1.15);
        this.playerTorchLight.position.set(0, 0.15, 0.08);
        this.playerTorchLight.castShadow = false;
        torchRig.add(this.playerTorchLight);

        this.player.add(torchRig);
        this.scene.add(this.player);

        this.targetPos.set(sp.x, 0, sp.z);
    }

    isEncounterDiscoverable(enc) {
        if (!enc) return false;
        if (enc.kind === 'door') {
            const door = this.doors.find((d) => d.id === enc.doorId);
            if (door && Array.isArray(door.connects)) {
                return door.connects.some((rid) => this.discoveredRoomIds.has(rid));
            }
        }
        return !enc.roomId || this.discoveredRoomIds.has(enc.roomId);
    }

    refreshVisibilityAndLights(delta = 0, immediateShroud = false) {
        // 1. Sync room shrouds & room props
        for (const [roomId, rec] of this.roomVisuals.entries()) {
            const discovered = this.discoveredRoomIds.has(roomId);
            rec.visualGroup.visible = discovered;
            if (discovered) {
                rec.floorVeil.visible = false;
                if (immediateShroud) {
                    rec.fadeProgress = 1;
                    rec.shroudGroup.visible = false;
                } else if (rec.fadeProgress < 1) {
                    rec.fadeProgress = Math.min(1, rec.fadeProgress + Math.max(0.05, delta * 5.0));
                    rec.canopyMat.opacity = 0.84 * (1 - rec.fadeProgress);
                    if (rec.fadeProgress >= 1) {
                        rec.shroudGroup.visible = false;
                    }
                }
            }
        }

        // 2. Sync interactables visibility & clickable mesh list
        this.clickableEncounterMeshes = [];
        for (const item of this.interactables) {
            const enc = item.enc;
            const visible = this.isEncounterDiscoverable(enc);
            item.group.visible = visible;
            if (item.beacon) {
                const showBeacon = visible && !enc.resolved && (enc.kind !== 'trap' || enc.trapState === 'revealed');
                item.beacon.visible = showBeacon;
            }
            if (visible && !enc.resolved) {
                this.clickableEncounterMeshes.push(item.group);
            }
        }

        // 3. Sync light candidate discovery flags
        for (const cand of this.lightCandidates) {
            if (cand.roomId) {
                cand.discovered = this.discoveredRoomIds.has(cand.roomId);
            }
        }

        this.updatePooledLights(this.elapsedTime);
    }

    updatePooledLights(time = 0) {
        if (!this.scene || this.envLightPool.length === 0 || !this.player) return;
        const playerLightsCount = this.playerModel?.animState?.magicLight ? 2 : 1;
        const selected = selectPooledLights({
            playerLightsCount,
            candidates: this.lightCandidates,
            playerPos: this.player.position,
            maxTotalPointLights: MAX_SCENE_POINT_LIGHTS,
            maxEnvLights: this.envLightPool.length
        });

        for (let i = 0; i < this.envLightPool.length; i++) {
            const pLight = this.envLightPool[i];
            if (i < selected.length) {
                const cand = selected[i];
                const flicker = 1.0 + Math.sin(time * 5.5 + i * 2.1) * 0.04;
                pLight.visible = true;
                pLight.position.set(cand.x, cand.y ?? 2.4, cand.z);
                pLight.color.setHex(cand.color || 0xff9933);
                pLight.intensity = (cand.intensity || 2.0) * flicker;
                pLight.distance = cand.distance || 14;
                pLight.decay = cand.decay || 1.25;
            } else {
                pLight.visible = false;
                pLight.intensity = 0;
            }
        }
    }

    isInputBlocked() {
        if (this.disposed || this.paused) return true;
        if (this.callbacks.isInputBlocked && this.callbacks.isInputBlocked()) return true;

        if (typeof document !== 'undefined') {
            const activeTag = document.activeElement?.tagName;
            if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
                return true;
            }

            const screenAdv = document.getElementById('screenAdventure');
            if (screenAdv) {
                const advStyle = typeof window !== 'undefined' && window.getComputedStyle
                    ? window.getComputedStyle(screenAdv)
                    : screenAdv.style;
                if (advStyle && advStyle.display === 'none') return true;
            }

            const selectors = [
                '#encounterModal',
                '#combatModal',
                '#loreModal',
                '#victoryModal',
                '.modal.active',
                '.encounter-overlay',
                '.combat-overlay'
            ];
            for (const sel of selectors) {
                const els = document.querySelectorAll(sel);
                for (const el of els) {
                    const style = typeof window !== 'undefined' && window.getComputedStyle
                        ? window.getComputedStyle(el)
                        : el.style;
                    if (style && style.display !== 'none' && style.visibility !== 'hidden') {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    setupEventListeners() {
        this._onResize = () => {
            if (this.disposed || !this.container || !this.renderer || !this.camera) return;
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;
            if (width <= 0 || height <= 0) return;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this._onResize);
        }
        if (typeof ResizeObserver !== 'undefined' && this.container) {
            this._resizeObserver = new ResizeObserver(() => this._onResize?.());
            this._resizeObserver.observe(this.container);
        }

        this._onPointerDown = (e) => {
            if (this.isInputBlocked()) {
                this.keysPressed.clear();
                return;
            }
            if (!this.renderer || !this.camera || !this.player) return;

            const rect = this.renderer.domElement.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);

            // 1. Check discovered clickable encounter props first
            let clickedEncounterId = null;
            if (this.clickableEncounterMeshes.length > 0) {
                const propHits = this.raycaster.intersectObjects(this.clickableEncounterMeshes, true);
                for (const hit of propHits) {
                    let obj = hit.object;
                    while (obj && obj !== this.scene) {
                        if (obj.userData && obj.userData.encounterId) {
                            clickedEncounterId = obj.userData.encounterId;
                            break;
                        }
                        obj = obj.parent;
                    }
                    if (clickedEncounterId) break;
                }
            }

            if (clickedEncounterId) {
                const plan = resolveClickMovePlan({
                    clickedEncounterId,
                    playerPos: this.player.position,
                    encounters: this.encounters,
                    navGrid: this.navGrid,
                    unlockedDoorIds: this.unlockedDoorIds
                });
                if (plan.waypoints.length > 0 && plan.target) {
                    this.applyMovePlan(plan);
                } else if (plan.type === 'blocked') {
                    sound.playDoorLocked();
                }
                return;
            }

            // 2. Raycast walkable room/corridor floors only
            const floorHits = this.raycaster.intersectObjects(this.walkableFloorMeshes, false);
            if (floorHits.length > 0) {
                const point = floorHits[0].point;
                const plan = resolveClickMovePlan({
                    clickPoint: point,
                    playerPos: this.player.position,
                    encounters: this.encounters,
                    navGrid: this.navGrid,
                    unlockedDoorIds: this.unlockedDoorIds
                });
                if (plan.waypoints.length > 0 && plan.target) {
                    this.applyMovePlan(plan);
                }
            }
        };
        if (this.renderer?.domElement) {
            this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
        }

        const MOVEMENT_CODES = new Set([
            'KeyW', 'KeyA', 'KeyS', 'KeyD',
            'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'
        ]);

        this._onKeyDown = (e) => {
            if (this.isInputBlocked()) {
                this.keysPressed.clear();
                return;
            }
            if (!MOVEMENT_CODES.has(e.code)) return;
            if (e.code.startsWith('Arrow') && typeof e.preventDefault === 'function') {
                e.preventDefault();
            }
            this.keysPressed.add(e.code);
            // Keyboard steering cancels any active click-to-move A* path
            this.path = [];
        };

        this._onKeyUp = (e) => {
            this.keysPressed.delete(e.code);
        };

        this._onBlur = () => {
            this.keysPressed.clear();
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', this._onKeyDown);
            window.addEventListener('keyup', this._onKeyUp);
            window.addEventListener('blur', this._onBlur);
        }
    }

    applyMovePlan(plan) {
        if (!plan || !Array.isArray(plan.waypoints) || plan.waypoints.length === 0 || !plan.target) return;
        this.path = plan.waypoints.map((wp) => ({ x: wp.x, z: wp.z }));
        this.targetPos.set(plan.target.x, 0, plan.target.z);
        this.isMoving = true;
        sound.playSelect();

        if (this.clickReticle) {
            this.clickReticle.position.set(plan.target.x, 0.05, plan.target.z);
            this.clickReticle.material.opacity = 0.9;
            this.clickReticle.scale.set(1.5, 1.5, 1.5);
        }
    }

    setMoveTarget(dest) {
        if (!dest || !this.player) return;
        const plan = resolveClickMovePlan({
            clickPoint: dest,
            playerPos: this.player.position,
            encounters: this.encounters,
            navGrid: this.navGrid,
            unlockedDoorIds: this.unlockedDoorIds
        });
        if (plan.waypoints.length > 0 && plan.target) {
            this.applyMovePlan(plan);
        }
    }

    moveByDirection(dx, dz, delta = 0.016) {
        if (!this.player || !this.navGrid) return false;
        const len = Math.hypot(dx, dz);
        if (len < 1e-6) return false;

        const dt = Number.isFinite(delta) && delta > 0 ? Math.min(delta, 0.1) : 0.016;
        const ndx = dx / len;
        const ndz = dz / len;
        const cur = { x: this.player.position.x, z: this.player.position.z };
        const cand = {
            x: cur.x + ndx * this.moveSpeed * dt,
            z: cur.z + ndz * this.moveSpeed * dt
        };
        const clamped = this.navGrid.clampWalkable(cand, cur, this.unlockedDoorIds);
        const movedDist = Math.hypot(clamped.x - cur.x, clamped.z - cur.z);

        this.player.position.set(clamped.x, 0, clamped.z);
        this.targetPos.set(clamped.x, 0, clamped.z);
        this.faceDirection(ndx, ndz);
        return movedDist > 1e-5;
    }

    faceDirection(dx, dz) {
        if (!this.player || (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6)) return;
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - this.player.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.player.rotation.y += diff * 0.25;
    }

    updateWalkPose(delta) {
        this.walkCycle += delta * 12;
        const swing = Math.sin(this.walkCycle);

        if (this.playerModel && this.playerModel.animState) {
            const anim = this.playerModel.animState;
            if (anim.leftLeg) anim.leftLeg.rotation.x = swing * 0.55;
            if (anim.rightLeg) anim.rightLeg.rotation.x = -swing * 0.55;
            if (anim.leftArm) anim.leftArm.rotation.x = -swing * 0.45;
            if (anim.rightArm) anim.rightArm.rotation.x = swing * 0.45;
            if (anim.torso) anim.torso.position.y = Math.abs(swing) * 0.06;
            if (anim.cape) anim.cape.rotation.x = 0.28 + Math.abs(swing) * 0.12;

            if (anim.tail) {
                anim.tail.rotation.x = -0.18 + Math.abs(swing) * 0.12;
                anim.tail.rotation.y = Math.sin(this.walkCycle * 0.5) * 0.25;
                const segs = anim.tail.userData?.segments;
                if (segs) {
                    for (let i = 0; i < segs.length; i++) {
                        const seg = segs[i];
                        const base = seg.userData.baseRot;
                        seg.rotation.z = base.z + Math.sin(this.walkCycle * 0.8 - i * 0.65) * 0.12;
                        seg.rotation.x = base.x + Math.cos(this.walkCycle - i * 0.5) * 0.08;
                    }
                }
            }
        }

        this.footstepTimer += delta;
        if (this.footstepTimer > 0.28) {
            sound.playStep();
            this.footstepTimer = 0;
        }
    }

    updatePlayerLocomotion(delta) {
        if (!this.player) return;

        // Keep Mage crystal/orb & character breathing ticking on EVERY frame (even while moving)
        if (this.playerModel) {
            this.playerModel.update(delta);
        }

        if (this.isInputBlocked()) {
            this.keysPressed.clear();
            this.isMoving = false;
            return;
        }

        const keyDir = resolveKeyboardDirection(this.keysPressed);
        let movedThisFrame = false;

        if (keyDir.x !== 0 || keyDir.z !== 0) {
            this.path = [];
            const cur = { x: this.player.position.x, z: this.player.position.z };
            const cand = {
                x: cur.x + keyDir.x * this.moveSpeed * delta,
                z: cur.z + keyDir.z * this.moveSpeed * delta
            };
            const clamped = this.navGrid.clampWalkable(cand, cur, this.unlockedDoorIds);
            const stepMoved = Math.hypot(clamped.x - cur.x, clamped.z - cur.z);

            this.player.position.set(clamped.x, 0, clamped.z);
            this.targetPos.set(clamped.x, 0, clamped.z);
            this.faceDirection(keyDir.x, keyDir.z);
            this.isMoving = true;
            movedThisFrame = stepMoved > 1e-4;
        } else if (this.isMoving && this.path.length > 0) {
            let remainingStep = this.moveSpeed * delta;
            let cur = { x: this.player.position.x, z: this.player.position.z };

            while (this.path.length > 0 && remainingStep > 1e-4) {
                const wp = this.path[0];
                const dx = wp.x - cur.x;
                const dz = wp.z - cur.z;
                const dist = Math.hypot(dx, dz);

                if (dist <= 0.14) {
                    this.path.shift();
                    continue;
                }

                const step = Math.min(dist, remainingStep);
                const dirX = dx / dist;
                const dirZ = dz / dist;
                const cand = { x: cur.x + dirX * step, z: cur.z + dirZ * step };
                const clamped = this.navGrid.clampWalkable(cand, cur, this.unlockedDoorIds);
                const actualMoved = Math.hypot(clamped.x - cur.x, clamped.z - cur.z);

                this.faceDirection(dirX, dirZ);
                cur = clamped;
                remainingStep -= step;

                if (actualMoved < 1e-4 && step > 0.01) {
                    // Blocked against obstacle/closed door
                    this.path = [];
                    break;
                }
                movedThisFrame = movedThisFrame || actualMoved > 1e-4;
                if (dist <= step + 0.05) {
                    this.path.shift();
                }
            }

            this.player.position.set(cur.x, 0, cur.z);
            if (this.path.length === 0) {
                this.isMoving = false;
                this.targetPos.set(cur.x, 0, cur.z);
            }
        } else if (this.isMoving && this.player.position.distanceTo(this.targetPos) > 0.15) {
            // Legacy fallback if targetPos set directly
            const cur = { x: this.player.position.x, z: this.player.position.z };
            const dx = this.targetPos.x - cur.x;
            const dz = this.targetPos.z - cur.z;
            const dist = Math.hypot(dx, dz);
            const step = Math.min(dist, this.moveSpeed * delta);
            const clamped = this.navGrid.clampWalkable(
                { x: cur.x + (dx / dist) * step, z: cur.z + (dz / dist) * step },
                cur,
                this.unlockedDoorIds
            );
            this.faceDirection(dx / dist, dz / dist);
            this.player.position.set(clamped.x, 0, clamped.z);
            movedThisFrame = Math.hypot(clamped.x - cur.x, clamped.z - cur.z) > 1e-4;
            if (!movedThisFrame) this.isMoving = false;
        } else {
            this.isMoving = false;
            this.path = [];
        }

        if (this.isMoving && movedThisFrame) {
            this.updateWalkPose(delta);
        } else {
            const anim = this.playerModel?.animState;
            if (anim?.leftLeg) anim.leftLeg.rotation.x *= 0.8;
            if (anim?.rightLeg) anim.rightLeg.rotation.x *= 0.8;
        }

        // Room discovery & fog-of-war progression
        const disc = stepRoomDiscovery(this.discoveryState, this.player.position, this.navGrid);
        if (disc.room) {
            this.currentRoom = disc.room;
            if (disc.firstDiscovery) {
                sound.playRoomDiscover();
                music.triggerStinger('discover');
                const ratio = Math.min(1, this.discoveredRoomIds.size / Math.max(1, this.rooms.length));
                music.setTension(0.2 + ratio * 0.65);
                this.refreshVisibilityAndLights(delta, true);
                this.callbacks.onRoomEnter?.(disc.room, { firstDiscovery: true });
            } else if (disc.enteredRoom) {
                this.callbacks.onRoomEnter?.(disc.room, { firstDiscovery: false });
            }
        }

        // Check encounter triggers
        this.checkEncounterProximity(movedThisFrame || this.isMoving);
    }

    checkEncounterProximity(isActivelyMoving = false) {
        if (!this.player || this.isInputBlocked()) return;
        const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (nowMs < this._respawnGraceUntil) return;

        // Clear cooldown entries once player walks outside trigger radius + 0.55
        for (const [id, cd] of this.cooldownMap.entries()) {
            const item = this.interactables.find((i) => i.enc.id === id);
            if (!item) {
                this.cooldownMap.delete(id);
                continue;
            }
            const dist = Math.hypot(
                this.player.position.x - item.enc.pos.x,
                this.player.position.z - item.enc.pos.z
            );
            const r = Number.isFinite(item.enc.triggerRadius) ? item.enc.triggerRadius : 2.1;
            const untilMs = typeof cd === 'number' ? cd : (cd?.untilMs || 0);
            if (nowMs >= untilMs && dist > r + 0.55) {
                this.cooldownMap.delete(id);
            }
        }

        // Optional inner core step-on trap check when bypassed or non-disarmable
        if (typeof this.callbacks.onTrapStep === 'function') {
            for (const item of this.interactables) {
                const enc = item.enc;
                if (enc.kind !== 'trap' || enc.resolved || enc.trapState !== 'armed') continue;
                if (this.activeEncounterId === enc.id) continue;
                const dist = Math.hypot(
                    this.player.position.x - enc.pos.x,
                    this.player.position.z - enc.pos.z
                );
                const bypassedPrompt = this.cooldownMap.has(enc.id) || enc.disarmable === false;
                if (dist <= 0.85 && bypassedPrompt) {
                    const hasLos = this.navGrid.hasLineOfSight(this.player.position, enc.pos, {
                        includeClosedDoors: true,
                        unlockedDoorIds: this.unlockedDoorIds
                    });
                    if (hasLos) {
                        enc.trapState = 'triggered';
                        enc.resolved = true;
                        updateTrapPropVisual(item.propEntry, 'triggered', 0, this.elapsedTime);
                        if (item.beacon) item.beacon.visible = false;
                        this.callbacks.onTrapStep(enc, enc.damage || 12);
                        return;
                    }
                }
            }
        }

        const triggerable = filterTriggerableEncounters({
            encounters: this.encounters,
            playerPos: this.player.position,
            currentRoomId: this.currentRoom?.id || null,
            navGrid: this.navGrid,
            unlockedDoorIds: this.unlockedDoorIds,
            activeEncounterId: this.activeEncounterId,
            cooldownMap: this.cooldownMap,
            nowMs,
            isMoving: isActivelyMoving
        });

        if (triggerable.length > 0) {
            const enc = triggerable[0];
            this.activeEncounterId = enc.id;
            this.isMoving = false;
            this.path = [];
            this.keysPressed.clear();
            this.targetPos.copy(this.player.position);
            this.onEncounterTrigger?.(enc);
        }
    }

    resolveEncounterVisual(encounterId, success, opts = {}) {
        const item = this.interactables.find((i) => i.enc.id === encounterId);
        const enc = item ? item.enc : this.encounters.find((e) => e.id === encounterId);
        if (!enc) return;

        const res = applyEncounterResolution(enc, success, opts);
        this.activeEncounterId = null;
        const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

        if (enc.kind === 'door' || enc.retryable) {
            if (res.unlockDoorId) {
                this.unlockDoor(res.unlockDoorId, opts);
                if (item?.beacon) item.beacon.visible = false;
                this.refreshVisibilityAndLights(0, false);
            } else {
                if (!opts?.suppressSfx) sound.playDoorLocked();
                this.callbacks.onEncounterFail?.(enc);
                // Gentle South/back step (<= 0.45 clamped) + brief cooldown so retry works smoothly
                if (this.player && this.navGrid) {
                    const cur = { x: this.player.position.x, z: this.player.position.z };
                    let dx = cur.x - enc.pos.x;
                    let dz = cur.z - enc.pos.z;
                    const len = Math.hypot(dx, dz);
                    if (len < 1e-4) {
                        dx = 0;
                        dz = 1;
                    } else {
                        dx /= len;
                        dz /= len;
                    }
                    const nudged = this.navGrid.clampWalkable(
                        { x: cur.x + dx * 0.42, z: cur.z + dz * 0.42 },
                        cur,
                        this.unlockedDoorIds
                    );
                    this.player.position.set(nudged.x, 0, nudged.z);
                    this.targetPos.set(nudged.x, 0, nudged.z);
                }
                this.isMoving = false;
                this.path = [];
                this.cooldownMap.set(enc.id, { untilMs: nowMs + 550, requireMoveOrExit: true });
            }
            return;
        }

        if (enc.kind === 'trap') {
            if (item?.propEntry) {
                updateTrapPropVisual(item.propEntry, enc.trapState, 0, this.elapsedTime);
            }
            if (item?.beacon) item.beacon.visible = false;
            if (success === false) {
                this.callbacks.onEncounterFail?.(enc);
            }
            this.refreshVisibilityAndLights(0, false);
            return;
        }

        if (enc.kind === 'exit') {
            if (res.resolved) {
                if (item?.propEntry) item.propEntry.opened = true;
                if (item?.beacon) item.beacon.visible = false;
                this.refreshVisibilityAndLights(0, false);
                this.callbacks.onFloorVictory?.(enc);
            } else {
                this.callbacks.onEncounterFail?.(enc);
                this.cooldownMap.set(enc.id, { untilMs: nowMs + 700, requireMoveOrExit: true });
            }
            return;
        }

        // Combat, Shrine & fallback encounters
        if (res.resolved) {
            if (enc.kind === 'combat' && item?.propEntry?.group) {
                item.propEntry.group.visible = false;
            }
            if (enc.kind === 'shrine' && item?.propEntry) {
                if (item.propEntry.lid) item.propEntry.lid.position.set(0.6, 0.79, 0.4);
                if (item.propEntry.waterMat) item.propEntry.waterMat.color.setHex(0x1e3a4c);
            }
            if (item?.beacon) item.beacon.visible = false;
            this.refreshVisibilityAndLights(0, false);
        } else {
            this.clearActiveEncounter();
            this.callbacks.onEncounterFail?.(enc);
        }
    }

    unlockDoor(doorId, opts = {}) {
        if (!doorId) return;
        this.unlockedDoorIds.add(doorId);
        this.navGrid = buildNavGrid(this.floor, this.unlockedDoorIds);

        const doorEntry = this.doorEntries.find((d) => d.doorId === doorId);
        if (doorEntry) {
            doorEntry.isOpen = true;
            if (!this.renderer) {
                updateDoorPropVisual(doorEntry, true, 1);
            }
        }

        const item = this.interactables.find((i) => i.enc.doorId === doorId);
        if (item) {
            item.enc.resolved = true;
            if (item.beacon) item.beacon.visible = false;
        }

        if (!opts?.suppressSfx) {
            sound.playDoorOpen();
        }
        this.callbacks.onDoorUnlock?.(doorId);
    }

    respawnAtEntrance() {
        const sp = this.floor?.spawnPoint || { x: 0, z: 21 };
        if (this.player) {
            this.player.position.set(sp.x, 0, sp.z);
            this.player.rotation.y = 0;
        }
        this.targetPos.set(sp.x, 0, sp.z);
        this.path = [];
        this.isMoving = false;
        this.keysPressed.clear();
        this.activeEncounterId = null;

        const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this._respawnGraceUntil = nowMs + 600;

        this.discoveryState.currentRoomId = 'entrance';
        this.discoveryState.lastRoomId = 'entrance';
        this.currentRoom = this.rooms.find((r) => r.id === 'entrance') || null;

        if (this.camera) {
            this.camera.position.set(sp.x, 14, sp.z + 10);
            this.camera.lookAt(sp.x, 1.0, sp.z);
        }
        if (this.moonLightTarget && this.moonLight) {
            this.moonLightTarget.position.set(sp.x, 0, sp.z);
            this.moonLight.position.set(sp.x + 10, 20, sp.z + 10);
        }
        this.updatePooledLights(this.elapsedTime);
    }

    clearActiveEncounter() {
        if (this.activeEncounterId) {
            const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
            this.cooldownMap.set(this.activeEncounterId, {
                untilMs: nowMs + 1000,
                requireMoveOrExit: true
            });
        }
        this.activeEncounterId = null;
        this.isMoving = false;
        this.path = [];
        if (this.player) {
            this.targetPos.copy(this.player.position);
        }
    }

    getCurrentRoom() {
        if (!this.player || !this.navGrid) return this.currentRoom || null;
        return this.navGrid.getRoomAt(this.player.position.x, this.player.position.z);
    }

    getDiscoveredRooms() {
        return this.rooms.filter((r) => this.discoveredRoomIds.has(r.id));
    }

    getRunSummary() {
        const cur = this.getCurrentRoom();
        return {
            currentRoomId: cur ? cur.id : null,
            discoveredRooms: Array.from(this.discoveredRoomIds),
            clearedEncounters: this.encounters.filter((e) => e.resolved).map((e) => e.id),
            floorId: this.floor.id
        };
    }

    setPaused(paused) {
        this.paused = Boolean(paused);
        if (this.paused) {
            this.keysPressed.clear();
            this.isMoving = false;
            this.path = [];
            if (this.player) {
                this.targetPos.copy(this.player.position);
            }
        }
    }

    dispose() {
        this.disposed = true;
        if (this.rafId !== null) {
            if (typeof cancelAnimationFrame === 'function') {
                cancelAnimationFrame(this.rafId);
            }
            this.rafId = null;
        }
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        if (typeof window !== 'undefined') {
            if (this._onResize) window.removeEventListener('resize', this._onResize);
            if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
            if (this._onKeyUp) window.removeEventListener('keyup', this._onKeyUp);
            if (this._onBlur) window.removeEventListener('blur', this._onBlur);
        }
        if (this.renderer?.domElement && this._onPointerDown) {
            this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
        }
        if (this.scene) {
            disposeObject3D(this.scene);
        }
        if (this.renderer) {
            this.renderer.dispose?.();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
        if (typeof window !== 'undefined' && window.__dungeonWorld === this) {
            delete window.__dungeonWorld;
        }
        this.interactables = [];
        this.doorEntries = [];
        this.walkableFloorMeshes = [];
        this.clickableEncounterMeshes = [];
        this.envLightPool = [];
        this.keysPressed.clear();
    }

    animate() {
        if (this.disposed) return;
        this.rafId = requestAnimationFrame(() => this.animate());

        const rawDelta = this.clock.getDelta();
        const frameDelta = Math.min(Number.isFinite(rawDelta) ? rawDelta : 0.016, 0.40);
        this.elapsedTime += frameDelta;
        const time = this.elapsedTime;
        const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

        // 1. Sub-step player locomotion (<= 0.045s steps) so real-time speed & trigger radii hold at any FPS
        const subSteps = Math.max(1, Math.ceil(frameDelta / 0.045));
        const subDelta = frameDelta / subSteps;
        for (let s = 0; s < subSteps; s++) {
            this.updatePlayerLocomotion(subDelta);
            if (this.activeEncounterId || this.isInputBlocked()) break;
        }
        const delta = frameDelta;

        // 2. Smooth camera follow & shadow-camera tracking across entire Floor 1
        if (this.player && this.camera) {
            const targetCamX = this.player.position.x;
            const targetCamZ = this.player.position.z + 10;
            const followAlpha = 1 - Math.exp(-18 * delta);
            this.camera.position.x += (targetCamX - this.camera.position.x) * followAlpha;
            this.camera.position.z += (targetCamZ - this.camera.position.z) * followAlpha;
            this.camera.lookAt(this.player.position.x, 1.0, this.player.position.z);

            if (this.moonLightTarget && this.moonLight) {
                this.moonLightTarget.position.set(this.player.position.x, 0, this.player.position.z);
                this.moonLight.position.set(this.player.position.x + 10, 20, this.player.position.z + 10);
                this.moonLightTarget.updateMatrixWorld();
            }
        }

        // 3. Universal player torch flicker (gentle so idle peripheral RMS stays < 5.0)
        if (this.playerTorchLight) {
            const flicker = Math.sin(time * 7.5) * 0.25 + Math.cos(time * 13.0) * 0.12;
            this.playerTorchLight.intensity = 22.0 + flicker;
            if (this.playerTorchFlame) {
                const s = 1.0 + flicker * 0.08;
                this.playerTorchFlame.scale.set(1, s, 1);
            }
        }

        // 4. Shroud fade & pooled environmental lights
        this.refreshVisibilityAndLights(delta, false);

        for (let i = 0; i < this.torchEntries.length; i++) {
            const t = this.torchEntries[i];
            if (t.discovered && t.flame) {
                const f = 1.0 + Math.sin(time * 7.0 + i * 1.9) * 0.12;
                t.flame.scale.set(1, f, 1);
            }
        }

        // 5. Door opening animation
        for (const doorEntry of this.doorEntries) {
            updateDoorPropVisual(doorEntry, doorEntry.isOpen, delta);
        }

        // 6. Monsters, traps, shrines, exit seal, and beacons
        const blocked = this.isInputBlocked();
        for (let i = 0; i < this.interactables.length; i++) {
            const item = this.interactables[i];
            const enc = item.enc;

            if (item.beacon && item.beacon.visible) {
                item.beacon.rotation.y += delta * 1.8;
                item.beacon.position.y = 2.4 + Math.sin(time * 3.0 + i) * 0.10;
            }

            if (!item.group.visible) continue;

            if (enc.kind === 'combat' && !enc.resolved && item.propEntry) {
                if (!blocked && this.player) {
                    const step = stepMonsterAggro(
                        {
                            pos: enc.pos,
                            homePos: item.homePos,
                            roomId: enc.roomId,
                            aggroRadius: enc.aggroRadius,
                            triggerRadius: enc.triggerRadius,
                            rotationY: item.rotationY,
                            resolved: enc.resolved
                        },
                        this.player.position,
                        this.currentRoom?.id || null,
                        item.roomBounds,
                        this.navGrid,
                        delta,
                        this.unlockedDoorIds
                    );
                    if (step.isAggro && !item.isAggro && nowMs - item.lastGrowlMs > 4000) {
                        sound.playMonsterGrowl();
                        item.lastGrowlMs = nowMs;
                    }
                    item.isAggro = step.isAggro;
                    item.rotationY = step.rotationY;
                    enc.pos.x = step.pos.x;
                    enc.pos.z = step.pos.z;
                    item.group.position.set(step.pos.x, 0, step.pos.z);
                    item.propEntry.group.rotation.y = step.rotationY;
                }
                updateOverworldMonster(item.propEntry, delta, time, item.isAggro);
            } else if (enc.kind === 'trap' && item.propEntry) {
                updateTrapPropVisual(item.propEntry, enc.trapState || 'armed', delta, time);
            } else if (enc.kind === 'exit' && item.propEntry) {
                if (item.propEntry.crownOrb) {
                    item.propEntry.crownOrb.rotation.y += delta * 1.4;
                    item.propEntry.crownOrb.position.y = 1.26 + Math.sin(time * 2.2) * 0.06;
                }
                if (item.propEntry.orbitRing) {
                    item.propEntry.orbitRing.rotation.z += delta * 0.9;
                }
            } else if (enc.kind === 'shrine' && item.propEntry?.ring && item.propEntry.shrineType === 'monolith') {
                item.propEntry.ring.rotation.z += delta * 1.1;
            }
        }

        // 7. Crypt dust motes
        if (this.dustMotes) {
            this.dustMotes.update(delta, time);
        }

        // 8. Reticle fade
        if (this.clickReticle && this.clickReticle.material.opacity > 0) {
            this.clickReticle.material.opacity = Math.max(0, this.clickReticle.material.opacity - delta * 1.5);
            this.clickReticle.scale.multiplyScalar(0.98);
        }

        this.renderer.render(this.scene, this.camera);
    }
}
