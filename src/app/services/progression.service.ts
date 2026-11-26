import { Injectable, computed, signal } from '@angular/core';
import {
    ALL_ANCESTRIES,
    ANCESTRY_STAT_UPGRADE_CONFIG,
    HTTPCookie,
    SHOP_ANCESTRIES,
    SHOP_ARMOR,
    SHOP_SPELLS,
    SHOP_WEAPONS,
    STARTER_ANCESTRIES,
    progression
} from '../../../js/progression.js';
import {
    ProgressionState,
    ShopAncestryItem,
    ShopArmorItem,
    ShopSpellItem,
    ShopWeaponItem,
    StatBoosts
} from '../models/game.models';

@Injectable({ providedIn: 'root' })
export class ProgressionService {
    readonly manager = progression;
    readonly httpCookie = HTTPCookie;

    readonly armorCatalog = Object.values(SHOP_ARMOR) as ShopArmorItem[];
    readonly weaponCatalog = Object.values(SHOP_WEAPONS) as ShopWeaponItem[];
    readonly spellCatalog = Object.values(SHOP_SPELLS) as ShopSpellItem[];
    readonly ancestryCatalog = Object.values(SHOP_ANCESTRIES) as ShopAncestryItem[];
    readonly starterAncestries = STARTER_ANCESTRIES as readonly string[];
    readonly allAncestries = ALL_ANCESTRIES as readonly string[];
    readonly statUpgradeConfig = ANCESTRY_STAT_UPGRADE_CONFIG;

    readonly state = signal<ProgressionState>(progression.getState() as unknown as ProgressionState);

    readonly gold = computed(() => this.state().gold);
    readonly exp = computed(() => this.state().exp);
    readonly delvesCompleted = computed(() => this.state().delvesCompleted || 0);
    readonly lastDelveSummary = computed(() => this.state().lastDelveSummary);
    readonly ownedArmor = computed(() => this.state().ownedArmor);
    readonly equippedArmorId = computed(() => this.state().equippedArmor);
    readonly equippedArmor = computed<ShopArmorItem>(
        () => (SHOP_ARMOR as Record<string, ShopArmorItem>)[this.equippedArmorId()] || SHOP_ARMOR.iron_chainmail
    );
    readonly ownedWeapons = computed(() => this.state().ownedWeapons);
    readonly equippedWeaponId = computed(() => this.state().equippedWeapon);
    readonly equippedWeapon = computed<ShopWeaponItem>(
        () => (SHOP_WEAPONS as Record<string, ShopWeaponItem>)[this.equippedWeaponId()] || SHOP_WEAPONS.iron_longsword
    );
    readonly ownedSpellIds = computed(() => this.state().ownedSpells);
    readonly ownedSpells = computed<ShopSpellItem[]>(() =>
        this.ownedSpellIds()
            .map((id) => (SHOP_SPELLS as Record<string, ShopSpellItem>)[id])
            .filter((s): s is ShopSpellItem => Boolean(s))
    );
    readonly unlockedAncestries = computed(() => this.state().unlockedAncestries);

    constructor() {
        progression.onChange((snapshot: unknown) => {
            this.state.set(snapshot as ProgressionState);
        });
    }

    isAncestryUnlocked(ancestryId: string): boolean {
        const s = this.state();
        return this.starterAncestries.includes(ancestryId) || s.unlockedAncestries.includes(ancestryId);
    }

    getAncestryStatBoosts(ancestryId: string): StatBoosts {
        const boosts = this.state().ancestryStatBoosts?.[ancestryId];
        return {
            str: Math.max(0, Math.floor(Number(boosts?.str) || 0)),
            agi: Math.max(0, Math.floor(Number(boosts?.agi) || 0)),
            int: Math.max(0, Math.floor(Number(boosts?.int) || 0)),
            vit: Math.max(0, Math.floor(Number(boosts?.vit) || 0))
        };
    }

    getStatUpgradeCost(ancestryId: string, statKey: keyof StatBoosts): number {
        const currentBoosts = this.getAncestryStatBoosts(ancestryId);
        const currentLevel = currentBoosts[statKey] || 0;
        return (
            this.statUpgradeConfig.baseExpCost +
            currentLevel * this.statUpgradeConfig.costStepPerLevel
        );
    }

    awardDelveRewards(params: { gold: number; exp: number; floor: number; outcome: string }) {
        return progression.awardDelveRewards(params);
    }

    saveLastDelveSummary(summary: { gold: number; exp: number; floor: number; outcome: string }): void {
        progression.state.lastDelveSummary = summary;
        progression.save();
    }

    buyArmor(armorId: string) {
        return progression.buyArmor(armorId);
    }

    equipArmor(armorId: string) {
        return progression.equipArmor(armorId);
    }

    buyWeapon(weaponId: string) {
        return progression.buyWeapon(weaponId);
    }

    equipWeapon(weaponId: string) {
        return progression.equipWeapon(weaponId);
    }

    buySpell(spellId: string) {
        return progression.buySpell(spellId);
    }

    buyAncestry(ancestryId: string) {
        return progression.buyAncestry(ancestryId);
    }

    buyAncestryStatBoost(ancestryId: string, statKey: keyof StatBoosts) {
        return progression.buyAncestryStatBoost(ancestryId, statKey);
    }
}
