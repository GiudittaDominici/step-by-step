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

  const SBS = (window.SBS = window.SBS || {});

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
    },
    sesso: {
      icon: '⚧',
      label: 'Sesso anagrafico',
      instruction: "Com'è scritto sul tuo documento?",
      detail: 'Leggi le opzioni qui sotto e scegli.',
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
      instruction: 'A cosa serve la fornitura?',
      detail: 'Leggi le due opzioni qui sotto e scegli.',
      tip: null,
      type: 'select',
    },
    potenza: {
      icon: '⚡',
      label: 'Potenza impegnata',
      instruction: 'Quanta corrente può usare la casa insieme?',
      detail: 'Leggi le opzioni qui sotto. Se non lo sai, guarda la vecchia bolletta.',
      tip: null,
      type: 'select',
    },
    pod: {
      icon: '⚡',
      label: 'Codice POD',
      instruction: 'Inserisci il codice POD del tuo contatore elettrico.',
      detail: '14 caratteri in totale: inizia sempre con IT, seguito da numeri e lettere. Lo trovi sulla bolletta della luce, in alto o al centro della pagina.',
      tip: '💡 Hai una bolletta vecchia? Cerca "POD" o "Punto di prelievo" — il codice inizia con IT e ha l\'aspetto: IT001E12345678.',
      type: 'pod',
    },
    pdr: {
      icon: '🔥',
      label: 'Codice PDR',
      instruction: 'Inserisci il codice PDR del tuo contatore del gas.',
      detail: '14 cifre numeriche. Lo trovi sulla bolletta del gas, solitamente in alto a destra o nella sezione "Dati fornitura".',
      tip: '💡 Cerca "PDR" o "Punto di Riconsegna" sulla bolletta. È una sequenza di soli numeri, es. 04154895190000.',
      type: 'pdr',
    },
    iban: {
      icon: '🏦',
      label: 'IBAN',
      instruction: 'Inserisci il tuo IBAN per la domiciliazione bancaria.',
      detail: '27 caratteri in totale: inizia sempre con IT seguito da numeri e lettere.',
      tip: '💡 Lo trovi nell\'app della tua banca → "Dettagli conto" → IBAN. Oppure in cima all\'estratto conto cartaceo.',
      type: 'iban',
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
    fieldFocusHandlers: [],
    programmaticFocus: false,
    detachLive: null,
    forcedStep: null,
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
    SBS.live.injectStyles();
    SBS.live.resetRecorded();
    SBS.profile.load().then(startGuide);
  }

  function startGuide() {
    state.fields = discoverFields();
    if (state.fields.length === 0) {
      showToast('Nessun campo trovato in questa pagina.');
      return;
    }
    state.active = true;

    const btn = document.getElementById('sbs-activate');
    if (btn) btn.style.display = 'none';

    createPanel();
    attachFocusTracking();
    goToStep(0);
  }

  // ---------------------------------------------------------------------------
  // FOCUS TRACKING — risponde al focus manuale dell'utente su un campo
  // ---------------------------------------------------------------------------
  function attachFocusTracking() {
    state.fieldFocusHandlers = [];
    state.fields.forEach(({ element }, idx) => {
      const handler = () => {
        if (!state.active || state.programmaticFocus) return;
        if (idx !== state.currentStep) goToStep(idx);
      };
      element.addEventListener('focus', handler);
      state.fieldFocusHandlers.push({ element, handler });
    });
  }

  // ---------------------------------------------------------------------------
  // SCOPERTA DEI CAMPI
  // ---------------------------------------------------------------------------
  function discoverFields() {
    const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'file']);
    const fields = [];
    const seenRadioGroups = new Set();

    document.querySelectorAll('input, select, textarea').forEach((el) => {
      if (SKIP_TYPES.has(el.type)) return;
      if (!el.offsetParent) return; // elemento nascosto

      // Le radio con lo stesso name sono UNA domanda, non una per opzione.
      // Senza questo il pannello chiede due volte la stessa cosa.
      if (el.type === 'radio') {
        if (!el.name || seenRadioGroups.has(el.name)) return;
        seenRadioGroups.add(el.name);
      }

      // Per un gruppo di radio la chiave è il name: l'id cambia da opzione a opzione.
      const id = el.type === 'radio' ? el.name : (el.id || el.name || '');
      const guide = FIELD_GUIDE[id] || inferGuide(el);
      fields.push({ element: el, id, guide });
    });

    return fields;
  }

  function inferGuide(el) {
    let labelText = '';

    // Per una radio, la label che la avvolge è il testo dell'opzione, non la
    // domanda. La domanda sta nella legend del fieldset.
    if (el.type === 'radio') {
      const legend = el.closest('fieldset') && el.closest('fieldset').querySelector('legend');
      if (legend) labelText = legend.textContent.replace(/[*:]+/g, '').trim();
    }

    const labelEl =
      el.closest('label') ||
      (el.id ? document.querySelector(`label[for="${el.id}"]`) : null);
    if (!labelText && labelEl) labelText = labelEl.textContent.trim().replace(/[*:]+$/, '').trim();

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
        <div id="sbs-warn" aria-live="assertive"></div>
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
    document.getElementById('sbs-next').addEventListener('click', attemptNext);
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
    const warnBox = document.getElementById('sbs-warn');
    if (warnBox) warnBox.innerHTML = '';
    if (state.forcedStep !== index) state.forcedStep = null;
    state.currentStep = index;
    const { element, guide } = state.fields[index];

    const kind = SBS.kindOf(element);
    updatePanel(guide, index, kind, state.fields[index].id);
    highlightFields(element);

    // Scroll verso il campo attivo
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Verifica dal vivo: blocchi da 4, gruppo sospetto, scomposizione.
    // Quanto parla lo decide il profilo d'errore (vedi live.js).
    if (state.detachLive) {
      state.detachLive();
      state.detachLive = null;
    }
    state.detachLive = SBS.live.attach(element, kind, document.getElementById('sbs-preview'));

    // Sposta il focus sul campo: il flag impedisce che il nostro listener
    // di focus interpreti questo cambio come una navigazione manuale.
    state.programmaticFocus = true;
    element.focus();
    state.programmaticFocus = false;

    // Timer inattività: 20 secondi senza input → suggerimento extra
    state.inactivityTimer = setTimeout(() => showIdleHint(guide), 20000);
    element.addEventListener('input', clearInactivityTimer, { once: true });
  }

  // ---------------------------------------------------------------------------
  // AGGIORNAMENTO PANNELLO
  // ---------------------------------------------------------------------------
  function updatePanel(guide, index, kind, id) {
    const total = state.fields.length;
    const pct = Math.round(((index + 1) / total) * 100);

    document.getElementById('sbs-progress-bar').style.width = `${pct}%`;
    document.getElementById('sbs-progress-track').setAttribute('aria-valuenow', pct);
    document.getElementById('sbs-step-counter').textContent = `Passo ${index + 1} di ${total}`;

    // Supporto 'muto': su questo campo Sara è autonoma da due compilazioni.
    // Muto vuol dire muto, anche qui sopra: restano l'etichetta e il conteggio,
    // così sa dov'è, e nient'altro. Vedi la regola in agents/spec.md.
    const muto = SBS.profile.supportFor(kind) === 'muto';

    // I testi vengono da copy.js quando ci sono: è la sorgente unica, scritta
    // sulle regole di agents/persona.md. FIELD_GUIDE resta come riserva per i
    // campi che copy.js non copre (nome, indirizzo, e simili).
    const copy = SBS.copyFor(kind, id);
    const instruction = copy ? copy.what : guide.instruction;
    const detail = copy ? copy.where : guide.detail;
    const tip = copy ? (copy.example ? 'Esempio: ' + copy.example : null) : guide.tip;

    document.getElementById('sbs-field-icon').textContent = muto ? '' : guide.icon;
    document.getElementById('sbs-field-label').textContent = guide.label;
    document.getElementById('sbs-instruction').textContent = muto ? '' : instruction || '';
    document.getElementById('sbs-detail').textContent = muto ? 'Questo lo sai fare.' : detail || '';
    document.getElementById('sbs-idle-hint').innerHTML = '';

    const tipWrap = document.getElementById('sbs-tip-wrap');
    tipWrap.innerHTML = !muto && tip ? `<div class="sbs-tip">${tip}</div>` : '';

    const prevBtn = document.getElementById('sbs-prev');
    const nextBtn = document.getElementById('sbs-next');
    prevBtn.disabled = index === 0;
    nextBtn.textContent = index === total - 1 ? 'Invia modulo ✓' : 'Avanti →';
  }

  // ---------------------------------------------------------------------------
  // HIGHLIGHT / DIM DEI CAMPI
  // ---------------------------------------------------------------------------
  function highlightFields(activeEl) {
    // Un gruppo di radio si accende tutto: è una domanda sola, e attenuare
    // metà delle opzioni nasconde parte della domanda che stiamo facendo.
    const isActive = (el) =>
      el === activeEl ||
      (activeEl.type === 'radio' && el.type === 'radio' && el.name === activeEl.name);

    document.querySelectorAll('.sbs-active-group').forEach((g) => g.classList.remove('sbs-active-group'));

    document.querySelectorAll('input, select, textarea').forEach((el) => {
      el.classList.remove('sbs-active', 'sbs-dimmed');
      if (isActive(el)) {
        el.classList.add('sbs-active');
      } else {
        el.classList.add('sbs-dimmed');
      }
    });

    // Per una radio l'input è il pallino: un contorno lì non si vede come il
    // campo attivo. Il contorno va intorno alla domanda intera, cioè al
    // fieldset che la contiene.
    if (activeEl.type === 'radio') {
      const box = activeEl.closest('fieldset') || activeEl.closest('.radio-group');
      if (box) box.classList.add('sbs-active-group');
    }
  }

  function unhighlightField(el) {
    el.classList.remove('sbs-active');
    const box = el.closest && (el.closest('fieldset') || el.closest('.radio-group'));
    if (box) box.classList.remove('sbs-active-group');
  }

  function clearAllHighlights() {
    document.querySelectorAll('.sbs-active, .sbs-dimmed, .sbs-active-group').forEach((el) => {
      el.classList.remove('sbs-active', 'sbs-dimmed', 'sbs-active-group');
    });
  }

  // ---------------------------------------------------------------------------
  // PREVIEW CHUNKED (Codice Fiscale, IBAN, ecc.)
  // ---------------------------------------------------------------------------
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
    const field = state.fields[state.currentStep];
    SBS.log && SBS.log('help_opened', { id: field ? field.id : null, motivo: 'inattività' });
    const msg = guide.tip || 'Hai bisogno di aiuto? Puoi saltare questo campo per ora con il pulsante "Avanti".';
    hint.innerHTML = `<div class="sbs-idle-box">🤔 ${msg}</div>`;
  }

  // ---------------------------------------------------------------------------
  // SCHERMATA FINALE
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // STATO DI UN CAMPO
  //
  // Un campo saltato non e' un campo finito. Prima di questa funzione il
  // pannello avanzava sempre, e Sara arrivava in fondo credendo di aver
  // compilato tutto.
  // ---------------------------------------------------------------------------
  function isRequired(el) {
    if (el.required) return true;
    if (el.type === 'radio' && el.name) {
      return !!document.querySelector('input[name="' + CSS.escape(el.name) + '"][required]');
    }
    return false;
  }

  function isFilled(el) {
    if (el.type === 'radio' && el.name) {
      return !!document.querySelector('input[name="' + CSS.escape(el.name) + '"]:checked');
    }
    return String(el.value || '').trim() !== '';
  }

  // { ok, stato: 'ok'|'vuoto'|'errore'|'facoltativo', message }
  function fieldStatus(field) {
    const el = field.element;
    const kind = SBS.kindOf(el);

    if (!isFilled(el)) {
      return isRequired(el)
        ? { ok: false, stato: 'vuoto', message: 'Questo campo è ancora vuoto.' }
        : { ok: true, stato: 'facoltativo', message: null };
    }

    const res = SBS.validate(kind, el.value);
    return res.ok
      ? { ok: true, stato: 'ok', message: null }
      : { ok: false, stato: 'errore', message: res.message };
  }

  function openProblems() {
    return state.fields
      .map((field, index) => ({ field: field, index: index, status: fieldStatus(field) }))
      .filter((row) => !row.status.ok);
  }

  // ---------------------------------------------------------------------------
  // AVANTI
  //
  // Avanti verifica. Se qualcosa non torna lo dice e lascia comunque passare,
  // ma con un clic esplicito: Sara decide, non viene bloccata e non viene
  // fatta avanzare per distrazione.
  // ---------------------------------------------------------------------------
  function attemptNext() {
    const field = state.fields[state.currentStep];
    if (!field) return goToStep(state.currentStep + 1);

    const status = fieldStatus(field);
    if (status.ok) {
      // Nessun errore intercettato su questo campo: l'ha fatto da sola.
      // È la metrica che dice se il progetto sta funzionando davvero.
      if (status.stato === 'ok' && !SBS.live.hadError(field.element)) {
        SBS.log && SBS.log('field_completed_unaided', {
          id: field.id,
          kind: SBS.kindOf(field.element),
        });
      }
      return goToStep(state.currentStep + 1);
    }
    if (state.forcedStep === state.currentStep) {
      return goToStep(state.currentStep + 1);
    }

    state.forcedStep = state.currentStep;
    SBS.log && SBS.log('field_incomplete', { id: field.id, stato: status.stato });

    const warn = document.getElementById('sbs-warn');
    if (!warn) return goToStep(state.currentStep + 1);
    warn.innerHTML =
      '<div class="sbs-warn-box">' +
      '<strong>' + esc(status.message) + '</strong>' +
      '<button type="button" id="sbs-skip">Vai avanti lo stesso</button>' +
      '</div>';
    document.getElementById('sbs-skip').addEventListener('click', () => {
      SBS.log && SBS.log('field_skipped', { id: field.id, stato: status.stato });
      goToStep(state.currentStep + 1);
    });
  }

  // ---------------------------------------------------------------------------
  // RIEPILOGO
  // ---------------------------------------------------------------------------
  function showComplete(reason) {
    clearAllHighlights();
    if (state.detachLive) {
      state.detachLive();
      state.detachLive = null;
    }

    const problems = openProblems();
    const content = document.getElementById('sbs-content');
    const nav = document.getElementById('sbs-nav');

    let head = '';
    if (reason === 'submit-ko') {
      head =
        '<div class="sbs-review-head">Il portale ha rifiutato il modulo.</div>' +
        '<p class="sbs-review-sub">Non dice quale campo. Guardiamo insieme.</p>';
    } else if (problems.length) {
      head =
        '<div class="sbs-review-head">Manca ancora qualcosa.</div>' +
        '<p class="sbs-review-sub">Tocca una riga per tornare sul campo.</p>';
    } else {
      head =
        '<div class="sbs-review-head">Tutto verificato.</div>' +
        '<p class="sbs-review-sub">I codici tornano. Puoi inviare il modulo.</p>';
    }

    const rows = problems
      .map(
        (row) =>
          '<button type="button" class="sbs-review-row" data-step="' + row.index + '">' +
          '<strong>' + esc(row.field.guide.label) + '</strong>' +
          '<span>' + esc(row.status.message) + '</span>' +
          '</button>'
      )
      .join('');

    content.innerHTML = head + (rows ? '<div class="sbs-review">' + rows + '</div>' : '');

    content.querySelectorAll('.sbs-review-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        restoreStepLayout();
        goToStep(+btn.dataset.step);
      });
    });

    const progress = document.getElementById('sbs-progress-bar');
    if (progress) progress.style.width = '100%';
    document.getElementById('sbs-step-counter').textContent = problems.length
      ? problems.length + (problems.length === 1 ? ' campo da rivedere' : ' campi da rivedere')
      : 'Tutto verificato';

    nav.innerHTML =
      '<button class="sbs-btn sbs-btn-secondary" id="sbs-back-fields">Torna ai campi</button>' +
      '<button class="sbs-btn sbs-btn-primary" id="sbs-close-final">Chiudi</button>';
    document.getElementById('sbs-close-final').addEventListener('click', deactivate);
    document.getElementById('sbs-back-fields').addEventListener('click', () => {
      restoreStepLayout();
      goToStep(problems.length ? problems[0].index : 0);
    });
  }

  // Il riepilogo sostituisce il contenuto del pannello: per tornare ai campi
  // va rimessa la struttura che goToStep si aspetta di trovare.
  function restoreStepLayout() {
    document.getElementById('sbs-content').innerHTML =
      '<div id="sbs-field-icon" aria-hidden="true"></div>' +
      '<div id="sbs-field-label"></div>' +
      '<div id="sbs-instruction"></div>' +
      '<div id="sbs-detail"></div>' +
      '<div id="sbs-preview" aria-live="polite"></div>' +
      '<div id="sbs-warn" aria-live="assertive"></div>' +
      '<div id="sbs-tip-wrap"></div>' +
      '<div id="sbs-idle-hint" aria-live="polite"></div>';

    document.getElementById('sbs-nav').innerHTML =
      '<button id="sbs-prev" class="sbs-btn sbs-btn-secondary">← Indietro</button>' +
      '<button id="sbs-next" class="sbs-btn sbs-btn-primary">Avanti →</button>';
    document.getElementById('sbs-prev').addEventListener('click', () => goToStep(state.currentStep - 1));
    document.getElementById('sbs-next').addEventListener('click', attemptNext);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
    );
  }

  // ---------------------------------------------------------------------------
  // ESITO DELL'INVIO
  //
  // Il momento in cui il portale dice «Dati non validi» e' esattamente quello
  // in cui Sara ha bisogno di noi. Prima l'assistente si chiudeva e la
  // lasciava sola davanti al messaggio.
  // ---------------------------------------------------------------------------
  document.addEventListener('portal:submit', (e) => {
    const ok = !!(e.detail && e.detail.ok);

    if (ok) {
      SBS.profile.endForm(state.fields.map(({ element }) => SBS.kindOf(element)));
      if (state.active) showSummary();
      return;
    }

    // Rifiutato: riapriamo l'assistente sul riepilogo, anche se era chiuso.
    if (!state.active) {
      if (!state.fields.length) state.fields = discoverFields();
      state.active = true;
      const btn = document.getElementById('sbs-activate');
      if (btn) btn.style.display = 'none';
      if (!state.panel) createPanel();
      attachFocusTracking();
    }
    showComplete('submit-ko');
  });

  // Chiusura: cosa e' successo, in numeri. E' il punto 4 della definition of
  // done in agents/spec.md.
  function showSummary() {
    clearAllHighlights();
    if (state.detachLive) {
      state.detachLive();
      state.detachLive = null;
    }

    const snap = SBS.profile.snapshot();
    const kinds = Object.keys(snap.supportByKind);
    const errori = Object.keys(snap.errorsByKind).reduce((n, k) => n + snap.errorsByKind[k], 0);
    const muti = kinds.filter((k) => snap.supportByKind[k] === 'muto');

    const righe = kinds
      .map(
        (k) =>
          '<div class="sbs-sum-row"><code>' + esc(k) + '</code>' +
          '<span>' + esc(snap.supportByKind[k]) + '</span></div>'
      )
      .join('');

    document.getElementById('sbs-content').innerHTML =
      '<div class="sbs-review-head">Modulo inviato.</div>' +
      '<p class="sbs-review-sub">Errori intercettati prima dell' + String.fromCharCode(39) +
      'invio: <strong>' + errori + '</strong>. Moduli completati: <strong>' +
      snap.formsCompleted + '</strong>.</p>' +
      (righe ? '<div class="sbs-sum">' + righe + '</div>' : '') +
      (muti.length
        ? '<p class="sbs-review-sub">Al prossimo modulo non ti dirò più niente su: ' +
          esc(muti.join(', ')) + '.</p>'
        : '');

    document.getElementById('sbs-step-counter').textContent = 'Inviato';
    const nav = document.getElementById('sbs-nav');
    nav.innerHTML = '<button class="sbs-btn sbs-btn-primary" id="sbs-close-final" style="width:100%">Chiudi</button>';
    document.getElementById('sbs-close-final').addEventListener('click', deactivate);
  }

  // ---------------------------------------------------------------------------
  // DISATTIVAZIONE
  // ---------------------------------------------------------------------------
  function deactivate() {
    state.active = false;
    if (state.detachLive) {
      state.detachLive();
      state.detachLive = null;
    }
    clearInactivityTimer();
    clearAllHighlights();

    state.fieldFocusHandlers.forEach(({ element, handler }) => {
      element.removeEventListener('focus', handler);
    });
    state.fieldFocusHandlers = [];

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

      /* Avviso su Avanti */
      .sbs-warn-box {
        margin-top: 14px;
        background: #FFFBF0;
        border: 1.5px solid #F0C040;
        border-radius: 10px;
        padding: 12px 14px;
      }
      .sbs-warn-box strong {
        display: block;
        font-size: 14px;
        font-weight: 600;
        color: #7a5c00;
        line-height: 1.5;
        margin-bottom: 9px;
      }
      .sbs-warn-box button {
        background: none;
        border: 1.5px solid #d8b45e;
        border-radius: 7px;
        padding: 7px 12px;
        font-size: 13px;
        font-weight: 600;
        color: #7a5c00;
        cursor: pointer;
        font-family: inherit;
      }
      .sbs-warn-box button:hover { background: #F7EBCE; }

      /* Riepilogo */
      .sbs-review-head {
        font-size: 20px;
        font-weight: 700;
        color: #1F1F1F;
        line-height: 1.35;
        margin-bottom: 8px;
      }
      .sbs-review-sub {
        font-size: 14.5px;
        color: #4A5568;
        line-height: 1.6;
        margin: 0 0 16px;
      }
      .sbs-review { display: flex; flex-direction: column; gap: 8px; }
      .sbs-review-row {
        display: block;
        width: 100%;
        text-align: left;
        border: 1.5px solid #FFCFDE;
        background: #FFF0F4;
        border-radius: 10px;
        padding: 11px 13px;
        cursor: pointer;
        font-family: inherit;
      }
      .sbs-review-row:hover { border-color: #E5003F; }
      .sbs-review-row strong {
        display: block;
        font-size: 14px;
        color: #BB003A;
        margin-bottom: 2px;
      }
      .sbs-review-row span {
        display: block;
        font-size: 13px;
        color: #8a3c58;
        line-height: 1.45;
      }

      /* Metriche */
      .sbs-sum { display: flex; flex-direction: column; gap: 1px; background: #e9ecfd; border-radius: 8px; overflow: hidden; }
      .sbs-sum-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #fff;
        padding: 8px 12px;
        font-size: 13px;
      }
      .sbs-sum-row code {
        font-family: 'SF Mono', Consolas, monospace;
        font-weight: 700;
        color: #1428AA;
      }
      .sbs-sum-row span { color: #6B7385; }

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
      /* Le radio no: il loro contorno sta sul fieldset, qui sotto. */
      input.sbs-active:not([type="radio"]),
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

      /* Gruppo di radio attivo: la domanda intera, non i singoli pallini. */
      .sbs-active-group {
        outline: 3px solid #1428AA !important;
        outline-offset: 8px !important;
        border-radius: 6px;
        animation: sbs-pulse 2.2s ease-in-out infinite;
      }
      .sbs-active-group input.sbs-dimmed,
      .sbs-active-group select.sbs-dimmed {
        opacity: 1 !important;
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
