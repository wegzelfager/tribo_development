import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';
import { AuthService } from '../../../core/services/auth.service';

type VerifyState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss'
})
export class VerifyEmailComponent implements OnInit {
  state: VerifyState = 'loading';
  message = 'Verifying your email address and creating your account…';
  countdown = 3;
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    const token =
      this.route.snapshot.queryParamMap.get('token') ||
      this.route.snapshot.paramMap.get('token');

    if (!token) {
      this.state = 'error';
      this.message = 'No verification token found in the URL. Please verify your email using the link sent to your inbox.';
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.state = 'success';
          this.message = 'Account verified successfully! Your account is now active.';
          this.startRedirectCountdown();
        });
      },
      error: (err: Error) => {
        this.ngZone.run(() => {
          this.state = 'error';
          this.message = err.message || 'The verification link is invalid or has expired (links expire after 15 minutes).';
        });
      }
    });
  }

  private startRedirectCountdown(): void {
    this.timer = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(this.timer);
        this.router.navigate(['/auth/login']);
      }
    }, 1000);
  }
}
