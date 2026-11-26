import { Injectable, computed, inject, signal } from '@angular/core';
import { ANCESTRY_DATA, CLASS_DATA, calculateStats } from '../../../js/stats.js';
import {
    ARMOR_PALETTE,
    AncestryDef,
    BodyTypeKey,
    ClassDef,
    ComputedHeroStats,
    HAIR_PALETTE,
    HERO_NAMES,
    HeroClassKey,
    HeroConfig,
    SKIN_PALETTE
} from '../models/game.models';
import { AudioService } from './audio.service';
import { ProgressionService } from './progression.service';

@Injectable({ providedIn: 'root' })
export class HeroService {
    private readonly progression = inject(ProgressionService);
    private readonly audio = inject(AudioService);

    readonly ancestryData = ANCESTRY_DATA as Record<string, AncestryDef>;
    readonly classData = CLASS_DATA as Record<string, ClassDef>;

    readonly heroConfig = signal<HeroConfig>({
        name: 'Valerius',
        ancestry: 'human',
        race: 'human',
        charClass: 'warrior',
        bodyType: 'a',
        hairStyle: 1,
        beardStyle: 0,
        showHelm: true,
        skinColor: '#ffd2b2',
        hairColor: '#4a2e1b',
        clothColor: '#2b4c7e',
        armorColor: '#2b4c7e'
    });

    readonly heroStats = computed<ComputedHeroStats>(() => {
        const conf = this.heroConfig();
        const calc = calculateStats as (a: string, c: string, p?: unknown) => ComputedHeroStats;
        return calc(conf.ancestry, conf.charClass, this.progression.state());
    });

    readonly displayName = computed(() => this.heroConfig().name || 'Hero');
    readonly ancestryObj = computed(() => this.heroStats().ancestry || this.heroStats().race);
    readonly classObj = computed(() => this.heroStats().charClass);
    readonly ancestryClassLabel = computed(() => `${this.ancestryObj().name} ${this.classObj().name}`);

    readonly hpBarPct = computed(() => Math.min(100, Math.round((this.heroStats().maxHp / 350) * 100)));
    readonly mpBarPct = computed(() => Math.min(100, Math.round((this.heroStats().maxMp / 400) * 100)));
    readonly strBarPct = computed(() => Math.min(100, Math.round((this.heroStats().str / 30) * 100)));
    readonly vitBarPct = computed(() => Math.min(100, Math.round((this.heroStats().vit / 30) * 100)));
    readonly agiBarPct = computed(() => Math.min(100, Math.round((this.heroStats().agi / 30) * 100)));
    readonly intBarPct = computed(() => Math.min(100, Math.round((this.heroStats().int / 30) * 100)));

    readonly ancestryBoostSummary = computed(() => {
        const stats = this.heroStats();
        const boosts = stats.statBoosts || { str: 0, agi: 0, int: 0, vit: 0 };
        const total = (boosts.str || 0) + (boosts.agi || 0) + (boosts.int || 0) + (boosts.vit || 0);
        const name = this.ancestryObj().name;
        if (total > 0) {
            const parts: string[] = [];
            if (boosts.str > 0) parts.push(`+${boosts.str} STR`);
            if (boosts.vit > 0) parts.push(`+${boosts.vit} VIT`);
            if (boosts.agi > 0) parts.push(`+${boosts.agi} AGI`);
            if (boosts.int > 0) parts.push(`+${boosts.int} INT`);
            return {
                active: true,
                text: `⭐ ${name} EXP Boosts Active: ${parts.join(', ')}`
            };
        }
        return {
            active: false,
            text: `⭐ ${name} EXP Boosts: +0 (Upgrade with EXP in Shop)`
        };
    });

    readonly loadoutSummary = computed(() => {
        const stats = this.heroStats();
        const spells = this.progression.ownedSpells();
        return {
            weaponName: stats.equippedWeapon.name,
            armorName: stats.equippedArmor.name,
            spellCount: spells.length,
            spellNames: spells.length > 0 ? spells.map((s) => s.name).join(', ') : 'None'
        };
    });

    updateConfig(patch: Partial<HeroConfig>, soundType: 'select' | 'silent' | 'random' = 'select'): void {
        const prev = this.heroConfig();
        const next: HeroConfig = { ...prev, ...patch };
        if (patch.ancestry && !patch.race) next.race = patch.ancestry;
        if (patch.race && !patch.ancestry) next.ancestry = patch.race;

        const ancestryChanged = next.ancestry !== prev.ancestry;
        const classChanged = next.charClass !== prev.charClass;

        this.heroConfig.set(next);

        if (soundType === 'silent' || soundType === 'random') return;
        if (ancestryChanged) {
            this.audio.sound.playRaceSwitch();
        } else if (classChanged) {
            this.audio.sound.playClassEquip(next.charClass);
        } else if (soundType === 'select') {
            this.audio.sound.playSelect();
        }
    }

    selectAncestry(ancestryKey: string): boolean {
        const ancestryInfo = this.ancestryData[ancestryKey];
        if (!ancestryInfo || !this.progression.isAncestryUnlocked(ancestryKey)) {
            return false;
        }

        const current = this.heroConfig();
        const patch: Partial<HeroConfig> = {
            ancestry: ancestryKey,
            race: ancestryKey
        };
        if (ancestryInfo.defaultSkin) {
            patch.skinColor = ancestryInfo.defaultSkin;
        }
        if (ancestryInfo.defaultHair) {
            patch.hairColor = ancestryInfo.defaultHair;
        }
        if (ancestryKey === 'dwarf' && current.bodyType === 'a' && Number(current.beardStyle) === 0) {
            patch.beardStyle = 3;
        }
        this.updateConfig(patch, 'select');
        return true;
    }

    selectHairStyle(style: number): void {
        this.updateConfig({ hairStyle: style, showHelm: false }, 'select');
    }

    randomizeHero({ silent = false }: { silent?: boolean } = {}): void {
        if (!silent) {
            this.audio.sound.playRandomize();
        }
        const ancestries = this.progression.unlockedAncestries();
        const classes: HeroClassKey[] = ['warrior', 'mage'];
        const bodyTypes: BodyTypeKey[] = ['a', 'b'];

        const randomAncestry = ancestries[Math.floor(Math.random() * ancestries.length)] || 'human';
        const randomClass = classes[Math.floor(Math.random() * classes.length)];
        const randomBodyType = bodyTypes[Math.floor(Math.random() * bodyTypes.length)];
        const randomHairStyle = Math.floor(Math.random() * 4);
        const randomBeardStyle =
            randomBodyType === 'b'
                ? Math.random() < 0.85
                    ? 0
                    : 1 + Math.floor(Math.random() * 3)
                : Math.floor(Math.random() * 4);

        const namePool = HERO_NAMES[randomAncestry] || HERO_NAMES['human'];
        const randomName = namePool[Math.floor(Math.random() * namePool.length)];

        const pickColor = (palette: ReadonlyArray<{ color: string }>) =>
            palette[Math.floor(Math.random() * palette.length)].color;

        const ancInfo = this.ancestryData[randomAncestry];
        const defaultSkin = (ancInfo && ancInfo.defaultSkin) || pickColor(SKIN_PALETTE);
        const defaultHair = (ancInfo && ancInfo.defaultHair) || pickColor(HAIR_PALETTE);
        const armor = pickColor(ARMOR_PALETTE);
        const helm = Math.random() > 0.35;

        this.updateConfig(
            {
                name: randomName,
                ancestry: randomAncestry,
                race: randomAncestry,
                charClass: randomClass,
                bodyType: randomBodyType,
                hairStyle: randomHairStyle,
                beardStyle: randomBeardStyle,
                skinColor: defaultSkin,
                hairColor: defaultHair,
                armorColor: armor,
                clothColor: armor,
                showHelm: helm
            },
            'random'
        );
    }

    getAncestryStatsPreview(ancestryKey: string, charClass: HeroClassKey): ComputedHeroStats {
        const calc = calculateStats as (a: string, c: string, p?: unknown) => ComputedHeroStats;
        return calc(ancestryKey, charClass, this.progression.state());
    }
}
