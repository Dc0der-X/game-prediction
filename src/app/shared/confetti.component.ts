import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';

/** A short burst of gold/green confetti for a profitable stop. Skipped when reduced motion is on. */
@Component({
  selector: 'app-confetti',
  standalone: true,
  template: `<canvas #c aria-hidden="true"></canvas>`,
  styles: [`
    :host { position: fixed; inset: 0; pointer-events: none; z-index: 1100; }
    canvas { width: 100%; height: 100%; display: block; }
  `],
})
export class ConfettiComponent implements AfterViewInit, OnDestroy {
  @ViewChild('c') canvas!: ElementRef<HTMLCanvasElement>;
  private raf = 0;

  ngAfterViewInit() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const cv = this.canvas.nativeElement;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = (cv.width = innerWidth * dpr);
    const H = (cv.height = innerHeight * dpr);
    const colors = ['#e8c26a', '#f5d98f', '#34b578', '#ffffff', '#e05252'];
    const parts = Array.from({ length: 160 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3,
      y: H * 0.35,
      vx: (Math.random() - 0.5) * 16 * dpr,
      vy: (-Math.random() * 14 - 6) * dpr,
      s: (4 + Math.random() * 6) * dpr,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: colors[(Math.random() * colors.length) | 0],
    }));
    const start = performance.now();
    const frame = (t: number) => {
      const age = t - start;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = Math.max(0, 1 - age / 2800);
      for (const p of parts) {
        p.vy += 0.35 * dpr;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (age < 2800) this.raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    };
    this.raf = requestAnimationFrame(frame);
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.raf);
  }
}
