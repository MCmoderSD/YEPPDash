import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  standalone: false,
})
export class FooterComponent {
  // Resolved once when the component is created. On the prerendered landing page that means the
  // build date, everywhere else the date the app was loaded.
  protected readonly year = new Date().getFullYear();
}
