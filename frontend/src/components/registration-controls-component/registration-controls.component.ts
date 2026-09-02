import { Component, input, InputSignal, output, OutputEmitterRef } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GiveawayStatus } from '../../data/giveaway';

@Component({
  selector: 'app-registration-controls',
  templateUrl: './registration-controls.component.html',
  styleUrl: './registration-controls.component.scss',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
})
export class RegistrationControlsComponent {

  readonly status: InputSignal<GiveawayStatus | null> = input.required<GiveawayStatus | null>();
  readonly busy: InputSignal<boolean> = input<boolean>(false);

  readonly opened: OutputEmitterRef<void> = output<void>();
  readonly closed: OutputEmitterRef<void> = output<void>();
  readonly reset: OutputEmitterRef<void> = output<void>();
}