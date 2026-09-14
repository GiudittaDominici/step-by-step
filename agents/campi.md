# Mappa dei campi del modulo

> Questo file è la specifica dello scanner: senza, l'agente indovina. Con, scrive codice
> calibrato sul modulo vero.

## Come rigenerarla

Apri la pagina salvata (servita da `python3 -m http.server`, **non** da `file://`) e
incolla in console:

```js
console.table([...document.querySelectorAll('input,select,textarea')].map(el => ({
  tipo:  el.type || el.tagName,
  name:  el.name,
  id:    el.id,
  label: document.querySelector(`label[for="${CSS.escape(el.id || '\0')}"]`)?.innerText.trim(),
  aria:  el.getAttribute('aria-label'),
  wrap:  el.closest('label')?.innerText.trim().slice(0, 40),
  ph:    el.placeholder,
  req:   el.required,
  max:   el.maxLength
})));
```

## Triage

- 🟢 **Verde** — l'etichetta esce da `label[for]`, `aria-label` o dalla label che avvolge
  il campo. Lo scanner la trova da solo.
- 🟡 **Giallo** — esce solo `name` o `placeholder`. Lo scanner la ricava, ma va ripulita.
- 🔴 **Rosso** — non esce niente. **Non inventare euristiche.** Scrivi l'etichetta a mano
  nella tabella `OVERRIDES` qui sotto. Cinque minuti contro un'ora.

---

## Modulo 1 — luce e gas (`app/demo/form.html`)

Rilevato il 14/09/2026 sul file in repo (branch `feat/form-handling`). Il modulo copre
luce **e** gas insieme: contiene sia il `pod` sia il `pdr`.

| id / name | Colore | Etichetta per Sara | `kind` | Obbl. | Note |
|---|---|---|---|---|---|
| `nome` | 🟢 | Nome | `testo` | sì | — |
| `cognome` | 🟢 | Cognome | `testo` | sì | — |
| `data_nascita` | 🟢 | Data di nascita | `data` | sì | `type="date"` → valore `aaaa-mm-gg` |
| `luogo_nascita` | 🟢 | Comune di nascita | `testo` | sì | — |
| `codice_fiscale` | 🟢 | Codice Fiscale | `cf` | sì | `maxlength="16"` |
| `sesso` | 🟢 | Sesso anagrafico | `select` | sì | M / F |
| `email` | 🟢 | Email | `testo` | sì | — |
| `telefono` | 🟢 | Telefono | `testo` | sì | — |
| `indirizzo` | 🟢 | Via / Piazza | `testo` | sì | — |
| `civico` | 🟢 | Civico | `testo` | sì | — |
| `cap` | 🟢 | CAP | `cap` | sì | `maxlength="5"` |
| `citta` | 🟢 | Città | `testo` | sì | — |
| `tipo_contratto` | 🔴 | Tipo di utilizzo | `select` | sì | Radio group. Vedi note sotto. |
| `potenza` | 🟢 | Potenza impegnata | `select` | sì | Ha già `3,0 kW` preselezionato |
| `pod` | 🟢 | Codice POD | `pod` | sì | `maxlength="14"`, card «Dati del contatore» |
| `pdr` | 🟢 | Codice PDR | `pdr` | sì | `maxlength="14"`, card «Dati del contatore» |
| `iban` | 🟢 | IBAN | `iban` | sì | `maxlength="27"` |

### Due trappole di questo modulo

1. **Nessun campo ha l'attributo `required`.** Il form è `novalidate` e l'obbligatorietà
   è solo lo `<span class="req">*</span>` dentro la label. Lo scanner **non** può leggere
   `el.required`: deve cercare `.req` dentro la label associata. La colonna «Obbl.» qui
   sopra viene da lì.
2. **`tipo_contratto` è un gruppo di radio.** Solo la prima radio ha un `id`; la label del
   gruppo non ha `for`; le label che avvolgono le singole radio contengono emoji
   (`🏠 Domestico (uso casa)`). Lo scanner deve trattare le radio con lo stesso `name`
   come **un solo `Field`**, prendere l'etichetta da `OVERRIDES` e ripulire le emoji dalle
   opzioni prima di mostrarle a Sara.

---

## Modulo 2 — gas (`app/demo/form-gas.html`)

**Da creare.** Serve al livello 3 e al punto 3 della definition of done: il pannello deve
dimostrare di tacere su un modulo **mai visto**. Non basta il `pdr` già presente nel
modulo 1 — serve una seconda pagina, compilata in una seconda sessione, dopo che il
profilo d'errore è stato salvato.

Deve contenere il `pdr` e ripetere almeno `cf`, `iban` e un paio di campi `testo`.

| id / name | Colore | Etichetta per Sara | `kind` | Obbl. | Note |
|---|---|---|---|---|---|
| `pdr` | 🟢 | Codice PDR | `pdr` | sì | 14 cifre, `maxlength="14"` |
| `codice_fiscale` | 🟢 | Codice Fiscale | `cf` | sì | stesso `kind` del modulo 1 |
| `iban` | 🟢 | IBAN | `iban` | sì | stesso `kind` del modulo 1 |
| `tipo_uso` | 🔴 | Tipo di utilizzo | `select` | sì | residente / non residente |

## Overrides manuali

Per i campi 🔴, la mappa che `scanner.js` usa come ultima risorsa:

```js
const OVERRIDES = {
  'tipo_contratto': 'Tipo di utilizzo',
  'tipo_uso': 'Tipo di utilizzo',
};
```

## Strategia di estrazione (in cascata)

`scanner.js` prova in quest'ordine e si ferma al primo risultato non vuoto:

1. `OVERRIDES[el.id]` — oppure `OVERRIDES[el.name]` per i gruppi di radio senza id
2. `document.querySelector('label[for="' + CSS.escape(el.id) + '"]')`
3. `el.getAttribute('aria-label')`
4. l'elemento referenziato da `aria-labelledby`
5. `el.closest('label')` — escludendo il testo del campo stesso
6. il primo nodo di testo non vuoto che precede il campo nel DOM
7. `el.name` ripulito (underscore e camelCase → parole)
8. `el.placeholder`

Il risultato viene normalizzato: spazi compressi, due punti finali rimossi, asterischi di
obbligatorietà rimossi, emoji rimosse.

## Assegnazione del `kind`

Si decide **prima per id/name**, poi per euristica. L'assegnazione esplicita vince sempre:
è il modulo che conosciamo, non un form generico.

| `kind` | Come si riconosce |
|---|---|
| `cf` | id/name contiene `codicefiscale`, `codice_fiscale`, `cf`, `fiscal` |
| `iban` | id/name contiene `iban` |
| `pod` | id/name o etichetta contiene `pod` |
| `pdr` | id/name o etichetta contiene `pdr` |
| `cap` | id/name contiene `cap`, `zip`, `postal` |
| `data` | `type="date"` o etichetta contiene `data di` |
| `select` | `<select>`, oppure un gruppo di `input[type=radio]` con lo stesso `name` |
| `testo` | tutto il resto |

## I campi che ci interessano davvero

Questi quattro sono la demo. Gli altri servono solo perché il modulo sia credibile.

1. **POD** — 14 caratteri misti, con una `E` isolata in mezzo. Il punto di rottura
   principale. ✅ già nel modulo.
2. **PDR** — 14 cifre senza appigli visivi. ✅ già nel modulo 1, ma va **ripetuto** nel
   secondo modulo: è lì che serve, come campo del gas in una sessione separata.
3. **IBAN** — 27 caratteri. L'errore che il portale **non** intercetta e noi sì. ✅ già nel modulo.
4. **Tipologia d'uso (residente / non residente)** — il gergo che Sara interpreta male con
   sicurezza, senza chiedere aiuto. ⚠️ Nel modulo attuale è `tipo_contratto`
   (domestico / non domestico), che è un gergo diverso e meno insidioso.

## Lavoro aperto su `app/demo/`

Senza questi interventi la definition of done in `agents/spec.md` non è raggiungibile:

- [x] Aggiungere i campi **POD** e **PDR** a `form.html` (card «Dati del contatore»).
- [ ] Il submit di `form.html` deve rispondere **«Dati non validi»** senza dire dove
      (serve al punto 1 della demo: il confronto prima/dopo).
- [ ] Creare `form-gas.html` con il **PDR** e la tipologia d'uso residente/non residente.
