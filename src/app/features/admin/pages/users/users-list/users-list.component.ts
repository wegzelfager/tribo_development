import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  injectAdminUsersQuery,
  injectToggleBlockMutation,
  injectToggleVerifyMutation,
} from '../../../../../core/queries/admin.queries';
import { AdminUserFilterParams } from '../../../../../core/models/admin.model';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users-list.component.html',
  styleUrl: './users-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersListComponent {
  private readonly router = inject(Router);

  // ── Filter State ──
  searchQuery = signal('');
  roleFilter = signal<AdminUserFilterParams['role']>('');
  verifiedFilter = signal<'' | 'true' | 'false'>('');
  currentPage = signal(1);
  readonly limit = 10;

  // ── Params accessor for TanStack Query ──
  private params = computed<AdminUserFilterParams>(() => ({
    page: this.currentPage(),
    limit: this.limit,
    search: this.searchQuery() || undefined,
    role: this.roleFilter() || undefined,
    isVerified:
      this.verifiedFilter() === '' ? undefined : this.verifiedFilter() === 'true',
  }));

  // ── Queries & Mutations ──
  usersQuery = injectAdminUsersQuery(() => this.params());
  blockMutation = injectToggleBlockMutation();
  verifyMutation = injectToggleVerifyMutation();

  // ── Computed ──
  users = computed(() => this.usersQuery.data()?.users ?? []);
  pagination = computed(() => this.usersQuery.data()?.pagination);
  isLoading = computed(() => this.usersQuery.isLoading());
  isError = computed(() => this.usersQuery.isError());
  totalPages = computed(() => this.pagination()?.totalPages ?? 1);

  // ── Handlers ──
  onSearch(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
  }

  onRoleChange(value: string): void {
    this.roleFilter.set(value as AdminUserFilterParams['role']);
    this.currentPage.set(1);
  }

  onVerifiedChange(value: string): void {
    this.verifiedFilter.set(value as '' | 'true' | 'false');
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
  }

  viewUser(id: string): void {
    this.router.navigate(['/admin/users', id]);
  }

  toggleBlock(event: Event, userId: string): void {
    event.stopPropagation();
    this.blockMutation.mutate(userId);
  }

  toggleVerify(event: Event, userId: string): void {
    event.stopPropagation();
    this.verifyMutation.mutate(userId);
  }

  roleBadgeClass(role: string): string {
    if (role === 'organizer') return 'badge badge--organizer';
    if (role === 'admin') return 'badge badge--admin';
    return 'badge badge--traveller';
  }

  pagesArray(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }
}
