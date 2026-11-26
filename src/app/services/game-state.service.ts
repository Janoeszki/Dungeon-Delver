import { Injectable, computed, inject, signal } from '@angular/core';
import { calculateStats } from '../../../js/stats.js';
import {
    FloorNumber,
    GameMode,
    LogMessage,
    LogSeverity,
    PlayerRunStats,
    RoomDef,
    ShopFeedback,
    ShopTab,
    VictoryInfo
} from '../models/game.models';
import { AudioService } from './audio.service';
import { HeroService } from './hero.service';
import { ProgressionService } from './progression.service';

export interface RegisteredDungeonWorld {
    respawnAtEntrance(): void;
    clearActiveEncounter(): void;
    resolveEncounterVisual(encounterId: string, success: boolean, opts?: Record<string, unknown>): void;
    getCurrentRoom(): RoomDef | null;
    getRunSummary(): { discoveredRooms: string[]; clearedEncounters: string[]; floorId: number };
    rooms?: RoomDef[];
    dispose(): void;
}

@Injectable({ providedIn: 'root' })
export class GameStateService {
    private readonly hero = inject(HeroService);
    private readonly progression = inject(ProgressionService);
    private readonly audio = inject(AudioService);

    readonly mode = signal<GameMode>('start');
    readonly selectedFloor = signal<FloorNumber>(1);
    readonly currentFloor = signal<FloorNumber>(1);
    readonly runId = signal<number>(0);

    readonly playerStats = signal<PlayerRunStats>({
        currentHp: 168,
        maxHp: 168,
        currentMp: 42,
        maxMp: 42,
        gold: 0,
        xp: 0,
        bankedGold: 0,
        bankedXp: 0,
        inventory: [],
        consumables: ['Lesser Healing Potion', 'Mana Draught']
    });

    readonly currentRoom = signal<RoomDef | null>(null);
    readonly logMessages = signal<LogMessage[]>([]);
    readonly damageFlashActive = signal<boolean>(false);

    readonly loreModalOpen = signal<boolean>(false);
    readonly victoryModalOpen = signal<boolean>(false);
    readonly victoryInfo = signal<VictoryInfo>({
        floor: 1,
        title: 'FLOOR 1 COMPLETE: THE CHARNEL THRESHOLD',
        subtitle: 'Exit Seal Unbound • Crown of Eldoria Claimed',
        story: 'You have conquered the traps and monsters of Floor 1, unsealed the Phusza Descent, and claimed the Crown of Eldoria!',
        statsLine: 'XP Earned: 0 | Gold Plundered: 0',
        bankLine: '🍪 HTTPCookie Vault Total: 0 Gold | 0 EXP',
        roomsLine: 'Rooms Explored: 7 / 7',
        canDescendFloor2: true
    });

    readonly shopModalOpen = signal<boolean>(false);
    readonly shopTab = signal<ShopTab>('all');
    readonly shopSelectedAncestry = signal<string>('human');
    readonly shopFeedback = signal<ShopFeedback>({
        message: 'Spend your plundered Gold on better Armor, Weapons, Spells & Ancestries, or spend EXP to permanently boost an Ancestry\'s Floor 1 stats!',
        kind: 'info'
    });

    readonly solvedPuzzleIds = signal<Set<string>>(new Set());
    readonly pendingVictoryModal = signal<boolean>(false);
    readonly pendingLethalRespawn = signal<boolean>(false);

    readonly showHeader = computed(() => this.mode() !== 'start');
    readonly showSwitchToForgeBtn = computed(() => this.mode() === 'adventure');
    readonly showRandomizeBtn = computed(() => this.mode() === 'creator');

    readonly hpPct = computed(() => {
        const s = this.playerStats();
        return Math.max(0, Math.min(100, (s.currentHp / Math.max(1, s.maxHp)) * 100));
    });
    readonly mpPct = computed(() => {
        const s = this.playerStats();
        return Math.max(0, Math.min(100, (s.currentMp / Math.max(1, s.maxMp)) * 100));
    });
    readonly isLowHp = computed(() => {
        const s = this.playerStats();
        return s.currentHp > 0 && s.currentHp / Math.max(1, s.maxHp) <= 0.35;
    });

    readonly roomBannerText = computed(() => {
        const room = this.currentRoom();
        const floor = this.currentFloor();
        if (!room || !room.name) {
            return floor === 2
                ? 'Floor 2: Entrance - Spiral Descent Landing'
                : 'Floor 1 - Entrance: Cracked Threshold';
        }
        if (new RegExp(`^floor\\s*${floor}`, 'i').test(room.name)) {
            return room.name;
        }
        return floor === 2 ? `Floor 2: ${room.name}` : `Floor 1 - ${room.name}`;
    });

    readonly itemSlotText = computed(() => {
        const s = this.playerStats();
        if (s.inventory.length > 0) {
            return `🎒 ${s.inventory[s.inventory.length - 1]}`;
        }
        if (s.consumables && s.consumables.length > 0) {
            return `🧪 ${s.consumables[0]} (x${s.consumables.length})`;
        }
        return '🎒 Gear: Basic';
    });

    private adventureApp: RegisteredDungeonWorld | null = null;
    private damageFlashTimer: ReturnType<typeof setTimeout> | null = null;
    private logSeq = 0;
    private externalModalCheckers: Array<() => boolean> = [];
    private externalModalResetters: Array<() => void> = [];

    registerAdventureApp(app: RegisteredDungeonWorld | null): void {
        this.adventureApp = app;
    }

    getAdventureApp(): RegisteredDungeonWorld | null {
        return this.adventureApp;
    }

    registerModalLifecycle(isOpen: () => boolean, reset: () => void): void {
        this.externalModalCheckers.push(isOpen);
        this.externalModalResetters.push(reset);
    }

    isAnyModalOpen(): boolean {
        if (this.shopModalOpen() || this.victoryModalOpen() || this.loreModalOpen()) {
            return true;
        }
        return this.externalModalCheckers.some((check) => check());
    }

    hideAllModals(): void {
        this.victoryModalOpen.set(false);
        this.loreModalOpen.set(false);
        this.shopModalOpen.set(false);
        this.pendingVictoryModal.set(false);
        this.pendingLethalRespawn.set(false);
        for (const reset of this.externalModalResetters) {
            reset();
        }
    }

    selectFloor(floor: FloorNumber): void {
        this.selectedFloor.set(floor);
    }

    updatePlayerStats(updater: (prev: PlayerRunStats) => PlayerRunStats): void {
        this.playerStats.update((prev) => updater(prev));
    }

    addLogMessage(text: string, type: LogSeverity = 'normal'): void {
        const entry: LogMessage = {
            id: ++this.logSeq,
            text: `> ${text}`,
            type
        };
        // Prepend matches column-reverse display in .log-messages
        this.logMessages.update((prev) => [entry, ...prev]);
    }

    triggerDamageFeedback(): void {
        this.damageFlashActive.set(false);
        if (this.damageFlashTimer) {
            clearTimeout(this.damageFlashTimer);
        }
        setTimeout(() => {
            this.damageFlashActive.set(true);
            this.damageFlashTimer = setTimeout(() => {
                this.damageFlashActive.set(false);
            }, 360);
        }, 0);
    }

    bankCurrentDelveRewards(outcome = 'mid_run'): void {
        const cur = this.playerStats();
        const floor = this.currentFloor();
        const unbankedGold = Math.max(0, cur.gold - (cur.bankedGold || 0));
        const unbankedXp = Math.max(0, cur.xp - (cur.bankedXp || 0));
        if (unbankedGold > 0 || unbankedXp > 0 || outcome !== 'mid_run') {
            this.progression.awardDelveRewards({
                gold: unbankedGold,
                exp: unbankedXp,
                floor,
                outcome
            });
            this.playerStats.update((prev) => ({
                ...prev,
                bankedGold: prev.gold,
                bankedXp: prev.xp
            }));
            this.progression.saveLastDelveSummary({
                gold: cur.gold,
                exp: cur.xp,
                floor,
                outcome: outcome || 'victory'
            });
        }
    }

    applyLiveProgressionToAdventure(): void {
        if (this.mode() !== 'adventure') return;
        const conf = this.hero.heroConfig();
        const calc = calculateStats as (a: string, c: string, p?: unknown) => { maxHp: number; maxMp: number };
        const stats = calc(conf.ancestry, conf.charClass, this.progression.state());
        this.playerStats.update((prev) => {
            const hpDelta = Math.max(0, stats.maxHp - prev.maxHp);
            const mpDelta = Math.max(0, stats.maxMp - prev.maxMp);
            return {
                ...prev,
                maxHp: stats.maxHp,
                currentHp: Math.min(stats.maxHp, prev.currentHp + hpDelta),
                maxMp: stats.maxMp,
                currentMp: Math.min(stats.maxMp, prev.currentMp + mpDelta)
            };
        });
    }

    applyPassiveItemBonuses(itemName: string): void {
        if (!itemName || typeof itemName !== 'string') return;
        this.playerStats.update((prev) => {
            let maxHp = prev.maxHp;
            let currentHp = prev.currentHp;
            let maxMp = prev.maxMp;
            let currentMp = prev.currentMp;
            if (/\+15\s*HP/i.test(itemName)) {
                maxHp += 15;
                currentHp = Math.min(maxHp, currentHp + 15);
            }
            if (/\+10\s*MP/i.test(itemName)) {
                maxMp += 10;
                currentMp = Math.min(maxMp, currentMp + 10);
            }
            return { ...prev, maxHp, currentHp, maxMp, currentMp };
        });
    }

    respawnPlayerAtEntrance(reasonMsg?: string): void {
        this.playerStats.update((prev) => {
            const revivedHp = Math.max(2, Math.floor(prev.maxHp / 2));
            const revivedMp = Math.max(prev.currentMp, Math.floor(prev.maxMp / 2));
            return { ...prev, currentHp: revivedHp, currentMp: revivedMp };
        });

        if (this.adventureApp) {
            this.adventureApp.respawnAtEntrance();
            this.currentRoom.set(this.adventureApp.getCurrentRoom());
        } else {
            this.currentRoom.set(null);
        }

        if (reasonMsg) {
            this.addLogMessage(reasonMsg, 'fail');
        }
    }

    openVictoryModal(): void {
        this.audio.sound.playFanfare();
        this.bankCurrentDelveRewards('victory');
        const floor = this.currentFloor();
        const stats = this.playerStats();
        const prog = this.progression.state();
        const summary =
            this.adventureApp && typeof this.adventureApp.getRunSummary === 'function'
                ? this.adventureApp.getRunSummary()
                : { discoveredRooms: [] };
        const totalRooms =
            this.adventureApp && Array.isArray(this.adventureApp.rooms) ? this.adventureApp.rooms.length : 8;

        this.victoryInfo.set({
            floor,
            title:
                floor === 2
                    ? 'FLOOR 2 COMPLETE: THE SUNKEN ARCANUM'
                    : 'FLOOR 1 COMPLETE: THE CHARNEL THRESHOLD',
            subtitle:
                floor === 2
                    ? 'Arch-Lich Vanquished • Staff of the Sunken Arcanum Claimed'
                    : 'Exit Seal Unbound • Crown of Eldoria Claimed',
            story:
                floor === 2
                    ? 'You solved the ancient mechanisms of the Sunken Arcanum, struck down its guardians, and claimed the Staff of the Sunken Arcanum!'
                    : 'You have conquered the traps and monsters of Floor 1, unsealed the Phusza Descent, and claimed the Crown of Eldoria!',
            statsLine: `XP Earned: ${stats.xp} | Gold Plundered: ${stats.gold}`,
            bankLine: `🍪 HTTPCookie Vault Total: ${prog.gold} Gold | ${prog.exp} EXP`,
            roomsLine: `Rooms Explored: ${summary.discoveredRooms.length} / ${totalRooms}`,
            canDescendFloor2: floor === 1
        });
        this.victoryModalOpen.set(true);
    }

    closeVictoryModal(): void {
        this.victoryModalOpen.set(false);
    }

    openShop(initialTab: ShopTab = 'all', feedback?: ShopFeedback): void {
        this.shopSelectedAncestry.set(this.hero.heroConfig().ancestry || 'human');
        this.shopTab.set(initialTab || 'all');
        if (feedback) {
            this.shopFeedback.set(feedback);
        }
        this.shopModalOpen.set(true);
    }

    closeShop(): void {
        this.shopModalOpen.set(false);
        this.applyLiveProgressionToAdventure();
    }

    setShopTab(tab: ShopTab): void {
        this.shopTab.set(tab || 'all');
    }

    setShopSelectedAncestry(ancestryKey: string): void {
        this.shopSelectedAncestry.set(ancestryKey);
    }

    setShopFeedback(message: string, kind: 'info' | 'success' | 'error' = 'info'): void {
        this.shopFeedback.set({ message, kind });
    }

    openLore(): void {
        this.loreModalOpen.set(true);
    }

    closeLore(): void {
        this.loreModalOpen.set(false);
    }

    switchToTitle(): void {
        const stats = this.playerStats();
        if (this.mode() === 'adventure' && (stats.gold > stats.bankedGold || stats.xp > stats.bankedXp)) {
            this.bankCurrentDelveRewards('retreat');
        }
        this.mode.set('start');
        this.hideAllModals();
        this.audio.playTrack('title', { reset: false });
    }

    switchToCreator(): void {
        const stats = this.playerStats();
        if (this.mode() === 'adventure' && (stats.gold > stats.bankedGold || stats.xp > stats.bankedXp)) {
            this.bankCurrentDelveRewards('retreat');
        }
        this.mode.set('creator');
        this.hideAllModals();
        this.audio.playTrack('title', { reset: false });
    }

    switchToAdventure(floorNum: FloorNumber = this.selectedFloor()): void {
        const stats = this.playerStats();
        if (this.mode() === 'adventure' && (stats.gold > stats.bankedGold || stats.xp > stats.bankedXp)) {
            this.bankCurrentDelveRewards('retreat');
        }
        const resolvedFloor: FloorNumber = Number(floorNum) === 2 ? 2 : 1;
        this.currentFloor.set(resolvedFloor);
        this.selectedFloor.set(resolvedFloor);
        this.solvedPuzzleIds.set(new Set());
        this.mode.set('adventure');
        this.hideAllModals();
        this.audio.playTrack('crypt', { reset: true });

        const conf = this.hero.heroConfig();
        const calc = calculateStats as (a: string, c: string, p?: unknown) => { maxHp: number; maxMp: number };
        const computedStats = calc(conf.ancestry, conf.charClass, this.progression.state());
        this.playerStats.set({
            currentHp: computedStats.maxHp,
            maxHp: computedStats.maxHp,
            currentMp: computedStats.maxMp,
            maxMp: computedStats.maxMp,
            gold: 0,
            xp: 0,
            bankedGold: 0,
            bankedXp: 0,
            inventory: [],
            consumables: ['Lesser Healing Potion', 'Mana Draught']
        });

        this.currentRoom.set(null);
        this.logMessages.set([]);
        this.runId.update((n) => n + 1);

        const entryMsg =
            resolvedFloor === 2
                ? `🔮 ${conf.name} descended into Floor 2: The Sunken Arcanum! Solve puzzles and vanquish the Arch-Lich.`
                : `⚡ ${conf.name} entered the Crypt of Eldoria! High danger lies ahead...`;
        this.addLogMessage(entryMsg, 'crit');
    }
}
