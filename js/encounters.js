/**
 * Adventure World Floor 1 Encounters, Trap Archetypes & Isolated Per-Run Factory
 * Pure ES module with zero DOM or Three.js dependencies.
 */

import { createFloor1Layout } from './floor1Layout.js';
import { createFloor2Layout } from './floor2Layout.js';
import { PUZZLE_DEFINITIONS } from './puzzles.js';

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

function createSeededRng(seed) {
    if (seed === null || seed === undefined) {
        return Math.random;
    }
    let h = 2166136261 >>> 0;
    const str = `${seed}:encounters`;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
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

export const TRAP_ARCHETYPES = deepFreeze({
    spike_pit: {
        trapType: 'spike_pit',
        name: 'Concealed Spike Pit',
        icon: '🕳️',
        description: 'Hairline cracks crisscross rotting flagstones above a sunken shaft bristling with crusted iron spikes.',
        damage: 13,
        triggerRadius: 2.1,
        disarmable: true,
        stepTrigger: true,
        options: [
            {
                label: 'Vault across the collapsing ledge',
                stat: 'agi',
                statName: 'Agility',
                dc: 11,
                successMsg: 'You kick off the crumbling rim and clear the jagged spikes cleanly!',
                failMsg: 'The stone snaps underfoot! Rusted spikes rake your flank as you haul yourself free.',
                reward: { xp: 25 },
                penalty: { hpDamage: 13 }
            },
            {
                label: 'Jam the tilt-plate hinge with brute force',
                stat: 'str',
                statName: 'Strength',
                dc: 12,
                successMsg: 'You drive a heavy stone wedge under the hinge, locking the pitfall shut.',
                failMsg: 'The slab drops abruptly, wrenching your shoulder and grazing you against the spikes.',
                reward: { xp: 25 },
                penalty: { hpDamage: 14 }
            },
            {
                label: 'Trace the counterweight seam and pin the latch',
                stat: 'int',
                statName: 'Intelligence',
                dc: 11,
                successMsg: 'Spotting the false grout seam, you slip an iron spike into the release catch.',
                failMsg: 'Your probe trips the hair-trigger! The lid snaps open beneath your boots.',
                reward: { xp: 25 },
                penalty: { hpDamage: 11 }
            }
        ]
    },
    pendulum_scythe: {
        trapType: 'pendulum_scythe',
        name: 'Swinging Pendulum Scythe',
        icon: '🪓',
        description: 'Deep gouges score the flagstone floor beneath a dark ceiling slot where iron chains rattle in the gloom.',
        damage: 14,
        triggerRadius: 2.1,
        disarmable: true,
        stepTrigger: true,
        options: [
            {
                label: 'Roll beneath the whistling crescent blade',
                stat: 'agi',
                statName: 'Agility',
                dc: 12,
                successMsg: 'You dive beneath the howling steel arc and slide clear without a scratch.',
                failMsg: 'The cold iron edge clips your armor as you mistime the pendulum beat!',
                reward: { xp: 30 },
                penalty: { hpDamage: 14 }
            },
            {
                label: 'Wrench the wall sprocket off its axle',
                stat: 'str',
                statName: 'Strength',
                dc: 13,
                successMsg: 'With grinding metal, you tear the tension gear loose—the scythe stalls overhead.',
                failMsg: 'The tension spring snaps back violently, bruising your ribs and releasing a grazing sweep.',
                reward: { xp: 30 },
                penalty: { hpDamage: 15 }
            },
            {
                label: 'Time the gear cadence and jam the wall pawl',
                stat: 'int',
                statName: 'Intelligence',
                dc: 11,
                successMsg: 'Counting the chain ticks, you wedge the escapement gear mid-swing.',
                failMsg: 'A skipped link throws off your timing—the blade lashes past across your arm.',
                reward: { xp: 30 },
                penalty: { hpDamage: 12 }
            }
        ]
    },
    dart_wall: {
        trapType: 'dart_wall',
        name: 'Venomous Dart Wall',
        icon: '🏹',
        description: 'Blackened skull reliefs line the masonry, their hollow jaws concealing taut firing slits.',
        damage: 10,
        triggerRadius: 2.1,
        disarmable: true,
        stepTrigger: true,
        options: [
            {
                label: 'Weave low past the firing slits',
                stat: 'agi',
                statName: 'Agility',
                dc: 11,
                successMsg: 'A hiss of air whistles harmlessly overhead as you duck between the stone reliefs.',
                failMsg: 'A volley of corroded needles snaps out, stinging through your cloak!',
                reward: { xp: 25 },
                penalty: { hpDamage: 10 }
            },
            {
                label: 'Raise your guard and weather the volley',
                stat: 'vit',
                statName: 'Vitality',
                dc: 10,
                successMsg: 'You turn aside the worst of the barrage and stride past unshaken.',
                failMsg: 'Barbed darts punch into your shoulder before the mechanism spends its tension.',
                reward: { xp: 25 },
                penalty: { hpDamage: 9 }
            },
            {
                label: 'Plug the pressure-linked masonry conduits',
                stat: 'int',
                statName: 'Intelligence',
                dc: 11,
                successMsg: 'You trace the floor seam to the wall ports and choke the springs with stone chips.',
                failMsg: 'The final port misfires in your face with a burst of stale dust and iron needles!',
                reward: { xp: 25 },
                penalty: { hpDamage: 10 }
            }
        ]
    },
    blood_rune: {
        trapType: 'blood_rune',
        name: 'Cursed Blood Rune',
        icon: '🩸',
        description: 'A pulsing crimson sigil etched in dried blood hums across the floor, drinking warmth from the air.',
        damage: 15,
        triggerRadius: 2.2,
        disarmable: true,
        stepTrigger: true,
        options: [
            {
                label: 'Unravel the binding sigil with a counter-ward',
                stat: 'int',
                statName: 'Intelligence',
                dc: 12,
                successMsg: 'You invert the outer glyph strokes; the crimson light gutters out in cold smoke.',
                failMsg: 'The sigil flares violently, searing your veins with necrotic backlash!',
                reward: { xp: 35 },
                penalty: { hpDamage: 13 }
            },
            {
                label: 'Endure the life-drain and break the circle',
                stat: 'vit',
                statName: 'Vitality',
                dc: 11,
                successMsg: 'Gritting your teeth against the chill, you step through and scuff the blood-circle dead.',
                failMsg: 'The ward drinks deep from your pulse before your boot smears the rune.',
                reward: { xp: 35 },
                penalty: { hpDamage: 15 }
            },
            {
                label: 'Shatter the central etched keystone',
                stat: 'str',
                statName: 'Strength',
                dc: 13,
                successMsg: 'One crushing blow cracks the focal slate in two, shattering the curse!',
                failMsg: 'The fractured stone discharges a shockwave of crimson embers into your chest.',
                reward: { xp: 35 },
                penalty: { hpDamage: 14 }
            }
        ]
    }
});

const MONSTER_TEMPLATES = deepFreeze({
    skeleton: {
        monsterId: 'skeleton',
        name: 'Skeletal Vanguard',
        icon: '💀',
        monsterScale: 1.0,
        aggroRadius: 4.8,
        triggerRadius: 2.2,
        description: 'An ancient animated skeleton clad in tarnished mail raises a rusted halberd and fixes hollow glowing sockets upon you!',
        options: [
            {
                label: 'Engage in Tactical Turn-Based Combat',
                action: 'combat',
                stat: 'str',
                statName: 'Strength'
            }
        ]
    },
    crypt_ghoul: {
        monsterId: 'crypt_ghoul',
        name: 'Crypt Stalker Ghoul',
        icon: '🧟',
        monsterScale: 1.05,
        aggroRadius: 5.0,
        triggerRadius: 2.2,
        description: 'A hunched, starving ghoul unhinges its jaw over gnawed femurs, lunging forward with crusted claws.',
        options: [
            {
                label: 'Engage in Tactical Turn-Based Combat',
                action: 'combat',
                stat: 'str',
                statName: 'Strength'
            }
        ]
    },
    crypt_spider: {
        monsterId: 'crypt_spider',
        name: 'Crypt Widow',
        icon: '🕷️',
        monsterScale: 1.05,
        aggroRadius: 5.0,
        triggerRadius: 2.2,
        description: 'A chitinous tomb-spider drops from pale webbing, its clustered obsidian eyes glittering with venom.',
        options: [
            {
                label: 'Engage in Tactical Turn-Based Combat',
                action: 'combat',
                stat: 'agi',
                statName: 'Agility'
            }
        ]
    },
    shadow_wraith: {
        monsterId: 'shadow_wraith',
        name: 'Hollow Wraith',
        icon: '👻',
        monsterScale: 1.2,
        aggroRadius: 5.5,
        triggerRadius: 2.2,
        description: 'A towering shroud of freezing grave-mist coalesces before the sanctum seal, wielding a spectral scythe of frost.',
        options: [
            {
                label: 'Engage in Tactical Turn-Based Combat',
                action: 'combat',
                stat: 'int',
                statName: 'Intelligence'
            }
        ]
    }
});

const DEFAULT_ROOM_MONSTERS = deepFreeze({
    room_3_charnel: 'skeleton',
    room_3b_crypt: 'crypt_ghoul',
    room_5_lair: 'crypt_spider',
    room_6_sanctum: 'shadow_wraith'
});

const DEFAULT_ROOM_TRAPS = deepFreeze({
    room_2_blades: 'pendulum_scythe',
    room_2b_runes: 'blood_rune',
    room_4_cistern: 'spike_pit',
    room_4b_gauntlet: 'dart_wall'
});

const MONSTER_POOL = ['skeleton', 'crypt_ghoul', 'crypt_spider', 'shadow_wraith'];
const TRAP_POOL = ['pendulum_scythe', 'blood_rune', 'spike_pit', 'dart_wall'];

function createCombatEncounter(id, roomId, pos, monsterId) {
    const tpl = MONSTER_TEMPLATES[monsterId] || MONSTER_TEMPLATES.skeleton;
    return {
        id,
        name: tpl.name,
        icon: tpl.icon,
        roomId,
        kind: 'combat',
        pos: { x: pos.x, y: 0, z: pos.z },
        triggerRadius: tpl.triggerRadius,
        description: tpl.description,
        resolved: false,
        isCombat: true,
        monsterId: tpl.monsterId,
        monsterScale: tpl.monsterScale,
        aggroRadius: tpl.aggroRadius,
        options: deepClone(tpl.options)
    };
}

function createTrapEncounter(id, roomId, pos, trapType) {
    const arch = TRAP_ARCHETYPES[trapType] || TRAP_ARCHETYPES.spike_pit;
    return {
        id,
        name: arch.name,
        icon: arch.icon,
        roomId,
        kind: 'trap',
        pos: { x: pos.x, y: 0, z: pos.z },
        triggerRadius: arch.triggerRadius,
        description: arch.description,
        resolved: false,
        isCombat: false,
        trapType: arch.trapType,
        trapState: 'armed',
        disarmable: arch.disarmable,
        stepTrigger: arch.stepTrigger,
        damage: arch.damage,
        options: deepClone(arch.options)
    };
}

function createDoorEncounters(floor) {
    const encounters = [];
    for (const door of floor.doors) {
        const approachRoomId = door.connects[0];
        if (door.id === 'door_portcullis') {
            encounters.push({
                id: door.encounterId || 'portcullis',
                name: 'Rusted Iron Portcullis',
                icon: '🚪',
                roomId: approachRoomId,
                kind: 'door',
                doorId: door.id,
                retryable: true,
                pos: { x: door.x, y: 0, z: door.z },
                triggerRadius: 2.1,
                description: 'A heavy iron portcullis bars the northern archway into the Charnel Ossuary. Dried blood and deep claw marks score the bars.',
                resolved: false,
                isCombat: false,
                options: [
                    {
                        label: 'Force the rusted gate upward with brute strength',
                        stat: 'str',
                        statName: 'Strength',
                        dc: 12,
                        successMsg: 'With a grating shriek of iron, you hoist the spiked gate overhead and wedge the latch open!',
                        failMsg: 'The heavy iron screeches but refuses to budge, tearing at your grip.',
                        reward: { xp: 25, unlocksDoor: true },
                        penalty: { hpDamage: 8 }
                    },
                    {
                        label: 'Pick the corroded counterweight mechanism',
                        stat: 'agi',
                        statName: 'Agility',
                        dc: 12,
                        successMsg: 'Your pick catches the hidden pawl! The counterweight drops and the portcullis rises.',
                        failMsg: 'The rusted pin snaps inside the housing, jarring your knuckles.',
                        reward: { xp: 25, unlocksDoor: true },
                        penalty: { hpDamage: 6 }
                    }
                ]
            });
        } else {
            encounters.push({
                id: door.encounterId || 'sanctum_gate',
                name: 'Sealed Sanctum Gate',
                icon: '⛓️',
                roomId: approachRoomId,
                kind: 'door',
                doorId: door.id,
                retryable: true,
                pos: { x: door.x, y: 0, z: door.z },
                triggerRadius: 2.1,
                description: 'Chains wrapped in bone-white runes lock the obsidian gate guarding the Sanctum of the Phusza Seal.',
                resolved: false,
                isCombat: false,
                options: [
                    {
                        label: 'Snap the rune-bound chains with raw force',
                        stat: 'str',
                        statName: 'Strength',
                        dc: 13,
                        successMsg: 'Links burst apart in a shower of cold sparks as the sanctum gate groans inward!',
                        failMsg: 'The iron chains hold fast and recoil across your arms.',
                        reward: { xp: 40, unlocksDoor: true },
                        penalty: { hpDamage: 10 }
                    },
                    {
                        label: 'Slip the warded lockpin with steady fingers',
                        stat: 'agi',
                        statName: 'Agility',
                        dc: 13,
                        successMsg: 'You coax the frozen tumblers into alignment; the heavy bolt slides free.',
                        failMsg: 'A jagged ward-needle pricks your thumb as the lock resets.',
                        reward: { xp: 40, unlocksDoor: true },
                        penalty: { hpDamage: 8 }
                    },
                    {
                        label: 'Unbind the necromantic seal-glyphs',
                        stat: 'int',
                        statName: 'Intelligence',
                        dc: 12,
                        successMsg: 'Tracing the reverse sigil, you extinguish the ward and part the sanctum doors.',
                        failMsg: 'Spectral frost bites back across your palms as the glyph resists.',
                        reward: { xp: 40, unlocksDoor: true },
                        penalty: { hpDamage: 9 }
                    }
                ]
            });
        }
    }
    return encounters;
}

/**
 * Generates an isolated, deep-cloned Floor 1 run state `{ floor, encounters, doors, rooms }`.
 * Guarantees every post-entry room strictly obeys `room.inhabitantType` ('monster' OR 'trap').
 */
export function createFloor1Run(options = {}) {
    const { seed = null, randomizeThemes = false } = options || {};
    const floor = createFloor1Layout({ seed, randomizeThemes });
    const rng = createSeededRng(seed);
    const encounters = [];
    const usedIds = new Set();

    const uniqueId = (baseId, roomId) => {
        if (!usedIds.has(baseId)) {
            usedIds.add(baseId);
            return baseId;
        }
        const scoped = `${baseId}_${roomId}`;
        usedIds.add(scoped);
        return scoped;
    };

    // 1. Non-hostile Shrine in Room 1 (entry_room)
    const foyer = floor.rooms.find((r) => r.role === 'entry_room');
    if (foyer) {
        const shrineId = uniqueId('moonwell', foyer.id);
        encounters.push({
            id: shrineId,
            name: 'Sacred Healing Font',
            icon: '⛲',
            roomId: foyer.id,
            kind: 'shrine',
            pos: { x: -3.2, y: 0, z: 7.5 },
            triggerRadius: 2.1,
            description: 'A cracked marble basin brimming with pale luminescent water stands untouched amid the fallen sconces.',
            resolved: false,
            isCombat: false,
            options: [
                {
                    label: 'Drink deeply and bathe your wounds',
                    stat: 'vit',
                    statName: 'Vitality',
                    dc: 8,
                    successMsg: 'The cool enchanted water invigorates your soul! All cuts seal and your magical stamina is completely restored.',
                    failMsg: 'The mineral water is bitter and chilled, yet soothes minor scratches (+15 HP).',
                    reward: { fullHeal: true, xp: 15 },
                    penalty: { partialHeal: 15 }
                }
            ]
        });
    }

    // 2. Locked Door Encounters
    for (const doorEnc of createDoorEncounters(floor)) {
        doorEnc.id = uniqueId(doorEnc.id, doorEnc.roomId);
        encounters.push(doorEnc);
    }

    // 3. Post-entry Monster & Trap Encounters strictly matching room.inhabitantType
    const postRooms = floor.rooms.filter(
        (r) => r.role === 'chamber' || r.role === 'sanctum'
    );

    const monsterCycle = [...MONSTER_POOL];
    const trapCycle = [...TRAP_POOL];
    if (randomizeThemes) {
        for (let i = monsterCycle.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [monsterCycle[i], monsterCycle[j]] = [monsterCycle[j], monsterCycle[i]];
        }
        for (let i = trapCycle.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [trapCycle[i], trapCycle[j]] = [trapCycle[j], trapCycle[i]];
        }
    }
    let monsterCursor = 0;
    let trapCursor = 0;

    for (const room of postRooms) {
        const cx = (room.bounds.minX + room.bounds.maxX) / 2;
        const cz =
            room.role === 'sanctum'
                ? -27.5 // Leave clear separation North to exit_seal at -32.2
                : (room.bounds.minZ + room.bounds.maxZ) / 2;

        if (room.inhabitantType === 'monster') {
            let monsterId;
            if (!randomizeThemes && DEFAULT_ROOM_MONSTERS[room.id]) {
                monsterId = DEFAULT_ROOM_MONSTERS[room.id];
            } else if (room.role === 'sanctum') {
                monsterId = 'shadow_wraith';
            } else {
                const nonBoss = monsterCycle.filter((m) => m !== 'shadow_wraith');
                monsterId = nonBoss[monsterCursor % nonBoss.length];
                monsterCursor++;
            }
            const encId = uniqueId(monsterId, room.id);
            encounters.push(createCombatEncounter(encId, room.id, { x: cx, z: cz }, monsterId));
        } else if (room.inhabitantType === 'trap') {
            let trapType;
            if (!randomizeThemes && DEFAULT_ROOM_TRAPS[room.id]) {
                trapType = DEFAULT_ROOM_TRAPS[room.id];
            } else {
                trapType = trapCycle[trapCursor % trapCycle.length];
                trapCursor++;
            }
            const encId = uniqueId(trapType, room.id);
            encounters.push(createTrapEncounter(encId, room.id, { x: cx, z: cz }, trapType));
        }
    }

    // 4. Floor 1 Exit Seal inside Sanctum
    const sanctum = floor.rooms.find((r) => r.role === 'sanctum');
    if (sanctum) {
        const exitId = uniqueId('exit_seal', sanctum.id);
        encounters.push({
            id: exitId,
            name: 'The Phusza Descent Seal',
            icon: '👑',
            roomId: sanctum.id,
            kind: 'exit',
            pos: { x: 0, y: 0, z: -32.2 },
            triggerRadius: 2.1,
            description: 'An ancient gilded seal locks the spiral staircase descending out of the Charnel Threshold, resting atop the Crown Vault.',
            resolved: false,
            isCombat: false,
            options: [
                {
                    label: 'Pick the triple-tumbler crown seal',
                    stat: 'agi',
                    statName: 'Agility',
                    dc: 13,
                    successMsg: 'Tumbler by tumbler, the ancient lock yields! You claim the CROWN OF ELDORIA and unlock the descent deeper into the dungeon!',
                    failMsg: 'A hidden scythe snaps from the rim, slicing your forearm before the seal slams shut.',
                    reward: {
                        gold: 150,
                        item: '👑 CROWN OF ELDORIA',
                        consumable: 'Greater Healing Potion',
                        xp: 100,
                        victory: true
                    },
                    penalty: { hpDamage: 14 }
                },
                {
                    label: 'Shatter the dragon-skull clasps by force',
                    stat: 'str',
                    statName: 'Strength',
                    dc: 14,
                    successMsg: 'With a shattering blow, the ancient clasps break! You claim the CROWN OF ELDORIA and open the path downward!',
                    failMsg: 'The warded iron repels your blow with a bruising shockwave.',
                    reward: {
                        gold: 150,
                        item: '👑 CROWN OF ELDORIA',
                        consumable: 'Greater Healing Potion',
                        xp: 100,
                        victory: true
                    },
                    penalty: { hpDamage: 15 }
                },
                {
                    label: 'Channel counter-runes to unseal the descent',
                    stat: 'int',
                    statName: 'Intelligence',
                    dc: 13,
                    successMsg: 'The Phusza runes unravel in golden sparks! You lift the CROWN OF ELDORIA and open the Floor 1 exit.',
                    failMsg: 'Arcane backlash chars your gauntlet as the seal holds fast.',
                    reward: {
                        gold: 150,
                        item: '👑 CROWN OF ELDORIA',
                        consumable: 'Holy Water Flask',
                        xp: 100,
                        victory: true
                    },
                    penalty: { hpDamage: 12 }
                }
            ]
        });
    }

    return {
        floor,
        encounters,
        doors: floor.doors,
        rooms: floor.rooms
    };
}

/**
 * Legacy-compatible frozen template list inside the pre-M4 36x48 hall
 * (`[-13.5, 13.5] x [-19.5, 14.5]`), cloned on export so `.resolved` stays writable
 * for pre-M4 `js/dungeonWorld.js:753` while remaining completely isolated from `createFloor1Run()`.
 */
const LEGACY_ENCOUNTER_TEMPLATES = deepFreeze([
    {
        id: 'portcullis',
        name: 'Rusted Iron Portcullis',
        icon: '🚪',
        kind: 'door',
        doorId: 'legacy_portcullis',
        retryable: true,
        pos: { x: 0, y: 0, z: -7 },
        triggerRadius: 2.3,
        description: 'A heavy iron portcullis blocks the archway leading deeper into the Royal Crypt. Dried blood and old scratches mark the bars.',
        resolved: false,
        isCombat: false,
        options: [
            {
                label: 'Force the gate open with raw power',
                stat: 'str',
                statName: 'Strength',
                dc: 12,
                successMsg: 'With a roar, you wedge your fingers beneath the rusted spikes and hoist the iron gate upward! The path ahead is cleared.',
                failMsg: 'The heavy iron screeches but refuses to budge. The strain tears at your muscles and drops a shower of rust into your eyes.',
                reward: { xp: 25, unlocksDoor: true },
                penalty: { hpDamage: 8 }
            },
            {
                label: 'Pick the intricate mechanical lock',
                stat: 'agi',
                statName: 'Agility',
                dc: 12,
                successMsg: 'Using a fine wire and steady hands, you trip the counter-weights. The portcullis counter-pulley releases with a satisfying click!',
                failMsg: 'Your pick snaps inside the jammed tumblers with an ear-piercing clang, jarring your fingers.',
                reward: { xp: 25, unlocksDoor: true },
                penalty: { hpDamage: 6 }
            }
        ]
    },
    {
        id: 'sarcophagus',
        name: 'Sunken Sarcophagus',
        icon: '⚰️',
        kind: 'shrine',
        pos: { x: 8.5, y: 0, z: -9 },
        triggerRadius: 2.3,
        description: 'An ornate stone sarcophagus resting upon carved basalt gargoyles. Faint golden gleams peek through the cracked lid.',
        resolved: false,
        isCombat: false,
        options: [
            {
                label: 'Heave the stone lid aside',
                stat: 'str',
                statName: 'Strength',
                dc: 13,
                successMsg: 'You shove the massive granite slab off with brute force! Inside lies the mummy of Lord Kaelen, clutching 50 Gold, a Ruby Amulet, and a Greater Healing Potion!',
                failMsg: 'The slab slips from your grip and crushes your knuckles against the stone pedestal.',
                reward: { gold: 50, item: 'Ruby Amulet (+15 HP)', consumable: 'Greater Healing Potion', xp: 35 },
                penalty: { hpDamage: 14 }
            },
            {
                label: 'Chant warding incantation to dispel the tomb curse',
                stat: 'int',
                statName: 'Intelligence',
                dc: 11,
                successMsg: 'Speaking the archaic words of binding, the tomb seals dissipate in azure flame! The lid glides open freely, revealing 50 Gold and ancient treasures!',
                failMsg: 'The necrotic ward twists your incantation! A burst of spectral frost lashes out across your face.',
                reward: { gold: 50, item: 'Ruby Amulet (+15 HP)', xp: 35 },
                penalty: { hpDamage: 12 }
            }
        ]
    },
    {
        id: 'monolith',
        name: 'Arcane Leyline Monolith',
        icon: '🔮',
        kind: 'shrine',
        pos: { x: -8.5, y: 0, z: -9 },
        triggerRadius: 2.3,
        description: 'A floating obsidian obelisk pulsing with cerulean runes. The air around it buzzes with dormant magical currents.',
        resolved: false,
        isCombat: false,
        options: [
            {
                label: 'Attune to the cosmic runes',
                stat: 'int',
                statName: 'Intelligence',
                dc: 13,
                successMsg: 'You align your consciousness with the pulsing leyline. Ancient magical energy floods through you! Mana permanently restored and empowered.',
                failMsg: 'The volatile mana surges violently, shocking your nerves with static lightning!',
                reward: { mpRestore: 50, xp: 40, item: 'Leyline Blessing (+10 MP)' },
                penalty: { hpDamage: 10 }
            }
        ]
    },
    {
        id: 'pit_trap',
        name: 'Concealed Spike Pit',
        icon: '🕳️',
        kind: 'trap',
        trapType: 'spike_pit',
        trapState: 'armed',
        disarmable: true,
        stepTrigger: true,
        damage: 14,
        pos: { x: 6, y: 0, z: 2.5 },
        triggerRadius: 2.3,
        description: 'The cobblestones suddenly give way, revealing a treacherous 15-foot pit lined with blackened iron spikes!',
        resolved: false,
        isCombat: false,
        options: [
            {
                label: 'Leap across the chasm to the far ledge',
                stat: 'agi',
                statName: 'Agility',
                dc: 11,
                successMsg: 'With remarkable grace, you kick off the collapsing edge and vault across, landing deftly on solid ground!',
                failMsg: 'You stumble at the edge and plummet into the pit! The jagged spikes pierce your armor before you scramble back up.',
                reward: { xp: 20 },
                penalty: { hpDamage: 14 }
            }
        ]
    },
    {
        id: 'skeleton',
        name: 'Skeletal Vanguard',
        icon: '💀',
        kind: 'combat',
        isCombat: true,
        monsterId: 'skeleton',
        monsterScale: 1.0,
        aggroRadius: 4.8,
        pos: { x: -7.5, y: 0, z: 2.5 },
        triggerRadius: 2.3,
        description: 'An ancient animated skeleton clad in tarnished mail raises a rusty halberd and turns its hollow, glowing eye sockets toward you!',
        resolved: false,
        options: [
            {
                label: 'Engage in Tactical Turn-Based Combat',
                action: 'combat',
                stat: 'str',
                statName: 'Strength'
            }
        ]
    },
    {
        id: 'moonwell',
        name: 'Sacred Healing Font',
        icon: '⛲',
        kind: 'shrine',
        pos: { x: -2.5, y: 0, z: 8.5 },
        triggerRadius: 2.3,
        description: 'A serene marble fountain illuminated by floating water-lilies. Clear enchanted water bubbles from a carved stone cherub.',
        resolved: false,
        isCombat: false,
        options: [
            {
                label: 'Drink deeply and bathe your wounds',
                stat: 'vit',
                statName: 'Vitality',
                dc: 8,
                successMsg: 'The cool enchanted water invigorates your soul! All cuts seal and your magical stamina is completely restored.',
                failMsg: 'The mineral water is bitter and slightly stale, but still manages to soothe minor scratches (+15 HP).',
                reward: { fullHeal: true, xp: 15 },
                penalty: { partialHeal: 15 }
            }
        ]
    },
    {
        id: 'grand_chest',
        name: 'The Crown Vault Chest',
        icon: '👑',
        kind: 'exit',
        pos: { x: 0, y: 0, z: -17 },
        triggerRadius: 2.3,
        description: 'At the heart of the inner sanctum sits the legendary Gilded Vault of Eldoria, secured with three interlocking dragon skull padlocks.',
        resolved: false,
        isCombat: false,
        options: [
            {
                label: 'Disarm the triple-tumbler lock mechanism',
                stat: 'agi',
                statName: 'Agility',
                dc: 14,
                successMsg: 'Tumbler by tumbler, your deft fingers work the pins... CLACK! The vault chest swings open! A radiant glow fills the chamber as you claim the CROWN OF ELDORIA and 150 Gold!',
                failMsg: 'A hidden scythe blade snaps from the rim! It slices across your forearm and the chest remains locked.',
                reward: { gold: 150, item: '👑 CROWN OF ELDORIA', xp: 100, victory: true },
                penalty: { hpDamage: 14 }
            },
            {
                label: 'Smash through the dragon skull clasps',
                stat: 'str',
                statName: 'Strength',
                dc: 15,
                successMsg: 'You bring down all your might in a devastating blow! The ancient locks shatter! Inside glitters 150 Gold and the fabled CROWN OF ELDORIA!',
                failMsg: 'The lock repels your strike with a concussive shockwave, knocking you back into the stone wall.',
                reward: { gold: 150, item: '👑 CROWN OF ELDORIA', xp: 100, victory: true },
                penalty: { hpDamage: 15 }
            }
        ]
    }
]);

export const ENCOUNTERS = Object.freeze(
    LEGACY_ENCOUNTER_TEMPLATES.map((enc) => deepClone(enc))
);

const FLOOR2_MONSTER_TEMPLATES = deepFreeze({
    obsidian_gargoyle: {
        monsterId: 'obsidian_gargoyle',
        name: 'Obsidian Gargoyle',
        icon: '🦇',
        monsterScale: 1.05,
        aggroRadius: 5.2,
        triggerRadius: 2.2,
        description: 'A horned gargoyle carved from volcanic glass tears free from its plinth and lunges with stone talons!',
        options: [
            {
                label: 'Engage in Tactical Turn-Based Combat',
                action: 'combat',
                stat: 'str',
                statName: 'Strength'
            }
        ]
    },
    blight_ooze: {
        monsterId: 'blight_ooze',
        name: 'Blighted Alchemist Ooze',
        icon: '🟢',
        monsterScale: 1.1,
        aggroRadius: 4.8,
        triggerRadius: 2.2,
        description: 'A bubbling cauldron-mass of caustic slime surges across the flagstones with trapped skulls rattling inside!',
        options: [
            {
                label: 'Engage in Tactical Turn-Based Combat',
                action: 'combat',
                stat: 'vit',
                statName: 'Vitality'
            }
        ]
    },
    runebound_sentinel: {
        monsterId: 'runebound_sentinel',
        name: 'Runebound Sentinel',
        icon: '🛡️',
        monsterScale: 1.1,
        aggroRadius: 5.2,
        triggerRadius: 2.2,
        description: 'An armored runic construct steps out of the shadows, raising a glowing greatsword and tower shield.',
        options: [
            {
                label: 'Engage in Tactical Turn-Based Combat',
                action: 'combat',
                stat: 'str',
                statName: 'Strength'
            }
        ]
    },
    arch_lich: {
        monsterId: 'arch_lich',
        name: 'Arch-Lich of the Arcanum',
        icon: '👑',
        monsterScale: 1.25,
        aggroRadius: 5.6,
        triggerRadius: 2.2,
        description: 'Crowned in tarnished gold and wreathed in astral shards, the Arch-Lich raises its phylactery staff to bar the Astral Conduit.',
        options: [
            {
                label: 'Engage in Tactical Turn-Based Combat',
                action: 'combat',
                stat: 'int',
                statName: 'Intelligence'
            }
        ]
    }
});

function createFloor2CombatEncounter(id, roomId, pos, monsterId) {
    const tpl = FLOOR2_MONSTER_TEMPLATES[monsterId] || FLOOR2_MONSTER_TEMPLATES.obsidian_gargoyle;
    return {
        id,
        name: tpl.name,
        icon: tpl.icon,
        roomId,
        kind: 'combat',
        pos: { x: pos.x, y: 0, z: pos.z },
        triggerRadius: tpl.triggerRadius,
        description: tpl.description,
        resolved: false,
        isCombat: true,
        monsterId: tpl.monsterId,
        monsterScale: tpl.monsterScale,
        aggroRadius: tpl.aggroRadius,
        options: deepClone(tpl.options)
    };
}

/**
 * Generates an isolated, deep-cloned Floor 2 run state `{ floor, encounters, doors, rooms }`.
 */
export function createFloor2Run() {
    const floor = createFloor2Layout();
    const encounters = [];

    const atrium = floor.rooms.find((r) => r.id === 'f2_atrium');
    if (atrium) {
        encounters.push({
            id: 'astral_font',
            name: 'Astral Restoration Font',
            icon: '⛲',
            roomId: atrium.id,
            kind: 'shrine',
            pos: { x: -3.2, y: 0, z: 7.5 },
            triggerRadius: 2.1,
            description: 'Starlight pools inside a carved basalt basin, humming with restorative mana from the Sunken Arcanum.',
            resolved: false,
            isCombat: false,
            options: [
                {
                    label: 'Drink from the astral waters',
                    stat: 'vit',
                    statName: 'Vitality',
                    dc: 9,
                    successMsg: 'Cool starlight courses through your veins! Health and mana are fully restored.',
                    failMsg: 'The chilled mineral draught steadies your breath (+20 HP).',
                    reward: { fullHeal: true, xp: 25 },
                    penalty: { partialHeal: 20 }
                }
            ]
        });
    }

    for (const door of floor.doors) {
        const approachRoomId = door.connects[0];
        if (door.id === 'door_f2_rune_gate') {
            encounters.push({
                id: door.encounterId || 'f2_rune_gate',
                name: 'Sealed Lunar Rune Gate',
                icon: '🚪',
                roomId: approachRoomId,
                kind: 'door',
                doorId: door.id,
                unlockedByPuzzleId: 'puzzle_twin_moons',
                retryable: true,
                pos: { x: door.x, y: 0, z: door.z },
                triggerRadius: 2.1,
                description: 'Arcane lunar bars seal the passage north into the Vault of Mirrors. Solve the Dial of the Twin Moons to the west or force the ward directly.',
                resolved: false,
                isCombat: false,
                options: [
                    {
                        label: 'Shatter the ward-latches with brute strength',
                        stat: 'str',
                        statName: 'Strength',
                        dc: 14,
                        successMsg: 'Sparks scatter across the stone as you wrench the lunar gate open!',
                        failMsg: 'The warded iron throws you back with a jarring shock.',
                        reward: { xp: 35, unlocksDoor: true },
                        penalty: { hpDamage: 10 }
                    },
                    {
                        label: 'Bypass the celestial tumblers with nimble picks',
                        stat: 'agi',
                        statName: 'Agility',
                        dc: 13,
                        successMsg: 'Click by click, you align the hidden pins and slide the rune gate clear.',
                        failMsg: 'A tension spring snaps across your gauntlet.',
                        reward: { xp: 35, unlocksDoor: true },
                        penalty: { hpDamage: 8 }
                    },
                    {
                        label: 'Invert the lunar sigil by arcane deduction',
                        stat: 'int',
                        statName: 'Intelligence',
                        dc: 13,
                        successMsg: 'The lunar runes dissolve into pale mist as the gate swings open.',
                        failMsg: 'Arcane feedback singes your palms.',
                        reward: { xp: 35, unlocksDoor: true },
                        penalty: { hpDamage: 9 }
                    }
                ]
            });
        } else {
            encounters.push({
                id: door.encounterId || 'f2_obsidian_seal',
                name: 'Obsidian Sanctum Seal',
                icon: '⛓️',
                roomId: approachRoomId,
                kind: 'door',
                doorId: door.id,
                unlockedByPuzzleId: 'puzzle_alchemist_scales',
                retryable: true,
                pos: { x: door.x, y: 0, z: door.z },
                triggerRadius: 2.1,
                description: 'Twin obsidian leaves bound by brass weights seal the Arch-Lich Sanctum. Balance the Scales of Equilibrium or break the seal by force.',
                resolved: false,
                isCombat: false,
                options: [
                    {
                        label: 'Heave the counterweight chains apart',
                        stat: 'str',
                        statName: 'Strength',
                        dc: 15,
                        successMsg: 'The heavy chains snap free and the obsidian leaves part!',
                        failMsg: 'The obsidian seal holds fast, bruising your shoulders.',
                        reward: { xp: 50, unlocksDoor: true },
                        penalty: { hpDamage: 12 }
                    },
                    {
                        label: 'Pick the astral deadlock mechanism',
                        stat: 'agi',
                        statName: 'Agility',
                        dc: 14,
                        successMsg: 'Your pick slips past the counterweight catch and frees the seal.',
                        failMsg: 'A needle trap nicks your wrist inside the lock.',
                        reward: { xp: 50, unlocksDoor: true },
                        penalty: { hpDamage: 10 }
                    },
                    {
                        label: 'Unweave the Arch-Lich binding glyphs',
                        stat: 'int',
                        statName: 'Intelligence',
                        dc: 14,
                        successMsg: 'The purple sigils unravel and the sanctum doors groan wide.',
                        failMsg: 'Frost-burnt runes repel your grasp.',
                        reward: { xp: 50, unlocksDoor: true },
                        penalty: { hpDamage: 10 }
                    }
                ]
            });
        }
    }

    const puzzleRoomMap = {
        f2_west_puzzle: 'puzzle_twin_moons',
        f2_central_hall: 'puzzle_mirror_relay',
        f2_north_puzzle: 'puzzle_alchemist_scales'
    };

    const monsterRoomMap = {
        f2_east_mobs: 'obsidian_gargoyle',
        f2_west_crypt: 'runebound_sentinel',
        f2_east_crypt: 'blight_ooze',
        f2_sanctum: 'arch_lich'
    };

    for (const room of floor.rooms) {
        const cx = (room.bounds.minX + room.bounds.maxX) / 2;
        const cz = room.role === 'sanctum'
            ? -27.5
            : (room.bounds.minZ + room.bounds.maxZ) / 2;

        if (room.inhabitantType === 'puzzle') {
            const puzzleId = puzzleRoomMap[room.id] || 'puzzle_twin_moons';
            const def = PUZZLE_DEFINITIONS[puzzleId];
            encounters.push({
                id: def.id,
                puzzleId: def.id,
                puzzleType: def.puzzleType,
                name: def.name,
                icon: def.icon,
                roomId: room.id,
                kind: 'puzzle',
                pos: { x: cx, y: 0, z: cz },
                triggerRadius: 2.2,
                description: def.description,
                clue: def.clue,
                unlocksDoorId: def.unlocksDoorId || null,
                solved: false,
                resolved: false,
                isCombat: false,
                options: []
            });
        } else if (room.inhabitantType === 'monster') {
            const monsterId = monsterRoomMap[room.id] || 'obsidian_gargoyle';
            encounters.push(createFloor2CombatEncounter(monsterId, room.id, { x: cx, z: cz }, monsterId));
        }
    }

    const sanctum = floor.rooms.find((r) => r.role === 'sanctum');
    if (sanctum) {
        encounters.push({
            id: 'f2_exit_seal',
            name: 'The Astral Conduit',
            icon: '🌟',
            roomId: sanctum.id,
            kind: 'exit',
            pos: { x: 0, y: 0, z: -32.2 },
            triggerRadius: 2.1,
            description: 'A crystalline conduit of woven starlight crowns the Arch-Lich dais, safeguarding the Staff of the Sunken Arcanum.',
            resolved: false,
            isCombat: false,
            options: [
                {
                    label: 'Align the conduit prisms to claim the Staff',
                    stat: 'int',
                    statName: 'Intelligence',
                    dc: 14,
                    successMsg: 'The astral rings click into harmony! You claim the Staff of the Sunken Arcanum and conquer Floor 2!',
                    failMsg: 'A crackling arc of starlight jolts your gauntlets before the conduit stabilizes.',
                    reward: {
                        gold: 250,
                        item: 'Staff of the Sunken Arcanum (+10 MP)',
                        consumable: 'Greater Healing Potion',
                        xp: 175,
                        victory: true
                    },
                    penalty: { hpDamage: 14 }
                },
                {
                    label: 'Wrench the phylactery key free by force',
                    stat: 'str',
                    statName: 'Strength',
                    dc: 15,
                    successMsg: 'With thunderous strength, you snap the binding clasp and lift the Staff of the Sunken Arcanum!',
                    failMsg: 'The warded bronze rebounds against your arms.',
                    reward: {
                        gold: 250,
                        item: 'Staff of the Sunken Arcanum (+10 MP)',
                        consumable: 'Greater Healing Potion',
                        xp: 175,
                        victory: true
                    },
                    penalty: { hpDamage: 15 }
                },
                {
                    label: 'Disarm the astral ward-pins with swift precision',
                    stat: 'agi',
                    statName: 'Agility',
                    dc: 14,
                    successMsg: 'Your steady hands release each pin cleanly, unlocking the Staff of the Sunken Arcanum!',
                    failMsg: 'A hidden needle-ward grazes your palm as the seal resets.',
                    reward: {
                        gold: 250,
                        item: 'Staff of the Sunken Arcanum (+10 MP)',
                        consumable: 'Holy Water Flask',
                        xp: 175,
                        victory: true
                    },
                    penalty: { hpDamage: 12 }
                }
            ]
        });
    }

    return {
        floor,
        encounters,
        doors: floor.doors,
        rooms: floor.rooms
    };
}

export function createFloorRun(floorNumber = 1, options = {}) {
    if (Number(floorNumber) === 2) {
        return createFloor2Run(options);
    }
    return createFloor1Run(options);
}
