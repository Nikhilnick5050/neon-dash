// Menu screens: start, pause, game over, high scores and settings.
const $ = (id) => document.getElementById(id);
const SCREENS = ['menu', 'pause', 'gameover', 'scores', 'settings'];

export class Menus {
  /**
   * @param {object} save   live save data (settings are edited in place)
   * @param {object} h      handlers: play, resume, restart, toMenu, quit, settingsChanged, click
   * @param {boolean} canQuit  show the Quit button (desktop app only)
   */
  constructor(save, h, canQuit) {
    this.save = save;
    this.h = h;
    this.current = null;
    this.settingsBack = 'menu';

    const on = (id, fn) => $(id).addEventListener('click', () => { h.click(); fn(); });
    on('m-play', () => h.play());
    on('m-scores', () => this.showScores());
    on('m-settings', () => this.showSettings('menu'));
    on('m-quit', () => h.quit());
    on('p-resume', () => h.resume());
    on('p-restart', () => h.restart());
    on('p-settings', () => this.showSettings('pause'));
    on('p-menu', () => h.toMenu());
    on('g-again', () => h.restart());
    on('g-menu', () => h.toMenu());
    on('s-back', () => this.show('menu'));
    on('st-back', () => this.show(this.settingsBack));
    $('btn-pause').addEventListener('click', (e) => { e.currentTarget.blur(); h.pause(); });
    if (!canQuit) $('m-quit').classList.add('hidden');

    // Settings controls change the save directly and apply right away.
    const s = save.settings;
    const music = $('set-music'), sfx = $('set-sfx'), quality = $('set-quality'), fps = $('set-fps');
    music.addEventListener('input', () => { s.music = +music.value; $('out-music').textContent = s.music; h.settingsChanged(); });
    sfx.addEventListener('input', () => { s.sfx = +sfx.value; $('out-sfx').textContent = s.sfx; h.settingsChanged(); });
    sfx.addEventListener('change', () => h.click());
    quality.addEventListener('change', () => { s.quality = quality.value; h.settingsChanged(); });
    fps.addEventListener('change', () => { s.showFps = fps.checked; h.settingsChanged(); });
  }

  show(name) {
    for (const id of SCREENS) $(id).classList.toggle('hidden', id !== name);
    this.current = name;
    if (name === 'menu') $('menu-best').textContent = this.save.best.toLocaleString();
    // Focus the main button so Enter / Space works straight away.
    const first = name && $(name)?.querySelector('.btn.primary, .btn');
    if (first) first.focus({ preventScroll: true });
  }

  hideAll() {
    this.show(null);
    document.activeElement?.blur?.();
  }

  showScores() {
    const list = $('score-list');
    list.textContent = '';
    const rows = this.save.highScores;
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No runs yet. Go set a record!';
      list.appendChild(li);
    }
    for (const r of rows) {
      const li = document.createElement('li');
      const s = document.createElement('span');
      s.className = 's';
      s.textContent = r.score.toLocaleString();
      const c = document.createElement('span');
      c.className = 'c';
      c.textContent = `${r.coins} coins`;
      const d = document.createElement('span');
      d.className = 'd';
      d.textContent = r.date ? new Date(r.date).toLocaleDateString() : '';
      li.append(s, c, d);
      list.appendChild(li);
    }
    this.show('scores');
  }

  showSettings(back) {
    this.settingsBack = back;
    const s = this.save.settings;
    $('set-music').value = s.music;
    $('out-music').textContent = s.music;
    $('set-sfx').value = s.sfx;
    $('out-sfx').textContent = s.sfx;
    $('set-quality').value = s.quality;
    $('set-fps').checked = s.showFps;
    this.show('settings');
  }

  showGameOver(score, coins, best, isBest) {
    $('go-score').textContent = score.toLocaleString();
    $('go-coins').textContent = coins;
    $('go-best').textContent = best.toLocaleString();
    $('go-new').classList.toggle('hidden', !isBest);
    this.show('gameover');
  }

  /** Arrow keys move between the buttons of the open screen. */
  moveFocus(dir) {
    if (!this.current) return;
    const buttons = [...$(this.current).querySelectorAll('.btn:not(.hidden)')];
    if (!buttons.length) return;
    const i = buttons.indexOf(document.activeElement);
    const next = buttons[(i + dir + buttons.length) % buttons.length];
    next.focus();
    this.h.click();
  }

  back() {
    if (this.current === 'scores') this.show('menu');
    else if (this.current === 'settings') this.show(this.settingsBack);
  }
}
