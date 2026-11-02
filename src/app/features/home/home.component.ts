import {
  Component, HostListener,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { RouterLink } from '@angular/router';

export interface HeroSlide {
  tag:   string;
  title: string;
  desc:  string;
  bg:    string;
  btn1:  string;
  btn2:  string;
}

export interface TripItem {
  c:     string;
  title: string;
  dates: string;
  spots: number;
  rating: string;
  price: string;
  bg:    string;
}

export interface OrganizerItem {
  name:    string;
  trips:   number;
  rating:  string;
  initial: string;
  bg?:     string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl:    './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {

  // ── Slideshow State ────────────────────────────────────────────────────────
  curSlide = 0;
  isPaused = false;
  isHovered = false;
  private pointerStartX: number | null = null;

  // ── Slides Data ───────────────────────────────────────────────────────────
  readonly slides: HeroSlide[] = [
    {
      tag:   'Your next trip · 19 days to go',
      title: 'Siwa Oasis Weekend',
      desc:  'Nov 14 – 17, organized by Sara K. 12 of 15 travelers have joined.',
      bg:    'linear-gradient(160deg,#EADECF,#C89D66 55%,#A87C48)',
      btn1:  'View trip',
      btn2:  'Message organizer',
    },
    {
      tag:   'Only 3 spots left',
      title: 'White Desert Camping',
      desc:  'Dec 5 – 8. Chalk rock formations and a night under the stars. EGP 4,200.',
      bg:    'linear-gradient(160deg,#F4ECE1,#D2C2B0 60%,#A87C48)',
      btn1:  'Book a spot',
      btn2:  'See details',
    },
    {
      tag:   '8 spots left',
      title: 'Sinai Peaks Trek',
      desc:  'Dec 12 – 15. Sunrise summit and Bedouin camps. EGP 3,600.',
      bg:    'linear-gradient(170deg,#D2C2B0,#7A6B61)',
      btn1:  'Book a spot',
      btn2:  'See details',
    },
    {
      tag:   '5 spots left',
      title: 'Dahab Dive Week',
      desc:  'Jan 9 – 16. Certified instructors and reef dives. EGP 7,900.',
      bg:    'linear-gradient(170deg,#CFE0EE,#4A6E8F)',
      btn1:  'Book a spot',
      btn2:  'See details',
    },
  ];

  // ── Boarding Pass Seats ───────────────────────────────────────────────────
  readonly seats: boolean[] = Array.from({ length: 15 }, (_, i) => i < 12);

  // ── Checklist State ───────────────────────────────────────────────────────
  idUploaded  = false;
  uploadLabel = 'Upload ID';
  doneText    = '2 of 3 done';

  // ── Trips Section ─────────────────────────────────────────────────────────
  readonly filters = ['All', 'Desert', 'Mountains', 'Sea'];
  activeFilter = 'All';

  readonly trips: TripItem[] = [
    {
      c:     'Desert',
      title: 'White Desert Camping',
      dates: 'Dec 5 – 8',
      spots: 3,
      rating: '4.9',
      price: '4,200',
      bg:    'linear-gradient(160deg,#EADECF,#C89D66)',
    },
    {
      c:     'Mountains',
      title: 'Sinai Peaks Trek',
      dates: 'Dec 12 – 15',
      spots: 8,
      rating: '4.8',
      price: '3,600',
      bg:    'linear-gradient(160deg,#D2C2B0,#7A6B61)',
    },
    {
      c:     'Sea',
      title: 'Dahab Dive Week',
      dates: 'Jan 9 – 16',
      spots: 5,
      rating: '4.9',
      price: '7,900',
      bg:    'linear-gradient(160deg,#CFE0EE,#4A6E8F)',
    },
    {
      c:     'Desert',
      title: 'Fayoum Weekend',
      dates: 'Dec 19 – 20',
      spots: 10,
      rating: '4.7',
      price: '1,800',
      bg:    'linear-gradient(160deg,#D2C2B0,#A87C48)',
    },
  ];

  savedTrips = new Set<string>();

  get visibleTrips(): TripItem[] {
    return this.activeFilter === 'All'
      ? this.trips
      : this.trips.filter(t => t.c === this.activeFilter);
  }

  // ── Organizers Section ────────────────────────────────────────────────────
  readonly orgs: OrganizerItem[] = [
    { name: 'Sara K.', trips: 24, rating: '4.9', initial: 'SK' },
    { name: 'Omar H.', trips: 17, rating: '4.8', initial: 'OH', bg: 'var(--soft)' },
    { name: 'Nour A.', trips: 31, rating: '4.9', initial: 'NA', bg: 'var(--mid)' },
  ];

  following = new Set<string>();

  constructor(private cdr: ChangeDetectorRef) {}

  // ── Slideshow Controls ────────────────────────────────────────────────────
  go(n: number): void {
    const total = this.slides.length;
    this.curSlide = (n + total) % total;
    this.cdr.markForCheck();
  }

  next(): void {
    this.go(this.curSlide + 1);
  }

  prev(): void {
    this.go(this.curSlide - 1);
  }

  togglePause(): void {
    this.isPaused = !this.isPaused;
    this.cdr.markForCheck();
  }

  onHover(enter: boolean): void {
    this.isHovered = enter;
    this.cdr.markForCheck();
  }

  onAnimationEnd(index: number): void {
    if (index === this.curSlide && !this.isPaused && !this.isHovered) {
      this.next();
    }
  }

  @HostListener('keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') {
      this.next();
    } else if (event.key === 'ArrowLeft') {
      this.prev();
    }
  }

  onPointerDown(e: PointerEvent): void {
    this.pointerStartX = e.clientX;
  }

  onPointerUp(e: PointerEvent): void {
    if (this.pointerStartX !== null) {
      const diff = e.clientX - this.pointerStartX;
      if (Math.abs(diff) > 50) {
        if (diff < 0) {
          this.next();
        } else {
          this.prev();
        }
      }
      this.pointerStartX = null;
    }
  }

  // ── Interactive Features ──────────────────────────────────────────────────
  toggleSave(title: string): void {
    if (this.savedTrips.has(title)) {
      this.savedTrips.delete(title);
    } else {
      this.savedTrips.add(title);
    }
    this.cdr.markForCheck();
  }

  toggleFollow(name: string): void {
    if (this.following.has(name)) {
      this.following.delete(name);
    } else {
      this.following.add(name);
    }
    this.cdr.markForCheck();
  }

  setFilter(filter: string): void {
    this.activeFilter = filter;
    this.cdr.markForCheck();
  }

  uploadId(): void {
    if (this.idUploaded) return;
    this.idUploaded  = true;
    this.uploadLabel = 'All set';
    this.doneText    = '3 of 3 done';
    this.cdr.markForCheck();
  }
}
