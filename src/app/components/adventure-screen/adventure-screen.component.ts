import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    effect,
    inject,
    untracked,
    viewChild
} from '@angular/core';
import { DungeonWorldApp } from '../../../../js/dungeonWorld.js';
import { EncounterDef, RoomDef } from '../../models/game.models';
import { AudioService } from '../../services/audio.service';
import { CombatService } from '../../services/combat.service';
import { EncounterService } from '../../services/encounter.service';
import { GameStateService } from '../../services/game-state.service';
import { HeroService } from '../../services/hero.service';
import { ProgressionService } from '../../services/progression.service';
import { PuzzleService } from '../../services/puzzle.service';

@Component({
    selector: 'app-adventure-screen',
    standalone: true,
    templateUrl: './adventure-screen.component.html',
    styleUrl: './adventure-screen.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdventureScreenComponent {
    readonly gameState = inject(GameStateService);
    readonly hero = inject(HeroService);
    readonly progression = inject(ProgressionService);
    private readonly encounterService = inject(EncounterService);
    private readonly puzzleService = inject(PuzzleService);
    private readonly combatService = inject(CombatService);
    private readonly audio = inject(AudioService);
    private readonly destroyRef = inject(DestroyRef);

    readonly viewportRef = viewChild.required<ElementRef<HTMLDivElement>>('viewportAdventure');
    private adventureApp: DungeonWorldApp | null = null;

    constructor() {
        effect(() => {
            const mode = this.gameState.mode();
            const runId = this.gameState.runId();

            if (mode !== 'adventure' || runId === 0) {
                this.disposeWorld();
                return;
            }

            const container = this.viewportRef().nativeElement;
            untracked(() => {
                this.mountWorld(container);
            });
        });

        this.destroyRef.onDestroy(() => {
            this.disposeWorld();
        });
    }

    private mountWorld(container: HTMLDivElement): void {
        this.disposeWorld();
        container.innerHTML = '';

        const conf = this.hero.heroConfig();
        const floorNumber = this.gameState.currentFloor();

        const app = new DungeonWorldApp(
            container,
            conf,
            (enc: EncounterDef) => this.handleEncounter(enc),
            () => {},
            {
                floorNumber,
                isInputBlocked: () => this.gameState.isAnyModalOpen(),
                onRoomEnter: (room: RoomDef, meta: { firstDiscovery?: boolean } = {}) => {
                    this.gameState.currentRoom.set(room || null);
                    if (meta.firstDiscovery && room && room.whisper) {
                        this.gameState.addLogMessage(room.whisper, 'dread');
                    }
                },
                onTrapStep: (enc: EncounterDef, dmg: number) => {
                    this.audio.sound.playTrapTrigger();
                    this.gameState.triggerDamageFeedback();
                    this.gameState.updatePlayerStats((prev) => ({
                        ...prev,
                        currentHp: Math.max(0, prev.currentHp - dmg)
                    }));
                    const hpAfter = this.gameState.playerStats().currentHp;
                    this.gameState.addLogMessage(
                        `💥 Stepped on ${enc.name}! Took ${dmg} damage! Current HP: ${hpAfter}`,
                        'fail'
                    );
                    if (hpAfter <= 0) {
                        const revivedHp = Math.max(2, Math.floor(this.gameState.playerStats().maxHp / 2));
                        this.gameState.respawnPlayerAtEntrance(
                            `💀 Slain by ${enc.name}! Revived at the entrance with ${revivedHp} HP.`
                        );
                    }
                },
                onFloorVictory: () => {
                    if (!this.encounterService.isOpen()) {
                        this.gameState.openVictoryModal();
                    } else {
                        this.gameState.pendingVictoryModal.set(true);
                    }
                }
            }
        );

        this.adventureApp = app;
        this.gameState.registerAdventureApp(app);
        this.gameState.currentRoom.set(app.getCurrentRoom());
    }

    private handleEncounter(enc: EncounterDef): void {
        if (enc.isCombat) {
            this.audio.sound.playSelect();
            this.combatService.startCombat(enc);
            return;
        }
        if (enc.kind === 'puzzle') {
            this.audio.sound.playSelect();
            this.puzzleService.openPuzzle(enc);
            return;
        }
        this.encounterService.openEncounter(enc);
    }

    private disposeWorld(): void {
        if (this.adventureApp) {
            this.adventureApp.dispose();
            this.adventureApp = null;
            this.gameState.registerAdventureApp(null);
            const el = this.viewportRef()?.nativeElement;
            if (el) el.innerHTML = '';
        }
    }

    onOpenShop(): void {
        this.audio.sound.playSelect();
        this.gameState.openShop('all');
    }
}
