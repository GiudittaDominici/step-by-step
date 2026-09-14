/**
 * Step by Step — profile.js
 *
 * Il supporto si ritira: ricordiamo su quali TIPI di campo Sara sbaglia, e al
 * modulo successivo interveniamo solo lì.
 *
 * COSA SALVIAMO: conteggi di errori per kind, e quanti moduli di fila ha
 * chiuso pulito su quel kind.
 * COSA NON SALVIAMO MAI: nessun valore digitato. Niente codici fiscali, niente
 * IBAN, niente nomi. Il profilo descrive gli errori, non la persona.
 *
 * Regola di calcolo (agents/spec.md) — deve restare banale:
 *   primo modulo, non sappiamo niente    -> 'pieno'
 *   almeno un errore su quel kind        -> 'pieno'
 *   zero errori                          -> 'minimo'
 *   due moduli consecutivi senza errori  -> 'muto'
 */
(function () {
  'use strict';
  const SBS = (window.SBS = window.SBS || {});

  const KEY = 'sbs_profile';

  const EMPTY = {
    errorsByKind: {},      // { iban: 2, pod: 1 }  — quante volte ha sbagliato in totale
    cleanFormsByKind: {},  // { iban: 1 }          — moduli di fila chiusi senza errori
    errorsThisForm: {},    // { iban: 1 }          — errori nel modulo in corso
    formsCompleted: 0,
  };

  let cache = null;

  function read() {
    return new Promise((resolve) => {
      if (cache) return resolve(cache);
      if (!window.chrome || !chrome.storage || !chrome.storage.local) {
        cache = JSON.parse(JSON.stringify(EMPTY));
        return resolve(cache);
      }
      chrome.storage.local.get(KEY, (data) => {
        cache = Object.assign(JSON.parse(JSON.stringify(EMPTY)), (data && data[KEY]) || {});
        resolve(cache);
      });
    });
  }

  function write() {
    if (!cache) return;
    if (window.chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [KEY]: cache });
    }
  }

  // Un errore su questo kind. Non riceve, e non deve ricevere, il valore.
  function recordError(kind) {
    if (!cache || !kind) return;
    cache.errorsByKind[kind] = (cache.errorsByKind[kind] || 0) + 1;
    cache.errorsThisForm[kind] = (cache.errorsThisForm[kind] || 0) + 1;
    cache.cleanFormsByKind[kind] = 0;
    write();
  }

  // Fine modulo: i kind attraversati senza errori guadagnano un modulo pulito.
  function endForm(kindsSeen) {
    if (!cache) return;
    cache.formsCompleted += 1;
    (kindsSeen || []).forEach((kind) => {
      if (!cache.errorsThisForm[kind]) {
        cache.cleanFormsByKind[kind] = (cache.cleanFormsByKind[kind] || 0) + 1;
      }
    });
    cache.errorsThisForm = {};
    write();
  }

  // 'pieno' | 'minimo' | 'muto'
  function supportFor(kind) {
    if (!cache) return 'pieno';
    if ((cache.errorsByKind[kind] || 0) > 0) return 'pieno';
    if ((cache.cleanFormsByKind[kind] || 0) >= 2) return 'muto';
    // Primo modulo in assoluto: non sappiamo ancora niente di lei, quindi
    // stiamo accanto. Il silenzio va guadagnato, non dato per scontato.
    if (cache.formsCompleted === 0) return 'pieno';
    return 'minimo';
  }

  function snapshot() {
    if (!cache) return JSON.parse(JSON.stringify(EMPTY));
    const supportByKind = {};
    const kinds = new Set(
      Object.keys(cache.errorsByKind).concat(Object.keys(cache.cleanFormsByKind))
    );
    kinds.forEach((k) => {
      supportByKind[k] = supportFor(k);
    });
    return {
      errorsByKind: cache.errorsByKind,
      cleanFormsByKind: cache.cleanFormsByKind,
      formsCompleted: cache.formsCompleted,
      supportByKind: supportByKind,
    };
  }

  function reset() {
    cache = JSON.parse(JSON.stringify(EMPTY));
    write();
  }

  SBS.profile = {
    load: read,
    recordError: recordError,
    endForm: endForm,
    supportFor: supportFor,
    snapshot: snapshot,
    reset: reset,
  };
})();
