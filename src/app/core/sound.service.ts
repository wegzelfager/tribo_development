import { Injectable } from '@angular/core';

type SoundName = 'hover' | 'click' | 'whoosh';

/**
 * SoundService
 * ------------
 * A safe no-op until audio files are placed at src/assets/audio/.
 * Expected files: hover.mp3 | click.mp3 | whoosh.mp3
 * Default state: MUTED. Remembers choice in localStorage.
 */
@Injectable({ providedIn: 'root' })
export class SoundService {

  private sounds = new Map<SoundName, HTMLAudioElement>();
  private _muted = true;
  private _enabled = false; // true once unlocked by user gesture

  readonly STORAGE_KEY = 'tribo_sound_muted';

  constructor() {
    // Restore preference
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored !== null) {
        this._muted = stored === '1';
      }
    } catch { /* localStorage unavailable */ }

    this.load('hover',  'assets/audio/hover.mp3',  0.15);
    this.load('click',  'assets/audio/click.mp3',  0.30);
    this.load('whoosh', 'assets/audio/whoosh.mp3', 0.30);
  }

  get muted(): boolean { return this._muted; }

  toggleMute(): void {
    this._muted = !this._muted;
    try { localStorage.setItem(this.STORAGE_KEY, this._muted ? '1' : '0'); } catch { /* */ }
  }

  /** Must be called inside a user-gesture handler to unlock AudioContext. */
  unlock(): void { this._enabled = true; }

  play(name: SoundName, delayMs = 0): void {
    if (this._muted || !this._enabled) return;
    const el = this.sounds.get(name);
    if (!el) return;
    const doPlay = () => {
      el.currentTime = 0;
      el.play().catch(() => { /* file missing or policy block — safe no-op */ });
    };
    delayMs > 0 ? setTimeout(doPlay, delayMs) : doPlay();
  }

  private load(name: SoundName, src: string, volume: number): void {
    // Silently skip if Audio is unavailable (SSR / test env)
    if (typeof Audio === 'undefined') return;
    const el = new Audio(src);
    el.preload = 'none'; // don't load until first play attempt
    el.volume  = volume;
    this.sounds.set(name, el);
  }
}
