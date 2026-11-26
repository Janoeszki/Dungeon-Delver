import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { GameStateService } from '../../services/game-state.service';
import { HeroService } from '../../services/hero.service';
import { ProgressionService } from '../../services/progression.service';

@Component({
    selector: 'app-header',
    standalone: true,
    templateUrl: './header.component.html',
    styleUrl: './header.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
    readonly gameState = inject(GameStateService);
    readonly progression = inject(ProgressionService);
    readonly audio = inject(AudioService);
    private readonly hero = inject(HeroService);

    onReturnTitle(): void {
        this.audio.sound.playSelect();
        this.gameState.switchToTitle();
    }

    onOpenShop(): void {
        this.audio.sound.playSelect();
        this.gameState.openShop('all');
    }

    onToggleMusic(): void {
        this.audio.toggleMusic();
    }

    onToggleSfx(): void {
        this.audio.toggleSfx();
    }

    onSwitchToForge(): void {
        this.audio.sound.playSelect();
        this.gameState.switchToCreator();
    }

    onRandomize(): void {
        this.hero.randomizeHero();
    }
}
