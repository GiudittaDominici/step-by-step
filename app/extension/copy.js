/**
 * Step by Step — copy.js
 *
 * Tutti i testi che Sara legge. Regole di tono in agents/persona.md:
 * italiano semplice, seconda persona, una frase per idea, niente emoji,
 * niente esclamativi, mai un errore senza il passo successivo.
 *
 * Nota: spec.md prevedeva copy.json. Un content script MV3 non puo' leggere
 * un .json senza web_accessible_resources e una fetch, quindi e' un .js.
 * Il contenuto e la forma restano quelli del contratto.
 *
 * Struttura per kind:
 *   what      cosa vuole il campo, una frase
 *   where     dove trovarlo
 *   example   esempio di formato
 *   remember  cosa portarsi via per la prossima volta
 *
 * La divisione dei codici in pezzi sta in validators.js (SEGMENTS), non qui:
 * una sola segmentazione per tutto il progetto.
 */
(function () {
  'use strict';
  const SBS = (window.SBS = window.SBS || {});

  const MONTHS = {
    A: 'gennaio', B: 'febbraio', C: 'marzo', D: 'aprile',
    E: 'maggio', H: 'giugno', L: 'luglio', M: 'agosto',
    P: 'settembre', R: 'ottobre', S: 'novembre', T: 'dicembre',
  };

  // Cosa vuol dire ogni pezzo del codice.
  //
  // La divisione in pezzi NON sta qui: sta in validators.js, in SEGMENTS, ed è
  // una sola per tutto il progetto. Qui ci sono solo i significati, agganciati
  // per nome. Se i riquadri del pannello e questa spiegazione si scollassero,
  // Sara leggerebbe due divisioni diverse dello stesso codice.
  const MEANINGS = {
    cf: {
      Cognome: 'le prime tre consonanti del tuo cognome',
      Nome: 'tre consonanti del tuo nome',
      Anno: 'le ultime due cifre dell\'anno in cui sei nata',
      Mese: 'una lettera per il mese',
      Giorno: 'il giorno di nascita. Per le donne si somma 40',
      Comune: 'il codice del Comune dove sei nata',
      Controllo: 'una lettera calcolata dalle altre quindici',
    },
    iban: {
      Paese: 'IT, sempre, per un conto italiano',
      Controllo: 'due cifre calcolate da tutto il resto',
      CIN: 'una lettera di controllo',
      Banca: 'cinque cifre: dicono qual è la tua banca',
      Filiale: 'cinque cifre: dicono quale sportello',
      Conto: 'il numero del tuo conto',
    },
    pod: {
      Paese: 'IT, sempre',
      Distributore: 'tre cifre: chi porta la corrente a casa tua',
      Energia: 'la lettera E sta per energia elettrica',
      Contatore: 'otto caratteri: il tuo contatore',
    },
    email: {
      Nome: 'come ti chiami nella tua casella di posta',
      Chiocciola: 'separa il nome dal resto',
      Dominio: 'chi ti dà la posta: gmail.com, libero.it, e così via',
    },
    // Il telefono non ha una scomposizione: le cifre si staccano solo per
    // poterle rileggere. Niente MEANINGS qui vuol dire niente lista sotto,
    // e i riquadri restano l'unica divisione mostrata.
  };

  const COPY = {
    cf: {
      what: 'Copia il tuo codice fiscale.',
      where: 'Sta sulla tessera sanitaria, sul fronte, sotto il nome.',
      example: 'RSSMRA85M01H501Q',
      remember:
        'Le prime sei lettere sono il tuo cognome e il tuo nome. Se le leggi e non ti ' +
        'somigliano, hai copiato la riga sbagliata.',
    },

    iban: {
      what: 'Copia l\'IBAN del conto da cui pagherai.',
      where: 'Lo trovi nell\'app della banca, nella pagina del conto.',
      example: 'IT60X0542811101000000123456',
      remember:
        'Le prime due lettere sono sempre IT. Le due cifre dopo sono un controllo: se ' +
        'sbagli un carattere in mezzo, non tornano più. Per questo lo possiamo verificare qui.',
    },

    pod: {
      what: 'Copia il codice POD della luce.',
      where: 'Sta sulla bolletta della luce, in alto a destra.',
      example: 'IT001E12345678',
      remember:
        'IT, tre cifre, poi una E isolata. Quella E è l\'appiglio: se al sesto posto non ' +
        'c\'è una E, stai copiando male.',
    },

    pdr: {
      what: 'Copia il codice PDR del gas.',
      where: 'Sta sulla bolletta del gas, in alto a destra.',
      example: '01234567890123',
      remember:
        'Il PDR è solo cifre, senza appigli. Qui l\'unico modo sicuro è copiarlo a gruppi ' +
        'di quattro e rileggerlo un gruppo alla volta.',
    },

    email: {
      what: 'Scrivi il tuo indirizzo email.',
      where: 'Quello che usi di solito. Ci arriverà la conferma del contratto.',
      example: 'sara.bianchi@gmail.com',
      remember:
        'Un indirizzo ha sempre tre pezzi: il nome, la chiocciola, e il dominio con un ' +
        'punto dentro. Se manca uno dei tre, non è un indirizzo.',
    },

    tel: {
      what: 'Scrivi il tuo numero di telefono.',
      where: 'Se è un cellulare sono 10 cifre e comincia per 3.',
      example: '340 123 4567',
      remember:
        'Scrivilo a gruppi: tre cifre, tre cifre, quattro. Si rilegge molto meglio che ' +
        'tutto attaccato.',
    },

    cap: {
      what: 'Scrivi il CAP dell\'indirizzo di fornitura.',
      where: 'È il codice postale del Comune. Cinque cifre.',
      example: '20123',
      remember: null,
    },

    data: {
      what: 'Inserisci la tua data di nascita.',
      where: 'Come sulla carta d\'identità.',
      example: '01/08/1985',
      remember: null,
    },
  };

  // Cosa vuol dire ogni opzione di un campo a scelta.
  //
  // Sono i campi dove Sara si blocca in modo diverso: non le sembrano
  // difficili, le sembrano ovvi, e sceglie con sicurezza l'interpretazione
  // sbagliata (agents/persona.md). Per questo le opzioni si spiegano tutte,
  // insieme, prima di scegliere — non si lascia indovinare.
  //
  // Chiave: id del campo (per i radio, il name). Poi il value dell'opzione.
  const OPTIONS = {
    tipo_contratto: {
      domestico: 'La casa dove vivi. Vale anche se ci lavori.',
      non_domestico: 'Un negozio, un ufficio, un laboratorio.',
    },
    sesso: {
      M: "Come risulta all'anagrafe, non come ti senti.",
      F: "Come risulta all'anagrafe, non come ti senti.",
    },
    potenza: {
      '1.5': 'Poche prese accese insieme. Raro.',
      '3.0': 'Quasi tutte le case. Se non sai, è questa.',
      '4.5': 'Casa grande, o piano a induzione.',
      '6.0': 'Casa molto grande, o pompa di calore.',
      '10.0': 'Uso professionale.',
    },
  };

  function optionsFor(id) {
    return OPTIONS[id] || null;
  }

  // Testi legati a un campo specifico. L'id vince sul kind.
  const BY_ID = {
    tipo_contratto: {
      what: 'A cosa serve la fornitura?',
      where: 'Domestico vuol dire casa. Non domestico vuol dire negozio, ufficio, laboratorio.',
      example: null,
      remember: 'Se è la casa dove vivi, è domestico. Anche se lavori da casa.',
    },
    potenza: {
      what: 'Quanta corrente può usare la casa insieme.',
      where: 'La trovi sulla bolletta, alla voce "potenza impegnata".',
      example: null,
      remember: 'Quasi tutte le case hanno 3 kW. Se non lo sai, lascia 3,0.',
    },
  };

  function copyFor(kind, id) {
    return BY_ID[id] || COPY[kind] || null;
  }

  // Legge quello che Sara ha gia' scritto e lo spiega pezzo per pezzo.
  // Non compila niente: descrive soltanto. Vedi regola 1 di CLAUDE.md.
  function explain(kind, raw) {
    const segments = SBS.segmentsOf(kind, raw);
    const meanings = MEANINGS[kind];
    if (!segments || !meanings || !raw) return [];

    return segments
      .filter((seg) => raw.length > seg.from)
      .map((seg) => {
        const text = raw.slice(seg.from, seg.to + 1);
        let meaning = (meanings && meanings[seg.name]) || '';

        if (kind === 'cf' && seg.name === 'Mese' && MONTHS[text]) {
          meaning = 'la lettera del mese: ' + MONTHS[text];
        }
        if (kind === 'cf' && seg.name === 'Giorno' && /^\d{2}$/.test(text)) {
          const n = parseInt(text, 10);
          meaning = n > 40 ? 'giorno ' + (n - 40) + ', più 40 perché donna' : 'giorno ' + n;
        }
        return {
          name: seg.name,
          text: text,
          meaning: meaning,
          complete: raw.length > seg.to,
        };
      });
  }

  SBS.copyFor = copyFor;
  SBS.optionsFor = optionsFor;
  SBS.explain = explain;
  SBS.rememberFor = (kind) => (COPY[kind] ? COPY[kind].remember : null);
})();
