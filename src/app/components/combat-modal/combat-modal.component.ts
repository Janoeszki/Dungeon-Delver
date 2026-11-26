import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    computed,
    effect,
    inject,
    signal,
    untracked,
    viewChild
} from '@angular/core';
import { CombatStage3D } from '../../../../js/combat.js';
import { getStatModifier } from '../../../../js/dice.js';
import { CombatService } from '../../services/combat.service';
import { GameStateService } from '../../services/game-state.service';
import { HeroService } from '../../services/hero.service';
import { ProgressionService } from '../../services/progression.service';

@Component({
    selector: 'app-combat-modal',
    standalone: true,
    templateUrl: './combat-modal.component.html',
    styleUrl: './combat-modal.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CombatModalComponent {
    readonly combat = inject(CombatService);
    readonly gameState = inject(GameStateService);
    readonly progression = inject(ProgressionService);
    private readonly hero = inject(HeroService);
    private readonly destroyRef = inject(DestroyRef);

    readonly viewportRef = viewChild.required<ElementRef<HTMLDivElement>>('combatViewport3D');
    readonly heroCardAnim = signal<boolean>(false);
    readonly enemyCardAnim = signal<boolean>(false);

    readonly turnBadgeClass = computed(() => {
        const cs = this.combat.combatState();
        if (!cs) return 'combat-turn-badge turn-player';
        if (cs.turn === 'enemy' || cs.outcome === 'defeat') return 'combat-turn-badge turn-enemy';
        return 'combat-turn-badge turn-player';
    });

    readonly turnBadgeLabel = computed(() => {
        const cs = this.combat.combatState();
        if (!cs) return 'HERO TURN';
        if (cs.turn === 'player') return 'HERO TURN';
        if (cs.turn === 'enemy') return 'ENEMY TURN';
        if (cs.outcome === 'defeat') return 'DEFEATED';
        return 'VICTORY!';
    });

    readonly attackMods = computed(() => {
        const cs = this.combat.combatState();
        if (!cs) return { strPlusWpn: 0, intPlusWpn: 0 };
        const stats = cs.player.stats;
        const wpnHit = stats.attackBonus || 0;
        return {
            strPlusWpn: getStatModifier(stats.str) + wpnHit,
            intPlusWpn: getStatModifier(stats.int) + wpnHit
        };
    });

    private stage3D: CombatStage3D | null = null;
    private activeEncounterKey: string | null = null;
    private heroShakeTimer: ReturnType<typeof setTimeout> | null = null;
    private enemyShakeTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        effect(() => {
            const cs = this.combat.combatState();
            if (!cs) {
                this.activeEncounterKey = null;
                if (this.stage3D) this.stage3D.stop();
                return;
            }

            const key = `${cs.encounterId}:${cs.monster.id}`;
            if (key !== this.activeEncounterKey) {
                this.activeEncounterKey = key;
                const container = this.viewportRef().nativeElement;
                untracked(() => {
                    if (!this.stage3D) {
                        this.stage3D = new CombatStage3D(container);
                        this.combat.registerStage3D(this.stage3D);
                    }
                    this.stage3D.start(
                        this.hero.heroConfig(),
                        cs.monster.id,
                        cs.monster.scale || 1.0
                    );
                });
            }
        });

        effect(() => {
            const tick = this.combat.heroShakeTick();
            if (tick <= 0) return;
            this.heroCardAnim.set(false);
            if (this.heroShakeTimer) clearTimeout(this.heroShakeTimer);
            setTimeout(() => {
                this.heroCardAnim.set(true);
                this.heroShakeTimer = setTimeout(() => this.heroCardAnim.set(false), 320);
            }, 0);
        });

        effect(() => {
            const tick = this.combat.enemyShakeTick();
            if (tick <= 0) return;
            this.enemyCardAnim.set(false);
            if (this.enemyShakeTimer) clearTimeout(this.enemyShakeTimer);
            setTimeout(() => {
                this.enemyCardAnim.set(true);
                this.enemyShakeTimer = setTimeout(() => this.enemyCardAnim.set(false), 320);
            }, 0);
        });

        this.destroyRef.onDestroy(() => {
            if (this.heroShakeTimer) clearTimeout(this.heroShakeTimer);
            if (this.enemyShakeTimer) clearTimeout(this.enemyShakeTimer);
            this.combat.registerStage3D(null);
            if (this.stage3D) {
                this.stage3D.dispose();
                this.stage3D = null;
            }
        });
    }
}
