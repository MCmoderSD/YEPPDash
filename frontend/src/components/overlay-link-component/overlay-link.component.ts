import { DOCUMENT } from '@angular/common';
import { Component, inject, input, InputSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-overlay-link',
  templateUrl: './overlay-link.component.html',
  styleUrl: './overlay-link.component.scss',
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  host: {
    '[class.overlay-link-secret]': 'secret()',
  },
})
export class OverlayLinkComponent {

  readonly url: InputSignal<string | null> = input.required<string | null>();

  readonly label: InputSignal<string> = input<string>('Overlay link');
  readonly secret: InputSignal<boolean> = input<boolean>(false);

  private readonly notifications: NotificationService = inject(NotificationService);

  private readonly document: Document = inject(DOCUMENT);

  protected async copy(link: string): Promise<void> {
    const clipboard: Clipboard | undefined = this.document.defaultView?.navigator?.clipboard;

    if (!clipboard) {
      this.notifications.failure('This browser will not let the page copy for you — select the link instead.');
      return;
    }

    try {
      await clipboard.writeText(link);
      this.notifications.success('Overlay link copied.');
    } catch {
      this.notifications.failure('Could not copy the overlay link.');
    }
  }
}