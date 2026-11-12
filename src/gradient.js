// A single, clipped overlay keeps the ripple outside React's trees. Capture the
// click before a filter replaces its button; keyboard clicks start in the middle.
export const GRADIENT_CONTROLS = '.tabs a, .lab-tabs a, .filters button, .filters a, .focus-nav button, .drive-pick button, .pth-pick button, .pth-lose button, .cta, .pth-cta, .gotw-more, .detail-close, .car-arrow, .car-pause, .odds-more, .pick';

export function initGradient() {
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const box = document.createElement('div');
  box.className = 'gradient-ripple';
  box.setAttribute('aria-hidden', 'true');
  const wave = document.createElement('i');
  box.append(wave);
  document.body.append(box);
  const stop = () => wave.getAnimations().forEach((animation) => animation.cancel());

  document.addEventListener('click', (event) => {
    if (calm.matches || event.button > 0) return;
    const button = event.target.closest?.(GRADIENT_CONTROLS);
    if (!button || button.matches(':disabled, [aria-disabled="true"]') || button.closest('.adm-page')) return;
    const rect = button.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    stop();
    const x = event.detail ? Math.max(0, Math.min(rect.width, event.clientX - rect.left)) : rect.width / 2;
    const y = event.detail ? Math.max(0, Math.min(rect.height, event.clientY - rect.top)) : rect.height / 2;
    const diameter = 2 * Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y));
    box.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;border-radius:${getComputedStyle(button).borderRadius}`;
    wave.style.cssText = `left:${x - diameter / 2}px;top:${y - diameter / 2}px;width:${diameter}px;height:${diameter}px`;
    wave.animate([
      { transform: 'scale(0)', opacity: 0.5 },
      { transform: 'scale(0.65)', opacity: 0.3, offset: 0.5 },
      { transform: 'scale(1)', opacity: 0 },
    ], { duration: 560, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  }, { capture: true, passive: true });
  // The overlay must never linger at old coordinates after a scroll or resize.
  addEventListener('scroll', stop, { capture: true, passive: true });
  addEventListener('resize', stop, { passive: true });
  calm.addEventListener('change', stop);
}
