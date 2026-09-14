/**
 * Step by Step — log.js
 *
 * log(evento, dati) -> chrome.storage.local
 *
 * Le metriche sono un deliverable del progetto, non un extra finale
 * (vedi agents/spec.md). Eventi previsti:
 *   field_focus, field_error, help_opened, submit_attempt,
 *   field_completed_unaided, session_end
 *
 * Come il profilo, non registra MAI un valore digitato: solo id del campo,
 * kind ed esito.
 */
(function () {
  'use strict';
  const SBS = (window.SBS = window.SBS || {});

  const KEY = 'sbs_events';
  const MAX = 500;
  const sessionStart = Date.now();

  let buffer = [];
  let flushTimer = null;

  function flush() {
    flushTimer = null;
    if (!buffer.length) return;
    const batch = buffer;
    buffer = [];
    if (!window.chrome || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get(KEY, (data) => {
      const all = ((data && data[KEY]) || []).concat(batch).slice(-MAX);
      chrome.storage.local.set({ [KEY]: all });
    });
  }

  function log(event, payload) {
    buffer.push({
      event: event,
      at: Date.now(),
      since: Date.now() - sessionStart,
      data: payload || {},
    });
    console.debug('[sbs]', event, payload || {});
    if (!flushTimer) flushTimer = setTimeout(flush, 400);
  }

  function readAll() {
    return new Promise((resolve) => {
      if (!window.chrome || !chrome.storage || !chrome.storage.local) return resolve([]);
      chrome.storage.local.get(KEY, (data) => resolve((data && data[KEY]) || []));
    });
  }

  // Esito dell'invio: lo dice la pagina, non lo indoviniamo noi.
  // Vedi «L'evento di conferma» in agents/campi.md.
  document.addEventListener('portal:submit', (e) => {
    log('submit_attempt', { ok: !!(e.detail && e.detail.ok) });
  });

  window.addEventListener('beforeunload', () => {
    log('session_end', { durata_ms: Date.now() - sessionStart });
    flush();
  });

  SBS.log = log;
  SBS.readEvents = readAll;
  SBS.clearEvents = () => {
    if (window.chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(KEY);
    }
  };
})();
