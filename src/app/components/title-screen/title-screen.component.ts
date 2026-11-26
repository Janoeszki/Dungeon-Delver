import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    effect,
    inject,
    signal,
    viewChild,
    viewChildren
} from '@angular/core';
import { TitleSceneApp } from '../../../../js/titleScene.js';
import { AudioService } from '../../services/audio.service';
import { GameStateService } from '../../services/game-state.service';
import { HeroService } from '../../services/hero.service';
import { ProgressionService } from '../../services/progression.service';

@Component({
    selector: 'app-title-screen',
    standalone: true,
    templateUrl: './title-screen.component.html',
    styleUrl: './title-screen.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TitleScreenComponent implements AfterViewInit {
    readonly gameState = inject(GameStateService);
    readonly progression = inject(ProgressionService);
    readonly audio = inject(AudioService);
    private readonly hero = inject(HeroService);
    private readonly destroyRef = inject(DestroyRef);

    readonly viewportRef = viewChild.required<ElementRef<HTMLDivElement>>('viewportStart');
    readonly visBarRefs = viewChildren<ElementRef<HTMLSpanElement>>('visBar');
    readonly logoBurst = signal<boolean>(false);
    readonly visualizerSlots = Array.from({ length: 10 }, (_, idx) => idx);

    private titleScene: TitleSceneApp | null = null;
    private visRafId: number | null = null;
    private burstTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        effect(() => {
            const isStart = this.gameState.mode() === 'start';
            if (this.titleScene) {
                this.titleScene.setActive(isStart);
            }
        });

        this.destroyRef.onDestroy(() => {
            if (this.visRafId !== null) {
                cancelAnimationFrame(this.visRafId);
                this.visRafId = null;
            }
            if (this.burstTimer) {
                clearTimeout(this.burstTimer);
            }
            if (this.titleScene) {
                this.titleScene.dispose();
                this.titleScene = null;
            }
        });
    }

    ngAfterViewInit(): void {
        const container = this.viewportRef().nativeElement;
        this.titleScene = new TitleSceneApp(container);
        this.titleScene.setActive(this.gameState.mode() === 'start');
        this.startVisualizerLoop();
    }

    private startVisualizerLoop(): void {
        const tick = () => {
            if (this.gameState.mode() === 'start') {
                const bars = this.visBarRefs();
                const levels = this.audio.getSpectrumBars(bars.length);
                bars.forEach((barRef, idx) => {
                    const heightPx = Math.max(3, Math.round(3 + (levels[idx] || 0) * 16));
                    barRef.nativeElement.style.height = `${heightPx}px`;
                });
            }
            this.visRafId = requestAnimationFrame(tick);
        };
        this.visRafId = requestAnimationFrame(tick);
    }

    onOpenShop(): void {
        this.audio.sound.playSelect();
        this.gameState.openShop('all');
    }

    onToggleMusic(): void {
        this.audio.toggleMusic();
    }

    onVolumeChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.audio.setVolume(Number(input.value));
    }

    onToggleSfx(): void {
        this.audio.toggleSfx();
    }

    onLogoClick(): void {
        this.audio.sound.playCrystalChime();
        this.titleScene?.pulseCrystal();
        this.logoBurst.set(false);
        if (this.burstTimer) clearTimeout(this.burstTimer);
        setTimeout(() => {
            this.logoBurst.set(true);
            this.burstTimer = setTimeout(() => this.logoBurst.set(false), 450);
        }, 0);
    }

    onStartForge(): void {
        this.audio.sound.playTitleEnter();
        this.gameState.switchToCreator();
    }

    onQuickDelve(): void {
        this.hero.randomizeHero({ silent: true });
        this.audio.sound.playFanfare();
        this.gameState.switchToAdventure();
    }

    onShowLore(): void {
        this.audio.sound.playSelect();
        this.gameState.openLore();
    }

    onAudioPromptClick(): void {
        this.audio.awakenFromPrompt();
    }
}
