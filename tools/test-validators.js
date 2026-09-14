/**
 * Test di validators.js — si esegue con:  node tools/test-validators.js
 *
 * Due parti:
 *  1. i casi di test elencati in agents/validatori.md
 *  2. la proprieta' che regge tutto il progetto: scambiare due caratteri
 *     adiacenti in un codice valido deve SEMPRE produrre un codice non valido.
 */
'use strict';

global.window = {};
require('../app/extension/validators.js');
const { validate, checkLive } = global.window.SBS;

let pass = 0;
let fail = 0;

function check(name, cond, extra) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''));
  }
}

function expect(kind, value, wantOk, note) {
  const res = validate(kind, value);
  check(
    `${kind} ${value || '(vuoto)'} ${wantOk ? 'valido' : 'non valido'}${note ? ' — ' + note : ''}`,
    res.ok === wantOk,
    `ok=${res.ok} message=${JSON.stringify(res.message)}`
  );
}

// ---------------------------------------------------------------------------
console.log('\n1. Casi da agents/validatori.md');
// ---------------------------------------------------------------------------

// cf
expect('cf', 'RSSMRA85M01H501Q', true);
expect('cf', 'BNCLRA92E45F205F', true);
expect('cf', 'VRDGPP78T12L219L', true);
expect('cf', 'RSSMRA85M10H501Q', false, 'scambio di due cifre adiacenti');
expect('cf', 'RSSMRA85M01H501A', false, 'carattere di controllo errato');
expect('cf', 'RSSMRA85M01H50', false, 'lunghezza');

// iban
expect('iban', 'IT60X0542811101000000123456', true);
expect('iban', 'IT60X0542811101000001023456', false, 'scambio di due cifre adiacenti');
expect('iban', 'IT61X0542811101000000123456', false, 'cifre di controllo errate');
expect('iban', 'IT60X05428111010000001234', false, 'lunghezza');

// pod — solo formato
expect('pod', 'IT001E12345678', true);
expect('pod', 'IT001E1234S678', true, 'ben formato ma sbagliato: passa, ed e\' il punto');
expect('pod', 'IT001F12345678', false, 'la 6a posizione deve essere E');
expect('pod', 'IT01E12345678', false, 'lunghezza');

// pdr
expect('pdr', '01234567890123', true);
expect('pdr', '0123456789012', false, '13 cifre');
expect('pdr', '0123456789012A', false, 'contiene una lettera');

// cap
expect('cap', '20123', true);
expect('cap', '2012', false);

// data
expect('data', '1985-08-01', true);
expect('data', '01/08/1985', true);
expect('data', '2002-02-31', false, '31 febbraio');
expect('data', '31/02/2002', false, '31 febbraio');
expect('data', '2099-01-01', false, 'nel futuro');

// ---------------------------------------------------------------------------
console.log('\n2. Proprieta\': ogni scambio adiacente deve fallire');
// ---------------------------------------------------------------------------

const VALID = {
  cf: ['RSSMRA85M01H501Q', 'BNCLRA92E45F205F', 'VRDGPP78T12L219L'],
  iban: [
    'IT60X0542811101000000123456',
    'IT98L0300203280794734307781',
    'IT61X0306909606100000012345',
    'IT19B0100003245123456789012',
  ],
};

for (const kind of Object.keys(VALID)) {
  for (const good of VALID[kind]) {
    check(`${kind} ${good} e' valido di partenza`, validate(kind, good).ok, 'il vettore di test e\' sbagliato');

    let swapsTested = 0;
    let leaks = [];
    for (let i = 0; i < good.length - 1; i++) {
      if (good[i] === good[i + 1]) continue; // scambio che non cambia niente
      const swapped = good.slice(0, i) + good[i + 1] + good[i] + good.slice(i + 2);
      swapsTested++;
      if (validate(kind, swapped).ok) leaks.push(`pos ${i}: ${swapped}`);
    }
    check(
      `${kind} ${good}: ${swapsTested} scambi, nessuno passa`,
      leaks.length === 0,
      leaks.join(', ')
    );
  }
}

// ---------------------------------------------------------------------------
console.log('\n3. Localizzazione dell\'errore');
// ---------------------------------------------------------------------------

const located = validate('iban', 'IT60X0542811101000001023456');
check(
  'iban con scambio: indica un gruppo',
  located.chunkIndex !== null,
  'chunkIndex=' + located.chunkIndex
);
console.log('       messaggio: ' + located.message);

// Quando non sa dirlo, non deve inventare.
const vague = validate('iban', 'IT61X0542811101000000123456');
console.log('       messaggio (cifre di controllo): ' + vague.message);

// ---------------------------------------------------------------------------
console.log('\n4. Verifica mentre si scrive');
// ---------------------------------------------------------------------------

check('iban vuoto -> vuoto', checkLive('iban', '').state === 'vuoto');
check('iban parziale ok -> in-corso', checkLive('iban', 'IT60X05').state === 'in-corso');
check('iban con lettera dove va cifra -> errore subito', checkLive('iban', 'IT6AX').state === 'errore');
check('iban parziale: nessun falso allarme', checkLive('iban', 'IT60X0542811101').state === 'in-corso');
check('iban completo valido -> ok', checkLive('iban', 'IT60X0542811101000000123456').state === 'ok');
check('cf parziale ok -> in-corso', checkLive('cf', 'RSSMRA85M').state === 'in-corso');
check('cf mese impossibile -> errore subito', checkLive('cf', 'RSSMRA85Z').state === 'errore');
check('pod senza IT -> errore al primo carattere', checkLive('pod', 'X').charIndex === 0);
check('pdr con lettera -> errore', checkLive('pdr', '0123A').state === 'errore');

const live = checkLive('cf', 'RSSMRA85Z');
console.log('       messaggio live: ' + live.message);

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
console.log('\n6. Email e telefono');
// ---------------------------------------------------------------------------

expect('email', 'sara.bianchi@gmail.com', true);
expect('email', 'sara@libero.it', true);
expect('email', 'sara.bianchi', false, 'manca la chiocciola');
expect('email', 'sara@@gmail.com', false, 'due chiocciole');
expect('email', 'sara@gmail', false, 'manca il punto');
expect('email', '@gmail.com', false, 'manca il nome');
expect('email', 'sara bianchi@gmail.com', false, 'spazio dentro');
expect('email', 'sara@gmail.c', false, 'parte finale troppo corta');

expect('tel', '3401234567', true);
expect('tel', '340 123 4567', true, 'gli spazi si ignorano');
expect('tel', '+39 340 123 4567', true, 'il prefisso internazionale si ignora');
expect('tel', '0212345678', true, 'fisso');
expect('tel', '34012345', false, 'cellulare troppo corto');
expect('tel', '3401234A67', false, 'contiene una lettera');

console.log('       ' + validate('email', 'sara@gmail').message);
console.log('       ' + validate('tel', '34012345').message);

// Mentre scrive non deve dare falsi allarmi.
check('email a meta -> in-corso', checkLive('email', 'sara.bia').state === 'in-corso',
  checkLive('email', 'sara.bia').state);
check('email con spazio -> errore subito', checkLive('email', 'sara b').state === 'errore');
check('tel a meta -> in-corso', checkLive('tel', '340').state === 'in-corso',
  checkLive('tel', '340').state);
check('tel con lettera -> errore subito', checkLive('tel', '340A').state === 'errore');

// ---------------------------------------------------------------------------
console.log('\n7. I riquadri e la spiegazione combaciano');
// ---------------------------------------------------------------------------

require('../app/extension/copy.js');
const { segmentsOf } = global.window.SBS;
const { explain } = global.window.SBS;

// E' la regressione da bloccare: i riquadri del pannello e le righe della
// spiegazione devono nascere dalla stessa divisione.
[
  ['cf', 'RSSMRA85M01H501Q'],
  ['iban', 'IT60X0542811101000000123456'],
  ['pod', 'IT001E12345678'],
  ['email', 'sara@gmail.com'],
].forEach(([kind, value]) => {
  const segs = segmentsOf(kind, value) || [];
  const rows = explain(kind, value);
  check(
    kind + ': stesso numero di pezzi (' + segs.length + ')',
    segs.length === rows.length,
    'segmenti=' + segs.length + ' righe=' + rows.length
  );
  const joined = rows.map((r) => r.text).join('');
  check(kind + ': i pezzi ricompongono il codice', joined === value, joined);
  check(
    kind + ': ogni pezzo ha una spiegazione',
    rows.every((r) => r.meaning && r.meaning.length > 0),
    JSON.stringify(rows.filter((r) => !r.meaning))
  );
});

// Il telefono e' il caso senza scomposizione: riquadri si, lista no.
check('tel: ha i riquadri', (segmentsOf('tel', '3401234567') || []).length === 3,
  JSON.stringify(segmentsOf('tel', '3401234567')));
check('tel: nessuna lista, non ha pezzi da spiegare', explain('tel', '3401234567').length === 0);
check('pdr: nessuna lista', explain('pdr', '01234567890123').length === 0);

// Il gruppo indicato dal messaggio esiste fra i riquadri.
const loc = validate('iban', 'IT60X0542811101000001023456');
check(
  'il gruppo indicato esiste fra i riquadri',
  loc.chunkIndex === null || segmentsOf('iban', 'IT60X0542811101000001023456')[loc.chunkIndex] !== undefined,
  'chunkIndex=' + loc.chunkIndex
);
console.log('       ' + loc.message);

console.log('\n8. Il supporto si ritira');

require('../app/extension/profile.js');
const profile = global.window.SBS.profile;

profile.load().then(() => {
  profile.reset();

  check('primo modulo: supporto pieno', profile.supportFor('iban') === 'pieno', profile.supportFor('iban'));

  // Modulo 1: sbaglia l'IBAN, il POD no.
  profile.recordError('iban');
  profile.endForm(['iban', 'pod', 'cf']);
  check('dopo un errore su iban: pieno', profile.supportFor('iban') === 'pieno', profile.supportFor('iban'));
  check('pod pulito dopo 1 modulo: minimo', profile.supportFor('pod') === 'minimo', profile.supportFor('pod'));

  // Modulo 2: tutto pulito.
  profile.endForm(['iban', 'pod', 'cf']);
  check('pod pulito dopo 2 moduli: muto', profile.supportFor('pod') === 'muto', profile.supportFor('pod'));
  check('iban resta pieno: li ha sbagliato', profile.supportFor('iban') === 'pieno', profile.supportFor('iban'));

  const snap = profile.snapshot();
  check(
    'il profilo conta errori, non valori',
    snap.errorsByKind.iban === 1 && JSON.stringify(snap).indexOf('IT') === -1,
    JSON.stringify(snap)
  );
  console.log('       supporto al prossimo modulo: ' + JSON.stringify(snap.supportByKind));

  console.log('\n' + pass + ' passati, ' + fail + ' falliti\n');
  process.exit(fail === 0 ? 0 : 1);
});
