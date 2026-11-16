// Persistent Progression Engine, HTTPCookie Manager & After-Delve Shop Catalog

export const COOKIE_NAME = 'dd_progression';
export const GOLD_COOKIE_NAME = 'dd_gold';
export const EXP_COOKIE_NAME = 'dd_exp';

export const STARTER_ANCESTRIES = Object.freeze([
    'human',
    'elf',
    'dwarf',
    'orc',
    'goblin',
    'catfolk'
]);

export const ALL_ANCESTRIES = Object.freeze([
    'human',
    'elf',
    'dwarf',
    'orc',
    'goblin',
    'catfolk',
    'dragonborn',
    'tiefling',
    'golem'
]);

export const SHOP_ARMOR = Object.freeze({
    iron_chainmail: {
        id: 'iron_chainmail',
        name: 'Iron Vanguard Mail',
        icon: '🛡️',
        tier: 0,
        cost: 0,
        starter: true,
        acBonus: 0,
        maxHpBonus: 0,
        maxMpBonus: 0,
        vitBonus: 0,
        agiBonus: 0,
        damageReduction: 0,
        armorColor: null,
        desc: 'Standard-issue crypt delver armor.'
    },
    steel_plate: {
        id: 'steel_plate',
        name: 'Tempered Steel Cuirass',
        icon: '🛡️',
        tier: 1,
        cost: 60,
        starter: false,
        acBonus: 1,
        maxHpBonus: 20,
        maxMpBonus: 0,
        vitBonus: 1,
        agiBonus: 0,
        damageReduction: 1,
        armorColor: '#cbd5e1',
        desc: '+1 AC, +20 Max HP, +1 VIT, -1 incoming damage.'
    },
    mithril_hauberk: {
        id: 'mithril_hauberk',
        name: 'Mithril Astral Hauberk',
        icon: '✨',
        tier: 2,
        cost: 130,
        starter: false,
        acBonus: 2,
        maxHpBonus: 35,
        maxMpBonus: 20,
        vitBonus: 1,
        agiBonus: 2,
        damageReduction: 2,
        armorColor: '#38bdf8',
        desc: '+2 AC, +35 Max HP, +20 Max MP, +2 AGI, +1 VIT, -2 incoming damage.'
    },
    obsidian_dreadplate: {
        id: 'obsidian_dreadplate',
        name: 'Phusza Obsidian Dreadplate',
        icon: '👑',
        tier: 3,
        cost: 220,
        starter: false,
        acBonus: 3,
        maxHpBonus: 55,
        maxMpBonus: 25,
        vitBonus: 3,
        agiBonus: 1,
        damageReduction: 3,
        armorColor: '#7c3aed',
        desc: '+3 AC, +55 Max HP, +25 Max MP, +3 VIT, -3 incoming damage.'
    }
});

export const SHOP_WEAPONS = Object.freeze({
    iron_longsword: {
        id: 'iron_longsword',
        name: 'Iron Arming Blade / Initiate Staff',
        icon: '⚔️',
        tier: 0,
        cost: 0,
        starter: true,
        attackBonus: 0,
        damageBonus: 0,
        strBonus: 0,
        intBonus: 0,
        critThreshold: 20,
        desc: 'Standard-issue adventurer weapon.'
    },
    runed_broadsword: {
        id: 'runed_broadsword',
        name: 'Runed Silver Broadsword',
        icon: '🗡️',
        tier: 1,
        cost: 55,
        starter: false,
        attackBonus: 1,
        damageBonus: 3,
        strBonus: 1,
        intBonus: 1,
        critThreshold: 20,
        desc: '+1 Attack Hit, +3 Damage, +1 STR, +1 INT.'
    },
    flametongue_blade: {
        id: 'flametongue_blade',
        name: 'Flametongue Greatsword',
        icon: '🔥',
        tier: 2,
        cost: 125,
        starter: false,
        attackBonus: 2,
        damageBonus: 5,
        strBonus: 2,
        intBonus: 2,
        critThreshold: 20,
        desc: '+2 Attack Hit, +5 Damage, +2 STR, +2 INT.'
    },
    phusza_soulreaver: {
        id: 'phusza_soulreaver',
        name: 'Soulreaver of Phusza',
        icon: '⚡',
        tier: 3,
        cost: 210,
        starter: false,
        attackBonus: 3,
        damageBonus: 8,
        strBonus: 3,
        intBonus: 3,
        critThreshold: 19,
        desc: '+3 Attack Hit, +8 Damage, +3 STR, +3 INT, Crit on 19-20.'
    }
});

export const SHOP_SPELLS = Object.freeze({
    frost_nova: {
        id: 'frost_nova',
        name: 'Frost Nova',
        icon: '❄️',
        cost: 50,
        mpCost: 12,
        dice: { count: 2, sides: 6, mod: 2 },
        stat: 'int',
        effect: 'chill',
        chillPenalty: 2,
        desc: '2d6+2 + INT cold damage & chills foe (-2 Attack next turn).'
    },
    arcane_bolt_barrage: {
        id: 'arcane_bolt_barrage',
        name: 'Arcane Missile Volley',
        icon: '🌠',
        cost: 85,
        mpCost: 14,
        dice: { count: 3, sides: 4, mod: 3 },
        stat: 'int',
        autoHit: true,
        desc: 'Unerring arcane darts dealing 3d4+3 + INT force damage (never misses).'
    },
    vampiric_drain: {
        id: 'vampiric_drain',
        name: 'Crimson Soul Drain',
        icon: '🩸',
        cost: 120,
        mpCost: 16,
        dice: { count: 2, sides: 8, mod: 2 },
        stat: 'int',
        lifestealRatio: 0.5,
        desc: '2d8+2 + INT necrotic damage & restores 50% of damage dealt as HP.'
    },
    chronos_thunder: {
        id: 'chronos_thunder',
        name: 'Phusza Storm Strike',
        icon: '🌩️',
        cost: 165,
        mpCost: 20,
        dice: { count: 3, sides: 8, mod: 4 },
        stat: 'int',
        desc: 'Calls down astral lightning for 3d8+4 + INT*2 massive damage.'
    }
});

export const SHOP_ANCESTRIES = Object.freeze({
    dragonborn: {
        id: 'dragonborn',
        name: 'Dragonborn',
        icon: '🐉',
        cost: 80,
        currency: 'gold',
        bonuses: { str: 5, agi: 1, int: 4, vit: 3 },
        flatHpBonus: 20,
        flatMpBonus: 15,
        defaultSkin: '#b91c1c',
        defaultHair: '#f59e0b',
        perk: 'Draconic Majesty: +5 STR, +4 INT, +3 VIT & +20 starting HP.'
    },
    tiefling: {
        id: 'tiefling',
        name: 'Tiefling',
        icon: '😈',
        cost: 110,
        currency: 'gold',
        bonuses: { str: 1, agi: 4, int: 6, vit: 2 },
        flatHpBonus: 10,
        flatMpBonus: 30,
        defaultSkin: '#991b1b',
        defaultHair: '#1b1b1b',
        perk: 'Hellfire Blood: +6 INT, +4 AGI, +2 VIT & +30 starting MP.'
    },
    golem: {
        id: 'golem',
        name: 'Runeforged',
        icon: '🗿',
        cost: 140,
        currency: 'gold',
        bonuses: { str: 6, agi: -1, int: 2, vit: 5 },
        flatHpBonus: 25,
        flatMpBonus: 10,
        defaultSkin: '#64748b',
        defaultHair: '#38bdf8',
        perk: 'Living Bastion: +6 STR, +5 VIT & +25 starting HP.'
    }
});

export const ANCESTRY_STAT_UPGRADE_CONFIG = Object.freeze({
    baseExpCost: 40,
    costStepPerLevel: 20,
    maxBoostPerStat: 10,
    stats: ['str', 'agi', 'int', 'vit']
});

export function createDefaultProgressionState() {
    const ancestryStatBoosts = {};
    for (const ancestryKey of ALL_ANCESTRIES) {
        ancestryStatBoosts[ancestryKey] = { str: 0, agi: 0, int: 0, vit: 0 };
    }

    return {
        version: 1,
        gold: 0,
        exp: 0,
        totalGoldEarned: 0,
        totalExpEarned: 0,
        delvesCompleted: 0,
        highestFloor: 1,
        ownedArmor: ['iron_chainmail'],
        equippedArmor: 'iron_chainmail',
        ownedWeapons: ['iron_longsword'],
        equippedWeapon: 'iron_longsword',
        ownedSpells: [],
        unlockedAncestries: [...STARTER_ANCESTRIES],
        ancestryStatBoosts,
        lastDelveSummary: {
            gold: 0,
            exp: 0,
            floor: 1,
            outcome: null
        }
    };
}

function clampNonNegInt(val, fallback = 0) {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.floor(n);
}

export function sanitizeProgressionState(raw) {
    const defaults = createDefaultProgressionState();
    if (!raw || typeof raw !== 'object') {
        return defaults;
    }

    const gold = clampNonNegInt(raw.gold, 0);
    const exp = clampNonNegInt(raw.exp, 0);
    const totalGoldEarned = Math.max(gold, clampNonNegInt(raw.totalGoldEarned, gold));
    const totalExpEarned = Math.max(exp, clampNonNegInt(raw.totalExpEarned, exp));
    const delvesCompleted = clampNonNegInt(raw.delvesCompleted, 0);
    const highestFloor = Math.max(1, clampNonNegInt(raw.highestFloor, 1));

    const ownedArmorSet = new Set(['iron_chainmail']);
    if (Array.isArray(raw.ownedArmor)) {
        for (const id of raw.ownedArmor) {
            if (typeof id === 'string' && Object.hasOwn(SHOP_ARMOR, id)) {
                ownedArmorSet.add(id);
            }
        }
    }
    const ownedArmor = [...ownedArmorSet];
    const equippedArmor = (typeof raw.equippedArmor === 'string' && ownedArmorSet.has(raw.equippedArmor))
        ? raw.equippedArmor
        : 'iron_chainmail';

    const ownedWeaponsSet = new Set(['iron_longsword']);
    if (Array.isArray(raw.ownedWeapons)) {
        for (const id of raw.ownedWeapons) {
            if (typeof id === 'string' && Object.hasOwn(SHOP_WEAPONS, id)) {
                ownedWeaponsSet.add(id);
            }
        }
    }
    const ownedWeapons = [...ownedWeaponsSet];
    const equippedWeapon = (typeof raw.equippedWeapon === 'string' && ownedWeaponsSet.has(raw.equippedWeapon))
        ? raw.equippedWeapon
        : 'iron_longsword';

    const ownedSpellsSet = new Set();
    if (Array.isArray(raw.ownedSpells)) {
        for (const id of raw.ownedSpells) {
            if (typeof id === 'string' && Object.hasOwn(SHOP_SPELLS, id)) {
                ownedSpellsSet.add(id);
            }
        }
    }
    const ownedSpells = [...ownedSpellsSet];

    const unlockedSet = new Set(STARTER_ANCESTRIES);
    if (Array.isArray(raw.unlockedAncestries)) {
        for (const id of raw.unlockedAncestries) {
            if (typeof id === 'string' && ALL_ANCESTRIES.includes(id)) {
                unlockedSet.add(id);
            }
        }
    }
    const unlockedAncestries = [...unlockedSet];

    const ancestryStatBoosts = {};
    const maxBoost = ANCESTRY_STAT_UPGRADE_CONFIG.maxBoostPerStat;
    const rawBoosts = (raw.ancestryStatBoosts && typeof raw.ancestryStatBoosts === 'object')
        ? raw.ancestryStatBoosts
        : {};

    for (const ancestryKey of ALL_ANCESTRIES) {
        const entry = rawBoosts[ancestryKey] && typeof rawBoosts[ancestryKey] === 'object'
            ? rawBoosts[ancestryKey]
            : {};
        ancestryStatBoosts[ancestryKey] = {
            str: Math.min(maxBoost, clampNonNegInt(entry.str, 0)),
            agi: Math.min(maxBoost, clampNonNegInt(entry.agi, 0)),
            int: Math.min(maxBoost, clampNonNegInt(entry.int, 0)),
            vit: Math.min(maxBoost, clampNonNegInt(entry.vit, 0))
        };
    }

    const rawSummary = (raw.lastDelveSummary && typeof raw.lastDelveSummary === 'object')
        ? raw.lastDelveSummary
        : {};
    const lastDelveSummary = {
        gold: clampNonNegInt(rawSummary.gold, 0),
        exp: clampNonNegInt(rawSummary.exp, 0),
        floor: Math.max(1, clampNonNegInt(rawSummary.floor, 1)),
        outcome: typeof rawSummary.outcome === 'string' ? rawSummary.outcome : null
    };

    return {
        version: 1,
        gold,
        exp,
        totalGoldEarned,
        totalExpEarned,
        delvesCompleted,
        highestFloor,
        ownedArmor,
        equippedArmor,
        ownedWeapons,
        equippedWeapon,
        ownedSpells,
        unlockedAncestries,
        ancestryStatBoosts,
        lastDelveSummary
    };
}

/**
 * HTTPCookie Utility for cross-session persistence via HTTP cookies & document.cookie.
 * Supports browser `document.cookie`, raw HTTP `Cookie` / `Set-Cookie` headers, and Node fallback storage.
 */
export class HTTPCookie {
    static _memoryStore = new Map();

    static _hasBrowserCookieJar() {
        return typeof document !== 'undefined' && document !== null && typeof document.cookie === 'string';
    }

    static _isPlainMockDocumentCookie() {
        if (!HTTPCookie._hasBrowserCookieJar()) return false;
        const ownDesc = Object.getOwnPropertyDescriptor(document, 'cookie');
        return Boolean(ownDesc && Object.hasOwn(ownDesc, 'value'));
    }

    static parse(cookieHeader = '') {
        const result = {};
        if (typeof cookieHeader !== 'string' || !cookieHeader.trim()) {
            return result;
        }
        const pairs = cookieHeader.split(';');
        for (const part of pairs) {
            const trimmed = part.trim();
            if (!trimmed) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx <= 0) continue;
            const rawKey = trimmed.slice(0, eqIdx).trim();
            const rawVal = trimmed.slice(eqIdx + 1).trim();
            if (!rawKey) continue;
            // Skip standard Set-Cookie attributes if a full Set-Cookie string was passed
            const lowerKey = rawKey.toLowerCase();
            if (lowerKey === 'path' || lowerKey === 'max-age' || lowerKey === 'samesite' || lowerKey === 'expires' || lowerKey === 'domain') {
                continue;
            }
            try {
                result[rawKey] = decodeURIComponent(rawVal);
            } catch {
                result[rawKey] = rawVal;
            }
        }
        return result;
    }

    static serialize(name, value, options = {}) {
        const safeName = String(name).trim();
        const encodedValue = encodeURIComponent(String(value ?? ''));
        const path = options.path || '/';
        const maxAge = Number.isFinite(options.maxAge) ? Math.trunc(options.maxAge) : 31536000;
        const sameSite = options.sameSite || 'Lax';
        let cookieStr = `${safeName}=${encodedValue}; Path=${path}; Max-Age=${maxAge}; SameSite=${sameSite}`;
        if (options.httpOnly) {
            cookieStr += '; HttpOnly';
        }
        return cookieStr;
    }

    static getAll(cookieSource = null) {
        if (typeof cookieSource === 'string') {
            return HTTPCookie.parse(cookieSource);
        }
        const merged = {};
        for (const [k, v] of HTTPCookie._memoryStore.entries()) {
            merged[k] = v;
        }
        if (HTTPCookie._hasBrowserCookieJar() && document.cookie) {
            const browserCookies = HTTPCookie.parse(document.cookie);
            Object.assign(merged, browserCookies);
        }
        return merged;
    }

    static get(name, cookieSource = null) {
        if (typeof cookieSource === 'string') {
            const parsed = HTTPCookie.parse(cookieSource);
            return Object.hasOwn(parsed, name) ? parsed[name] : null;
        }
        if (HTTPCookie._hasBrowserCookieJar() && document.cookie) {
            const parsed = HTTPCookie.parse(document.cookie);
            if (Object.hasOwn(parsed, name)) {
                return parsed[name];
            }
        }
        if (HTTPCookie._memoryStore.has(name)) {
            return HTTPCookie._memoryStore.get(name);
        }
        return null;
    }

    static set(name, value, options = {}) {
        const strVal = String(value ?? '');
        const serialized = HTTPCookie.serialize(name, strVal, options);

        if (options.maxAge === 0) {
            HTTPCookie._memoryStore.delete(name);
        } else {
            HTTPCookie._memoryStore.set(name, strVal);
        }

        if (HTTPCookie._hasBrowserCookieJar()) {
            if (HTTPCookie._isPlainMockDocumentCookie()) {
                const current = HTTPCookie.parse(document.cookie);
                if (options.maxAge === 0) {
                    delete current[name];
                } else {
                    current[name] = strVal;
                }
                document.cookie = Object.entries(current)
                    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
                    .join('; ');
            } else {
                document.cookie = serialized;
            }
        }
        return serialized;
    }

    static remove(name) {
        return HTTPCookie.set(name, '', { maxAge: 0 });
    }

    static toSetCookieHeaders(state, options = {}) {
        const sanitized = sanitizeProgressionState(state);
        return [
            HTTPCookie.serialize(COOKIE_NAME, JSON.stringify(sanitized), options),
            HTTPCookie.serialize(GOLD_COOKIE_NAME, String(sanitized.gold), options),
            HTTPCookie.serialize(EXP_COOKIE_NAME, String(sanitized.exp), options)
        ];
    }

    static saveProgression(state, options = {}) {
        const sanitized = sanitizeProgressionState(state);
        HTTPCookie.set(COOKIE_NAME, JSON.stringify(sanitized), options);
        HTTPCookie.set(GOLD_COOKIE_NAME, String(sanitized.gold), options);
        HTTPCookie.set(EXP_COOKIE_NAME, String(sanitized.exp), options);
        return sanitized;
    }

    static loadProgression(cookieSource = null) {
        const rawProg = HTTPCookie.get(COOKIE_NAME, cookieSource);
        const rawGold = HTTPCookie.get(GOLD_COOKIE_NAME, cookieSource);
        const rawExp = HTTPCookie.get(EXP_COOKIE_NAME, cookieSource);

        let parsed = {};
        if (typeof rawProg === 'string' && rawProg.trim()) {
            try {
                const obj = JSON.parse(rawProg);
                if (obj && typeof obj === 'object') {
                    parsed = { ...obj };
                }
            } catch {
                parsed = {};
            }
        }

        if (rawGold !== null && rawGold !== '' && Number.isFinite(Number(rawGold))) {
            parsed.gold = clampNonNegInt(rawGold, parsed.gold ?? 0);
        }
        if (rawExp !== null && rawExp !== '' && Number.isFinite(Number(rawExp))) {
            parsed.exp = clampNonNegInt(rawExp, parsed.exp ?? 0);
        }

        return sanitizeProgressionState(parsed);
    }

    static clearAll() {
        HTTPCookie.remove(COOKIE_NAME);
        HTTPCookie.remove(GOLD_COOKIE_NAME);
        HTTPCookie.remove(EXP_COOKIE_NAME);
        HTTPCookie._memoryStore.clear();
    }
}

export class ProgressionManager {
    constructor(cookieSource = null) {
        this.listeners = new Set();
        this.state = HTTPCookie.loadProgression(cookieSource);
    }

    getState() {
        return sanitizeProgressionState(this.state);
    }

    save() {
        this.state = HTTPCookie.saveProgression(this.state);
        this.syncToServer();
        this._notify();
        return this.getState();
    }

    reloadFromCookies(cookieSource = null) {
        this.state = HTTPCookie.loadProgression(cookieSource);
        this._notify();
        return this.getState();
    }

    reset() {
        HTTPCookie.clearAll();
        this.state = createDefaultProgressionState();
        HTTPCookie.saveProgression(this.state);
        this.syncToServer();
        this._notify();
        return this.getState();
    }

    getGold() {
        return this.state.gold;
    }

    getExp() {
        return this.state.exp;
    }

    awardDelveRewards({ gold = 0, exp = 0, floor = 1, outcome = 'victory' } = {}) {
        const addedGold = clampNonNegInt(gold, 0);
        const addedExp = clampNonNegInt(exp, 0);
        const floorNum = Math.max(1, clampNonNegInt(floor, 1));

        this.state.gold += addedGold;
        this.state.exp += addedExp;
        this.state.totalGoldEarned += addedGold;
        this.state.totalExpEarned += addedExp;
        if (outcome !== 'mid_run') {
            this.state.delvesCompleted += 1;
        }
        if (floorNum > this.state.highestFloor) {
            this.state.highestFloor = floorNum;
        }
        this.state.lastDelveSummary = {
            gold: addedGold,
            exp: addedExp,
            floor: floorNum,
            outcome: outcome || 'victory'
        };

        const saved = this.save();
        return {
            ok: true,
            addedGold,
            addedExp,
            totalGold: saved.gold,
            totalExp: saved.exp,
            state: saved
        };
    }

    buyArmor(armorId) {
        const item = SHOP_ARMOR[armorId];
        if (!item) {
            return { ok: false, reason: 'invalid_item', state: this.getState() };
        }
        if (this.state.ownedArmor.includes(armorId)) {
            return { ok: false, reason: 'already_owned', item, state: this.getState() };
        }
        if (this.state.gold < item.cost) {
            return { ok: false, reason: 'insufficient_gold', cost: item.cost, state: this.getState() };
        }

        this.state.gold -= item.cost;
        this.state.ownedArmor.push(armorId);
        this.state.equippedArmor = armorId;
        const saved = this.save();
        return { ok: true, item, state: saved };
    }

    equipArmor(armorId) {
        const item = SHOP_ARMOR[armorId];
        if (!item) {
            return { ok: false, reason: 'invalid_item', state: this.getState() };
        }
        if (!this.state.ownedArmor.includes(armorId)) {
            return { ok: false, reason: 'not_owned', state: this.getState() };
        }
        this.state.equippedArmor = armorId;
        const saved = this.save();
        return { ok: true, item, state: saved };
    }

    buyWeapon(weaponId) {
        const item = SHOP_WEAPONS[weaponId];
        if (!item) {
            return { ok: false, reason: 'invalid_item', state: this.getState() };
        }
        if (this.state.ownedWeapons.includes(weaponId)) {
            return { ok: false, reason: 'already_owned', item, state: this.getState() };
        }
        if (this.state.gold < item.cost) {
            return { ok: false, reason: 'insufficient_gold', cost: item.cost, state: this.getState() };
        }

        this.state.gold -= item.cost;
        this.state.ownedWeapons.push(weaponId);
        this.state.equippedWeapon = weaponId;
        const saved = this.save();
        return { ok: true, item, state: saved };
    }

    equipWeapon(weaponId) {
        const item = SHOP_WEAPONS[weaponId];
        if (!item) {
            return { ok: false, reason: 'invalid_item', state: this.getState() };
        }
        if (!this.state.ownedWeapons.includes(weaponId)) {
            return { ok: false, reason: 'not_owned', state: this.getState() };
        }
        this.state.equippedWeapon = weaponId;
        const saved = this.save();
        return { ok: true, item, state: saved };
    }

    buySpell(spellId) {
        const item = SHOP_SPELLS[spellId];
        if (!item) {
            return { ok: false, reason: 'invalid_item', state: this.getState() };
        }
        if (this.state.ownedSpells.includes(spellId)) {
            return { ok: false, reason: 'already_owned', item, state: this.getState() };
        }
        if (this.state.gold < item.cost) {
            return { ok: false, reason: 'insufficient_gold', cost: item.cost, state: this.getState() };
        }

        this.state.gold -= item.cost;
        this.state.ownedSpells.push(spellId);
        const saved = this.save();
        return { ok: true, item, state: saved };
    }

    hasSpell(spellId) {
        return this.state.ownedSpells.includes(spellId);
    }

    getOwnedSpells() {
        return this.state.ownedSpells
            .map((id) => SHOP_SPELLS[id])
            .filter(Boolean);
    }

    buyAncestry(ancestryId) {
        if (STARTER_ANCESTRIES.includes(ancestryId)) {
            return { ok: false, reason: 'already_unlocked', state: this.getState() };
        }
        const item = SHOP_ANCESTRIES[ancestryId];
        if (!item) {
            return { ok: false, reason: 'invalid_ancestry', state: this.getState() };
        }
        if (this.state.unlockedAncestries.includes(ancestryId)) {
            return { ok: false, reason: 'already_unlocked', item, state: this.getState() };
        }
        if (this.state.gold < item.cost) {
            return { ok: false, reason: 'insufficient_gold', cost: item.cost, state: this.getState() };
        }

        this.state.gold -= item.cost;
        this.state.unlockedAncestries.push(ancestryId);
        const saved = this.save();
        return { ok: true, item, state: saved };
    }

    isAncestryUnlocked(ancestryId) {
        return STARTER_ANCESTRIES.includes(ancestryId) || this.state.unlockedAncestries.includes(ancestryId);
    }

    getUnlockedAncestries() {
        return [...this.state.unlockedAncestries];
    }

    getAncestryStatBoosts(ancestryId) {
        const boosts = this.state.ancestryStatBoosts?.[ancestryId];
        return {
            str: clampNonNegInt(boosts?.str, 0),
            agi: clampNonNegInt(boosts?.agi, 0),
            int: clampNonNegInt(boosts?.int, 0),
            vit: clampNonNegInt(boosts?.vit, 0)
        };
    }

    getStatUpgradeCost(ancestryId, statKey) {
        const currentBoosts = this.getAncestryStatBoosts(ancestryId);
        const currentLevel = clampNonNegInt(currentBoosts[statKey], 0);
        return ANCESTRY_STAT_UPGRADE_CONFIG.baseExpCost +
            currentLevel * ANCESTRY_STAT_UPGRADE_CONFIG.costStepPerLevel;
    }

    buyAncestryStatBoost(ancestryId, statKey) {
        if (!ALL_ANCESTRIES.includes(ancestryId)) {
            return { ok: false, reason: 'invalid_ancestry', state: this.getState() };
        }
        if (!this.isAncestryUnlocked(ancestryId)) {
            return { ok: false, reason: 'ancestry_locked', state: this.getState() };
        }
        if (!ANCESTRY_STAT_UPGRADE_CONFIG.stats.includes(statKey)) {
            return { ok: false, reason: 'invalid_stat', state: this.getState() };
        }

        if (!this.state.ancestryStatBoosts[ancestryId]) {
            this.state.ancestryStatBoosts[ancestryId] = { str: 0, agi: 0, int: 0, vit: 0 };
        }

        const currentLevel = clampNonNegInt(this.state.ancestryStatBoosts[ancestryId][statKey], 0);
        if (currentLevel >= ANCESTRY_STAT_UPGRADE_CONFIG.maxBoostPerStat) {
            return {
                ok: false,
                reason: 'max_level_reached',
                newLevel: currentLevel,
                state: this.getState()
            };
        }

        const cost = this.getStatUpgradeCost(ancestryId, statKey);
        if (this.state.exp < cost) {
            return {
                ok: false,
                reason: 'insufficient_exp',
                cost,
                currentLevel,
                state: this.getState()
            };
        }

        this.state.exp -= cost;
        const newLevel = currentLevel + 1;
        this.state.ancestryStatBoosts[ancestryId][statKey] = newLevel;
        const saved = this.save();

        return {
            ok: true,
            ancestryId,
            statKey,
            cost,
            newLevel,
            state: saved
        };
    }

    getEquippedArmor() {
        return SHOP_ARMOR[this.state.equippedArmor] || SHOP_ARMOR.iron_chainmail;
    }

    getEquippedWeapon() {
        return SHOP_WEAPONS[this.state.equippedWeapon] || SHOP_WEAPONS.iron_longsword;
    }

    onChange(fn) {
        if (typeof fn !== 'function') return () => {};
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
        };
    }

    _notify() {
        const snapshot = this.getState();
        for (const fn of this.listeners) {
            try {
                fn(snapshot);
            } catch {
                // Ignore listener errors
            }
        }
    }

    syncToServer() {
        if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
            try {
                window.fetch('/api/progression', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify(this.state)
                }).catch(() => {});
            } catch {
                // Ignore offline/headless fetch errors
            }
        }
    }
}

export const progression = new ProgressionManager();

if (typeof window !== 'undefined') {
    window.HTTPCookie = HTTPCookie;
    window.progression = progression;
}
