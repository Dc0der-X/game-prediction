import { gsap } from 'gsap';

/**
 * Motion helpers (GSAP). Calm and purposeful: things arrive, coins celebrate a real win, cards respond
 * to the pointer. Everything is skipped when the device asks for reduced motion.
 */
export const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Elements marked [data-reveal] rise in as they come into view, a few at a time. */
export function revealOnView(root: HTMLElement): () => void {
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
  if (reducedMotion() || !('IntersectionObserver' in window)) return () => {};
  gsap.set(els, { opacity: 0, y: 26 });
  const io = new IntersectionObserver(
    (entries) => {
      const shown = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
      if (!shown.length) return;
      shown.forEach((el) => io.unobserve(el));
      gsap.to(shown, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08, clearProps: 'transform' });
    },
    { threshold: 0.12 },
  );
  els.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

/** Children of `root` matching `selector` arrive one after another (page entrance). */
export function staggerIn(root: HTMLElement, selector: string, from: gsap.TweenVars = { y: 24, opacity: 0 }): void {
  if (reducedMotion() || !root.isConnected) return;
  const els = root.querySelectorAll(selector);
  if (els.length) gsap.from(els, { ...from, duration: 0.65, ease: 'power3.out', stagger: 0.07, clearProps: 'all' });
}

/** A shower of gold coins from the middle of `host` – for real wins only. */
export function coinBurst(host: HTMLElement, count = 22, glyph = '♠'): void {
  if (reducedMotion() || !host) return;
  const r = host.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:5';
  host.appendChild(layer);
  const cx = r.width / 2 - 17;
  const cy = Math.min(r.height * 0.45, 260) - 17;
  for (let i = 0; i < count; i++) {
    const c = document.createElement('i');
    c.className = 'tw-coin';
    c.textContent = glyph;
    layer.appendChild(c);
    const dir = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * Math.min(260, r.width * 0.45);
    const x = Math.cos(dir) * dist;
    const peak = -120 - Math.random() * 160;
    const tl = gsap.timeline({ delay: i * 0.025 });
    gsap.set(c, { x: cx, y: cy, scale: 0.4, rotationY: 0, opacity: 1 });
    tl.to(c, { duration: 0.55, x: cx + x * 0.6, y: cy + peak, scale: 1, ease: 'power2.out' })
      .to(c, { duration: 0.9, x: cx + x, y: cy + 260 + Math.random() * 120, ease: 'power2.in' }, '>-0.05')
      .to(c, { duration: 1.45, rotationY: 720 + Math.random() * 720, rotation: Math.random() * 90 - 45, ease: 'none' }, 0)
      .to(c, { duration: 0.35, opacity: 0 }, '-=0.35');
  }
  gsap.delayedCall(2.6, () => layer.remove());
}

/** Gentle up-and-down float (dealer cards, chips, coins in the hero). */
export function float(els: Element | Element[] | NodeListOf<Element>, amount = 10, duration = 3.2): gsap.core.Tween | null {
  if (reducedMotion()) return null;
  return gsap.to(els, { y: `-=${amount}`, duration, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: { each: 0.4, from: 'random' } });
}

/** The card leans toward the pointer (desktop); returns a cleanup function. */
export function tilt(el: HTMLElement, max = 8): () => void {
  if (reducedMotion() || !window.matchMedia?.('(hover: hover)').matches) return () => {};
  gsap.set(el, { transformPerspective: 900 });
  const rx = gsap.quickTo(el, 'rotationX', { duration: 0.4, ease: 'power3.out' });
  const ry = gsap.quickTo(el, 'rotationY', { duration: 0.4, ease: 'power3.out' });
  const move = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    ry(((e.clientX - r.left) / r.width - 0.5) * max * 2);
    rx(-((e.clientY - r.top) / r.height - 0.5) * max * 2);
  };
  const leave = () => {
    rx(0);
    ry(0);
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerleave', leave);
  return () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerleave', leave);
  };
}

/** A number that counts up to its value (big results). */
export function countUp(el: HTMLElement, to: number, format: (v: number) => string, duration = 1.1): void {
  if (reducedMotion()) {
    el.textContent = format(to);
    return;
  }
  const o = { v: 0 };
  gsap.to(o, { v: to, duration, ease: 'power2.out', onUpdate: () => (el.textContent = format(Math.round(o.v * 100) / 100)) });
}

/** A short, springy "pop" to acknowledge a tap or a new value. */
export function pop(el: Element | null): void {
  if (!el || reducedMotion()) return;
  gsap.fromTo(el, { scale: 0.92 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' });
}
