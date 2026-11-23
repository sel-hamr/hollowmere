const $ = (s, r = document) => r.querySelector(s);

export const CASES = [
  {
    id: 'I', label: 'Case I', roman: 'I', name: 'The Lamplighter\'s Shop', mood: 'Warm amber', color: '#e09a4c', open: true,
    intro: 'Every lamp in Hollowmere is still burning, though the lamplighter vanished with the rest. Tonight someone has been refilling the oil, and four people swear it was not them.',
    objective: 'Find out who keeps the lamps lit. Start at the shop',
  },
  { id: 'II', label: 'Case II', roman: 'II', name: 'The Bakery Left Warm', mood: 'Rose and ochre', color: '#c98a6a', open: false },
  { id: 'III', label: 'Case III', roman: 'III', name: 'The Chapel of Thirteen Bells', mood: 'Midnight', color: '#3c5a8a', open: false },
  { id: 'IV', label: 'Case IV', roman: 'IV', name: 'The Ferryman\'s House', mood: 'Fog green', color: '#6f8a7a', open: false },
  { id: 'V', label: 'Case V', roman: 'V', name: 'The Mayor\'s Archive', mood: 'Midnight crimson', color: '#7a2f3a', open: false },
];

const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('hollowmere.' + k);
      return v ? JSON.parse(v) : d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('hollowmere.' + k, JSON.stringify(v));
    } catch {
      /* storage unavailable: settings last for this visit only */
    }
  },
};
export { store };

/**
 * DOM layer for the title screen: menu, panels, inspection notes, chapter card.
 * Emits intent through the callbacks passed in `hooks`.
 */
export class UI {
  constructor(hooks) {
    this.hooks = hooks;
    this.title = $('#title');
    this.items = [...document.querySelectorAll('.menu__item')];
    this.panel = $('#panel');
    this.note = $('#note');
    this.tooltip = $('#tooltip');
    this.card = $('#card');
    this.active = 0;
    this.menuOn = false;
    this.noteTimer = 0;
    this.typeTimer = 0;
    this._bindMenu();
    this._bindCorner();
    this._paint();
  }

  _paint() {
    this.items.forEach((b, i) => b.classList.toggle('is-active', i === this.active));
  }

  _bindMenu() {
    this.items.forEach((b, i) => {
      b.addEventListener('mouseenter', () => {
        if (b.disabled || i === this.active) return;
        this.active = i;
        this._paint();
        this.hooks.hover?.();
      });
      b.addEventListener('focus', () => {
        if (b.disabled) return;
        this.active = i;
        this._paint();
      });
      b.addEventListener('click', () => {
        if (b.disabled) return;
        this.hooks.select?.();
        this._act(b.dataset.action);
      });
    });

    addEventListener('keydown', (e) => {
      if (!this.menuOn) return;
      if (e.key === 'Escape' && !this.panel.hidden) {
        this.closePanel();
        return;
      }
      if (!this.panel.hidden) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        let i = this.active;
        do i = (i + dir + this.items.length) % this.items.length;
        while (this.items[i].disabled);
        this.active = i;
        this._paint();
        this.items[i].focus({ preventScroll: true });
        this.hooks.hover?.();
      } else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') {
        this.items[this.active].click();
      }
    });
  }

  _bindCorner() {
    const snd = $('#btn-sound');
    snd.addEventListener('click', () => {
      const m = !snd.classList.contains('is-muted');
      snd.classList.toggle('is-muted', m);
      snd.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
      this.hooks.mute?.(m);
    });
    $('#btn-full').addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.();
    });
  }

  setMuted(m) {
    $('#btn-sound').classList.toggle('is-muted', m);
  }

  showTitle() {
    this.title.hidden = false;
    this.title.classList.remove('is-out');
    requestAnimationFrame(() => requestAnimationFrame(() => this.title.classList.add('is-in')));
    $('#corner-tools').hidden = false;
    $('#hint').hidden = false;
    $('#version').hidden = false;
    this.menuOn = true;
  }

  hideTitle() {
    this.title.classList.add('is-out');
    this.closePanel(true);
    $('#hint').hidden = true;
    this.menuOn = false;
  }

  restoreTitle() {
    this.title.classList.remove('is-out');
    $('#hint').hidden = false;
    this.menuOn = true;
  }

  _act(action) {
    if (action === 'cases') return this.openCases();
    if (action === 'settings') return this.openSettings();
    if (action === 'credits') return this.openCredits();
  }

  _openPanel(html) {
    this.panel.innerHTML = html;
    this.panel.hidden = false;
    this.title.querySelector('.menu').style.visibility = 'hidden';
    this.title.classList.add('has-panel');
    this.panel.querySelector('.back')?.addEventListener('click', () => {
      this.hooks.select?.();
      this.closePanel();
    });
    setTimeout(() => this.panel.querySelector('button, input')?.focus({ preventScroll: true }), 50);
  }

  closePanel(silent = false) {
    if (this.panel.hidden) return;
    this.panel.hidden = true;
    this.panel.innerHTML = '';
    this.title.querySelector('.menu').style.visibility = '';
    this.title.classList.remove('has-panel');
    if (!silent) this.items[this.active]?.focus({ preventScroll: true });
  }

  openSettings() {
    const s = this.hooks.getSettings();
    const seg = (name, opts, val) =>
      `<div class="seg" data-name="${name}">${opts.map(([v, l]) => `<button aria-pressed="${v === val}" data-v="${v}">${l}</button>`).join('')}</div>`;
    this._openPanel(`
      <h2>Settings</h2>
      <p class="sub">Saved in this browser.</p>
      <div class="field"><div class="field__label"><span>Graphics</span><span id="fps-readout"></span></div>${seg('quality', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], s.quality)}</div>
      <div class="field"><div class="field__label"><span>Rain</span></div>${seg('rain', [['0.35', 'Drizzle'], ['0.7', 'Steady'], ['1', 'Downpour']], String(s.rain))}</div>
      <div class="field"><div class="field__label"><span>Music</span><span data-out="music">${Math.round(s.music * 100)}</span></div><input type="range" min="0" max="1" step="0.01" value="${s.music}" data-name="music" aria-label="Music volume"></div>
      <div class="field"><div class="field__label"><span>Ambience &amp; effects</span><span data-out="sfx">${Math.round(s.sfx * 100)}</span></div><input type="range" min="0" max="1" step="0.01" value="${s.sfx}" data-name="sfx" aria-label="Ambience and effects volume"></div>
      <button class="back">Back</button>
    `);
    this.panel.querySelectorAll('.seg').forEach((g) => {
      g.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        const name = g.dataset.name;
        const v = name === 'rain' ? parseFloat(b.dataset.v) : b.dataset.v;
        this.hooks.setSetting(name, v);
        this.hooks.select?.();
      });
    });
    this.panel.querySelectorAll('input[type=range]').forEach((r) => {
      r.addEventListener('input', () => {
        const v = parseFloat(r.value);
        this.panel.querySelector(`[data-out="${r.dataset.name}"]`).textContent = Math.round(v * 100);
        this.hooks.setSetting(r.dataset.name, v);
      });
    });
  }

  setFps(fps) {
    const el = document.getElementById('fps-readout');
    if (el) el.textContent = `${fps} fps`;
  }

  openCases() {
    const solved = store.get('solved', []);
    const save = store.get('save', null);
    this._openPanel(`
      <h2>Cases</h2>
      <p class="sub">Each case is one murder in one room. Solve it to open the next.</p>
      <ol class="cases">
        ${CASES.map((c) => {
          const i = CASES.indexOf(c);
          const open = c.open || solved.includes(c.id) || (i > 0 && solved.includes(CASES[i - 1].id));
          const state = solved.includes(c.id) ? 'Solved' : save?.case === c.id ? 'Continue' : open ? 'Open' : 'Locked';
          return `<li>
            <button class="case ${open ? 'is-open' : 'is-locked'}" data-case="${c.id}" ${open ? '' : 'disabled aria-disabled="true"'}>
              <span class="case__num">${c.roman}</span>
              <span class="case__body"><span class="case__name">${c.name}</span><span class="case__mood"><i style="background:${c.color}"></i>${c.label} &middot; ${c.mood}</span></span>
              <span class="case__state">${state}</span>
            </button>
          </li>`;
        }).join('')}
      </ol>
      <button class="back">Back</button>
    `);
    this.panel.querySelectorAll('.case.is-open').forEach((b) => {
      b.addEventListener('mouseenter', () => this.hooks.hover?.());
      b.addEventListener('click', () => {
        this.hooks.select?.();
        this.hooks.startCase?.(b.dataset.case);
      });
    });
  }

  openCredits() {
    this._openPanel(`
      <h2>Credits</h2>
      <p class="sub">A prologue build of Hollowmere.</p>
      <dl class="credits">
        <dt>Village &amp; characters</dt><dd>Medieval Village MegaKit and Universal Base Characters by Quaternius (CC0), assembled, dressed and animated in code</dd>
        <dt>World, code &amp; direction</dt><dd>Terrain, weather, props and ravens generated in Three.js from one shared palette</dd>
        <dt>Rendering</dt><dd>Three.js r187 &middot; GTAO ambient occlusion &middot; bloom &middot; custom height fog</dd>
        <dt>Sound</dt><dd>Synthesised live with the Web Audio API</dd>
        <dt>Type</dt><dd>Fraunces, Cormorant Garamond &amp; Barlow Condensed</dd>
      </dl>
      <button class="back">Back</button>
    `);
  }

  /* ---------------- world feedback ---------------- */

  showTooltip(x, y, name, verb = 'Inspect') {
    this.tooltip.innerHTML = `<b>${name}</b><small>${verb}</small>`;
    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y}px`;
    this.tooltip.classList.add('is-on');
  }

  hideTooltip() {
    this.tooltip.classList.remove('is-on');
  }

  showNote(title, text, chapter) {
    clearTimeout(this.noteTimer);
    clearInterval(this.typeTimer);
    const n = this.note;
    n.classList.remove('is-out');
    n.hidden = false;
    // restart the entry animation
    n.style.animation = 'none';
    void n.offsetWidth;
    n.style.animation = '';
    n.querySelector('.note__title').textContent = title;
    const ch = n.querySelector('.note__chapter');
    ch.hidden = !chapter;
    ch.textContent = chapter ? `This place returns in Chapter ${chapter}` : '';
    const el = n.querySelector('.note__text');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) el.textContent = text;
    else {
      el.textContent = '';
      let i = 0;
      this.typeTimer = setInterval(() => {
        i += 2;
        el.textContent = text.slice(0, i);
        if (i >= text.length) clearInterval(this.typeTimer);
      }, 22);
    }
    this.noteTimer = setTimeout(() => this.hideNote(), 9000);
  }

  hideNote() {
    if (this.note.hidden) return;
    clearTimeout(this.noteTimer);
    this.note.classList.add('is-out');
    setTimeout(() => (this.note.hidden = true), 450);
  }

  showCard({ num, title, text, meta }, onBack, label = 'Return to the village', alt = null) {
    const c = this.card;
    c.querySelector('#card-back').textContent = label;
    const altBtn = c.querySelector('#card-alt');
    altBtn.hidden = !alt;
    if (alt) {
      altBtn.textContent = alt.label;
      altBtn.onclick = () => {
        altBtn.onclick = null;
        c.classList.remove('is-in');
        setTimeout(() => (c.hidden = true), 900);
        alt.onClick?.();
      };
    }
    c.querySelector('.card__num').textContent = num;
    c.querySelector('.card__title').textContent = title;
    c.querySelector('.card__text').textContent = text;
    c.querySelector('.card__meta').textContent = meta;
    c.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('is-in')));
    const btn = c.querySelector('#card-back');
    const handler = () => {
      btn.removeEventListener('click', handler);
      altBtn.onclick = null;
      c.classList.remove('is-in');
      setTimeout(() => (c.hidden = true), 900);
      onBack?.();
    };
    btn.addEventListener('click', handler);
    setTimeout(() => btn.focus({ preventScroll: true }), 1400);
  }

  /** The paper letter that invites the detective to a case. */
  showLetter(caseData, onStart) {
    const letter = caseData.letter;
    const el = $('#letter');
    const q = (s) => el.querySelector(s);
    const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    q('.letter__tag').innerHTML = `<span><b>${esc(caseData.label)}</b> · ${esc(caseData.title)}</span>`;
    q('.letter__date').textContent = letter.date;
    q('.letter__body').innerHTML = `<p class="letter__to">${esc(letter.to)}</p>` + letter.intro.map((t) => `<p>${esc(t)}</p>`).join('');
    q('.letter__label').textContent = letter.peopleLabel;
    q('.letter__people').innerHTML = letter.people.map(([n, note]) => `<li><b>${esc(n)}</b><span>${esc(note)}</span></li>`).join('');
    q('.letter__after').textContent = letter.after;
    // the same lantern counter the player will see in the room
    const lamp = `<svg viewBox="0 0 16 22" width="12" height="17" aria-hidden="true"><path d="M8 1.5c-1.2 0-2 .6-2 1.4V4h4V2.9c0-.8-.8-1.4-2-1.4z" fill="currentColor" opacity=".7"/><rect x="3.5" y="4" width="9" height="2" rx="1" fill="currentColor"/><rect x="4.5" y="6" width="7" height="10" rx="1.5" class="glass"/><rect x="3" y="16" width="10" height="2.5" rx="1.2" fill="currentColor"/></svg>`;
    q('.letter__lanterns').innerHTML = Array.from({ length: caseData.actions }, () => `<span class="lantern is-lit">${lamp}</span>`).join('');
    q('.letter__rules-text').innerHTML = `<b>You have ${caseData.actions} actions.</b> ${esc(letter.rules)}`;
    q('.letter__warn').textContent = letter.warn;
    q('.letter__sign').textContent = letter.from;
    q('.letter__panel').scrollTop = 0;
    el.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
    const btn = el.querySelector('.letter__go');
    const go = () => {
      btn.removeEventListener('click', go);
      removeEventListener('keydown', onKey);
      el.classList.remove('is-in');
      setTimeout(() => (el.hidden = true), 800);
      onStart?.();
    };
    const onKey = (e) => {
      if (e.key === 'Enter' && document.activeElement !== btn) go();
    };
    btn.addEventListener('click', go);
    addEventListener('keydown', onKey);
    setTimeout(() => btn.focus({ preventScroll: true }), 1200);
  }

  showCaseHud(c) {
    const h = $('#case-hud');
    if (!c) {
      h.hidden = true;
      return;
    }
    h.querySelector('.case-hud__tag').textContent = `${c.label} · ${c.name}`;
    h.querySelector('.case-hud__goal').textContent = c.objective;
    h.hidden = false;
  }

  toast(msg, ms = 3200) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => (t.hidden = true), ms);
  }
}
