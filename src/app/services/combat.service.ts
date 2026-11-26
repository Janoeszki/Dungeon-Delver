import { Injectable, computed, inject, signal } from '@angular/core';
import {
    CONSUMABLE_ITEMS,
    chooseMonsterAction,
    getMonsterTemplate,
    resolvePlayerSpell,
    rollDiceFormula
} from '../../../js/combat.js';
import { getStatModifier } from '../../../js/dice.js';
import {
    CombatLogEntry,
    CombatLogType,
    CombatState,
    CombatTab,
    EncounterDef
} from '../models/game.models';
import { AudioService } from './audio.service';
import { GameStateService } from './game-state.service';
import { HeroService } from './hero.service';
import { ProgressionService } from './progression.service';

export interface CombatStageController {
    start(heroConfig: unknown, monsterId: string, scale: number): void;
    stop(): void;
    playHeroAttack(type: string): void;
    playMonsterHit(isCrit: boolean): void;
    playEnemyAttack(isSpecial: boolean): void;
    playHeroHit(isDefending: boolean): void;
    setHeroDefending(isDefending: boolean): void;
    playHeroHeal(type: string): void;
    playMonsterDefeat(): void;
}

export interface GroupedConsumable {
    name: string;
    count: number;
    icon: string;
    desc: string;
}

@Injectable({ providedIn: 'root' })
export class CombatService {
    private readonly gameState = inject(GameStateService);
    private readonly hero = inject(HeroService);
    private readonly progression = inject(ProgressionService);
    private readonly audio = inject(AudioService);

    readonly combatState = signal<CombatState | null>(null);
    readonly combatLogs = signal<CombatLogEntry[]>([]);
    readonly d20Value = signal<number>(20);
    readonly d20Rolling = signal<boolean>(false);
    readonly heroShakeTick = signal<number>(0);
    readonly enemyShakeTick = signal<number>(0);

    readonly isOpen = computed(() => this.combatState() !== null);

    readonly heroHpPct = computed(() => {
        const s = this.gameState.playerStats();
        return Math.max(0, Math.min(100, (s.currentHp / Math.max(1, s.maxHp)) * 100));
    });

    readonly heroMpPct = computed(() => {
        const s = this.gameState.playerStats();
        return Math.max(0, Math.min(100, (s.currentMp / Math.max(1, s.maxMp)) * 100));
    });

    readonly monsterHpPct = computed(() => {
        const cs = this.combatState();
        if (!cs) return 100;
        return Math.max(0, Math.min(100, (cs.monster.currentHp / Math.max(1, cs.monster.maxHp)) * 100));
    });

    readonly groupedConsumables = computed<GroupedConsumable[]>(() => {
        const items = this.gameState.playerStats().consumables || [];
        const counts: Record<string, number> = {};
        for (const item of items) {
            counts[item] = (counts[item] || 0) + 1;
        }
        return Object.keys(counts).map((name) => {
            const def = (CONSUMABLE_ITEMS as Record<string, { icon: string; desc: string }>)[name] || {
                icon: '🧪',
                desc: 'Consumable item'
            };
            return {
                name,
                count: counts[name],
                icon: def.icon,
                desc: def.desc
            };
        });
    });

    private stage3D: CombatStageController | null = null;
    private logSeq = 0;

    constructor() {
        this.gameState.registerModalLifecycle(
            () => this.isOpen(),
            () => this.reset()
        );
    }

    registerStage3D(stage: CombatStageController | null): void {
        this.stage3D = stage;
    }

    reset(): void {
        if (this.stage3D) this.stage3D.stop();
        this.combatState.set(null);
        this.combatLogs.set([]);
        this.d20Rolling.set(false);
    }

    private addCombatLog(text: string, type: CombatLogType = 'info'): void {
        const entry: CombatLogEntry = {
            id: ++this.logSeq,
            text: `> ${text}`,
            type
        };
        this.combatLogs.update((prev) => [entry, ...prev]);
    }

    startCombat(enc: EncounterDef): void {
        const monsterTemplate = getMonsterTemplate(enc.monsterId);
        const conf = this.hero.heroConfig();
        const stats = this.hero.heroStats();

        const agiMod = getStatModifier(stats.agi);
        const classAcBonus = conf.charClass === 'warrior' ? 4 : 2;
        const armorAcBonus = stats.acBonus || 0;
        const basePlayerAc = 10 + agiMod + classAcBonus + armorAcBonus;

        const nextState: CombatState = {
            encounterId: enc.id,
            outcome: null,
            monster: {
                ...monsterTemplate,
                currentHp: monsterTemplate.maxHp,
                isDefending: false,
                chillPenalty: 0
            },
            player: {
                name: conf.name,
                charClass: conf.charClass,
                ancestry: conf.ancestry,
                stats,
                baseAc: basePlayerAc,
                effectiveAc: basePlayerAc,
                isDefending: false
            },
            round: 1,
            turn: 'player',
            currentTab: 'attack',
            busy: false
        };

        this.combatLogs.set([]);
        this.d20Value.set(20);
        this.d20Rolling.set(false);
        this.combatState.set(nextState);

        this.audio.sound.playMonsterGrowl();
        this.addCombatLog(`⚔️ Combat Initiated! You encounter a ${nextState.monster.name}!`, 'crit');

        const playerInit = rollDiceFormula(1, 20, agiMod);
        this.addCombatLog(
            `🎲 Initiative: ${conf.name} rolled D20 (${playerInit.rolls[0]}) + ${agiMod} = ${playerInit.total}! You take the initiative!`,
            'info'
        );

        this.audio.playTrack('crypt', { reset: false });
    }

    switchTab(tabKey: CombatTab): void {
        const cs = this.combatState();
        if (!cs) return;
        this.audio.sound.playSelect();
        this.combatState.set({ ...cs, currentTab: tabKey });
    }

    private rollCombatD20(
        modifier: number,
        onComplete: (result: {
            rawRoll: number;
            modifier: number;
            total: number;
            isNat20: boolean;
            isNat1: boolean;
        }) => void
    ): void {
        this.d20Rolling.set(true);
        this.audio.sound.playDiceRoll();

        let ticks = 0;
        const timer = setInterval(() => {
            this.d20Value.set(Math.floor(Math.random() * 20) + 1);
            ticks++;
            if (ticks >= 7) {
                clearInterval(timer);
                this.d20Rolling.set(false);
                const rawRoll = Math.floor(Math.random() * 20) + 1;
                this.d20Value.set(rawRoll);
                const isNat20 = rawRoll === 20;
                const isNat1 = rawRoll === 1;
                const total = rawRoll + modifier;
                this.audio.sound.playDiceLand(isNat20);
                onComplete({ rawRoll, modifier, total, isNat20, isNat1 });
            }
        }, 60);
    }

    executePlayerAttack(type: string, mpCost = 0): void {
        const cs = this.combatState();
        if (!cs || cs.busy) return;

        this.combatState.set({ ...cs, busy: true });

        if (mpCost > 0) {
            this.gameState.updatePlayerStats((prev) => ({
                ...prev,
                currentMp: Math.max(0, prev.currentMp - mpCost)
            }));
        }

        const { stats, charClass } = cs.player;
        const baseStatBonus =
            charClass === 'warrior' ? getStatModifier(stats.str) : getStatModifier(stats.int);
        const weaponAtkBonus = stats.attackBonus || 0;
        const weaponDmgBonus = stats.damageBonus || 0;
        const critThreshold = stats.critThreshold || 20;
        const statBonus = baseStatBonus + weaponAtkBonus;
        const targetAc = cs.monster.ac;

        if (this.stage3D) this.stage3D.playHeroAttack(type);

        this.rollCombatD20(statBonus, (d20) => {
            const cur = this.combatState();
            if (!cur) return;

            const isCrit = d20.rawRoll >= critThreshold;
            const isHit = !d20.isNat1 && (isCrit || d20.total >= targetAc);

            if (isHit) {
                if (this.stage3D) this.stage3D.playMonsterHit(isCrit);
                let dmgTotal = 0;
                let formulaDesc = '';

                if (type === 'basic_melee') {
                    this.audio.sound.playSlash();
                    const dmg = rollDiceFormula(isCrit ? 2 : 1, 8, Math.max(1, baseStatBonus) + weaponDmgBonus);
                    dmgTotal = dmg.total;
                    formulaDesc = `${dmg.rolls.join('+')} + ${Math.max(1, baseStatBonus) + weaponDmgBonus}`;
                } else if (type === 'basic_magic') {
                    this.audio.sound.playSpellCast();
                    const dmg = rollDiceFormula(isCrit ? 2 : 1, 8, Math.max(1, baseStatBonus) + weaponDmgBonus);
                    dmgTotal = dmg.total;
                    formulaDesc = `${dmg.rolls.join('+')} + ${Math.max(1, baseStatBonus) + weaponDmgBonus}`;
                } else if (type === 'special_cleave') {
                    this.audio.sound.playSlash();
                    const dmg = rollDiceFormula(isCrit ? 4 : 2, 8, baseStatBonus * 2 + weaponDmgBonus);
                    dmgTotal = dmg.total;
                    formulaDesc = `${dmg.rolls.join('+')} + ${baseStatBonus * 2 + weaponDmgBonus}`;
                } else if (type === 'special_firebolt') {
                    this.audio.sound.playSpellCast();
                    const dmg = rollDiceFormula(isCrit ? 4 : 2, 10, baseStatBonus * 2 + weaponDmgBonus);
                    dmgTotal = dmg.total;
                    formulaDesc = `${dmg.rolls.join('+')} + ${baseStatBonus * 2 + weaponDmgBonus}`;
                }

                this.combatState.set({
                    ...cur,
                    monster: {
                        ...cur.monster,
                        currentHp: Math.max(0, cur.monster.currentHp - dmgTotal)
                    }
                });
                this.enemyShakeTick.update((n) => n + 1);

                if (isCrit) {
                    this.addCombatLog(
                        `🌟 CRITICAL HIT! D20 (${d20.rawRoll}) + ${statBonus} = ${d20.total} vs AC ${targetAc}! Smashed for ${dmgTotal} DAMAGE (${formulaDesc})!`,
                        'crit'
                    );
                } else {
                    this.addCombatLog(
                        `⚔️ HIT! D20 (${d20.rawRoll}) + ${statBonus} = ${d20.total} vs AC ${targetAc}! Dealt ${dmgTotal} damage (${formulaDesc})!`,
                        'dmg'
                    );
                }
            } else {
                this.audio.sound.playHit();
                if (d20.isNat1) {
                    this.addCombatLog(`💀 CRITICAL MISS! D20 (${d20.rawRoll})! Your strike fumbles wide!`, 'dmg');
                } else {
                    this.addCombatLog(
                        `🛡️ Attack Deflected! D20 (${d20.rawRoll}) + ${statBonus} = ${d20.total} missed AC ${targetAc}!`,
                        'info'
                    );
                }
            }

            setTimeout(() => {
                this.checkCombatEndOrPassTurn();
            }, 900);
        });
    }

    executePlayerSpell(spellId: string): void {
        const cs = this.combatState();
        if (!cs || cs.busy) return;

        const spellRes = resolvePlayerSpell(
            spellId,
            { ...cs.player.stats, currentMp: this.gameState.playerStats().currentMp },
            cs.monster
        );
        if (!spellRes.ok) return;

        this.combatState.set({ ...cs, busy: true });
        this.gameState.updatePlayerStats((prev) => ({
            ...prev,
            currentMp: Math.max(0, prev.currentMp - spellRes.mpCost)
        }));

        const { stats } = cs.player;
        const atkMod = getStatModifier(stats.int) + (stats.attackBonus || 0);
        const targetAc = cs.monster.ac;

        if (this.stage3D) this.stage3D.playHeroAttack(spellId);
        this.audio.sound.playSpellCast();

        this.rollCombatD20(atkMod, (d20) => {
            const cur = this.combatState();
            if (!cur) return;

            const isCrit = d20.isNat20;
            const isHit = spellRes.autoHit || (!d20.isNat1 && (isCrit || d20.total >= targetAc));

            if (isHit) {
                if (this.stage3D) this.stage3D.playMonsterHit(isCrit);
                const baseDmg = spellRes.damage ?? 0;
                const baseHeal = spellRes.healAmount ?? 0;
                const chillVal = spellRes.chillPenalty ?? 0;
                const finalDmg = isCrit ? Math.round(baseDmg * 1.5) : baseDmg;
                const nextMonster = {
                    ...cur.monster,
                    currentHp: Math.max(0, cur.monster.currentHp - finalDmg),
                    chillPenalty: chillVal > 0 ? chillVal : cur.monster.chillPenalty
                };

                this.combatState.set({ ...cur, monster: nextMonster });
                this.enemyShakeTick.update((n) => n + 1);

                this.addCombatLog(
                    `${spellRes.spell?.icon ?? '✨'} ${spellRes.spell?.name ?? spellId} strikes ${cur.monster.name} for ${finalDmg} DAMAGE (${spellRes.formulaDesc})!`,
                    isCrit ? 'crit' : 'dmg'
                );

                if (baseHeal > 0) {
                    const healAmt = isCrit ? Math.round(baseHeal * 1.5) : baseHeal;
                    this.gameState.updatePlayerStats((prev) => ({
                        ...prev,
                        currentHp: Math.min(prev.maxHp, prev.currentHp + healAmt)
                    }));
                    if (this.stage3D) this.stage3D.playHeroHeal('heal_hp');
                    this.addCombatLog(`🩸 ${spellRes.spell?.name ?? spellId} siphoned +${healAmt} HP to you!`, 'heal');
                }

                if (chillVal > 0) {
                    this.addCombatLog(
                        `❄️ ${cur.monster.name} is Chilled (-${chillVal} Attack next turn)!`,
                        'guard'
                    );
                }
            } else {
                this.audio.sound.playHit();
                this.addCombatLog(
                    `🛡️ ${spellRes.spell?.name ?? spellId} resisted! D20 (${d20.rawRoll}) + ${atkMod} = ${d20.total} vs AC ${targetAc}.`,
                    'info'
                );
            }

            setTimeout(() => {
                this.checkCombatEndOrPassTurn();
            }, 900);
        });
    }

    executePlayerDefend(): void {
        const cs = this.combatState();
        if (!cs || cs.busy) return;

        this.audio.sound.playShieldBlock();
        const nextAc = cs.player.baseAc + 4;
        this.combatState.set({
            ...cs,
            busy: true,
            player: {
                ...cs.player,
                isDefending: true,
                effectiveAc: nextAc
            }
        });

        if (this.stage3D) this.stage3D.setHeroDefending(true);
        this.gameState.updatePlayerStats((prev) => ({
            ...prev,
            currentMp: Math.min(prev.maxMp, prev.currentMp + 4)
        }));

        this.addCombatLog(
            `🛡️ You brace into a defensive guard! AC boosted to ${nextAc} (+4 AC), damage taken will be halved! (+4 MP restored)`,
            'guard'
        );

        setTimeout(() => {
            this.checkCombatEndOrPassTurn();
        }, 700);
    }

    executePlayerItem(itemName: string): void {
        const cs = this.combatState();
        if (!cs || cs.busy) return;

        const currentConsumables = [...this.gameState.playerStats().consumables];
        const idx = currentConsumables.indexOf(itemName);
        if (idx === -1) return;
        currentConsumables.splice(idx, 1);

        this.combatState.set({ ...cs, busy: true });
        const def = (CONSUMABLE_ITEMS as Record<string, { type: string; value: number }>)[itemName];

        if (def && def.type === 'heal_hp') {
            this.audio.sound.playPotionDrink();
            const p = this.gameState.playerStats();
            const healed = Math.min(p.maxHp - p.currentHp, def.value);
            this.gameState.updatePlayerStats((prev) => ({
                ...prev,
                consumables: currentConsumables,
                currentHp: Math.min(prev.maxHp, prev.currentHp + def.value)
            }));
            if (this.stage3D) this.stage3D.playHeroHeal('heal_hp');
            this.addCombatLog(`🍷 Drank ${itemName}! Restored +${healed} HP!`, 'heal');
        } else if (def && def.type === 'heal_mp') {
            this.audio.sound.playPotionDrink();
            const p = this.gameState.playerStats();
            const healed = Math.min(p.maxMp - p.currentMp, def.value);
            this.gameState.updatePlayerStats((prev) => ({
                ...prev,
                consumables: currentConsumables,
                currentMp: Math.min(prev.maxMp, prev.currentMp + def.value)
            }));
            if (this.stage3D) this.stage3D.playHeroHeal('heal_mp');
            this.addCombatLog(`🧪 Drank ${itemName}! Restored +${healed} MP!`, 'heal');
        } else if (def && def.type === 'damage_undead') {
            this.audio.sound.playSpellCast();
            const dmg = def.value;
            this.gameState.updatePlayerStats((prev) => ({
                ...prev,
                consumables: currentConsumables
            }));
            this.combatState.set({
                ...cs,
                busy: true,
                monster: {
                    ...cs.monster,
                    currentHp: Math.max(0, cs.monster.currentHp - dmg)
                }
            });
            if (this.stage3D) {
                this.stage3D.playHeroAttack('holy_water');
                this.stage3D.playMonsterHit(true);
            }
            this.addCombatLog(`✨ Hurled ${itemName}! Smashed foe dealing ${dmg} Radiant Damage!`, 'crit');
        } else {
            this.gameState.updatePlayerStats((prev) => ({
                ...prev,
                consumables: currentConsumables
            }));
        }

        setTimeout(() => {
            this.checkCombatEndOrPassTurn();
        }, 800);
    }

    executePlayerFlee(): void {
        const cs = this.combatState();
        if (!cs || cs.busy) return;

        this.combatState.set({ ...cs, busy: true });
        const agiMod = getStatModifier(cs.player.stats.agi);

        this.rollCombatD20(agiMod, (d20) => {
            const cur = this.combatState();
            if (!cur) return;

            if (d20.total >= 11 || d20.isNat20) {
                this.audio.sound.playFlee();
                this.addCombatLog(
                    `🏃 Escape Succeeded! D20 (${d20.rawRoll}) + ${agiMod} = ${d20.total} vs DC 11. You slipped away into the shadows!`,
                    'heal'
                );
                this.gameState.addLogMessage(
                    `🏃 Retreated from ${cur.monster.name} into the shadows.`,
                    'normal'
                );
                setTimeout(() => {
                    if (this.stage3D) this.stage3D.stop();
                    const adventureApp = this.gameState.getAdventureApp();
                    if (adventureApp) adventureApp.clearActiveEncounter();
                    this.combatState.set(null);
                }, 1100);
            } else {
                this.audio.sound.playHit();
                this.addCombatLog(
                    `❌ Escape Blocked! D20 (${d20.rawRoll}) + ${agiMod} = ${d20.total} vs DC 11. The vanguard corners you!`,
                    'dmg'
                );
                setTimeout(() => {
                    this.checkCombatEndOrPassTurn();
                }, 900);
            }
        });
    }

    private checkCombatEndOrPassTurn(): void {
        const cs = this.combatState();
        if (!cs) return;

        if (cs.monster.currentHp <= 0) {
            this.handleCombatVictory();
            return;
        }
        if (this.gameState.playerStats().currentHp <= 0) {
            this.handleCombatDefeat();
            return;
        }

        this.combatState.set({
            ...cs,
            turn: 'enemy',
            busy: true
        });

        setTimeout(() => {
            this.executeEnemyTurn();
        }, 800);
    }

    private executeEnemyTurn(): void {
        const cs = this.combatState();
        if (!cs || cs.turn !== 'enemy') return;

        const mon = cs.monster;
        const action = chooseMonsterAction(mon, cs.round);
        const chillPenalty = mon.chillPenalty || 0;
        this.combatState.set({
            ...cs,
            monster: { ...mon, chillPenalty: 0 }
        });

        const atkBonus = Math.max(0, action.attackBonus - chillPenalty);
        const playerAc = cs.player.effectiveAc;
        const armorReduction = cs.player.stats.damageReduction || 0;

        if (action.isSpecial) {
            this.audio.sound.playMonsterGrowl();
            const actionDesc = (action as { description?: string }).description || 'Deadly technique!';
            this.addCombatLog(
                `💀 ${mon.name} unleashes ${action.name}! (${actionDesc})`,
                'crit'
            );
        } else {
            this.addCombatLog(`💀 ${mon.name} prepares to strike with ${action.name}...`, 'info');
        }
        if (this.stage3D) this.stage3D.playEnemyAttack(action.isSpecial);

        this.rollCombatD20(atkBonus, (d20) => {
            const cur = this.combatState();
            if (!cur) return;

            const isHit = !d20.isNat1 && (d20.isNat20 || d20.total >= playerAc);
            if (isHit) {
                this.audio.sound.playHit();
                this.gameState.triggerDamageFeedback();
                if (this.stage3D) this.stage3D.playHeroHit(cur.player.isDefending);

                const dice = action.damageDice || cur.monster.damageDice;
                const dmgResult = rollDiceFormula(d20.isNat20 ? dice.count * 2 : dice.count, dice.sides, dice.mod);
                let finalDmg = Math.max(1, dmgResult.total - armorReduction);

                if (cur.player.isDefending) {
                    finalDmg = Math.max(1, Math.floor(finalDmg / 2));
                    this.addCombatLog(
                        `🛡️ Guard Absorbed blow! Damage reduced from ${dmgResult.total} down to ${finalDmg}!`,
                        'guard'
                    );
                }

                this.gameState.updatePlayerStats((prev) => ({
                    ...prev,
                    currentHp: Math.max(0, prev.currentHp - finalDmg)
                }));
                this.heroShakeTick.update((n) => n + 1);

                if (d20.isNat20) {
                    this.addCombatLog(
                        `💀 ENEMY CRIT! ${cur.monster.name}'s ${action.name} struck for ${finalDmg} DAMAGE!`,
                        'dmg'
                    );
                } else {
                    this.addCombatLog(
                        `💥 ${cur.monster.name}'s ${action.name} hits! (${d20.rawRoll} + ${atkBonus} = ${d20.total} vs AC ${playerAc}) dealing ${finalDmg} damage!`,
                        'dmg'
                    );
                }
            } else {
                this.audio.sound.playShieldBlock();
                this.addCombatLog(
                    `✨ You evaded ${cur.monster.name}'s ${action.name}! (${d20.rawRoll} + ${atkBonus} = ${d20.total} vs AC ${playerAc})`,
                    'heal'
                );
            }

            if (this.stage3D) this.stage3D.setHeroDefending(false);

            this.combatState.set({
                ...cur,
                player: {
                    ...cur.player,
                    isDefending: false,
                    effectiveAc: cur.player.baseAc
                },
                round: cur.round + 1,
                turn: 'player',
                busy: false
            });

            if (this.gameState.playerStats().currentHp <= 0) {
                setTimeout(() => this.handleCombatDefeat(), 600);
            }
        });
    }

    private handleCombatVictory(): void {
        const cs = this.combatState();
        if (!cs) return;

        this.audio.sound.playFanfare();
        if (this.stage3D) this.stage3D.playMonsterDefeat();

        const mon = cs.monster;
        const lootAwarded: string[] = [];
        if (mon.loot) {
            for (const l of mon.loot) {
                if (Math.random() <= l.chance) {
                    lootAwarded.push(l.item);
                }
            }
        }

        this.gameState.updatePlayerStats((prev) => ({
            ...prev,
            xp: prev.xp + mon.xpReward,
            gold: prev.gold + mon.goldReward,
            consumables: [...prev.consumables, ...lootAwarded]
        }));
        this.gameState.bankCurrentDelveRewards('mid_run');

        this.addCombatLog(`🏆 VICTORY! You vanquished ${mon.name}!`, 'crit');
        this.addCombatLog(`💰 Gained +${mon.xpReward} XP and +${mon.goldReward} Gold!`, 'heal');
        if (lootAwarded.length > 0) {
            this.addCombatLog(`🎁 Loot Acquired: ${lootAwarded.join(', ')}!`, 'crit');
        }
        this.gameState.addLogMessage(
            `🏆 Defeated ${mon.name}! (+${mon.xpReward} XP, +${mon.goldReward} Gold)`,
            'crit'
        );

        const adventureApp = this.gameState.getAdventureApp();
        if (adventureApp) {
            adventureApp.resolveEncounterVisual(cs.encounterId, true);
        }

        this.combatState.set({
            ...cs,
            turn: 'ended',
            outcome: 'victory',
            busy: false
        });
    }

    private handleCombatDefeat(): void {
        const cs = this.combatState();
        if (!cs) return;

        this.audio.sound.playFailure();
        this.gameState.bankCurrentDelveRewards('defeat');
        this.addCombatLog('💀 DEFEATED! Your vision fades as the crypt claims your bones...', 'dmg');

        this.combatState.set({
            ...cs,
            turn: 'ended',
            outcome: 'defeat',
            busy: false
        });
    }

    dismiss(): void {
        const cs = this.combatState();
        this.audio.sound.playSelect();
        const wasDefeat = cs?.outcome === 'defeat';
        if (this.stage3D) this.stage3D.stop();
        this.combatState.set(null);

        if (wasDefeat) {
            const revivedHp = Math.max(2, Math.floor(this.gameState.playerStats().maxHp / 2));
            this.gameState.respawnPlayerAtEntrance(
                `⚠️ Revived at the entrance with ${revivedHp} HP. Be prepared next time!`
            );
        }
    }
}
