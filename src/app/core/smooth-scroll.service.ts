import { Injectable } from '@angular/core';

interface LenisInstance {
  scrollTo(target: number, opts?: Record<string, unknown>): void;
}

/**
 * SmoothScrollService
 * -------------------
 * A thin bridge so any component can call scrollTo() regardless of whether
 * Lenis is running.  LandingComponent is the sole owner of the Lenis instance;
 * it registers/unregisters it here so the ProcessShowcaseComponent never
 * needs to create a second instance.
 */
@Injectable({ providedIn: 'root' })
export class SmoothScrollService {

  private lenis?: LenisInstance;

  /** Called by LandingComponent once Lenis is ready. */
  register(lenis: LenisInstance): void {
    this.lenis = lenis;
  }

  /** Called in LandingComponent.ngOnDestroy(). */
  unregister(): void {
    this.lenis = undefined;
  }

  /**
   * Scroll to an absolute Y position.
   * Falls back to native window.scrollTo when Lenis is not registered.
   */
  scrollTo(y: number, opts: Record<string, unknown> = {}): void {
    if (this.lenis) {
      this.lenis.scrollTo(y, opts);
    } else {
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }
}
