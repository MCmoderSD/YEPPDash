import { Component, inject, Signal } from '@angular/core';
import { NotificationService } from '../../services/notification.service';
import { Notification } from '../../data/notification';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
  standalone: false,
})
export class NotificationsComponent {

  private readonly notificationService: NotificationService = inject(NotificationService);

  protected readonly notifications: Signal<Notification[]> = this.notificationService.notifications;

  protected dismiss(id: number): void {
    this.notificationService.dismiss(id);
  }
}