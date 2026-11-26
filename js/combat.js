import * as THREE from '../vendor/three.module.js';
import { CharacterBuilder } from './characterBuilder.js';
import { SHOP_SPELLS } from './progression.js';

export { SHOP_SPELLS };
export const SPELLS = SHOP_SPELLS;

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
        specialChance: 0.25,
        specialMultiplier: 1.35,
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
        specialChance: 0.25,
        specialMultiplier: 1.4,
        xpReward: 75,
        goldReward: 45,
        loot: [
            { item: 'Mana Draught', chance: 0.7 },
            { item: 'Lesser Healing Potion', chance: 0.5 }
        ],
        description: 'A ravenous undead creature lurking in the crypt shadows with razor teeth and rotting sinew.'
    },
    crypt_spider: {
        id: 'crypt_spider',
        name: 'Crypt Widow',
        icon: '🕷️',
        maxHp: 30,
        ac: 12,
        attackBonus: 3,
        damageDice: { count: 1, sides: 6, mod: 2 }, // 1d6 + 2
        attackName: 'Skittering Mandibles',
        specialAttackName: 'Venomous Fang Lunge',
        specialChance: 0.3,
        specialMultiplier: 1.5,
        xpReward: 55,
        goldReward: 30,
        loot: [
            { item: 'Lesser Healing Potion', chance: 0.6 },
            { item: 'Holy Water Flask', chance: 0.3 }
        ],
        description: 'A bloated, chitinous tomb arachnid whose glistening fangs drip paralytic venom from the rafters.'
    },
    shadow_wraith: {
        id: 'shadow_wraith',
        name: 'Hollow Wraith',
        icon: '👻',
        maxHp: 42,
        ac: 13,
        attackBonus: 4,
        damageDice: { count: 1, sides: 8, mod: 2 }, // 1d8 + 2
        attackName: 'Spectral Claw',
        specialAttackName: 'Soul Chill Drain',
        specialChance: 0.3,
        specialMultiplier: 1.5,
        xpReward: 95,
        goldReward: 60,
        loot: [
            { item: 'Mana Draught', chance: 0.55 },
            { item: 'Holy Water Flask', chance: 0.45 },
            { item: 'Greater Healing Potion', chance: 0.35 }
        ],
        description: 'A drifting shroud of malice and cold starlight that freezes the marrow of all who trespass the inner crypt.'
    }
};

export const FLOOR2_MONSTERS = {
    obsidian_gargoyle: {
        id: 'obsidian_gargoyle',
        name: 'Obsidian Gargoyle',
        icon: '🦇',
        maxHp: 64,
        ac: 13,
        attackBonus: 5,
        damageDice: { count: 1, sides: 10, mod: 3 },
        attackName: 'Stone Talon Rake',
        specialAttackName: 'Obsidian Wing Dive',
        specialChance: 0.3,
        specialMultiplier: 1.45,
        xpReward: 115,
        goldReward: 70,
        loot: [
            { item: 'Greater Healing Potion', chance: 0.45 },
            { item: 'Ancient Bone Ring', chance: 0.5 }
        ],
        description: 'A horned sentinel carved from volcanic glass whose stone wings thunder across the sunken barracks.'
    },
    blight_ooze: {
        id: 'blight_ooze',
        name: 'Blighted Alchemist Ooze',
        icon: '🟢',
        maxHp: 72,
        ac: 11,
        attackBonus: 5,
        damageDice: { count: 2, sides: 6, mod: 2 },
        attackName: 'Caustic Pseudopod',
        specialAttackName: 'Acidic Engulf',
        specialChance: 0.3,
        specialMultiplier: 1.4,
        xpReward: 125,
        goldReward: 75,
        loot: [
            { item: 'Mana Draught', chance: 0.6 },
            { item: 'Greater Healing Potion', chance: 0.45 }
        ],
        description: 'A pulsing mass of virulent alchemical slime suspending dissolved skulls and splintered ribs within.'
    },
    runebound_sentinel: {
        id: 'runebound_sentinel',
        name: 'Runebound Sentinel',
        icon: '🛡️',
        maxHp: 68,
        ac: 14,
        attackBonus: 5,
        damageDice: { count: 1, sides: 10, mod: 4 },
        attackName: 'Runeblade Cleave',
        specialAttackName: 'Aegis Shockwave',
        specialChance: 0.28,
        specialMultiplier: 1.45,
        xpReward: 135,
        goldReward: 85,
        loot: [
            { item: 'Holy Water Flask', chance: 0.5 },
            { item: 'Ancient Bone Ring', chance: 0.5 }
        ],
        description: 'An enchanted iron juggernaut bound by glowing cyan ward-rings and armed with an astral greatsword.'
    },
    arch_lich: {
        id: 'arch_lich',
        name: 'Arch-Lich of the Arcanum',
        icon: '👑',
        maxHp: 82,
        ac: 15,
        attackBonus: 6,
        damageDice: { count: 2, sides: 8, mod: 3 },
        attackName: 'Phylactery Bolt',
        specialAttackName: 'Abyssal Soul Nova',
        specialChance: 0.35,
        specialMultiplier: 1.45,
        xpReward: 200,
        goldReward: 140,
        loot: [
            { item: 'Greater Healing Potion', chance: 0.7 },
            { item: 'Holy Water Flask', chance: 0.65 },
            { item: 'Mana Draught', chance: 0.7 }
        ],
        description: 'A crowned undead archmage floating above an orbiting ring of phylactery shards.'
    }
};

export const ALL_MONSTERS = { ...MONSTERS, ...FLOOR2_MONSTERS };

export function getMonsterTemplate(id) {
    return ALL_MONSTERS[id] || MONSTERS.skeleton;
}

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
    },
    'Ancient Bone Ring': {
        name: 'Ancient Bone Ring',
        icon: '💍',
        type: 'heal_hp',
        value: 22,
        desc: 'Channels an ancestral bone ward to restore 22 Hit Points instantly.'
    }
};

/**
 * Rolls dice from numeric arguments (count, sides, mod = 0) or string formula e.g. '1d8+2', '1d6 - 2'.
 * Returns { total: 0, rolls: [], mod: 0 } safely on invalid inputs.
 */
export function rollDiceFormula(countOrFormula, sides, mod = 0) {
    let diceCount;
    let diceSides;
    let diceMod;

    if (typeof countOrFormula === 'string') {
        const match = countOrFormula.match(/^\s*(\d+)d(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i);
        if (!match) {
            return { total: 0, rolls: [], mod: 0 };
        }
        diceCount = Number.parseInt(match[1], 10);
        diceSides = Number.parseInt(match[2], 10);
        if (match[3]) {
            const rawMod = Number.parseInt(match[4], 10);
            diceMod = match[3] === '-' ? -rawMod : rawMod;
        } else {
            diceMod = 0;
        }
    } else {
        diceCount = countOrFormula;
        diceSides = sides;
        diceMod = mod;
    }

    if (
        !Number.isInteger(diceCount) ||
        !Number.isInteger(diceSides) ||
        diceCount <= 0 ||
        diceSides <= 0 ||
        !Number.isFinite(diceMod)
    ) {
        return { total: 0, rolls: [], mod: 0 };
    }

    const normalizedMod = Object.is(Math.trunc(diceMod), -0) ? 0 : Math.trunc(diceMod);
    let sum = 0;
    const rolls = [];
    for (let i = 0; i < diceCount; i++) {
        const r = Math.floor(Math.random() * diceSides) + 1;
        rolls.push(r);
        sum += r;
    }
    return {
        total: Math.max(1, sum + normalizedMod),
        rolls,
        mod: normalizedMod
    };
}

/**
 * Selects a monster's basic or special combat action based on specialChance and optional RNG.
 */
export function chooseMonsterAction(monster, turnCount = 1, rng = null) {
    const safeMonster = monster && typeof monster === 'object' ? monster : {};
    const rawDice = safeMonster.damageDice && typeof safeMonster.damageDice === 'object'
        ? safeMonster.damageDice
        : null;
    const baseDice = {
        count: Number.isInteger(rawDice?.count) && rawDice.count > 0 ? rawDice.count : 1,
        sides: Number.isInteger(rawDice?.sides) && rawDice.sides > 0 ? rawDice.sides : 4,
        mod: Number.isFinite(rawDice?.mod) ? rawDice.mod : 0
    };
    const attackBonus = Number.isFinite(safeMonster.attackBonus) ? safeMonster.attackBonus : 2;

    const rawChance = typeof safeMonster.specialChance === 'number' && Number.isFinite(safeMonster.specialChance)
        ? safeMonster.specialChance
        : 0;
    const chance = Math.max(0, Math.min(1, rawChance));
    const trimmedSpecialName = typeof safeMonster.specialAttackName === 'string'
        ? safeMonster.specialAttackName.trim()
        : '';
    const hasSpecial = trimmedSpecialName.length > 0 && chance > 0;

    const rand = typeof rng === 'function' ? rng : Math.random;
    const roll = rand();
    const isSpecial = hasSpecial && Number.isFinite(roll) && roll < chance;

    const trimmedBasicName = typeof safeMonster.attackName === 'string'
        ? safeMonster.attackName.trim()
        : '';
    const name = isSpecial
        ? trimmedSpecialName
        : (trimmedBasicName.length > 0 ? trimmedBasicName : 'Attack');
    const rawMult = typeof safeMonster.specialMultiplier === 'number'
        && Number.isFinite(safeMonster.specialMultiplier)
        && safeMonster.specialMultiplier > 0
        ? safeMonster.specialMultiplier
        : 1.35;
    const multiplier = isSpecial ? rawMult : 1;
    const safeTurn = Number.isFinite(turnCount) ? turnCount : 1;

    return {
        isSpecial,
        type: isSpecial ? 'special' : 'basic',
        kind: isSpecial ? 'special' : 'normal',
        name,
        attackName: name,
        attackBonus,
        damageDice: { ...baseDice },
        multiplier,
        turnCount: safeTurn
    };
}

/**
 * Resolves a player-cast shop spell against a monster, computing damage, MP cost,
 * lifesteal healing, chill penalties, and auto-hit semantics.
 */
export function resolvePlayerSpell(spellId, playerStatsObj = {}, monsterObj = {}) {
    const spell = SHOP_SPELLS[spellId];
    if (!spell) {
        return { ok: false, reason: 'invalid_spell' };
    }

    if (
        playerStatsObj &&
        typeof playerStatsObj.currentMp === 'number' &&
        Number.isFinite(playerStatsObj.currentMp) &&
        playerStatsObj.currentMp < spell.mpCost
    ) {
        return {
            ok: false,
            reason: 'insufficient_mp',
            spell,
            mpCost: spell.mpCost
        };
    }

    const rawInt = Number(playerStatsObj?.int ?? playerStatsObj?.stats?.int ?? 10);
    const safeInt = Number.isFinite(rawInt) ? rawInt : 10;
    const intMod = Math.floor((safeInt - 10) / 2);

    const rawWeaponDmg = Number(playerStatsObj?.damageBonus ?? playerStatsObj?.stats?.damageBonus ?? 0);
    const weaponBonus = Number.isFinite(rawWeaponDmg) ? Math.max(0, Math.floor(rawWeaponDmg)) : 0;

    const diceRoll = rollDiceFormula(spell.dice.count, spell.dice.sides, spell.dice.mod);
    const statBonus = spell.id === 'chronos_thunder'
        ? Math.max(2, intMod * 2)
        : Math.max(1, intMod);

    const damage = Math.max(1, diceRoll.total + statBonus + weaponBonus);
    const healAmount = spell.lifestealRatio
        ? Math.max(1, Math.floor(damage * spell.lifestealRatio))
        : 0;
    const chillPenalty = spell.effect === 'chill' ? (spell.chillPenalty || 2) : 0;
    const autoHit = Boolean(spell.autoHit);
    const targetAc = Number.isFinite(monsterObj?.ac) ? monsterObj.ac : 12;

    return {
        ok: true,
        spellId: spell.id,
        spell,
        mpCost: spell.mpCost,
        damage,
        diceRoll,
        intMod,
        statBonus,
        weaponBonus,
        healAmount,
        chillPenalty,
        autoHit,
        targetAc,
        effect: spell.effect || (healAmount > 0 ? 'lifesteal' : null),
        formulaDesc: `${diceRoll.rolls.join('+')}+${spell.dice.mod} + ${statBonus}${weaponBonus > 0 ? ` + ${weaponBonus}` : ''}`
    };
}

/**
 * Module-level geometry helpers for pure Node-safe 3D monster construction.
 */
function createMonsterLoftedPrism(rings, radialSegments = 8, closeTop = true, closeBottom = true) {
    const positions = [];
    const pushTri = (a, b, c) => {
        positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    };

    const ringVerts = rings.map((ring) => {
        const verts = [];
        const ox = ring.offsetX || 0;
        const oz = ring.offsetZ || 0;
        const twist = ring.twist || 0;
        for (let s = 0; s < radialSegments; s++) {
            const theta = (s / radialSegments) * Math.PI * 2 + twist;
            verts.push([
                Math.sin(theta) * ring.rx + ox,
                ring.y,
                Math.cos(theta) * ring.rz + oz
            ]);
        }
        return verts;
    });

    for (let r = 0; r < rings.length - 1; r++) {
        const lower = ringVerts[r];
        const upper = ringVerts[r + 1];
        for (let s = 0; s < radialSegments; s++) {
            const sNext = (s + 1) % radialSegments;
            const p00 = lower[s];
            const p01 = lower[sNext];
            const p11 = upper[sNext];
            const p10 = upper[s];
            pushTri(p00, p01, p11);
            pushTri(p00, p11, p10);
        }
    }

    if (closeTop && rings.length > 0) {
        const lastRing = rings[rings.length - 1];
        const topVerts = ringVerts[ringVerts.length - 1];
        const centerTop = [lastRing.offsetX || 0, lastRing.y, lastRing.offsetZ || 0];
        for (let s = 0; s < radialSegments; s++) {
            const sNext = (s + 1) % radialSegments;
            pushTri(centerTop, topVerts[s], topVerts[sNext]);
        }
    }

    if (closeBottom && rings.length > 0) {
        const firstRing = rings[0];
        const botVerts = ringVerts[0];
        const centerBot = [firstRing.offsetX || 0, firstRing.y, firstRing.offsetZ || 0];
        for (let s = 0; s < radialSegments; s++) {
            const sNext = (s + 1) % radialSegments;
            pushTri(centerBot, botVerts[sNext], botVerts[s]);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.computeVertexNormals();
    return geo;
}

function orientCylinderAlong(mesh, vec) {
    const dir = vec.clone().normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh.position.copy(vec).multiplyScalar(0.5);
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

        this.heroPos = new THREE.Vector3(-1.25, -0.10, 1.05);
        this.enemyPos = new THREE.Vector3(1.35, 0.15, -0.95);

        this.heroScale = 1.22;
        this.enemyScale = 1.32;
        this.monsterScale = 1.0;
        this.currentMonsterScale = 1.0;
        this.currentMonsterId = 'skeleton';

        this.heroAnchor = null;
        this.enemyAnchor = null;
        this.heroPedestal = null;
        this.enemyPedestal = null;
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
        this.scene.fog = new THREE.FogExp2(0x090d16, 0.05);

        this.camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 80);
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

        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this._onResize);
        }
    }

    buildEnvironment() {
        // Dungeon Floor
        const floorGeo = new THREE.PlaneGeometry(40, 40);
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x131824, flatShading: true });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.18;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const grid = new THREE.GridHelper(32, 32, 0x2a364d, 0x182030);
        grid.position.y = -0.17;
        this.scene.add(grid);

        // Distant Crypt Stone Pillars with Flickering Torches
        const pillarGeo = new THREE.BoxGeometry(0.75, 4.2, 0.75);
        const pillarMat = new THREE.MeshLambertMaterial({ color: 0x222a3a, flatShading: true });
        const flameGeo = new THREE.OctahedronGeometry(0.16, 0);
        const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa726 });

        [
            { x: -4.2, z: -3.6 },
            { x: 4.5, z: -4.6 }
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
            return group;
        };

        // Hero Platform (Bottom-Left cyan rune) & Enemy Dais (Top-Right raised crimson rune)
        this.heroPedestal = makePedestal(this.heroPos, 0x1f2b3d, 0x38bdf8, 1.15, 0.24);
        this.enemyPedestal = makePedestal(this.enemyPos, 0x231b24, 0xef4444, 1.2, 0.50);

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
     * Builds an articulated 3D monster model matching monsterId.
     * Intentionally free of `this.*` lookups so pure Node tests can invoke directly.
     */
    buildMonsterModel(monsterId) {
        const FLOOR2_IDS = new Set([
            'obsidian_gargoyle',
            'blight_ooze',
            'runebound_sentinel',
            'arch_lich'
        ]);
        const resolvedId = (
            monsterId === 'crypt_ghoul' ||
            monsterId === 'crypt_spider' ||
            monsterId === 'shadow_wraith' ||
            FLOOR2_IDS.has(monsterId)
        ) ? monsterId : 'skeleton';

        const root = new THREE.Group();
        root.name = `Monster_${resolvedId}`;
        root.userData = { monsterId: resolvedId };

        const bodyGroup = new THREE.Group();
        bodyGroup.name = 'BodyGroup';
        root.add(bodyGroup);

        let leftArm = null;
        let rightArm = null;
        let leftLeg = null;
        let rightLeg = null;
        let head = null;
        let torso = null;
        let abdomen = null;
        let fangs = null;
        let spiderLegs = null;
        let shroudTails = null;
        let auraGroup = null;
        let soulCore = null;
        let wings = null;
        let oozeCore = null;
        let tendrils = null;

        if (resolvedId === 'crypt_spider') {
            const carapaceMat = new THREE.MeshPhongMaterial({
                color: 0x1e1624,
                shininess: 42,
                specular: 0x7e22ce,
                flatShading: true
            });
            const chitinDarkMat = new THREE.MeshLambertMaterial({ color: 0x110c16, flatShading: true });
            const crimsonMarkMat = new THREE.MeshLambertMaterial({
                color: 0x991b1b,
                emissive: 0x450a0a,
                emissiveIntensity: 0.45,
                flatShading: true
            });
            const venomMat = new THREE.MeshLambertMaterial({
                color: 0x84cc16,
                emissive: 0x4d7c0f,
                emissiveIntensity: 0.75,
                flatShading: true
            });
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 });

            // Cephalothorax & segmented abdomen
            torso = new THREE.Group();
            torso.name = 'Torso';

            const cephalothorax = new THREE.Group();
            cephalothorax.name = 'Cephalothorax';
            const thoraxMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), carapaceMat);
            thoraxMesh.scale.set(0.95, 0.72, 1.15);
            thoraxMesh.position.set(0, 0.58, 0.24);
            cephalothorax.add(thoraxMesh);

            const sternum = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.42), chitinDarkMat);
            sternum.position.set(0, 0.46, 0.22);
            cephalothorax.add(sternum);

            [-0.1, 0.1].forEach((sx) => {
                const ridgeSpike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 4), chitinDarkMat);
                ridgeSpike.position.set(sx, 0.79, 0.18);
                ridgeSpike.rotation.x = -0.25;
                cephalothorax.add(ridgeSpike);
            });
            torso.add(cephalothorax);

            abdomen = new THREE.Group();
            abdomen.name = 'Abdomen';
            abdomen.position.set(0, 0.70, -0.08);

            const waistSegment = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), chitinDarkMat);
            waistSegment.scale.set(0.98, 0.82, 1.05);
            waistSegment.position.set(0, 0.03, -0.16);
            abdomen.add(waistSegment);

            const mainSac = new THREE.Mesh(new THREE.DodecahedronGeometry(0.44, 0), carapaceMat);
            mainSac.scale.set(1.08, 0.90, 1.22);
            mainSac.position.set(0, 0.14, -0.56);
            mainSac.rotation.x = 0.18;
            abdomen.add(mainSac);

            // Crimson widow hourglass markings
            const hgFront = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.05, 3), crimsonMarkMat);
            hgFront.position.set(0, 0.53, -0.45);
            hgFront.rotation.x = -Math.PI / 2 + 0.18;
            abdomen.add(hgFront);

            const hgCenter = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), crimsonMarkMat);
            hgCenter.scale.set(1.1, 0.35, 1.0);
            hgCenter.position.set(0, 0.52, -0.56);
            abdomen.add(hgCenter);

            const hgRear = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.05, 3), crimsonMarkMat);
            hgRear.position.set(0, 0.49, -0.68);
            hgRear.rotation.x = Math.PI / 2 + 0.18;
            abdomen.add(hgRear);

            // Rear spinnerets
            [-0.1, 0.1].forEach((sx) => {
                const spinneret = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 4), chitinDarkMat);
                spinneret.position.set(sx, 0.02, -1.06);
                spinneret.rotation.x = -Math.PI * 0.45;
                abdomen.add(spinneret);
            });
            torso.add(abdomen);
            bodyGroup.add(torso);

            // Head, 8-eye crimson cluster & chittering venom fangs
            head = new THREE.Group();
            head.name = 'Head';
            head.position.set(0, 0.58, 0.52);

            const browPlate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.20, 0.18), chitinDarkMat);
            browPlate.position.set(0, 0.04, 0.04);
            head.add(browPlate);

            const eyeSpecs = [
                { r: 0.046, x: -0.085, y: 0.06, z: 0.14 },
                { r: 0.046, x: 0.085, y: 0.06, z: 0.14 },
                { r: 0.036, x: -0.17, y: 0.08, z: 0.08 },
                { r: 0.036, x: 0.17, y: 0.08, z: 0.08 },
                { r: 0.028, x: -0.045, y: 0.13, z: 0.12 },
                { r: 0.028, x: 0.045, y: 0.13, z: 0.12 },
                { r: 0.025, x: -0.21, y: 0.02, z: 0.02 },
                { r: 0.025, x: 0.21, y: 0.02, z: 0.02 }
            ];
            eyeSpecs.forEach((spec) => {
                const eye = new THREE.Mesh(new THREE.OctahedronGeometry(spec.r, 0), eyeMat);
                eye.position.set(spec.x, spec.y, spec.z);
                head.add(eye);
            });

            // Pedipalps
            [-1, 1].forEach((side) => {
                const palp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.16), carapaceMat);
                palp.position.set(side * 0.21, -0.03, 0.11);
                palp.rotation.y = side * 0.25;
                head.add(palp);
            });

            const fangsGroup = new THREE.Group();
            fangsGroup.name = 'Fangs';
            fangs = [];
            [-1, 1].forEach((side) => {
                const fangPivot = new THREE.Group();
                fangPivot.position.set(side * 0.10, -0.05, 0.12);

                const mandibleBase = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.14), chitinDarkMat);
                mandibleBase.position.set(0, -0.03, 0.02);
                fangPivot.add(mandibleBase);

                const fangBlade = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.24, 4), venomMat);
                fangBlade.position.set(0, -0.17, 0.05);
                fangBlade.rotation.x = Math.PI * 0.92;
                fangBlade.rotation.z = side * 0.22;
                fangPivot.add(fangBlade);

                const venomDrop = new THREE.Mesh(new THREE.OctahedronGeometry(0.026, 0), venomMat);
                venomDrop.position.set(-side * 0.02, -0.27, 0.07);
                fangPivot.add(venomDrop);

                fangsGroup.add(fangPivot);
                fangs.push(fangPivot);
            });
            head.add(fangsGroup);
            bodyGroup.add(head);

            // 8 Articulated Femur + Tibia legs resting flush at y = 0 inside pedestal footprint
            const spiderLegsGroup = new THREE.Group();
            spiderLegsGroup.name = 'SpiderLegs';
            spiderLegs = [];

            const hipZ = [0.32, 0.14, -0.04, -0.22];
            const yaws = [0.68, 0.26, -0.20, -0.64];
            const hipY = 0.55;

            for (let i = 0; i < 4; i++) {
                [-1, 1].forEach((side) => {
                    const baseYaw = -side * yaws[i];
                    const hipGroup = new THREE.Group();
                    hipGroup.name = `SpiderLeg_${side < 0 ? 'L' : 'R'}${i}`;
                    hipGroup.position.set(side * 0.22, hipY, hipZ[i]);
                    hipGroup.rotation.y = baseYaw;
                    hipGroup.userData = { baseRotY: baseYaw };

                    const kneePos = new THREE.Vector3(side * 0.34, 0.34, 0);
                    const femurLen = kneePos.length();
                    const femur = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.052, 0.042, femurLen, 5),
                        carapaceMat
                    );
                    orientCylinderAlong(femur, kneePos);
                    hipGroup.add(femur);

                    const kneeGroup = new THREE.Group();
                    kneeGroup.position.copy(kneePos);

                    const kneeCap = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), chitinDarkMat);
                    kneeGroup.add(kneeCap);

                    const footOffset = new THREE.Vector3(side * 0.24, -0.875, 0);
                    const tibiaLen = footOffset.length();
                    const tibia = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.044, 0.018, tibiaLen, 5),
                        chitinDarkMat
                    );
                    orientCylinderAlong(tibia, footOffset);
                    kneeGroup.add(tibia);

                    const tarsusSpur = new THREE.Mesh(new THREE.OctahedronGeometry(0.025, 0), crimsonMarkMat);
                    tarsusSpur.position.set(footOffset.x, footOffset.y + 0.025, 0);
                    kneeGroup.add(tarsusSpur);

                    hipGroup.add(kneeGroup);
                    spiderLegsGroup.add(hipGroup);
                    spiderLegs.push({
                        hipGroup,
                        kneeGroup,
                        side,
                        index: i,
                        baseYaw
                    });
                });
            }
            bodyGroup.add(spiderLegsGroup);

        } else if (resolvedId === 'shadow_wraith') {
            const shroudMat = new THREE.MeshLambertMaterial({
                color: 0x161224,
                emissive: 0x1e1035,
                emissiveIntensity: 0.45,
                flatShading: true
            });
            const tatterMat = new THREE.MeshLambertMaterial({
                color: 0x2e1065,
                emissive: 0x4c1d95,
                emissiveIntensity: 0.55,
                transparent: true,
                opacity: 0.86,
                side: THREE.DoubleSide,
                flatShading: true
            });
            const skullMat = new THREE.MeshLambertMaterial({
                color: 0xcbd5e1,
                emissive: 0x334155,
                emissiveIntensity: 0.3,
                flatShading: true
            });
            const voidMat = new THREE.MeshBasicMaterial({ color: 0x030308 });
            const soulGlowMat = new THREE.MeshBasicMaterial({ color: 0xc084fc });
            const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0x2dd4bf });
            const auraRingMat = new THREE.MeshBasicMaterial({
                color: 0xa855f7,
                transparent: true,
                opacity: 0.65
            });

            // Floating tattered abyssal shroud + hollow chest void + spinning teal soul core
            torso = new THREE.Group();
            torso.name = 'Torso';

            const robeGeo = createMonsterLoftedPrism([
                { y: 0.42, rx: 0.42, rz: 0.34, twist: 0.2 },
                { y: 0.86, rx: 0.27, rz: 0.21, twist: 0 },
                { y: 1.26, rx: 0.36, rz: 0.27, twist: 0.1 },
                { y: 1.46, rx: 0.32, rz: 0.24, twist: 0 }
            ], 8, true, false);
            const robeMesh = new THREE.Mesh(robeGeo, shroudMat);
            torso.add(robeMesh);

            const chestVoid = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.12), voidMat);
            chestVoid.position.set(0, 1.12, 0.19);
            torso.add(chestVoid);

            // Pale rib spurs framing chest abyss
            [-1, 1].forEach((side) => {
                [1.04, 1.20].forEach((ry) => {
                    const rib = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.16, 4), skullMat);
                    rib.position.set(side * 0.13, ry, 0.24);
                    rib.rotation.z = side * (Math.PI * 0.42);
                    torso.add(rib);
                });
            });

            soulCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), eyeGlowMat);
            soulCore.name = 'SoulCore';
            soulCore.position.set(0, 1.12, 0.26);
            torso.add(soulCore);

            // 8 swaying shroud tails
            const shroudGroup = new THREE.Group();
            shroudGroup.name = 'Shroud';
            shroudTails = [];
            const tailCount = 8;
            for (let i = 0; i < tailCount; i++) {
                const angle = (i / tailCount) * Math.PI * 2;
                const tailPivot = new THREE.Group();
                tailPivot.position.set(Math.sin(angle) * 0.37, 0.44, Math.cos(angle) * 0.29);
                tailPivot.rotation.y = angle;

                const tatter = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.40, 4), tatterMat);
                tatter.position.set(0, -0.16, 0.04);
                tatter.rotation.x = Math.PI + 0.16;
                tailPivot.add(tatter);

                shroudGroup.add(tailPivot);
                shroudTails.push(tailPivot);
            }
            torso.add(shroudGroup);
            bodyGroup.add(torso);

            // Horned pale skull inside cowl with piercing teal eyes
            head = new THREE.Group();
            head.name = 'Head';
            head.position.set(0, 1.64, 0.05);

            const cowlBack = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.50, 6), shroudMat);
            cowlBack.position.set(0, 0.14, -0.07);
            cowlBack.rotation.x = -0.32;
            head.add(cowlBack);

            const cowlSideL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.34), shroudMat);
            cowlSideL.position.set(-0.20, 0, 0.02);
            const cowlSideR = cowlSideL.clone();
            cowlSideR.position.x = 0.20;
            head.add(cowlSideL, cowlSideR);

            const faceVoid = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.16), voidMat);
            faceVoid.position.set(0, -0.02, 0.05);
            head.add(faceVoid);

            const skullUpper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.20, 0.20), skullMat);
            skullUpper.position.set(0, 0.04, 0.12);
            head.add(skullUpper);

            const skullJaw = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.10, 0.16), skullMat);
            skullJaw.position.set(0, -0.11, 0.14);
            head.add(skullJaw);

            [-0.065, 0.065].forEach((ex) => {
                const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.038, 0), eyeGlowMat);
                eye.position.set(ex, 0.04, 0.23);
                head.add(eye);
            });

            [-1, 1].forEach((side) => {
                const hornBase = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 5), skullMat);
                hornBase.position.set(side * 0.16, 0.18, 0.04);
                hornBase.rotation.z = -side * 0.62;
                hornBase.rotation.x = -0.18;
                head.add(hornBase);

                const hornTip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.26, 4), skullMat);
                hornTip.position.set(side * 0.27, 0.36, -0.04);
                hornTip.rotation.z = -side * 0.28;
                hornTip.rotation.x = 0.20;
                head.add(hornTip);
            });
            bodyGroup.add(head);

            // Spectral arms with 3 glowing claws each
            const makeWraithArm = (side) => {
                const arm = new THREE.Group();
                arm.name = side < 0 ? 'LeftArm' : 'RightArm';
                arm.position.set(side * 0.45, 1.34, 0.06);

                const shoulderMantle = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.30, 5), tatterMat);
                shoulderMantle.position.set(side * 0.02, 0.05, 0);
                shoulderMantle.rotation.z = -side * 0.45;
                arm.add(shoulderMantle);

                const sleeve = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 5), shroudMat);
                sleeve.position.y = -0.18;
                sleeve.rotation.x = Math.PI;
                arm.add(sleeve);

                const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.40, 0.10), skullMat);
                forearm.position.set(0, -0.34, 0.06);
                forearm.rotation.x = -0.35;
                arm.add(forearm);

                for (let c = -1; c <= 1; c++) {
                    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.32, 4), soulGlowMat);
                    claw.position.set(c * 0.055, -0.58, 0.16);
                    claw.rotation.x = Math.PI * 0.72;
                    arm.add(claw);
                }
                return arm;
            };
            leftArm = makeWraithArm(-1);
            rightArm = makeWraithArm(1);
            bodyGroup.add(leftArm, rightArm);

            // Rotating translucent spectral aura ring & orbiting motes (noShadow)
            auraGroup = new THREE.Group();
            auraGroup.name = 'Aura';
            auraGroup.position.set(0, 1.05, 0);
            auraGroup.userData.noShadow = true;

            const auraRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.024, 4, 18), auraRingMat);
            auraRing.rotation.x = Math.PI / 2 - 0.24;
            auraRing.rotation.z = 0.18;
            auraRing.userData.noShadow = true;
            auraGroup.add(auraRing);

            for (let m = 0; m < 4; m++) {
                const ma = (m / 4) * Math.PI * 2;
                const mote = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), eyeGlowMat);
                mote.position.set(Math.cos(ma) * 0.70, Math.sin(ma) * 0.16, Math.sin(ma) * 0.70);
                mote.userData.noShadow = true;
                auraGroup.add(mote);
            }
            bodyGroup.add(auraGroup);

        } else if (resolvedId === 'crypt_ghoul') {
            const skinMat = new THREE.MeshLambertMaterial({ color: 0x5c7a52, flatShading: true });
            const darkMat = new THREE.MeshLambertMaterial({ color: 0x2d3b29, flatShading: true });
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0xa3e635 });
            const clawMat = new THREE.MeshLambertMaterial({ color: 0xd6d3d1, flatShading: true });

            torso = new THREE.Group();
            torso.name = 'Torso';
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
            head.name = 'Head';
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
                arm.name = side < 0 ? 'LeftArm' : 'RightArm';
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
                leg.name = side < 0 ? 'LeftLeg' : 'RightLeg';
                leg.position.set(side * 0.18, 0.58, 0);
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.58, 0.24), darkMat);
                mesh.position.y = -0.29;
                leg.add(mesh);
                return leg;
            };
            leftLeg = makeLeg(-1);
            rightLeg = makeLeg(1);
            bodyGroup.add(leftLeg, rightLeg);

        } else if (resolvedId === 'obsidian_gargoyle') {
            const stoneMat = new THREE.MeshPhongMaterial({
                color: 0x221f2b,
                shininess: 35,
                specular: 0x64748b,
                flatShading: true
            });
            const darkStoneMat = new THREE.MeshLambertMaterial({ color: 0x12101a, flatShading: true });
            const wingMembraneMat = new THREE.MeshLambertMaterial({
                color: 0x3b263d,
                side: THREE.DoubleSide,
                flatShading: true
            });
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
            const clawMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8, flatShading: true });

            const makeGargoyleLeg = (side) => {
                const leg = new THREE.Group();
                leg.name = side < 0 ? 'LeftLeg' : 'RightLeg';
                leg.position.set(side * 0.22, 0.68, 0);
                const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.24), stoneMat);
                thigh.position.y = -0.18;
                const shin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.18), darkStoneMat);
                shin.position.set(0, -0.44, -0.04);
                const talon = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), clawMat);
                talon.position.set(0, -0.56, 0.12);
                talon.rotation.x = Math.PI / 2;
                leg.add(thigh, shin, talon);
                return leg;
            };
            leftLeg = makeGargoyleLeg(-1);
            rightLeg = makeGargoyleLeg(1);
            bodyGroup.add(leftLeg, rightLeg);

            torso = new THREE.Group();
            torso.name = 'Torso';
            const chest = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), stoneMat);
            chest.scale.set(1.15, 1.25, 0.85);
            chest.position.y = 1.04;
            torso.add(chest);

            const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.32, 6), darkStoneMat);
            waist.position.y = 0.72;
            torso.add(waist);

            for (let s = 0; s < 3; s++) {
                const crest = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), darkStoneMat);
                crest.position.set(0, 0.85 + s * 0.22, -0.32);
                crest.rotation.x = -Math.PI * 0.42;
                torso.add(crest);
            }
            bodyGroup.add(torso);

            wings = [];
            [-1, 1].forEach((side) => {
                const wingPivot = new THREE.Group();
                wingPivot.name = side < 0 ? 'LeftWing' : 'RightWing';
                wingPivot.position.set(side * 0.26, 1.28, -0.22);

                const armBone = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.09, 0.09), darkStoneMat);
                armBone.position.set(side * 0.36, 0.24, -0.06);
                armBone.rotation.z = side * 0.45;
                wingPivot.add(armBone);

                const membrane = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.85, 3), wingMembraneMat);
                membrane.scale.set(1.2, 1.0, 0.14);
                membrane.position.set(side * 0.55, -0.05, -0.14);
                membrane.rotation.z = -side * 0.72;
                wingPivot.add(membrane);

                const wingSpur = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 4), clawMat);
                wingSpur.position.set(side * 0.72, 0.5, -0.08);
                wingSpur.rotation.z = -side * 0.3;
                wingPivot.add(wingSpur);

                torso.add(wingPivot);
                wings.push({ group: wingPivot, side });
            });

            head = new THREE.Group();
            head.name = 'Head';
            head.position.set(0, 1.62, 0.14);
            const cranium = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), stoneMat);
            head.add(cranium);

            const snout = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.26), darkStoneMat);
            snout.position.set(0, -0.1, 0.22);
            head.add(snout);

            [-0.1, 0.1].forEach((ex) => {
                const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), eyeMat);
                eye.position.set(ex, 0.05, 0.22);
                head.add(eye);
            });

            [-1, 1].forEach((side) => {
                const horn = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.4, 5), darkStoneMat);
                horn.position.set(side * 0.19, 0.28, -0.04);
                horn.rotation.z = -side * 0.45;
                horn.rotation.x = -0.25;
                head.add(horn);
            });
            bodyGroup.add(head);

            const makeGargoyleArm = (side) => {
                const arm = new THREE.Group();
                arm.name = side < 0 ? 'LeftArm' : 'RightArm';
                arm.position.set(side * 0.5, 1.3, 0.06);
                const upper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.56, 0.2), stoneMat);
                upper.position.y = -0.26;
                arm.add(upper);
                for (let c = -1; c <= 1; c++) {
                    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.24, 4), clawMat);
                    claw.position.set(c * 0.055, -0.62, 0.08);
                    claw.rotation.x = Math.PI * 0.85;
                    arm.add(claw);
                }
                return arm;
            };
            leftArm = makeGargoyleArm(-1);
            rightArm = makeGargoyleArm(1);
            bodyGroup.add(leftArm, rightArm);

        } else if (resolvedId === 'blight_ooze') {
            const outerSlimeMat = new THREE.MeshPhongMaterial({
                color: 0x4d7c0f,
                emissive: 0x1a2e05,
                emissiveIntensity: 0.4,
                transparent: true,
                opacity: 0.78,
                shininess: 80,
                flatShading: true
            });
            const innerCoreMat = new THREE.MeshBasicMaterial({ color: 0xa3e635 });
            const boneMat = new THREE.MeshLambertMaterial({ color: 0xd6d3d1, flatShading: true });
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0xecfccb });

            torso = new THREE.Group();
            torso.name = 'Torso';

            const baseMound = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68, 0), outerSlimeMat);
            baseMound.scale.set(1.18, 0.62, 1.15);
            baseMound.position.y = 0.45;
            torso.add(baseMound);

            const midDome = new THREE.Mesh(new THREE.IcosahedronGeometry(0.52, 0), outerSlimeMat);
            midDome.scale.set(1.0, 1.05, 0.96);
            midDome.position.y = 0.86;
            torso.add(midDome);

            const crownDome = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), outerSlimeMat);
            crownDome.position.set(0, 1.32, 0.04);
            torso.add(crownDome);

            oozeCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), innerCoreMat);
            oozeCore.position.set(0, 0.78, 0);
            oozeCore.userData.noShadow = true;
            torso.add(oozeCore);

            const trappedSkull = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), boneMat);
            trappedSkull.position.set(-0.14, 0.92, 0.14);
            trappedSkull.rotation.set(0.3, 0.5, -0.2);
            torso.add(trappedSkull);

            const trappedRib = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 5), boneMat);
            trappedRib.position.set(0.18, 0.6, 0.12);
            trappedRib.rotation.set(0.4, 0.2, 1.1);
            torso.add(trappedRib);

            for (let b = 0; b < 6; b++) {
                const ang = (b / 6) * Math.PI * 2;
                const bubble = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), innerCoreMat);
                bubble.position.set(Math.cos(ang) * 0.46, 0.45 + (b % 3) * 0.26, Math.sin(ang) * 0.46);
                bubble.userData.noShadow = true;
                torso.add(bubble);
            }

            tendrils = [];
            for (let tIdx = 0; tIdx < 4; tIdx++) {
                const ang = (tIdx / 4) * Math.PI * 2 + Math.PI / 4;
                const tPivot = new THREE.Group();
                tPivot.position.set(Math.cos(ang) * 0.52, 0.5, Math.sin(ang) * 0.52);
                tPivot.rotation.y = -ang;
                const whip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55, 5), outerSlimeMat);
                whip.position.set(0.22, 0.08, 0);
                whip.rotation.z = -Math.PI * 0.38;
                tPivot.add(whip);
                torso.add(tPivot);
                tendrils.push(tPivot);
            }
            bodyGroup.add(torso);

            head = new THREE.Group();
            head.name = 'Head';
            head.position.set(0, 1.38, 0.24);
            [-0.1, 0.1].forEach((ex) => {
                const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), eyeMat);
                eye.position.set(ex, 0.04, 0.08);
                head.add(eye);
            });
            bodyGroup.add(head);

        } else if (resolvedId === 'runebound_sentinel') {
            const steelMat = new THREE.MeshPhongMaterial({
                color: 0x334155,
                shininess: 60,
                specular: 0x94a3b8,
                flatShading: true
            });
            const darkIronMat = new THREE.MeshLambertMaterial({ color: 0x1e293b, flatShading: true });
            const runeGlowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
            const bladeMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0, flatShading: true });

            const makeSentinelLeg = (side) => {
                const leg = new THREE.Group();
                leg.name = side < 0 ? 'LeftLeg' : 'RightLeg';
                leg.position.set(side * 0.22, 0.7, 0);
                const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.26), darkIronMat);
                pillar.position.y = -0.35;
                const kneeRune = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), runeGlowMat);
                kneeRune.position.set(0, -0.22, 0.15);
                leg.add(pillar, kneeRune);
                return leg;
            };
            leftLeg = makeSentinelLeg(-1);
            rightLeg = makeSentinelLeg(1);
            bodyGroup.add(leftLeg, rightLeg);

            torso = new THREE.Group();
            torso.name = 'Torso';
            const cuirass = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.76, 0.44), steelMat);
            cuirass.position.y = 1.12;
            torso.add(cuirass);

            const chestSigil = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), runeGlowMat);
            chestSigil.position.set(0, 1.15, 0.24);
            torso.add(chestSigil);

            [-1, 1].forEach((side) => {
                const pauldron = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), steelMat);
                pauldron.position.set(side * 0.48, 1.46, 0);
                torso.add(pauldron);
            });
            bodyGroup.add(torso);

            head = new THREE.Group();
            head.name = 'Head';
            head.position.set(0, 1.72, 0);
            const helm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.46, 0.42), darkIronMat);
            head.add(helm);
            const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.06), runeGlowMat);
            visor.position.set(0, 0.02, 0.22);
            head.add(visor);
            const crest = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 4), runeGlowMat);
            crest.position.set(0, 0.34, 0);
            head.add(crest);
            bodyGroup.add(head);

            leftArm = new THREE.Group();
            leftArm.name = 'LeftArm';
            leftArm.position.set(-0.52, 1.38, 0);
            const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), darkIronMat);
            armL.position.y = -0.28;
            const towerShield = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.88, 0.1), steelMat);
            towerShield.position.set(-0.08, -0.35, 0.2);
            const shieldRune = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.12), runeGlowMat);
            shieldRune.position.set(-0.08, -0.35, 0.21);
            leftArm.add(armL, towerShield, shieldRune);
            bodyGroup.add(leftArm);

            rightArm = new THREE.Group();
            rightArm.name = 'RightArm';
            rightArm.position.set(0.52, 1.38, 0);
            const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), darkIronMat);
            armR.position.y = -0.28;
            const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.08), darkIronMat);
            hilt.position.set(0, -0.58, 0.22);
            const swordBlade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.28, 0.06), bladeMat);
            swordBlade.position.set(0, 0.06, 0.24);
            const swordCore = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.0, 0.08), runeGlowMat);
            swordCore.position.set(0, 0.06, 0.24);
            rightArm.add(armR, hilt, swordBlade, swordCore);
            bodyGroup.add(rightArm);

            auraGroup = new THREE.Group();
            auraGroup.name = 'Aura';
            auraGroup.position.set(0, 1.15, 0);
            auraGroup.userData.noShadow = true;
            const halo = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.025, 4, 16), runeGlowMat);
            halo.rotation.x = Math.PI / 2;
            halo.userData.noShadow = true;
            auraGroup.add(halo);
            bodyGroup.add(auraGroup);

        } else if (resolvedId === 'arch_lich') {
            const robeMat = new THREE.MeshLambertMaterial({
                color: 0x1e1b4b,
                emissive: 0x312e81,
                emissiveIntensity: 0.4,
                flatShading: true
            });
            const goldCrownMat = new THREE.MeshLambertMaterial({ color: 0xfbbf24, flatShading: true });
            const boneMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0, flatShading: true });
            const arcaneMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
            const phylacteryMat = new THREE.MeshBasicMaterial({ color: 0xc084fc });

            torso = new THREE.Group();
            torso.name = 'Torso';
            const robeGeo = createMonsterLoftedPrism([
                { y: 0.36, rx: 0.46, rz: 0.38, twist: 0.15 },
                { y: 0.88, rx: 0.30, rz: 0.24, twist: 0 },
                { y: 1.38, rx: 0.40, rz: 0.30, twist: 0.1 },
                { y: 1.54, rx: 0.34, rz: 0.26, twist: 0 }
            ], 8, true, false);
            torso.add(new THREE.Mesh(robeGeo, robeMat));

            const collar = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.22, 0.38), goldCrownMat);
            collar.position.set(0, 1.5, -0.04);
            torso.add(collar);

            soulCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), phylacteryMat);
            soulCore.position.set(0, 1.18, 0.28);
            torso.add(soulCore);

            shroudTails = [];
            for (let i = 0; i < 6; i++) {
                const ang = (i / 6) * Math.PI * 2;
                const tailPivot = new THREE.Group();
                tailPivot.position.set(Math.sin(ang) * 0.4, 0.38, Math.cos(ang) * 0.32);
                tailPivot.rotation.y = ang;
                const hem = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 4), robeMat);
                hem.position.set(0, -0.14, 0.03);
                hem.rotation.x = Math.PI + 0.15;
                tailPivot.add(hem);
                torso.add(tailPivot);
                shroudTails.push(tailPivot);
            }
            bodyGroup.add(torso);

            head = new THREE.Group();
            head.name = 'Head';
            head.position.set(0, 1.76, 0.04);
            const skull = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), boneMat);
            head.add(skull);

            [-0.08, 0.08].forEach((ex) => {
                const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.042, 0), arcaneMat);
                eye.position.set(ex, 0.04, 0.18);
                head.add(eye);
            });

            const crownBand = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.14, 6), goldCrownMat);
            crownBand.position.y = 0.22;
            head.add(crownBand);
            for (let s = 0; s < 5; s++) {
                const ang = (s / 5) * Math.PI * 2;
                const spire = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.24, 4), goldCrownMat);
                spire.position.set(Math.cos(ang) * 0.2, 0.36, Math.sin(ang) * 0.2);
                head.add(spire);
            }
            bodyGroup.add(head);

            const makeLichArm = (side) => {
                const arm = new THREE.Group();
                arm.name = side < 0 ? 'LeftArm' : 'RightArm';
                arm.position.set(side * 0.46, 1.42, 0.04);
                const sleeve = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 5), robeMat);
                sleeve.position.y = -0.22;
                sleeve.rotation.x = Math.PI;
                const hand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.12), boneMat);
                hand.position.set(0, -0.44, 0.06);
                arm.add(sleeve, hand);
                return arm;
            };
            leftArm = makeLichArm(-1);
            rightArm = makeLichArm(1);

            const staff = new THREE.Group();
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 6), goldCrownMat);
            pole.position.y = 0.2;
            const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), arcaneMat);
            orb.position.y = 1.3;
            staff.add(pole, orb);
            staff.position.set(0, -0.45, 0.2);
            staff.rotation.x = 0.2;
            rightArm.add(staff);
            bodyGroup.add(leftArm, rightArm);

            auraGroup = new THREE.Group();
            auraGroup.name = 'Aura';
            auraGroup.position.set(0, 1.15, 0);
            auraGroup.userData.noShadow = true;
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.025, 4, 18), phylacteryMat);
            ring.rotation.x = Math.PI / 2 - 0.2;
            ring.userData.noShadow = true;
            auraGroup.add(ring);
            for (let m = 0; m < 4; m++) {
                const ang = (m / 4) * Math.PI * 2;
                const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), arcaneMat);
                shard.position.set(Math.cos(ang) * 0.78, Math.sin(ang) * 0.2, Math.sin(ang) * 0.78);
                shard.userData.noShadow = true;
                auraGroup.add(shard);
            }
            bodyGroup.add(auraGroup);

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
                leg.name = side < 0 ? 'LeftLeg' : 'RightLeg';
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
            torso.name = 'Torso';
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
            head.name = 'Head';
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
            leftArm.name = 'LeftArm';
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
            rightArm.name = 'RightArm';
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
            if (c.isMesh && !c.userData?.noShadow) {
                c.castShadow = true;
            }
        });

        return {
            group: root,
            animState: {
                monsterId: resolvedId,
                time: 0,
                bodyGroup,
                torso,
                head,
                leftArm,
                rightArm,
                leftLeg,
                rightLeg,
                abdomen,
                fangs,
                spiderLegs,
                shroudTails,
                auraGroup,
                soulCore,
                wings,
                oozeCore,
                tendrils
            }
        };
    }

    /**
     * Load/rebuild Hero and Monster models and start the animation loop
     */
    start(heroConfig, monsterId, monsterScale = 1.0) {
        this.heroAnchor.clear();
        this.enemyAnchor.clear();
        if (this.scene) {
            if (Array.isArray(this.projectiles)) {
                for (const proj of this.projectiles) {
                    if (proj?.mesh) this.scene.remove(proj.mesh);
                }
            }
            if (Array.isArray(this.particles)) {
                for (const pt of this.particles) {
                    if (pt?.mesh) this.scene.remove(pt.mesh);
                }
            }
        }
        this.projectiles = [];
        this.particles = [];
        this.heroAnim = null;
        this.enemyAnim = null;
        this.heroDefending = false;
        this.enemyDefeated = false;
        if (this.guardAura) this.guardAura.visible = false;

        this.currentMonsterId = monsterId || 'skeleton';
        const resolvedScale = Number.isFinite(monsterScale) && monsterScale > 0 ? monsterScale : 1.0;
        this.monsterScale = resolvedScale;
        this.currentMonsterScale = resolvedScale;

        // 1. Build Player Hero Model (Bottom-Left)
        this.heroModel = this.builder.createCharacter(heroConfig);
        this.heroAnchor.position.copy(this.heroPos);
        this.heroAnchor.rotation.set(0, Math.atan2(this.enemyPos.x - this.heroPos.x, this.enemyPos.z - this.heroPos.z), 0);
        this.heroAnchor.scale.setScalar(this.heroScale);
        this.heroAnchor.add(this.heroModel.group);

        // 2. Build Enemy Monster Model (Top-Right)
        this.enemyModel = this.buildMonsterModel(this.currentMonsterId);
        const appliedEnemyScale = this.enemyScale * this.monsterScale;
        if (this.enemyPedestal) {
            const pedScale = Math.max(1, this.monsterScale);
            this.enemyPedestal.scale.set(pedScale, 1, pedScale);
        }
        this.enemyAnchor.position.copy(this.enemyPos);
        this.enemyAnchor.rotation.set(0, Math.atan2(this.heroPos.x - this.enemyPos.x, this.heroPos.z - this.enemyPos.z), 0);
        this.enemyAnchor.scale.setScalar(appliedEnemyScale);
        this.enemyAnchor.add(this.enemyModel.group);

        this.active = true;
        this.clock.getDelta();
        this.resize();
        this.updateCameraFraming();
        if (this.rafId === null) {
            this.animate();
        }
    }

    /**
     * Dynamically frames camera based on actual 3D bounding boxes of both Hero and Enemy
     * so normal adversaries and huge bosses fit completely inside the battle view.
     */
    updateCameraFraming() {
        if (!this.camera || !this.heroAnchor || !this.enemyAnchor) return;

        if (this.scene && typeof this.scene.updateMatrixWorld === 'function') {
            this.scene.updateMatrixWorld(true);
        }

        const heroBox = new THREE.Box3().setFromObject(this.heroAnchor);
        const enemyBox = new THREE.Box3().setFromObject(this.enemyAnchor);

        if (heroBox.isEmpty() || enemyBox.isEmpty()) return;

        const totalBox = heroBox.clone().union(enemyBox);
        const center = totalBox.getCenter(new THREE.Vector3());

        const lookAtPoint = new THREE.Vector3(center.x * 0.4, center.y + 0.04, center.z * 0.4);

        const F = new THREE.Vector3(0, -0.34, -0.94).normalize();
        const R = new THREE.Vector3(1, 0, 0);
        const U = new THREE.Vector3().crossVectors(R, F).normalize();

        const vFovRad = THREE.MathUtils.degToRad(this.camera.fov);
        const tanHalfV = Math.tan(vFovRad / 2);
        const tanHalfH = tanHalfV * (this.camera.aspect || 1);

        const maxNdcY = 0.85;
        const maxNdcX = 0.70;

        const getCorners = (box) => [
            new THREE.Vector3(box.min.x, box.min.y, box.min.z),
            new THREE.Vector3(box.min.x, box.min.y, box.max.z),
            new THREE.Vector3(box.min.x, box.max.y, box.min.z),
            new THREE.Vector3(box.min.x, box.max.y, box.max.z),
            new THREE.Vector3(box.max.x, box.min.y, box.min.z),
            new THREE.Vector3(box.max.x, box.min.y, box.max.z),
            new THREE.Vector3(box.max.x, box.max.y, box.min.z),
            new THREE.Vector3(box.max.x, box.max.y, box.max.z)
        ];

        const allCorners = [...getCorners(heroBox), ...getCorners(enemyBox)];
        let requiredDist = 5.75;

        for (const corner of allCorners) {
            const rel = corner.clone().sub(lookAtPoint);
            const depthAlongF = rel.dot(F);
            const xProj = Math.abs(rel.dot(R));
            const yProj = Math.abs(rel.dot(U));

            const distForX = xProj / (maxNdcX * tanHalfH) - depthAlongF;
            const distForY = yProj / (maxNdcY * tanHalfV) - depthAlongF;
            requiredDist = Math.max(requiredDist, distForX, distForY);
        }

        this.camera.position.copy(lookAtPoint).addScaledVector(F, -requiredDist);
        this.camera.lookAt(lookAtPoint);
        this.camera.updateMatrixWorld(true);
    }

    stop() {
        this.active = false;
        if (this.rafId !== null) {
            if (typeof cancelAnimationFrame === 'function') {
                cancelAnimationFrame(this.rafId);
            }
            this.rafId = null;
        }
    }

    dispose() {
        this.stop();
        if (typeof window !== 'undefined' && this._onResize) {
            window.removeEventListener('resize', this._onResize);
        }
        if (this.renderer) {
            this.renderer.dispose?.();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
        this.scene = null;
        this.camera = null;
        this.renderer = null;
    }

    resize() {
        if (!this.renderer || !this.camera || !this.container) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        if (width <= 0 || height <= 0) return;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.updateCameraFraming();
    }

    spawnParticles(origin, color, count = 16, mode = 'burst') {
        if (!this.scene || !origin) return;
        if (!this.particles) this.particles = [];
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
        if (!this.scene || !startPos || !endPos) return;
        if (!this.projectiles) this.projectiles = [];
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
            targetOrigin: endPos.clone(),
            t: 0,
            color
        });
    }

    playHeroAttack(type) {
        const isSpell = Boolean(
            type === 'basic_magic' ||
            type === 'special_firebolt' ||
            type === 'holy_water' ||
            (typeof type === 'string' && (type.startsWith('spell_') || Object.hasOwn(SHOP_SPELLS, type)))
        );
        if (isSpell) {
            this.heroAnim = { kind: 'cast', t: 0, dur: 0.55 };
            let color = 0x38bdf8;
            if (type === 'special_firebolt') color = 0xf97316;
            else if (type === 'holy_water' || type === 'chronos_thunder' || type === 'spell_chronos_thunder') color = 0xfacc15;
            else if (type === 'arcane_bolt_barrage' || type === 'spell_arcane_bolt_barrage') color = 0xc084fc;
            else if (type === 'vampiric_drain' || type === 'spell_vampiric_drain') color = 0xef4444;
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

    playEnemyAttack(options = {}) {
        const opts = typeof options === 'boolean' ? { isSpecial: options } : (options || {});
        const isSpecial = Boolean(opts.isSpecial);
        const monsterId = opts.monsterId || this.currentMonsterId || this.enemyModel?.animState?.monsterId || 'skeleton';

        if (isSpecial) {
            if (monsterId === 'crypt_spider') {
                this.enemyAnim = { kind: 'special_venom', t: 0, dur: 0.72, fired: false };
            } else if (monsterId === 'shadow_wraith') {
                this.enemyAnim = { kind: 'special_drain', t: 0, dur: 0.72, fired: false };
            } else if (monsterId === 'crypt_ghoul') {
                this.enemyAnim = { kind: 'special_pounce', t: 0, dur: 0.7 };
            } else if (monsterId === 'obsidian_gargoyle') {
                this.enemyAnim = { kind: 'special_pounce', t: 0, dur: 0.72 };
            } else if (monsterId === 'blight_ooze') {
                this.enemyAnim = { kind: 'special_venom', t: 0, dur: 0.72, fired: false };
            } else if (monsterId === 'arch_lich') {
                this.enemyAnim = { kind: 'special_drain', t: 0, dur: 0.74, fired: false };
            } else {
                this.enemyAnim = { kind: 'special_bash', t: 0, dur: 0.68 };
            }
        } else {
            this.enemyAnim = { kind: 'lunge', t: 0, dur: 0.6 };
        }
    }

    playMonsterAttack(options = {}) {
        return this.playEnemyAttack(options);
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
        const baseScale = Number.isFinite(this.enemyScale) && this.enemyScale > 0 ? this.enemyScale : 1.32;
        const mult = Number.isFinite(this.monsterScale) && this.monsterScale > 0
            ? this.monsterScale
            : (Number.isFinite(this.currentMonsterScale) && this.currentMonsterScale > 0
                ? this.currentMonsterScale
                : 1.0);
        const startScale = baseScale * mult;
        this.enemyAnim = { kind: 'defeat', t: 0, dur: 0.65, startScale };
        this.spawnParticles(this.enemyPos, 0xfacc15, 26, 'burst');
    }

    update(delta, elapsedTime = 0) {
        if (!Number.isFinite(delta) || delta < 0) return;

        // Torch flame flicker
        if (Array.isArray(this.torchFlames)) {
            this.torchFlames.forEach((f, idx) => {
                f.rotation.y += delta * 2.5;
                const s = 0.85 + Math.sin(elapsedTime * 12 + idx) * 0.2;
                f.scale.set(s, s * 1.3, s);
            });
        }

        // Guard aura spin
        if (this.guardAura && this.guardAura.visible) {
            this.guardAura.rotation.y += delta * 1.8;
        }

        // Hero idle & action animations
        if (this.heroModel) {
            this.heroModel.update(delta);
            const anim = this.heroModel.animState;
            const baseYaw = this.heroPos && this.enemyPos
                ? Math.atan2(this.enemyPos.x - this.heroPos.x, this.enemyPos.z - this.heroPos.z)
                : 0;

            if (this.heroDefending && anim?.leftArm && !this.heroAnim) {
                anim.leftArm.rotation.x = -0.9;
                anim.leftArm.rotation.z = -0.35;
            } else if (anim?.leftArm && !this.heroAnim) {
                anim.leftArm.rotation.z = 0;
            }

            if (this.heroAnim) {
                this.heroAnim.t += delta;
                const p = Math.min(1, this.heroAnim.t / (this.heroAnim.dur || 0.6));

                if (this.heroAnim.kind === 'lunge' || this.heroAnim.kind === 'spin_lunge') {
                    const lunge = Math.sin(p * Math.PI);
                    if (this.heroAnchor && this.heroPos && this.enemyPos) {
                        this.heroAnchor.position.lerpVectors(this.heroPos, this.enemyPos, lunge * 0.58);
                    }
                    if (anim?.rightArm) anim.rightArm.rotation.x = -Math.sin(p * Math.PI * 1.3) * 1.65;
                    if (this.heroAnim.kind === 'spin_lunge' && this.heroAnchor) {
                        this.heroAnchor.rotation.y = baseYaw + p * Math.PI * 2;
                    }
                } else if (this.heroAnim.kind === 'cast') {
                    const swing = Math.sin(p * Math.PI);
                    if (anim?.rightArm) anim.rightArm.rotation.x = -swing * 1.4;
                } else if (this.heroAnim.kind === 'hit') {
                    const shake = Math.sin(p * Math.PI * 6) * (1 - p) * 0.14;
                    if (this.heroAnchor && this.heroPos) {
                        this.heroAnchor.position.set(this.heroPos.x + shake, this.heroPos.y, this.heroPos.z + (1 - p) * 0.15);
                    }
                }

                if (p >= 1) {
                    this.heroAnim = null;
                    if (this.heroAnchor && this.heroPos) {
                        this.heroAnchor.position.copy(this.heroPos);
                        this.heroAnchor.rotation.y = baseYaw;
                    }
                }
            }
        }

        // Monster idle & action animations
        const mAnim = this.enemyModel?.animState || null;
        if (mAnim) {
            mAnim.time = (mAnim.time || 0) + delta;

            if (mAnim.soulCore) {
                mAnim.soulCore.rotation.y += delta * 2.5;
                mAnim.soulCore.rotation.x += delta * 1.2;
            }
            if (mAnim.auraGroup) {
                mAnim.auraGroup.rotation.y += delta * 1.4;
            }

            if (!this.enemyDefeated && !this.enemyAnim) {
                const t = mAnim.time;
                if (mAnim.monsterId === 'crypt_spider') {
                    if (mAnim.bodyGroup) mAnim.bodyGroup.position.y = Math.sin(t * 3.6) * 0.025;
                    if (mAnim.abdomen) mAnim.abdomen.rotation.x = 0.06 + Math.sin(t * 3.2) * 0.06;
                    if (Array.isArray(mAnim.fangs)) {
                        mAnim.fangs.forEach((f, idx) => {
                            const dir = idx === 0 ? -1 : 1;
                            f.rotation.z = dir * (0.06 + Math.sin(t * 7.5 + idx) * 0.08);
                        });
                    }
                    if (Array.isArray(mAnim.spiderLegs)) {
                        mAnim.spiderLegs.forEach((leg, idx) => {
                            const phase = t * 4.2 + idx * 0.9;
                            leg.hipGroup.rotation.z = leg.side * Math.sin(phase) * 0.07;
                            leg.kneeGroup.rotation.z = -leg.side * Math.cos(phase) * 0.08;
                        });
                    }
                } else if (mAnim.monsterId === 'shadow_wraith' || mAnim.monsterId === 'arch_lich') {
                    if (mAnim.bodyGroup) {
                        mAnim.bodyGroup.position.y = 0.14 + Math.sin(t * 2.2) * 0.10;
                        mAnim.bodyGroup.rotation.z = Math.sin(t * 1.1) * 0.04;
                    }
                    if (Array.isArray(mAnim.shroudTails)) {
                        mAnim.shroudTails.forEach((tail, idx) => {
                            tail.rotation.x = Math.sin(t * 2.8 + idx * 0.8) * 0.18;
                        });
                    }
                    if (mAnim.head) mAnim.head.rotation.y = Math.sin(t * 1.5) * 0.10;
                    if (mAnim.rightArm) mAnim.rightArm.rotation.x = -0.55 + Math.sin(t * 2.0) * 0.12;
                    if (mAnim.leftArm) mAnim.leftArm.rotation.x = -0.55 - Math.sin(t * 2.0) * 0.12;
                } else if (mAnim.monsterId === 'blight_ooze') {
                    if (mAnim.bodyGroup) {
                        const squash = 1.0 + Math.sin(t * 3.4) * 0.06;
                        mAnim.bodyGroup.scale.set(squash, 1 / squash, squash);
                    }
                    if (mAnim.oozeCore) mAnim.oozeCore.rotation.y += delta * 2.0;
                    if (Array.isArray(mAnim.tendrils)) {
                        mAnim.tendrils.forEach((td, idx) => {
                            td.rotation.z = Math.sin(t * 3.0 + idx * 1.2) * 0.18;
                        });
                    }
                } else {
                    const crouchOffset = mAnim.monsterId === 'crypt_ghoul' ? -0.04 : 0;
                    if (mAnim.torso) mAnim.torso.position.y = crouchOffset + Math.sin(t * 2.4) * 0.03;
                    if (mAnim.head) mAnim.head.rotation.y = Math.sin(t * 1.3) * 0.08;
                    if (mAnim.rightArm) mAnim.rightArm.rotation.x = -0.15 + Math.sin(t * 2.1) * 0.08;
                    if (mAnim.leftArm) mAnim.leftArm.rotation.x = -0.25 - Math.sin(t * 2.1) * 0.05;
                    if (Array.isArray(mAnim.wings)) {
                        mAnim.wings.forEach((w) => {
                            w.group.rotation.y = w.side * (0.2 + Math.sin(t * 3.2) * 0.18);
                        });
                    }
                }
            }
        }

        if (this.enemyAnim) {
            this.enemyAnim.t += delta;
            const dur = this.enemyAnim.dur || 0.6;
            const p = Math.min(1, this.enemyAnim.t / dur);
            const kind = this.enemyAnim.kind;

            const resetEnemyPose = () => {
                if (this.enemyAnchor && this.enemyPos) {
                    this.enemyAnchor.position.copy(this.enemyPos);
                }
                if (mAnim) {
                    if (mAnim.bodyGroup) {
                        mAnim.bodyGroup.rotation.set(0, 0, 0);
                        mAnim.bodyGroup.position.set(0, 0, 0);
                    }
                    if (mAnim.leftArm) mAnim.leftArm.rotation.set(0, 0, 0);
                    if (mAnim.rightArm) mAnim.rightArm.rotation.set(0, 0, 0);
                    if (Array.isArray(mAnim.fangs)) {
                        mAnim.fangs.forEach((f) => f.rotation.set(0, 0, 0));
                    }
                    if (Array.isArray(mAnim.spiderLegs)) {
                        mAnim.spiderLegs.forEach((leg) => {
                            leg.hipGroup.rotation.set(0, leg.baseYaw, 0);
                            leg.kneeGroup.rotation.set(0, 0, 0);
                        });
                    }
                }
            };

            if (kind === 'lunge') {
                const lunge = Math.sin(p * Math.PI);
                if (this.enemyAnchor && this.enemyPos && this.heroPos) {
                    this.enemyAnchor.position.lerpVectors(this.enemyPos, this.heroPos, lunge * 0.58);
                }
                if (mAnim?.monsterId === 'crypt_spider') {
                    if (Array.isArray(mAnim.fangs)) {
                        mAnim.fangs.forEach((f, idx) => {
                            f.rotation.z = (idx === 0 ? -1 : 1) * Math.sin(p * Math.PI) * 0.35;
                        });
                    }
                    if (Array.isArray(mAnim.spiderLegs)) {
                        mAnim.spiderLegs.forEach((leg, idx) => {
                            leg.hipGroup.rotation.z = leg.side * Math.sin(p * Math.PI * 6 + idx) * 0.22;
                        });
                    }
                } else if (mAnim?.monsterId === 'shadow_wraith') {
                    if (mAnim.leftArm) mAnim.leftArm.rotation.x = -Math.sin(p * Math.PI * 1.3) * 1.35;
                    if (mAnim.rightArm) mAnim.rightArm.rotation.x = -Math.sin(p * Math.PI * 1.3) * 1.35;
                } else {
                    if (mAnim?.rightArm) mAnim.rightArm.rotation.x = -Math.sin(p * Math.PI * 1.3) * 1.5;
                }
                if (p >= 1) {
                    this.enemyAnim = null;
                    resetEnemyPose();
                }
            } else if (kind === 'special_venom') {
                if (p < 0.35) {
                    const wind = p / 0.35;
                    if (mAnim?.bodyGroup) mAnim.bodyGroup.rotation.x = -0.45 * wind;
                    if (Array.isArray(mAnim?.fangs)) {
                        mAnim.fangs.forEach((f, idx) => {
                            f.rotation.z = (idx === 0 ? -1 : 1) * 0.42 * wind;
                        });
                    }
                } else {
                    if (!this.enemyAnim.fired) {
                        this.enemyAnim.fired = true;
                        this.spawnProjectile(this.enemyPos, this.heroPos, 0x84cc16);
                    }
                    const strike = (p - 0.35) / 0.65;
                    const lunge = Math.sin(strike * Math.PI);
                    if (this.enemyAnchor && this.enemyPos && this.heroPos) {
                        this.enemyAnchor.position.lerpVectors(this.enemyPos, this.heroPos, lunge * 0.52);
                    }
                    if (mAnim?.bodyGroup) mAnim.bodyGroup.rotation.x = -0.45 * (1 - strike) + 0.22 * lunge;
                }
                if (p >= 1) {
                    this.enemyAnim = null;
                    resetEnemyPose();
                }
            } else if (kind === 'special_drain') {
                const lift = Math.sin(p * Math.PI);
                if (this.enemyAnchor && this.enemyPos) {
                    this.enemyAnchor.position.set(this.enemyPos.x, this.enemyPos.y + lift * 0.42, this.enemyPos.z);
                }
                if (mAnim?.leftArm) {
                    mAnim.leftArm.rotation.z = 0.85 * lift;
                    mAnim.leftArm.rotation.x = -1.1 * lift;
                }
                if (mAnim?.rightArm) {
                    mAnim.rightArm.rotation.z = -0.85 * lift;
                    mAnim.rightArm.rotation.x = -1.1 * lift;
                }
                if (mAnim?.auraGroup) {
                    mAnim.auraGroup.rotation.y += delta * 6.5;
                }
                if (p >= 0.3 && !this.enemyAnim.fired) {
                    this.enemyAnim.fired = true;
                    this.spawnProjectile(this.enemyPos, this.heroPos, 0xa855f7);
                }
                if (p >= 1) {
                    this.enemyAnim = null;
                    resetEnemyPose();
                }
            } else if (kind === 'special_pounce') {
                const arc = Math.sin(p * Math.PI);
                if (this.enemyAnchor && this.enemyPos && this.heroPos) {
                    this.enemyAnchor.position.lerpVectors(this.enemyPos, this.heroPos, arc * 0.64);
                    this.enemyAnchor.position.y += arc * 0.55;
                }
                if (mAnim?.leftArm) mAnim.leftArm.rotation.x = -Math.sin(p * Math.PI * 1.4) * 1.75;
                if (mAnim?.rightArm) mAnim.rightArm.rotation.x = -Math.sin(p * Math.PI * 1.4) * 1.75;
                if (p >= 1) {
                    this.enemyAnim = null;
                    resetEnemyPose();
                }
            } else if (kind === 'special_bash') {
                const charge = Math.sin(p * Math.PI);
                if (this.enemyAnchor && this.enemyPos && this.heroPos) {
                    this.enemyAnchor.position.lerpVectors(this.enemyPos, this.heroPos, charge * 0.66);
                }
                if (mAnim?.leftArm) mAnim.leftArm.rotation.x = -charge * 1.35;
                if (mAnim?.rightArm) mAnim.rightArm.rotation.x = -Math.sin(p * Math.PI * 1.5) * 1.65;
                if (p >= 1) {
                    this.enemyAnim = null;
                    resetEnemyPose();
                }
            } else if (kind === 'hit') {
                const shake = Math.sin(p * Math.PI * 6) * (1 - p) * 0.16;
                if (this.enemyAnchor && this.enemyPos) {
                    this.enemyAnchor.position.set(this.enemyPos.x + shake, this.enemyPos.y, this.enemyPos.z - (1 - p) * 0.18);
                }
                if (p >= 1) {
                    this.enemyAnim = null;
                    resetEnemyPose();
                }
            } else if (kind === 'defeat') {
                const baseY = this.enemyPos ? this.enemyPos.y : 0;
                const fallbackBase = Number.isFinite(this.enemyScale) && this.enemyScale > 0 ? this.enemyScale : 1.32;
                const fallbackMult = Number.isFinite(this.monsterScale) && this.monsterScale > 0
                    ? this.monsterScale
                    : (Number.isFinite(this.currentMonsterScale) && this.currentMonsterScale > 0
                        ? this.currentMonsterScale
                        : 1.0);
                const startScale = Number.isFinite(this.enemyAnim.startScale)
                    ? this.enemyAnim.startScale
                    : fallbackBase * fallbackMult;

                if (this.enemyAnchor) {
                    this.enemyAnchor.rotation.x = -p * (Math.PI / 2);
                    this.enemyAnchor.position.y = baseY - p * 0.25;
                    this.enemyAnchor.scale.setScalar(startScale * Math.max(0.05, 1 - p * 0.35));
                }
                if (Array.isArray(mAnim?.spiderLegs)) {
                    mAnim.spiderLegs.forEach((leg) => {
                        leg.hipGroup.rotation.z = -leg.side * p * 0.55;
                    });
                }
                if (p >= 1) {
                    this.enemyAnim = null;
                }
            }
        }

        // Projectiles
        if (Array.isArray(this.projectiles)) {
            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const proj = this.projectiles[i];
                proj.t += delta * 2.6;
                const p = Math.min(1, proj.t);
                proj.mesh.position.lerpVectors(proj.start, proj.end, p);
                proj.mesh.position.y += Math.sin(p * Math.PI) * 0.35;
                proj.mesh.rotation.y += delta * 10;
                if (p >= 1) {
                    if (this.scene) this.scene.remove(proj.mesh);
                    const impactPos = proj.targetOrigin || this.enemyPos;
                    this.spawnParticles(impactPos, proj.color, 14, 'burst');
                    this.projectiles.splice(i, 1);
                }
            }
        }

        // Particles
        if (Array.isArray(this.particles)) {
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const pt = this.particles[i];
                pt.life += delta;
                const p = pt.life / pt.maxLife;
                pt.mesh.position.addScaledVector(pt.vel, delta);
                if (pt.mode !== 'rise') pt.vel.y -= 6.5 * delta;
                pt.mesh.material.opacity = Math.max(0, 1 - p);
                pt.mesh.scale.setScalar(Math.max(0.1, 1 - p * 0.7));
                if (p >= 1) {
                    if (this.scene) this.scene.remove(pt.mesh);
                    this.particles.splice(i, 1);
                }
            }
        }
    }

    animate() {
        if (!this.active) return;
        if (typeof requestAnimationFrame === 'function') {
            this.rafId = requestAnimationFrame(() => this.animate());
        } else {
            this.rafId = null;
        }

        const delta = Math.min(this.clock.getDelta(), 0.05);
        const time = this.clock.elapsedTime;
        this.update(delta, time);

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}
