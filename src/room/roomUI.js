/**
 * DOM layer for an investigation: action lanterns, suspect dialogue,
 * the detective's notebook (with compare) and the accusation screen.
 */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const LANTERN = `<svg viewBox="0 0 16 22" width="14" height="19" aria-hidden="true"><path d="M8 1.5c-1.2 0-2 .6-2 1.4V4h4V2.9c0-.8-.8-1.4-2-1.4z" fill="currentColor" opacity=".7"/><rect x="3.5" y="4" width="9" height="2" rx="1" fill="currentColor"/><rect x="4.5" y="6" width="7" height="10" rx="1.5" class="glass"/><rect x="3" y="16" width="10" height="2.5" rx="1.2" fill="currentColor"/></svg>`;

export class RoomUI {
  constructor(hooks) {
    this.hooks = hooks;
    const root = document.createElement('div');
    root.id = 'room-ui';
    root.hidden = true;
    root.innerHTML = `
      <div class="room-hud">
        <p class="room-hud__case"></p>
        <p class="room-hud__goal"></p>
        <div class="room-hud__actions"><span class="room-hud__label">Actions</span><span class="lanterns"></span><span class="room-hud__count"></span></div>
      </div>
      <div class="room-tools">
        <button class="room-btn" data-act="notebook">Notebook <span class="room-btn__key">N</span><span class="room-btn__badge" hidden></span></button>
        <button class="room-btn room-btn--primary" data-act="accuse">Accuse</button>
        <button class="room-btn room-btn--quiet" data-act="leave">Leave case</button>
      </div>
      <p class="room-hint">Walk with WASD or click the floor. Click a person to question them, or an object to search it. Each costs one action.</p>
      <section class="dialog" hidden>
        <p class="dialog__role"></p>
        <h3 class="dialog__name"></h3>
        <p class="dialog__text"></p>
        <div class="dialog__actions"></div>
      </section>
      <aside class="notebook" hidden>
        <header class="notebook__head"><h3>Notebook</h3><button class="room-x" data-act="close-notebook" aria-label="Close notebook">&times;</button></header>
        <p class="notebook__help">Pick two entries and compare them to catch a lie.</p>
        <div class="notebook__list"></div>
        <div class="notebook__result" hidden></div>
        <footer class="notebook__foot"><button class="room-btn room-btn--primary" data-act="compare" disabled>Compare</button></footer>
      </aside>
      <section class="accuse" hidden></section>
    `;
    document.body.appendChild(root);
    this.root = root;
    this.$ = (s) => root.querySelector(s);
    this.dialog = this.$('.dialog');
    this.notebook = this.$('.notebook');
    this.accusePanel = this.$('.accuse');
    this.selected = new Set();

    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      const a = b.dataset.act;
      if (a === 'notebook') this.toggleNotebook();
      else if (a === 'close-notebook') this.closeNotebook();
      else if (a === 'compare') this._compare();
      else if (a === 'accuse') this.hooks.accuse?.();
      else if (a === 'leave') this.hooks.leave?.();
    });
    addEventListener('keydown', (e) => {
      if (this.root.hidden) return;
      if (e.key === 'n' || e.key === 'N') this.toggleNotebook();
      if (e.key === 'Escape') {
        if (!this.accusePanel.hidden) this.closeAccuse();
        else if (!this.notebook.hidden) this.closeNotebook();
        else if (!this.dialog.hidden) this.hooks.closeDialog?.();
      }
    });
  }

  show(c) {
    this.root.hidden = false;
    this.$('.room-hud__case').textContent = `${c.label} · ${c.title}`;
    this.$('.room-hud__goal').textContent = c.goal;
    this.$('.room-hint').hidden = false;
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => (this.$('.room-hint').hidden = true), 12000);
  }

  hide() {
    this.root.hidden = true;
    this.hideDialog();
    this.closeNotebook();
    this.closeAccuse();
  }

  setActions(left, total) {
    const l = this.$('.lanterns');
    l.innerHTML = Array.from({ length: total }, (_, i) => `<span class="lantern ${i < left ? 'is-lit' : ''}">${LANTERN}</span>`).join('');
    this.$('.room-hud__count').textContent = `${left} of ${total}`;
  }

  /* ---------------- dialogue ---------------- */

  showDialog({ name, role, text, buttons = [] }) {
    const d = this.dialog;
    d.querySelector('.dialog__name').textContent = name;
    d.querySelector('.dialog__role').textContent = role;
    const el = d.querySelector('.dialog__text');
    clearInterval(this._type);
    el.textContent = '';
    let i = 0;
    this._type = setInterval(() => {
      i += 2;
      el.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(this._type);
    }, 18);
    const acts = d.querySelector('.dialog__actions');
    acts.innerHTML = '';
    for (const bt of buttons) {
      const b = document.createElement('button');
      b.className = 'room-btn' + (bt.primary ? ' room-btn--primary' : '') + (bt.quiet ? ' room-btn--quiet' : '');
      b.innerHTML = esc(bt.label) + (bt.cost ? ` <span class="room-btn__cost">${bt.cost} action</span>` : '');
      b.disabled = !!bt.disabled;
      b.addEventListener('click', () => bt.onClick?.());
      acts.appendChild(b);
    }
    d.hidden = false;
    d.style.animation = 'none';
    void d.offsetWidth;
    d.style.animation = '';
  }

  hideDialog() {
    clearInterval(this._type);
    this.dialog.hidden = true;
  }

  /* ---------------- notebook ---------------- */

  setNotebook(entries, flagged) {
    this.entries = entries;
    this.flagged = flagged;
    const list = this.$('.notebook__list');
    if (!entries.length) {
      list.innerHTML = '<p class="notebook__empty">Nothing written yet. Question someone or search the room.</p>';
    } else {
      const group = (kind, title) => {
        const items = entries.filter((e) => e.kind === kind);
        if (!items.length) return '';
        return `<h4>${title}</h4>` + items.map((e) => `
          <label class="entry ${flagged.has(e.key) ? 'is-flagged' : ''} ${this.selected.has(e.key) ? 'is-picked' : ''}">
            <input type="checkbox" value="${e.key}" ${this.selected.has(e.key) ? 'checked' : ''}>
            <span class="entry__body"><b>${esc(e.title)}</b><span>${esc(e.text)}</span></span>
            ${flagged.has(e.key) ? '<span class="entry__flag">Contradiction</span>' : ''}
          </label>`).join('');
      };
      list.innerHTML = group('evidence', 'Evidence') + group('statement', 'Statements');
      list.querySelectorAll('input').forEach((inp) =>
        inp.addEventListener('change', () => {
          if (inp.checked) {
            if (this.selected.size >= 2) {
              inp.checked = false;
              return;
            }
            this.selected.add(inp.value);
          } else this.selected.delete(inp.value);
          inp.closest('.entry').classList.toggle('is-picked', inp.checked);
          this.$('[data-act="compare"]').disabled = this.selected.size !== 2;
        })
      );
    }
    this.$('[data-act="compare"]').disabled = this.selected.size !== 2;
    const badge = this.$('.room-btn__badge');
    badge.hidden = !entries.length;
    badge.textContent = entries.length;
  }

  toggleNotebook() {
    if (this.notebook.hidden) this.openNotebook();
    else this.closeNotebook();
  }

  openNotebook() {
    this.closeAccuse();
    this.notebook.hidden = false;
    this.$('.notebook__result').hidden = true;
    this.hooks.sound?.('page');
  }

  closeNotebook() {
    this.notebook.hidden = true;
  }

  _compare() {
    const [a, b] = [...this.selected];
    const res = this.hooks.compare?.(a, b);
    const box = this.$('.notebook__result');
    box.hidden = false;
    box.className = 'notebook__result ' + (res?.found ? 'is-hit' : 'is-miss');
    box.textContent = res?.text || 'These two don\'t contradict each other.';
    this.selected.clear();
    this.setNotebook(this.entries, this.flagged);
  }

  /* ---------------- accusation ---------------- */

  openAccuse({ suspects, evidence, message, onAccuse, canCancel = true }) {
    this.hideDialog();
    this.closeNotebook();
    const pick = { suspect: null, evidence: new Set() };
    const p = this.accusePanel;
    p.innerHTML = `
      <h3>Name the killer</h3>
      <p class="accuse__msg">${esc(message || 'Choose who killed Edmund Crane, and up to three pieces of evidence that prove it.')}</p>
      <div class="accuse__suspects">${suspects.map((s) => `<button class="suspect-pick" data-id="${s.id}"><b>${esc(s.name)}</b><span>${esc(s.role)}</span></button>`).join('')}</div>
      <h4>Evidence <span class="accuse__count">0 of 3</span></h4>
      <div class="accuse__evidence">${evidence.length ? evidence.map((e) => `<button class="ev-pick" data-id="${e.id}">${esc(e.name)}</button>`).join('') : '<p class="notebook__empty">You found no evidence.</p>'}</div>
      <div class="accuse__foot">
        ${canCancel ? '<button class="room-btn room-btn--quiet" data-close>Keep investigating</button>' : ''}
        <button class="room-btn room-btn--primary" data-go disabled>Accuse</button>
      </div>`;
    p.hidden = false;
    const go = p.querySelector('[data-go]');
    p.querySelectorAll('.suspect-pick').forEach((b) =>
      b.addEventListener('click', () => {
        pick.suspect = b.dataset.id;
        p.querySelectorAll('.suspect-pick').forEach((x) => x.classList.toggle('is-picked', x === b));
        go.disabled = false;
        this.hooks.sound?.('tick');
      })
    );
    p.querySelectorAll('.ev-pick').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.id;
        if (pick.evidence.has(id)) pick.evidence.delete(id);
        else if (pick.evidence.size < 3) pick.evidence.add(id);
        b.classList.toggle('is-picked', pick.evidence.has(id));
        p.querySelector('.accuse__count').textContent = `${pick.evidence.size} of 3`;
        this.hooks.sound?.('tick');
      })
    );
    p.querySelector('[data-close]')?.addEventListener('click', () => this.closeAccuse());
    go.addEventListener('click', () => onAccuse(pick.suspect, [...pick.evidence]));
  }

  closeAccuse() {
    this.accusePanel.hidden = true;
  }
}
