import test from 'node:test';
import assert from 'node:assert/strict';

import {
    FLOOR_1,
    createFloor1Layout,
    validateFloor1,
    buildNavGrid
} from '../../js/floor1Layout.js';
import {
    TRAP_ARCHETYPES,
    createFloor1Run,
    ENCOUNTERS
} from '../../js/encounters.js';

const VALID_STATS = new Set(['str', 'agi', 'int', 'vit']);
const EXPECTED_STAT_NAMES = {
    str: 'Strength',
    agi: 'Agility',
    int: 'Intelligence',
    vit: 'Vitality'
};
const VALID_MONSTERS = new Set(['skeleton', 'crypt_ghoul', 'crypt_spider', 'shadow_wraith']);
const VALID_TRAPS = new Set(['spike_pit', 'pendulum_scythe', 'dart_wall', 'blood_rune']);
const VALID_CONSUMABLES = new Set([
    'Lesser Healing Potion',
    'Greater Healing Potion',
    'Mana Draught',
    'Holy Water Flask'
]);

function aabbOverlapArea(a, b) {
    const ox = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
    const oz = Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));
    return ox * oz;
}

function segmentIntersectsBox(ax, az, bx, bz, box) {
    let tMin = 0;
    let tMax = 1;
    const dx = bx - ax;
    const dz = bz - az;

    if (Math.abs(dx) < 1e-12) {
        if (ax < box.minX || ax > box.maxX) return null;
    } else {
        const inv = 1 / dx;
        let t1 = (box.minX - ax) * inv;
        let t2 = (box.maxX - ax) * inv;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return null;
    }

    if (Math.abs(dz) < 1e-12) {
        if (az < box.minZ || az > box.maxZ) return null;
    } else {
        const inv = 1 / dz;
        let t1 = (box.minZ - az) * inv;
        let t2 = (box.maxZ - az) * inv;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return null;
    }

    return { tMin, tMax };
}

test('FLOOR_1 canonical schema, topology, metadata, and deep freeze', () => {
    assert.equal(FLOOR_1.id, 1);
    assert.equal(FLOOR_1.name, 'Floor 1: The Charnel Threshold');
    assert.equal(FLOOR_1.gridSize, 1.0);
    assert.deepEqual(FLOOR_1.spawnPoint, { x: 0, z: 21 });

    assert.equal(Object.isFrozen(FLOOR_1), true);
    assert.equal(Object.isFrozen(FLOOR_1.rooms), true);
    assert.equal(Object.isFrozen(FLOOR_1.rooms[0].bounds), true);
    assert.equal(Object.isFrozen(FLOOR_1.corridors), true);
    assert.equal(Object.isFrozen(FLOOR_1.doors), true);
    assert.equal(Object.isFrozen(FLOOR_1.walls), true);

    const entrance = FLOOR_1.rooms.find((r) => r.role === 'entrance');
    const entryRoom = FLOOR_1.rooms.find((r) => r.role === 'entry_room');
    const postEntry = FLOOR_1.rooms.filter(
        (r) => r.role !== 'entrance' && r.role !== 'entry_room'
    );
    const sanctum = FLOOR_1.rooms.find((r) => r.role === 'sanctum');

    assert.ok(entrance);
    assert.equal(entrance.id, 'entrance');
    assert.equal(entrance.inhabitantType, 'none');
    assert.equal(entrance.discoveredInitially, true);
    assert.equal(entrance.bounds.maxX - entrance.bounds.minX, 4);
    assert.equal(entrance.bounds.maxZ - entrance.bounds.minZ, 6);

    assert.ok(entryRoom);
    assert.equal(entryRoom.id, 'room_1_foyer');
    assert.equal(entryRoom.inhabitantType, 'none');
    assert.equal(entryRoom.discoveredInitially, false);
    assert.equal(entryRoom.bounds.maxX - entryRoom.bounds.minX, 10);
    assert.equal(entryRoom.bounds.maxZ - entryRoom.bounds.minZ, 10);

    assert.equal(postEntry.length, 8);
    assert.ok(sanctum);
    assert.equal(sanctum.id, 'room_6_sanctum');

    const monsters = postEntry.filter((r) => r.inhabitantType === 'monster');
    const traps = postEntry.filter((r) => r.inhabitantType === 'trap');
    assert.equal(monsters.length, 4);
    assert.equal(traps.length, 4);

    for (const room of FLOOR_1.rooms) {
        assert.equal(typeof room.whisper, 'string');
        assert.ok(room.whisper.length > 10);
        assert.equal(typeof room.ambientTint, 'number');
        assert.ok(Array.isArray(room.torchSpots) && room.torchSpots.length >= 1);
        assert.ok(Array.isArray(room.propAnchors) && room.propAnchors.length >= 2);
    }

    const doorPortcullis = FLOOR_1.doors.find((d) => d.id === 'door_portcullis');
    const doorSanctum = FLOOR_1.doors.find((d) => d.id === 'door_sanctum');
    assert.ok(doorPortcullis);
    assert.deepEqual({ x: doorPortcullis.x, z: doorPortcullis.z }, { x: 0, z: 1.5 });
    assert.equal(doorPortcullis.initiallyLocked, true);
    assert.ok(doorSanctum);
    assert.deepEqual({ x: doorSanctum.x, z: doorSanctum.z }, { x: 0, z: -22.5 });
    assert.equal(doorSanctum.initiallyLocked, true);

    assert.deepEqual(validateFloor1(FLOOR_1), { valid: true, errors: [] });
});

test('FLOOR_1 walls have zero overlap, zero perimeter gaps, low South cutaways, and clear camera sightlines', () => {
    const { walls, rooms, corridors } = FLOOR_1;
    assert.ok(walls.length > 0);

    // 1. Pairwise non-overlapping walls
    for (let i = 0; i < walls.length; i++) {
        for (let j = i + 1; j < walls.length; j++) {
            assert.equal(
                aabbOverlapArea(walls[i], walls[j]),
                0,
                `Walls ${i} and ${j} overlap`
            );
        }
    }

    // 2. Every isSouthFace wall has height <= 1.4
    const southWalls = walls.filter((w) => w.isSouthFace);
    assert.ok(southWalls.length > 0);
    for (const w of southWalls) {
        assert.ok(w.height <= 1.4, `South wall height ${w.height} exceeds 1.4`);
    }

    // 3. Zero perimeter / corner gaps on 1.0 grid around every room and corridor
    const floorRects = [...rooms.map((r) => r.bounds), ...corridors.map((c) => c.bounds)];
    const isFloorAt = (cx, cz) =>
        floorRects.some((r) => cx >= r.minX && cx <= r.maxX && cz >= r.minZ && cz <= r.maxZ);
    const isWallAt = (cx, cz) =>
        walls.some((w) => cx >= w.minX && cx <= w.maxX && cz >= w.minZ && cz <= w.maxZ);

    for (const rect of floorRects) {
        for (let gx = rect.minX - 1; gx <= rect.maxX; gx++) {
            for (let gz = rect.minZ - 1; gz <= rect.maxZ; gz++) {
                const cx = gx + 0.5;
                const cz = gz + 0.5;
                if (isFloorAt(cx, cz)) continue;
                assert.equal(
                    isWallAt(cx, cz),
                    true,
                    `Missing perimeter/corner wall at cell center (${cx}, ${cz})`
                );
            }
        }
    }

    // 4. Camera sightline check: from (px, 14, pz + 10) to hero boots (px, 0, pz)
    // across walkable cells inside all rooms
    const nav = buildNavGrid(FLOOR_1, new Set(['door_portcullis', 'door_sanctum']));
    for (const room of rooms) {
        for (let gx = room.bounds.minX; gx < room.bounds.maxX; gx++) {
            for (let gz = room.bounds.minZ; gz < room.bounds.maxZ; gz++) {
                const px = gx + 0.5;
                const pz = gz + 0.5;
                assert.equal(nav.isWalkableWorld(px, pz), true);
                const camZ = pz + 10;
                for (const w of walls) {
                    if (px < w.minX || px > w.maxX) continue;
                    // Check Z overlap between pz and pz + 10
                    const ozMin = Math.max(pz, w.minZ);
                    const ozMax = Math.min(camZ, w.maxZ);
                    if (ozMin >= ozMax) continue;
                    const d = ozMin - pz;
                    const rayBootsY = 1.4 * d;
                    const rayTorsoY = 1.0 + 1.3 * d;
                    if (w.isSouthFace) {
                        assert.ok(
                            rayTorsoY > w.height,
                            `South cutaway wall [${w.minX}..${w.maxX}, ${w.minZ}..${w.maxZ}] h=${w.height} hides hero torso at (${px}, ${pz}); rayTorsoY=${rayTorsoY}`
                        );
                    } else {
                        assert.ok(
                            rayBootsY >= w.height - 1e-6,
                            `Tall wall [${w.minX}..${w.maxX}, ${w.minZ}..${w.maxZ}] h=${w.height} occludes hero boots at (${px}, ${pz}); rayBootsY=${rayBootsY}`
                        );
                    }
                }
            }
        }
    }
});

test('validateFloor1 rejects invalid mutations (exclusivity, height, connectivity, overlap, doors)', () => {
    // 1. Null / invalid object
    assert.equal(validateFloor1(null).valid, false);

    // 2. Post-entry room with 'none'
    {
        const bad = createFloor1Layout();
        bad.rooms.find((r) => r.id === 'room_3_charnel').inhabitantType = 'none';
        const res = validateFloor1(bad);
        assert.equal(res.valid, false);
        assert.ok(res.errors.some((e) => e.includes('room_3_charnel')));
    }

    // 3. Post-entry room with 'both' or inhabitantTypes array
    {
        const bad = createFloor1Layout();
        const r = bad.rooms.find((rm) => rm.id === 'room_2_blades');
        r.inhabitantType = 'both';
        r.inhabitantTypes = ['monster', 'trap'];
        const res = validateFloor1(bad);
        assert.equal(res.valid, false);
    }

    // 4. All post-entry rooms set to 'monster' (0 trap rooms)
    {
        const bad = createFloor1Layout();
        for (const r of bad.rooms) {
            if (r.role === 'chamber' || r.role === 'sanctum') {
                r.inhabitantType = 'monster';
            }
        }
        const res = validateFloor1(bad);
        assert.equal(res.valid, false);
        assert.ok(res.errors.some((e) => e.includes('trap rooms')));
    }

    // 5. Fewer than 5 post-entry rooms
    {
        const bad = createFloor1Layout();
        bad.rooms = bad.rooms.filter(
            (r) => !['room_2_blades', 'room_2b_runes', 'room_3b_crypt', 'room_4b_gauntlet', 'room_5_lair'].includes(r.id)
        );
        bad.corridors = bad.corridors.filter((c) =>
            bad.rooms.some((r) => r.id === c.connects[0]) &&
            bad.rooms.some((r) => r.id === c.connects[1])
        );
        const res = validateFloor1(bad);
        assert.equal(res.valid, false);
        assert.ok(res.errors.some((e) => e.includes('at least 5')));
    }

    // 6. South wall height > 1.4
    {
        const bad = createFloor1Layout();
        const southWall = bad.walls.find((w) => w.isSouthFace);
        southWall.height = 4.0;
        const res = validateFloor1(bad);
        assert.equal(res.valid, false);
        assert.ok(res.errors.some((e) => e.includes('1.4')));
    }

    // 7. Overlapping rooms
    {
        const bad = createFloor1Layout();
        bad.rooms.find((r) => r.id === 'room_2_blades').bounds.minX = 4;
        const res = validateFloor1(bad);
        assert.equal(res.valid, false);
        assert.ok(res.errors.some((e) => e.includes('overlap')));
    }

    // 8. Disconnected room (removed corridor)
    {
        const bad = createFloor1Layout();
        bad.corridors = bad.corridors.filter((c) => c.id !== 'corridor_cistern_lair');
        const res = validateFloor1(bad);
        assert.equal(res.valid, false);
        assert.ok(res.errors.some((e) => e.includes('room_5_lair')));
    }

    // 9. Door that fails to block gated room (width shrunk)
    {
        const bad = createFloor1Layout();
        bad.doors.find((d) => d.id === 'door_portcullis').width = 0.2;
        const res = validateFloor1(bad);
        assert.equal(res.valid, false);
        assert.ok(res.errors.some((e) => e.includes('failed to block')));
    }

    // 10. Overlapping walls
    {
        const bad = createFloor1Layout();
        bad.walls.push({ ...bad.walls[0] });
        const res = validateFloor1(bad);
        assert.equal(res.valid, false);
        assert.ok(res.errors.some((e) => e.includes('Walls')));
    }

    // 11. Oversized entrance or spawnPoint outside entrance
    {
        const bad = createFloor1Layout();
        bad.rooms.find((r) => r.role === 'entrance').bounds.maxX = 8;
        assert.equal(validateFloor1(bad).valid, false);

        const badSpawn = createFloor1Layout();
        badSpawn.spawnPoint = { x: 0, z: 9 };
        assert.equal(validateFloor1(badSpawn).valid, false);
    }

    // 12. entry_room smaller than entrance or discoveredInitially !== false or non-none inhabitantType
    {
        const bad = createFloor1Layout();
        const entry = bad.rooms.find((r) => r.role === 'entry_room');
        entry.bounds = { minX: -1, maxX: 1, minZ: 6, maxZ: 10 };
        assert.equal(validateFloor1(bad).valid, false);

        const badDiscovered = createFloor1Layout();
        badDiscovered.rooms.find((r) => r.role === 'entry_room').discoveredInitially = true;
        assert.equal(validateFloor1(badDiscovered).valid, false);

        const badInhab = createFloor1Layout();
        badInhab.rooms.find((r) => r.role === 'entry_room').inhabitantType = 'monster';
        assert.equal(validateFloor1(badInhab).valid, false);
    }
});

test('createFloor1Layout deep-clone isolation & deterministic seeded theme randomization', () => {
    const a = createFloor1Layout();
    a.rooms[0].name = 'MUTATED';
    a.doors[0].initiallyLocked = false;
    a.spawnPoint.x = 999;
    assert.equal(FLOOR_1.rooms[0].name, 'Cracked Threshold');
    assert.equal(FLOOR_1.doors[0].initiallyLocked, true);
    assert.equal(FLOOR_1.spawnPoint.x, 0);

    const r1 = createFloor1Layout({ seed: 'phusza-alpha', randomizeThemes: true });
    const r2 = createFloor1Layout({ seed: 'phusza-alpha', randomizeThemes: true });
    assert.deepEqual(r1, r2);

    const patterns = new Set();
    const seeds = [0, 1, 2, 3, 7, 13, 42, 99, 256, 1337, 'alpha', 'beta', 'gamma', 'delta', 'omega',
        'crypt-1', 'crypt-2', 'crypt-3', 'crypt-4', 'crypt-5', 'crypt-6', 'crypt-7', 'crypt-8', 'crypt-9', 'crypt-10',
        'seed-a', 'seed-b', 'seed-c', 'seed-d', 'seed-e'];

    for (const seed of seeds) {
        const layout = createFloor1Layout({ seed, randomizeThemes: true });
        const check = validateFloor1(layout);
        assert.equal(check.valid, true, `Seed ${seed} failed validation: ${check.errors.join('; ')}`);
        const post = layout.rooms.filter((r) => r.role === 'chamber' || r.role === 'sanctum');
        const sig = post.map((r) => `${r.id}:${r.inhabitantType}`).join('|');
        patterns.add(sig);
    }
    assert.ok(patterns.size >= 5, `Expected varied randomized layouts across seeds, got ${patterns.size}`);
});

test('Nav-grid door gating, A* reachability, and zero diagonal corner-cutting', () => {
    const layout = createFloor1Layout();
    const spawn = layout.spawnPoint;

    const centerOf = (roomId) => {
        const r = layout.rooms.find((rm) => rm.id === roomId);
        return {
            x: (r.bounds.minX + r.bounds.maxX) / 2,
            z: (r.bounds.minZ + r.bounds.maxZ) / 2
        };
    };

    // Locked: entrance, foyer, blades, runes reachable; behind portcullis/sanctum blocked
    const navLocked = buildNavGrid(layout, new Set());
    assert.equal(navLocked.isWalkableWorld(spawn.x, spawn.z), true);
    assert.equal(navLocked.isWalkableWorld(100, 100), false);
    assert.equal(navLocked.isWalkableWorld(-2.5, 21), false); // Inside West wall of entrance

    assert.equal(navLocked.getRoomAt(spawn.x, spawn.z)?.id, 'entrance');
    assert.equal(navLocked.getRoomAt(0, 9)?.id, 'room_1_foyer');
    assert.equal(navLocked.getRoomAt(0, 16), null); // Inside corridor

    for (const openId of ['entrance', 'room_1_foyer', 'room_2_blades', 'room_2b_runes']) {
        assert.ok(
            navLocked.findPath(spawn, centerOf(openId)).length > 0,
            `${openId} should be reachable before unlocking doors`
        );
    }
    for (const gatedId of [
        'room_3_charnel',
        'room_3b_crypt',
        'room_4_cistern',
        'room_4b_gauntlet',
        'room_5_lair',
        'room_6_sanctum'
    ]) {
        assert.deepEqual(
            navLocked.findPath(spawn, centerOf(gatedId)),
            [],
            `${gatedId} must be blocked while door_portcullis is locked`
        );
    }

    // Unlock portcullis only -> Rooms 3..5 open, Sanctum remains blocked
    const navMid = buildNavGrid(layout, new Set(['door_portcullis']));
    for (const midId of [
        'room_3_charnel',
        'room_3b_crypt',
        'room_4_cistern',
        'room_4b_gauntlet',
        'room_5_lair'
    ]) {
        assert.ok(
            navMid.findPath(spawn, centerOf(midId)).length > 0,
            `${midId} should unlock after door_portcullis opens`
        );
    }
    assert.deepEqual(
        navMid.findPath(spawn, centerOf('room_6_sanctum')),
        [],
        'room_6_sanctum must stay blocked until door_sanctum opens'
    );

    // Unlock both -> all rooms + exit_seal reachable with zero wall clipping / corner cutting
    const navOpen = buildNavGrid(layout, new Set(['door_portcullis', 'door_sanctum']));
    for (const room of layout.rooms) {
        const path = navOpen.findPath(spawn, centerOf(room.id));
        assert.ok(path.length > 0, `${room.id} must be reachable when all doors unlocked`);
        let prev = spawn;
        for (const wp of path) {
            assert.equal(navOpen.isWalkableWorld(wp.x, wp.z), true);
            assert.equal(
                navOpen.hasLineOfSight(prev, wp),
                true,
                `Path segment (${prev.x},${prev.z})->(${wp.x},${wp.z}) clipped wall/corner`
            );
            prev = wp;
        }
    }

    // Specific corner-cutting probe: diagonal around doorway jambs from foyer to blades
    const cornerPath = navOpen.findPath({ x: 3.5, z: 6.5 }, { x: 10.5, z: 11.5 });
    assert.ok(cornerPath.length > 0);
    let prevWp = { x: 3.5, z: 6.5 };
    for (const wp of cornerPath) {
        assert.equal(navOpen.hasLineOfSight(prevWp, wp), true);
        prevWp = wp;
    }

    // Unwalkable target returns [] when snapGoal is false
    assert.deepEqual(navOpen.findPath(spawn, { x: 25, z: 25 }), []);

    // Dynamic options.unlockedDoorIds overrides build-time locked doors in findPath
    assert.ok(navLocked.findPath(spawn, centerOf('room_3_charnel'), {
        unlockedDoorIds: new Set(['door_portcullis'])
    }).length > 0);
    assert.deepEqual(navOpen.findPath(spawn, centerOf('room_3_charnel'), {
        unlockedDoorIds: new Set()
    }), []);
});

test('clampWalkable wall sliding, door blocking, anti-tunneling, and NaN safety', () => {
    const layout = createFloor1Layout();
    const nav = buildNavGrid(layout, new Set());

    // Straight collision into East entrance wall (x = 2, playerRadius = 0.30 -> max x = 1.7)
    const hitEast = nav.clampWalkable({ x: 5, z: 21 }, { x: 0, z: 21 });
    assert.ok(hitEast.x <= 1.7001 && hitEast.x >= 1.65);
    assert.equal(hitEast.z, 21);
    assert.equal(nav.isWalkableWorld(hitEast.x, hitEast.z), true);

    // Diagonal movement into East wall slides smoothly North along Z
    const slid = nav.clampWalkable({ x: 2.6, z: 19.8 }, { x: 1.5, z: 21 });
    assert.ok(slid.z < 20.1);
    assert.ok(slid.x <= 1.7001);
    assert.equal(nav.isWalkableWorld(slid.x, slid.z), true);

    // Locked door blocks passage, then dynamic unlockedDoorIds permits passage
    const blockedDoor = nav.clampWalkable({ x: 0, z: -1 }, { x: 0, z: 2.5 });
    assert.ok(blockedDoor.z >= 2.299, `Blocked door z=${blockedDoor.z} penetrated closed door`);
    const passedDoor = nav.clampWalkable(
        { x: 0, z: 0.5 },
        { x: 0, z: 2.5 },
        new Set(['door_portcullis'])
    );
    assert.equal(passedDoor.z, 0.5);

    // Anti-tunneling: giant single-step jumps across walls/void cannot teleport into adjacent rooms
    const noTunnelWall = nav.clampWalkable({ x: 13, z: 6 }, { x: 0, z: 6 });
    assert.ok(noTunnelWall.x <= 4.7001, `Anti-tunneling failed across wall: jumped to x=${noTunnelWall.x}`);
    const noTunnelCorner = nav.clampWalkable({ x: 13, z: 9 }, { x: 0, z: 5 });
    assert.ok(noTunnelCorner.x < 5.0, `Anti-tunneling failed around corner: jumped to x=${noTunnelCorner.x}`);

    // Array form of unlockedDoorIds works identically to Set
    const navArr = buildNavGrid(layout, ['door_portcullis']);
    assert.ok(navArr.findPath({ x: 0, z: 9 }, { x: 0, z: -4 }).length > 0);
    assert.deepEqual(navArr.findPath({ x: 0, z: 9 }, { x: 0, z: -29 }), []);

    // Clamping without prevPos lands on valid walkable floor inside bounds
    const clampedNoPrev = nav.clampWalkable({ x: 50, z: 21 }, null);
    assert.equal(nav.isWalkableWorld(clampedNoPrev.x, clampedNoPrev.z), true);

    // NaN / Infinity fallback
    const nanSafe = nav.clampWalkable({ x: NaN, z: Infinity }, { x: 0, z: 20 });
    assert.deepEqual(nanSafe, { x: 0, z: 20 });
    const noPrevNan = nav.clampWalkable({ x: undefined, z: NaN }, null);
    assert.deepEqual(noPrevNan, layout.spawnPoint);
});

test('hasLineOfSight and computeApproachPoint prevent cross-wall triggers', () => {
    const layout = createFloor1Layout();
    const navLocked = buildNavGrid(layout, new Set());
    const navUnlocked = buildNavGrid(layout, new Set(['door_portcullis', 'door_sanctum']));

    // Same room & open corridor LOS
    assert.equal(navLocked.hasLineOfSight({ x: -3, z: 6 }, { x: 3, z: 12 }), true);
    assert.equal(navLocked.hasLineOfSight({ x: 4, z: 9 }, { x: 10, z: 9 }), true);

    // Cross-wall / exterior-void corner LOS must be false
    assert.equal(navLocked.hasLineOfSight({ x: 4.5, z: 6 }, { x: 9.5, z: 6 }), false);
    assert.equal(navLocked.hasLineOfSight({ x: 0, z: 5 }, { x: 0, z: -2 }), false); // Across closed door & walls
    assert.equal(navLocked.hasLineOfSight({ x: 0, z: 3 }, { x: 0, z: 0 }), false); // Across closed door_portcullis
    assert.equal(navUnlocked.hasLineOfSight({ x: 0, z: 3 }, { x: 0, z: 0 }), true);

    // computeApproachPoint for locked portcullis returns reachable South point inside trigger radius
    const portApproach = navLocked.computeApproachPoint({ x: 0, z: 6 }, { x: 0, z: 1.5 }, 1.5);
    assert.ok(portApproach);
    assert.equal(navLocked.isWalkableWorld(portApproach.x, portApproach.z), true);
    assert.ok(portApproach.z > 2.2);
    assert.ok(Math.hypot(portApproach.x - 0, portApproach.z - 1.5) <= 2.1);

    // computeApproachPoint for locked-behind encounters returns null while locked, valid once unlocked
    assert.equal(navLocked.computeApproachPoint({ x: 0, z: 6 }, { x: 0, z: -4 }, 1.5), null);
    assert.equal(navLocked.computeApproachPoint({ x: 0, z: 6 }, { x: 0, z: -32.2 }, 1.5), null);

    const exitApproach = navUnlocked.computeApproachPoint({ x: 0, z: -26 }, { x: 0, z: -32.2 }, 1.5);
    assert.ok(exitApproach);
    assert.equal(navUnlocked.isWalkableWorld(exitApproach.x, exitApproach.z), true);
    assert.equal(navUnlocked.hasLineOfSight(exitApproach, { x: 0, z: -32.2 }), true);

    // Coincident fromPos === targetPos still returns valid non-NaN walkable approach point
    const sameSpot = navLocked.computeApproachPoint({ x: 0, z: 9 }, { x: 0, z: 9 }, 1.5);
    assert.ok(sameSpot);
    assert.equal(Number.isFinite(sameSpot.x) && Number.isFinite(sameSpot.z), true);
    assert.equal(navLocked.isWalkableWorld(sameSpot.x, sameSpot.z), true);
});

test('TRAP_ARCHETYPES balance, schema, and valid Level-1 stats', () => {
    assert.equal(Object.isFrozen(TRAP_ARCHETYPES), true);
    const keys = Object.keys(TRAP_ARCHETYPES);
    assert.equal(keys.length, 4);
    for (const expectedKey of VALID_TRAPS) {
        assert.ok(keys.includes(expectedKey), `Missing trap archetype ${expectedKey}`);
    }

    for (const [key, trap] of Object.entries(TRAP_ARCHETYPES)) {
        assert.equal(Object.isFrozen(trap), true);
        assert.equal(trap.trapType, key);
        assert.ok(trap.damage >= 8 && trap.damage <= 15, `${key} damage ${trap.damage} out of [8,15]`);
        assert.equal(trap.disarmable, true);
        assert.equal(trap.stepTrigger, true);
        assert.ok(Array.isArray(trap.options) && trap.options.length >= 3);

        for (const opt of trap.options) {
            assert.ok(opt.label && typeof opt.label === 'string');
            assert.equal(VALID_STATS.has(opt.stat), true, `Invalid stat '${opt.stat}' on ${key}`);
            assert.equal(opt.statName, EXPECTED_STAT_NAMES[opt.stat]);
            assert.ok(Number.isFinite(opt.dc) && opt.dc >= 8 && opt.dc <= 16);
            assert.ok(opt.successMsg && opt.failMsg);
            assert.ok(opt.penalty && opt.penalty.hpDamage >= 8 && opt.penalty.hpDamage <= 15);
        }
    }
});

test('createFloor1Run enforces room monster-or-trap exclusivity, valid schemas, and deep isolation', () => {
    const run = createFloor1Run();
    assert.equal(validateFloor1(run.floor).valid, true);
    assert.strictEqual(run.doors, run.floor.doors);
    assert.strictEqual(run.rooms, run.floor.rooms);

    const roomById = new Map(run.rooms.map((r) => [r.id, r]));
    const ids = new Set();
    const monstersSeen = new Set();
    const trapsSeen = new Set();

    for (const enc of run.encounters) {
        assert.equal(ids.has(enc.id), false, `Duplicate encounter id ${enc.id}`);
        ids.add(enc.id);
        assert.ok(roomById.has(enc.roomId), `Encounter ${enc.id} has unknown roomId ${enc.roomId}`);
        assert.equal(enc.resolved, false);
        assert.equal(typeof enc.pos.y, 'number');
        assert.ok(enc.triggerRadius >= 2.0 && enc.triggerRadius <= 2.4);

        // Never auto-trigger at spawnPoint
        const distFromSpawn = Math.hypot(
            enc.pos.x - run.floor.spawnPoint.x,
            enc.pos.z - run.floor.spawnPoint.z
        );
        assert.ok(distFromSpawn > enc.triggerRadius + 1.0, `Encounter ${enc.id} too close to spawnPoint`);

        assert.ok(Array.isArray(enc.options) && enc.options.length >= 1);
        for (const opt of enc.options) {
            assert.equal(VALID_STATS.has(opt.stat), true, `Invalid stat ${opt.stat} on ${enc.id}`);
            assert.equal(opt.statName, EXPECTED_STAT_NAMES[opt.stat]);
            if (opt.reward && opt.reward.consumable) {
                assert.equal(
                    VALID_CONSUMABLES.has(opt.reward.consumable),
                    true,
                    `Unknown consumable ${opt.reward.consumable}`
                );
            }
        }

        if (enc.kind === 'combat') {
            assert.equal(enc.isCombat, true);
            assert.equal(VALID_MONSTERS.has(enc.monsterId), true);
            assert.ok(enc.monsterScale >= 1.0);
            assert.ok(enc.aggroRadius >= 4.0);
            monstersSeen.add(enc.monsterId);
        } else if (enc.kind === 'trap') {
            assert.equal(enc.isCombat, false);
            assert.equal(VALID_TRAPS.has(enc.trapType), true);
            assert.equal(enc.trapState, 'armed');
            assert.equal(enc.disarmable, true);
            assert.equal(enc.stepTrigger, true);
            assert.ok(enc.damage >= 8 && enc.damage <= 15);
            trapsSeen.add(enc.trapType);
        }
    }

    assert.equal(monstersSeen.size, 4, 'Default Floor 1 run should include all 4 monster types');
    assert.equal(trapsSeen.size, 4, 'Default Floor 1 run should include all 4 trap archetypes');

    // Check moonwell, locked doors, and exit_seal
    const moonwell = run.encounters.find((e) => e.id === 'moonwell');
    assert.equal(moonwell?.kind, 'shrine');
    assert.equal(moonwell?.roomId, 'room_1_foyer');

    const portcullis = run.encounters.find((e) => e.doorId === 'door_portcullis');
    assert.equal(portcullis?.kind, 'door');
    assert.equal(portcullis?.retryable, true);
    assert.equal(portcullis?.options.every((o) => o.reward?.unlocksDoor === true), true);

    const sanctumGate = run.encounters.find((e) => e.doorId === 'door_sanctum');
    assert.equal(sanctumGate?.kind, 'door');
    assert.equal(sanctumGate?.retryable, true);
    assert.equal(sanctumGate?.options.every((o) => o.reward?.unlocksDoor === true), true);

    const exitSeal = run.encounters.find((e) => e.kind === 'exit');
    assert.equal(exitSeal?.roomId, 'room_6_sanctum');
    assert.equal(exitSeal?.options.every((o) => o.reward?.victory === true), true);

    // Strict per-room mutual exclusion across default & 25 randomized runs
    const checkRunRoomExclusivity = (testRun, label) => {
        for (const room of testRun.rooms) {
            const inRoom = testRun.encounters.filter((e) => e.roomId === room.id);
            const combatCount = inRoom.filter((e) => e.kind === 'combat').length;
            const trapCount = inRoom.filter((e) => e.kind === 'trap').length;

            if (room.role === 'entrance' || room.role === 'entry_room') {
                assert.equal(combatCount, 0, `${label} ${room.id} must have 0 combat`);
                assert.equal(trapCount, 0, `${label} ${room.id} must have 0 traps`);
            } else if (room.inhabitantType === 'monster') {
                assert.ok(combatCount >= 1, `${label} monster room ${room.id} missing combat`);
                assert.equal(trapCount, 0, `${label} monster room ${room.id} leaked a trap`);
            } else if (room.inhabitantType === 'trap') {
                assert.ok(trapCount >= 1, `${label} trap room ${room.id} missing trap`);
                assert.equal(combatCount, 0, `${label} trap room ${room.id} leaked a combat`);
            }
        }
    };

    checkRunRoomExclusivity(run, 'default');
    for (let s = 0; s < 25; s++) {
        const randRun = createFloor1Run({ seed: `run-seed-${s}`, randomizeThemes: true });
        checkRunRoomExclusivity(randRun, `seed-${s}`);
    }

    // Deep-clone run isolation
    const runB = createFloor1Run();
    run.encounters[0].resolved = true;
    run.encounters[0].options[0].dc = 99;
    run.doors[0].initiallyLocked = false;
    run.rooms[1].discoveredInitially = true;
    const trapEnc = run.encounters.find((e) => e.kind === 'trap');
    trapEnc.trapState = 'triggered';

    assert.equal(runB.encounters[0].resolved, false);
    assert.notEqual(runB.encounters[0].options[0].dc, 99);
    assert.equal(runB.doors[0].initiallyLocked, true);
    assert.equal(runB.rooms[1].discoveredInitially, false);
    assert.equal(runB.encounters.find((e) => e.kind === 'trap').trapState, 'armed');
});

test('Backwards-compatible ENCOUNTERS export preserves legacy contracts and isolation', () => {
    assert.equal(Object.isFrozen(ENCOUNTERS), true);
    assert.equal(ENCOUNTERS.length, 7);

    const legacyIds = new Set(ENCOUNTERS.map((e) => e.id));
    for (const id of [
        'portcullis',
        'sarcophagus',
        'monolith',
        'pit_trap',
        'skeleton',
        'moonwell',
        'grand_chest'
    ]) {
        assert.equal(legacyIds.has(id), true, `Missing legacy encounter ${id}`);
    }

    for (const enc of ENCOUNTERS) {
        assert.ok(enc.pos.x >= -13.5 && enc.pos.x <= 13.5);
        assert.ok(enc.pos.z >= -19.5 && enc.pos.z <= 14.5);
        assert.equal(enc.resolved, false);
        for (const opt of enc.options) {
            assert.equal(VALID_STATS.has(opt.stat), true);
            assert.equal(typeof opt.statName, 'string');
            assert.ok(opt.statName.length > 0);
            if (opt.reward && opt.reward.consumable) {
                assert.equal(VALID_CONSUMABLES.has(opt.reward.consumable), true);
            }
        }
    }

    // Array cannot be mutated in strict mode, while item .resolved remains writable for pre-M4 dungeonWorld.js:753
    assert.throws(() => {
        ENCOUNTERS.push({});
    }, TypeError);

    const prev = ENCOUNTERS[0].resolved;
    ENCOUNTERS[0].resolved = true;
    assert.equal(ENCOUNTERS[0].resolved, true);

    // Mutating ENCOUNTERS[0].resolved must not leak into createFloor1Run()
    const freshRun = createFloor1Run();
    assert.equal(freshRun.encounters.every((e) => e.resolved === false), true);
    ENCOUNTERS[0].resolved = prev;
});
