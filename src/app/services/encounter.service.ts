import { Injectable, computed, inject, signal } from '@angular/core';
import { animateDiceRoll, formatModifier, getStatModifier, rollD20 } from '../../../js/dice.js';
import { EncounterDef, EncounterOption } from '../models/game.models';
import { AudioService } from './audio.service';
import { GameStateService } from './game-state.service';
import { HeroService } from './hero.service';

export interface DisplayEncounterOption {
    option: EncounterOption;
    statVal: number;
    badgeText: string;
}

@Injectable({ providedIn: 'root' })
export class EncounterService {
    private readonly gameState = inject(GameStateService);
    private readonly hero = inject(HeroService);
    private readonly audio = inject(AudioService);

    readonly currentEncounter = signal<EncounterDef | null>(null);
    readonly isOpen = computed(() => this.currentEncounter() !== null);
    readonly stage = signal<'choices' | 'rolling' | 'result'>('choices');
    readonly d20Value = signal<number>(20);
    readonly isRolling = signal<boolean>(false);
    readonly rollFormula = signal<string>('Rolling D20 + STR...');
    readonly outcomeBanner = signal<string>('SUCCESS!');
    readonly outcomeClass = signal<'outcome-success' | 'outcome-fail' | 'outcome-crit'>('outcome-success');
    readonly resultText = signal<string>('');
    readonly canDismiss = signal<boolean>(false);

    readonly options = computed<DisplayEncounterOption[]>(() => {
        const enc = this.currentEncounter();
        const stats = this.hero.heroStats();
        if (!enc || !Array.isArray(enc.options)) return [];
        return enc.options.map((opt) => {
            const statVal = stats[opt.stat] || 10;
            const modStr = formatModifier(getStatModifier(statVal));
            return {
                option: opt,
                statVal,
                badgeText: `[${opt.statName.toUpperCase()} ${modStr} vs DC ${opt.dc}]`
            };
        });
    });

    constructor() {
        this.gameState.registerModalLifecycle(
            () => this.isOpen(),
            () => this.reset()
        );
    }

    reset(): void {
        this.currentEncounter.set(null);
        this.stage.set('choices');
        this.isRolling.set(false);
        this.canDismiss.set(false);
    }

    openEncounter(enc: EncounterDef): void {
        this.currentEncounter.set(enc);
        this.gameState.pendingLethalRespawn.set(false);
        this.stage.set('choices');
        this.isRolling.set(false);
        this.canDismiss.set(false);
        this.resultText.set('');
        this.audio.sound.playSelect();
    }

    executeCheck(opt: EncounterOption, statVal: number): void {
        if (this.stage() !== 'choices') return;

        this.stage.set('rolling');
        this.isRolling.set(true);
        this.canDismiss.set(false);
        this.resultText.set('');

        const mod = getStatModifier(statVal);
        this.rollFormula.set(`Rolling D20 + ${opt.statName} (${formatModifier(mod)}) vs DC ${opt.dc}...`);

        animateDiceRoll(
            (tempNum: number) => {
                this.d20Value.set(tempNum);
            },
            () => {
                const enc = this.currentEncounter();
                if (!enc) return;

                this.isRolling.set(false);
                this.stage.set('result');
                const outcome = rollD20(statVal, opt.statName, opt.dc);
                this.d20Value.set(outcome.rawRoll);

                this.audio.sound.playDiceLand(outcome.isNat20);

                let logClass: 'normal' | 'success' | 'fail' | 'crit' = 'normal';
                let outcomeText = '';

                if (outcome.isNat20) {
                    this.outcomeClass.set('outcome-crit');
                    this.outcomeBanner.set('🌟 NATURAL 20! CRITICAL SUCCESS! 🌟');
                    outcomeText = `NATURAL 20! (${outcome.rawRoll} + ${formatModifier(outcome.modifier)} = ${outcome.total} vs DC ${outcome.dc})`;
                    logClass = 'crit';
                } else if (outcome.isNat1) {
                    this.outcomeClass.set('outcome-fail');
                    this.outcomeBanner.set('💀 NATURAL 1! CRITICAL BLUNDER! 💀');
                    outcomeText = `NATURAL 1! (${outcome.rawRoll} + ${formatModifier(outcome.modifier)} = ${outcome.total} vs DC ${outcome.dc})`;
                    logClass = 'fail';
                } else if (outcome.success) {
                    this.outcomeClass.set('outcome-success');
                    this.outcomeBanner.set('✨ CHECK PASSED! SUCCESS! ✨');
                    outcomeText = `Check Passed! (${outcome.rawRoll} + ${formatModifier(outcome.modifier)} = ${outcome.total} vs DC ${outcome.dc})`;
                    logClass = 'success';
                } else {
                    this.outcomeClass.set('outcome-fail');
                    this.outcomeBanner.set('❌ CHECK FAILED! ❌');
                    outcomeText = `Check Failed! (${outcome.rawRoll} + ${formatModifier(outcome.modifier)} = ${outcome.total} vs DC ${outcome.dc})`;
                    logClass = 'fail';
                }

                const adventureApp = this.gameState.getAdventureApp();

                if (outcome.success) {
                    if (enc.kind === 'trap') {
                        this.audio.sound.playTrapDisarm();
                    } else {
                        this.audio.sound.playSuccess();
                    }
                    this.resultText.set(opt.successMsg);
                    this.gameState.addLogMessage(`${outcomeText}: ${opt.successMsg}`, logClass);

                    if (opt.reward) {
                        const r = opt.reward;
                        this.gameState.updatePlayerStats((prev) => {
                            let currentHp = prev.currentHp;
                            let currentMp = prev.currentMp;
                            const gold = prev.gold + (r.gold || 0);
                            const xp = prev.xp + (r.xp || 0);
                            const inventory = r.item ? [...prev.inventory, r.item] : prev.inventory;
                            const consumables = r.consumable ? [...prev.consumables, r.consumable] : prev.consumables;
                            if (r.mpRestore) currentMp = Math.min(prev.maxMp, currentMp + r.mpRestore);
                            if (r.fullHeal) {
                                currentHp = prev.maxHp;
                                currentMp = prev.maxMp;
                            }
                            return { ...prev, currentHp, currentMp, gold, xp, inventory, consumables };
                        });

                        if (r.gold || r.xp) {
                            this.gameState.bankCurrentDelveRewards('mid_run');
                        }
                        if (r.item) {
                            this.gameState.applyPassiveItemBonuses(r.item);
                        }
                        if (r.victory) {
                            this.gameState.pendingVictoryModal.set(true);
                        }
                    }

                    if (adventureApp) {
                        adventureApp.resolveEncounterVisual(enc.id, true);
                    }
                } else {
                    if (enc.kind === 'trap') {
                        this.audio.sound.playTrapTrigger();
                    } else {
                        this.audio.sound.playFailure();
                    }
                    this.resultText.set(opt.failMsg);
                    this.gameState.addLogMessage(`${outcomeText}: ${opt.failMsg}`, logClass);

                    if (opt.penalty && opt.penalty.hpDamage) {
                        const dmg = opt.penalty.hpDamage;
                        this.audio.sound.playHit();
                        this.gameState.triggerDamageFeedback();
                        this.gameState.updatePlayerStats((prev) => ({
                            ...prev,
                            currentHp: Math.max(0, prev.currentHp - dmg)
                        }));
                        this.gameState.addLogMessage(
                            `💥 Took ${dmg} damage! Current HP: ${this.gameState.playerStats().currentHp}`,
                            'fail'
                        );
                    }

                    if (opt.penalty && opt.penalty.partialHeal) {
                        const heal = opt.penalty.partialHeal;
                        this.gameState.updatePlayerStats((prev) => ({
                            ...prev,
                            currentHp: Math.min(prev.maxHp, prev.currentHp + heal)
                        }));
                    }

                    if (adventureApp) {
                        adventureApp.resolveEncounterVisual(enc.id, false);
                    }

                    if (this.gameState.playerStats().currentHp <= 0) {
                        this.gameState.pendingLethalRespawn.set(true);
                        if (adventureApp) {
                            adventureApp.respawnAtEntrance();
                            this.gameState.currentRoom.set(adventureApp.getCurrentRoom());
                        }
                        this.gameState.addLogMessage(
                            '💀 Lethal blow! The crypt drags your spirit back to the entrance...',
                            'fail'
                        );
                    }
                }

                this.canDismiss.set(true);
            }
        );
    }

    dismiss(): void {
        this.audio.sound.playSelect();
        this.currentEncounter.set(null);
        this.stage.set('choices');

        if (this.gameState.pendingLethalRespawn()) {
            this.gameState.pendingLethalRespawn.set(false);
            const revivedHp = Math.max(2, Math.floor(this.gameState.playerStats().maxHp / 2));
            this.gameState.respawnPlayerAtEntrance(
                `⚠️ Revived at the entrance with ${revivedHp} HP. Tread carefully!`
            );
        }

        if (this.gameState.pendingVictoryModal()) {
            this.gameState.pendingVictoryModal.set(false);
            this.gameState.openVictoryModal();
        }
    }
}
