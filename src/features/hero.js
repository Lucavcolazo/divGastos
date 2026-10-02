import { $, reduced } from '../lib/dom.js';

export const heroInView = () => scrollY < innerHeight * 0.5;
export const goToCalc = () => $('calc').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });

/** Parallax del hero y aparición del fondo de puntos al bajar. */
export function initHero() {
  const img = $('hero-img');
  const copy = $('hero-copy');
  const bg = $('bg');
  let ticking = false;

  function update() {
    ticking = false;
    const y = scrollY;
    const h = innerHeight;
    const p = Math.min(1, y / h);
    if (!reduced) {
      img.style.transform = `translate3d(0, ${y * 0.25}px, 0) scale(${1 + p * 0.05})`;
      copy.style.transform = `translate3d(0, ${y * 0.18}px, 0)`;
    }
    copy.style.opacity = Math.max(0, 1 - y / (h * 0.55));
    bg.style.opacity = Math.min(1, Math.max(0, (y - h * 0.3) / (h * 0.45)));
  }

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();
}
