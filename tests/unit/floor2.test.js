import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../vendor/three.module.js';

import {
    FLOOR_2,
    createFloor2Layout,
    validateFloor2,
    buildNavGrid
} from '../../js/floor2Layout.js';
import {
    PUZZLE_TYPES,
    PUZZLE_DEFINITIONS,
    createPuzzleState,
    applyPuzzleInput,
    evaluatePuzzleAttempt,
    getPuzzleHint
} from '../../js/puzzles.js';
import {
    MONSTERS,
    FLOOR2_MONSTERS,
    ALL_MONSTERS,
    CONSUMABLE_ITEMS,
    getMonsterTemplate,
    CombatStage3D
} from '../../js/combat.js';
import {
    FLOOR2_MONSTER_IDS,
    PUZZLE_PROP_TYPES,
    buildOverworldMonster,
    updateOverworldMonster,
    buildPuzzleProp,
    updatePuzzlePropVisual
} from '../../js/overworldProps.js';
import { createFloor2Run, createFloorRun } from '../../js/encounters.js';
import { DungeonWorldApp } from '../../js/dungeonWorld.js';
import { ANCESTRY_DATA, CLASS_DATA, calculateStats } from '../../js/stats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, '../../src/app');

function readDirFiles(dir, ext) {
    let out = '';
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out += readDirFiles(full, ext);
        else if (entry.name.endsWith(ext)) out += '\n' + fs.readFileSync(full, 'utf8');
    }
    return out;
}

const appTemplates = readDirFiles(appDir, '.html');
const appScripts = readDirFiles(appDir, '.ts');

function aabbOverlapArea(a, b) {
    const ox = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
    const oz = Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));
    return ox * oz;
}

describe('FLOOR_2 layout, validation, sightlines & nav-grid', () => {
    it('exports frozen FLOOR_2 schema with 9 rooms, 8 corridors, 2 locked doors, and theme', () => {
        assert.equal(FLOOR_2.id, 2);
        assert.equal(FLOOR_2.name, 'Floor 2: The Sunken Arcanum');
        assert.equal(FLOOR_2.gridSize, 1.0);
        assert.deepEqual(FLOOR_2.spawnPoint, { x: 0, z: 21 });
        assert.equal(Object.isFrozen(FLOOR_2), true);
        assert.equal(Object.isFrozen(FLOOR_2.rooms), true);
        assert.equal(FLOOR_2.rooms.length, 9);
        assert.equal(FLOOR_2.corridors.length, 8);
        assert.equal(FLOOR_2.doors.length, 2);
        assert.ok(FLOOR_2.theme && typeof FLOOR_2.theme.background === 'number');

        const puzzles = FLOOR_2.rooms.filter((r) => r.inhabitantType === 'puzzle');
        const monsters = FLOOR_2.rooms.filter((r) => r.inhabitantType === 'monster');
        assert.equal(puzzles.length, 3);
        assert.equal(monsters.length, 4);

        assert.deepEqual(validateFloor2(FLOOR_2), { valid: true, errors: [] });
    });

    it('has zero wall overlap, zero perimeter gaps, low South cutaways, and clear camera sightlines', () => {
        const { walls, rooms, corridors } = FLOOR_2;
        for (let i = 0; i < walls.length; i++) {
            for (let j = i + 1; j < walls.length; j++) {
                assert.equal(aabbOverlapArea(walls[i], walls[j]), 0, `Walls ${i} and ${j} overlap`);
            }
        }

        const southWalls = walls.filter((w) => w.isSouthFace);
        assert.ok(southWalls.length > 0);
        for (const w of southWalls) {
            assert.ok(w.height <= 1.4, `South wall height ${w.height} exceeds 1.4`);
        }

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
                    assert.equal(isWallAt(cx, cz), true, `Missing wall at (${cx}, ${cz})`);
                }
            }
        }

        const nav = buildNavGrid(FLOOR_2, new Set(['door_f2_rune_gate', 'door_f2_obsidian_seal']));
        for (const room of rooms) {
            for (let gx = room.bounds.minX; gx < room.bounds.maxX; gx++) {
                for (let gz = room.bounds.minZ; gz < room.bounds.maxZ; gz++) {
                    const px = gx + 0.5;
                    const pz = gz + 0.5;
                    assert.equal(nav.isWalkableWorld(px, pz), true);
                    const camZ = pz + 10;
                    for (const w of walls) {
                        if (px < w.minX || px > w.maxX) continue;
                        const ozMin = Math.max(pz, w.minZ);
                        const ozMax = Math.min(camZ, w.maxZ);
                        if (ozMin >= ozMax) continue;
                        const d = ozMin - pz;
                        const rayBootsY = 1.4 * d;
                        const rayTorsoY = 1.0 + 1.3 * d;
                        if (w.isSouthFace) {
                            assert.ok(rayTorsoY > w.height);
                        } else {
                            assert.ok(rayBootsY >= w.height - 1e-6);
                        }
                    }
                }
            }
        }
    });

    it('rejects invalid Floor 2 layout mutations and verifies locked/unlocked nav-grid paths', () => {
        assert.equal(validateFloor2(null).valid, false);

        const badType = createFloor2Layout();
        badType.rooms.find((r) => r.id === 'f2_west_puzzle').inhabitantType = 'trap';
        assert.equal(validateFloor2(badType).valid, false);

        const badWall = createFloor2Layout();
        badWall.walls.find((w) => w.isSouthFace).height = 4.0;
        assert.equal(validateFloor2(badWall).valid, false);

        const badDoor = createFloor2Layout();
        badDoor.doors.find((d) => d.id === 'door_f2_rune_gate').width = 0.2;
        assert.equal(validateFloor2(badDoor).valid, false);

        const centerOf = (id) => {
            const r = FLOOR_2.rooms.find((rm) => rm.id === id);
            return { x: (r.bounds.minX + r.bounds.maxX) / 2, z: (r.bounds.minZ + r.bounds.maxZ) / 2 };
        };

        const navLocked = buildNavGrid(FLOOR_2, new Set());
        assert.ok(navLocked.findPath(FLOOR_2.spawnPoint, centerOf('f2_west_puzzle')).length > 0);
        assert.ok(navLocked.findPath(FLOOR_2.spawnPoint, centerOf('f2_east_mobs')).length > 0);
        assert.equal(navLocked.findPath(FLOOR_2.spawnPoint, centerOf('f2_central_hall')).length, 0);
        assert.equal(navLocked.findPath(FLOOR_2.spawnPoint, centerOf('f2_sanctum')).length, 0);

        const navHalf = buildNavGrid(FLOOR_2, new Set(['door_f2_rune_gate']));
        assert.ok(navHalf.findPath(FLOOR_2.spawnPoint, centerOf('f2_north_puzzle')).length > 0);
        assert.equal(navHalf.findPath(FLOOR_2.spawnPoint, centerOf('f2_sanctum')).length, 0);

        const navAll = buildNavGrid(FLOOR_2, new Set(['door_f2_rune_gate', 'door_f2_obsidian_seal']));
        for (const r of FLOOR_2.rooms) {
            assert.ok(navAll.findPath(FLOOR_2.spawnPoint, centerOf(r.id)).length > 0);
        }
    });
});

describe('Interactive Puzzle Engine (js/puzzles.js)', () => {
    it('defines all 3 puzzle types with valid rewards and clues', () => {
        assert.deepEqual(PUZZLE_TYPES, ['rune_sequence', 'mirror_alignment', 'alchemist_scales']);
        assert.equal(Object.keys(PUZZLE_DEFINITIONS).length, 3);
    });

    it('solves rune_sequence after wrong attempt retry', () => {
        const state = createPuzzleState('puzzle_twin_moons');
        for (const r of ['star', 'full', 'eclipse']) {
            const step = applyPuzzleInput(state, { type: 'select_rune', runeId: r });
            assert.equal(step.autoEvaluate, false);
        }
        const fourth = applyPuzzleInput(state, { type: 'select_rune', runeId: 'crescent' });
        assert.equal(fourth.autoEvaluate, true);

        const failRes = evaluatePuzzleAttempt(state);
        assert.equal(failRes.solved, false);
        assert.equal(failRes.failDamage, 8);
        assert.deepEqual(state.sequence, []);

        const hint = getPuzzleHint(state);
        assert.ok(hint.includes('Crescent'));
        assert.equal(state.hintUsed, true);

        for (const r of ['crescent', 'eclipse', 'full', 'star']) {
            applyPuzzleInput(state, { type: 'select_rune', runeId: r });
        }
        const winRes = evaluatePuzzleAttempt(state);
        assert.equal(winRes.solved, true);
        assert.equal(winRes.unlocksDoorId, 'door_f2_rune_gate');
        assert.equal(state.solved, true);
    });

    it('solves mirror_alignment via rotations', () => {
        const state = createPuzzleState('puzzle_mirror_relay');
        const failRes = evaluatePuzzleAttempt(state);
        assert.equal(failRes.solved, false);

        const hint = getPuzzleHint(state);
        assert.ok(hint.includes('West Prism'));

        // Initial: ['S', 'W', 'E'] -> Target: ['E', 'N', 'N']
        // West: S -> W -> N -> E (3 clicks)
        applyPuzzleInput(state, { type: 'rotate_mirror', index: 0 });
        applyPuzzleInput(state, { type: 'rotate_mirror', index: 0 });
        applyPuzzleInput(state, { type: 'rotate_mirror', index: 0 });
        // Center: W -> N (1 click)
        applyPuzzleInput(state, { type: 'rotate_mirror', index: 1 });
        // East: E -> S -> W -> N (3 clicks)
        applyPuzzleInput(state, { type: 'rotate_mirror', index: 2 });
        applyPuzzleInput(state, { type: 'rotate_mirror', index: 2 });
        applyPuzzleInput(state, { type: 'rotate_mirror', index: 2 });

        assert.deepEqual(state.mirrorAngles, ['E', 'N', 'N']);
        const winRes = evaluatePuzzleAttempt(state);
        assert.equal(winRes.solved, true);
        assert.equal(winRes.reward.consumable, 'Mana Draught');
    });

    it('solves alchemist_scales for multiple valid 3-weight combinations summing to 15', () => {
        const s1 = createPuzzleState('puzzle_alchemist_scales');
        applyPuzzleInput(s1, { type: 'toggle_weight', weight: 2 });
        applyPuzzleInput(s1, { type: 'toggle_weight', weight: 4 });
        applyPuzzleInput(s1, { type: 'toggle_weight', weight: 5 }); // sum 11 -> wrong
        assert.equal(evaluatePuzzleAttempt(s1).solved, false);

        // Toggle 5 off, toggle 9 on -> 2 + 4 + 9 = 15
        applyPuzzleInput(s1, { type: 'toggle_weight', weight: 5 });
        applyPuzzleInput(s1, { type: 'toggle_weight', weight: 9 });
        const win1 = evaluatePuzzleAttempt(s1);
        assert.equal(win1.solved, true);
        assert.equal(win1.unlocksDoorId, 'door_f2_obsidian_seal');

        // Also test 4 + 5 + 6 = 15
        const s2 = createPuzzleState('puzzle_alchemist_scales');
        const hint = getPuzzleHint(s2);
        assert.ok(hint.includes('15'));
        for (const w of [4, 5, 6]) {
            applyPuzzleInput(s2, { type: 'toggle_weight', weight: w });
        }
        assert.equal(evaluatePuzzleAttempt(s2).solved, true);
    });
});

describe('Floor 2 monsters, combat models & overworld puzzle props', () => {
    it('exports FLOOR2_MONSTERS, ALL_MONSTERS, and getMonsterTemplate safely', () => {
        assert.deepEqual(
            Object.keys(FLOOR2_MONSTERS).sort(),
            ['arch_lich', 'blight_ooze', 'obsidian_gargoyle', 'runebound_sentinel']
        );
        assert.equal(Object.keys(ALL_MONSTERS).length, 8);
        assert.equal(getMonsterTemplate('arch_lich').id, 'arch_lich');
        assert.equal(getMonsterTemplate('nonexistent').id, 'skeleton');

        const minHeroHp = Math.min(
            ...Object.keys(ANCESTRY_DATA).flatMap((a) =>
                Object.keys(CLASS_DATA).map((c) => calculateStats(a, c).maxHp)
            )
        );
        for (const [id, m] of Object.entries(FLOOR2_MONSTERS)) {
            assert.equal(m.id, id);
            for (const entry of m.loot) {
                assert.ok(Object.hasOwn(CONSUMABLE_ITEMS, entry.item));
            }
            const maxBasic = m.damageDice.count * m.damageDice.sides + m.damageDice.mod;
            const maxSpecial = Math.round(maxBasic * m.specialMultiplier);
            assert.ok(maxSpecial < minHeroHp, `${id} special damage ${maxSpecial} >= minHeroHp ${minHeroHp}`);
        }
    });

    it('builds distinct 3D combat & overworld models for all 4 Floor 2 monsters', () => {
        const sigs = new Set();
        for (const id of FLOOR2_MONSTER_IDS) {
            const combatModel = CombatStage3D.prototype.buildMonsterModel.call({}, id);
            assert.equal(combatModel.group.name, `Monster_${id}`);

            const overworld = buildOverworldMonster(id, 1.0);
            assert.equal(overworld.monsterId, id);

            let meshCount = 0;
            let lightCount = 0;
            overworld.group.traverse((obj) => {
                if (obj.isMesh) meshCount++;
                if (obj.isLight) lightCount++;
            });
            assert.ok(meshCount >= 10, `${id} meshCount ${meshCount} < 10`);
            assert.equal(lightCount, 0);

            const box = new THREE.Box3().setFromObject(overworld.group);
            assert.ok(box.min.y >= -1e-4, `${id} min.y ${box.min.y} < 0`);
            const size = box.getSize(new THREE.Vector3());

            updateOverworldMonster(overworld, 0.05, 0.1, false);
            updateOverworldMonster(overworld, 0.05, 0.2, true);

            sigs.add(JSON.stringify({ meshCount, dims: [size.x, size.y, size.z].map((v) => Math.round(v * 100)) }));
        }
        assert.equal(sigs.size, 4);
    });

    it('builds and animates 3D puzzle props with 0 embedded PointLights', () => {
        const sigs = new Set();
        for (const pType of PUZZLE_PROP_TYPES) {
            const entry = buildPuzzleProp(pType, false);
            assert.equal(entry.puzzleType, pType);
            let meshes = 0;
            let lights = 0;
            entry.group.traverse((o) => {
                if (o.isMesh) meshes++;
                if (o.isLight) lights++;
            });
            assert.ok(meshes >= 4);
            assert.equal(lights, 0);

            const unsolvedColor = entry.parts.glowMat.color.getHex();
            updatePuzzlePropVisual(entry, true, 0.05, 0.5);
            assert.equal(entry.solved, true);
            assert.notEqual(entry.parts.glowMat.color.getHex(), unsolvedColor);

            const box = new THREE.Box3().setFromObject(entry.group);
            const size = box.getSize(new THREE.Vector3());
            sigs.add(JSON.stringify({ meshes, dims: [size.x, size.y, size.z].map((v) => Math.round(v * 100)) }));
        }
        assert.equal(sigs.size, 3);
    });
});

describe('Floor 2 run factory, DungeonWorldApp & index.html wiring', () => {
    it('creates isolated Floor 2 runs via createFloor2Run and createFloorRun(2)', () => {
        const r1 = createFloor2Run();
        const r2 = createFloorRun(2);
        assert.equal(r1.floor.id, 2);
        assert.equal(r2.floor.id, 2);

        const puzzles = r1.encounters.filter((e) => e.kind === 'puzzle');
        const combats = r1.encounters.filter((e) => e.kind === 'combat');
        const doors = r1.encounters.filter((e) => e.kind === 'door');
        const exits = r1.encounters.filter((e) => e.kind === 'exit');

        assert.equal(puzzles.length, 3);
        assert.equal(combats.length, 4);
        assert.equal(doors.length, 2);
        assert.equal(exits.length, 1);
        assert.equal(exits[0].id, 'f2_exit_seal');

        r1.encounters[0].resolved = true;
        assert.equal(r2.encounters[0].resolved, false);
    });

    it('runs DungeonWorldApp on Floor 2 and unlocks doors when linked puzzles are solved', () => {
        const app = new DungeonWorldApp(
            null,
            { name: 'Lyra', ancestry: 'elf', charClass: 'mage' },
            () => {},
            () => {},
            { headless: true, floorNumber: 2 }
        );
        assert.equal(app.floor.id, 2);
        assert.equal(app.getRunSummary().floorId, 2);
        assert.equal(app.unlockedDoorIds.has('door_f2_rune_gate'), false);

        app.resolveEncounterVisual('puzzle_twin_moons', false);
        assert.equal(app.unlockedDoorIds.has('door_f2_rune_gate'), false);

        app.resolveEncounterVisual('puzzle_twin_moons', true);
        assert.equal(app.unlockedDoorIds.has('door_f2_rune_gate'), true);

        app.resolveEncounterVisual('puzzle_alchemist_scales', true);
        assert.equal(app.unlockedDoorIds.has('door_f2_obsidian_seal'), true);
        app.dispose();
    });

    it('constructs Floor 2 3D scene graph within <= 8 PointLights and low South cutaways', () => {
        const app = new DungeonWorldApp(
            null,
            { name: 'Vex', ancestry: 'human', charClass: 'warrior' },
            () => {},
            () => {},
            { headless: true, floorNumber: 2 }
        );
        app.scene = new THREE.Scene();
        app.envLightPool = [];
        for (let i = 0; i < 6; i++) {
            const l = new THREE.PointLight(0xff9933, 0, 15, 1.2);
            l.visible = false;
            app.scene.add(l);
            app.envLightPool.push(l);
        }
        const reticle = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.42, 4), new THREE.MeshBasicMaterial());
        app.clickReticle = reticle;
        app.scene.add(reticle);

        app.buildDungeonEnvironment();
        app.spawnEncounters();
        app.spawnPlayer();
        app.refreshVisibilityAndLights(0, true);

        let pointLightCount = 0;
        let southMaxH = 0;
        app.scene.traverse((obj) => {
            if (obj.isPointLight) pointLightCount++;
            if (obj.userData?.isWall && obj.userData?.isSouthFace) {
                southMaxH = Math.max(southMaxH, obj.userData.wallHeight);
            }
        });
        assert.ok(pointLightCount <= 8, `Expected <= 8 PointLights, got ${pointLightCount}`);
        assert.ok(southMaxH <= 1.4, `Expected South wall cutaway <= 1.4, got ${southMaxH}`);
        app.dispose();
    });

    it('contains Floor 2 DOM controls and valid Angular wiring in src/app', () => {
        for (const id of [
            'floorSelectForge',
            'btnDescendFloor2',
            'btnShopFloor2Delve',
            'puzzleModal',
            'puzzleIcon',
            'puzzleTitle',
            'puzzleClue',
            'puzzleStage',
            'puzzleStatusText',
            'btnPuzzleHint',
            'btnPuzzleStepBack',
            'btnPuzzleContinue'
        ]) {
            assert.match(appTemplates, new RegExp(`id=["']${id}["']`), `Missing #${id}`);
        }
        assert.match(appScripts, /getMonsterTemplate\s*\(/);
        assert.match(appScripts, /createPuzzleState\s*\(/);
        assert.match(appScripts, /floorNumber\s*[,:]/);
    });
});
