import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PuzzleService } from '../../services/puzzle.service';

@Component({
    selector: 'app-puzzle-modal',
    standalone: true,
    templateUrl: './puzzle-modal.component.html',
    styleUrl: './puzzle-modal.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PuzzleModalComponent {
    readonly puzzleService = inject(PuzzleService);

    readonly dirLabels: Record<string, string> = {
        N: '⬆️ North',
        E: '➡️ East',
        S: '⬇️ South',
        W: '⬅️ West'
    };

    readonly runeSlots = computed(() => {
        const def = this.puzzleService.definition();
        const state = this.puzzleService.puzzleState();
        if (!def || def.puzzleType !== 'rune_sequence' || !def.solution || !def.glyphs) return [];
        return def.solution.map((_, idx) => {
            const runeId = state?.sequence[idx];
            const glyph = def.glyphs?.find((g) => g.id === runeId);
            return {
                index: idx,
                filled: Boolean(glyph),
                display: glyph ? glyph.icon : String(idx + 1)
            };
        });
    });

    getStatusBannerClass(): string {
        const kind = this.puzzleService.statusKind();
        if (kind === 'success') return 'puzzle-status-banner success';
        if (kind === 'error') return 'puzzle-status-banner error';
        return 'puzzle-status-banner';
    }
}
