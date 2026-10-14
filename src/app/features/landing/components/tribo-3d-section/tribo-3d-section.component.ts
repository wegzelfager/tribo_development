/**
 * Tribo3dSectionComponent — Angular wrapper for the scroll-driven Three.js
 * flight story. All Three.js logic runs outside Angular zone; cleaned up fully
 * in ngOnDestroy. CSS is fully scoped via the .t3d- prefix — no global leakage.
 */

import {
  Component, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, NgZone,
  PLATFORM_ID, Inject, ChangeDetectionStrategy
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SmoothScrollService } from '../../../../core/smooth-scroll.service';

// Three.js — installed via npm, no CDN
import * as THREE from 'three';
import { GLTFLoader }      from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader }     from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/* ─── scroll pace & leash constants ───────────────────────────────────────── */
export const MIN_SECONDS_PER_BEAT = 3;     // fastest any beat may play (s)
export const LEAD_BEATS           = 0.25;  // real scroll lead on desktop (beats)
export const LEAD_BEATS_TOUCH     = 0.60;  // touch momentum tolerance on mobile (beats)

/* ─── tiny math helpers (same as the standalone page) ─────────────────────── */
const cl  = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
const lr  = (a: number, b: number, t: number) => a + (b - a) * t;
const ez  = (x: number) => x * x * (3 - 2 * x);
const rad = (d: number) => d * Math.PI / 180;
const mx  = (a: number[], b: number[], g: number) => a.map((v, i) => lr(v, b[i], g));
const win = (s: number, a: number, b: number) => ez(cl((s - a) / (b - a), 0, 1));
const kf  = (t: number, k: [number, number][]) => {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i][0]) {
      const [ta, va] = k[i - 1], [tb, vb] = k[i];
      return lr(va, vb, ez((t - ta) / (tb - ta)));
    }
  }
  return k[k.length - 1][1];
};

/* ─── story beats ──────────────────────────────────────────────────────────── */
interface Beat {
  k: string; t: string; g: string;
  bg: number[]; ink: number[];
  d: string;
  cam: { orbit: number; elev: number; dist: number };
}
const BEATS: Beat[] = [
  { k:'01 / 05', t:'Private Fleet',   g:'SOVEREIGN', bg:[13,27,75],   ink:[250,247,242],
    d:'On-demand access to a curated fleet of private jets and helicopters — ready to lift off within hours.',
    cam:{ orbit:60,  elev:7,  dist:9 } },
  { k:'02 / 05', t:'Global Network',  g:'INFINITE',  bg:[9,110,125],  ink:[250,247,242],
    d:'B2B partners and C2C experiences across 120+ countries. Every operator is verified, rated, and insured.',
    cam:{ orbit:78,  elev:12, dist:15.5 } },
  { k:'03 / 05', t:'Above The World', g:'ALTITUDE',  bg:[17,10,45],   ink:[250,247,242],
    d:'At 51,000 ft, above turbulence and crowds — a cabin calibrated for absolute calm.',
    cam:{ orbit:0,   elev:80, dist:11 } },
  { k:'04 / 05', t:'AI Itinerary',    g:'PRECISION', bg:[168,72,15],  ink:[250,247,242],
    d:'Our proprietary AI orchestrates every touchpoint — transfers, concierge, climate. Nothing left to chance.',
    cam:{ orbit:168, elev:13, dist:9.5 } },
  { k:'05 / 05', t:'Secure Escrow',   g:'PROTECTED', bg:[10,10,14],   ink:[250,247,242],
    d:'Every transaction held in full escrow until service delivery is confirmed. Zero financial risk.',
    cam:{ orbit:322, elev:14, dist:10 } },
];
const N = BEATS.length;
export const MAX_SPEED = 1 / (N * MIN_SECONDS_PER_BEAT); // progress units/s (1/15)

@Component({
  selector: 'app-tribo-3d-section',
  standalone: true,
  templateUrl: './tribo-3d-section.component.html',
  styleUrl:    './tribo-3d-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tribo3dSectionComponent implements AfterViewInit, OnDestroy {

  /* ── template refs ─────────────────────────────────────────────────────── */
  @ViewChild('loaderEl')   private loaderEl!:  ElementRef<HTMLDivElement>;
  @ViewChild('loaderBar')  private loaderBar!: ElementRef<HTMLDivElement>;
  @ViewChild('loaderPct')  private loaderPct!: ElementRef<HTMLDivElement>;
  @ViewChild('loaderErr')  private loaderErr!: ElementRef<HTMLDivElement>;
  @ViewChild('wrapEl')     private wrapEl!:    ElementRef<HTMLDivElement>;
  @ViewChild('stageEl')    private stageEl!:   ElementRef<HTMLElement>;
  @ViewChild('canvasWrap') private canvasWrap!:ElementRef<HTMLDivElement>;
  @ViewChild('ghostEl')    private ghostEl!:   ElementRef<HTMLDivElement>;
  @ViewChild('ghostT')     private ghostT!:    ElementRef<HTMLSpanElement>;
  @ViewChild('beatK')      private beatK!:     ElementRef<HTMLSpanElement>;
  @ViewChild('beatH')      private beatH!:     ElementRef<HTMLHeadingElement>;
  @ViewChild('beatD')      private beatD!:     ElementRef<HTMLParagraphElement>;
  @ViewChild('ttlEl')      private ttlEl!:     ElementRef<HTMLDivElement>;
  @ViewChild('dotsNav')    private dotsNav!:   ElementRef<HTMLElement>;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private ngZone: NgZone,
    private smoothScroll: SmoothScrollService,
  ) {}

  /* scroll leash & pace state */
  private isClamping = false;
  private navTargetProgress: number | null = null;
  private cancelNavTarget = () => {
    this.navTargetProgress = null;
  };

  /* ── Three.js state ────────────────────────────────────────────────────── */
  private renderer!:    THREE.WebGLRenderer;
  private scene!:       THREE.Scene;
  private camera!:      THREE.PerspectiveCamera;
  private keyLight!:    THREE.DirectionalLight;
  private rimLight!:    THREE.DirectionalLight;
  private shadowMat!:   THREE.ShadowMaterial;
  private shadowMesh!:  THREE.Mesh;
  private rig!:         THREE.Group;
  private modelGroup:   THREE.Group | null = null;
  private mixer:        THREE.AnimationMixer | null = null;
  private hasAnims = false;
  private modelBytes = 0;
  private restY = 0.5;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private world: any = null;

  /* reusable math objects */
  private readonly P       = new THREE.Vector3();
  private readonly F       = new THREE.Vector3(0, 0, 1);
  private readonly UP      = new THREE.Vector3(0, 1, 0);
  private readonly T2      = new THREE.Vector3();
  private readonly TMP     = new THREE.Vector3();
  private readonly ZERO    = new THREE.Vector3();
  private readonly Z_AXIS  = new THREE.Vector3(0, 0, 1);
  private readonly M4      = new THREE.Matrix4();
  private readonly QR      = new THREE.Quaternion();
  private readonly focus      = new THREE.Vector3();
  private readonly tgtFocus   = new THREE.Vector3();
  private readonly KEY_OFF    = new THREE.Vector3(-6, 10, 8);
  private readonly GOLD       = new THREE.Color(0xF6E2A8);
  private focusInit = false;

  /* scroll + camera */
  private tgt = 0; private cur = 0;
  private camOrbit = 60; private camElev = 7; private camDist = 9;
  private lastNow  = 0;
  private rafId    = 0;
  private activeIdx = -1;

  /* ?nose= debug param */
  private NOSE_YAW = 0;

  /* cleanup refs */
  private btns:           HTMLButtonElement[] = [];
  private labEls:         HTMLDivElement[]    = [];
  private scrollHandler!: () => void;
  private resizeObs?:     ResizeObserver;
  private intersObs?:     IntersectionObserver;
  private reducedMQ?:     MediaQueryList;
  private reducedHandler!: (e: MediaQueryListEvent) => void;
  private reduced = false;

  /* ── lifecycle ──────────────────────────────────────────────────────────── */
  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.ngZone.runOutsideAngular(() => this.init());
  }

  ngOnDestroy(): void {
    this.destroy();
  }

  /* ── init ──────────────────────────────────────────────────────────────── */
  private init(): void {
    /* reduced-motion */
    this.reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced = this.reducedMQ.matches;
    this.reducedHandler = (e: MediaQueryListEvent) => { this.reduced = e.matches; };
    this.reducedMQ.addEventListener('change', this.reducedHandler);

    /* ?nose= param */
    const nose = new URLSearchParams(location.search).get('nose') || '+z';
    const noseMap: Record<string, number> = { '+z': 0, '-z': Math.PI, '+x': -Math.PI / 2, '-x': Math.PI / 2 };
    this.NOSE_YAW = noseMap[nose] ?? 0;

    this.buildDots();
    this.initThree();
    this.initScrollAndResize();
    this.loadModel();
  }

  /* ── renderer + scene + lights ─────────────────────────────────────────── */
  private initThree(): void {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvasWrap.nativeElement.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);
    this.camera.position.set(0, 2, 10);

    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
    pmrem.dispose();

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    const kl = new THREE.DirectionalLight(0xfaf0e0, 2.6);
    kl.castShadow = true;
    kl.shadow.mapSize.set(1024, 1024);
    kl.shadow.camera.near = 0.5; kl.shadow.camera.far = 60;
    kl.shadow.camera.left = kl.shadow.camera.bottom = -8;
    kl.shadow.camera.right = kl.shadow.camera.top = 8;
    kl.shadow.bias = -0.001;
    this.keyLight = kl;
    this.scene.add(kl, kl.target);

    this.rimLight = new THREE.DirectionalLight(0xC9A24A, 0);
    this.rimLight.position.set(8, 3, -10);
    this.scene.add(this.rimLight);

    const fl = new THREE.DirectionalLight(0x8ab4c8, 0.5);
    fl.position.set(4, -4, 6);
    this.scene.add(fl);

    this.shadowMat  = new THREE.ShadowMaterial({ opacity: 0.30, transparent: true });
    this.shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), this.shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = 0.01;
    this.shadowMesh.receiveShadow = true;
    this.scene.add(this.shadowMesh);

    this.rig = new THREE.Group();

    this.onResize();
  }

  /* ── scroll / resize wiring ─────────────────────────────────────────────── */
  private getLeadBeats(): number {
    if (typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0))) {
      return LEAD_BEATS_TOUCH;
    }
    return LEAD_BEATS;
  }

  private checkScrollLeash(): void {
    if (this.reduced || this.isClamping) return;

    const span = this.scrollSpan();
    const wrapEl = this.wrapEl.nativeElement;
    const wrapTop = wrapEl.getBoundingClientRect().top + window.scrollY;
    const scrollY = window.scrollY;

    const lead = this.getLeadBeats() / N;
    const tolerancePx = lead * span;
    const planeScroll = wrapTop + this.cur * span;
    const minAllowed = planeScroll - tolerancePx;
    const maxAllowed = planeScroll + tolerancePx;

    const inStickyZone = scrollY >= wrapTop && scrollY <= wrapTop + span;
    const leavePastEnd = scrollY > wrapTop + span && this.cur < 0.99;
    const leavePastStart = scrollY < wrapTop && this.cur > 0.01;

    if (inStickyZone || leavePastEnd || leavePastStart) {
      let clampedY = scrollY;
      if (scrollY < minAllowed) {
        clampedY = minAllowed;
      } else if (scrollY > maxAllowed) {
        clampedY = maxAllowed;
      }

      if (Math.abs(clampedY - scrollY) > 1) {
        this.isClamping = true;
        this.smoothScroll.scrollTo(clampedY, { immediate: true });
        window.scrollTo({ top: clampedY, behavior: 'instant' });
        this.isClamping = false;
      }
    }
  }

  private handleScroll = (): void => {
    if (this.isClamping) return;

    if (this.navTargetProgress !== null) {
      this.cancelNavTarget();
    }

    this.checkScrollLeash();
    this.tgt = this.getScrollProgress();
  };

  private initScrollAndResize(): void {
    this.scrollHandler = this.handleScroll;
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('wheel', this.cancelNavTarget, { passive: true });
    window.addEventListener('touchstart', this.cancelNavTarget, { passive: true });
    window.addEventListener('keydown', this.cancelNavTarget, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(() => this.onResize());
      this.resizeObs.observe(this.stageEl.nativeElement);
    } else {
      (window as Window).addEventListener('resize', () => this.onResize());
    }

    if ('IntersectionObserver' in window) {
      this.intersObs = new IntersectionObserver(entries => {
        if (!this.modelGroup) return;
        if (entries[0].isIntersecting) {
          this.tgt = this.getScrollProgress();
          this.cur = this.tgt;
          this.startLoop();
        } else {
          this.stopLoop();
        }
      }, { threshold: 0 });
      this.intersObs.observe(this.wrapEl.nativeElement);
    }
  }

  private onResize(): void {
    const w = this.canvasWrap.nativeElement.clientWidth  || window.innerWidth;
    const h = this.canvasWrap.nativeElement.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fitGhost();
  }

  /* ── ghost word sizing ─────────────────────────────────────────────────── */
  private fitGhost(): void {
    const vw = this.stageEl.nativeElement.clientWidth  || window.innerWidth;
    const vh = this.stageEl.nativeElement.clientHeight || window.innerHeight;
    const span = this.ghostT.nativeElement;
    const ghost = this.ghostEl.nativeElement;
    ghost.style.fontSize = '100px';
    const w100 = span.getBoundingClientRect().width;
    if (!w100) return;
    ghost.style.fontSize = Math.min(
      (vw * 0.94 / w100) * 100,
      vh * (vw < 900 ? 0.26 : 0.30)
    ).toFixed(1) + 'px';
  }

  /* ── dot nav ────────────────────────────────────────────────────────────── */
  private buildDots(): void {
    const nav = this.dotsNav.nativeElement;
    BEATS.forEach((b, i) => {
      const bt = document.createElement('button');
      bt.type = 'button';
      bt.setAttribute('aria-label', `Go to ${b.t}`);
      bt.setAttribute('aria-current', 'false');
      bt.className = 't3d-dot-btn';
      bt.innerHTML = '<i></i>';
      bt.addEventListener('click', () => {
        const targetP = cl((i + 0.5) / N, 0, 1);
        if (this.reduced) {
          const span = this.scrollSpan();
          const wrapTop = this.wrapEl.nativeElement.getBoundingClientRect().top + window.scrollY;
          const top = wrapTop + targetP * span;
          this.smoothScroll.scrollTo(top, { immediate: true });
          window.scrollTo({ top, behavior: 'auto' });
          this.tgt = targetP;
          this.cur = targetP;
        } else {
          this.navTargetProgress = targetP;
        }
      });
      nav.appendChild(bt);
      this.btns.push(bt as HTMLButtonElement);
    });
  }

  /* ── beat copy ──────────────────────────────────────────────────────────── */
  private setIdx(i: number): void {
    if (i === this.activeIdx) return;
    this.activeIdx = i;
    const b = BEATS[i];
    this.beatK.nativeElement.textContent = b.k;
    this.beatH.nativeElement.textContent = b.t;
    this.beatD.nativeElement.textContent = b.d;
    this.ghostT.nativeElement.textContent = b.g;
    this.fitGhost();
    this.btns.forEach((btn, j) =>
      btn.setAttribute('aria-current', j === i ? 'true' : 'false'));
    [this.ttlEl, this.beatD, this.ghostEl].forEach(ref => {
      const el = ref.nativeElement;
      el.classList.remove('t3d-anim-in');
      void el.offsetWidth; // force reflow
      el.classList.add('t3d-anim-in');
    });
  }

  /* ── scroll helpers ─────────────────────────────────────────────────────── */
  private scrollSpan(): number {
    return Math.max(1,
      this.wrapEl.nativeElement.offsetHeight -
      this.stageEl.nativeElement.offsetHeight);
  }

  private getScrollProgress(): number {
    return cl(
      -this.wrapEl.nativeElement.getBoundingClientRect().top / this.scrollSpan(),
      0, 1
    );
  }

  /* ── fade helper for prop groups ────────────────────────────────────────── */
  private fade(obj: THREE.Object3D, alpha: number): void {
    obj.visible = alpha > 0.01;
    if (!obj.visible) return;
    obj.traverse(n => {
      const mesh = n as THREE.Mesh;
      const mat  = mesh.material as THREE.Material & {
        uniforms?: { uA: { value: number } };
        opacity?: number;
        transparent?: boolean;
        userData: { b?: number };
      };
      if (!mat) return;
      if (mat.uniforms) { mat.uniforms['uA'].value = alpha; return; }
      mat.transparent = true;
      mat.userData['b'] ??= mat.opacity ?? 1;
      mat.opacity = (mat.userData['b'] as number) * alpha;
    });
  }

  /* ── world setup (runway, globe, clouds, gates, shield) ─────────────────── */
  private setupWorld(): void {
    const scene = this.scene;
    const restY = this.restY;
    const stage = this.stageEl.nativeElement;
    const W: Record<string, any> = { R: 2.9 };
    const RG = 2.15;
    const E0 = new THREE.Vector3(0, restY + 3, 16);
    W['E0'] = E0;
    W['C1'] = E0.clone().setY(E0.y - W['R']);
    W['E2'] = new THREE.Vector3(0, restY + 6.5, E0.z + 30);
    const pp = [[0,0,0],[0,0,6],[4,.8,14],[-3.5,-.6,23],[3.5,.8,32],[0,0,39],[0,0,44]]
      .map(([x,y,z]) => new THREE.Vector3(W['E2'].x + x, W['E2'].y + y, W['E2'].z + z));
    W['path'] = new THREE.CatmullRomCurve3(pp, false, 'centripetal');
    W['E3'] = pp[6];
    W['E4'] = new THREE.Vector3(0, restY, pp[6].z + 40);

    /* Runway */
    const L = W['E4'].z + 100, z0 = -40, runN = Math.floor(L / 6);
    const run = new THREE.Group();
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(8, L),
      new THREE.MeshStandardMaterial({ color: 0x15161c, roughness: .85, metalness: .1 })
    );
    strip.rotation.x = -Math.PI / 2; strip.position.set(0, 0, z0 + L / 2);
    const dash = new THREE.InstancedMesh(
      new THREE.BoxGeometry(.25, .02, 2.2),
      new THREE.MeshBasicMaterial({ color: 0xFAF7F2 }), runN);
    const lamp = new THREE.InstancedMesh(
      new THREE.SphereGeometry(.09, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xF6E2A8 }), runN * 2);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < runN; i++) {
      const z = z0 + i * 6;
      dash.setMatrixAt(i, m4.makeTranslation(0, .02, z));
      lamp.setMatrixAt(i*2,   m4.makeTranslation(-4.1, .09, z));
      lamp.setMatrixAt(i*2+1, m4.makeTranslation( 4.1, .09, z));
    }
    run.add(strip, dash, lamp); scene.add(run); W['run'] = run;

    /* Globe */
    const ll = (lat: number, lon: number, r: number) => {
      const a = rad(lat), o = rad(lon);
      return new THREE.Vector3(Math.cos(a)*Math.sin(o)*r, Math.sin(a)*r, Math.cos(a)*Math.cos(o)*r);
    };
    type City = [number, number];
    const CITY: Record<string, City> = {
      cai:[30,31], lon:[51.5,0], nyc:[40.7,-74], dxb:[25.2,55.3],
      sin:[1.3,103.8], tok:[35.7,139.7], syd:[-33.9,151.2],
      cpt:[-33.9,18.4], sao:[-23.5,-46.6], lax:[34,-118]
    };
    const globe = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(RG-.03, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x053a44, transparent: true, opacity: .92 })
    );
    const dots = new Float32Array(2400 * 3);
    for (let i = 0; i < 2400; i++) {
      const y = 1 - 2*(i+.5)/2400, r = Math.sqrt(1-y*y), a = i * 2.39996323;
      dots.set([Math.cos(a)*r*RG, y*RG, Math.sin(a)*r*RG], i*3);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(dots, 3));
    const dotPts  = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x8fe3ee, size: .045, transparent: true, depthWrite: false }));
    const cityPts = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(Object.values(CITY).map(c => ll(...(c as [number,number]), RG+.01))),
      new THREE.PointsMaterial({ color: 0xFFE9A8, size: .13, transparent: true, depthWrite: false })
    );
    core.renderOrder = 0; dotPts.renderOrder = 1; cityPts.renderOrder = 3;
    const arcs = new THREE.Group(); W['arcLines'] = [];
    ([['cai','lon'],['cai','dxb'],['lon','nyc'],['dxb','sin'],['sin','tok'],
      ['nyc','lax'],['cai','cpt'],['sin','syd'],['nyc','sao']] as [string,string][])
    .forEach(([a, b]) => {
      const A = ll(...(CITY[a] as [number,number]), RG);
      const B = ll(...(CITY[b] as [number,number]), RG);
      const mid = A.clone().add(B).multiplyScalar(.5).normalize()
                   .multiplyScalar(RG + A.distanceTo(B) * .28);
      const ln = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(A,mid,B).getPoints(48)),
        new THREE.LineBasicMaterial({ color: 0xF6E2A8, transparent: true })
      );
      ln.renderOrder = 2; arcs.add(ln); W['arcLines'].push(ln);
    });
    globe.add(core, dotPts, cityPts, arcs);
    globe.position.copy(W['C1']); scene.add(globe); W['globe'] = globe;

    /* Clouds */
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const ctx = cv.getContext('2d')!;
    const gr = ctx.createRadialGradient(64,64,0,64,64,64);
    gr.addColorStop(0, 'rgba(255,255,255,.9)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(0,0,128,128);
    const cTex = new THREE.CanvasTexture(cv);
    cTex.colorSpace = THREE.SRGBColorSpace;
    const clouds = new THREE.Group();
    for (let i = 0; i < 48; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cTex, transparent: true, depthWrite: false,
        color: 0xcfd8ff, opacity: .25 + Math.random() * .3
      }));
      const sc = 5 + Math.random() * 6; sp.scale.set(sc, sc * .6, 1);
      sp.position.set(
        (Math.random()-.5)*34,
        restY + 3.2 + Math.random() * 1.4,
        E0.z - 6 + Math.random() * (W['E3'].z - E0.z + 10)
      );
      clouds.add(sp);
    }
    scene.add(clouds); W['clouds'] = clouds;

    /* Itinerary gates */
    W['ru'] = [.2,.4,.6,.8];
    const gates = new THREE.Group(); W['rings'] = [];
    (W['ru'] as number[]).forEach(u => {
      const r = new THREE.Mesh(
        new THREE.TorusGeometry(2.6, .05, 10, 72),
        new THREE.MeshBasicMaterial({ color: 0xFAF7F2, transparent: true })
      );
      const c = (W['path'] as THREE.CatmullRomCurve3).getPointAt(u);
      r.position.copy(c);
      r.lookAt(c.clone().add((W['path'] as THREE.CatmullRomCurve3).getTangentAt(u)));
      r.userData['c'] = c;
      gates.add(r); W['rings'].push(r);
    });
    const full = (W['path'] as THREE.CatmullRomCurve3).getSpacedPoints(160);
    W['pathDim'] = new THREE.Line(new THREE.BufferGeometry().setFromPoints(full), new THREE.LineBasicMaterial({ color: 0xFAF7F2, transparent: true }));
    W['pathLit'] = new THREE.Line(new THREE.BufferGeometry().setFromPoints(full), new THREE.LineBasicMaterial({ color: 0xF6E2A8, transparent: true }));
    gates.add(W['pathDim'], W['pathLit']); scene.add(gates); W['gates'] = gates;
    W['labs'] = (['Transfer','Concierge','Climate','Arrival'] as string[]).map(text => {
      const d = document.createElement('div');
      d.className = 't3d-lab'; d.textContent = text; d.setAttribute('aria-hidden', 'true');
      stage.appendChild(d); this.labEls.push(d); return d;
    });

    /* Shield dome */
    const shield = new THREE.Group();
    W['dome'] = new THREE.Mesh(
      new THREE.SphereGeometry(3.6, 56, 28, 0, Math.PI*2, 0, Math.PI/2),
      new THREE.ShaderMaterial({
        uniforms: { uA: { value: 0 } },
        transparent: true, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        vertexShader:   'varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
        fragmentShader: 'varying vec3 vN;varying vec3 vV;uniform float uA;void main(){float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.5);gl_FragColor=vec4(vec3(.79,.64,.29)*(f*1.6+.06),(f+.05)*uA);}'
      })
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.6, .04, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0xF6E2A8, transparent: true })
    );
    ring.rotation.x = Math.PI/2; ring.position.y = .03;
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xC9A24A, metalness: 1, roughness: .28, transparent: true });
    W['lock'] = new THREE.Group();
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(.3, .08, 12, 24, Math.PI), goldMat);
    shackle.position.y = .39;
    W['lock'].add(new THREE.Mesh(new THREE.BoxGeometry(1, .78, .42), goldMat), shackle);
    shield.add(W['dome'], ring, W['lock']);
    shield.position.set(W['E4'].x, 0, W['E4'].z);
    scene.add(shield); W['shield'] = shield;

    this.world = W;
  }

  /* ── plane pose at scroll position s ───────────────────────────────────── */
  private pose(s: number, now: number): void {
    const i = Math.min(N - 1, Math.floor(s));
    const t = s - i;
    const W = this.world;
    const { E0, E2, E3, C1, R, path } = W;
    let pitch = 0, roll = 0, byPitch = true;
    this.UP.set(0, 1, 0);

    if (i === 0) {
      this.P.set(0, this.restY + 3 * win(t, .48, 1), -10 + 26 * t * t);
      pitch = kf(t, [[0,0],[.5,0],[.66,13],[1,0]]);
      if (t < .5 && !this.reduced) this.P.y += Math.sin(now / 38) * .012 * t;
    } else if (i === 1) {
      const a = t * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      this.P.set(C1.x, C1.y + R * c, C1.z + R * sn);
      this.F.set(0, -sn, c); this.UP.set(0, c, sn); byPitch = false;
    } else if (i === 2) {
      this.P.set(0, E0.y + (E2.y - E0.y) * kf(t, [[0,0],[.55,1],[1,1]]),
                 E0.z + (E2.z - E0.z) * t);
      pitch = kf(t, [[0,0],[.15,16],[.5,12],[.62,0],[1,0]]);
      const sh = this.reduced ? 0 : Math.sin(Math.PI * cl(t / .5, 0, 1));
      roll = sh * .1 * Math.sin(now / 90);
      this.P.y += sh * .05 * Math.sin(now / 47);
    } else if (i === 3) {
      (path as THREE.CatmullRomCurve3).getPointAt(t, this.P);
      (path as THREE.CatmullRomCurve3).getTangentAt(t, this.F);
      (path as THREE.CatmullRomCurve3).getTangentAt(Math.min(1, t + .02), this.T2);
      roll = cl(-(this.F.z * this.T2.x - this.F.x * this.T2.z) * 5, -.6, .6);
      byPitch = false;
    } else {
      const q = cl((t - .5) / .35, 0, 1);
      this.P.set(0,
        this.restY + (E3.y - this.restY) * Math.pow(1 - cl(t / .5, 0, 1), 2),
        E3.z + 56 * Math.min(t, .5) + 12 * (1 - (1-q)*(1-q)));
      pitch = kf(t, [[0,0],[.14,-4],[.42,4],[.54,0],[1,0]]);
    }

    if (byPitch) this.F.set(0, Math.sin(rad(pitch)), Math.cos(rad(pitch)));
    this.rig.position.copy(this.P);
    this.M4.lookAt(this.F, this.ZERO, this.UP);
    this.rig.quaternion.setFromRotationMatrix(this.M4)
      .multiply(this.QR.setFromAxisAngle(this.Z_AXIS, roll));

    if (this.modelGroup) {
      const air = cl((this.P.y - this.restY) / 2, 0, 1);
      this.modelGroup.position.y = this.reduced ? 0 : Math.sin(now / 1100) * .05 * air;
    }
  }

  /* ── world props update ─────────────────────────────────────────────────── */
  private updateWorld(s: number, now: number): void {
    const W = this.world;
    const runW    = (1 - win(s, .55, .9)) + win(s, 3.6, 4);
    const globeW  = win(s, .7, 1) * (1 - win(s, 1.9, 2.15));
    const cloudW  = win(s, 2, 2.25) * (1 - win(s, 3.2, 3.8));
    const gateW   = win(s, 2.8, 3) * (1 - win(s, 3.85, 4));
    const shieldW = win(s, 4.55, 4.95);
    this.fade(W['run'],    runW);
    this.fade(W['globe'],  globeW);
    this.fade(W['clouds'], cloudW);
    this.fade(W['shield'], shieldW);
    this.shadowMat.opacity = .3 * Math.max(runW, cloudW * .5);

    if (W['globe'].visible) {
      W['globe'].rotation.y = s * .9 + (this.reduced ? 0 : now / 30000);
      const prog = cl((s - 1.05) / .8, 0, 1);
      (W['arcLines'] as THREE.Line[]).forEach((l, k) =>
        l.geometry.setDrawRange(0, Math.floor(49 * cl(prog * 1.6 - k * .07, 0, 1))));
    }

    const u = cl(s - 3, 0, 1);
    W['gates'].visible = gateW > .01;
    const sw = this.stageEl.nativeElement.clientWidth;
    const sh = this.stageEl.nativeElement.clientHeight;
    (W['rings'] as THREE.Mesh[]).forEach((r, k) => {
      const d = (u - W['ru'][k] + .03) / .08;
      const lit = ez(cl(d, 0, 1));
      r.scale.setScalar(1 + .3 * Math.sin(Math.PI * cl(d / 2.5, 0, 1)));
      (r.material as THREE.MeshBasicMaterial).color.set(0xFAF7F2).lerp(this.GOLD, lit);
      (r.material as THREE.MeshBasicMaterial).opacity = gateW * (.4 + .6 * lit);
      this.TMP.copy(r.userData['c']); this.TMP.y += 3.4;
      this.TMP.project(this.camera);
      const o = W['gates'].visible && this.TMP.z < 1
        ? gateW * cl(1.4 - Math.abs(u - W['ru'][k]) / .1, 0, 1) : 0;
      (W['labs'][k] as HTMLDivElement).style.opacity = o.toFixed(2);
      (W['labs'][k] as HTMLDivElement).style.transform =
        `translate(${(this.TMP.x*.5+.5)*sw}px,${(-this.TMP.y*.5+.5)*sh}px) translate(-50%,-50%)`;
    });
    ((W['pathDim'] as THREE.Line).material as THREE.LineBasicMaterial).opacity = gateW * .22;
    ((W['pathLit'] as THREE.Line).material as THREE.LineBasicMaterial).opacity = gateW;
    (W['pathLit'] as THREE.Line).geometry.setDrawRange(0, Math.floor(161 * u) + 1);

    if (W['shield'].visible) {
      W['dome'].scale.setScalar(.75 + .25 * shieldW);
      W['lock'].rotation.y = this.reduced ? 0 : now / 1400;
      W['lock'].position.y = 4.6 - (1 - shieldW) * 1.5
        + (this.reduced ? 0 : .15 * Math.sin(now / 700));
    }

    this.keyLight.position.copy(this.P).add(this.KEY_OFF);
    this.keyLight.target.position.copy(this.P);
    this.shadowMesh.position.set(this.P.x, .01, this.P.z);
  }

  /* ── apply beat (called every frame) ───────────────────────────────────── */
  private applyBeat(p: number, now: number, dt: number): void {
    const u  = cl(p * N - 0.5, 0, N - 1);
    const kk = Math.min(N - 2, Math.floor(u));
    const g  = ez(cl((u - kk - 0.20) / 0.60, 0, 1));
    const pos = kk + g;
    const A = BEATS[kk], B = BEATS[kk + 1];

    const stage = this.stageEl.nativeElement;
    stage.style.backgroundColor = `rgb(${mx(A.bg, B.bg, g).map(Math.round)})`;
    stage.style.color            = `rgb(${mx(A.ink, B.ink, g).map(Math.round)})`;
    this.setIdx(Math.round(pos));

    const s = cl(p, 0, 0.9999) * N;
    this.pose(s, now);

    const k = this.reduced ? 1 : (1 - Math.exp(-dt * 5));
    this.tgtFocus.lerpVectors(
      kk === 1 ? this.world['C1'] : this.P,
      kk + 1 === 1 ? this.world['C1'] : this.P, g);
    if (!this.focusInit) { this.focus.copy(this.tgtFocus); this.focusInit = true; }
    this.focus.lerp(this.tgtFocus, k);

    this.camOrbit += (lr(A.cam.orbit, B.cam.orbit, g) - this.camOrbit) * k;
    this.camElev  += (lr(A.cam.elev,  B.cam.elev,  g) - this.camElev)  * k;
    this.camDist  += (lr(A.cam.dist,  B.cam.dist,  g) - this.camDist)  * k;

    this.rimLight.intensity = lr(0, 4.8, cl((pos - 2.5) / 1.5, 0, 1));
    if (this.mixer && this.hasAnims) this.mixer.setTime(pos * 2.0);

    const oR = rad(this.camOrbit), eR = rad(this.camElev);
    this.camera.position.set(
      this.focus.x + this.camDist * Math.cos(eR) * Math.sin(oR),
      this.focus.y + this.camDist * Math.sin(eR),
      this.focus.z + this.camDist * Math.cos(eR) * Math.cos(oR)
    );
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld();
    this.updateWorld(s, now);
  }

  /* ── render loop ────────────────────────────────────────────────────────── */
  private loop = (now: number) => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.max(0, Math.min(0.05, (now - this.lastNow) / 1000));
    this.lastNow = now;

    if (this.reduced) {
      this.cur = this.tgt;
    } else if (this.navTargetProgress !== null) {
      const diff = this.navTargetProgress - this.cur;
      if (Math.abs(diff) < 0.0005) {
        this.cur = this.navTargetProgress;
        this.navTargetProgress = null;
      } else {
        const step = diff * (1 - Math.exp(-dt * 6));
        const maxStep = MAX_SPEED * dt;
        this.cur += Math.max(-maxStep, Math.min(maxStep, step));
      }

      // Move page scroll position along with playhead at maxSpeed
      const span = this.scrollSpan();
      const wrapTop = this.wrapEl.nativeElement.getBoundingClientRect().top + window.scrollY;
      const targetScrollY = wrapTop + this.cur * span;
      this.isClamping = true;
      this.smoothScroll.scrollTo(targetScrollY, { immediate: true });
      window.scrollTo({ top: targetScrollY, behavior: 'instant' });
      this.isClamping = false;
      this.tgt = this.cur;
    } else {
      const step = (this.tgt - this.cur) * (1 - Math.exp(-dt * 6));
      const maxStep = MAX_SPEED * dt;
      this.cur += Math.max(-maxStep, Math.min(maxStep, step));
    }

    this.applyBeat(this.cur, now, dt);
    this.renderer.render(this.scene, this.camera);
  };

  private startLoop(): void {
    if (this.rafId) return;
    this.lastNow = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }
  private stopLoop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  /* ── model load ─────────────────────────────────────────────────────────── */
  private loadModel(): void {
    const loader = new GLTFLoader();
    const draco  = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(draco);

    loader.load(
      '/assets/plane.glb',
      gltf => {
        draco.dispose();
        /* normalize */
        const obj = gltf.scene;
        const meshNames: string[] = [];
        obj.traverse(n => {
          if ((n as THREE.Mesh).isMesh) {
            meshNames.push(n.name || '(unnamed)');
            if ((n as THREE.Mesh).material) {
              (n as THREE.Mesh).castShadow = (n as THREE.Mesh).receiveShadow = true;
            }
          }
        });
        const bbox   = new THREE.Box3().setFromObject(obj);
        const rawSize   = bbox.getSize(new THREE.Vector3());
        const rawCenter = bbox.getCenter(new THREE.Vector3());
        const normScale = 4.0 / Math.max(rawSize.x, rawSize.y, rawSize.z);
        obj.position.copy(rawCenter).multiplyScalar(-normScale);
        obj.scale.setScalar(normScale);
        const grp = new THREE.Group(); grp.add(obj);
        this.restY = -new THREE.Box3().setFromObject(grp).min.y;
        this.hasAnims = gltf.animations.length > 0;
        if (this.hasAnims) {
          this.mixer = new THREE.AnimationMixer(grp);
          gltf.animations.forEach(c => this.mixer!.clipAction(c).play());
        }
        console.group('%c[Tribo 3D] ✓', 'color:#C9A24A;font-weight:700');
        console.log(`Meshes:${meshNames.length} normScale:${normScale.toFixed(3)} restY:${this.restY.toFixed(3)}`);
        console.groupEnd();
        this.modelGroup = grp;
        this.modelGroup.rotation.y = this.NOSE_YAW;
        this.rig.add(this.modelGroup);
        this.scene.add(this.rig);
        this.setupWorld();
        this.loaderEl.nativeElement.classList.add('t3d-loader--hidden');
        if (this.modelBytes / 1048576 > 15)
          console.warn('[Tribo 3D] plane.glb >15 MB — optimize with gltf-pipeline --draco.compressionLevel=7');
        this.tgt = this.cur = this.getScrollProgress();
        this.onResize(); this.setIdx(0); this.startLoop();
      },
      xhr => {
        this.modelBytes = Math.max(this.modelBytes, xhr.total || 0, xhr.loaded || 0);
        if (xhr.lengthComputable) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          this.loaderBar.nativeElement.style.width = pct + '%';
          this.loaderPct.nativeElement.textContent = `Loading model… ${pct}%`;
        }
      },
      err => {
        console.error('[Tribo 3D] GLTFLoader failed:', err);
        this.loaderBar.nativeElement.style.background = '#f87171';
        this.loaderPct.nativeElement.textContent = 'Failed to load model.';
        this.loaderErr.nativeElement.style.display = 'block';
        this.loaderErr.nativeElement.innerHTML =
          `<strong>Cannot load <code>plane.glb</code></strong><br><br>` +
          `Raw error: <em>${(err as Error).message || err}</em>`;
      }
    );
  }

  /* ── full cleanup ───────────────────────────────────────────────────────── */
  private destroy(): void {
    this.stopLoop();
    window.removeEventListener('scroll', this.scrollHandler);
    window.removeEventListener('wheel', this.cancelNavTarget);
    window.removeEventListener('touchstart', this.cancelNavTarget);
    window.removeEventListener('keydown', this.cancelNavTarget);
    this.resizeObs?.disconnect();
    this.intersObs?.disconnect();
    this.reducedMQ?.removeEventListener('change', this.reducedHandler);
    this.labEls.forEach(el => el.remove());
    this.btns = []; this.labEls = [];

    if (this.renderer) {
      this.scene.traverse(node => {
        const mesh = node as THREE.Mesh;
        mesh.geometry?.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach(m => {
            Object.values(m).forEach(v => { if (v instanceof THREE.Texture) v.dispose(); });
            m.dispose();
          });
        }
      });
      this.renderer.dispose();
    }
  }
}
