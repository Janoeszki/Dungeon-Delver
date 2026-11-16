// Character Stats & Ancestry/Class Traits
import { SHOP_ARMOR, SHOP_WEAPONS } from './progression.js';

export const ANCESTRY_DATA = {
    human: {
        name: 'Human',
        icon: '🧑',
        desc: 'Adaptable and resilient with well-rounded physical and mental prowess.',
        perk: 'Adaptable: +10% bonus to all attributes.',
        bonuses: { str: 2, agi: 2, int: 2, vit: 2 },
        defaultSkin: '#ffd2b2',
        defaultHair: '#4a2e1b',
        starterUnlocked: true,
        unlockCost: 0
    },
    elf: {
        name: 'Elf',
        icon: '🧝',
        desc: 'Graceful dweller of ancient groves with innate sensitivity to the arcane.',
        perk: 'Arcane Affinity: +6 Intelligence & +25 starting Mana.',
        bonuses: { str: 0, agi: 4, int: 6, vit: 0 },
        defaultSkin: '#d1e8e2',
        defaultHair: '#ecf0f1',
        starterUnlocked: true,
        unlockCost: 0
    },
    dwarf: {
        name: 'Dwarf',
        icon: '🧔',
        desc: 'Unbreakable stoneworker with iron constitution and fierce warrior tradition.',
        perk: 'Stoneheart: +6 Vitality, +35 starting Health & high resistance.',
        bonuses: { str: 4, agi: 0, int: 0, vit: 6 },
        defaultSkin: '#f3b48b',
        defaultHair: '#b55221',
        starterUnlocked: true,
        unlockCost: 0
    },
    orc: {
        name: 'Orc',
        icon: '👹',
        desc: 'Colossal and battle-hardened juggernaut, capable of devastating physical force.',
        perk: 'Blood Rage: +8 Strength, +30 starting Health & fierce savagery.',
        bonuses: { str: 8, agi: 1, int: -1, vit: 5 },
        defaultSkin: '#4d7c2a',
        defaultHair: '#1b1b1b',
        starterUnlocked: true,
        unlockCost: 0
    },
    goblin: {
        name: 'Goblin',
        icon: '👺',
        desc: 'Mischievous, cunning, and blindingly fast cave-dweller and scavver.',
        perk: 'Nimble Skulker: +8 Agility, +15 starting Mana & uncanny evasion.',
        bonuses: { str: -1, agi: 8, int: 3, vit: 1 },
        defaultSkin: '#7cb342',
        defaultHair: '#2c3e50',
        starterUnlocked: true,
        unlockCost: 0
    },
    catfolk: {
        name: 'Catfolk',
        icon: '🐱',
        desc: 'Agile feline nomad with razor reflexes, acute senses, and graceful stealth.',
        perk: 'Feline Grace: +6 Agility, +3 Vitality & silent tread.',
        bonuses: { str: 2, agi: 6, int: 2, vit: 3 },
        defaultSkin: '#d98236',
        defaultHair: '#ffffff',
        starterUnlocked: true,
        unlockCost: 0
    },
    dragonborn: {
        name: 'Dragonborn',
        icon: '🐉',
        desc: 'Scion of ancient wyrms with scaled hide, draconic breath, and regal might.',
        perk: 'Draconic Majesty: +5 STR, +4 INT, +3 VIT & +20 starting HP.',
        bonuses: { str: 5, agi: 1, int: 4, vit: 3 },
        flatHpBonus: 20,
        flatMpBonus: 15,
        defaultSkin: '#b91c1c',
        defaultHair: '#f59e0b',
        starterUnlocked: false,
        unlockCost: 80
    },
    tiefling: {
        name: 'Tiefling',
        icon: '😈',
        desc: 'Infernal-blooded arcanist bearing curved horns, nimble grace, and hellfire mastery.',
        perk: 'Hellfire Blood: +6 INT, +4 AGI, +2 VIT & +30 starting MP.',
        bonuses: { str: 1, agi: 4, int: 6, vit: 2 },
        flatHpBonus: 10,
        flatMpBonus: 30,
        defaultSkin: '#991b1b',
        defaultHair: '#1b1b1b',
        starterUnlocked: false,
        unlockCost: 110
    },
    golem: {
        name: 'Runeforged',
        icon: '🗿',
        desc: 'Living construct of enchanted stone and Phusza crystal, built to endure any siege.',
        perk: 'Living Bastion: +6 STR, +5 VIT & +25 starting HP.',
        bonuses: { str: 6, agi: -1, int: 2, vit: 5 },
        flatHpBonus: 25,
        flatMpBonus: 10,
        defaultSkin: '#64748b',
        defaultHair: '#38bdf8',
        starterUnlocked: false,
        unlockCost: 140
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

export function calculateStats(ancestryKey, classKey, progressionOrOptions = null) {
    const resolvedAncestryKey = Object.hasOwn(ANCESTRY_DATA, ancestryKey) ? ancestryKey : 'human';
    const ancestry = ANCESTRY_DATA[resolvedAncestryKey];
    const charClass = CLASS_DATA[classKey] || CLASS_DATA.warrior;

    const baseStr = charClass.baseStats.str + ancestry.bonuses.str;
    const baseAgi = charClass.baseStats.agi + ancestry.bonuses.agi;
    const baseInt = charClass.baseStats.int + ancestry.bonuses.int;
    const baseVit = charClass.baseStats.vit + ancestry.bonuses.vit;

    let boosts = { str: 0, agi: 0, int: 0, vit: 0 };
    let weapon = SHOP_WEAPONS.iron_longsword;
    let armor = SHOP_ARMOR.iron_chainmail;

    if (progressionOrOptions && typeof progressionOrOptions === 'object') {
        const stateObj = typeof progressionOrOptions.getState === 'function'
            ? progressionOrOptions.getState()
            : progressionOrOptions;

        const rawBoosts = stateObj?.ancestryStatBoosts?.[resolvedAncestryKey] || stateObj?.statBoosts || null;
        if (rawBoosts && typeof rawBoosts === 'object') {
            boosts = {
                str: Math.max(0, Math.floor(Number(rawBoosts.str) || 0)),
                agi: Math.max(0, Math.floor(Number(rawBoosts.agi) || 0)),
                int: Math.max(0, Math.floor(Number(rawBoosts.int) || 0)),
                vit: Math.max(0, Math.floor(Number(rawBoosts.vit) || 0))
            };
        }

        const rawWeapon = stateObj?.equippedWeapon;
        if (rawWeapon && typeof rawWeapon === 'object') {
            weapon = rawWeapon;
        } else if (typeof rawWeapon === 'string' && SHOP_WEAPONS[rawWeapon]) {
            weapon = SHOP_WEAPONS[rawWeapon];
        }

        const rawArmor = stateObj?.equippedArmor;
        if (rawArmor && typeof rawArmor === 'object') {
            armor = rawArmor;
        } else if (typeof rawArmor === 'string' && SHOP_ARMOR[rawArmor]) {
            armor = SHOP_ARMOR[rawArmor];
        }
    }

    const str = baseStr + boosts.str + (weapon.strBonus || 0);
    const agi = baseAgi + boosts.agi + (armor.agiBonus || 0);
    const int = baseInt + boosts.int + (weapon.intBonus || 0);
    const vit = baseVit + boosts.vit + (armor.vitBonus || 0);

    let maxHp = vit * charClass.hpPerVit;
    let maxMp = int * charClass.mpPerInt;

    if (resolvedAncestryKey === 'dwarf') maxHp += 35;
    if (resolvedAncestryKey === 'orc') maxHp += 30;
    if (resolvedAncestryKey === 'elf') maxMp += 25;
    if (resolvedAncestryKey === 'goblin') maxMp += 15;

    if (Number.isFinite(ancestry.flatHpBonus)) maxHp += ancestry.flatHpBonus;
    if (Number.isFinite(ancestry.flatMpBonus)) maxMp += ancestry.flatMpBonus;

    maxHp += (armor.maxHpBonus || 0);
    maxMp += (armor.maxMpBonus || 0);

    return {
        str,
        agi,
        int,
        vit,
        maxHp,
        maxMp,
        baseStr,
        baseAgi,
        baseInt,
        baseVit,
        acBonus: armor.acBonus || 0,
        damageReduction: armor.damageReduction || 0,
        attackBonus: weapon.attackBonus || 0,
        damageBonus: weapon.damageBonus || 0,
        critThreshold: weapon.critThreshold || 20,
        statBoosts: boosts,
        equippedWeapon: weapon,
        equippedArmor: armor,
        ancestry,
        race: ancestry, // alias for backwards compatibility
        charClass
    };
}
