import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

// ── Icons (24x24 stroke paths, rendered in the template) ─────────────────────
const ICONS = {
  home:     'M3 11.5L12 4l9 7.5M5.5 10V20h13V10M10 20v-5h4v5',
  compass:  'M12 21a9 9 0 100-18 9 9 0 000 18zM15.5 8.5l-2 5-5 2 2-5z',
  luggage:  'M8 7V4.5h8V7M6 7h12a1 1 0 011 1v11a1 1 0 01-1 1H6a1 1 0 01-1-1V8a1 1 0 011-1zM9 11v6M15 11v6',
  user:     'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20.5c.8-3.6 3.6-5.5 7.5-5.5s6.7 1.9 7.5 5.5',
  bell:     'M6 16.5V11a6 6 0 1112 0v5.5l1.5 2h-15zM10 21h4',
  star:     'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z',
  heart:    'M12 20s-8-5-8-10.5A4.5 4.5 0 0112 7a4.5 4.5 0 018 2.5C20 15 12 20 12 20z',
  pin:      'M12 21s6.5-5.6 6.5-11a6.5 6.5 0 10-13 0C5.5 15.4 12 21 12 21zM12 12.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4z',
  calendar: 'M5 6.5h14a1 1 0 011 1V19a1 1 0 01-1 1H5a1 1 0 01-1-1V7.5a1 1 0 011-1zM4 10.5h16M8 4v4M16 4v4',
  arrow:    'M5 12h14M13 6l6 6-6 6',
  prev:     'M15 5l-7 7 7 7',
  next:     'M9 5l7 7-7 7',
  pause:    'M8 5v14M16 5v14',
  play:     'M8 5l11 7-11 7z',
} as const;

type IconName = keyof typeof ICONS;
type Category = 'Desert' | 'Wadi' | 'Mountain';

export interface NavItem   { label: string; route: string; icon: IconName; active?: boolean; }
export interface HeroSlide { tag: string; title: string; desc: string; cta: string; bg: string; img?: string; }
export interface Trip {
  id: number;
  cat: Category;
  title: string;
  location: string;
  tag: string;
  rating: string;
  days: number;
  dates: string;
  price: number;
  bg: string;
  img?: string;   // photo path; the gradient in `bg` shows underneath until it loads (or if it is missing)
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  readonly icons = ICONS;

  // ── Header ────────────────────────────────────────────────────────────────
  readonly user = { name: 'Yossif', avatar: '' };   // set avatar to an image URL to show a photo

  readonly greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
  })();

  readonly nav: NavItem[] = [
    { label: 'Home',    route: '/home',    icon: 'home', active: true },
    { label: 'Explore', route: '/explore', icon: 'compass' },
    { label: 'Trips',   route: '/trips',   icon: 'luggage' },
    { label: 'Profile', route: '/profile', icon: 'user' },
  ];

  // ── Hero carousel ─────────────────────────────────────────────────────────
  curSlide = 0;
  isPaused = false;
  isHovered = false;
  private pointerStartX: number | null = null;

  readonly slides: HeroSlide[] = [
    {
      tag:   'Desert Adventures',
      title: 'Explore the Untamed Beauty',
      desc:  'Your next adventure starts in the desert.',
      cta:   'Explore Trips',
      bg:    'linear-gradient(160deg,#DCD8CF,#9AA394 55%,#4F5C4F)',
      img:   'assets/hero/desert.jpg',
    },
    {
      tag:   'Wadi Escapes',
      title: 'Camp Where the Sky Goes On Forever',
      desc:  '4x4 quests and nights under the stars in Wadi Rum.',
      cta:   'Explore Trips',
      bg:    'linear-gradient(160deg,#EADECF,#C89D66 55%,#A87C48)',
      img:   'assets/hero/wadi.jpg',
    },
    {
      tag:   'Mountain Treks',
      title: 'Chase the Sunrise from the Summit',
      desc:  'Guided treks with local Bedouin hosts.',
      cta:   'Explore Trips',
      bg:    'linear-gradient(170deg,#D2C2B0,#7A6B61)',
      img:   'assets/hero/mountain.jpg',
    },
    {
      tag:   'Sea Getaways',
      title: 'Dive into Crystal Waters',
      desc:  'Reef dives with certified instructors in Dahab.',
      cta:   'Explore Trips',
      bg:    'linear-gradient(170deg,#CFE0EE,#4A6E8F)',
      img:   'assets/hero/sea.jpg',
    },
  ];

  go(n: number): void {
    const total = this.slides.length;
    this.curSlide = (n + total) % total;
  }
  next(): void { this.go(this.curSlide + 1); }
  prev(): void { this.go(this.curSlide - 1); }

  togglePause(): void { this.isPaused = !this.isPaused; }
  onHover(enter: boolean): void { this.isHovered = enter; }

  // The progress fill on the active dot drives autoplay: when it ends, move on.
  onAnimationEnd(index: number): void {
    if (index === this.curSlide && !this.isPaused && !this.isHovered) this.next();
  }

  onPointerDown(e: PointerEvent): void { this.pointerStartX = e.clientX; }

  onPointerUp(e: PointerEvent): void {
    if (this.pointerStartX === null) return;
    const diff = e.clientX - this.pointerStartX;
    this.pointerStartX = null;
    if (Math.abs(diff) > 50) diff < 0 ? this.next() : this.prev();
  }

  // ── Trips ─────────────────────────────────────────────────────────────────
  readonly filters: ('All' | Category)[] = ['All', 'Desert', 'Wadi', 'Mountain'];
  activeFilter: 'All' | Category = 'All';
  savedTrips = new Set<number>();

  readonly trips: Trip[] = [
    { id: 1, cat: 'Desert',   title: 'Sahara Grand Traverse', location: 'Merzouga, Morocco', tag: 'Best Seller',    rating: '4.9', days: 10, dates: '11 Nov – 19 Nov 2026', price: 1200, bg: 'linear-gradient(160deg,#DCD8CF,#9AA394 55%,#4F5C4F)', img: 'assets/trips/sahara.jpg' },
    { id: 2, cat: 'Wadi',     title: 'Wadi Rum 4x4 Quest',    location: 'Wadi Rum, Jordan',  tag: 'Top Rated',      rating: '4.8', days: 8,  dates: '11 Nov – 19 Nov 2026', price: 1440, bg: 'linear-gradient(160deg,#EADECF,#C89D66 55%,#7A5A3A)', img: 'assets/trips/wadi-rum.jpg' },
    { id: 3, cat: 'Desert',   title: 'Siwa Oasis Weekend',    location: 'Siwa, Egypt',       tag: 'Few Spots Left', rating: '4.9', days: 4,  dates: '14 Nov – 17 Nov 2026', price: 320,  bg: 'linear-gradient(160deg,#F4ECE1,#D2C2B0 60%,#A87C48)', img: 'assets/trips/siwa.jpg' },
    { id: 4, cat: 'Mountain', title: 'Sinai Peaks Trek',      location: 'Mount Sinai, Egypt', tag: 'New',           rating: '4.8', days: 4,  dates: '12 Dec – 15 Dec 2026', price: 280,  bg: 'linear-gradient(170deg,#D2C2B0,#7A6B61)',              img: 'assets/trips/sinai.jpg' },
    { id: 5, cat: 'Desert',   title: 'White Desert Camping',  location: 'Farafra, Egypt',    tag: 'Top Rated',      rating: '4.9', days: 4,  dates: '5 Dec – 8 Dec 2026',   price: 330,  bg: 'linear-gradient(160deg,#F4ECE1,#C9BBA8 60%,#8A7C70)', img: 'assets/trips/white-desert.jpg' },
    { id: 6, cat: 'Mountain', title: 'Atlas Highlands Trek',  location: 'Toubkal, Morocco',  tag: 'New',            rating: '4.7', days: 6,  dates: '2 Jan – 8 Jan 2027',   price: 890,  bg: 'linear-gradient(170deg,#CFD6D0,#6E7F76)',              img: 'assets/trips/atlas.jpg' },
  ];

  get recommended(): Trip[] {
    return this.trips.slice(0, 4);
  }

  get visibleTrips(): Trip[] {
    return this.activeFilter === 'All' ? this.trips : this.trips.filter(t => t.cat === this.activeFilter);
  }

  setFilter(f: 'All' | Category): void { this.activeFilter = f; }

  toggleSave(id: number): void {
    this.savedTrips.has(id) ? this.savedTrips.delete(id) : this.savedTrips.add(id);
  }

  /** Photo on top, with the gradient as a fallback layer underneath (shows if the image is missing). */
  bgOf(x: { bg: string; img?: string }): string {
    return x.img ? `url(${x.img}) center / cover no-repeat, ${x.bg}` : x.bg;
  }
}