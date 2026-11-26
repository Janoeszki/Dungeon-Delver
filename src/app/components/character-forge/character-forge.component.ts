import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    effect,
    inject,
    viewChild
} from '@angular/core';
import { CharacterCreatorApp } from '../../../../js/characterCreator.js';
import {
    ARMOR_PALETTE,
    BodyTypeKey,
    FORGE_ANCESTRIES,
    FloorNumber,
    HAIR_PALETTE,
    HeroClassKey,
    SKIN_PALETTE
} from '../../models/game.models';
import { AudioService } from '../../services/audio.service';
import { GameStateService } from '../../services/game-state.service';
import { HeroService } from '../../services/hero.service';
import { ProgressionService } from '../../services/progression.service';

@Component({
    selector: 'app-character-forge',
    standalone: true,
    templateUrl: './character-forge.component.html',
    styleUrl: './character-forge.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CharacterForgeComponent implements AfterViewInit {
    readonly gameState = inject(GameStateService);
    readonly hero = inject(HeroService);
    readonly progression = inject(ProgressionService);
    private readonly audio = inject(AudioService);
    private readonly destroyRef = inject(DestroyRef);

    readonly viewportRef = viewChild.required<ElementRef<HTMLDivElement>>('viewportCreator');

    readonly ancestries = FORGE_ANCESTRIES;
    readonly skinPalette = SKIN_PALETTE;
    readonly hairPalette = HAIR_PALETTE;
    readonly armorPalette = ARMOR_PALETTE;
    readonly hairStyles = [
        { value: 0, label: 'Base' },
        { value: 1, label: 'Style I' },
        { value: 2, label: 'Style II' },
        { value: 3, label: 'Style III' }
    ] as const;
    readonly beardStyles = [
        { value: 0, label: 'None' },
        { value: 1, label: 'Style I' },
        { value: 2, label: 'Style II' },
        { value: 3, label: 'Style III' }
    ] as const;

    private creatorApp: CharacterCreatorApp | null = null;

    constructor() {
        effect(() => {
            const isCreator = this.gameState.mode() === 'creator';
            if (this.creatorApp) {
                this.creatorApp.setActive(isCreator);
                if (isCreator) {
                    this.creatorApp.resize();
                }
            }
        });

        effect(() => {
            const conf = this.hero.heroConfig();
            if (this.creatorApp) {
                this.creatorApp.updateConfig(conf, 'silent');
            }
        });

        this.destroyRef.onDestroy(() => {
            if (this.creatorApp) {
                this.creatorApp.dispose();
                this.creatorApp = null;
            }
        });
    }

    ngAfterViewInit(): void {
        const container = this.viewportRef().nativeElement;
        this.creatorApp = new CharacterCreatorApp(container, {
            active: this.gameState.mode() === 'creator',
            skipDomSync: true
        });
        this.creatorApp.updateConfig(this.hero.heroConfig(), 'silent');
    }

    onNameInput(event: Event): void {
        const val = (event.target as HTMLInputElement).value.trim() || 'Hero';
        this.hero.updateConfig({ name: val }, 'silent');
    }

    onSelectAncestry(ancestryKey: string): void {
        if (!this.progression.isAncestryUnlocked(ancestryKey)) {
            const cost = this.hero.ancestryData[ancestryKey]?.unlockCost || 80;
            const name = this.hero.ancestryData[ancestryKey]?.name || ancestryKey;
            this.gameState.openShop('ancestries', {
                message: `🔒 ${name} is locked! Unlock it below for ${cost} Gold to forge this hero.`,
                kind: 'info'
            });
            return;
        }
        this.gameState.setShopSelectedAncestry(ancestryKey);
        this.hero.selectAncestry(ancestryKey);
    }

    getAncestryBoostTotal(ancestryKey: string): number {
        const b = this.progression.getAncestryStatBoosts(ancestryKey);
        return (b.str || 0) + (b.agi || 0) + (b.int || 0) + (b.vit || 0);
    }

    onSelectClass(charClass: HeroClassKey): void {
        this.hero.updateConfig({ charClass }, 'select');
    }

    onSelectBodyType(bodyType: BodyTypeKey): void {
        this.hero.updateConfig({ bodyType }, 'select');
    }

    onSelectHairStyle(style: number): void {
        this.hero.selectHairStyle(style);
    }

    onSelectBeardStyle(style: number): void {
        this.hero.updateConfig({ beardStyle: style }, 'select');
    }

    onToggleHelm(event: Event): void {
        const checked = (event.target as HTMLInputElement).checked;
        this.hero.updateConfig({ showHelm: checked }, 'select');
    }

    onPickSkin(color: string): void {
        this.hero.updateConfig({ skinColor: color }, 'select');
    }

    onPickHair(color: string): void {
        this.hero.updateConfig({ hairColor: color }, 'select');
    }

    onPickArmor(color: string): void {
        this.hero.updateConfig({ armorColor: color }, 'select');
    }

    onRotate(delta: number): void {
        this.audio.sound.playSelect();
        this.creatorApp?.rotateCharacter(delta);
    }

    onOpenShop(): void {
        this.audio.sound.playSelect();
        this.gameState.openShop('all');
    }

    onSelectFloor(floor: FloorNumber): void {
        this.audio.sound.playSelect();
        this.gameState.selectFloor(floor);
    }

    onEnterDungeon(): void {
        this.audio.sound.playFanfare();
        this.gameState.switchToAdventure();
    }
}
