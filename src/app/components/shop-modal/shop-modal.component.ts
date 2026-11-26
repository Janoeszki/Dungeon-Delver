import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
    STAT_UPGRADE_META,
    ShopTab,
    StatBoosts
} from '../../models/game.models';
import { AudioService } from '../../services/audio.service';
import { GameStateService } from '../../services/game-state.service';
import { HeroService } from '../../services/hero.service';
import { ProgressionService } from '../../services/progression.service';

@Component({
    selector: 'app-shop-modal',
    standalone: true,
    templateUrl: './shop-modal.component.html',
    styleUrl: './shop-modal.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopModalComponent {
    readonly gameState = inject(GameStateService);
    readonly progression = inject(ProgressionService);
    readonly hero = inject(HeroService);
    private readonly audio = inject(AudioService);

    readonly statUpgradeMeta = STAT_UPGRADE_META;
    readonly tabs: ReadonlyArray<{ key: ShopTab; id: string; label: string }> = [
        { key: 'all', id: 'shopTabAll', label: '🌟 ALL SECTIONS' },
        { key: 'armor', id: 'shopTabArmor', label: '🛡️ BETTER ARMOR' },
        { key: 'weapons', id: 'shopTabWeapons', label: '⚔️ BETTER WEAPONS' },
        { key: 'spells', id: 'shopTabSpells', label: '✨ NEW SPELLS' },
        { key: 'ancestries', id: 'shopTabAncestries', label: '🐉 NEW ANCESTRIES' },
        { key: 'stats', id: 'shopTabStats', label: '📈 ANCESTRY STAT UPGRADES (EXP)' }
    ];

    readonly lastDelveGold = computed(() => {
        const summary = this.progression.lastDelveSummary();
        return summary?.gold ?? this.gameState.playerStats().gold ?? 0;
    });

    readonly lastDelveExp = computed(() => {
        const summary = this.progression.lastDelveSummary();
        return summary?.exp ?? this.gameState.playerStats().xp ?? 0;
    });

    readonly activeLoadoutText = computed(() => {
        const wpn = this.progression.equippedWeapon();
        const arm = this.progression.equippedArmor();
        const spellCount = this.progression.ownedSpellIds().length;
        return `⚔️ ${wpn.name} | 🛡️ ${arm.name} | ✨ Spells: ${spellCount}`;
    });

    readonly resolvedStatAncestry = computed(() => {
        const selected = this.gameState.shopSelectedAncestry();
        if (this.progression.allAncestries.includes(selected)) {
            return selected;
        }
        return this.hero.heroConfig().ancestry || 'human';
    });

    readonly targetAncestryObj = computed(
        () => this.hero.ancestryData[this.resolvedStatAncestry()] || this.hero.ancestryData['human']
    );

    readonly targetAncestryUnlocked = computed(() =>
        this.progression.isAncestryUnlocked(this.resolvedStatAncestry())
    );

    readonly targetAncestryBoosts = computed(() =>
        this.progression.getAncestryStatBoosts(this.resolvedStatAncestry())
    );

    readonly warriorPreview = computed(() => {
        this.progression.state();
        return this.hero.getAncestryStatsPreview(this.resolvedStatAncestry(), 'warrior');
    });

    readonly magePreview = computed(() => {
        this.progression.state();
        return this.hero.getAncestryStatsPreview(this.resolvedStatAncestry(), 'mage');
    });

    isSectionVisible(section: Exclude<ShopTab, 'all'>): boolean {
        const cur = this.gameState.shopTab();
        return cur === 'all' || cur === section;
    }

    onSelectTab(tab: ShopTab): void {
        this.audio.sound.playSelect();
        this.gameState.setShopTab(tab);
    }

    onBuyArmor(armorId: string): void {
        const res = this.progression.buyArmor(armorId);
        if (res.ok && res.item) {
            this.audio.sound.playFanfare();
            if (res.item.armorColor) {
                this.hero.updateConfig({ armorColor: res.item.armorColor }, 'silent');
            }
            this.gameState.applyLiveProgressionToAdventure();
            this.gameState.setShopFeedback(
                `✨ Purchased & equipped ${res.item.name}! (${res.item.desc})`,
                'success'
            );
        } else {
            this.audio.sound.playFailure();
            const cost = res.cost ?? 0;
            const name = res.item?.name || armorId;
            this.gameState.setShopFeedback(`⚠️ Need ${cost} Gold to purchase ${name}.`, 'error');
        }
    }

    onEquipArmor(armorId: string): void {
        const res = this.progression.equipArmor(armorId);
        if (res.ok && res.item) {
            this.audio.sound.playSelect();
            if (res.item.armorColor) {
                this.hero.updateConfig({ armorColor: res.item.armorColor }, 'silent');
            }
            this.gameState.applyLiveProgressionToAdventure();
            this.gameState.setShopFeedback(`🛡️ Equipped ${res.item.name}!`, 'success');
        }
    }

    onBuyWeapon(weaponId: string): void {
        const res = this.progression.buyWeapon(weaponId);
        if (res.ok && res.item) {
            this.audio.sound.playFanfare();
            this.gameState.applyLiveProgressionToAdventure();
            this.gameState.setShopFeedback(
                `✨ Purchased & equipped ${res.item.name}! (${res.item.desc})`,
                'success'
            );
        } else {
            this.audio.sound.playFailure();
            const cost = res.cost ?? 0;
            const name = res.item?.name || weaponId;
            this.gameState.setShopFeedback(`⚠️ Need ${cost} Gold to purchase ${name}.`, 'error');
        }
    }

    onEquipWeapon(weaponId: string): void {
        const res = this.progression.equipWeapon(weaponId);
        if (res.ok && res.item) {
            this.audio.sound.playSelect();
            this.gameState.applyLiveProgressionToAdventure();
            this.gameState.setShopFeedback(`⚔️ Equipped ${res.item.name}!`, 'success');
        }
    }

    onBuySpell(spellId: string): void {
        const res = this.progression.buySpell(spellId);
        if (res.ok && res.item) {
            this.audio.sound.playSpellCast();
            this.gameState.setShopFeedback(
                `✨ Learned arcane spell: ${res.item.name}! Cast it in any combat encounter.`,
                'success'
            );
        } else {
            this.audio.sound.playFailure();
            const cost = res.cost ?? 0;
            const name = res.item?.name || spellId;
            this.gameState.setShopFeedback(`⚠️ Need ${cost} Gold to learn ${name}.`, 'error');
        }
    }

    onSelectAncestryHero(ancestryId: string, name: string): void {
        this.hero.selectAncestry(ancestryId);
        this.gameState.setShopSelectedAncestry(ancestryId);
        this.gameState.setShopFeedback(`🐉 Selected ${name} as your active Ancestry!`, 'success');
    }

    onBuyAncestry(ancestryId: string): void {
        const res = this.progression.buyAncestry(ancestryId);
        if (res.ok && res.item) {
            this.audio.sound.playFanfare();
            this.hero.selectAncestry(ancestryId);
            this.gameState.setShopSelectedAncestry(ancestryId);
            this.gameState.setShopFeedback(
                `🐉 Unlocked ${res.item.name} Ancestry & selected it in Character Forge!`,
                'success'
            );
        } else {
            this.audio.sound.playFailure();
            const cost = res.cost ?? 0;
            const name = res.item?.name || ancestryId;
            this.gameState.setShopFeedback(`⚠️ Need ${cost} Gold to unlock ${name}.`, 'error');
        }
    }

    onSelectStatAncestry(ancKey: string): void {
        this.audio.sound.playSelect();
        this.gameState.setShopSelectedAncestry(ancKey);
        if (this.progression.isAncestryUnlocked(ancKey)) {
            this.hero.selectAncestry(ancKey);
        }
    }

    getAncestryTotalBoosts(ancKey: string): number {
        const b = this.progression.getAncestryStatBoosts(ancKey);
        return (b.str || 0) + (b.agi || 0) + (b.int || 0) + (b.vit || 0);
    }

    onUpgradeStat(statKey: keyof StatBoosts): void {
        const ancKey = this.resolvedStatAncestry();
        const ancName = this.targetAncestryObj().name;
        const cost = this.progression.getStatUpgradeCost(ancKey, statKey);
        const res = this.progression.buyAncestryStatBoost(ancKey, statKey);
        if (res.ok) {
            this.audio.sound.playSuccess();
            this.gameState.applyLiveProgressionToAdventure();
            this.gameState.setShopFeedback(
                `⚡ Upgraded ${ancName} ${statKey.toUpperCase()} to +${res.newLevel} (-${res.cost} EXP)! Applies in Floor 1 & beyond!`,
                'success'
            );
        } else {
            this.audio.sound.playFailure();
            this.gameState.setShopFeedback(
                `⚠️ Need ${cost} EXP to boost ${ancName} ${statKey.toUpperCase()}.`,
                'error'
            );
        }
    }

    formatMod(val: number): string {
        return val >= 0 ? `+${val}` : String(val);
    }

    onLaunchFloor(floor: 1 | 2): void {
        this.audio.sound.playFanfare();
        this.gameState.closeShop();
        this.gameState.switchToAdventure(floor);
    }

    onGoForge(): void {
        this.audio.sound.playSelect();
        this.gameState.closeShop();
        this.gameState.switchToCreator();
    }

    onClose(): void {
        this.audio.sound.playSelect();
        this.gameState.closeShop();
    }

    onBackdropClick(event: MouseEvent): void {
        if (event.target === event.currentTarget) {
            this.onClose();
        }
    }
}
