import { Component } from '@angular/core';
import {
  RouterOutlet, Router,
  NavigationStart, NavigationEnd, NavigationCancel, NavigationError
} from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title   = 'tribo-webclient';
  loading = false;

  constructor(router: Router) {
    router.events.subscribe(e => {
      if (e instanceof NavigationStart)                                         this.loading = true;
      if (e instanceof NavigationEnd || e instanceof NavigationCancel
                                      || e instanceof NavigationError)         this.loading = false;
    });
  }
}
