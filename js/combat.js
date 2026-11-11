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
