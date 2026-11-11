// Character Stats & Ancestry/Class Traits

export const ANCESTRY_DATA = {
    human: {
        name: 'Human',
        icon: '🧑',
        desc: 'Adaptable and resilient with well-rounded physical and mental prowess.',
        perk: 'Adaptable: +10% bonus to all attributes.',
        bonuses: { str: 2, agi: 2, int: 2, vit: 2 },
        defaultSkin: '#ffd2b2',
        defaultHair: '#4a2e1b'
    },
    elf: {
        name: 'Elf',
        icon: '🧝',
        desc: 'Graceful dweller of ancient groves with innate sensitivity to the arcane.',
        perk: 'Arcane Affinity: +6 Intelligence & +25 starting Mana.',
        bonuses: { str: 0, agi: 4, int: 6, vit: 0 },
        defaultSkin: '#d1e8e2',
        defaultHair: '#ecf0f1'
    },
    dwarf: {
        name: 'Dwarf',
        icon: '🧔',
        desc: 'Unbreakable stoneworker with iron constitution and fierce warrior tradition.',
        perk: 'Stoneheart: +6 Vitality, +35 starting Health & high resistance.',
        bonuses: { str: 4, agi: 0, int: 0, vit: 6 },
        defaultSkin: '#f3b48b',
        defaultHair: '#b55221'
    },
    orc: {
        name: 'Orc',
        icon: '👹',
        desc: 'Colossal and battle-hardened juggernaut, capable of devastating physical force.',
        perk: 'Blood Rage: +8 Strength, +30 starting Health & fierce savagery.',
        bonuses: { str: 8, agi: 1, int: -1, vit: 5 },
        defaultSkin: '#4d7c2a',
        defaultHair: '#1b1b1b'
    },
    goblin: {
        name: 'Goblin',
        icon: '👺',
        desc: 'Mischievous, cunning, and blindingly fast cave-dweller and scavver.',
        perk: 'Nimble Skulker: +8 Agility, +15 starting Mana & uncanny evasion.',
        bonuses: { str: -1, agi: 8, int: 3, vit: 1 },
        defaultSkin: '#7cb342',
        defaultHair: '#2c3e50'
    },
    catfolk: {
        name: 'Catfolk',
        icon: '🐱',
        desc: 'Agile feline nomad with razor reflexes, acute senses, and graceful stealth.',
        perk: 'Feline Grace: +6 Agility, +3 Vitality & silent tread.',
        bonuses: { str: 2, agi: 6, int: 2, vit: 3 },
        defaultSkin: '#d98236',
        defaultHair: '#ffffff'
    }
};

// Backwards compatibility alias
export const RACE_DATA = ANCESTRY_DATA;

export const CLASS_DATA = {
    warrior: {
        name: 'Warrior',
        icon: '⚔️',
        desc: 'Frontline juggernaut clad in heavy plate, wielding sword and sturdy shield.',
        signature: 'Whirlwind Slash: Sweeping circular melee strike dealing massive physical damage.',
        baseStats: { str: 14, agi: 8, int: 5, vit: 12 },
        hpPerVit: 14,
        mpPerInt: 6
    },
    mage: {
        name: 'Mage',
        icon: '🔮',
        desc: 'Scholar of ancient elements, commanding destructive flame and shielding wards.',
        signature: 'Firebolt: Hurls an explosive missile of blazing arcane fire from distance.',
        baseStats: { str: 6, agi: 10, int: 16, vit: 8 },
        hpPerVit: 9,
        mpPerInt: 15
    }
};

export function calculateStats(ancestryKey, classKey) {
    const ancestry = ANCESTRY_DATA[ancestryKey] || ANCESTRY_DATA.human;
    const charClass = CLASS_DATA[classKey] || CLASS_DATA.warrior;

    const str = charClass.baseStats.str + ancestry.bonuses.str;
    const agi = charClass.baseStats.agi + ancestry.bonuses.agi;
    const int = charClass.baseStats.int + ancestry.bonuses.int;
    const vit = charClass.baseStats.vit + ancestry.bonuses.vit;

    let maxHp = vit * charClass.hpPerVit;
    let maxMp = int * charClass.mpPerInt;

    if (ancestryKey === 'dwarf') maxHp += 35;
    if (ancestryKey === 'orc') maxHp += 30;
    if (ancestryKey === 'elf') maxMp += 25;
    if (ancestryKey === 'goblin') maxMp += 15;

    return {
        str,
        agi,
        int,
        vit,
        maxHp,
        maxMp,
        ancestry,
        race: ancestry, // alias for backwards compatibility
        charClass
    };
}
