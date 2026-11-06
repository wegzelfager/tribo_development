import { Component } from '@angular/core';
import {
  RouterOutlet, Router,
  NavigationStart, NavigationEnd, NavigationCancel, NavigationError
} from '@angular/router';
import { I18nService } from './core/services/i18n.service';

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

  constructor(router: Router, i18n: I18nService) {
    // Boot i18n: reads localStorage / browser lang, sets <html lang dir>
    i18n.init();

    router.events.subscribe(e => {
      if (e instanceof NavigationStart)                                         this.loading = true;
      if (e instanceof NavigationEnd || e instanceof NavigationCancel
                                      || e instanceof NavigationError)         this.loading = false;
    });
  }
}
