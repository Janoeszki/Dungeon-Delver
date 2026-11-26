export type GameMode = 'start' | 'creator' | 'adventure';
export type FloorNumber = 1 | 2;
export type HeroClassKey = 'warrior' | 'mage';
export type BodyTypeKey = 'a' | 'b';
export type ShopTab = 'all' | 'armor' | 'weapons' | 'spells' | 'ancestries' | 'stats';
export type CombatTab = 'attack' | 'spells' | 'defend' | 'items' | 'flee';
export type LogSeverity = 'normal' | 'roll' | 'success' | 'fail' | 'crit' | 'dread';
export type CombatLogType = 'crit' | 'dmg' | 'heal' | 'guard' | 'info';

export interface HeroConfig {
    name: string;
    ancestry: string;
    race: string;
    charClass: HeroClassKey;
    bodyType: BodyTypeKey;
    hairStyle: number;
    beardStyle: number;
    showHelm: boolean;
    skinColor: string;
    hairColor: string;
    clothColor: string;
    armorColor: string;
}

export interface StatBoosts {
    str: number;
    agi: number;
    int: number;
    vit: number;
}

export interface AncestryDef {
    name: string;
    icon: string;
    desc: string;
    perk: string;
    bonuses: StatBoosts;
    flatHpBonus?: number;
    flatMpBonus?: number;
    defaultSkin: string;
    defaultHair: string;
    starterUnlocked: boolean;
    unlockCost: number;
}

export interface ClassDef {
    name: string;
    icon: string;
    desc: string;
    signature: string;
    baseStats: StatBoosts;
    hpPerVit: number;
    mpPerInt: number;
}

export interface ShopArmorItem {
    id: string;
    name: string;
    icon: string;
    tier: number;
    cost: number;
    starter: boolean;
    acBonus: number;
    maxHpBonus: number;
    maxMpBonus: number;
    vitBonus: number;
    agiBonus: number;
    damageReduction: number;
    armorColor: string | null;
    desc: string;
}

export interface ShopWeaponItem {
    id: string;
    name: string;
    icon: string;
    tier: number;
    cost: number;
    starter: boolean;
    attackBonus: number;
    damageBonus: number;
    strBonus: number;
    intBonus: number;
    critThreshold: number;
    desc: string;
}

export interface ShopSpellItem {
    id: string;
    name: string;
    icon: string;
    cost: number;
    mpCost: number;
    dice: { count: number; sides: number; mod: number };
    stat: string;
    effect?: string;
    chillPenalty?: number;
    autoHit?: boolean;
    lifestealRatio?: number;
    desc: string;
}

export interface ShopAncestryItem {
    id: string;
    name: string;
    icon: string;
    cost: number;
    currency: string;
    bonuses: StatBoosts;
    flatHpBonus?: number;
    flatMpBonus?: number;
    defaultSkin: string;
    defaultHair: string;
    perk: string;
}

export interface ProgressionState {
    gold: number;
    exp: number;
    totalGoldEarned: number;
    totalExpEarned: number;
    delvesCompleted: number;
    highestFloor: number;
    ownedArmor: string[];
    equippedArmor: string;
    ownedWeapons: string[];
    equippedWeapon: string;
    ownedSpells: string[];
    unlockedAncestries: string[];
    ancestryStatBoosts: Record<string, StatBoosts>;
    lastDelveSummary: {
        gold: number;
        exp: number;
        floor: number;
        outcome: string;
    } | null;
}

export interface ComputedHeroStats {
    str: number;
    agi: number;
    int: number;
    vit: number;
    maxHp: number;
    maxMp: number;
    baseStr: number;
    baseAgi: number;
    baseInt: number;
    baseVit: number;
    acBonus: number;
    damageReduction: number;
    attackBonus: number;
    damageBonus: number;
    critThreshold: number;
    statBoosts: StatBoosts;
    equippedWeapon: ShopWeaponItem;
    equippedArmor: ShopArmorItem;
    ancestry: AncestryDef;
    race: AncestryDef;
    charClass: ClassDef;
}

export interface PlayerRunStats {
    currentHp: number;
    maxHp: number;
    currentMp: number;
    maxMp: number;
    gold: number;
    xp: number;
    bankedGold: number;
    bankedXp: number;
    inventory: string[];
    consumables: string[];
}

export interface LogMessage {
    id: number;
    text: string;
    type: LogSeverity;
}

export interface VictoryInfo {
    floor: FloorNumber;
    title: string;
    subtitle: string;
    story: string;
    statsLine: string;
    bankLine: string;
    roomsLine: string;
    canDescendFloor2: boolean;
}

export interface ShopFeedback {
    message: string;
    kind: 'info' | 'success' | 'error';
}

export interface RoomDef {
    id: string;
    name: string;
    role?: string;
    inhabitantType?: string;
    whisper?: string;
    bounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface EncounterOption {
    label: string;
    stat: 'str' | 'agi' | 'int' | 'vit';
    statName: string;
    dc: number;
    successMsg: string;
    failMsg: string;
    reward?: {
        gold?: number;
        xp?: number;
        item?: string;
        consumable?: string;
        mpRestore?: number;
        fullHeal?: boolean;
        victory?: boolean;
        unlocksDoor?: boolean;
    };
    penalty?: {
        hpDamage?: number;
        partialHeal?: number;
    };
}

export interface EncounterDef {
    id: string;
    name: string;
    icon: string;
    description: string;
    kind: string;
    isCombat?: boolean;
    monsterId?: string;
    puzzleId?: string;
    unlocksDoorId?: string;
    options: EncounterOption[];
}

export interface PuzzleDefinition {
    id: string;
    puzzleType: 'rune_sequence' | 'mirror_alignment' | 'alchemist_scales';
    roomId: string;
    name: string;
    icon: string;
    description: string;
    clue: string;
    unlocksDoorId: string | null;
    failDamage: number;
    hintDc: number;
    reward: { gold?: number; xp?: number; consumable?: string };
    glyphs?: Array<{ id: string; label: string; icon: string }>;
    solution?: string[];
    mirrors?: Array<{ id: string; label: string }>;
    initialAngles?: string[];
    targetSum?: number;
    requiredCount?: number;
    weights?: Array<{ value: number; label: string }>;
}

export interface PuzzleState {
    puzzleId: string;
    puzzleType: 'rune_sequence' | 'mirror_alignment' | 'alchemist_scales';
    solved: boolean;
    attempts: number;
    hintUsed: boolean;
    hintText: string | null;
    sequence: string[];
    mirrorAngles: string[];
    selectedWeights: number[];
}

export interface CombatMonsterState {
    id: string;
    name: string;
    icon: string;
    maxHp: number;
    currentHp: number;
    ac: number;
    scale?: number;
    description: string;
    attackBonus: number;
    attackName?: string;
    specialAttackName?: string;
    specialChance?: number;
    specialMultiplier?: number;
    damageDice: { count: number; sides: number; mod: number };
    xpReward: number;
    goldReward: number;
    loot?: Array<{ item: string; chance: number }>;
    isDefending: boolean;
    chillPenalty: number;
}

export interface CombatState {
    encounterId: string;
    outcome: 'victory' | 'defeat' | null;
    monster: CombatMonsterState;
    player: {
        name: string;
        charClass: HeroClassKey;
        ancestry: string;
        stats: ComputedHeroStats;
        baseAc: number;
        effectiveAc: number;
        isDefending: boolean;
    };
    round: number;
    turn: 'player' | 'enemy' | 'ended';
    currentTab: CombatTab;
    busy: boolean;
}

export interface CombatLogEntry {
    id: number;
    text: string;
    type: CombatLogType;
}

export interface ColorOption {
    color: string;
    title: string;
}

export interface AncestryCardMeta {
    key: string;
    icon: string;
    name: string;
    unlockCost?: number;
}

export const FORGE_ANCESTRIES: readonly AncestryCardMeta[] = [
    { key: 'human', icon: '🧑', name: 'Human' },
    { key: 'elf', icon: '🧝', name: 'Elf' },
    { key: 'dwarf', icon: '🧔', name: 'Dwarf' },
    { key: 'orc', icon: '👹', name: 'Orc' },
    { key: 'goblin', icon: '👺', name: 'Goblin' },
    { key: 'catfolk', icon: '🐱', name: 'Catfolk' },
    { key: 'dragonborn', icon: '🐉', name: 'Dragonborn', unlockCost: 80 },
    { key: 'tiefling', icon: '😈', name: 'Tiefling', unlockCost: 110 },
    { key: 'golem', icon: '🗿', name: 'Runeforged', unlockCost: 140 }
];

export const SKIN_PALETTE: readonly ColorOption[] = [
    { color: '#ffd2b2', title: 'Fair' },
    { color: '#f3b48b', title: 'Tan' },
    { color: '#996035', title: 'Dark Bronze' },
    { color: '#d1e8e2', title: 'Elf Mystic Pale' },
    { color: '#4d7c2a', title: 'Orc Battle Green' },
    { color: '#2f521b', title: 'Dark Moss Olive' },
    { color: '#7cb342', title: 'Goblin Lime' },
    { color: '#d98236', title: 'Catfolk Tawny' },
    { color: '#22242a', title: 'Midnight Panther' },
    { color: '#f0f4f8', title: 'Snow Leopard' }
];

export const HAIR_PALETTE: readonly ColorOption[] = [
    { color: '#4a2e1b', title: 'Chestnut' },
    { color: '#1b1b1b', title: 'Ebony' },
    { color: '#b55221', title: 'Fiery Copper' },
    { color: '#f1c40f', title: 'Golden' },
    { color: '#ecf0f1', title: 'Silver White' },
    { color: '#8e44ad', title: 'Arcane Violet' },
    { color: '#3b5e28', title: 'Moss Green' }
];

export const ARMOR_PALETTE: readonly ColorOption[] = [
    { color: '#2b4c7e', title: 'Cobalt' },
    { color: '#991b1b', title: 'Crimson' },
    { color: '#065f46', title: 'Emerald' },
    { color: '#5b21b6', title: 'Royal Amethyst' },
    { color: '#374151', title: 'Shadow Slate' },
    { color: '#95a5a6', title: 'Steel Grey' }
];

export const HERO_NAMES: Record<string, readonly string[]> = {
    human: ['Valerius', 'Althea', 'Arthur', 'Gwendolyn', 'Roderic'],
    elf: ['Elarion', 'Silvanis', 'Faerand', 'Lunaria', 'Aelidor'],
    dwarf: ['Bromdur', 'Thorik', 'Dain', 'Hulda', 'Gimrok'],
    orc: ['Gorgok', 'Kragh', 'Azgash', 'Morga', 'Thrumk'],
    goblin: ['Grik', 'Snazz', 'Skitter', 'Nox', 'Frazzle'],
    catfolk: ['Miko', 'Whisper', 'Shadowclaw', 'Kaelen', 'Nyx'],
    dragonborn: ['Balanar', 'Ignis', 'Vaelith', 'Pyraxx', 'Drakon'],
    tiefling: ['Morthos', 'Kallista', 'Zariel', 'Nemeia', 'Malakor'],
    golem: ['Aegis-VII', 'Talos', 'Obsidian', 'Runecore', 'Bastion']
};

export const STAT_UPGRADE_META: ReadonlyArray<{
    key: keyof StatBoosts;
    label: string;
    desc: string;
}> = [
    { key: 'str', label: '🗡️ Strength (STR)', desc: '+Melee Damage/Hit & STR D20 Checks' },
    { key: 'vit', label: '🛡️ Vitality (VIT)', desc: '+14 Warrior HP / +9 Mage HP & VIT Checks' },
    { key: 'agi', label: '🏹 Agility (AGI)', desc: '+Armor Class, Initiative & AGI D20 Checks' },
    { key: 'int', label: '📜 Intelligence (INT)', desc: '+15 Mage MP / +6 War MP, Spell DMG & INT Checks' }
];
