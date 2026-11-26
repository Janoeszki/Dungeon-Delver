/**
 * Floor 1 Spatial Topology, Wall Cutaway Generator, Validator & 2D Nav-Grid / A*
 * Pure ES module with zero DOM or Three.js dependencies.
 */

const PLAYER_RADIUS = 0.30;

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

function createRng(seed) {
    if (seed === null || seed === undefined) {
        return Math.random;
    }
    let h = 2166136261 >>> 0;
    const str = String(seed);
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    // Avalanche bits so close integer/string seeds diverge cleanly
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;

    let state = (h >>> 0) || 0x9e3779b9;
    return function mulberry32() {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function boundsOverlapArea(a, b) {
    const ox = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
    const oz = Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));
    return ox * oz;
}

function pointInBounds(x, z, bounds) {
    return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}

function pointToAABBMinDistSq(x, z, box) {
    const closestX = Math.max(box.minX, Math.min(x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
    const dx = x - closestX;
    const dz = z - closestZ;
    return dx * dx + dz * dz;
}

function circleIntersectsAABB(x, z, r, box) {
    return pointToAABBMinDistSq(x, z, box) < (r * r - 1e-9);
}

function segmentIntersectsAABB(ax, az, bx, bz, box) {
    let tMin = 0;
    let tMax = 1;
    const dx = bx - ax;
    const dz = bz - az;

    if (Math.abs(dx) < 1e-12) {
        if (ax < box.minX || ax > box.maxX) return false;
    } else {
        const inv = 1 / dx;
        let t1 = (box.minX - ax) * inv;
        let t2 = (box.maxX - ax) * inv;
        if (t1 > t2) {
            const tmp = t1;
            t1 = t2;
            t2 = tmp;
        }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return false;
    }

    if (Math.abs(dz) < 1e-12) {
        if (az < box.minZ || az > box.maxZ) return false;
    } else {
        const inv = 1 / dz;
        let t1 = (box.minZ - az) * inv;
        let t2 = (box.maxZ - az) * inv;
        if (t1 > t2) {
            const tmp = t1;
            t1 = t2;
            t2 = tmp;
        }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return false;
    }

    return tMin <= tMax;
}

function segmentToAABBMinDistSq(ax, az, bx, bz, box) {
    if (segmentIntersectsAABB(ax, az, bx, bz, box)) return 0;

    let minDistSq = Math.min(
        pointToAABBMinDistSq(ax, az, box),
        pointToAABBMinDistSq(bx, bz, box)
    );

    const dx = bx - ax;
    const dz = bz - az;
    const lenSq = dx * dx + dz * dz;
    if (lenSq <= 1e-18) return minDistSq;

    if (Math.abs(dx) > 1e-12) {
        const tMinX = (box.minX - ax) / dx;
        if (tMinX > 0 && tMinX < 1) {
            const d = pointToAABBMinDistSq(ax + dx * tMinX, az + dz * tMinX, box);
            if (d < minDistSq) minDistSq = d;
        }
        const tMaxX = (box.maxX - ax) / dx;
        if (tMaxX > 0 && tMaxX < 1) {
            const d = pointToAABBMinDistSq(ax + dx * tMaxX, az + dz * tMaxX, box);
            if (d < minDistSq) minDistSq = d;
        }
    }

    if (Math.abs(dz) > 1e-12) {
        const tMinZ = (box.minZ - az) / dz;
        if (tMinZ > 0 && tMinZ < 1) {
            const d = pointToAABBMinDistSq(ax + dx * tMinZ, az + dz * tMinZ, box);
            if (d < minDistSq) minDistSq = d;
        }
        const tMaxZ = (box.maxZ - az) / dz;
        if (tMaxZ > 0 && tMaxZ < 1) {
            const d = pointToAABBMinDistSq(ax + dx * tMaxZ, az + dz * tMaxZ, box);
            if (d < minDistSq) minDistSq = d;
        }
    }

    const corners = [
        [box.minX, box.minZ],
        [box.minX, box.maxZ],
        [box.maxX, box.minZ],
        [box.maxX, box.maxZ]
    ];
    for (let i = 0; i < 4; i++) {
        const cx = corners[i][0];
        const cz = corners[i][1];
        const t = ((cx - ax) * dx + (cz - az) * dz) / lenSq;
        if (t > 0 && t < 1) {
            const d = pointToAABBMinDistSq(ax + dx * t, az + dz * t, box);
            if (d < minDistSq) minDistSq = d;
        }
    }

    return minDistSq;
}

function computeDoorBox(door, gridSize = 1.0) {
    const halfThick = 0.5 * gridSize;
    const halfWidth = door.width / 2;
    if (door.axis === 'z') {
        return {
            minX: door.x - halfThick,
            maxX: door.x + halfThick,
            minZ: door.z - halfWidth,
            maxZ: door.z + halfWidth
        };
    }
    return {
        minX: door.x - halfWidth,
        maxX: door.x + halfWidth,
        minZ: door.z - halfThick,
        maxZ: door.z + halfThick
    };
}

/**
 * Generates non-overlapping, gap-free perimeter walls around rooms and corridors
 * using greedy 2D rectangle merging, marking all South-facing walls for camera cutaway.
 */
export function generateWalls(rooms, corridors, gridSize = 1.0) {
    const rects = [...rooms.map((r) => r.bounds), ...corridors.map((c) => c.bounds)];
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const r of rects) {
        if (r.minX < minX) minX = r.minX;
        if (r.maxX > maxX) maxX = r.maxX;
        if (r.minZ < minZ) minZ = r.minZ;
        if (r.maxZ > maxZ) maxZ = r.maxZ;
    }

    const minGX = Math.floor(minX / gridSize) - 1;
    const maxGX = Math.ceil(maxX / gridSize) + 1;
    const minGZ = Math.floor(minZ / gridSize) - 1;
    const maxGZ = Math.ceil(maxZ / gridSize) + 1;
    const cols = maxGX - minGX;
    const rows = maxGZ - minGZ;

    const floorMask = new Uint8Array(cols * rows);
    const idxOf = (cx, cz) => cz * cols + cx;

    for (let cz = 0; cz < rows; cz++) {
        const wz = (minGZ + cz + 0.5) * gridSize;
        for (let cx = 0; cx < cols; cx++) {
            const wx = (minGX + cx + 0.5) * gridSize;
            for (const r of rects) {
                if (wx >= r.minX && wx <= r.maxX && wz >= r.minZ && wz <= r.maxZ) {
                    floorMask[idxOf(cx, cz)] = 1;
                    break;
                }
            }
        }
    }

    const isFloor = (cx, cz) => {
        if (cx < 0 || cz < 0 || cx >= cols || cz >= rows) return false;
        return floorMask[idxOf(cx, cz)] === 1;
    };

    // 0 = empty, 1 = south cutaway (height 1.2, isSouthFace true), 2 = tall (height 4.0, isSouthFace false)
    const wallCategory = new Uint8Array(cols * rows);
    for (let cz = 0; cz < rows; cz++) {
        for (let cx = 0; cx < cols; cx++) {
            if (isFloor(cx, cz)) continue;

            let touchesFloor = false;
            for (let dz = -1; dz <= 1 && !touchesFloor; dz++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dz === 0) continue;
                    if (isFloor(cx + dx, cz + dz)) {
                        touchesFloor = true;
                        break;
                    }
                }
            }
            if (!touchesFloor) continue;

            const directSouth = isFloor(cx, cz - 1);
            const corridorFlankSouth =
                (isFloor(cx, cz - 2) || isFloor(cx, cz - 3)) && !isFloor(cx, cz + 1);
            const outerBottomCorner =
                ((isFloor(cx - 1, cz - 1) && !isFloor(cx - 1, cz)) ||
                    (isFloor(cx + 1, cz - 1) && !isFloor(cx + 1, cz))) &&
                !isFloor(cx, cz - 1) &&
                !isFloor(cx, cz + 1);

            wallCategory[idxOf(cx, cz)] =
                directSouth || corridorFlankSouth || outerBottomCorner ? 1 : 2;
        }
    }

    const walls = [];
    for (const targetCat of [1, 2]) {
        const visited = new Uint8Array(cols * rows);
        const isSouthFace = targetCat === 1;
        const height = isSouthFace ? 1.2 : 4.0;

        for (let cz = 0; cz < rows; cz++) {
            for (let cx = 0; cx < cols; cx++) {
                const startIdx = idxOf(cx, cz);
                if (wallCategory[startIdx] !== targetCat || visited[startIdx]) continue;

                let endX = cx + 1;
                while (
                    endX < cols &&
                    wallCategory[idxOf(endX, cz)] === targetCat &&
                    !visited[idxOf(endX, cz)]
                ) {
                    endX++;
                }

                let endZ = cz + 1;
                outer: while (endZ < rows) {
                    for (let x = cx; x < endX; x++) {
                        const i = idxOf(x, endZ);
                        if (wallCategory[i] !== targetCat || visited[i]) {
                            break outer;
                        }
                    }
                    endZ++;
                }

                for (let z = cz; z < endZ; z++) {
                    for (let x = cx; x < endX; x++) {
                        visited[idxOf(x, z)] = 1;
                    }
                }

                walls.push({
                    minX: (minGX + cx) * gridSize,
                    maxX: (minGX + endX) * gridSize,
                    minZ: (minGZ + cz) * gridSize,
                    maxZ: (minGZ + endZ) * gridSize,
                    height,
                    isSouthFace
                });
            }
        }
    }

    return walls;
}

const CANONICAL_ROOMS = [
    {
        id: 'entrance',
        name: 'Cracked Threshold',
        role: 'entrance',
        inhabitantType: 'none',
        bounds: { minX: -2, maxX: 2, minZ: 18, maxZ: 24 },
        discoveredInitially: true,
        whisper: 'Cold crypt air seeps from the cracked flagstones beneath your boots; somewhere ahead, iron chains drag across stone.',
        ambientTint: 0x1a2030,
        torchSpots: [
            { x: -1.5, z: 18.6, color: 0xff8833, intensity: 1.1 }
        ],
        propAnchors: [
            { type: 'bone_pile', x: 1.3, z: 22.8 },
            { type: 'cobweb', x: -1.6, z: 18.4 }
        ]
    },
    {
        id: 'room_1_foyer',
        name: 'Hall of Fallen Torchbearers',
        role: 'entry_room',
        inhabitantType: 'none',
        bounds: { minX: -5, maxX: 5, minZ: 4, maxZ: 14 },
        discoveredInitially: false,
        whisper: 'Gutter-burned sconces line this drowned hall, where pale water pools around shattered vigil statues.',
        ambientTint: 0x1b2436,
        torchSpots: [
            { x: -4.4, z: 4.6, color: 0xff9933, intensity: 1.3 },
            { x: 4.4, z: 4.6, color: 0xff9933, intensity: 1.3 }
        ],
        propAnchors: [
            { type: 'skull_stack', x: 4.0, z: 12.6 },
            { type: 'chains', x: -4.2, z: 5.0 },
            { type: 'bloodstain', x: 0.4, z: 9.0 }
        ]
    },
    {
        id: 'room_2_blades',
        name: 'Gallery of Swinging Blades',
        role: 'chamber',
        inhabitantType: 'trap',
        bounds: { minX: 9, maxX: 17, minZ: 5, maxZ: 13 },
        discoveredInitially: false,
        whisper: 'Deep crescent gouges scar the flagstones, and the slow metallic rasp of unseen chains echoes above.',
        ambientTint: 0x261a1e,
        torchSpots: [
            { x: 16.4, z: 5.6, color: 0xff7722, intensity: 1.2 }
        ],
        propAnchors: [
            { type: 'chains', x: 16.2, z: 5.4 },
            { type: 'bloodstain', x: 13.2, z: 9.2 },
            { type: 'bone_pile', x: 10.0, z: 12.0 }
        ]
    },
    {
        id: 'room_2b_runes',
        name: 'Chamber of Weeping Runes',
        role: 'chamber',
        inhabitantType: 'trap',
        bounds: { minX: -17, maxX: -9, minZ: 5, maxZ: 13 },
        discoveredInitially: false,
        whisper: 'Crimson sigils pulse through dried mire on the floor, drinking the warmth from the stagnant air.',
        ambientTint: 0x2a141d,
        torchSpots: [
            { x: -16.4, z: 5.6, color: 0xdc2626, intensity: 1.15 }
        ],
        propAnchors: [
            { type: 'bloodstain', x: -13.0, z: 9.0 },
            { type: 'skull_stack', x: -16.0, z: 12.0 },
            { type: 'cobweb', x: -10.0, z: 5.5 }
        ]
    },
    {
        id: 'room_3_charnel',
        name: 'The Charnel Ossuary',
        role: 'chamber',
        inhabitantType: 'monster',
        bounds: { minX: -5, maxX: 5, minZ: -8, maxZ: 0 },
        discoveredInitially: false,
        whisper: 'Hollow ribs and rusted halberds litter the ossuary; something armored in dry bone stirs in the dark.',
        ambientTint: 0x1e222e,
        torchSpots: [
            { x: -4.4, z: -7.4, color: 0xff8822, intensity: 1.25 },
            { x: 4.4, z: -7.4, color: 0xff8822, intensity: 1.25 }
        ],
        propAnchors: [
            { type: 'skull_stack', x: -4.0, z: -1.0 },
            { type: 'bone_pile', x: 4.0, z: -6.8 },
            { type: 'chains', x: -4.2, z: -7.2 }
        ]
    },
    {
        id: 'room_3b_crypt',
        name: 'Gnawed Bone Alcove',
        role: 'chamber',
        inhabitantType: 'monster',
        bounds: { minX: 9, maxX: 17, minZ: -8, maxZ: 0 },
        discoveredInitially: false,
        whisper: 'The stench of rot chokes the alcove, punctuated by wet crunching and ragged claws scraping slate.',
        ambientTint: 0x1b261d,
        torchSpots: [
            { x: 16.4, z: -7.4, color: 0x84cc16, intensity: 1.1 }
        ],
        propAnchors: [
            { type: 'bone_pile', x: 15.8, z: -1.0 },
            { type: 'bloodstain', x: 12.6, z: -4.2 },
            { type: 'skull_stack', x: 10.0, z: -7.0 }
        ]
    },
    {
        id: 'room_4_cistern',
        name: 'Flooded Spike Cistern',
        role: 'chamber',
        inhabitantType: 'trap',
        bounds: { minX: -5, maxX: 5, minZ: -20, maxZ: -12 },
        discoveredInitially: false,
        whisper: 'Black brine hides rusted iron teeth beneath cracked paving stones that groan under any weight.',
        ambientTint: 0x17222b,
        torchSpots: [
            { x: -4.4, z: -19.4, color: 0x38bdf8, intensity: 1.1 },
            { x: 4.4, z: -19.4, color: 0xff8833, intensity: 1.2 }
        ],
        propAnchors: [
            { type: 'skull_stack', x: -4.0, z: -13.0 },
            { type: 'chains', x: 4.2, z: -19.2 },
            { type: 'cobweb', x: 4.0, z: -13.0 }
        ]
    },
    {
        id: 'room_4b_gauntlet',
        name: 'Iron Dart Gallery',
        role: 'chamber',
        inhabitantType: 'trap',
        bounds: { minX: 9, maxX: 17, minZ: -20, maxZ: -12 },
        discoveredInitially: false,
        whisper: 'Hollow stone skulls leer from the walls, their dark mouths cocked with hair-trigger tension.',
        ambientTint: 0x241d22,
        torchSpots: [
            { x: 16.4, z: -19.4, color: 0xff6622, intensity: 1.15 }
        ],
        propAnchors: [
            { type: 'skull_stack', x: 16.0, z: -19.0 },
            { type: 'bloodstain', x: 13.0, z: -15.8 },
            { type: 'bone_pile', x: 10.2, z: -13.0 }
        ]
    },
    {
        id: 'room_5_lair',
        name: 'Weaver’s Bone Lair',
        role: 'chamber',
        inhabitantType: 'monster',
        bounds: { minX: -17, maxX: -9, minZ: -20, maxZ: -12 },
        discoveredInitially: false,
        whisper: 'Thick gray silk cocoons hang from the ceiling beams, twitching faintly as chittering legs click overhead.',
        ambientTint: 0x1e1829,
        torchSpots: [
            { x: -16.4, z: -19.4, color: 0xa855f7, intensity: 1.1 }
        ],
        propAnchors: [
            { type: 'cobweb', x: -16.2, z: -19.2 },
            { type: 'cobweb', x: -10.0, z: -13.0 },
            { type: 'bone_pile', x: -15.8, z: -13.2 }
        ]
    },
    {
        id: 'room_6_sanctum',
        name: 'Sanctum of the Phusza Seal',
        role: 'sanctum',
        inhabitantType: 'monster',
        bounds: { minX: -5, maxX: 5, minZ: -34, maxZ: -24 },
        discoveredInitially: false,
        whisper: 'Spectral frost clings to the ancient seal ahead, where a hollow wraith keeps silent vigil over the descent.',
        ambientTint: 0x161224,
        torchSpots: [
            { x: -4.4, z: -33.4, color: 0x6366f1, intensity: 1.3 },
            { x: 4.4, z: -33.4, color: 0x6366f1, intensity: 1.3 }
        ],
        propAnchors: [
            { type: 'chains', x: -4.2, z: -25.0 },
            { type: 'chains', x: 4.2, z: -25.0 },
            { type: 'skull_stack', x: -4.0, z: -33.0 },
            { type: 'bloodstain', x: 0, z: -28.0 }
        ]
    }
];

const CANONICAL_CORRIDORS = [
    {
        id: 'corridor_entrance_foyer',
        bounds: { minX: -1, maxX: 1, minZ: 14, maxZ: 18 },
        connects: ['entrance', 'room_1_foyer']
    },
    {
        id: 'corridor_foyer_blades',
        bounds: { minX: 5, maxX: 9, minZ: 8, maxZ: 10 },
        connects: ['room_1_foyer', 'room_2_blades']
    },
    {
        id: 'corridor_foyer_runes',
        bounds: { minX: -9, maxX: -5, minZ: 8, maxZ: 10 },
        connects: ['room_1_foyer', 'room_2b_runes']
    },
    {
        id: 'corridor_foyer_charnel',
        bounds: { minX: -1, maxX: 1, minZ: 0, maxZ: 4 },
        connects: ['room_1_foyer', 'room_3_charnel']
    },
    {
        id: 'corridor_charnel_crypt',
        bounds: { minX: 5, maxX: 9, minZ: -5, maxZ: -3 },
        connects: ['room_3_charnel', 'room_3b_crypt']
    },
    {
        id: 'corridor_charnel_cistern',
        bounds: { minX: -1, maxX: 1, minZ: -12, maxZ: -8 },
        connects: ['room_3_charnel', 'room_4_cistern']
    },
    {
        id: 'corridor_cistern_gauntlet',
        bounds: { minX: 5, maxX: 9, minZ: -17, maxZ: -15 },
        connects: ['room_4_cistern', 'room_4b_gauntlet']
    },
    {
        id: 'corridor_cistern_lair',
        bounds: { minX: -9, maxX: -5, minZ: -17, maxZ: -15 },
        connects: ['room_4_cistern', 'room_5_lair']
    },
    {
        id: 'corridor_cistern_sanctum',
        bounds: { minX: -1, maxX: 1, minZ: -24, maxZ: -20 },
        connects: ['room_4_cistern', 'room_6_sanctum']
    }
];

const CANONICAL_DOORS = [
    {
        id: 'door_portcullis',
        x: 0,
        z: 1.5,
        width: 2,
        axis: 'x',
        connects: ['room_1_foyer', 'room_3_charnel'],
        initiallyLocked: true,
        encounterId: 'portcullis'
    },
    {
        id: 'door_sanctum',
        x: 0,
        z: -22.5,
        width: 2,
        axis: 'x',
        connects: ['room_4_cistern', 'room_6_sanctum'],
        initiallyLocked: true,
        encounterId: 'sanctum_gate'
    }
];

const CANONICAL_WALLS = generateWalls(CANONICAL_ROOMS, CANONICAL_CORRIDORS, 1.0);

export const FLOOR_1 = deepFreeze({
    id: 1,
    name: 'Floor 1: The Charnel Threshold',
    gridSize: 1.0,
    spawnPoint: { x: 0, z: 21 },
    rooms: CANONICAL_ROOMS,
    corridors: CANONICAL_CORRIDORS,
    doors: CANONICAL_DOORS,
    walls: CANONICAL_WALLS
});

const MONSTER_WHISPERS = [
    'Something breathes raggedly in the gloom ahead, dragging rusted iron over bone.',
    'Low snarls vibrate through the damp masonry as hollow eyes fix upon your torchlight.',
    'A cold, predatory stillness hangs here—teeth and claws wait just beyond the lantern edge.'
];

const TRAP_WHISPERS = [
    'Hairline fractures crisscross the flagstones; the click of concealed springs lurks below.',
    'Scoured arcs in the dust and dried blood along the molding warn of a lethal mechanism.',
    'A sour chemical tang and taut wire glint faintly across the shadowed stone floor.'
];

/**
 * Creates a fresh deep-cloned Floor 1 layout object.
 * When `randomizeThemes: true`, reassigns `'monster'` vs `'trap'` across post-entry
 * chambers deterministically from `seed` while preserving strict room invariants.
 */
export function createFloor1Layout(options = {}) {
    const { seed = null, randomizeThemes = false } = options || {};
    const layout = deepClone(FLOOR_1);

    if (randomizeThemes) {
        const rng = createRng(seed);
        const postRooms = layout.rooms.filter(
            (r) => r.role === 'chamber' || r.role === 'sanctum'
        );

        const minCount = Math.min(2, Math.floor(postRooms.length / 2));
        const monsterCount =
            postRooms.length >= 6
                ? 3 + Math.floor(rng() * (postRooms.length - 5)) // 3..postRooms.length-3
                : Math.max(minCount, Math.floor(postRooms.length / 2));

        const bag = [];
        for (let i = 0; i < postRooms.length; i++) {
            bag.push(i < monsterCount ? 'monster' : 'trap');
        }
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            const tmp = bag[i];
            bag[i] = bag[j];
            bag[j] = tmp;
        }

        postRooms.forEach((room, index) => {
            const prevType = room.inhabitantType;
            const nextType = bag[index];
            room.inhabitantType = nextType;
            if (nextType !== prevType) {
                if (nextType === 'monster') {
                    room.ambientTint = 0x1b202d;
                    room.whisper = MONSTER_WHISPERS[index % MONSTER_WHISPERS.length];
                } else {
                    room.ambientTint = 0x28181f;
                    room.whisper = TRAP_WHISPERS[index % TRAP_WHISPERS.length];
                }
            }
        });
    }

    return layout;
}

/**
 * Builds a 2D nav-grid with A* pathfinding, wall/door collision, line-of-sight,
 * and unobstructed approach vector computation.
 */
export function buildNavGrid(layout, unlockedDoorIds = new Set()) {
    const gridSize =
        layout && Number.isFinite(layout.gridSize) && layout.gridSize > 0
            ? layout.gridSize
            : 1.0;

    const normalizeUnlocked = (doorsArg) => {
        if (doorsArg instanceof Set) return doorsArg;
        if (Array.isArray(doorsArg)) return new Set(doorsArg);
        if (doorsArg && typeof doorsArg[Symbol.iterator] === 'function') {
            return new Set(doorsArg);
        }
        return new Set();
    };

    const defaultUnlocked = normalizeUnlocked(unlockedDoorIds);
    const rooms = Array.isArray(layout?.rooms) ? layout.rooms : [];
    const corridors = Array.isArray(layout?.corridors) ? layout.corridors : [];
    const walls = Array.isArray(layout?.walls) ? layout.walls : [];
    const doors = Array.isArray(layout?.doors) ? layout.doors : [];
    const spawnPoint = layout?.spawnPoint || { x: 0, z: 0 };

    const floorRects = [
        ...rooms.map((r) => r.bounds),
        ...corridors.map((c) => c.bounds)
    ];

    const doorRecords = doors.map((door) => ({
        id: door.id,
        initiallyLocked: Boolean(door.initiallyLocked),
        box: computeDoorBox(door, gridSize)
    }));

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const r of [...floorRects, ...walls]) {
        if (r.minX < minX) minX = r.minX;
        if (r.maxX > maxX) maxX = r.maxX;
        if (r.minZ < minZ) minZ = r.minZ;
        if (r.maxZ > maxZ) maxZ = r.maxZ;
    }
    if (!Number.isFinite(minX)) {
        minX = -1;
        maxX = 1;
        minZ = -1;
        maxZ = 1;
    }

    const minGX = Math.floor(minX / gridSize) - 1;
    const maxGX = Math.ceil(maxX / gridSize) + 1;
    const minGZ = Math.floor(minZ / gridSize) - 1;
    const maxGZ = Math.ceil(maxZ / gridSize) + 1;
    const cols = maxGX - minGX;
    const rows = maxGZ - minGZ;

    // 0 = blocked/void/wall, 1 = walkable, 2 = closed_door
    const cells = new Uint8Array(cols * rows);
    const idxOf = (cx, cz) => cz * cols + cx;
    const inGrid = (cx, cz) => cx >= 0 && cz >= 0 && cx < cols && cz < rows;

    const isInsideFloor = (x, z) => {
        for (const r of floorRects) {
            if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
                return true;
            }
        }
        return false;
    };

    const isPositionValid = (x, z, unlockedSet = defaultUnlocked, radius = PLAYER_RADIUS) => {
        if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
        if (!isInsideFloor(x, z)) return false;
        for (const w of walls) {
            if (circleIntersectsAABB(x, z, radius, w)) return false;
        }
        for (const d of doorRecords) {
            if (d.initiallyLocked && !unlockedSet.has(d.id)) {
                if (circleIntersectsAABB(x, z, radius, d.box)) return false;
            }
        }
        return true;
    };

    for (let cz = 0; cz < rows; cz++) {
        const wz = (minGZ + cz + 0.5) * gridSize;
        for (let cx = 0; cx < cols; cx++) {
            const wx = (minGX + cx + 0.5) * gridSize;
            if (!isInsideFloor(wx, wz)) continue;

            let wallHit = false;
            for (const w of walls) {
                if (circleIntersectsAABB(wx, wz, PLAYER_RADIUS, w)) {
                    wallHit = true;
                    break;
                }
            }
            if (wallHit) continue;

            let closedDoorHit = false;
            for (const d of doorRecords) {
                if (d.initiallyLocked && !defaultUnlocked.has(d.id)) {
                    if (
                        (wx >= d.box.minX && wx <= d.box.maxX && wz >= d.box.minZ && wz <= d.box.maxZ) ||
                        circleIntersectsAABB(wx, wz, PLAYER_RADIUS, d.box)
                    ) {
                        closedDoorHit = true;
                        break;
                    }
                }
            }
            cells[idxOf(cx, cz)] = closedDoorHit ? 2 : 1;
        }
    }

    const worldToGrid = (x, z) => ({
        cx: Math.floor(x / gridSize) - minGX,
        cz: Math.floor(z / gridSize) - minGZ
    });

    const gridToWorld = (cx, cz) => ({
        x: (minGX + cx + 0.5) * gridSize,
        z: (minGZ + cz + 0.5) * gridSize
    });

    const isWalkableWorld = (x, z) => isPositionValid(x, z, defaultUnlocked, PLAYER_RADIUS);

    const getRoomAt = (x, z) => {
        if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
        for (const room of rooms) {
            if (pointInBounds(x, z, room.bounds)) {
                return room;
            }
        }
        return null;
    };

    const hasLineOfSight = (posA, posB, options = {}) => {
        if (
            !posA ||
            !posB ||
            !Number.isFinite(posA.x) ||
            !Number.isFinite(posA.z) ||
            !Number.isFinite(posB.x) ||
            !Number.isFinite(posB.z)
        ) {
            return false;
        }
        const {
            includeClosedDoors = true,
            unlockedDoorIds: optUnlocked,
            ignoreDoorIds = null,
            step = 0.25
        } = options || {};

        const unlockedSet =
            optUnlocked !== undefined ? normalizeUnlocked(optUnlocked) : defaultUnlocked;
        const ignoreSet =
            ignoreDoorIds instanceof Set
                ? ignoreDoorIds
                : Array.isArray(ignoreDoorIds)
                    ? new Set(ignoreDoorIds)
                    : null;

        for (const w of walls) {
            if (segmentIntersectsAABB(posA.x, posA.z, posB.x, posB.z, w)) {
                return false;
            }
        }

        if (includeClosedDoors) {
            for (const d of doorRecords) {
                if (d.initiallyLocked && !unlockedSet.has(d.id)) {
                    if (ignoreSet && ignoreSet.has(d.id)) continue;
                    if (segmentIntersectsAABB(posA.x, posA.z, posB.x, posB.z, d.box)) {
                        return false;
                    }
                }
            }
        }

        const dx = posB.x - posA.x;
        const dz = posB.z - posA.z;
        const dist = Math.hypot(dx, dz);
        const samples = Math.max(1, Math.ceil(dist / Math.max(0.05, step)));
        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const sx = posA.x + dx * t;
            const sz = posA.z + dz * t;
            if (!isInsideFloor(sx, sz)) {
                return false;
            }
        }
        return true;
    };

    const segmentValid = (a, b, unlockedSet = defaultUnlocked) => {
        if (!isPositionValid(b.x, b.z, unlockedSet, PLAYER_RADIUS)) return false;
        const epsR = PLAYER_RADIUS - 1e-6;
        const epsRSq = epsR * epsR;
        for (const w of walls) {
            if (segmentToAABBMinDistSq(a.x, a.z, b.x, b.z, w) < epsRSq) return false;
        }
        for (const d of doorRecords) {
            if (d.initiallyLocked && !unlockedSet.has(d.id)) {
                if (segmentToAABBMinDistSq(a.x, a.z, b.x, b.z, d.box) < epsRSq) return false;
            }
        }

        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        const samples = Math.max(1, Math.ceil(dist / 0.25));
        for (let i = 1; i <= samples; i++) {
            const t = i / samples;
            if (!isPositionValid(a.x + dx * t, a.z + dz * t, unlockedSet, PLAYER_RADIUS)) {
                return false;
            }
        }
        return true;
    };

    const findNearestWalkableCell = (wx, wz, maxRadius = 1) => {
        const base = worldToGrid(wx, wz);
        if (inGrid(base.cx, base.cz) && cells[idxOf(base.cx, base.cz)] === 1) {
            return base;
        }
        let best = null;
        let bestDist = Infinity;
        for (let dz = -maxRadius; dz <= maxRadius; dz++) {
            for (let dx = -maxRadius; dx <= maxRadius; dx++) {
                const nx = base.cx + dx;
                const nz = base.cz + dz;
                if (!inGrid(nx, nz) || cells[idxOf(nx, nz)] !== 1) continue;
                const center = gridToWorld(nx, nz);
                const d = (center.x - wx) ** 2 + (center.z - wz) ** 2;
                if (d < bestDist) {
                    bestDist = d;
                    best = { cx: nx, cz: nz };
                }
            }
        }
        return best;
    };

    const findPath = (startPos, goalPos, options = {}) => {
        if (
            !startPos ||
            !goalPos ||
            !Number.isFinite(startPos.x) ||
            !Number.isFinite(startPos.z) ||
            !Number.isFinite(goalPos.x) ||
            !Number.isFinite(goalPos.z)
        ) {
            return [];
        }
        const { snapGoal = false, unlockedDoorIds = null } = options || {};
        if (unlockedDoorIds !== null && unlockedDoorIds !== undefined) {
            return buildNavGrid(layout, unlockedDoorIds).findPath(startPos, goalPos, {
                snapGoal
            });
        }

        let startCell = worldToGrid(startPos.x, startPos.z);
        if (!inGrid(startCell.cx, startCell.cz) || cells[idxOf(startCell.cx, startCell.cz)] !== 1) {
            // Allow snapping from a walkable boundary point onto its nearest walkable grid cell
            startCell = findNearestWalkableCell(startPos.x, startPos.z, 1);
        }
        if (!startCell) return [];

        let goalCell = worldToGrid(goalPos.x, goalPos.z);
        const goalInsideValid = isPositionValid(
            goalPos.x,
            goalPos.z,
            defaultUnlocked,
            PLAYER_RADIUS
        );
        if (!inGrid(goalCell.cx, goalCell.cz) || cells[idxOf(goalCell.cx, goalCell.cz)] !== 1) {
            if (goalInsideValid) {
                goalCell = findNearestWalkableCell(goalPos.x, goalPos.z, 1);
            } else if (snapGoal) {
                goalCell = findNearestWalkableCell(goalPos.x, goalPos.z, 1);
            } else {
                return [];
            }
        }
        if (!goalCell) return [];

        const startIdx = idxOf(startCell.cx, startCell.cz);
        const goalIdx = idxOf(goalCell.cx, goalCell.cz);

        if (startIdx === goalIdx) {
            if (goalInsideValid && segmentValid(startPos, goalPos, defaultUnlocked)) {
                return [{ x: goalPos.x, z: goalPos.z }];
            }
            return [gridToWorld(goalCell.cx, goalCell.cz)];
        }

        const total = cols * rows;
        const gScore = new Float64Array(total);
        gScore.fill(Infinity);
        const parent = new Int32Array(total);
        parent.fill(-1);
        const closed = new Uint8Array(total);

        const heuristic = (cx, cz) => {
            const adx = Math.abs(cx - goalCell.cx);
            const adz = Math.abs(cz - goalCell.cz);
            return Math.max(adx, adz) + (Math.SQRT2 - 1) * Math.min(adx, adz);
        };

        // Min-heap of { idx, f }
        const heap = [];
        const pushHeap = (idx, f) => {
            heap.push({ idx, f });
            let i = heap.length - 1;
            while (i > 0) {
                const p = (i - 1) >> 1;
                if (heap[p].f <= heap[i].f) break;
                const tmp = heap[p];
                heap[p] = heap[i];
                heap[i] = tmp;
                i = p;
            }
        };
        const popHeap = () => {
            const top = heap[0];
            const last = heap.pop();
            if (heap.length > 0) {
                heap[0] = last;
                let i = 0;
                const n = heap.length;
                while (true) {
                    let smallest = i;
                    const l = 2 * i + 1;
                    const r = 2 * i + 2;
                    if (l < n && heap[l].f < heap[smallest].f) smallest = l;
                    if (r < n && heap[r].f < heap[smallest].f) smallest = r;
                    if (smallest === i) break;
                    const tmp = heap[i];
                    heap[i] = heap[smallest];
                    heap[smallest] = tmp;
                    i = smallest;
                }
            }
            return top;
        };

        gScore[startIdx] = 0;
        pushHeap(startIdx, heuristic(startCell.cx, startCell.cz));

        const dirs = [
            [0, -1, 1],
            [1, 0, 1],
            [0, 1, 1],
            [-1, 0, 1],
            [1, -1, Math.SQRT2],
            [1, 1, Math.SQRT2],
            [-1, 1, Math.SQRT2],
            [-1, -1, Math.SQRT2]
        ];

        let found = false;
        while (heap.length > 0) {
            const current = popHeap();
            const cIdx = current.idx;
            if (closed[cIdx]) continue;
            if (cIdx === goalIdx) {
                found = true;
                break;
            }
            closed[cIdx] = 1;

            const cx = cIdx % cols;
            const cz = (cIdx - cx) / cols;

            for (const [dx, dz, stepCost] of dirs) {
                const nx = cx + dx;
                const nz = cz + dz;
                if (!inGrid(nx, nz)) continue;
                const nIdx = idxOf(nx, nz);
                if (closed[nIdx] || cells[nIdx] !== 1) continue;

                // Strictly forbid diagonal corner-cutting past walls or closed doors
                if (dx !== 0 && dz !== 0) {
                    if (cells[idxOf(cx + dx, cz)] !== 1 || cells[idxOf(cx, cz + dz)] !== 1) {
                        continue;
                    }
                }

                const tentativeG = gScore[cIdx] + stepCost;
                if (tentativeG < gScore[nIdx]) {
                    gScore[nIdx] = tentativeG;
                    parent[nIdx] = cIdx;
                    pushHeap(nIdx, tentativeG + heuristic(nx, nz));
                }
            }
        }

        if (!found) return [];

        const cellIndices = [];
        let trace = goalIdx;
        while (trace !== -1 && trace !== startIdx) {
            cellIndices.push(trace);
            trace = parent[trace];
        }
        cellIndices.reverse();

        const waypoints = cellIndices.map((idx) => {
            const cx = idx % cols;
            const cz = (idx - cx) / cols;
            return gridToWorld(cx, cz);
        });

        if (waypoints.length > 0 && goalInsideValid) {
            const prevAnchor =
                waypoints.length >= 2 ? waypoints[waypoints.length - 2] : startPos;
            if (segmentValid(prevAnchor, goalPos, defaultUnlocked)) {
                waypoints[waypoints.length - 1] = { x: goalPos.x, z: goalPos.z };
            }
        }

        return waypoints;
    };

    const binaryPushAlong = (fromPt, toPt, unlockedSet) => {
        let lo = 0;
        let hi = 1;
        for (let i = 0; i < 12; i++) {
            const mid = (lo + hi) * 0.5;
            const cand = {
                x: fromPt.x + (toPt.x - fromPt.x) * mid,
                z: fromPt.z + (toPt.z - fromPt.z) * mid
            };
            if (segmentValid(fromPt, cand, unlockedSet)) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        return {
            x: fromPt.x + (toPt.x - fromPt.x) * lo,
            z: fromPt.z + (toPt.z - fromPt.z) * lo
        };
    };

    const clampWithoutPrev = (targetPos, unlockedSet) => {
        if (isPositionValid(targetPos.x, targetPos.z, unlockedSet, PLAYER_RADIUS)) {
            return { x: targetPos.x, z: targetPos.z };
        }
        // Clamp onto nearest room/corridor interior (shrunk by PLAYER_RADIUS) and verify
        let best = null;
        let bestDist = Infinity;
        for (const r of floorRects) {
            const minRx = r.minX + PLAYER_RADIUS;
            const maxRx = r.maxX - PLAYER_RADIUS;
            const minRz = r.minZ + PLAYER_RADIUS;
            const maxRz = r.maxZ - PLAYER_RADIUS;
            if (minRx > maxRx || minRz > maxRz) continue;
            const cx = Math.max(minRx, Math.min(targetPos.x, maxRx));
            const cz = Math.max(minRz, Math.min(targetPos.z, maxRz));
            if (isPositionValid(cx, cz, unlockedSet, PLAYER_RADIUS)) {
                const d = (cx - targetPos.x) ** 2 + (cz - targetPos.z) ** 2;
                if (d < bestDist) {
                    bestDist = d;
                    best = { x: cx, z: cz };
                }
            }
        }
        if (best) return best;

        // Fallback to nearest walkable grid cell center
        for (let cz = 0; cz < rows; cz++) {
            for (let cx = 0; cx < cols; cx++) {
                if (cells[idxOf(cx, cz)] !== 1) continue;
                const pt = gridToWorld(cx, cz);
                if (!isPositionValid(pt.x, pt.z, unlockedSet, PLAYER_RADIUS)) continue;
                const d = (pt.x - targetPos.x) ** 2 + (pt.z - targetPos.z) ** 2;
                if (d < bestDist) {
                    bestDist = d;
                    best = pt;
                }
            }
        }
        return best || { x: spawnPoint.x, z: spawnPoint.z };
    };

    const clampWalkable = (pos, prevPos, optUnlocked) => {
        const unlockedSet =
            optUnlocked !== undefined && optUnlocked !== null
                ? normalizeUnlocked(optUnlocked)
                : defaultUnlocked;

        const prevValid =
            prevPos &&
            Number.isFinite(prevPos.x) &&
            Number.isFinite(prevPos.z) &&
            isPositionValid(prevPos.x, prevPos.z, unlockedSet, PLAYER_RADIUS);

        if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) {
            if (prevValid) return { x: prevPos.x, z: prevPos.z };
            return { x: spawnPoint.x, z: spawnPoint.z };
        }

        if (prevValid) {
            if (segmentValid(prevPos, pos, unlockedSet)) {
                return { x: pos.x, z: pos.z };
            }

            // Smooth wall sliding: try X-only, then Z-only
            const xOnly = { x: pos.x, z: prevPos.z };
            if (Math.abs(pos.x - prevPos.x) > 1e-6 && segmentValid(prevPos, xOnly, unlockedSet)) {
                return xOnly;
            }

            const zOnly = { x: prevPos.x, z: pos.z };
            if (Math.abs(pos.z - prevPos.z) > 1e-6 && segmentValid(prevPos, zOnly, unlockedSet)) {
                return zOnly;
            }

            // Head-on or blocked corner: move flush up to the obstacle without crossing it
            return binaryPushAlong(prevPos, pos, unlockedSet);
        }

        return clampWithoutPrev(pos, unlockedSet);
    };

    const computeApproachPoint = (fromPos, targetPos, distance = 1.5, optUnlocked) => {
        if (
            !fromPos ||
            !targetPos ||
            !Number.isFinite(fromPos.x) ||
            !Number.isFinite(fromPos.z) ||
            !Number.isFinite(targetPos.x) ||
            !Number.isFinite(targetPos.z)
        ) {
            return null;
        }

        const nav =
            optUnlocked !== undefined && optUnlocked !== null
                ? buildNavGrid(layout, optUnlocked)
                : api;

        // If targetPos itself sits inside a locked door's own box, allow LOS against that door only
        const unlockedSet =
            optUnlocked !== undefined && optUnlocked !== null
                ? normalizeUnlocked(optUnlocked)
                : defaultUnlocked;
        const doorAtTarget = [];
        for (const d of doorRecords) {
            if (d.initiallyLocked && !unlockedSet.has(d.id)) {
                if (
                    targetPos.x >= d.box.minX - 0.15 &&
                    targetPos.x <= d.box.maxX + 0.15 &&
                    targetPos.z >= d.box.minZ - 0.15 &&
                    targetPos.z <= d.box.maxZ + 0.15
                ) {
                    doorAtTarget.push(d.id);
                }
            }
        }

        const dx = fromPos.x - targetPos.x;
        const dz = fromPos.z - targetPos.z;
        const len = Math.hypot(dx, dz);
        const baseDirX = len > 1e-6 ? dx / len : 0;
        const baseDirZ = len > 1e-6 ? dz / len : 1;

        const baseAngle = Math.atan2(baseDirZ, baseDirX);
        const anglesDeg = [0, 30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180];
        const distances = [distance, Math.max(0.8, distance * 0.75), 1.0].filter(
            (v, idx, arr) => v > 0 && arr.indexOf(v) === idx
        );

        let bestCandidate = null;
        let bestScore = Infinity;

        for (const distOpt of distances) {
            for (const deg of anglesDeg) {
                const rad = baseAngle + (deg * Math.PI) / 180;
                const cand = {
                    x: targetPos.x + Math.cos(rad) * distOpt,
                    z: targetPos.z + Math.sin(rad) * distOpt
                };

                if (!nav.isWalkableWorld(cand.x, cand.z)) continue;
                if (
                    !nav.hasLineOfSight(cand, targetPos, {
                        includeClosedDoors: true,
                        ignoreDoorIds: doorAtTarget.length > 0 ? doorAtTarget : null
                    })
                ) {
                    continue;
                }

                const path = nav.findPath(fromPos, cand);
                if (path.length === 0) continue;

                let pathDist = 0;
                let prev = fromPos;
                for (const wp of path) {
                    pathDist += Math.hypot(wp.x - prev.x, wp.z - prev.z);
                    prev = wp;
                }

                const penalty = Math.abs(distOpt - distance) * 2 + Math.abs(deg) * 0.002;
                const score = pathDist + penalty;
                if (score < bestScore) {
                    bestScore = score;
                    bestCandidate = cand;
                }
            }
        }

        return bestCandidate;
    };

    const api = {
        gridSize,
        playerRadius: PLAYER_RADIUS,
        minGX,
        maxGX,
        minGZ,
        maxGZ,
        cols,
        rows,
        cells,
        isWalkableWorld,
        findPath,
        clampWalkable,
        getRoomAt,
        hasLineOfSight,
        computeApproachPoint
    };

    return api;
}

/**
 * Strictly validates a Floor 1 layout against structural, camera-cutaway,
 * monster-or-trap exclusivity, wall non-overlap, door gating, and reachability invariants.
 */
export function validateFloor1(layout) {
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

    // Check pairwise non-overlapping rooms
    for (let i = 0; i < layout.rooms.length; i++) {
        for (let j = i + 1; j < layout.rooms.length; j++) {
            const ra = layout.rooms[i];
            const rb = layout.rooms[j];
            if (ra?.bounds && rb?.bounds && boundsOverlapArea(ra.bounds, rb.bounds) > 1e-6) {
                errors.push(`Rooms ${ra.id} and ${rb.id} overlap.`);
            }
        }
    }

    // Entrance & entry_room validation
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
                errors.push(`Entrance ${ent.id} footprint (${w}x${d}) is too large for a small entrance.`);
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
            const entCenterZ = (ent.bounds.minZ + ent.bounds.maxZ) / 2;
            const entryCenterZ = (entry.bounds.minZ + entry.bounds.maxZ) / 2;
            if (entryCenterZ >= entCenterZ) {
                errors.push(`Entry room ${entry.id} must lie North (-Z) of entrance.`);
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

    // Post-entry chambers & sanctum strict mutual exclusion
    if (postEntryRooms.length < 5) {
        errors.push(`Expected at least 5 post-entry rooms following entry_room, found ${postEntryRooms.length}.`);
    }
    const sanctums = postEntryRooms.filter((r) => r.role === 'sanctum');
    if (sanctums.length !== 1) {
        errors.push(`Expected exactly 1 'sanctum' room, found ${sanctums.length}.`);
    }

    let monsterCount = 0;
    let trapCount = 0;
    for (const room of postEntryRooms) {
        if (room.role !== 'chamber' && room.role !== 'sanctum') {
            errors.push(`Post-entry room ${room.id} has invalid role '${room.role}'.`);
        }
        if (room.discoveredInitially !== false) {
            errors.push(`Post-entry room ${room.id} must start undiscovered (discoveredInitially: false).`);
        }
        if (Array.isArray(room.inhabitantTypes)) {
            errors.push(`Room ${room.id} must use strict single inhabitantType, not inhabitantTypes array.`);
        }
        if (room.inhabitantType === 'monster') {
            monsterCount++;
        } else if (room.inhabitantType === 'trap') {
            trapCount++;
        } else {
            errors.push(
                `Room ${room.id} must have exclusive inhabitantType 'monster' or 'trap', got '${room.inhabitantType}'.`
            );
        }
    }

    if (monsterCount < 2) {
        errors.push(`Floor 1 must contain multiple monster rooms (>= 2), found ${monsterCount}.`);
    }
    if (trapCount < 2) {
        errors.push(`Floor 1 must contain multiple trap rooms (>= 2), found ${trapCount}.`);
    }

    // Validate corridors & doors
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

    // Validate walls: zero overlap, South-face cutaway <= 1.4
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

    // Verify all South perimeter walls touching any room or corridor South edge are low cutaway walls
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

    // Graph connectivity BFS across corridors
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

    // Nav-grid full unlocked reachability + locked door blocking check
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
                    errors.push(`Room ${room.id} center (${cx}, ${cz}) is unreachable via A* even when all doors are unlocked.`);
                }
            }
        }

        // Verify locked doors actually block rooms cut off in the locked graph
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
