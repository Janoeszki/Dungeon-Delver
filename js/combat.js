import * as THREE from '../vendor/three.module.js';
import { CharacterBuilder } from './characterBuilder.js';

/**
 * Combat System & Monster Definitions for Dungeon Delver
 * Turn-based D&D 5e inspired tactical combat with D20 rolls, AC, Defend, Consumables & Spells.
 */

export const MONSTERS = {
    skeleton: {
        id: 'skeleton',
        name: 'Skeletal Vanguard',
        icon: '💀',
        maxHp: 38,
        ac: 12, // Armor Class
        attackBonus: 3, // +3 to hit
        damageDice: { count: 1, sides: 8, mod: 2 }, // 1d8 + 2
        attackName: 'Halberd Thrust',
        specialAttackName: 'Bone Shield Bash',
        xpReward: 60,
        goldReward: 35,
        loot: [
            { item: 'Lesser Healing Potion', chance: 0.65 },
            { item: 'Ancient Bone Ring', chance: 0.4 }
        ],
        description: 'An ancient animated crypt warrior wielding a chipped halberd and an iron-rimmed heater shield.'
    },
    crypt_ghoul: {
        id: 'crypt_ghoul',
        name: 'Crypt Stalker Ghoul',
        icon: '🧟',
        maxHp: 46,
        ac: 11,
        attackBonus: 4,
        damageDice: { count: 2, sides: 4, mod: 2 }, // 2d4 + 2
        attackName: 'Paralyzing Claws',
        specialAttackName: 'Necrotic Bite',
        xpReward: 75,
        goldReward: 45,
        loot: [
            { item: 'Mana Draught', chance: 0.7 },
            { item: 'Lesser Healing Potion', chance: 0.5 }
        ],
        description: 'A ravenous undead creature lurking in the crypt shadows with razor teeth and rotting sinew.'
    }
};

export const CONSUMABLE_ITEMS = {
    'Lesser Healing Potion': {
        name: 'Lesser Healing Potion',
        icon: '🧪',
        type: 'heal_hp',
        value: 28,
        desc: 'Restores 28 Hit Points instantly.'
    },
    'Greater Healing Potion': {
        name: 'Greater Healing Potion',
        icon: '🍷',
        type: 'heal_hp',
        value: 55,
        desc: 'Restores 55 Hit Points instantly.'
    },
    'Mana Draught': {
        name: 'Mana Draught',
        icon: '🧪',
        type: 'heal_mp',
        value: 30,
        desc: 'Restores 30 Mana Points.'
    },
    'Holy Water Flask': {
        name: 'Holy Water Flask',
        icon: '✨',
        type: 'damage_undead',
        value: 22,
        desc: 'Shatters upon foe dealing 22 radiant damage.'
    }
};

/**
 * Rolls dice e.g. 1d8 + 2
 */
export function rollDiceFormula(count, sides, mod = 0) {
    let sum = 0;
    const rolls = [];
    for (let i = 0; i < count; i++) {
        const r = Math.floor(Math.random() * sides) + 1;
        rolls.push(r);
        sum += r;
    }
    return {
        total: Math.max(1, sum + mod),
        rolls,
        mod
    };
}

/**
 * 3D Pokémon-Style Combat Stage
 * Renders both combatants on glowing dungeon pedestals with lunge, spell, shield, heal, and hit animations.
 */
export class CombatStage3D {
    constructor(container) {
        this.container = container;
        this.builder = new CharacterBuilder();

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.rafId = null;
        this.active = false;
        this.clock = new THREE.Clock();

        this.heroPos = new THREE.Vector3(-1.35, -0.32, 1.45);
        this.enemyPos = new THREE.Vector3(1.55, 0.45, -1.15);

        this.heroScale = 1.22;
        this.enemyScale = 1.32;

        this.heroAnchor = null;
        this.enemyAnchor = null;
        this.heroModel = null;
        this.enemyModel = null;
        this.guardAura = null;

        this.torchFlames = [];
        this.projectiles = [];
        this.particles = [];

        this.heroAnim = null;
        this.enemyAnim = null;
        this.heroDefending = false;
        this.enemyDefeated = false;

        this._onResize = () => this.resize();
        this.initScene();
    }

    initScene() {
        const width = this.container.clientWidth || 980;
        const height = this.container.clientHeight || 380;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x090d16);
        this.scene.fog = new THREE.FogExp2(0x090d16, 0.085);

        this.camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 50);
        this.camera.position.set(0, 2.85, 6.4);
        this.camera.lookAt(0, 0.85, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        // Lights
        const ambient = new THREE.AmbientLight(0x8899bb, 0.85);
        this.scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xffe0b2, 1.35);
        keyLight.position.set(2, 6, 4);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        this.scene.add(keyLight);

        const heroRimLight = new THREE.PointLight(0x38bdf8, 1.4, 7);
        heroRimLight.position.set(-2.6, 2.2, 2.4);
        this.scene.add(heroRimLight);

        const enemyLight = new THREE.PointLight(0xef4444, 1.5, 7);
        enemyLight.position.set(2.4, 2.3, -2.0);
        this.scene.add(enemyLight);

        this.buildEnvironment();
        this.buildPlatforms();

        // Combatant Anchors
        this.heroAnchor = new THREE.Group();
        this.heroAnchor.position.copy(this.heroPos);
        this.scene.add(this.heroAnchor);

        this.enemyAnchor = new THREE.Group();
        this.enemyAnchor.position.copy(this.enemyPos);
        this.scene.add(this.enemyAnchor);

        window.addEventListener('resize', this._onResize);
    }

    buildEnvironment() {
        // Dungeon Floor
        const floorGeo = new THREE.PlaneGeometry(24, 24);
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x131824, flatShading: true });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.18;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const grid = new THREE.GridHelper(18, 18, 0x2a364d, 0x182030);
        grid.position.y = -0.17;
        this.scene.add(grid);

        // Distant Crypt Stone Pillars with Flickering Torches
        const pillarGeo = new THREE.BoxGeometry(0.75, 4.2, 0.75);
        const pillarMat = new THREE.MeshLambertMaterial({ color: 0x222a3a, flatShading: true });
        const flameGeo = new THREE.OctahedronGeometry(0.16, 0);
        const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa726 });

        [
            { x: -3.6, z: -2.8 },
            { x: 3.8, z: -3.8 }
        ].forEach((pos) => {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(pos.x, 1.9, pos.z);
            pillar.castShadow = true;
            this.scene.add(pillar);

            const torchStick = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.35, 0.14),
                new THREE.MeshLambertMaterial({ color: 0x4e342e })
            );
            torchStick.position.set(pos.x, 2.2, pos.z + 0.42);
            this.scene.add(torchStick);

            const flame = new THREE.Mesh(flameGeo, flameMat);
            flame.position.set(pos.x, 2.45, pos.z + 0.45);
            this.scene.add(flame);
            this.torchFlames.push(flame);

            const tLight = new THREE.PointLight(0xff8f00, 1.1, 8);
            tLight.position.set(pos.x, 2.5, pos.z + 0.6);
            this.scene.add(tLight);
        });
    }

    buildPlatforms() {
        const makePedestal = (pos, baseColor, ringColor, radius = 1.08, height = 0.22) => {
            const group = new THREE.Group();
            group.position.copy(pos);

            const base = new THREE.Mesh(
                new THREE.CylinderGeometry(radius, radius + 0.18, height, 18),
                new THREE.MeshLambertMaterial({ color: baseColor, flatShading: true })
            );
            base.position.y = -height / 2;
            base.receiveShadow = true;
            group.add(base);

            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(radius - 0.06, 0.032, 6, 30),
                new THREE.MeshBasicMaterial({ color: ringColor })
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.y = 0.01;
            group.add(ring);

            this.scene.add(group);
        };

        // Hero Platform (Bottom-Left cyan rune) & Enemy Dais (Top-Right raised crimson rune)
        makePedestal(this.heroPos, 0x1f2b3d, 0x38bdf8, 1.15, 0.24);
        makePedestal(this.enemyPos, 0x231b24, 0xef4444, 1.2, 0.95);

        // Guard Aura Mesh around Hero
        const auraGroup = new THREE.Group();
        auraGroup.position.copy(this.heroPos);

        const shieldDome = new THREE.Mesh(
            new THREE.CylinderGeometry(1.08, 1.08, 1.85, 16, 1, true),
            new THREE.MeshBasicMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.24,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        shieldDome.position.y = 1.02;
        auraGroup.add(shieldDome);

        const shieldRing = new THREE.Mesh(
            new THREE.TorusGeometry(1.1, 0.035, 6, 28),
            new THREE.MeshBasicMaterial({ color: 0x7dd3fc })
        );
        shieldRing.rotation.x = Math.PI / 2;
        shieldRing.position.y = 1.08;
        auraGroup.add(shieldRing);

        auraGroup.visible = false;
        this.guardAura = auraGroup;
        this.scene.add(this.guardAura);
    }

    /**
     * Builds an articulated 3D monster model matching monsterId
     */
    buildMonsterModel(monsterId) {
        const root = new THREE.Group();
        const bodyGroup = new THREE.Group();
        root.add(bodyGroup);

        let leftArm = null;
        let rightArm = null;
        let leftLeg = null;
        let rightLeg = null;
        let head = null;
        let torso = null;

        if (monsterId === 'crypt_ghoul') {
            const skinMat = new THREE.MeshLambertMaterial({ color: 0x5c7a52, flatShading: true });
            const darkMat = new THREE.MeshLambertMaterial({ color: 0x2d3b29, flatShading: true });
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0xa3e635 });
            const clawMat = new THREE.MeshLambertMaterial({ color: 0xd6d3d1, flatShading: true });

            torso = new THREE.Group();
            const chest = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.72, 0.42), skinMat);
            chest.position.y = 0.95;
            chest.rotation.x = 0.2;
            torso.add(chest);

            // Spine ridges
            for (let i = 0; i < 3; i++) {
                const ridge = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 4), darkMat);
                ridge.rotation.x = -Math.PI / 2;
                ridge.position.set(0, 0.75 + i * 0.2, -0.25);
                torso.add(ridge);
            }
            bodyGroup.add(torso);

            head = new THREE.Group();
            head.position.set(0, 1.42, 0.15);
            const skull = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.46), skinMat);
            head.add(skull);

            const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.04), eyeMat);
            eyeL.position.set(-0.12, 0.06, 0.24);
            const eyeR = eyeL.clone();
            eyeR.position.x = 0.12;
            head.add(eyeL, eyeR);

            // Fangs
            [-0.1, 0.1].forEach((fx) => {
                const fang = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 4), clawMat);
                fang.position.set(fx, -0.16, 0.23);
                fang.rotation.x = Math.PI;
                head.add(fang);
            });
            bodyGroup.add(head);

            const makeClawArm = (side) => {
                const arm = new THREE.Group();
                arm.position.set(side * 0.44, 1.2, 0.05);
                const limb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.18), skinMat);
                limb.position.y = -0.32;
                arm.add(limb);

                for (let c = -1; c <= 1; c++) {
                    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22, 4), clawMat);
                    claw.position.set(c * 0.05, -0.74, 0.06);
                    claw.rotation.x = Math.PI * 0.85;
                    arm.add(claw);
                }
                return arm;
            };

            leftArm = makeClawArm(-1);
            rightArm = makeClawArm(1);
            bodyGroup.add(leftArm, rightArm);

            const makeLeg = (side) => {
                const leg = new THREE.Group();
                leg.position.set(side * 0.18, 0.58, 0);
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.58, 0.24), darkMat);
                mesh.position.y = -0.29;
                leg.add(mesh);
                return leg;
            };
            leftLeg = makeLeg(-1);
            rightLeg = makeLeg(1);
            bodyGroup.add(leftLeg, rightLeg);

        } else {
            // Articulated Skeletal Vanguard
            const boneMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0, flatShading: true });
            const ironMat = new THREE.MeshLambertMaterial({ color: 0x64748b, flatShading: true });
            const rustMat = new THREE.MeshLambertMaterial({ color: 0x7f1d1d, flatShading: true });
            const goldTrim = new THREE.MeshLambertMaterial({ color: 0xb45309, flatShading: true });
            const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
            const woodMat = new THREE.MeshLambertMaterial({ color: 0x5c3d24, flatShading: true });
            const bladeMat = new THREE.MeshLambertMaterial({ color: 0xcbd5e1, flatShading: true });

            // Legs
            const makeSkelLeg = (side) => {
                const leg = new THREE.Group();
                leg.position.set(side * 0.18, 0.68, 0);
                const femur = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), boneMat);
                femur.position.y = -0.3;
                const greave = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, 0.2), ironMat);
                greave.position.y = -0.5;
                leg.add(femur, greave);
                return leg;
            };
            leftLeg = makeSkelLeg(-1);
            rightLeg = makeSkelLeg(1);
            bodyGroup.add(leftLeg, rightLeg);

            // Pelvis & Torso
            torso = new THREE.Group();
            const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.28), ironMat);
            pelvis.position.y = 0.72;
            torso.add(pelvis);

            const tabard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.44, 0.32), rustMat);
            tabard.position.y = 0.54;
            torso.add(tabard);

            const spine = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.65, 0.16), boneMat);
            spine.position.y = 1.08;
            torso.add(spine);

            const ribcage = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 0.32), boneMat);
            ribcage.position.y = 1.16;
            torso.add(ribcage);

            const pauldrons = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.18, 0.34), ironMat);
            pauldrons.position.y = 1.38;
            torso.add(pauldrons);
            bodyGroup.add(torso);

            // Head & Crown Helm
            head = new THREE.Group();
            head.position.set(0, 1.7, 0);
            const skull = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.42, 0.44), boneMat);
            head.add(skull);

            const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.36), boneMat);
            jaw.position.set(0, -0.22, 0.04);
            head.add(jaw);

            const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.04), eyeGlowMat);
            eyeL.position.set(-0.11, 0.02, 0.23);
            const eyeR = eyeL.clone();
            eyeR.position.x = 0.11;
            head.add(eyeL, eyeR);

            // Tarnished Iron Crown Rim
            const helm = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.48), ironMat);
            helm.position.y = 0.18;
            head.add(helm);
            bodyGroup.add(head);

            // Left Arm + Iron Heater Shield
            leftArm = new THREE.Group();
            leftArm.position.set(-0.46, 1.34, 0);
            const armMeshL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.14), boneMat);
            armMeshL.position.y = -0.26;
            leftArm.add(armMeshL);

            const shield = new THREE.Group();
            const shieldBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.68, 0.08), ironMat);
            const shieldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.72, 0.04), goldTrim);
            shieldTrim.position.z = -0.01;
            const shieldBoss = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.05), rustMat);
            shieldBoss.position.z = 0.05;
            shield.add(shieldBody, shieldTrim, shieldBoss);
            shield.position.set(-0.08, -0.45, 0.22);
            shield.rotation.set(0.1, -0.35, 0);
            leftArm.add(shield);
            bodyGroup.add(leftArm);

            // Right Arm + Rusty Halberd
            rightArm = new THREE.Group();
            rightArm.position.set(0.46, 1.34, 0);
            const armMeshR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.14), boneMat);
            armMeshR.position.y = -0.26;
            rightArm.add(armMeshR);

            const halberd = new THREE.Group();
            const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.15, 6), woodMat);
            shaft.position.y = 0.25;
            const axeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.48, 0.34), bladeMat);
            axeBlade.position.set(0, 1.05, 0.16);
            const topSpike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.34, 4), bladeMat);
            topSpike.position.set(0, 1.44, 0);
            halberd.add(shaft, axeBlade, topSpike);
            halberd.position.set(0, -0.48, 0.2);
            halberd.rotation.x = 0.25;
            rightArm.add(halberd);
            bodyGroup.add(rightArm);
        }

        root.traverse((c) => {
            if (c.isMesh) c.castShadow = true;
        });

        return {
            group: root,
            animState: { time: 0, torso, head, leftArm, rightArm, leftLeg, rightLeg }
        };
    }

    /**
     * Load/rebuild Hero and Monster models and start the animation loop
     */
    start(heroConfig, monsterId) {
        this.heroAnchor.clear();
        this.enemyAnchor.clear();
        this.projectiles = [];
        this.particles = [];
        this.heroAnim = null;
        this.enemyAnim = null;
        this.heroDefending = false;
        this.enemyDefeated = false;
        if (this.guardAura) this.guardAura.visible = false;

        // 1. Build Player Hero Model (Bottom-Left)
        this.heroModel = this.builder.createCharacter(heroConfig);
        this.heroAnchor.position.copy(this.heroPos);
        this.heroAnchor.rotation.set(0, Math.atan2(this.enemyPos.x - this.heroPos.x, this.enemyPos.z - this.heroPos.z), 0);
        this.heroAnchor.scale.setScalar(this.heroScale);
        this.heroAnchor.add(this.heroModel.group);

        // 2. Build Enemy Monster Model (Top-Right)
        this.enemyModel = this.buildMonsterModel(monsterId);
        this.enemyAnchor.position.copy(this.enemyPos);
        this.enemyAnchor.rotation.set(0, Math.atan2(this.heroPos.x - this.enemyPos.x, this.heroPos.z - this.enemyPos.z), 0);
        this.enemyAnchor.scale.setScalar(this.enemyScale);
        this.enemyAnchor.add(this.enemyModel.group);

        this.active = true;
        this.clock.getDelta();
        this.resize();
        if (this.rafId === null) {
            this.animate();
        }
    }

    stop() {
        this.active = false;
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    resize() {
        if (!this.renderer || !this.camera || !this.container) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        if (width <= 0 || height <= 0) return;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    spawnParticles(origin, color, count = 16, mode = 'burst') {
        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.08, 0.08),
                new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
            );
            mesh.position.copy(origin).add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.6,
                0.4 + Math.random() * 0.9,
                (Math.random() - 0.5) * 0.6
            ));
            const vel = mode === 'rise'
                ? new THREE.Vector3((Math.random() - 0.5) * 0.5, 1.4 + Math.random() * 1.1, (Math.random() - 0.5) * 0.5)
                : new THREE.Vector3((Math.random() - 0.5) * 3.5, 1.2 + Math.random() * 2.5, (Math.random() - 0.5) * 3.5);
            this.scene.add(mesh);
            this.particles.push({ mesh, vel, life: 0, maxLife: 0.6 + Math.random() * 0.35, mode });
        }
    }

    spawnProjectile(startPos, endPos, color) {
        const group = new THREE.Group();
        const orb = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.18, 0),
            new THREE.MeshBasicMaterial({ color })
        );
        const light = new THREE.PointLight(color, 1.8, 4);
        group.add(orb, light);
        group.position.copy(startPos).add(new THREE.Vector3(0, 1.1, 0));
        this.scene.add(group);
        this.projectiles.push({
            mesh: group,
            start: group.position.clone(),
            end: endPos.clone().add(new THREE.Vector3(0, 1.0, 0)),
            t: 0,
            color
        });
    }

    playHeroAttack(type) {
        const isMagic = type === 'basic_magic' || type === 'special_firebolt' || type === 'holy_water';
        if (isMagic) {
            this.heroAnim = { kind: 'cast', t: 0, dur: 0.55 };
            const color = type === 'special_firebolt' ? 0xf97316 : (type === 'holy_water' ? 0xfacc15 : 0x38bdf8);
            this.spawnProjectile(this.heroPos, this.enemyPos, color);
        } else {
            this.heroAnim = {
                kind: type === 'special_cleave' ? 'spin_lunge' : 'lunge',
                t: 0,
                dur: 0.6
            };
        }
    }

    playMonsterHit(isCrit = false) {
        this.enemyAnim = { kind: 'hit', t: 0, dur: 0.45 };
        this.spawnParticles(this.enemyPos, isCrit ? 0xfacc15 : 0xef4444, isCrit ? 24 : 14, 'burst');
    }

    playEnemyAttack() {
        this.enemyAnim = { kind: 'lunge', t: 0, dur: 0.6 };
    }

    playHeroHit(isDefending = false) {
        this.heroAnim = { kind: 'hit', t: 0, dur: 0.4 };
        this.spawnParticles(this.heroPos, isDefending ? 0x38bdf8 : 0xef4444, 14, 'burst');
    }

    setHeroDefending(isDefending) {
        this.heroDefending = isDefending;
        if (this.guardAura) {
            this.guardAura.visible = isDefending;
        }
    }

    playHeroHeal(type) {
        const color = type === 'heal_mp' ? 0x38bdf8 : 0x4ade80;
        this.spawnParticles(this.heroPos, color, 22, 'rise');
    }

    playMonsterDefeat() {
        this.enemyDefeated = true;
        this.enemyAnim = { kind: 'defeat', t: 0, dur: 0.65 };
        this.spawnParticles(this.enemyPos, 0xfacc15, 26, 'burst');
    }

    animate() {
        if (!this.active) return;
        this.rafId = requestAnimationFrame(() => this.animate());

        const delta = Math.min(this.clock.getDelta(), 0.05);
        const time = this.clock.elapsedTime;

        // Torch flame flicker
        this.torchFlames.forEach((f, idx) => {
            f.rotation.y += delta * 2.5;
            const s = 0.85 + Math.sin(time * 12 + idx) * 0.2;
            f.scale.set(s, s * 1.3, s);
        });

        // Guard aura spin
        if (this.guardAura && this.guardAura.visible) {
            this.guardAura.rotation.y += delta * 1.8;
        }

        // Hero idle & action animations
        if (this.heroModel) {
            this.heroModel.update(delta);
            const anim = this.heroModel.animState;
            const baseYaw = Math.atan2(this.enemyPos.x - this.heroPos.x, this.enemyPos.z - this.heroPos.z);

            if (this.heroDefending && anim.leftArm && !this.heroAnim) {
                anim.leftArm.rotation.x = -0.9;
                anim.leftArm.rotation.z = -0.35;
            } else if (anim.leftArm && !this.heroAnim) {
                anim.leftArm.rotation.z = 0;
            }

            if (this.heroAnim) {
                this.heroAnim.t += delta;
                const p = Math.min(1, this.heroAnim.t / this.heroAnim.dur);

                if (this.heroAnim.kind === 'lunge' || this.heroAnim.kind === 'spin_lunge') {
                    const lunge = Math.sin(p * Math.PI);
                    this.heroAnchor.position.lerpVectors(this.heroPos, this.enemyPos, lunge * 0.58);
                    if (anim.rightArm) anim.rightArm.rotation.x = -Math.sin(p * Math.PI * 1.3) * 1.65;
                    if (this.heroAnim.kind === 'spin_lunge') {
                        this.heroAnchor.rotation.y = baseYaw + p * Math.PI * 2;
                    }
                } else if (this.heroAnim.kind === 'cast') {
                    const swing = Math.sin(p * Math.PI);
                    if (anim.rightArm) anim.rightArm.rotation.x = -swing * 1.4;
                } else if (this.heroAnim.kind === 'hit') {
                    const shake = Math.sin(p * Math.PI * 6) * (1 - p) * 0.14;
                    this.heroAnchor.position.set(this.heroPos.x + shake, this.heroPos.y, this.heroPos.z + (1 - p) * 0.15);
                }

                if (p >= 1) {
                    this.heroAnim = null;
                    this.heroAnchor.position.copy(this.heroPos);
                    this.heroAnchor.rotation.y = baseYaw;
                }
            }
        }

        // Monster idle & action animations
        if (this.enemyModel) {
            const mAnim = this.enemyModel.animState;
            mAnim.time += delta;

            if (!this.enemyDefeated && !this.enemyAnim) {
                if (mAnim.torso) mAnim.torso.position.y = Math.sin(mAnim.time * 2.4) * 0.03;
                if (mAnim.head) mAnim.head.rotation.y = Math.sin(mAnim.time * 1.3) * 0.08;
                if (mAnim.rightArm) mAnim.rightArm.rotation.x = -0.15 + Math.sin(mAnim.time * 2.1) * 0.08;
                if (mAnim.leftArm) mAnim.leftArm.rotation.x = -0.25 - Math.sin(mAnim.time * 2.1) * 0.05;
            }

            if (this.enemyAnim) {
                this.enemyAnim.t += delta;
                const p = Math.min(1, this.enemyAnim.t / this.enemyAnim.dur);

                if (this.enemyAnim.kind === 'lunge') {
                    const lunge = Math.sin(p * Math.PI);
                    this.enemyAnchor.position.lerpVectors(this.enemyPos, this.heroPos, lunge * 0.58);
                    if (mAnim.rightArm) mAnim.rightArm.rotation.x = -Math.sin(p * Math.PI * 1.3) * 1.5;
                    if (p >= 1) {
                        this.enemyAnim = null;
                        this.enemyAnchor.position.copy(this.enemyPos);
                    }
                } else if (this.enemyAnim.kind === 'hit') {
                    const shake = Math.sin(p * Math.PI * 6) * (1 - p) * 0.16;
                    this.enemyAnchor.position.set(this.enemyPos.x + shake, this.enemyPos.y, this.enemyPos.z - (1 - p) * 0.18);
                    if (p >= 1) {
                        this.enemyAnim = null;
                        this.enemyAnchor.position.copy(this.enemyPos);
                    }
                } else if (this.enemyAnim.kind === 'defeat') {
                    this.enemyAnchor.rotation.x = -p * (Math.PI / 2);
                    this.enemyAnchor.position.y = this.enemyPos.y - p * 0.25;
                    this.enemyAnchor.scale.setScalar(this.enemyScale * Math.max(0.05, 1 - p * 0.35));
                    if (p >= 1) {
                        this.enemyAnim = null;
                    }
                }
            }
        }

        // Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.t += delta * 2.6;
            const p = Math.min(1, proj.t);
            proj.mesh.position.lerpVectors(proj.start, proj.end, p);
            proj.mesh.position.y += Math.sin(p * Math.PI) * 0.35;
            proj.mesh.rotation.y += delta * 10;
            if (p >= 1) {
                this.scene.remove(proj.mesh);
                this.spawnParticles(this.enemyPos, proj.color, 14, 'burst');
                this.projectiles.splice(i, 1);
            }
        }

        // Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.life += delta;
            const p = pt.life / pt.maxLife;
            pt.mesh.position.addScaledVector(pt.vel, delta);
            if (pt.mode !== 'rise') pt.vel.y -= 6.5 * delta;
            pt.mesh.material.opacity = Math.max(0, 1 - p);
            pt.mesh.scale.setScalar(Math.max(0.1, 1 - p * 0.7));
            if (p >= 1) {
                this.scene.remove(pt.mesh);
                this.particles.splice(i, 1);
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
}
