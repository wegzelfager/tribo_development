import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  injectAdminUserDetailQuery,
  injectToggleBlockMutation,
  injectToggleVerifyMutation,
} from '../../../../../core/queries/admin.queries';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './user-detail.component.html',
  styleUrl: './user-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly userId = signal<string | null>(
    this.route.snapshot.paramMap.get('id')
  );

  userQuery = injectAdminUserDetailQuery(() => this.userId());
  blockMutation = injectToggleBlockMutation();
  verifyMutation = injectToggleVerifyMutation();

  user = computed(() => this.userQuery.data());
  isLoading = computed(() => this.userQuery.isLoading());
  isError = computed(() => this.userQuery.isError());

  idCardFront = computed(() => this.user()?.idCard?.frontImage ?? null);
  idCardBack  = computed(() => this.user()?.idCard?.backImage  ?? null);
  idCardVerified = computed(() => this.user()?.idCard?.isVerified ?? false);

  toggleBlock(): void {
    const id = this.userId();
    if (id) this.blockMutation.mutate(id);
  }

  toggleVerify(): void {
    const id = this.userId();
    if (id) this.verifyMutation.mutate(id);
  }

  goBack(): void {
    this.router.navigate(['/admin/users']);
  }

  roleBadgeClass(role: string): string {
    if (role === 'organizer') return 'badge badge--organizer';
    if (role === 'admin') return 'badge badge--admin';
    return 'badge badge--traveller';
  }
}
