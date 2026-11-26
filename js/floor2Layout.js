// Floor 2 spatial topology, validator, and nav-grid re-export
import { buildNavGrid, generateWalls } from './floor1Layout.js';

export { buildNavGrid };

function deepFreeze(value) {
    if (!value || typeof value !== 'object') return value;
    Object.freeze(value);
    const values = Array.isArray(value) ? value : Object.values(value);
    for (const item of values) {
        deepFreeze(item);
    }
    return value;
}

function deepClone(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((item) => deepClone(item));
    const out = {};
    for (const key of Object.keys(value)) {
        out[key] = deepClone(value[key]);
    }
    return out;
}

function boundsOverlapArea(a, b) {
    const ox = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
    const oz = Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));
    return ox * oz;
}

function pointInBounds(x, z, bounds) {
    return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}

const CANONICAL_FLOOR2_ROOMS = [
    {
        id: 'entrance',
        name: 'Spiral Descent Landing',
        role: 'entrance',
        inhabitantType: 'none',
        bounds: { minX: -2, maxX: 2, minZ: 18, maxZ: 24 },
        discoveredInitially: true,
        whisper: 'Ancient starlight runes hum beneath damp slate steps as cold arcane drafts drift up from the Sunken Arcanum.',
        ambientTint: 0x161830,
        torchSpots: [
            { x: -1.5, z: 18.6, color: 0x38bdf8, intensity: 1.15 }
        ],
        propAnchors: [
            { type: 'rune_pillar', x: -1.3, z: 22.8 },
            { type: 'crystal_cluster', x: 1.3, z: 18.8 }
        ]
    },
    {
        id: 'f2_atrium',
        name: 'Hall of Echoing Runes',
        role: 'entry_room',
        inhabitantType: 'none',
        bounds: { minX: -5, maxX: 5, minZ: 4, maxZ: 14 },
        discoveredInitially: false,
        whisper: 'Fractured obelisks ring a submerged astral font; carved dials and wing-beats echo from opposite corridors.',
        ambientTint: 0x181c36,
        torchSpots: [
            { x: -4.4, z: 4.6, color: 0x6366f1, intensity: 1.25 },
            { x: 4.4, z: 4.6, color: 0x38bdf8, intensity: 1.25 }
        ],
        propAnchors: [
            { type: 'rune_pillar', x: 4.0, z: 12.6 },
            { type: 'crystal_cluster', x: -4.1, z: 5.0 },
            { type: 'chains', x: 4.2, z: 5.2 }
        ]
    },
    {
        id: 'f2_west_puzzle',
        name: 'Dial of the Twin Moons',
        role: 'chamber',
        inhabitantType: 'puzzle',
        bounds: { minX: -17, maxX: -9, minZ: 5, maxZ: 13 },
        discoveredInitially: false,
        whisper: 'Four lunar pedestals circle a sunken astrolabe, waiting to be struck in the order of the night sky.',
        ambientTint: 0x191a38,
        torchSpots: [
            { x: -16.4, z: 5.6, color: 0x818cf8, intensity: 1.2 }
        ],
        propAnchors: [
            { type: 'rune_pillar', x: -16.0, z: 12.0 },
            { type: 'crystal_cluster', x: -10.0, z: 5.8 },
            { type: 'skull_stack', x: -10.2, z: 12.2 }
        ]
    },
    {
        id: 'f2_east_mobs',
        name: 'Gargoyle Barracks',
        role: 'chamber',
        inhabitantType: 'monster',
        bounds: { minX: 9, maxX: 17, minZ: 5, maxZ: 13 },
        discoveredInitially: false,
        whisper: 'Shattered plinths litter the floor; obsidian wings unfold with a grinding rasp of stone on stone.',
        ambientTint: 0x261a24,
        torchSpots: [
            { x: 16.4, z: 5.6, color: 0xf59e0b, intensity: 1.2 }
        ],
        propAnchors: [
            { type: 'bone_pile', x: 15.8, z: 12.0 },
            { type: 'chains', x: 16.0, z: 5.8 },
            { type: 'skull_stack', x: 10.0, z: 12.0 }
        ]
    },
    {
        id: 'f2_central_hall',
        name: 'Vault of Mirrors',
        role: 'chamber',
        inhabitantType: 'puzzle',
        bounds: { minX: -5, maxX: 5, minZ: -8, maxZ: 0 },
        discoveredInitially: false,
        whisper: 'Three crystalline prisms stand out of alignment, refracting stray beams of azure starlight across the vault.',
        ambientTint: 0x132036,
        torchSpots: [
            { x: -4.4, z: -7.4, color: 0x38bdf8, intensity: 1.25 },
            { x: 4.4, z: -7.4, color: 0x38bdf8, intensity: 1.25 }
        ],
        propAnchors: [
            { type: 'crystal_cluster', x: -4.0, z: -1.0 },
            { type: 'crystal_cluster', x: 4.0, z: -6.8 },
            { type: 'rune_pillar', x: -4.2, z: -7.0 }
        ]
    },
    {
        id: 'f2_west_crypt',
        name: 'Cursed Reliquary',
        role: 'chamber',
        inhabitantType: 'monster',
        bounds: { minX: -17, maxX: -9, minZ: -8, maxZ: 0 },
        discoveredInitially: false,
        whisper: 'Runic ward-plates flare beneath heavy metal boots as an armored sentinel raises its glowing blade.',
        ambientTint: 0x1a1e34,
        torchSpots: [
            { x: -16.4, z: -7.4, color: 0x60a5fa, intensity: 1.2 }
        ],
        propAnchors: [
            { type: 'rune_pillar', x: -15.8, z: -1.0 },
            { type: 'chains', x: -10.2, z: -7.0 },
            { type: 'bone_pile', x: -16.0, z: -6.8 }
        ]
    },
    {
        id: 'f2_east_crypt',
        name: 'Blighted Alchemist Cellar',
        role: 'chamber',
        inhabitantType: 'monster',
        bounds: { minX: 9, maxX: 17, minZ: -8, maxZ: 0 },
        discoveredInitially: false,
        whisper: 'A caustic green sludge bubbles around splintered alembics, suspending half-dissolved bones in its core.',
        ambientTint: 0x15261c,
        torchSpots: [
            { x: 16.4, z: -7.4, color: 0x84cc16, intensity: 1.15 }
        ],
        propAnchors: [
            { type: 'bone_pile', x: 15.8, z: -1.0 },
            { type: 'bloodstain', x: 12.8, z: -4.2 },
            { type: 'crystal_cluster', x: 10.2, z: -7.0 }
        ]
    },
    {
        id: 'f2_north_puzzle',
        name: 'Chamber of the Three Weights',
        role: 'chamber',
        inhabitantType: 'puzzle',
        bounds: { minX: -5, maxX: 5, minZ: -20, maxZ: -12 },
        discoveredInitially: false,
        whisper: 'An astral brass balance bars the northern seal, demanding exact harmonic weight before the gate yields.',
        ambientTint: 0x1f1930,
        torchSpots: [
            { x: -4.4, z: -19.4, color: 0xfbbf24, intensity: 1.2 },
            { x: 4.4, z: -19.4, color: 0x818cf8, intensity: 1.2 }
        ],
        propAnchors: [
            { type: 'rune_pillar', x: -4.0, z: -13.0 },
            { type: 'rune_pillar', x: 4.0, z: -13.0 },
            { type: 'chains', x: 4.2, z: -19.0 }
        ]
    },
    {
        id: 'f2_sanctum',
        name: 'Sanctum of the Arch-Lich',
        role: 'sanctum',
        inhabitantType: 'monster',
        bounds: { minX: -5, maxX: 5, minZ: -34, maxZ: -24 },
        discoveredInitially: false,
        whisper: 'Arcane frost crackles around a crowned undead sovereign guarding the Astral Conduit to the lower abyss.',
        ambientTint: 0x140f29,
        torchSpots: [
            { x: -4.4, z: -33.4, color: 0xa855f7, intensity: 1.35 },
            { x: 4.4, z: -33.4, color: 0x38bdf8, intensity: 1.35 }
        ],
        propAnchors: [
            { type: 'rune_pillar', x: -4.2, z: -25.0 },
            { type: 'rune_pillar', x: 4.2, z: -25.0 },
            { type: 'skull_stack', x: -4.0, z: -33.0 },
            { type: 'crystal_cluster', x: 4.0, z: -33.0 }
        ]
    }
];

const CANONICAL_FLOOR2_CORRIDORS = [
    {
        id: 'corridor_f2_entrance_atrium',
        bounds: { minX: -1, maxX: 1, minZ: 14, maxZ: 18 },
        connects: ['entrance', 'f2_atrium']
    },
    {
        id: 'corridor_f2_atrium_west',
        bounds: { minX: -9, maxX: -5, minZ: 8, maxZ: 10 },
        connects: ['f2_atrium', 'f2_west_puzzle']
    },
    {
        id: 'corridor_f2_atrium_east',
        bounds: { minX: 5, maxX: 9, minZ: 8, maxZ: 10 },
        connects: ['f2_atrium', 'f2_east_mobs']
    },
    {
        id: 'corridor_f2_atrium_mirrors',
        bounds: { minX: -1, maxX: 1, minZ: 0, maxZ: 4 },
        connects: ['f2_atrium', 'f2_central_hall']
    },
    {
        id: 'corridor_f2_mirrors_reliquary',
        bounds: { minX: -9, maxX: -5, minZ: -5, maxZ: -3 },
        connects: ['f2_central_hall', 'f2_west_crypt']
    },
    {
        id: 'corridor_f2_mirrors_cellar',
        bounds: { minX: 5, maxX: 9, minZ: -5, maxZ: -3 },
        connects: ['f2_central_hall', 'f2_east_crypt']
    },
    {
        id: 'corridor_f2_mirrors_weights',
        bounds: { minX: -1, maxX: 1, minZ: -12, maxZ: -8 },
        connects: ['f2_central_hall', 'f2_north_puzzle']
    },
    {
        id: 'corridor_f2_weights_sanctum',
        bounds: { minX: -1, maxX: 1, minZ: -24, maxZ: -20 },
        connects: ['f2_north_puzzle', 'f2_sanctum']
    }
];

const CANONICAL_FLOOR2_DOORS = [
    {
        id: 'door_f2_rune_gate',
        x: 0,
        z: 1.5,
        width: 2,
        axis: 'x',
        connects: ['f2_atrium', 'f2_central_hall'],
        initiallyLocked: true,
        encounterId: 'f2_rune_gate'
    },
    {
        id: 'door_f2_obsidian_seal',
        x: 0,
        z: -22.5,
        width: 2,
        axis: 'x',
        connects: ['f2_north_puzzle', 'f2_sanctum'],
        initiallyLocked: true,
        encounterId: 'f2_obsidian_seal'
    }
];

const CANONICAL_FLOOR2_WALLS = generateWalls(
    CANONICAL_FLOOR2_ROOMS,
    CANONICAL_FLOOR2_CORRIDORS,
    1.0
);

export const FLOOR_2 = deepFreeze({
    id: 2,
    name: 'Floor 2: The Sunken Arcanum',
    gridSize: 1.0,
    spawnPoint: { x: 0, z: 21 },
    theme: {
        background: 0x05040d,
        fogColor: 0x05040d,
        fogDensity: 0.052,
        floorTint: 0xbec8e6,
        corridorTint: 0xa6b2d4,
        wallTint: 0xb0bddc,
        dustColor: 0x818cf8
    },
    rooms: CANONICAL_FLOOR2_ROOMS,
    corridors: CANONICAL_FLOOR2_CORRIDORS,
    doors: CANONICAL_FLOOR2_DOORS,
    walls: CANONICAL_FLOOR2_WALLS
});

export function createFloor2Layout() {
    return deepClone(FLOOR_2);
}

/**
 * Validates Floor 2 layout invariants: small entrance, entry_room, >= 5 post-entry rooms
 * with strict 'monster' | 'puzzle' mutual exclusion, South cutaway <= 1.4, and nav-grid reachability.
 */
export function validateFloor2(layout) {
    const errors = [];

    if (!layout || typeof layout !== 'object') {
        return { valid: false, errors: ['Layout must be a non-null object.'] };
    }
    if (!Number.isFinite(layout.gridSize) || layout.gridSize <= 0) {
        errors.push('Layout gridSize must be a positive finite number.');
    }
    if (
        !layout.spawnPoint ||
        !Number.isFinite(layout.spawnPoint.x) ||
        !Number.isFinite(layout.spawnPoint.z)
    ) {
        errors.push('Layout must define finite spawnPoint { x, z }.');
    }
    if (!Array.isArray(layout.rooms) || layout.rooms.length === 0) {
        errors.push('Layout must define a non-empty rooms array.');
    }
    if (!Array.isArray(layout.corridors)) {
        errors.push('Layout must define a corridors array.');
    }
    if (!Array.isArray(layout.doors)) {
        errors.push('Layout must define a doors array.');
    }
    if (!Array.isArray(layout.walls) || layout.walls.length === 0) {
        errors.push('Layout must define a non-empty walls array.');
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    const roomMap = new Map();
    for (const room of layout.rooms) {
        if (!room || typeof room.id !== 'string' || !room.id) {
            errors.push('Every room must have a non-empty string id.');
            continue;
        }
        if (roomMap.has(room.id)) {
            errors.push(`Duplicate room id: ${room.id}.`);
        }
        roomMap.set(room.id, room);

        const b = room.bounds;
        if (
            !b ||
            !Number.isFinite(b.minX) ||
            !Number.isFinite(b.maxX) ||
            !Number.isFinite(b.minZ) ||
            !Number.isFinite(b.maxZ) ||
            b.minX >= b.maxX ||
            b.minZ >= b.maxZ
        ) {
            errors.push(`Room ${room.id} has invalid bounds.`);
        }
        if (typeof room.discoveredInitially !== 'boolean') {
            errors.push(`Room ${room.id} must define boolean discoveredInitially.`);
        }
    }

    for (let i = 0; i < layout.rooms.length; i++) {
        for (let j = i + 1; j < layout.rooms.length; j++) {
            const ra = layout.rooms[i];
            const rb = layout.rooms[j];
            if (ra?.bounds && rb?.bounds && boundsOverlapArea(ra.bounds, rb.bounds) > 1e-6) {
                errors.push(`Rooms ${ra.id} and ${rb.id} overlap.`);
            }
        }
    }

    const entrances = layout.rooms.filter((r) => r.role === 'entrance');
    const entryRooms = layout.rooms.filter((r) => r.role === 'entry_room');
    const postEntryRooms = layout.rooms.filter(
        (r) => r.role !== 'entrance' && r.role !== 'entry_room'
    );

    if (entrances.length !== 1) {
        errors.push(`Expected exactly 1 room with role 'entrance', found ${entrances.length}.`);
    } else {
        const ent = entrances[0];
        if (ent.inhabitantType !== 'none') {
            errors.push(`Entrance ${ent.id} must have inhabitantType === 'none'.`);
        }
        if (ent.discoveredInitially !== true) {
            errors.push(`Entrance ${ent.id} must have discoveredInitially === true.`);
        }
        if (ent.bounds) {
            const w = ent.bounds.maxX - ent.bounds.minX;
            const d = ent.bounds.maxZ - ent.bounds.minZ;
            if (w > 6 || d > 7) {
                errors.push(`Entrance ${ent.id} footprint (${w}x${d}) is too large.`);
            }
            if (!pointInBounds(layout.spawnPoint.x, layout.spawnPoint.z, ent.bounds)) {
                errors.push('spawnPoint must lie inside the entrance bounds.');
            }
        }
    }

    if (entryRooms.length !== 1) {
        errors.push(`Expected exactly 1 room with role 'entry_room', found ${entryRooms.length}.`);
    } else {
        const entry = entryRooms[0];
        if (entry.inhabitantType !== 'none') {
            errors.push(`Entry room ${entry.id} must have inhabitantType === 'none'.`);
        }
        if (entry.discoveredInitially !== false) {
            errors.push(`Entry room ${entry.id} must have discoveredInitially === false.`);
        }
        if (entrances.length === 1 && entrances[0].bounds && entry.bounds) {
            const ent = entrances[0];
            const entArea = (ent.bounds.maxX - ent.bounds.minX) * (ent.bounds.maxZ - ent.bounds.minZ);
            const entryArea = (entry.bounds.maxX - entry.bounds.minX) * (entry.bounds.maxZ - entry.bounds.minZ);
            if (entryArea <= entArea) {
                errors.push(`Entry room ${entry.id} area (${entryArea}) must exceed entrance area (${entArea}).`);
            }
            const directCorridor = layout.corridors.some(
                (c) =>
                    Array.isArray(c.connects) &&
                    ((c.connects[0] === ent.id && c.connects[1] === entry.id) ||
                        (c.connects[1] === ent.id && c.connects[0] === entry.id))
            );
            if (!directCorridor) {
                errors.push(`Entrance ${ent.id} must connect directly to entry_room ${entry.id}.`);
            }
        }
    }

    if (postEntryRooms.length < 5) {
        errors.push(`Expected at least 5 post-entry rooms following entry_room, found ${postEntryRooms.length}.`);
    }
    const sanctums = postEntryRooms.filter((r) => r.role === 'sanctum');
    if (sanctums.length !== 1) {
        errors.push(`Expected exactly 1 'sanctum' room, found ${sanctums.length}.`);
    }

    let monsterCount = 0;
    let puzzleCount = 0;
    for (const room of postEntryRooms) {
        if (room.role !== 'chamber' && room.role !== 'sanctum') {
            errors.push(`Post-entry room ${room.id} has invalid role '${room.role}'.`);
        }
        if (room.discoveredInitially !== false) {
            errors.push(`Post-entry room ${room.id} must start undiscovered.`);
        }
        if (Array.isArray(room.inhabitantTypes)) {
            errors.push(`Room ${room.id} must use strict single inhabitantType.`);
        }
        if (room.inhabitantType === 'monster') {
            monsterCount++;
        } else if (room.inhabitantType === 'puzzle') {
            puzzleCount++;
        } else {
            errors.push(
                `Room ${room.id} must have exclusive inhabitantType 'monster' or 'puzzle', got '${room.inhabitantType}'.`
            );
        }
    }

    if (monsterCount < 3) {
        errors.push(`Floor 2 must contain at least 3 monster rooms, found ${monsterCount}.`);
    }
    if (puzzleCount < 2) {
        errors.push(`Floor 2 must contain at least 2 puzzle rooms, found ${puzzleCount}.`);
    }

    const adjAll = new Map();
    for (const id of roomMap.keys()) adjAll.set(id, []);

    for (const c of layout.corridors) {
        if (!c || !c.id || !c.bounds || !Array.isArray(c.connects) || c.connects.length !== 2) {
            errors.push(`Invalid corridor entry: ${c?.id || '(unknown)'}.`);
            continue;
        }
        const [a, b] = c.connects;
        if (!roomMap.has(a) || !roomMap.has(b) || a === b) {
            errors.push(`Corridor ${c.id} has invalid connects [${a}, ${b}].`);
        } else {
            adjAll.get(a).push(b);
            adjAll.get(b).push(a);
        }
    }

    for (const d of layout.doors) {
        if (
            !d ||
            !d.id ||
            !Number.isFinite(d.x) ||
            !Number.isFinite(d.z) ||
            !Number.isFinite(d.width) ||
            d.width <= 0 ||
            (d.axis !== 'x' && d.axis !== 'z') ||
            !Array.isArray(d.connects) ||
            d.connects.length !== 2
        ) {
            errors.push(`Invalid door entry: ${d?.id || '(unknown)'}.`);
            continue;
        }
        const [a, b] = d.connects;
        if (!roomMap.has(a) || !roomMap.has(b) || a === b) {
            errors.push(`Door ${d.id} references unknown or identical rooms.`);
        }
    }

    for (let i = 0; i < layout.walls.length; i++) {
        const w = layout.walls[i];
        if (
            !w ||
            !Number.isFinite(w.minX) ||
            !Number.isFinite(w.maxX) ||
            !Number.isFinite(w.minZ) ||
            !Number.isFinite(w.maxZ) ||
            !Number.isFinite(w.height) ||
            w.minX >= w.maxX ||
            w.minZ >= w.maxZ ||
            w.height <= 0
        ) {
            errors.push(`Wall at index ${i} has invalid dimensions.`);
            continue;
        }
        if (w.isSouthFace && w.height > 1.4) {
            errors.push(`South-facing wall [${w.minX}..${w.maxX}, ${w.minZ}..${w.maxZ}] height ${w.height} exceeds 1.4.`);
        }
        for (let j = i + 1; j < layout.walls.length; j++) {
            const w2 = layout.walls[j];
            if (w2 && boundsOverlapArea(w, w2) > 1e-6) {
                errors.push(`Walls at indices ${i} and ${j} overlap.`);
            }
        }
    }

    for (const area of [...layout.rooms, ...layout.corridors]) {
        const b = area?.bounds;
        if (!b) continue;
        const kind = area.connects ? 'corridor' : 'room';
        for (const w of layout.walls) {
            const touchesSouth = Math.abs(w.minZ - b.maxZ) < 1e-6;
            const overlapsX = Math.min(w.maxX, b.maxX) > Math.max(w.minX, b.minX);
            if (touchesSouth && overlapsX) {
                if (!w.isSouthFace || w.height > 1.4) {
                    errors.push(
                        `South wall abutting ${kind} ${area.id} must have isSouthFace: true and height <= 1.4.`
                    );
                }
            }
        }
    }

    if (entrances.length === 1) {
        const visited = new Set([entrances[0].id]);
        const queue = [entrances[0].id];
        while (queue.length > 0) {
            const cur = queue.shift();
            for (const next of adjAll.get(cur) || []) {
                if (!visited.has(next)) {
                    visited.add(next);
                    queue.push(next);
                }
            }
        }
        for (const room of layout.rooms) {
            if (!visited.has(room.id)) {
                errors.push(`Room ${room.id} is disconnected from entrance in corridor graph.`);
            }
        }
    }

    if (errors.length === 0) {
        const allDoorIds = new Set(layout.doors.map((d) => d.id));
        const navUnlocked = buildNavGrid(layout, allDoorIds);
        if (!navUnlocked.isWalkableWorld(layout.spawnPoint.x, layout.spawnPoint.z)) {
            errors.push('spawnPoint is not walkable in unlocked nav-grid.');
        } else {
            for (const room of layout.rooms) {
                const cx = (room.bounds.minX + room.bounds.maxX) / 2;
                const cz = (room.bounds.minZ + room.bounds.maxZ) / 2;
                const path = navUnlocked.findPath(layout.spawnPoint, { x: cx, z: cz });
                if (path.length === 0) {
                    errors.push(`Room ${room.id} center (${cx}, ${cz}) is unreachable via A*.`);
                }
            }
        }

        const lockedEdges = new Set(
            layout.doors
                .filter((d) => d.initiallyLocked)
                .map((d) => [...d.connects].sort().join('::'))
        );
        if (lockedEdges.size > 0 && entrances.length === 1) {
            const unlockedReachableRooms = new Set([entrances[0].id]);
            const q = [entrances[0].id];
            while (q.length > 0) {
                const cur = q.shift();
                for (const next of adjAll.get(cur) || []) {
                    const edgeKey = [cur, next].sort().join('::');
                    if (lockedEdges.has(edgeKey)) continue;
                    if (!unlockedReachableRooms.has(next)) {
                        unlockedReachableRooms.add(next);
                        q.push(next);
                    }
                }
            }
            const navLocked = buildNavGrid(layout, new Set());
            for (const room of layout.rooms) {
                if (unlockedReachableRooms.has(room.id)) continue;
                const cx = (room.bounds.minX + room.bounds.maxX) / 2;
                const cz = (room.bounds.minZ + room.bounds.maxZ) / 2;
                const path = navLocked.findPath(layout.spawnPoint, { x: cx, z: cz });
                if (path.length > 0) {
                    errors.push(`Locked door(s) failed to block A* path into gated room ${room.id}.`);
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
