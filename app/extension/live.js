/**
 * Step by Step — live.js
 *
 * Verifica mentre Sara scrive, e la mostra. Tiene insieme validators.js,
 * copy.js e profile.js e scrive dentro il pannello.
 *
 * Temporaneo: quando nascera' panel.js, il rendering si sposta li'.
 * Qui resta solo la logica di quando parlare e quando tacere.
 *
 * Quanto parla dipende dal livello di supporto (agents/spec.md):
 *   pieno   blocchi da 4, scomposizione, verifica a ogni carattere
 *   minimo  nessuna interruzione: solo la verifica finale
 *   muto    niente
 */
(function () {
  'use strict';
  const SBS = (window.SBS = window.SBS || {});

  const DEBOUNCE_MS = 300;

  // Un errore per campo per modulo: mentre corregge non deve peggiorare il profilo.
  let recordedThisForm = new Set();

  function resetRecorded() {
    recordedThisForm = new Set();
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // ---------------------------------------------------------------------------
  // RENDERING
  // ---------------------------------------------------------------------------

  // I riquadri del codice. La divisione e' quella di validators.js: gli stessi
  // pezzi che la spiegazione qui sotto descrive uno per uno. Se le due
  // divisioni non combaciano, Sara legge due codici diversi.
  function renderBoxes(kind, raw, expected, suspectChunk, badChar) {
    const segs = SBS.segmentsOf(kind, raw);
    const cells = [];

    // Senza segmenti (pdr, cap) si torna ai blocchi da 4, numerati.
    const ranges = segs
      ? segs
      : (() => {
          const out = [];
          const total = expected ? Math.ceil(expected / SBS.CHUNK) : Math.ceil(raw.length / SBS.CHUNK);
          for (let i = 0; i < total; i++) {
            out.push({ from: i * SBS.CHUNK, to: i * SBS.CHUNK + SBS.CHUNK - 1, name: null });
          }
          return out;
        })();

    ranges.forEach((seg, i) => {
      const text = raw.slice(seg.from, Math.min(seg.to + 1, raw.length));
      const classes = ['sbs-g'];
      if (i === suspectChunk) classes.push('sbs-g-suspect');
      else if (raw.length > seg.to) classes.push('sbs-g-full');

      let inner = esc(text);
      if (badChar !== null && badChar >= seg.from && badChar <= seg.to) {
        const at = badChar - seg.from;
        inner =
          esc(text.slice(0, at)) +
          '<b class="sbs-bad">' + esc(text[at] || '') + '</b>' +
          esc(text.slice(at + 1));
      } else if (text.length > 5) {
        // Un pezzo lungo (il numero di conto) si spezza a occhio ogni 4.
        inner = SBS.chunksOf(text).map(esc).join('<i class="sbs-sep"></i>');
      }

      const label = seg.name || String(i + 1);
      cells.push(
        `<span class="${classes.join(' ')}"><span class="sbs-g-n">${esc(label)}</span>${inner || '&middot;'}</span>`
      );
    });

    return `<div class="sbs-groups">${cells.join('')}</div>`;
  }

  // Da cosa e' fatto il codice. E' la parte che insegna.
  function renderParts(kind, raw) {
    const parts = SBS.explain(kind, raw);
    if (!parts.length) return '';
    const rows = parts
      .map(
        (p) => `
        <div class="sbs-part${p.complete ? '' : ' sbs-part-partial'}">
          <code>${esc(p.text)}</code>
          <div><strong>${esc(p.name)}</strong><span>${esc(p.meaning)}</span></div>
        </div>`
      )
      .join('');
    return `<div class="sbs-parts"><div class="sbs-parts-title">Cosa hai scritto, pezzo per pezzo</div>${rows}</div>`;
  }

  function renderRemember(kind) {
    const text = SBS.rememberFor(kind);
    if (!text) return '';
    return `<div class="sbs-remember"><div class="sbs-remember-title">Da ricordare</div>${esc(text)}</div>`;
  }

  function renderStatus(res) {
    if (res.state === 'errore') {
      return `<div class="sbs-status sbs-status-bad">${esc(res.message)}</div>`;
    }
    if (res.state === 'ok') {
      return '<div class="sbs-status sbs-status-ok">Questo codice torna. Puoi andare avanti.</div>';
    }
    if (res.state === 'in-corso' && res.expected) {
      const left = res.expected - res.raw.length;
      return `<div class="sbs-status">Mancano ${left} caratteri.</div>`;
    }
    return '';
  }

  // ---------------------------------------------------------------------------
  // CAMPI A SCELTA
  //
  // Qui Sara non sbaglia a trascrivere: sbaglia a capire. Il gergo non le
  // sembra difficile, le sembra ovvio, e sceglie con sicurezza l'opzione
  // sbagliata senza chiedere aiuto (agents/persona.md).
  //
  // Quindi le opzioni si mostrano TUTTE INSIEME, spiegate, prima di scegliere.
  // Un gruppo di radio è una domanda sola: il pannello la pone una volta.
  //
  // Il pannello NON sceglie: mostra e spiega. Il clic lo fa Sara, sul campo
  // vero, che intanto è evidenziato. Vedi regola 1 di CLAUDE.md.
  // ---------------------------------------------------------------------------
  function labelOfRadio(r) {
    const wrap = r.closest('label');
    return wrap ? wrap.textContent.replace(/\s+/g, ' ').trim() : r.value;
  }

  function optionsOf(el) {
    if (el.tagName === 'SELECT') {
      return [].slice
        .call(el.options)
        .filter((o) => o.value !== '')
        .map((o) => ({ value: o.value, text: o.text, checked: o.selected }));
    }
    if (el.type === 'radio' && el.name) {
      return [].slice
        .call(document.querySelectorAll('input[type="radio"][name="' + CSS.escape(el.name) + '"]'))
        .map((r) => ({ value: r.value, text: labelOfRadio(r), checked: r.checked }));
    }
    return [];
  }

  function groupOf(el) {
    if (el.type === 'radio' && el.name) {
      return [].slice.call(document.querySelectorAll('input[type="radio"][name="' + CSS.escape(el.name) + '"]'));
    }
    return [el];
  }

  function fieldKey(el) {
    return el.type === 'radio' ? el.name : el.id || el.name;
  }

  function renderOptions(el) {
    const options = optionsOf(el);
    if (!options.length) return '';

    const meanings = SBS.optionsFor(fieldKey(el)) || {};
    const chosen = options.some((o) => o.checked);

    const rows = options
      .map(
        (o) =>
          '<div class="sbs-opt' + (o.checked ? ' sbs-opt-on' : '') + '">' +
          '<span class="sbs-opt-dot"></span>' +
          '<span class="sbs-opt-body"><strong>' + esc(o.text) + '</strong>' +
          (meanings[o.value] ? '<span>' + esc(meanings[o.value]) + '</span>' : '') +
          '</span></div>'
      )
      .join('');

    const foot = chosen
      ? '<div class="sbs-status sbs-status-ok">Hai scelto. Puoi andare avanti.</div>'
      : '<div class="sbs-status">Scegli una delle due nella pagina.</div>';

    return '<div class="sbs-opts">' + rows + '</div>' + foot;
  }

  // ---------------------------------------------------------------------------
  // AGGANCIO A UN CAMPO
  // ---------------------------------------------------------------------------

  /**
   * @param el        il campo nella pagina
   * @param kind      'cf' | 'iban' | ...
   * @param container dove scrivere (il div #sbs-preview del pannello)
   * @returns funzione di sgancio
   */
  function attach(el, kind, container) {
    const support = SBS.profile.supportFor(kind);

    // Campi a scelta: niente da validare, tutto da spiegare.
    if (kind === 'select') {
      const group = groupOf(el);
      const paint = () => {
        container.innerHTML = renderOptions(el);
      };
      group.forEach((g) => g.addEventListener('change', paint));
      SBS.log && SBS.log('field_focus', { id: fieldKey(el), kind: kind });
      paint();
      return function detach() {
        group.forEach((g) => g.removeEventListener('change', paint));
      };
    }

    if (!SBS.hasValidator(kind) || support === 'muto') {
      container.innerHTML = '';
      return function detach() {};
    }

    const verbose = support === 'pieno';
    let timer = null;

    function draw(final) {
      const res = SBS.checkLive(kind, el.value);

      // A supporto minimo non interrompiamo: parliamo solo a campo finito.
      if (!verbose && !final && res.state !== 'errore') {
        container.innerHTML = '';
        el.classList.remove('sbs-field-bad');
        return;
      }

      const showGroups = verbose && res.raw;
      container.innerHTML =
        (showGroups ? renderBoxes(kind, res.raw, res.expected, res.chunkIndex, res.charIndex) : '') +
        renderStatus(res) +
        (verbose && res.raw ? renderParts(kind, res.raw) : '') +
        (verbose && res.state !== 'ok' ? renderRemember(kind) : '');

      el.classList.toggle('sbs-field-bad', res.state === 'errore');

      // Il profilo impara solo dagli errori certi, e una volta sola per campo.
      const definitive = res.state === 'errore' && (res.charIndex !== null || res.raw.length >= res.expected);
      if (definitive && !recordedThisForm.has(el)) {
        recordedThisForm.add(el);
        SBS.profile.recordError(kind);
        SBS.log && SBS.log('field_error', { id: el.id || el.name, kind: kind });
      }
    }

    function onInput() {
      clearTimeout(timer);
      timer = setTimeout(() => draw(false), DEBOUNCE_MS);
    }
    function onBlur() {
      clearTimeout(timer);
      draw(true);
    }

    el.addEventListener('input', onInput);
    el.addEventListener('blur', onBlur);
    SBS.log && SBS.log('field_focus', { id: el.id || el.name, kind: kind, supporto: support });
    draw(false);

    return function detach() {
      clearTimeout(timer);
      el.removeEventListener('input', onInput);
      el.removeEventListener('blur', onBlur);
      el.classList.remove('sbs-field-bad');
    };
  }

  // ---------------------------------------------------------------------------
  // STILI
  // ---------------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById('sbs-live-styles')) return;
    const style = document.createElement('style');
    style.id = 'sbs-live-styles';
    style.textContent = `
      .sbs-groups { display: flex; flex-wrap: wrap; gap: 7px; margin: 14px 0 10px; }
      .sbs-g {
        position: relative;
        font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.1em;
        color: #1428AA;
        background: #f7f8fc;
        border: 1.5px solid #d2daff;
        border-radius: 8px;
        padding: 14px 9px 7px;
        min-width: 52px;
        text-align: center;
      }
      .sbs-g-n {
        position: absolute;
        top: 2px; left: 0; right: 0;
        font-family: system-ui, sans-serif;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #9aa3bd;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sbs-g-full { background: #eef1ff; }
      .sbs-sep {
        display: inline-block;
        width: 7px;
      }
      .sbs-g-suspect {
        border-color: #E5003F;
        background: #FFF0F4;
        color: #BB003A;
        box-shadow: 0 0 0 3px rgba(229,0,63,0.12);
      }
      .sbs-bad {
        background: #E5003F;
        color: #fff;
        border-radius: 3px;
        padding: 0 2px;
      }

      .sbs-status {
        font-size: 13.5px;
        line-height: 1.55;
        color: #6B7385;
        margin-bottom: 12px;
      }
      .sbs-status-bad {
        color: #BB003A;
        background: #FFF0F4;
        border-left: 3px solid #E5003F;
        border-radius: 0 8px 8px 0;
        padding: 10px 13px;
        font-weight: 600;
      }
      .sbs-status-ok {
        color: #2F724C;
        background: #EEF7F1;
        border-left: 3px solid #2F724C;
        border-radius: 0 8px 8px 0;
        padding: 10px 13px;
        font-weight: 600;
      }

      .sbs-parts { margin-top: 6px; }
      .sbs-parts-title, .sbs-remember-title {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: #9aa3bd;
        margin-bottom: 7px;
      }
      .sbs-part {
        display: flex;
        gap: 10px;
        align-items: baseline;
        padding: 6px 0;
        border-top: 1px solid #eef0f7;
      }
      .sbs-part code {
        font-family: 'SF Mono', Consolas, monospace;
        font-size: 13px;
        font-weight: 700;
        color: #1428AA;
        background: #f2f4fd;
        border-radius: 4px;
        padding: 2px 6px;
        flex-shrink: 0;
        min-width: 46px;
        text-align: center;
      }
      .sbs-part-partial code { color: #9aa3bd; background: #f6f7fa; }
      .sbs-part strong { display: block; font-size: 12px; color: #1F1F1F; }
      .sbs-part span { font-size: 12.5px; color: #6B7385; line-height: 1.45; }

      .sbs-remember {
        margin-top: 14px;
        padding: 11px 13px;
        background: #FFFBF0;
        border: 1.5px solid #F0DCA8;
        border-radius: 9px;
        font-size: 13px;
        color: #6B5312;
        line-height: 1.55;
      }
      .sbs-remember-title { color: #B08A2E; }

      .sbs-opts { margin: 14px 0 12px; display: flex; flex-direction: column; gap: 8px; }
      .sbs-opt {
        display: flex;
        gap: 11px;
        align-items: flex-start;
        border: 1.5px solid #d2daff;
        border-radius: 10px;
        padding: 11px 13px;
        background: #fff;
        transition: border-color 0.15s, background 0.15s;
      }
      .sbs-opt-on { border-color: #1428AA; background: #f2f4fd; }
      .sbs-opt-dot {
        width: 15px;
        height: 15px;
        border-radius: 50%;
        border: 2px solid #b9c2e8;
        flex-shrink: 0;
        margin-top: 2px;
      }
      .sbs-opt-on .sbs-opt-dot {
        border-color: #1428AA;
        background: radial-gradient(circle, #1428AA 0 42%, #fff 47%);
      }
      .sbs-opt-body strong {
        display: block;
        font-size: 14.5px;
        color: #1F1F1F;
        line-height: 1.35;
      }
      .sbs-opt-body span {
        display: block;
        margin-top: 3px;
        font-size: 13px;
        color: #6B7385;
        line-height: 1.45;
      }

      input.sbs-field-bad {
        outline: 3px solid #E5003F !important;
        outline-offset: 3px !important;
      }
    `;
    document.head.appendChild(style);
  }

  SBS.live = {
    attach: attach,
    injectStyles: injectStyles,
    resetRecorded: resetRecorded,
    hadError: (el) => recordedThisForm.has(el),
  };
})();
