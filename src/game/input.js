// Keyboard and touch (swipe) input, turned into simple actions.
const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  ArrowDown: 'slide', KeyS: 'slide',
  Escape: 'pause', KeyP: 'pause',
  Enter: 'confirm',
};

export class Input {
  /** @param {(action:string)=>void} onAction */
  constructor(target, onAction) {
    this.onAction = onAction;
    this.touch = null;

    window.addEventListener('keydown', (e) => {
      const action = KEYS[e.code];
      if (!action) return;
      // Let menu controls keep their normal keys (sliders, dropdowns, Space/Enter on buttons).
      const tag = document.activeElement?.tagName;
      if ((tag === 'SELECT' || tag === 'INPUT') && action !== 'pause') return;
      if (tag === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
      e.preventDefault();
      if (e.repeat && action !== 'pause') return;
      onAction(action);
    });

    // Swipes: one action per touch, as soon as the finger has moved far enough.
    target.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      this.touch = { x: t.clientX, y: t.clientY, used: false };
    }, { passive: true });
    target.addEventListener('touchmove', (e) => {
      if (!this.touch || this.touch.used) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - this.touch.x;
      const dy = t.clientY - this.touch.y;
      const min = Math.max(28, Math.min(window.innerWidth, window.innerHeight) * 0.05);
      if (Math.abs(dx) < min && Math.abs(dy) < min) return;
      this.touch.used = true;
      if (Math.abs(dx) > Math.abs(dy)) onAction(dx < 0 ? 'left' : 'right');
      else onAction(dy < 0 ? 'jump' : 'slide');
    }, { passive: true });
    target.addEventListener('touchend', () => { this.touch = null; }, { passive: true });
  }
}
