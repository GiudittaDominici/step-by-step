/**
 * Step by Step — Content Script
 * Assistente per la compilazione guidata di moduli per utenti con dislessia.
 *
 * Per ogni campo del form l'estensione:
 * - evidenzia il campo corrente con un bordo pulsante
 * - spiega in linguaggio semplice cosa inserire e dove trovare l'informazione
 * - mostra i codici alfanumerici (CF, IBAN) suddivisi in gruppi per facilitarne la lettura
 * - tiene traccia del progresso con una barra e un contatore
 * - rileva l'inattività prolungata e offre un suggerimento aggiuntivo
 */
(function () {
  'use strict';

  if (window.__sbsLoaded) return;
  window.__sbsLoaded = true;

  // ---------------------------------------------------------------------------
  // GUIDA PER CAMPO — mappa id → istruzioni
  // ---------------------------------------------------------------------------
  const FIELD_GUIDE = {
    nome: {
      icon: '👤',
      label: 'Il tuo nome',
      instruction: 'Scrivi il tuo nome di battesimo.',
      detail: 'Usa il nome esatto che compare sulla carta d\'identità o sul passaporto.',
      tip: null,
      type: 'text',
    },
    cognome: {
      icon: '👤',
      label: 'Il tuo cognome',
      instruction: 'Scrivi il tuo cognome.',
      detail: 'Usa il cognome esatto che compare sulla carta d\'identità o sul passaporto.',
      tip: null,
      type: 'text',
    },
    data_nascita: {
      icon: '📅',
      label: 'Data di nascita',
      instruction: 'Inserisci la tua data di nascita.',
      detail: 'Clicca sul campo e scegli giorno, mese e anno dal calendario.',
      tip: null,
      type: 'date',
    },
    luogo_nascita: {
      icon: '📍',
      label: 'Luogo di nascita',
      instruction: 'Scrivi il comune in cui sei nato.',
      detail: 'Se sei nato all\'estero, scrivi il nome del paese (es. Germania, Francia).',
      tip: null,
      type: 'text',
    },
    codice_fiscale: {
      icon: '🪪',
      label: 'Codice Fiscale',
      instruction: 'Inserisci il tuo codice fiscale: 16 caratteri, lettere e numeri.',
      detail: 'Lo trovi sulla tessera sanitaria, nella riga in basso scritta in grande.',
      tip: '💡 Hai la tessera sanitaria a portata di mano? Il codice fiscale è in basso, ben visibile.',
      type: 'codice_fiscale',
      chunkSize: 4,
      maxLen: 16,
    },
    sesso: {
      icon: '⚧',
      label: 'Sesso anagrafico',
      instruction: 'Scegli M (Maschio) oppure F (Femmina).',
      detail: 'Seleziona come indicato nel tuo documento d\'identità.',
      tip: null,
      type: 'select',
    },
    email: {
      icon: '📧',
      label: 'Indirizzo email',
      instruction: 'Inserisci il tuo indirizzo email.',
      detail: 'Riceverai qui la conferma dell\'attivazione. Controlla bene che non ci siano errori di battitura.',
      tip: '💡 Esempio: nome.cognome@gmail.com — dopo la @ non ci devono essere spazi.',
      type: 'email',
    },
    telefono: {
      icon: '📱',
      label: 'Numero di telefono',
      instruction: 'Inserisci il tuo numero di cellulare.',
      detail: 'Scrivi solo i numeri, senza spazi o trattini (es. 3401234567).',
      tip: null,
      type: 'phone',
    },
    indirizzo: {
      icon: '🏠',
      label: 'Via o Piazza',
      instruction: 'Scrivi il nome della via o piazza della fornitura.',
      detail: 'È l\'indirizzo dell\'appartamento o dell\'immobile dove vuoi attivare la luce o il gas.',
      tip: '💡 Esempi: Via Roma, Corso Vittorio Emanuele, Piazza Garibaldi.',
      type: 'text',
    },
    civico: {
      icon: '🔢',
      label: 'Numero civico',
      instruction: 'Scrivi il numero del civico.',
      detail: 'Il numero sull\'insegna del portone. Può contenere anche lettere (es. 12/A, 7bis).',
      tip: null,
      type: 'text',
    },
    cap: {
      icon: '📮',
      label: 'CAP',
      instruction: 'Inserisci il codice di avviamento postale: 5 cifre.',
      detail: 'Lo trovi sulla bolletta o sull\'intestazione di qualsiasi lettera ricevuta a quell\'indirizzo.',
      tip: '💡 Esempio: 20121 per il centro di Milano, 00185 per il centro di Roma.',
      type: 'text',
      maxLen: 5,
    },
    citta: {
      icon: '🌆',
      label: 'Città',
      instruction: 'Scrivi il nome del comune.',
      detail: 'Il comune dove si trova l\'indirizzo di fornitura.',
      tip: null,
      type: 'text',
    },
    tipo_contratto: {
      icon: '📋',
      label: 'Tipo di utilizzo',
      instruction: 'Scegli come userai la fornitura.',
      detail: '"Domestico" = uso casa. "Non domestico" = negozio, ufficio, laboratorio.',
      tip: '💡 Nella maggior parte dei casi si sceglie "Domestico" (uso abitazione).',
      type: 'select',
    },
    potenza: {
      icon: '⚡',
      label: 'Potenza impegnata',
      instruction: 'Scegli la potenza del contratto elettrico.',
      detail: 'Se non lo sai, guarda la vecchia bolletta oppure scegli 3,0 kW — è la più comune per un\'abitazione.',
      tip: '💡 Per la maggior parte delle famiglie italiane va bene 3,0 kW.',
      type: 'select',
    },
    iban: {
      icon: '🏦',
      label: 'IBAN',
      instruction: 'Inserisci il tuo IBAN per la domiciliazione bancaria.',
      detail: '27 caratteri in totale: inizia sempre con IT seguito da numeri e lettere.',
      tip: '💡 Lo trovi nell\'app della tua banca → "Dettagli conto" → IBAN. Oppure in cima all\'estratto conto cartaceo.',
      type: 'iban',
      chunkSize: 4,
      maxLen: 27,
    },
  };

  // ---------------------------------------------------------------------------
  // STATO
  // ---------------------------------------------------------------------------
  const state = {
    active: false,
    currentStep: 0,
    fields: [],
    panel: null,
    inputHandler: null,
    inactivityTimer: null,
  };

  // ---------------------------------------------------------------------------
  // BOOTSTRAP
  // ---------------------------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot() {
    if (!document.querySelector('form, [role="form"]')) return;
    injectStyles();
    createActivateButton();
  }

  // ---------------------------------------------------------------------------
  // PULSANTE DI ATTIVAZIONE
  // ---------------------------------------------------------------------------
  function createActivateButton() {
    if (document.getElementById('sbs-activate')) return;

    const btn = document.createElement('button');
    btn.id = 'sbs-activate';
    btn.setAttribute('aria-label', 'Attiva assistente passo per passo');
    btn.innerHTML = `<span aria-hidden="true">🦮</span><span>Aiuto passo per passo</span>`;
    btn.addEventListener('click', activate);
    document.body.appendChild(btn);
  }

  // ---------------------------------------------------------------------------
  // ATTIVAZIONE
  // ---------------------------------------------------------------------------
  function activate() {
    state.fields = discoverFields();
    if (state.fields.length === 0) {
      showToast('Nessun campo trovato in questa pagina.');
      return;
    }
    state.active = true;

    const btn = document.getElementById('sbs-activate');
    if (btn) btn.style.display = 'none';

    createPanel();
    goToStep(0);
  }

  // ---------------------------------------------------------------------------
  // SCOPERTA DEI CAMPI
  // ---------------------------------------------------------------------------
  function discoverFields() {
    const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file']);
    const fields = [];

    document.querySelectorAll('input, select, textarea').forEach((el) => {
      if (SKIP_TYPES.has(el.type)) return;
      if (!el.offsetParent) return; // elemento nascosto

      const id = el.id || el.name || '';
      const guide = FIELD_GUIDE[id] || inferGuide(el);
      fields.push({ element: el, id, guide });
    });

    return fields;
  }

  function inferGuide(el) {
    let labelText = '';
    const labelEl =
      el.closest('label') ||
      (el.id ? document.querySelector(`label[for="${el.id}"]`) : null);
    if (labelEl) labelText = labelEl.textContent.trim().replace(/[*:]+$/, '').trim();

    return {
      icon: iconForInputType(el.type),
      label: labelText || 'Campo',
      instruction: 'Compila questo campo.',
      detail: '',
      tip: null,
      type: el.type || 'text',
    };
  }

  function iconForInputType(type) {
    return { email: '📧', tel: '📱', date: '📅', number: '🔢', password: '🔒' }[type] || '✏️';
  }

  // ---------------------------------------------------------------------------
  // PANNELLO LATERALE
  // ---------------------------------------------------------------------------
  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'sbs-panel';
    panel.setAttribute('role', 'complementary');
    panel.setAttribute('aria-label', 'Assistente passo per passo');
    panel.innerHTML = `
      <div id="sbs-header">
        <span id="sbs-logo" aria-hidden="true">🦮</span>
        <span id="sbs-title">Step by Step</span>
        <button id="sbs-close" title="Chiudi assistente" aria-label="Chiudi assistente">✕</button>
      </div>
      <div id="sbs-progress-wrap">
        <div id="sbs-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div id="sbs-progress-bar"></div>
        </div>
        <div id="sbs-step-counter" aria-live="polite"></div>
      </div>
      <div id="sbs-content">
        <div id="sbs-field-icon" aria-hidden="true"></div>
        <div id="sbs-field-label"></div>
        <div id="sbs-instruction"></div>
        <div id="sbs-detail"></div>
        <div id="sbs-preview" aria-live="polite"></div>
        <div id="sbs-tip-wrap"></div>
        <div id="sbs-idle-hint" aria-live="polite"></div>
      </div>
      <div id="sbs-nav">
        <button id="sbs-prev" class="sbs-btn sbs-btn-secondary">← Indietro</button>
        <button id="sbs-next" class="sbs-btn sbs-btn-primary">Avanti →</button>
      </div>
    `;

    document.body.appendChild(panel);
    state.panel = panel;

    document.getElementById('sbs-close').addEventListener('click', deactivate);
    document.getElementById('sbs-prev').addEventListener('click', () => goToStep(state.currentStep - 1));
    document.getElementById('sbs-next').addEventListener('click', () => goToStep(state.currentStep + 1));
  }

  // ---------------------------------------------------------------------------
  // NAVIGAZIONE TRA PASSI
  // ---------------------------------------------------------------------------
  function goToStep(index) {
    if (index >= state.fields.length) {
      showComplete();
      return;
    }
    if (index < 0) return;

    // Rimuovi highlight dal passo precedente
    const prev = state.fields[state.currentStep];
    if (prev) unhighlightField(prev.element);

    // Rimuovi listener input precedente
    if (state.inputHandler && prev) {
      prev.element.removeEventListener('input', state.inputHandler);
      state.inputHandler = null;
    }

    clearInactivityTimer();
    state.currentStep = index;
    const { element, guide } = state.fields[index];

    updatePanel(guide, index);
    highlightFields(element);

    // Scroll verso il campo attivo
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Listener per preview chunked (CF, IBAN, ecc.)
    if (guide.chunkSize) {
      state.inputHandler = () => updateChunkedPreview(element, guide);
      element.addEventListener('input', state.inputHandler);
      updateChunkedPreview(element, guide);
    } else {
      document.getElementById('sbs-preview').innerHTML = '';
    }

    // Focus ritardato per non interferire con lo scroll
    setTimeout(() => element.focus(), 350);

    // Timer inattività: 20 secondi senza input → suggerimento extra
    state.inactivityTimer = setTimeout(() => showIdleHint(guide), 20000);
    element.addEventListener('input', clearInactivityTimer, { once: true });
  }

  // ---------------------------------------------------------------------------
  // AGGIORNAMENTO PANNELLO
  // ---------------------------------------------------------------------------
  function updatePanel(guide, index) {
    const total = state.fields.length;
    const pct = Math.round(((index + 1) / total) * 100);

    document.getElementById('sbs-progress-bar').style.width = `${pct}%`;
    document.getElementById('sbs-progress-track').setAttribute('aria-valuenow', pct);
    document.getElementById('sbs-step-counter').textContent = `Passo ${index + 1} di ${total}`;

    document.getElementById('sbs-field-icon').textContent = guide.icon;
    document.getElementById('sbs-field-label').textContent = guide.label;
    document.getElementById('sbs-instruction').textContent = guide.instruction;
    document.getElementById('sbs-detail').textContent = guide.detail || '';
    document.getElementById('sbs-idle-hint').innerHTML = '';

    const tipWrap = document.getElementById('sbs-tip-wrap');
    tipWrap.innerHTML = guide.tip ? `<div class="sbs-tip">${guide.tip}</div>` : '';

    const prevBtn = document.getElementById('sbs-prev');
    const nextBtn = document.getElementById('sbs-next');
    prevBtn.disabled = index === 0;
    nextBtn.textContent = index === total - 1 ? 'Invia modulo ✓' : 'Avanti →';
  }

  // ---------------------------------------------------------------------------
  // HIGHLIGHT / DIM DEI CAMPI
  // ---------------------------------------------------------------------------
  function highlightFields(activeEl) {
    document.querySelectorAll('input, select, textarea').forEach((el) => {
      el.classList.remove('sbs-active', 'sbs-dimmed');
      if (el === activeEl) {
        el.classList.add('sbs-active');
      } else {
        el.classList.add('sbs-dimmed');
      }
    });
  }

  function unhighlightField(el) {
    el.classList.remove('sbs-active');
  }

  function clearAllHighlights() {
    document.querySelectorAll('.sbs-active, .sbs-dimmed').forEach((el) => {
      el.classList.remove('sbs-active', 'sbs-dimmed');
    });
  }

  // ---------------------------------------------------------------------------
  // PREVIEW CHUNKED (Codice Fiscale, IBAN, ecc.)
  // ---------------------------------------------------------------------------
  function updateChunkedPreview(el, guide) {
    const raw = el.value.replace(/\s/g, '').toUpperCase();
    const preview = document.getElementById('sbs-preview');

    if (!raw) {
      preview.innerHTML = '';
      return;
    }

    const size = guide.chunkSize;
    const chunks = [];
    for (let i = 0; i < raw.length; i += size) {
      chunks.push(raw.slice(i, i + size));
    }
    const chunked = chunks.join(' · ');

    const remaining = guide.maxLen ? guide.maxLen - raw.length : null;
    const remainingText = remaining !== null && remaining > 0
      ? `<div class="sbs-remaining">Mancano ancora <strong>${remaining}</strong> caratteri</div>`
      : remaining === 0
      ? `<div class="sbs-remaining sbs-remaining-ok">✓ Lunghezza corretta</div>`
      : '';

    preview.innerHTML = `
      <div class="sbs-chunk-box">
        <div class="sbs-chunk-label">Come stai scrivendo:</div>
        <code class="sbs-chunk-value">${chunked}</code>
        ${remainingText}
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // TIMER INATTIVITÀ
  // ---------------------------------------------------------------------------
  function clearInactivityTimer() {
    if (state.inactivityTimer) {
      clearTimeout(state.inactivityTimer);
      state.inactivityTimer = null;
    }
    document.getElementById('sbs-idle-hint').innerHTML = '';
  }

  function showIdleHint(guide) {
    const hint = document.getElementById('sbs-idle-hint');
    if (!hint) return;
    const msg = guide.tip || 'Hai bisogno di aiuto? Puoi saltare questo campo per ora con il pulsante "Avanti".';
    hint.innerHTML = `<div class="sbs-idle-box">🤔 ${msg}</div>`;
  }

  // ---------------------------------------------------------------------------
  // SCHERMATA FINALE
  // ---------------------------------------------------------------------------
  function showComplete() {
    clearAllHighlights();

    document.getElementById('sbs-content').innerHTML = `
      <div class="sbs-complete">
        <div class="sbs-complete-icon">🎉</div>
        <div class="sbs-complete-title">Ottimo lavoro!</div>
        <div class="sbs-complete-text">Hai compilato tutti i campi del modulo.<br>Ora puoi inviarlo.</div>
      </div>
    `;

    const progress = document.getElementById('sbs-progress-bar');
    if (progress) progress.style.width = '100%';
    document.getElementById('sbs-step-counter').textContent = 'Completato ✓';

    const nav = document.getElementById('sbs-nav');
    nav.innerHTML = `<button class="sbs-btn sbs-btn-primary" id="sbs-close-final" style="width:100%">Chiudi assistente</button>`;
    document.getElementById('sbs-close-final').addEventListener('click', deactivate);
  }

  // ---------------------------------------------------------------------------
  // DISATTIVAZIONE
  // ---------------------------------------------------------------------------
  function deactivate() {
    state.active = false;
    clearInactivityTimer();
    clearAllHighlights();

    if (state.panel) {
      state.panel.remove();
      state.panel = null;
    }

    const btn = document.getElementById('sbs-activate');
    if (btn) btn.style.display = 'flex';
  }

  // ---------------------------------------------------------------------------
  // TOAST
  // ---------------------------------------------------------------------------
  function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'sbs-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // ---------------------------------------------------------------------------
  // STILI INIETTATI
  // ---------------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById('sbs-styles')) return;
    const style = document.createElement('style');
    style.id = 'sbs-styles';
    style.textContent = `
      /* ====== PULSANTE ATTIVAZIONE ====== */
      #sbs-activate {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483640;
        display: flex;
        align-items: center;
        gap: 10px;
        background: #1428AA;
        color: white;
        border: none;
        border-radius: 50px;
        padding: 13px 20px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(20,40,170,0.45);
        transition: transform 0.2s, box-shadow 0.2s;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        line-height: 1;
      }
      #sbs-activate:hover {
        transform: translateY(-2px);
        box-shadow: 0 7px 28px rgba(20,40,170,0.55);
      }

      /* ====== PANNELLO ====== */
      #sbs-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 360px;
        height: 100vh;
        background: #fff;
        border-left: 3px solid #1428AA;
        box-shadow: -6px 0 40px rgba(0,0,0,0.18);
        z-index: 2147483639;
        display: flex;
        flex-direction: column;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
        overflow: hidden;
      }

      /* Header */
      #sbs-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 18px;
        background: #1428AA;
        color: white;
        flex-shrink: 0;
      }
      #sbs-logo { font-size: 20px; }
      #sbs-title { flex: 1; font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
      #sbs-close {
        background: rgba(255,255,255,0.18);
        border: none;
        color: white;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      #sbs-close:hover { background: rgba(255,255,255,0.3); }

      /* Progress */
      #sbs-progress-wrap {
        padding: 14px 18px 12px;
        border-bottom: 1px solid #e9ecfd;
        flex-shrink: 0;
      }
      #sbs-progress-track {
        height: 7px;
        background: #e9ecfd;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 7px;
      }
      #sbs-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #1428AA, #526FFF);
        border-radius: 4px;
        transition: width 0.4s ease;
        width: 0%;
      }
      #sbs-step-counter {
        font-size: 12px;
        font-weight: 600;
        color: #6B7385;
        letter-spacing: 0.02em;
      }

      /* Content */
      #sbs-content {
        flex: 1;
        padding: 22px 18px 16px;
        overflow-y: auto;
      }
      #sbs-field-icon { font-size: 34px; margin-bottom: 10px; }
      #sbs-field-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: #1428AA;
        margin-bottom: 10px;
      }
      #sbs-instruction {
        font-size: 20px;
        font-weight: 700;
        color: #1F1F1F;
        line-height: 1.35;
        margin-bottom: 10px;
      }
      #sbs-detail {
        font-size: 15px;
        color: #4A5568;
        line-height: 1.65;
        margin-bottom: 14px;
      }

      /* Tip */
      .sbs-tip {
        background: #E9ECFD;
        border-left: 3px solid #1428AA;
        border-radius: 0 8px 8px 0;
        padding: 11px 14px;
        font-size: 13.5px;
        color: #132789;
        line-height: 1.55;
        margin-top: 2px;
      }

      /* Chunked preview */
      .sbs-chunk-box {
        background: #f7f8fc;
        border: 1.5px solid #d2daff;
        border-radius: 10px;
        padding: 13px 15px;
        margin-top: 14px;
      }
      .sbs-chunk-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #6B7385;
        margin-bottom: 6px;
      }
      .sbs-chunk-value {
        display: block;
        font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
        font-size: 18px;
        font-weight: 700;
        color: #1428AA;
        letter-spacing: 0.08em;
        word-break: break-all;
      }
      .sbs-remaining {
        margin-top: 7px;
        font-size: 13px;
        color: #6B7385;
      }
      .sbs-remaining-ok { color: #2F724C; font-weight: 600; }

      /* Idle hint */
      .sbs-idle-box {
        margin-top: 14px;
        background: #fff8e7;
        border: 1.5px solid #f0c040;
        border-radius: 10px;
        padding: 12px 14px;
        font-size: 14px;
        color: #7a5c00;
        line-height: 1.5;
      }

      /* Schermata completa */
      .sbs-complete {
        text-align: center;
        padding: 30px 10px;
      }
      .sbs-complete-icon { font-size: 52px; margin-bottom: 16px; }
      .sbs-complete-title {
        font-size: 22px;
        font-weight: 700;
        color: #2F724C;
        margin-bottom: 10px;
      }
      .sbs-complete-text {
        font-size: 15px;
        color: #555;
        line-height: 1.6;
      }

      /* Nav */
      #sbs-nav {
        display: flex;
        gap: 10px;
        padding: 14px 18px;
        border-top: 1px solid #eee;
        background: #fff;
        flex-shrink: 0;
      }
      .sbs-btn {
        flex: 1;
        padding: 12px 14px;
        border-radius: 9px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s, opacity 0.15s;
        font-family: inherit;
      }
      .sbs-btn:disabled { opacity: 0.35; cursor: default; }
      .sbs-btn-secondary {
        background: #fff;
        color: #1428AA;
        border: 2px solid #d2daff;
      }
      .sbs-btn-secondary:hover:not(:disabled) { background: #e9ecfd; }
      .sbs-btn-primary {
        background: #1428AA;
        color: #fff;
        border: 2px solid #1428AA;
      }
      .sbs-btn-primary:hover:not(:disabled) { background: #0f1f85; }

      /* Toast */
      .sbs-toast {
        position: fixed;
        bottom: 90px;
        right: 24px;
        z-index: 2147483641;
        background: #1F1F1F;
        color: white;
        padding: 12px 18px;
        border-radius: 10px;
        font-size: 14px;
        font-family: system-ui, sans-serif;
        box-shadow: 0 4px 16px rgba(0,0,0,0.25);
        animation: sbs-fadein 0.25s ease;
      }
      @keyframes sbs-fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

      /* ====== CAMPO ATTIVO ====== */
      input.sbs-active,
      select.sbs-active,
      textarea.sbs-active {
        outline: 3px solid #1428AA !important;
        outline-offset: 3px !important;
        animation: sbs-pulse 2.2s ease-in-out infinite;
        border-radius: 6px;
      }
      @keyframes sbs-pulse {
        0%, 100% { outline-color: #1428AA; }
        50%       { outline-color: #526FFF; }
      }

      /* ====== CAMPI DIMMED ====== */
      input.sbs-dimmed,
      select.sbs-dimmed,
      textarea.sbs-dimmed {
        opacity: 0.38 !important;
        transition: opacity 0.3s;
      }
    `;
    document.head.appendChild(style);
  }
})();
