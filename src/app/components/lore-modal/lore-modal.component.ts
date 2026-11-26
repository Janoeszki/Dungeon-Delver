import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { GameStateService } from '../../services/game-state.service';

@Component({
    selector: 'app-lore-modal',
    standalone: true,
    templateUrl: './lore-modal.component.html',
    styleUrl: './lore-modal.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoreModalComponent {
    readonly gameState = inject(GameStateService);
    private readonly audio = inject(AudioService);

    onClose(): void {
        this.audio.sound.playSelect();
        this.gameState.closeLore();
    }

    onBackdropClick(event: MouseEvent): void {
        if (event.target === event.currentTarget) {
            this.onClose();
        }
    }
}
