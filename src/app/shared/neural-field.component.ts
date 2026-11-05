import { AfterViewInit, Component, ElementRef, Input, NgZone, OnDestroy, ViewChild } from '@angular/core';

/**
 * Animated "neural field" background: drifting nodes, glowing links and
 * light pulses travelling along them. Call pulse() to send a wave out from
 * the centre (used when a new signal appears). Static under reduced motion.
 */
@Component({
  selector: 'app-neural-field',
  standalone: true,
  template: `<canvas #c aria-hidden="true"></canvas>`,
  styles: [`
    :host { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
    canvas { width: 100%; height: 100%; display: block; }
  `],
})
export class NeuralFieldComponent implements AfterViewInit, OnDestroy {
  @ViewChild('c') canvas!: ElementRef<HTMLCanvasElement>;
  /** Node count multiplier (1 = default density). */
  @Input() density = 1;
  /** Main hue as "r,g,b". */
  @Input() rgb = '92,225,255';

  private raf = 0;
  private ro?: ResizeObserver;
  private nodes: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
  private sparks: { a: number; b: number; t: number; v: number }[] = [];
  private waves: { t: number }[] = [];
  private W = 0;
  private H = 0;
  private dpr = 1;
  private still = false;

  constructor(private zone: NgZone, private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit() {
    this.still = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.host.nativeElement);
    this.zone.runOutsideAngular(() => (this.raf = requestAnimationFrame((t) => this.frame(t))));
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
  }

  /** Sends a wave of light out from the centre and fires sparks along links. */
  pulse() {
    this.waves.push({ t: 0 });
    for (let i = 0; i < 14; i++) this.spawnSpark();
  }

  private resize() {
    const el = this.host.nativeElement;
    const cv = this.canvas?.nativeElement;
    if (!cv) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = cv.width = Math.max(1, el.clientWidth * this.dpr);
    this.H = cv.height = Math.max(1, el.clientHeight * this.dpr);
    const n = Math.round(Math.min(90, ((el.clientWidth * el.clientHeight) / 16000) * this.density)) + 12;
    this.nodes = Array.from({ length: n }, () => ({
      x: Math.random() * this.W,
      y: Math.random() * this.H,
      vx: (Math.random() - 0.5) * 0.25 * this.dpr,
      vy: (Math.random() - 0.5) * 0.25 * this.dpr,
      r: (1 + Math.random() * 1.8) * this.dpr,
    }));
    if (this.still) this.draw(0);
  }

  private spawnSpark() {
    const a = (Math.random() * this.nodes.length) | 0;
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      if (i === a) continue;
      const d = Math.hypot(this.nodes[i].x - this.nodes[a].x, this.nodes[i].y - this.nodes[a].y);
      if (d < bd && Math.random() > 0.3) { bd = d; best = i; }
    }
    if (best >= 0) this.sparks.push({ a, b: best, t: 0, v: 0.012 + Math.random() * 0.02 });
  }

  private frame(t: number) {
    this.draw(t);
    if (!this.still) this.raf = requestAnimationFrame((tt) => this.frame(tt));
  }

  private draw(_t: number) {
    const cv = this.canvas.nativeElement;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const { W, H, dpr } = this;
    ctx.clearRect(0, 0, W, H);
    const link = 150 * dpr;
    const c = this.rgb;

    for (const n of this.nodes) {
      if (!this.still) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      }
    }
    // links
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i];
        const b = this.nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < link) {
          ctx.strokeStyle = `rgba(${c},${0.16 * (1 - d / link)})`;
          ctx.lineWidth = dpr;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    // nodes
    for (const n of this.nodes) {
      ctx.fillStyle = `rgba(${c},0.55)`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // sparks travelling along links
    if (!this.still && Math.random() < 0.04) this.spawnSpark();
    this.sparks = this.sparks.filter((s) => s.t <= 1);
    for (const s of this.sparks) {
      s.t += s.v;
      const a = this.nodes[s.a];
      const b = this.nodes[s.b];
      if (!a || !b) continue;
      const x = a.x + (b.x - a.x) * s.t;
      const y = a.y + (b.y - a.y) * s.t;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 10 * dpr);
      g.addColorStop(0, `rgba(${c},0.95)`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 10 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    // waves
    this.waves = this.waves.filter((w) => w.t < 1);
    for (const w of this.waves) {
      w.t += 0.018;
      const r = w.t * Math.max(W, H) * 0.7;
      ctx.strokeStyle = `rgba(${c},${0.45 * (1 - w.t)})`;
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
