import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { EncounterService } from '../../services/encounter.service';

@Component({
    selector: 'app-encounter-modal',
    standalone: true,
    templateUrl: './encounter-modal.component.html',
    styleUrl: './encounter-modal.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EncounterModalComponent {
    readonly encounterService = inject(EncounterService);
}
