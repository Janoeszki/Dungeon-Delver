import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { GameStateService } from '../../services/game-state.service';

@Component({
    selector: 'app-victory-modal',
    standalone: true,
    templateUrl: './victory-modal.component.html',
    styleUrl: './victory-modal.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class VictoryModalComponent {
    readonly gameState = inject(GameStateService);
    private readonly audio = inject(AudioService);

    onDescendFloor2(): void {
        this.audio.sound.playFanfare();
        this.gameState.closeVictoryModal();
        this.gameState.switchToAdventure(2);
    }

    onOpenShop(): void {
        this.audio.sound.playSelect();
        this.gameState.closeVictoryModal();
        this.gameState.openShop('all');
    }

    onPlayAgain(): void {
        this.audio.sound.playFanfare();
        this.gameState.closeVictoryModal();
        this.gameState.switchToAdventure(this.gameState.currentFloor());
    }

    onReturnTitle(): void {
        this.audio.sound.playSelect();
        this.gameState.closeVictoryModal();
        this.gameState.switchToTitle();
    }
}
