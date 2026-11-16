import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import {
    MONSTERS,
    CONSUMABLE_ITEMS,
    rollDiceFormula,
    chooseMonsterAction,
    CombatStage3D
} from '../../js/combat.js';
import { ANCESTRY_DATA, CLASS_DATA, calculateStats } from '../../js/stats.js';

function createHeadlessStage(overrides = {}) {
    const stage = Object.create(CombatStage3D.prototype);
    stage.heroPos = new THREE.Vector3(-1.25, -0.10, 1.05);
    stage.enemyPos = new THREE.Vector3(1.35, 0.15, -0.95);
    stage.heroScale = 1.22;
    stage.enemyScale = 1.32;
    stage.monsterScale = 1.0;
    stage.currentMonsterScale = 1.0;
    stage.currentMonsterId = 'skeleton';
    stage.heroAnchor = new THREE.Group();
    stage.heroAnchor.position.copy(stage.heroPos);
    stage.enemyAnchor = new THREE.Group();
    stage.enemyAnchor.position.copy(stage.enemyPos);
    stage.heroModel = null;
    stage.enemyModel = null;
    stage.guardAura = null;
    stage.torchFlames = [];
    stage.projectiles = [];
    stage.particles = [];
    stage.heroAnim = null;
    stage.enemyAnim = null;
    stage.heroDefending = false;
    stage.enemyDefeated = false;
    stage.scene = null;
    stage.camera = null;
    stage.renderer = null;
    stage.rafId = null;
    stage.active = false;
    Object.assign(stage, overrides);
    return stage;
}

describe('MONSTERS roster & Floor 1 balance', () => {
    it('exports all 4 required Floor 1 monsters', () => {
        assert.deepEqual(
            Object.keys(MONSTERS).sort(),
            ['crypt_ghoul', 'crypt_spider', 'shadow_wraith', 'skeleton']
        );
    });

    it('validates schema, stats, special attacks, and rewards for every monster', () => {
        for (const [key, m] of Object.entries(MONSTERS)) {
            assert.equal(m.id, key);
            assert.equal(typeof m.name, 'string');
            assert.ok(m.name.trim().length > 0);
            assert.equal(typeof m.icon, 'string');
            assert.ok(m.icon.length > 0);
            assert.equal(typeof m.attackName, 'string');
            assert.ok(m.attackName.trim().length > 0);
            assert.equal(typeof m.specialAttackName, 'string');
            assert.ok(m.specialAttackName.trim().length > 0);
            assert.equal(typeof m.description, 'string');
            assert.ok(m.description.trim().length > 0);

            assert.ok(Number.isInteger(m.maxHp) && m.maxHp > 0 && m.maxHp <= 70, `${key} maxHp out of bounds`);
            assert.ok(Number.isInteger(m.ac) && m.ac >= 8 && m.ac <= 18, `${key} ac out of bounds`);
            assert.ok(Number.isInteger(m.attackBonus) && m.attackBonus >= 1 && m.attackBonus <= 8, `${key} attackBonus out of bounds`);

            assert.ok(m.damageDice && typeof m.damageDice === 'object');
            assert.ok(Number.isInteger(m.damageDice.count) && m.damageDice.count >= 1);
            assert.ok(Number.isInteger(m.damageDice.sides) && m.damageDice.sides >= 4);
            assert.ok(Number.isInteger(m.damageDice.mod));

            assert.ok(typeof m.specialChance === 'number' && m.specialChance > 0 && m.specialChance <= 1);
            assert.ok(typeof m.specialMultiplier === 'number' && m.specialMultiplier > 1);
            assert.ok(Number.isInteger(m.xpReward) && m.xpReward > 0);
            assert.ok(Number.isInteger(m.goldReward) && m.goldReward >= 0);
            assert.ok(Array.isArray(m.loot) && m.loot.length > 0);
        }
    });

    it('matches Floor 1 balance profiles against actual Level-1 hero HP bounds (72..287)', () => {
        const heroHps = [];
        for (const ancestry of Object.keys(ANCESTRY_DATA)) {
            for (const charClass of Object.keys(CLASS_DATA)) {
                heroHps.push(calculateStats(ancestry, charClass).maxHp);
            }
        }
        const minHeroHp = Math.min(...heroHps);
        const maxHeroHp = Math.max(...heroHps);
        assert.equal(minHeroHp, 72);
        assert.equal(maxHeroHp, 287);

        const spider = MONSTERS.crypt_spider;
        assert.equal(spider.name, 'Crypt Widow');
        assert.ok(spider.maxHp >= 26 && spider.maxHp <= 36);
        assert.ok(spider.ac >= 11 && spider.ac <= 13);
        assert.equal(spider.attackBonus, 3);
        assert.deepEqual(spider.damageDice, { count: 1, sides: 6, mod: 2 });
        assert.equal(spider.specialAttackName, 'Venomous Fang Lunge');

        const wraith = MONSTERS.shadow_wraith;
        assert.equal(wraith.name, 'Hollow Wraith');
        assert.ok(wraith.maxHp >= 40 && wraith.maxHp <= 50);
        assert.ok(wraith.ac >= 12 && wraith.ac <= 14);
        assert.equal(wraith.attackBonus, 4);
        assert.deepEqual(wraith.damageDice, { count: 1, sides: 8, mod: 2 });
        assert.equal(wraith.specialAttackName, 'Soul Chill Drain');

        for (const [key, m] of Object.entries(MONSTERS)) {
            const maxBasic = m.damageDice.count * m.damageDice.sides + m.damageDice.mod;
            const maxSpecial = Math.round(maxBasic * m.specialMultiplier);
            assert.ok(maxBasic < minHeroHp, `${key} basic max damage ${maxBasic} >= min hero HP ${minHeroHp}`);
            assert.ok(maxSpecial < minHeroHp, `${key} special max damage ${maxSpecial} >= min hero HP ${minHeroHp}`);
        }
    });
});

describe('CONSUMABLE_ITEMS & loot referential integrity', () => {
    it('includes Ancient Bone Ring with a valid usable mechanical effect', () => {
        const ring = CONSUMABLE_ITEMS['Ancient Bone Ring'];
        assert.ok(ring, 'Ancient Bone Ring must exist in CONSUMABLE_ITEMS');
        assert.equal(ring.name, 'Ancient Bone Ring');
        assert.equal(typeof ring.icon, 'string');
        assert.ok(ring.icon.length > 0);
        assert.equal(typeof ring.desc, 'string');
        assert.ok(ring.desc.trim().length > 0);
        assert.equal(typeof ring.value, 'number');
        assert.ok(Number.isFinite(ring.value) && ring.value > 0);
        assert.ok(['heal_hp', 'heal_mp', 'damage_undead'].includes(ring.type));
    });

    it('validates schemas for all CONSUMABLE_ITEMS entries', () => {
        for (const [key, item] of Object.entries(CONSUMABLE_ITEMS)) {
            assert.equal(item.name, key);
            assert.equal(typeof item.icon, 'string');
            assert.ok(item.icon.length > 0);
            assert.equal(typeof item.type, 'string');
            assert.ok(item.type.length > 0);
            assert.equal(typeof item.desc, 'string');
            assert.ok(item.desc.trim().length > 0);
            assert.ok(typeof item.value === 'number' && Number.isFinite(item.value) && item.value > 0);
        }
    });

    it('every monster loot item exists in CONSUMABLE_ITEMS with valid drop chance', () => {
        for (const m of Object.values(MONSTERS)) {
            for (const entry of m.loot) {
                assert.ok(
                    Object.hasOwn(CONSUMABLE_ITEMS, entry.item),
                    `Dangling loot item "${entry.item}" on monster "${m.id}"`
                );
                assert.ok(
                    typeof entry.chance === 'number' && entry.chance > 0 && entry.chance <= 1,
                    `Invalid loot chance ${entry.chance} on monster "${m.id}"`
                );
            }
        }
    });
});

describe('rollDiceFormula', () => {
    it('rolls 1d6+2 within bounds [3, 8] in both numeric and string forms', () => {
        for (let i = 0; i < 200; i++) {
            const numRes = rollDiceFormula(1, 6, 2);
            assert.equal(numRes.rolls.length, 1);
            assert.ok(Number.isInteger(numRes.rolls[0]) && numRes.rolls[0] >= 1 && numRes.rolls[0] <= 6);
            assert.equal(numRes.mod, 2);
            assert.equal(numRes.total, numRes.rolls[0] + 2);
            assert.ok(numRes.total >= 3 && numRes.total <= 8);

            const strRes = rollDiceFormula('1d6+2');
            assert.equal(strRes.rolls.length, 1);
            assert.ok(Number.isInteger(strRes.rolls[0]) && strRes.rolls[0] >= 1 && strRes.rolls[0] <= 6);
            assert.equal(strRes.mod, 2);
            assert.equal(strRes.total, strRes.rolls[0] + 2);
            assert.ok(strRes.total >= 3 && strRes.total <= 8);
        }
    });

    it('rolls 1d8+2 within bounds [3, 10] in both numeric and string forms', () => {
        for (let i = 0; i < 200; i++) {
            const numRes = rollDiceFormula(1, 8, 2);
            assert.equal(numRes.rolls.length, 1);
            assert.ok(Number.isInteger(numRes.rolls[0]) && numRes.rolls[0] >= 1 && numRes.rolls[0] <= 8);
            assert.equal(numRes.mod, 2);
            assert.equal(numRes.total, numRes.rolls[0] + 2);
            assert.ok(numRes.total >= 3 && numRes.total <= 10);

            const strRes = rollDiceFormula('1d8+2');
            assert.equal(strRes.rolls.length, 1);
            assert.ok(Number.isInteger(strRes.rolls[0]) && strRes.rolls[0] >= 1 && strRes.rolls[0] <= 8);
            assert.equal(strRes.mod, 2);
            assert.equal(strRes.total, strRes.rolls[0] + 2);
            assert.ok(strRes.total >= 3 && strRes.total <= 10);
        }
    });

    it('handles subtraction modifiers, floor clamp >= 1, and no-bonus formulas', () => {
        for (let i = 0; i < 100; i++) {
            const subStr = rollDiceFormula('1d6 - 2');
            assert.equal(subStr.mod, -2);
            assert.ok(subStr.total >= 1 && subStr.total <= 4);

            const subNum = rollDiceFormula(1, 6, -2);
            assert.equal(subNum.mod, -2);
            assert.ok(subNum.total >= 1 && subNum.total <= 4);
        }

        for (let i = 0; i < 50; i++) {
            assert.equal(rollDiceFormula('1d6-10').total, 1);
            assert.equal(rollDiceFormula(1, 6, -10).total, 1);

            const plainStr = rollDiceFormula('1d8');
            assert.equal(plainStr.mod, 0);
            assert.ok(plainStr.total >= 1 && plainStr.total <= 8);

            const plainNum = rollDiceFormula(1, 8);
            assert.equal(plainNum.mod, 0);
            assert.ok(plainNum.total >= 1 && plainNum.total <= 8);
        }
    });

    it('handles invalid and empty formulas safely without throwing or returning NaN', () => {
        const invalidCases = [
            [''],
            ['   '],
            ['invalid'],
            ['2d'],
            ['d6'],
            ['0d6'],
            ['1d0'],
            [null],
            [undefined],
            [0, 6, 0],
            [-2, 6, 0],
            [1, 0, 0],
            [Number.NaN, 6, 0],
            [1, 6, Number.NaN]
        ];
        for (const args of invalidCases) {
            const res = rollDiceFormula(...args);
            assert.deepEqual(res, { total: 0, rolls: [], mod: 0 });
            assert.ok(Number.isFinite(res.total));
            assert.ok(Number.isFinite(res.mod));
        }
    });
});

describe('chooseMonsterAction', () => {
    it('deterministically selects normal vs special action based on specialChance and rng', () => {
        const spider = MONSTERS.crypt_spider;

        const specialAct = chooseMonsterAction(spider, 2, () => 0.0);
        assert.equal(specialAct.isSpecial, true);
        assert.equal(specialAct.type, 'special');
        assert.equal(specialAct.kind, 'special');
        assert.equal(specialAct.name, spider.specialAttackName);
        assert.equal(specialAct.attackName, spider.specialAttackName);
        assert.equal(specialAct.attackBonus, spider.attackBonus);
        assert.deepEqual(specialAct.damageDice, spider.damageDice);
        assert.ok(specialAct.multiplier > 1);
        assert.equal(specialAct.turnCount, 2);

        const edgeSpecial = chooseMonsterAction(spider, 3, () => 0.2999);
        assert.equal(edgeSpecial.isSpecial, true);

        const basicAct = chooseMonsterAction(spider, 1, () => 0.3);
        assert.equal(basicAct.isSpecial, false);
        assert.equal(basicAct.type, 'basic');
        assert.equal(basicAct.kind, 'normal');
        assert.equal(basicAct.name, spider.attackName);
        assert.equal(basicAct.attackName, spider.attackName);
        assert.equal(basicAct.multiplier, 1);

        const neverSpecial = chooseMonsterAction({ ...spider, specialChance: 0 }, 1, () => 0.0);
        assert.equal(neverSpecial.isSpecial, false);

        const alwaysSpecial = chooseMonsterAction({ ...spider, specialChance: 1.5 }, 1, () => 0.9999);
        assert.equal(alwaysSpecial.isSpecial, true);

        const nullFallback = chooseMonsterAction(null, 1, () => 0.0);
        assert.equal(nullFallback.isSpecial, false);
        assert.equal(nullFallback.name, 'Attack');
        assert.equal(nullFallback.multiplier, 1);
        assert.ok(Number.isFinite(nullFallback.attackBonus));
    });

    it('uses Math.random when rng is omitted and covers both normal and special turns statistically', () => {
        const m1 = mock.method(Math, 'random', () => 0.01);
        try {
            const act = chooseMonsterAction(MONSTERS.skeleton, 1);
            assert.equal(act.isSpecial, true);
            assert.equal(act.attackName, MONSTERS.skeleton.specialAttackName);
        } finally {
            m1.mock.restore();
        }

        const m2 = mock.method(Math, 'random', () => 0.99);
        try {
            const act = chooseMonsterAction(MONSTERS.skeleton, 2);
            assert.equal(act.isSpecial, false);
            assert.equal(act.attackName, MONSTERS.skeleton.attackName);
        } finally {
            m2.mock.restore();
        }

        let specialCount = 0;
        let basicCount = 0;
        const trials = 500;
        for (let i = 0; i < trials; i++) {
            const act = chooseMonsterAction(MONSTERS.shadow_wraith, i + 1);
            if (act.isSpecial) specialCount++;
            else basicCount++;
        }
        assert.ok(specialCount > 0 && basicCount > 0);
        const ratio = specialCount / trials;
        assert.ok(ratio > 0.15 && ratio < 0.45, `Unexpected special ratio ${ratio}`);
    });
});

describe('CombatStage3D in Node (models, defeat scale math & attack cues)', () => {
    it('buildMonsterModel builds distinct valid THREE.Group hierarchies for all 4 monster IDs', () => {
        const signatures = new Set();

        for (const id of Object.keys(MONSTERS)) {
            const directCallModel = CombatStage3D.prototype.buildMonsterModel.call({}, id);
            assert.ok(directCallModel.group instanceof THREE.Group);

            const stage = Object.create(CombatStage3D.prototype);
            const model = stage.buildMonsterModel(id);

            assert.ok(model.group instanceof THREE.Group);
            assert.equal(model.group.name, `Monster_${id}`);
            assert.equal(model.group.userData.monsterId, id);
            assert.ok(model.animState && typeof model.animState.time === 'number');
            assert.equal(model.animState.monsterId, id);

            let meshCount = 0;
            let lightCount = 0;
            const geoTypes = new Set();

            model.group.traverse((obj) => {
                if (obj.isMesh) {
                    meshCount++;
                    assert.ok(obj.geometry, `${id} mesh missing geometry`);
                    assert.ok(obj.material, `${id} mesh missing material`);
                    geoTypes.add(obj.geometry.type);
                    if (!obj.userData?.noShadow) {
                        assert.equal(obj.castShadow, true, `${id} solid mesh should castShadow`);
                    }
                }
                if (obj.isLight) lightCount++;
            });

            assert.ok(meshCount >= 10, `${id} should have >= 10 meshes, got ${meshCount}`);
            assert.equal(lightCount, 0, `${id} should not embed extra PointLights`);

            const box = new THREE.Box3().setFromObject(model.group);
            assert.equal(box.isEmpty(), false);
            assert.ok(box.min.y >= 0, `${id} model min.y (${box.min.y}) should not clip below pedestal`);
            const size = box.getSize(new THREE.Vector3());
            assert.ok(size.x > 0.4 && size.y > 0.8 && size.z > 0.4);

            if (id === 'crypt_spider') {
                assert.ok(Array.isArray(model.animState.spiderLegs));
                assert.equal(model.animState.spiderLegs.length, 8);
                assert.ok(Array.isArray(model.animState.fangs));
                assert.equal(model.animState.fangs.length, 2);
                assert.ok(model.animState.abdomen instanceof THREE.Group);
            }
            if (id === 'shadow_wraith') {
                assert.ok(Array.isArray(model.animState.shroudTails));
                assert.ok(model.animState.shroudTails.length >= 6);
                assert.ok(model.animState.auraGroup instanceof THREE.Group);
                assert.equal(model.animState.auraGroup.userData.noShadow, true);
                assert.ok(model.animState.soulCore instanceof THREE.Mesh);
            }

            const sig = JSON.stringify({
                meshCount,
                dims: [size.x, size.y, size.z].map((v) => Math.round(v * 100)),
                geos: [...geoTypes].sort()
            });
            signatures.add(sig);
        }

        assert.equal(signatures.size, 4, 'All 4 monster models must be structurally distinct');
    });

    it('playMonsterDefeat and update() scale relative to enemyScale and monsterScale without WebGL', () => {
        const spiderModel = CombatStage3D.prototype.buildMonsterModel.call({}, 'crypt_spider');
        const stage = createHeadlessStage({
            enemyScale: 2.0,
            monsterScale: 1.5,
            currentMonsterScale: 1.5,
            currentMonsterId: 'crypt_spider',
            enemyModel: spiderModel
        });
        stage.enemyAnchor.scale.setScalar(3.0);

        stage.playMonsterDefeat();
        assert.equal(stage.enemyDefeated, true);
        assert.equal(stage.enemyAnim?.kind, 'defeat');

        // p = 0 must preserve startScale = 2.0 * 1.5 = 3.0 without resetting
        stage.update(0);
        assert.ok(Math.abs(stage.enemyAnchor.scale.x - 3.0) < 1e-6);

        // p = 0.5 (t = 0.325 / 0.65) -> scale = 3.0 * (1 - 0.5 * 0.35) = 2.475
        stage.update(0.325);
        assert.ok(Math.abs(stage.enemyAnchor.scale.x - 2.475) < 1e-6);
        assert.ok(stage.enemyAnchor.rotation.x < 0);
        assert.ok(stage.enemyAnchor.position.y < stage.enemyPos.y);

        // Proportionality across distinct enemyScale values
        const stageA = createHeadlessStage({ enemyScale: 1.0, monsterScale: 1.0, currentMonsterScale: 1.0 });
        const stageB = createHeadlessStage({ enemyScale: 2.5, monsterScale: 1.0, currentMonsterScale: 1.0 });
        stageA.playMonsterDefeat();
        stageB.playMonsterDefeat();
        stageA.update(0.325);
        stageB.update(0.325);
        assert.ok(Math.abs(stageB.enemyAnchor.scale.x / stageA.enemyAnchor.scale.x - 2.5) < 1e-6);

        // Stub using only currentMonsterScale without monsterScale
        const legacyStub = createHeadlessStage({
            enemyScale: 1.5,
            monsterScale: undefined,
            currentMonsterScale: 1.2
        });
        legacyStub.playMonsterDefeat();
        legacyStub.update(0);
        assert.ok(Math.abs(legacyStub.enemyAnchor.scale.x - 1.8) < 1e-6);

        // Completion clamps cleanly and clears enemyAnim
        stage.update(0.5);
        assert.equal(stage.enemyAnim, null);
        assert.ok(Math.abs(stage.enemyAnchor.scale.x - 3.0 * 0.65) < 1e-6);
    });

    it('supports normal and special attack animation cues across all 4 monster types', () => {
        const expectedSpecialKinds = {
            crypt_spider: 'special_venom',
            shadow_wraith: 'special_drain',
            crypt_ghoul: 'special_pounce',
            skeleton: 'special_bash'
        };

        for (const [id, expectedKind] of Object.entries(expectedSpecialKinds)) {
            const model = CombatStage3D.prototype.buildMonsterModel.call({}, id);
            const stage = createHeadlessStage({
                currentMonsterId: id,
                enemyModel: model
            });

            // Idle animation step
            stage.update(0.15);
            assert.ok(model.animState.time > 0);
            if (id === 'shadow_wraith') {
                assert.ok(model.animState.auraGroup.rotation.y > 0);
                assert.ok(model.animState.soulCore.rotation.y > 0);
            }

            // 0-arg backwards-compatible normal attack
            stage.playEnemyAttack();
            assert.equal(stage.enemyAnim?.kind, 'lunge');
            stage.update(0.3);
            assert.ok(stage.enemyAnchor.position.distanceTo(stage.enemyPos) > 0.1);
            stage.update(0.4);
            assert.equal(stage.enemyAnim, null);
            assert.ok(stage.enemyAnchor.position.distanceTo(stage.enemyPos) < 1e-6);

            // Special attack via playMonsterAttack alias
            stage.playMonsterAttack({ isSpecial: true, monsterId: id });
            assert.equal(stage.enemyAnim?.kind, expectedKind);
            stage.update(0.18);
            if (id === 'crypt_spider') {
                assert.ok(model.animState.bodyGroup.rotation.x < 0);
            }
            if (id === 'shadow_wraith') {
                assert.ok(stage.enemyAnchor.position.y > stage.enemyPos.y);
            }
            stage.update(0.22);
            stage.update(0.5);
            assert.equal(stage.enemyAnim, null);
            assert.ok(stage.enemyAnchor.position.distanceTo(stage.enemyPos) < 1e-6);
            assert.equal(model.animState.bodyGroup.rotation.x, 0);

            // Monster hit reaction without scene
            stage.playMonsterHit(true);
            assert.equal(stage.enemyAnim?.kind, 'hit');
            stage.update(0.2);
            stage.update(0.3);
            assert.equal(stage.enemyAnim, null);
            assert.ok(stage.enemyAnchor.position.distanceTo(stage.enemyPos) < 1e-6);
        }

        // Boolean shorthand & dispose() in headless Node
        const stage = createHeadlessStage({ currentMonsterId: 'crypt_spider' });
        stage.playEnemyAttack(true);
        assert.equal(stage.enemyAnim?.kind, 'special_venom');
        stage.dispose();
        assert.equal(stage.active, false);
    });

    it('start() cleans up leftover scene projectiles/particles and resets defeat state across consecutive fights', () => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, 2.5, 0.1, 80);
        const stage = createHeadlessStage({
            scene,
            camera,
            clock: new THREE.Clock(),
            builder: {
                createCharacter: () => ({
                    group: new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.6), new THREE.MeshBasicMaterial()),
                    animState: {},
                    update() {}
                })
            }
        });
        scene.add(stage.heroAnchor);
        scene.add(stage.enemyAnchor);

        stage.start({}, 'crypt_spider', 1.1);
        stage.spawnProjectile(stage.heroPos, stage.enemyPos, 0x38bdf8);
        stage.playMonsterDefeat();
        stage.update(0.1);
        assert.equal(stage.projectiles.length, 1);
        assert.ok(stage.particles.length > 0);
        const staleProjMesh = stage.projectiles[0].mesh;
        const stalePtMesh = stage.particles[0].mesh;
        assert.equal(staleProjMesh.parent, scene);
        assert.equal(stalePtMesh.parent, scene);

        // Starting a second battle must remove prior battle FX from scene & reset enemy defeat state
        stage.start({}, 'shadow_wraith', 1.2);
        assert.equal(staleProjMesh.parent, null);
        assert.equal(stalePtMesh.parent, null);
        assert.equal(stage.projectiles.length, 0);
        assert.equal(stage.particles.length, 0);
        assert.equal(stage.enemyDefeated, false);
        assert.equal(stage.enemyAnchor.rotation.x, 0);
        assert.equal(stage.currentMonsterId, 'shadow_wraith');
        assert.ok(Math.abs(stage.enemyAnchor.scale.x - 1.32 * 1.2) < 1e-6);
        stage.stop();
    });
});
