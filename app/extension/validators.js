/**
 * Step by Step — validators.js
 *
 * Nessuna rete, nessun modello, nessuna dipendenza. Tutto deterministico.
 * Vedi agents/validatori.md per le regole e i casi di test.
 *
 * Due superfici pubbliche:
 *   SBS.validate(kind, value)   -> verifica finale  { ok, message, chunkIndex }
 *   SBS.checkLive(kind, value)  -> verifica mentre scrive { state, message, charIndex, chunkIndex }
 */
(function () {
  'use strict';
  const SBS = (window.SBS = window.SBS || {});

  const CHUNK = 4;

  // ---------------------------------------------------------------------------
  // ASSEGNAZIONE DEL KIND — vedi agents/campi.md
  // Temporaneo: quando nasce scanner.js questa funzione si sposta lì.
  // ---------------------------------------------------------------------------
  function kindOf(el) {
    const key = ((el.id || '') + ' ' + (el.name || '')).toLowerCase();
    if (/codice_?fiscale|fiscal|(^|\W)cf(\W|$)/.test(key)) return 'cf';
    if (/iban/.test(key)) return 'iban';
    if (/pod/.test(key)) return 'pod';
    if (/pdr/.test(key)) return 'pdr';
    if (/cap|zip|postal/.test(key)) return 'cap';
    if (/mail/.test(key) || el.type === 'email') return 'email';
    if (/telefono|cellulare|phone|(^|\W)tel(\W|$)/.test(key) || el.type === 'tel') return 'tel';
    if (el.type === 'date' || /data_?nascita|data_?di/.test(key)) return 'data';
    if (el.tagName === 'SELECT' || el.type === 'radio') return 'select';
    return 'testo';
  }

  // ---------------------------------------------------------------------------
  // FORMA DEI CODICI
  //
  // Ogni posizione dichiara quali caratteri accetta. Serve a due cose: dire
  // subito quale carattere non torna mentre Sara scrive, e sapere se il codice
  // e' abbastanza ben formato da poterci calcolare sopra un checksum.
  // ---------------------------------------------------------------------------
  const DIGIT = { test: (c) => c >= '0' && c <= '9', what: 'una cifra' };
  const ALPHA = { test: (c) => c >= 'A' && c <= 'Z', what: 'una lettera' };
  const ALNUM = { test: (c) => /[A-Z0-9]/.test(c), what: 'una lettera o una cifra' };
  const lit = (ch) => ({ test: (c) => c === ch, what: 'la lettera ' + ch });
  const oneOf = (set, what) => ({ test: (c) => set.indexOf(c) !== -1, what: what });

  // Lettera del mese nel codice fiscale.
  const MONTH_LETTERS = 'ABCDEHLMPRST';

  function repeat(spec, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(spec);
    return out;
  }

  const SHAPES = {
    cf: []
      .concat(repeat(ALPHA, 6)) // cognome + nome
      .concat(repeat(DIGIT, 2)) // anno
      .concat([oneOf(MONTH_LETTERS, 'la lettera del mese')])
      .concat(repeat(DIGIT, 2)) // giorno
      .concat([ALPHA]) // lettera del comune
      .concat(repeat(DIGIT, 3)) // numero del comune
      .concat([ALPHA]), // carattere di controllo

    iban: []
      .concat([lit('I'), lit('T')])
      .concat(repeat(DIGIT, 2)) // cifre di controllo
      .concat([ALPHA]) // CIN
      .concat(repeat(DIGIT, 10)) // ABI + CAB
      .concat(repeat(ALNUM, 12)), // numero di conto

    pod: []
      .concat([lit('I'), lit('T')])
      .concat(repeat(DIGIT, 3)) // distributore
      .concat([lit('E')])
      .concat(repeat(ALNUM, 8)),

    pdr: repeat(DIGIT, 14),

    cap: repeat(DIGIT, 5),
  };

  // ---------------------------------------------------------------------------
  // SEGMENTI
  //
  // Un codice lungo non si legge a fette da 4: si legge a pezzi che vogliono
  // dire qualcosa. Questa e' l'unica segmentazione del progetto — la usano sia
  // i riquadri del pannello sia la spiegazione sotto, cosi' combaciano, e i
  // messaggi d'errore parlano dello stesso gruppo che Sara vede evidenziato.
  //
  // Dove non c'e' struttura (pdr) si torna ai blocchi da 4: e' il caso in cui
  // non abbiamo niente di meglio da offrire, e va detto.
  // ---------------------------------------------------------------------------
  const SEGMENTS = {
    cf: [
      { from: 0, to: 2, name: 'Cognome', label: 'il cognome' },
      { from: 3, to: 5, name: 'Nome', label: 'il nome' },
      { from: 6, to: 7, name: 'Anno', label: "l'anno di nascita" },
      { from: 8, to: 8, name: 'Mese', label: 'il mese' },
      { from: 9, to: 10, name: 'Giorno', label: 'il giorno' },
      { from: 11, to: 14, name: 'Comune', label: 'il Comune di nascita' },
      { from: 15, to: 15, name: 'Controllo', label: 'la lettera di controllo' },
    ],
    iban: [
      { from: 0, to: 1, name: 'Paese', label: 'il paese' },
      { from: 2, to: 3, name: 'Controllo', label: 'le cifre di controllo' },
      { from: 4, to: 4, name: 'CIN', label: 'il CIN' },
      { from: 5, to: 9, name: 'Banca', label: 'le cifre della banca' },
      { from: 10, to: 14, name: 'Filiale', label: 'le cifre della filiale' },
      { from: 15, to: 26, name: 'Conto', label: 'il numero di conto' },
    ],
    pod: [
      { from: 0, to: 1, name: 'Paese', label: 'il paese' },
      { from: 2, to: 4, name: 'Distributore', label: 'le cifre del distributore' },
      { from: 5, to: 5, name: 'Energia', label: 'la lettera E' },
      { from: 6, to: 13, name: 'Contatore', label: 'il codice del contatore' },
    ],
    pdr: null,
    cap: null,
  };

  // Email e telefono non hanno una struttura fissa: i loro pezzi dipendono da
  // quello che Sara ha scritto, quindi si calcolano.
  function segmentsOf(kind, raw) {
    if (kind === 'email') {
      const at = (raw || '').indexOf('@');
      if (at < 1 || at === raw.length - 1) return null;
      return [
        { from: 0, to: at - 1, name: 'Nome' },
        { from: at, to: at, name: 'Chiocciola' },
        { from: at + 1, to: raw.length - 1, name: 'Dominio' },
      ];
    }
    if (kind === 'tel') {
      const n = (raw || '').length;
      if (n < 4) return null;
      // Cellulare italiano: 3 + 3 + 4. Altrimenti a gruppi di 3.
      const cuts = raw[0] === '3' && n === 10 ? [3, 6] : [];
      if (!cuts.length) for (let i = 3; i < n; i += 3) cuts.push(i);
      const bounds = [0].concat(cuts, [n]);
      const out = [];
      for (let i = 0; i < bounds.length - 1; i++) {
        out.push({ from: bounds[i], to: bounds[i + 1] - 1, name: i === 0 ? 'Prefisso' : null });
      }
      return out;
    }
    return SEGMENTS[kind] || null;
  }

  function normalize(value) {
    return String(value == null ? '' : value)
      .replace(/[\s.\-/]/g, '')
      .toUpperCase();
  }

  // Prima posizione che non rispetta la forma, oppure -1.
  function firstBadChar(kind, raw) {
    const shape = SHAPES[kind];
    if (!shape) return -1;
    const n = Math.min(raw.length, shape.length);
    for (let i = 0; i < n; i++) {
      if (!shape[i].test(raw[i])) return i;
    }
    return -1;
  }

  function matchesShape(kind, raw) {
    const shape = SHAPES[kind];
    return !!shape && raw.length === shape.length && firstBadChar(kind, raw) === -1;
  }

  // Indice del gruppo che contiene questo carattere: il segmento se il codice
  // ne ha, altrimenti il blocco da 4.
  function chunkOf(charIndex, kind, raw) {
    const segs = segmentsOf(kind, raw);
    if (!segs) return Math.floor(charIndex / CHUNK);
    for (let i = 0; i < segs.length; i++) {
      if (charIndex >= segs[i].from && charIndex <= segs[i].to) return i;
    }
    return segs.length - 1;
  }

  // Come si chiama il gruppo n, per poterlo nominare nel messaggio.
  function chunkLabel(index, kind, raw) {
    const segs = segmentsOf(kind, raw);
    const seg = segs && segs[index];
    if (!seg) return null;
    return seg.label || (seg.name ? seg.name.toLowerCase() : null);
  }

  // ---------------------------------------------------------------------------
  // CODICE FISCALE — controllo matematico
  // ---------------------------------------------------------------------------
  const CF_ODD = {
    0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
    A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
    K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
    U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
  };

  function cfEvenValue(c) {
    return c >= '0' && c <= '9' ? c.charCodeAt(0) - 48 : c.charCodeAt(0) - 65;
  }

  function cfChecksumOk(raw) {
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      // Posizioni dispari in conteggio umano = indici pari.
      sum += i % 2 === 0 ? CF_ODD[raw[i]] : cfEvenValue(raw[i]);
    }
    return String.fromCharCode(65 + (sum % 26)) === raw[15];
  }

  // ---------------------------------------------------------------------------
  // IBAN — mod 97
  // ---------------------------------------------------------------------------
  function ibanChecksumOk(raw) {
    const moved = raw.slice(4) + raw.slice(0, 4);
    let rest = 0;
    for (let i = 0; i < moved.length; i++) {
      const c = moved[i];
      const piece = c >= '0' && c <= '9' ? c : String(c.charCodeAt(0) - 55);
      for (let j = 0; j < piece.length; j++) {
        rest = (rest * 10 + (piece.charCodeAt(j) - 48)) % 97;
      }
    }
    return rest === 1;
  }

  const CHECKSUM = { cf: cfChecksumOk, iban: ibanChecksumOk };

  // ---------------------------------------------------------------------------
  // DOVE E' L'ERRORE
  //
  // Il checksum dice che il codice e' sbagliato, non dove. Ma gli errori di
  // Sara sono di due tipi soli (agents/persona.md): scambio di due caratteri
  // adiacenti, e confusione fra caratteri che si somigliano. Proviamo a
  // correggere il codice in tutti quei modi: se le correzioni che funzionano
  // cadono tutte nello stesso gruppo di 4, quel gruppo e' il sospettato.
  //
  // Se le correzioni cadono in gruppi diversi non diciamo niente di preciso:
  // meglio tacere che mandare Sara a controllare il gruppo sbagliato.
  // ---------------------------------------------------------------------------
  const LOOKALIKE = {
    0: 'O', O: '0',
    1: 'IL', I: '1', L: '1',
    5: 'S', S: '5',
    2: 'Z', Z: '2',
    8: 'B', B: '8',
  };

  function locateError(kind, raw) {
    const ok = CHECKSUM[kind];
    if (!ok) return null;
    const chunks = new Set();

    // Scambio di due caratteri adiacenti.
    for (let i = 0; i < raw.length - 1; i++) {
      if (raw[i] === raw[i + 1]) continue;
      const swapped = raw.slice(0, i) + raw[i + 1] + raw[i] + raw.slice(i + 2);
      if (matchesShape(kind, swapped) && ok(swapped)) {
        chunks.add(chunkOf(i, kind));
        chunks.add(chunkOf(i + 1, kind));
      }
    }

    // Carattere confuso con uno che gli somiglia.
    for (let i = 0; i < raw.length; i++) {
      const alts = LOOKALIKE[raw[i]];
      if (!alts) continue;
      for (let k = 0; k < alts.length; k++) {
        const fixed = raw.slice(0, i) + alts[k] + raw.slice(i + 1);
        if (matchesShape(kind, fixed) && ok(fixed)) chunks.add(chunkOf(i, kind));
      }
    }

    return chunks.size === 1 ? chunks.values().next().value : null;
  }

  // ---------------------------------------------------------------------------
  // DATA
  // ---------------------------------------------------------------------------
  function validateDate(value) {
    const v = String(value || '').trim();
    if (!v) return null;
    let y, m, d;
    let match = v.match(/^(\d{4})-(\d{2})-(\d{2})$/); // input type=date
    if (match) {
      y = +match[1]; m = +match[2]; d = +match[3];
    } else {
      match = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); // gg/mm/aaaa
      if (!match) {
        return { ok: false, message: 'Scrivi la data come giorno/mese/anno. Esempio: 01/08/1985.', chunkIndex: null };
      }
      d = +match[1]; m = +match[2]; y = +match[3];
    }
    const probe = new Date(y, m - 1, d);
    if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d) {
      return { ok: false, message: 'Questa data non esiste. Controlla il giorno.', chunkIndex: null };
    }
    if (probe > new Date()) {
      return { ok: false, message: 'Questa data non è ancora arrivata. Controlla l\'anno.', chunkIndex: null };
    }
    return { ok: true, message: null, chunkIndex: null };
  }

  // ---------------------------------------------------------------------------
  // EMAIL
  //
  // Niente regex mostruose: controlliamo le cose che Sara sbaglia davvero, e
  // per ognuna sappiamo dire dove guardare.
  // ---------------------------------------------------------------------------
  function checkEmail(v, complete) {
    const space = v.search(/\s/);
    if (space !== -1) {
      return { message: 'C\'è uno spazio dentro l\'indirizzo. Toglilo.', charIndex: space };
    }

    const ats = (v.match(/@/g) || []).length;
    if (ats > 1) {
      return {
        message: 'Ci sono due chiocciole. Ne serve una sola.',
        charIndex: v.indexOf('@', v.indexOf('@') + 1),
      };
    }
    if (ats === 0) {
      return complete
        ? { message: 'Manca la chiocciola. Un indirizzo è fatto così: nome@esempio.it', charIndex: null }
        : null;
    }

    const at = v.indexOf('@');
    if (at === 0) return { message: 'Prima della chiocciola manca il nome.', charIndex: 0 };

    const domain = v.slice(at + 1);
    if (!domain) {
      return complete
        ? { message: 'Dopo la chiocciola manca il resto. Esempio: gmail.com', charIndex: at }
        : null;
    }

    const strange = domain.search(/[^A-Za-z0-9.\-]/);
    if (strange !== -1) {
      return {
        message: 'Dopo la chiocciola c\'è un carattere che non va bene.',
        charIndex: at + 1 + strange,
      };
    }
    if (domain.indexOf('.') === -1) {
      return complete
        ? { message: 'Dopo la chiocciola manca il punto. Esempio: gmail.com', charIndex: at + 1 }
        : null;
    }

    const tld = domain.slice(domain.lastIndexOf('.') + 1);
    if (tld.length < 2) {
      return complete
        ? { message: 'Manca la parte finale. Dopo l\'ultimo punto va .it oppure .com', charIndex: null }
        : null;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // TELEFONO
  //
  // Le cifre si staccano a gruppi perché dieci cifre di fila non si rileggono.
  // Vedi segmentsOf('tel').
  // ---------------------------------------------------------------------------
  function telDigits(value) {
    return String(value == null ? '' : value)
      .trim()
      .replace(/^\+39/, '')
      .replace(/^0039/, '')
      .replace(/[\s.\-()]/g, '');
  }

  function checkTel(raw, complete) {
    const bad = raw.search(/[^0-9]/);
    if (bad !== -1) {
      return { message: 'Qui vanno solo cifre. Il carattere «' + raw[bad] + '» non ci va.', charIndex: bad };
    }
    if (!complete) return null;
    if (raw[0] === '3' && raw.length !== 10) {
      return { message: 'Un numero di cellulare è di 10 cifre. Qui ne ho ' + raw.length + '.', charIndex: null };
    }
    if (raw.length < 9 || raw.length > 11) {
      return { message: 'Un numero di telefono ha da 9 a 11 cifre. Qui ne ho ' + raw.length + '.', charIndex: null };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // MESSAGGI — sempre con il passo successivo. Vedi agents/persona.md.
  // ---------------------------------------------------------------------------
  const LENGTH_MSG = {
    cf: (n) => `Il codice fiscale è di 16 caratteri. Qui ne ${n === 1 ? 'ho' : 'ho'} ${n}. Ricontrolla la tessera sanitaria.`,
    iban: (n) => `L'IBAN italiano è di 27 caratteri. Qui ne ho ${n}. Ricontrolla l'ultimo gruppo.`,
    pod: (n) => `Il codice POD è di 14 caratteri. Qui ne ho ${n}. Cerca in alto a destra sulla bolletta.`,
    pdr: (n) => `Il codice PDR è di 14 cifre. Qui ne ho ${n}. Cerca in alto a destra sulla bolletta.`,
    cap: () => 'Il CAP è di 5 cifre.',
  };

  // «il gruppo 3: l'anno di nascita» oppure «il gruppo 3», se non ha un nome.
  function groupRef(chunk, kind, raw) {
    const label = chunkLabel(chunk, kind, raw);
    return label ? `il gruppo ${chunk + 1}: ${label}` : `il gruppo ${chunk + 1}`;
  }

  const CHECKSUM_MSG = {
    cf: (chunk, kind) =>
      chunk === null
        ? 'Questo codice fiscale non torna. Ricontrolla la data di nascita: sono i caratteri dal 7° all\'11°.'
        : `Questo codice fiscale non torna. Guarda ${groupRef(chunk, kind)}.`,
    iban: (chunk, kind) =>
      chunk === null
        ? 'Questo IBAN non torna. Rileggilo un gruppo alla volta, dal primo.'
        : `Questo IBAN non torna. Guarda ${groupRef(chunk, kind)}. Lì potresti aver sbagliato un carattere.`,
  };

  // ---------------------------------------------------------------------------
  // VERIFICA FINALE
  // ---------------------------------------------------------------------------
  function validate(kind, value) {
    if (kind === 'email') {
      const v = String(value == null ? '' : value).trim();
      if (!v) return { ok: true, message: null, chunkIndex: null };
      const bad = checkEmail(v, true);
      return bad
        ? { ok: false, message: bad.message, chunkIndex: bad.charIndex === null ? null : chunkOf(bad.charIndex, 'email', v) }
        : { ok: true, message: null, chunkIndex: null };
    }

    if (kind === 'tel') {
      const raw = telDigits(value);
      if (!raw) return { ok: true, message: null, chunkIndex: null };
      const bad = checkTel(raw, true);
      return bad
        ? { ok: false, message: bad.message, chunkIndex: bad.charIndex === null ? null : chunkOf(bad.charIndex, 'tel', raw) }
        : { ok: true, message: null, chunkIndex: null };
    }

    if (kind === 'data') {
      const res = validateDate(value);
      return res || { ok: true, message: null, chunkIndex: null };
    }

    const shape = SHAPES[kind];
    if (!shape) return { ok: true, message: null, chunkIndex: null };

    const raw = normalize(value);
    if (!raw) return { ok: true, message: null, chunkIndex: null };

    if (raw.length !== shape.length) {
      return { ok: false, message: LENGTH_MSG[kind](raw.length), chunkIndex: null };
    }

    const bad = firstBadChar(kind, raw);
    if (bad !== -1) {
      return {
        ok: false,
        message: `Il carattere «${raw[bad]}» non torna. Nel gruppo ${chunkOf(bad, kind, raw) + 1} ci va ${shape[bad].what}.`,
        chunkIndex: chunkOf(bad, kind),
      };
    }

    const checksum = CHECKSUM[kind];
    if (checksum && !checksum(raw)) {
      const chunk = locateError(kind, raw);
      return { ok: false, message: CHECKSUM_MSG[kind](chunk, kind), chunkIndex: chunk };
    }

    return { ok: true, message: null, chunkIndex: null };
  }

  // ---------------------------------------------------------------------------
  // VERIFICA MENTRE SCRIVE
  //
  // state: 'vuoto' | 'in-corso' | 'ok' | 'errore'
  // Mentre il codice e' incompleto segnaliamo solo i caratteri impossibili:
  // il checksum non si puo' ancora calcolare, e dire "sbagliato" a meta'
  // strada sarebbe falso.
  // ---------------------------------------------------------------------------
  function checkLive(kind, value) {
    if (kind === 'email' || kind === 'tel') {
      const raw = kind === 'tel' ? telDigits(value) : String(value == null ? '' : value).trim();
      if (!raw) return { state: 'vuoto', message: null, charIndex: null, chunkIndex: null, raw: '', expected: null };

      // "Completo" vuol dire: ha smesso di scrivere, o il numero e' lungo abbastanza.
      const complete = kind === 'tel' ? raw.length >= 9 : raw.indexOf('@') !== -1 && raw.indexOf('.', raw.indexOf('@')) !== -1;
      const bad = kind === 'tel' ? checkTel(raw, complete) : checkEmail(raw, complete);

      if (bad) {
        return {
          state: 'errore',
          message: bad.message,
          charIndex: bad.charIndex,
          chunkIndex: bad.charIndex === null ? null : chunkOf(bad.charIndex, kind, raw),
          raw: raw,
          expected: null,
        };
      }
      return {
        state: complete ? 'ok' : 'in-corso',
        message: null,
        charIndex: null,
        chunkIndex: null,
        raw: raw,
        expected: null,
      };
    }

    const shape = SHAPES[kind];
    const raw = normalize(value);

    if (!raw) return { state: 'vuoto', message: null, charIndex: null, chunkIndex: null, raw: '', expected: shape ? shape.length : null };
    if (!shape) return { state: 'ok', message: null, charIndex: null, chunkIndex: null, raw: raw, expected: null };

    const bad = firstBadChar(kind, raw);
    if (bad !== -1) {
      return {
        state: 'errore',
        message: `Il carattere «${raw[bad]}» non torna. Qui ci va ${shape[bad].what}.`,
        charIndex: bad,
        chunkIndex: chunkOf(bad, kind),
        raw: raw,
        expected: shape.length,
      };
    }

    if (raw.length < shape.length) {
      return {
        state: 'in-corso',
        message: null,
        charIndex: null,
        chunkIndex: null,
        raw: raw,
        expected: shape.length,
      };
    }

    if (raw.length > shape.length) {
      return {
        state: 'errore',
        message: LENGTH_MSG[kind](raw.length),
        charIndex: shape.length,
        chunkIndex: chunkOf(shape.length, kind),
        raw: raw,
        expected: shape.length,
      };
    }

    const res = validate(kind, raw);
    return {
      state: res.ok ? 'ok' : 'errore',
      message: res.message,
      charIndex: null,
      chunkIndex: res.chunkIndex,
      raw: raw,
      expected: shape.length,
    };
  }

  // Divide in gruppi da 4 per la rilettura a specchio.
  function chunksOf(raw) {
    const out = [];
    for (let i = 0; i < raw.length; i += CHUNK) out.push(raw.slice(i, i + CHUNK));
    return out;
  }

  SBS.CHUNK = CHUNK;
  SBS.kindOf = kindOf;
  SBS.validate = validate;
  SBS.checkLive = checkLive;
  SBS.chunksOf = chunksOf;
  SBS.segmentsOf = segmentsOf;
  SBS.chunkOf = chunkOf;
  SBS.normalize = normalize;
  SBS.hasValidator = (kind) => !!SHAPES[kind] || kind === 'data' || kind === 'email' || kind === 'tel';

  // Esposto per i test in node (vedi tools/test-validators.js).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { validate, checkLive, kindOf, chunksOf, normalize, segmentsOf };
  }
})();
