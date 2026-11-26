import { ChangeDetectionStrategy, Component, HostListener, OnInit, inject } from '@angular/core';
import { AudioService } from './services/audio.service';
import { GameStateService } from './services/game-state.service';
import { PuzzleService } from './services/puzzle.service';
import { HeaderComponent } from './components/header/header.component';
import { TitleScreenComponent } from './components/title-screen/title-screen.component';
import { CharacterForgeComponent } from './components/character-forge/character-forge.component';
import { AdventureScreenComponent } from './components/adventure-screen/adventure-screen.component';
import { VictoryModalComponent } from './components/victory-modal/victory-modal.component';
import { ShopModalComponent } from './components/shop-modal/shop-modal.component';
import { EncounterModalComponent } from './components/encounter-modal/encounter-modal.component';
import { PuzzleModalComponent } from './components/puzzle-modal/puzzle-modal.component';
import { CombatModalComponent } from './components/combat-modal/combat-modal.component';
import { LoreModalComponent } from './components/lore-modal/lore-modal.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        HeaderComponent,
        TitleScreenComponent,
        CharacterForgeComponent,
        AdventureScreenComponent,
        VictoryModalComponent,
        ShopModalComponent,
        EncounterModalComponent,
        PuzzleModalComponent,
        CombatModalComponent,
        LoreModalComponent
    ],
    templateUrl: './app.html',
    styleUrl: './app.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
    private readonly audio = inject(AudioService);
    private readonly gameState = inject(GameStateService);
    private readonly puzzle = inject(PuzzleService);

    ngOnInit(): void {
        this.audio.initAutoplay();
    }

    @HostListener('window:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent): void {
        const tag = typeof document !== 'undefined' && document.activeElement
            ? document.activeElement.tagName
            : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        if (event.key === 'm' || event.key === 'M') {
            this.audio.toggleMusic();
        } else if (event.key === 'Escape') {
            if (this.gameState.shopModalOpen()) {
                this.gameState.closeShop();
            } else if (this.puzzle.isOpen()) {
                this.puzzle.stepBack();
            } else if (this.gameState.loreModalOpen()) {
                this.gameState.closeLore();
            }
        }
    }
}
