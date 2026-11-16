import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';

import {
    OVERWORLD_MONSTER_IDS,
    OVERWORLD_TRAP_TYPES,
    TRAP_STATES,
    PROP_ANCHOR_TYPES,
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
} from '../../js/overworldProps.js';

import {
    MAX_SCENE_POINT_LIGHTS,
    DEFAULT_ENV_LIGHT_POOL_SIZE,
    normalizeHeroConfig,
    resolveKeyboardDirection,
    clampSouthWallHeight,
    shouldAddWallTrim,
    selectPooledLights,
    createRoomDiscoveryState,
    stepRoomDiscovery,
    filterTriggerableEncounters,
    stepMonsterAggro,
    resolveClickMovePlan,
    computeTrapVisualState,
    applyEncounterResolution,
    DungeonWorldApp
} from '../../js/dungeonWorld.js';

import { FLOOR_1, buildNavGrid } from '../../js/floor1Layout.js';
import { createFloor1Run } from '../../js/encounters.js';
import { CharacterBuilder } from '../../js/characterBuilder.js';

function countLightsAndMeshes(root) {
    let meshCount = 0;
    let pointLights = 0;
    let totalLights = 0;
    root.traverse((obj) => {
        if (obj.isMesh) meshCount++;
        if (obj.isLight) {
            totalLights++;
            if (obj.isPointLight) pointLights++;
        }
    });
    return { meshCount, pointLights, totalLights };
}

describe('overworldProps.js: 3D monsters, traps, doors, shrines, exit, props & disposal', () => {
    it('builds all 4 Floor 1 monsters with distinct geometry, >=10 meshes, min.y >= 0, and 0 embedded PointLights', () => {
        const signatures = new Set();

        for (const id of OVERWORLD_MONSTER_IDS) {
            const scale = id === 'shadow_wraith' ? 1.2 : 1.0;
            const entry = buildOverworldMonster(id, scale);
            assert.ok(entry.group instanceof THREE.Group);
            assert.equal(entry.monsterId, id);
            assert.equal(entry.scale, scale);

            const stats = countLightsAndMeshes(entry.group);
            assert.ok(stats.meshCount >= 10, `${id} should have >=10 meshes`);
            assert.equal(stats.pointLights, 0, `${id} must embed 0 PointLights`);

            const box = new THREE.Box3().setFromObject(entry.group);
            assert.equal(box.isEmpty(), false);
            assert.ok(box.min.y >= -1e-4, `${id} min.y clipped below floor: ${box.min.y}`);
            const size = box.getSize(new THREE.Vector3());

            // Idle and aggro animation ticks cleanly
            updateOverworldMonster(entry, 0.05, 0.05, false);
            updateOverworldMonster(entry, 0.05, 0.10, true);
            assert.ok(Number.isFinite(entry.animState.time) && entry.animState.time > 0);

            signatures.add(JSON.stringify({
                meshes: stats.meshCount,
                dims: [size.x, size.y, size.z].map((v) => Math.round(v * 100))
            }));
        }

        assert.equal(signatures.size, 4, 'All 4 overworld monster types must have distinct silhouettes');
    });

    it('builds all 4 trap archetypes with distinct geometry, 0 PointLights, and distinct 4-state visuals', () => {
        const sigs = new Set();

        for (const trapType of OVERWORLD_TRAP_TYPES) {
            const entry = buildTrapProp(trapType, 'armed');
            assert.ok(entry.group instanceof THREE.Group);
            assert.equal(entry.trapType, trapType);
            assert.equal(entry.trapState, 'armed');

            const counts = countLightsAndMeshes(entry.group);
            assert.ok(counts.meshCount >= 3, `${trapType} should contain multiple meshes`);
            assert.equal(counts.pointLights, 0, `${trapType} must embed 0 PointLights`);

            const box = new THREE.Box3().setFromObject(entry.group);
            const size = box.getSize(new THREE.Vector3());
            sigs.add(JSON.stringify({
                meshes: counts.meshCount,
                dims: [size.x, size.y, size.z].map((v) => Math.round(v * 100))
            }));

            for (const state of TRAP_STATES) {
                updateTrapPropVisual(entry, state, 0.04, 0.5);
                assert.equal(entry.trapState, state);
                assert.equal(entry.group.userData.trapState, state);
            }
        }

        assert.equal(sigs.size, 4, 'All 4 trap archetypes must be structurally distinct');

        // Verify concrete visual mutations per trap across states
        const pit = buildTrapProp('spike_pit', 'armed');
        const armedSpikeY = pit.parts.spikeBed.position.y;
        updateTrapPropVisual(pit, 'triggered', 0.016, 0.1);
        assert.ok(pit.parts.spikeBed.position.y > armedSpikeY, 'Triggered spike_pit raises spikes');
        updateTrapPropVisual(pit, 'disarmed', 0.016, 0.2);
        assert.equal(pit.parts.lockGrate.visible, true, 'Disarmed spike_pit displays iron lock grate');

        const scythe = buildTrapProp('pendulum_scythe', 'armed');
        updateTrapPropVisual(scythe, 'disarmed', 0.016, 0.2);
        assert.equal(scythe.parts.clamp.visible, true, 'Disarmed pendulum_scythe engages safety clamp');

        const dart = buildTrapProp('dart_wall', 'armed');
        assert.equal(dart.parts.darts[0].visible, false);
        updateTrapPropVisual(dart, 'triggered', 0.016, 0.1);
        assert.equal(dart.parts.darts[0].visible, true, 'Triggered dart_wall fires darts');
        updateTrapPropVisual(dart, 'disarmed', 0.016, 0.2);
        assert.equal(dart.parts.plugs[0].visible, true, 'Disarmed dart_wall plugs conduits');

        const rune = buildTrapProp('blood_rune', 'revealed');
        const revealedOpacity = rune.parts.outerRingMat.opacity;
        updateTrapPropVisual(rune, 'disarmed', 0.016, 0.2);
        assert.ok(rune.parts.outerRingMat.opacity < revealedOpacity, 'Disarmed blood_rune dims sigil');
    });

    it('builds doors, shrines, exit seal, all 5 propAnchors, sconces, beacons, dust motes, and disposes cleanly', () => {
        const port = buildDoorProp({ id: 'door_portcullis', width: 2, axis: 'x' });
        assert.equal(countLightsAndMeshes(port.group).pointLights, 0);
        const closedGateY = port.gate.position.y;
        updateDoorPropVisual(port, true, 1.0);
        assert.ok(port.gate.position.y > closedGateY + 1.5, 'Opening portcullis lifts GateMesh');

        const sanctumDoor = buildDoorProp({ id: 'door_sanctum', width: 2, axis: 'x' });
        assert.equal(countLightsAndMeshes(sanctumDoor.group).pointLights, 0);
        assert.equal(sanctumDoor.chainSeal.visible, true);
        updateDoorPropVisual(sanctumDoor, true, 1.0);
        assert.ok(sanctumDoor.leftPivot.rotation.y < -1.0);
        assert.ok(sanctumDoor.rightPivot.rotation.y > 1.0);
        assert.equal(sanctumDoor.chainSeal.visible, false);

        const moonwell = buildShrineProp({ id: 'moonwell', kind: 'shrine' });
        assert.equal(countLightsAndMeshes(moonwell.group).pointLights, 0);
        assert.ok(countLightsAndMeshes(moonwell.group).meshCount >= 3);

        const exitSeal = buildExitSealProp({ id: 'exit_seal', kind: 'exit' });
        assert.equal(countLightsAndMeshes(exitSeal.group).pointLights, 0);
        assert.ok(countLightsAndMeshes(exitSeal.group).meshCount >= 6);

        for (const propType of PROP_ANCHOR_TYPES) {
            const p = buildRoomPropAnchor({ type: propType, x: 1, z: -2 });
            const c = countLightsAndMeshes(p);
            assert.ok(c.meshCount >= 2, `Prop anchor ${propType} should have >=2 meshes`);
            assert.equal(c.pointLights, 0, `Prop anchor ${propType} must embed 0 PointLights`);
        }

        const sconce = buildTorchSconceMesh({ x: -4.4, z: 4.6, color: 0xff9933, intensity: 1.3 });
        assert.equal(countLightsAndMeshes(sconce.group).pointLights, 0, 'Sconce mesh must not embed PointLight');

        const beacon = buildBeacon();
        assert.equal(countLightsAndMeshes(beacon).meshCount, 2);

        const dust = buildDustMotesSystem({ count: 60 });
        assert.ok(dust.points instanceof THREE.Points);
        const yBefore = dust.geometry.getAttribute('position').array[1];
        dust.update(0.05, 1.0);
        const yAfter = dust.geometry.getAttribute('position').array[1];
        assert.notEqual(yAfter, yBefore, 'Dust motes animate vertically');
        assert.ok(Number.isFinite(yAfter));

        // Disposal smoke check
        let geoDisposed = 0;
        let matDisposed = 0;
        let texDisposed = 0;
        const tex = { dispose: () => { texDisposed++; } };
        const fakeGroup = new THREE.Group();
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial({ map: tex })
        );
        const origGeoDispose = mesh.geometry.dispose.bind(mesh.geometry);
        const origMatDispose = mesh.material.dispose.bind(mesh.material);
        mesh.geometry.dispose = () => { geoDisposed++; origGeoDispose(); };
        mesh.material.dispose = () => { matDisposed++; origMatDispose(); };
        fakeGroup.add(mesh);

        disposeObject3D(fakeGroup);
        assert.equal(geoDisposed, 1);
        assert.equal(matDisposed, 1);
        assert.equal(texDisposed, 1);
        assert.doesNotThrow(() => disposeObject3D(null));
    });
});

describe('dungeonWorld.js pure logic: config, controls, lighting pool, cutaway walls, discovery, aggro, triggers', () => {
    it('normalizeHeroConfig supports both charClass/ancestry and classKey/race schemas', () => {
        const a = normalizeHeroConfig({ name: 'Elarion', ancestry: 'elf', charClass: 'mage' });
        assert.equal(a.name, 'Elarion');
        assert.equal(a.charClass, 'mage');
        assert.equal(a.classKey, 'mage');
        assert.equal(a.ancestry, 'elf');
        assert.equal(a.race, 'elf');

        const b = normalizeHeroConfig({ race: 'orc', classKey: 'WARRIOR' });
        assert.equal(b.charClass, 'warrior');
        assert.equal(b.ancestry, 'orc');
        assert.equal(b.name, 'Delver');
    });

    it('resolveKeyboardDirection handles WASD, Arrows, cancellation, and diagonal normalization', () => {
        assert.deepEqual(resolveKeyboardDirection(new Set()), { x: 0, z: 0 });
        assert.deepEqual(resolveKeyboardDirection(new Set(['KeyW'])), { x: 0, z: -1 });
        assert.deepEqual(resolveKeyboardDirection(new Set(['ArrowDown'])), { x: 0, z: 1 });
        assert.deepEqual(resolveKeyboardDirection(new Set(['KeyA'])), { x: -1, z: 0 });
        assert.deepEqual(resolveKeyboardDirection(new Set(['ArrowRight'])), { x: 1, z: 0 });
        assert.deepEqual(resolveKeyboardDirection(new Set(['KeyW', 'KeyS'])), { x: 0, z: 0 });

        const diag = resolveKeyboardDirection(new Set(['KeyW', 'KeyD']));
        assert.ok(Math.abs(Math.hypot(diag.x, diag.z) - 1.0) < 1e-6);
        assert.ok(diag.x > 0 && diag.z < 0);
    });

    it('enforces South-facing wall cutaway <= 1.4 and excludes tall trim from South walls across all FLOOR_1 walls', () => {
        for (const w of FLOOR_1.walls) {
            const h = clampSouthWallHeight(w);
            if (w.isSouthFace) {
                assert.ok(h <= 1.2 && h <= 1.4, `South wall height ${h} exceeded cutaway limit`);
                assert.equal(shouldAddWallTrim(w), false);
            } else {
                assert.equal(h, 4.0);
                assert.equal(shouldAddWallTrim(w), true);
            }
        }
    });

    it('selectPooledLights enforces <= 8 total PointLights across Warrior (1) and Mage (2)', () => {
        const candidates = [];
        for (let i = 0; i < 14; i++) {
            candidates.push({
                id: `torch_${i}`,
                x: 0,
                z: 20 - i * 4,
                discovered: i !== 0 // torch_0 undiscovered
            });
        }

        const warLights = selectPooledLights({
            playerLightsCount: 1,
            candidates,
            playerPos: { x: 0, z: 0 },
            maxTotalPointLights: MAX_SCENE_POINT_LIGHTS
        });
        assert.ok(warLights.length + 1 <= 8);
        assert.equal(warLights.length, 7);
        assert.equal(warLights.some((c) => c.id === 'torch_0'), false, 'Undiscovered lights excluded');

        const mageLights = selectPooledLights({
            playerLightsCount: 2,
            candidates,
            playerPos: { x: 0, z: 0 },
            maxTotalPointLights: MAX_SCENE_POINT_LIGHTS
        });
        assert.ok(mageLights.length + 2 <= 8);
        assert.equal(mageLights.length, 6);
        assert.equal(mageLights[0].z, 0, 'Closest discovered light selected first');
    });

    it('tracks room discovery and fog-of-war lift strictly on room entry', () => {
        const run = createFloor1Run();
        const nav = buildNavGrid(run.floor, new Set());
        const state = createRoomDiscoveryState(run.rooms, 'entrance');

        assert.equal(state.discoveredRoomIds.has('entrance'), true);
        assert.equal(state.discoveredRoomIds.has('room_1_foyer'), false);

        // Corridor between entrance and room_1_foyer
        const corrStep = stepRoomDiscovery(state, { x: 0, z: 16 }, nav);
        assert.equal(corrStep.room, null);
        assert.equal(corrStep.firstDiscovery, false);

        // Enter room_1_foyer first time
        const r1First = stepRoomDiscovery(state, { x: 0, z: 10 }, nav);
        assert.equal(r1First.room?.id, 'room_1_foyer');
        assert.equal(r1First.firstDiscovery, true);
        assert.equal(state.discoveredRoomIds.has('room_1_foyer'), true);

        // Re-step inside room_1_foyer -> not firstDiscovery
        const r1Second = stepRoomDiscovery(state, { x: 1, z: 9 }, nav);
        assert.equal(r1Second.firstDiscovery, false);
    });

    it('prevents cross-wall triggers, closed-door bypasses, and triggered-trap re-triggers', () => {
        const run = createFloor1Run();
        const nav = buildNavGrid(run.floor, new Set());

        // Add synthetic wall-adjacent encounter to prove cross-wall LOS block
        const wallTestEnc = {
            id: 'wall_adj_test',
            kind: 'shrine',
            roomId: 'room_2_blades',
            pos: { x: 9.2, z: 9 },
            triggerRadius: 2.3,
            resolved: false
        };
        // Player at x=4.6 (in room_1_foyer, across 4-unit solid wall & outside corridor [8,10])
        // Wait: at z=6, corridor is [8,10] so wall separates x=4.6 and x=6.5!
        const wallEncSouth = {
            id: 'wall_adj_south',
            kind: 'shrine',
            roomId: 'room_2_blades',
            pos: { x: 6.2, z: 6 },
            triggerRadius: 2.5,
            resolved: false
        };
        const crossWallHits = filterTriggerableEncounters({
            encounters: [wallEncSouth, wallTestEnc],
            playerPos: { x: 4.5, z: 6 },
            currentRoomId: 'room_1_foyer',
            navGrid: nav,
            unlockedDoorIds: new Set()
        });
        assert.deepEqual(crossWallHits, []);

        // Closed portcullis IS triggerable from corridor approach side (z=3.0)
        const doorHits = filterTriggerableEncounters({
            encounters: run.encounters,
            playerPos: { x: 0, z: 3.0 },
            currentRoomId: null,
            navGrid: nav,
            unlockedDoorIds: new Set()
        });
        assert.equal(doorHits.length, 1);
        assert.equal(doorHits[0].kind, 'door');
        assert.equal(doorHits[0].doorId, 'door_portcullis');

        // Triggered or disarmed trap MUST NOT re-trigger
        const trap = run.encounters.find((e) => e.kind === 'trap');
        trap.trapState = 'triggered';
        const trapHits = filterTriggerableEncounters({
            encounters: [trap],
            playerPos: { x: trap.pos.x, z: trap.pos.z },
            currentRoomId: trap.roomId,
            navGrid: nav
        });
        assert.deepEqual(trapHits, []);
    });

    it('bounds monster aggro strictly inside its room and returns home when hero exits', () => {
        const run = createFloor1Run();
        const nav = buildNavGrid(run.floor, new Set(['door_portcullis']));
        const skel = run.encounters.find((e) => e.monsterId === 'skeleton');
        const room = run.rooms.find((r) => r.id === skel.roomId);

        const entry = {
            pos: { x: skel.pos.x, z: skel.pos.z },
            homePos: { x: skel.pos.x, z: skel.pos.z },
            roomId: skel.roomId,
            aggroRadius: 5.0,
            triggerRadius: 2.2,
            rotationY: 0,
            resolved: false
        };

        // Hero enters same room within aggro radius -> monster aggros & steps toward hero inside room bounds
        const playerInRoom = { x: 2.5, z: -1.5 };
        for (let i = 0; i < 10; i++) {
            const step = stepMonsterAggro(entry, playerInRoom, room.id, room.bounds, nav, 0.08, new Set(['door_portcullis']));
            assert.equal(step.isAggro, true);
            assert.ok(step.pos.x >= room.bounds.minX + 0.44 && step.pos.x <= room.bounds.maxX - 0.44);
            assert.ok(step.pos.z >= room.bounds.minZ + 0.44 && step.pos.z <= room.bounds.maxZ - 0.44);
            entry.pos = step.pos;
        }
        assert.ok(entry.pos.x > 0 && entry.pos.z > -4, 'Monster moved toward hero inside room');

        // Hero leaves to corridor (playerRoomId = null) -> aggro drops & monster returns toward home
        const prevDistHome = Math.hypot(entry.pos.x - entry.homePos.x, entry.pos.z - entry.homePos.z);
        for (let i = 0; i < 8; i++) {
            const back = stepMonsterAggro(entry, { x: 0, z: 2 }, null, room.bounds, nav, 0.08, new Set(['door_portcullis']));
            assert.equal(back.isAggro, false);
            entry.pos = back.pos;
        }
        const newDistHome = Math.hypot(entry.pos.x - entry.homePos.x, entry.pos.z - entry.homePos.z);
        assert.ok(newDistHome < prevDistHome, 'Monster returns toward homePos when hero exits room');
    });

    it('resolveClickMovePlan blocks locked destinations and plans unobstructed A* paths when unlocked', () => {
        const run = createFloor1Run();
        const navLocked = buildNavGrid(run.floor, new Set());
        const skel = run.encounters.find((e) => e.monsterId === 'skeleton');

        const blockedPlan = resolveClickMovePlan({
            clickedEncounterId: skel.id,
            playerPos: { x: 0, z: 9 },
            encounters: run.encounters,
            navGrid: navLocked,
            unlockedDoorIds: new Set()
        });
        assert.equal(blockedPlan.type, 'blocked');
        assert.deepEqual(blockedPlan.waypoints, []);

        const navUnlocked = buildNavGrid(run.floor, new Set(['door_portcullis']));
        const openPlan = resolveClickMovePlan({
            clickedEncounterId: skel.id,
            playerPos: { x: 0, z: 9 },
            encounters: run.encounters,
            navGrid: navUnlocked,
            unlockedDoorIds: new Set(['door_portcullis'])
        });
        assert.equal(openPlan.type, 'encounter');
        assert.ok(openPlan.waypoints.length > 0);
    });

    it('applyEncounterResolution handles retryable doors, trap states, combat flee/win, and exit victory', () => {
        const door = { id: 'portcullis', kind: 'door', doorId: 'door_portcullis', retryable: true, resolved: false };
        const doorFail = applyEncounterResolution(door, false);
        assert.equal(doorFail.resolved, false);
        assert.equal(door.resolved, false, 'Failed door MUST stay retryable');

        const doorPass = applyEncounterResolution(door, true);
        assert.equal(doorPass.resolved, true);
        assert.equal(doorPass.unlockDoorId, 'door_portcullis');
        assert.equal(door.resolved, true);

        const trapA = { id: 't1', kind: 'trap', trapState: 'armed', resolved: false };
        assert.equal(computeTrapVisualState(trapA, true), 'disarmed');
        applyEncounterResolution(trapA, true);
        assert.equal(trapA.trapState, 'disarmed');
        assert.equal(trapA.resolved, true);

        const trapB = { id: 't2', kind: 'trap', trapState: 'armed', resolved: false };
        applyEncounterResolution(trapB, false);
        assert.equal(trapB.trapState, 'triggered');
        assert.equal(trapB.resolved, true);

        const combatEnc = { id: 'skel', kind: 'combat', resolved: false };
        applyEncounterResolution(combatEnc, false);
        assert.equal(combatEnc.resolved, false, 'Fleeing combat keeps monster unresolved');
        applyEncounterResolution(combatEnc, true);
        assert.equal(combatEnc.resolved, true);

        const exitEnc = { id: 'exit_seal', kind: 'exit', resolved: false };
        const exitRes = applyEncounterResolution(exitEnc, true);
        assert.equal(exitRes.victory, true);
        assert.equal(exitEnc.resolved, true);
    });
});

describe('DungeonWorldApp headless & 3D scene-graph invariants (without WebGLRenderer)', () => {
    it('initializes Floor 1 run, moves/unlocks doors, handles trap/exit/respawn, and disposes cleanly', () => {
        const events = { rooms: [], doors: [], fails: [], victories: [] };
        const app = new DungeonWorldApp(
            null,
            { name: 'Torin', ancestry: 'dwarf', charClass: 'warrior' },
            () => {},
            () => {},
            {
                headless: true,
                onRoomEnter: (r, meta) => events.rooms.push({ id: r.id, ...meta }),
                onDoorUnlock: (id) => events.doors.push(id),
                onEncounterFail: (e) => events.fails.push(e.id),
                onFloorVictory: (e) => events.victories.push(e.id)
            }
        );

        assert.ok(app.targetPos instanceof THREE.Vector3);
        assert.equal(app.getCurrentRoom()?.id, 'entrance');
        assert.deepEqual(app.getDiscoveredRooms().map((r) => r.id), ['entrance']);

        // Headless player proxy for method checks
        app.player = new THREE.Group();
        app.player.position.set(app.floor.spawnPoint.x, 0, app.floor.spawnPoint.z);

        // Move North using moveByDirection
        const moved = app.moveByDirection(0, -1, 0.1);
        assert.equal(moved, true);
        assert.ok(app.player.position.z < app.floor.spawnPoint.z);

        // Unlock door_portcullis
        app.unlockDoor('door_portcullis', { suppressSfx: true });
        assert.equal(app.unlockedDoorIds.has('door_portcullis'), true);
        assert.deepEqual(events.doors, ['door_portcullis']);
        assert.ok(
            app.navGrid.findPath(app.floor.spawnPoint, { x: 0, z: -4 }).length > 0,
            'Nav-grid rebuilds after unlockDoor'
        );

        // Failed sanctum_gate stays retryable
        const sanctumGate = app.encounters.find((e) => e.doorId === 'door_sanctum');
        app.resolveEncounterVisual(sanctumGate.id, false, { suppressSfx: true });
        assert.equal(sanctumGate.resolved, false);
        assert.equal(events.fails.includes(sanctumGate.id), true);

        // Exit victory callback fires
        const exitEnc = app.encounters.find((e) => e.kind === 'exit');
        app.resolveEncounterVisual(exitEnc.id, true, { suppressSfx: true });
        assert.equal(exitEnc.resolved, true);
        assert.deepEqual(events.victories, [exitEnc.id]);

        // Respawn restores spawnPoint & keeps targetPos as THREE.Vector3
        app.respawnAtEntrance();
        assert.ok(app.targetPos instanceof THREE.Vector3);
        assert.equal(app.player.position.x, app.floor.spawnPoint.x);
        assert.equal(app.player.position.z, app.floor.spawnPoint.z);
        assert.equal(app.getCurrentRoom()?.id, 'entrance');

        app.setPaused(true);
        assert.equal(app.paused, true);
        app.clearActiveEncounter();
        assert.equal(app.activeEncounterId, null);

        const summary = app.getRunSummary();
        assert.equal(summary.floorId, 1);
        assert.equal(summary.currentRoomId, 'entrance');
        app.dispose();
        assert.equal(app.disposed, true);
    });

    it('constructs full 3D scene graph in Node for both Warrior & Mage with <= 8 PointLights and low South cutaways', () => {
        for (const charClass of ['warrior', 'mage']) {
            const app = new DungeonWorldApp(
                null,
                { name: `Hero_${charClass}`, ancestry: 'elf', charClass },
                () => {},
                () => {},
                { headless: true }
            );

            app.scene = new THREE.Scene();
            app.camera = new THREE.PerspectiveCamera(45, 16 / 10, 0.1, 100);
            app.ambientLight = new THREE.AmbientLight(0x1f283d, 0.22);
            app.scene.add(app.ambientLight);
            app.moonLightTarget = new THREE.Object3D();
            app.scene.add(app.moonLightTarget);
            app.moonLight = new THREE.DirectionalLight(0x527399, 0.30);
            app.moonLight.target = app.moonLightTarget;
            app.scene.add(app.moonLight);

            for (let i = 0; i < DEFAULT_ENV_LIGHT_POOL_SIZE; i++) {
                const l = new THREE.PointLight(0xff9933, 0, 12, 1.25);
                l.visible = false;
                app.scene.add(l);
                app.envLightPool.push(l);
            }

            app.buildDungeonEnvironment();
            app.spawnEncounters();
            app.spawnPlayer();
            app.refreshVisibilityAndLights(0, true);

            const counts = countLightsAndMeshes(app.scene);
            assert.ok(
                counts.pointLights <= MAX_SCENE_POINT_LIGHTS,
                `${charClass} scene PointLight count ${counts.pointLights} exceeded cap ${MAX_SCENE_POINT_LIGHTS}`
            );

            // Verify South wall cutaway heights in actual built Three.js scene
            let southWallCount = 0;
            app.scene.traverse((obj) => {
                if (obj.isMesh && obj.userData?.isWall && obj.userData?.isSouthFace) {
                    southWallCount++;
                    assert.ok(obj.userData.wallHeight <= 1.2);
                    const box = new THREE.Box3().setFromObject(obj);
                    assert.ok(box.max.y <= 1.4, `South wall 3D top ${box.max.y} exceeded 1.4`);
                }
            });
            assert.ok(southWallCount > 0, 'Expected South cutaway wall meshes in scene');

            // Verify player has universal torch light
            assert.ok(app.playerTorchLight instanceof THREE.PointLight);
            assert.ok(app.playerTorchLight.intensity > 0);

            // Verify 9 rooms start shrouded while entrance starts revealed
            assert.equal(app.roomVisuals.get('entrance').shroudGroup.visible, false);
            assert.equal(app.roomVisuals.get('room_1_foyer').shroudGroup.visible, true);

            // Verify disposal runs cleanly
            app.dispose();
            assert.equal(app.disposed, true);
        }
    });
});
