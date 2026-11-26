import { Injectable, computed, inject, signal } from '@angular/core';
import { rollD20 } from '../../../js/dice.js';
import {
    PUZZLE_DEFINITIONS,
    applyPuzzleInput,
    createPuzzleState,
    evaluatePuzzleAttempt,
    getPuzzleHint
} from '../../../js/puzzles.js';
import { EncounterDef, PuzzleDefinition, PuzzleState } from '../models/game.models';
import { AudioService } from './audio.service';
import { GameStateService } from './game-state.service';
import { HeroService } from './hero.service';

@Injectable({ providedIn: 'root' })
export class PuzzleService {
    private readonly gameState = inject(GameStateService);
    private readonly hero = inject(HeroService);
    private readonly audio = inject(AudioService);

    readonly definitions = PUZZLE_DEFINITIONS as Record<string, PuzzleDefinition>;
    readonly activeEncounter = signal<EncounterDef | null>(null);
    readonly puzzleState = signal<PuzzleState | null>(null);
    readonly statusMessage = signal<string>('Solve the mechanism to unlock its reward.');
    readonly statusKind = signal<'info' | 'success' | 'error'>('info');

    readonly isOpen = computed(() => this.activeEncounter() !== null && this.puzzleState() !== null);
    readonly definition = computed<PuzzleDefinition | null>(() => {
        const s = this.puzzleState();
        return s ? this.definitions[s.puzzleId] || null : null;
    });

    readonly currentWeightSum = computed(() => {
        const s = this.puzzleState();
        if (!s) return 0;
        return s.selectedWeights.reduce((acc, v) => acc + v, 0);
    });

    constructor() {
        this.gameState.registerModalLifecycle(
            () => this.isOpen(),
            () => this.reset()
        );
    }

    reset(): void {
        this.activeEncounter.set(null);
        this.puzzleState.set(null);
    }

    private cloneState(state: PuzzleState): PuzzleState {
        return {
            ...state,
            sequence: [...state.sequence],
            mirrorAngles: [...state.mirrorAngles],
            selectedWeights: [...state.selectedWeights]
        };
    }

    openPuzzle(enc: EncounterDef): void {
        const puzzleId = enc.puzzleId || enc.id;
        const def = this.definitions[puzzleId];
        if (!def) return;

        this.activeEncounter.set(enc);
        this.puzzleState.set(this.cloneState(createPuzzleState(def.id)));
        this.statusMessage.set('Solve the mechanism to unlock its reward.');
        this.statusKind.set('info');
    }

    sendInput(action: { type: string; runeId?: string; index?: number; weight?: number }): void {
        const state = this.puzzleState();
        if (!state) return;
        this.audio.sound.playSelect();

        const mutable = this.cloneState(state);
        const { autoEvaluate } = applyPuzzleInput(mutable, action);
        this.puzzleState.set(this.cloneState(mutable));

        if (autoEvaluate) {
            this.evaluate();
        }
    }

    evaluate(): void {
        const state = this.puzzleState();
        const enc = this.activeEncounter();
        if (!state || !enc) return;

        const mutable = this.cloneState(state);
        const res = evaluatePuzzleAttempt(mutable);
        const def = this.definitions[mutable.puzzleId];
        this.puzzleState.set(this.cloneState(mutable));
        if (!def) return;

        const adventureApp = this.gameState.getAdventureApp();

        if (res.solved) {
            this.audio.sound.playSuccess();
            this.statusMessage.set(res.feedback);
            this.statusKind.set('success');
            this.gameState.addLogMessage(`🔮 Solved ${def.name}: ${res.feedback}`, 'success');

            if (res.reward) {
                const reward = res.reward;
                this.gameState.updatePlayerStats((prev) => ({
                    ...prev,
                    gold: prev.gold + (reward.gold || 0),
                    xp: prev.xp + (reward.xp || 0),
                    consumables: reward.consumable
                        ? [...prev.consumables, reward.consumable]
                        : prev.consumables
                }));
                this.gameState.bankCurrentDelveRewards('mid_run');
            }

            if (!this.gameState.solvedPuzzleIds().has(def.id)) {
                const updated = new Set(this.gameState.solvedPuzzleIds());
                updated.add(def.id);
                this.gameState.solvedPuzzleIds.set(updated);
                if (updated.size === Object.keys(this.definitions).length) {
                    this.gameState.updatePlayerStats((prev) => ({
                        ...prev,
                        gold: prev.gold + 75,
                        xp: prev.xp + 80
                    }));
                    this.gameState.bankCurrentDelveRewards('mid_run');
                    this.gameState.addLogMessage(
                        '🌟 Arcanum Mastery! All Floor 2 puzzles solved (+75 Gold, +80 XP).',
                        'crit'
                    );
                }
            }

            if (adventureApp) {
                adventureApp.resolveEncounterVisual(enc.id, true);
            }
        } else {
            this.audio.sound.playTrapTrigger();
            this.gameState.triggerDamageFeedback();
            const dmg = res.failDamage || 8;

            this.gameState.updatePlayerStats((prev) => ({
                ...prev,
                currentHp: Math.max(0, prev.currentHp - dmg)
            }));
            this.statusMessage.set(`${res.feedback} Took ${dmg} arcane damage!`);
            this.statusKind.set('error');
            this.gameState.addLogMessage(`💥 ${def.name} misfired (-${dmg} HP): ${res.feedback}`, 'fail');

            if (this.gameState.playerStats().currentHp <= 0) {
                const revivedHp = Math.max(2, Math.floor(this.gameState.playerStats().maxHp / 2));
                this.reset();
                this.gameState.respawnPlayerAtEntrance(
                    `💀 Slain by ${def.name} backlash! Revived at the entrance with ${revivedHp} HP.`
                );
            }
        }
    }

    inspectHint(): void {
        const state = this.puzzleState();
        const def = this.definition();
        if (!state || !def) return;

        const stats = this.hero.heroStats();
        const outcome = rollD20(stats.int || 10, 'Intelligence', def.hintDc);
        this.audio.sound.playDiceLand(outcome.isNat20);

        if (outcome.success) {
            const mutable = this.cloneState(state);
            const hint = getPuzzleHint(mutable);
            this.puzzleState.set(this.cloneState(mutable));
            this.statusMessage.set(`INT Check (${outcome.total} vs DC ${def.hintDc}) Passed! Hint: ${hint}`);
            this.statusKind.set('success');
        } else {
            this.statusMessage.set(
                `INT Check (${outcome.total} vs DC ${def.hintDc}) Failed. Study the clue carefully.`
            );
            this.statusKind.set('error');
        }
    }

    stepBack(): void {
        const enc = this.activeEncounter();
        this.audio.sound.playSelect();
        const adventureApp = this.gameState.getAdventureApp();
        if (adventureApp && enc) {
            adventureApp.resolveEncounterVisual(enc.id, false);
        }
        this.reset();
    }

    continueAdventure(): void {
        this.audio.sound.playSelect();
        this.reset();
    }
}
