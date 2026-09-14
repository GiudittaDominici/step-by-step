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

## Il modulo (`app/demo/form.html`)

Rilevato il 14/09/2026 sul file in repo. È l'unico modulo del progetto: copre luce **e**
gas insieme, quindi contiene sia il `pod` sia il `pdr`.

| id / name | Colore | Etichetta per Sara | `kind` | Obbl. | Note |
|---|---|---|---|---|---|
| `nome` | 🟢 | Nome | `testo` | sì | — |
| `cognome` | 🟢 | Cognome | `testo` | sì | — |
| `data_nascita` | 🟢 | Data di nascita | `data` | sì | `type="date"` → valore `aaaa-mm-gg` |
| `luogo_nascita` | 🟢 | Comune di nascita | `testo` | sì | — |
| `codice_fiscale` | 🟢 | Codice Fiscale | `cf` | sì | `maxlength="16"` |
| `sesso` | 🟢 | Sesso anagrafico | `select` | sì | M / F |
| `email` | 🟢 | Email | `email` | sì | — |
| `telefono` | 🟢 | Telefono | `tel` | sì | cifre staccate 3-3-4 |
| `indirizzo` | 🟢 | Via / Piazza | `testo` | sì | — |
| `civico` | 🟢 | Civico | `testo` | sì | — |
| `cap` | 🟢 | CAP | `cap` | sì | `maxlength="5"` |
| `citta` | 🟢 | Città | `testo` | sì | — |
| `tipo_contratto` | 🟢 | Tipo di utilizzo | `select` | sì | Gruppo di radio in `<fieldset>`. Vedi nota sotto. |
| `potenza` | 🟢 | Potenza impegnata | `select` | sì | Ha già `3,0 kW` preselezionato |
| `pod` | 🟢 | Codice POD | `pod` | sì | `maxlength="14"`, card «Dati del contatore» |
| `pdr` | 🟢 | Codice PDR | `pdr` | sì | `maxlength="14"`, card «Dati del contatore» |
| `iban` | 🟢 | IBAN | `iban` | sì | `maxlength="27"` |

### L'unica cosa da ricordare: i gruppi di radio

Il markup di `tipo_contratto` ora è pulito — `<fieldset>` con `<legend>`, un `id` per ogni
radio, niente emoji nelle opzioni — ma resta il punto strutturale:
**le radio con lo stesso `name` sono una domanda sola, non una per opzione.**

Lo scanner deve quindi, per i soli `input[type=radio]`:

- produrre **un solo `Field`** per `name`, saltando le radio successive;
- usare il **`name`** come `Field.id`, perché l'`id` cambia da opzione a opzione;
- prendere l'etichetta dalla `<legend>` del `<fieldset>` che le contiene.

✅ `content.js` lo fa. Il pannello pone la domanda una volta sola e le elenca tutte
spiegate (vedi «Campi a scelta» in `agents/validatori.md`).

Una conseguenza grafica che si dimentica: per una radio l'`<input>` **è il pallino**. Un
contorno lì non si legge come «campo attivo». L'evidenziazione va messa sul `<fieldset>`,
cioè intorno alla domanda intera.

Sul resto lo scanner può fidarsi: ogni campo obbligatorio ha l'attributo `required`, quindi
`el.required` è affidabile, e ogni etichetta esce da `label[for]` o da `legend`. Il form
resta `novalidate`: la validazione nativa del browser è disattivata di proposito, così il
portale non aiuta Sara al posto nostro.

---

## Overrides manuali

Nessuno: al momento ogni campo di `form.html` è 🟢 e lo scanner trova l'etichetta da solo.
La mappa resta come ultima risorsa se comparirà un campo 🔴.

```js
const OVERRIDES = {
  'tipo_contratto': 'Tipo di utilizzo',
  'tipo_uso': 'Tipo di utilizzo',
};
```

## Strategia di estrazione (in cascata)

`scanner.js` prova in quest'ordine e si ferma al primo risultato non vuoto:

1. `OVERRIDES[el.id]` — oppure `OVERRIDES[el.name]` per i gruppi di radio
2. per un `input[type=radio]`: la `<legend>` di `el.closest('fieldset')`
3. `document.querySelector('label[for="' + CSS.escape(el.id) + '"]')`
4. `el.getAttribute('aria-label')`
5. l'elemento referenziato da `aria-labelledby`
6. `el.closest('label')` — escludendo il testo del campo stesso
7. il primo nodo di testo non vuoto che precede il campo nel DOM
8. `el.name` ripulito (underscore e camelCase → parole)
9. `el.placeholder`

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
| `email` | id/name contiene `mail`, oppure `type="email"` |
| `tel` | id/name contiene `telefono`, `cellulare`, `phone`, `tel`, oppure `type="tel"` |
| `data` | `type="date"` o etichetta contiene `data di` |
| `select` | `<select>`, oppure un gruppo di `input[type=radio]` con lo stesso `name` |
| `testo` | tutto il resto |

## I campi che ci interessano davvero

Questi quattro sono la demo. Gli altri servono solo perché il modulo sia credibile.

1. **POD** — 14 caratteri misti, con una `E` isolata in mezzo. Il punto di rottura
   principale. ✅ già nel modulo.
2. **PDR** — 14 cifre senza appigli visivi, il campo peggiore per Sara. ✅ già nel modulo.
3. **IBAN** — 27 caratteri. L'errore che il portale **non** intercetta e noi sì. ✅ già nel modulo.
4. **Tipologia d'uso (residente / non residente)** — il gergo che Sara interpreta male con
   sicurezza, senza chiedere aiuto. ⚠️ Nel modulo attuale è `tipo_contratto`
   (domestico / non domestico), che è un gergo diverso e meno insidioso.

## Il controllo del portale — non renderlo più intelligente

`form.html` simula il backend del portale in uno `<script>` in fondo alla pagina. Il
controllo è **volutamente superficiale**: presenza, lunghezza esatta e prefisso. Nessun
checksum, nessun controllo posizionale.

| Campo | Cosa controlla il portale |
|---|---|
| `codice_fiscale` | 16 caratteri |
| `iban` | 27 caratteri, inizia con `IT` |
| `pod` | 14 caratteri, inizia con `IT` |
| `pdr` | 14 caratteri |
| `cap` | 5 caratteri |
| `email` | contiene `@` |
| tutti gli altri `[required]` | non vuoto |

Da qui discendono due comportamenti che **sono** la demo, non un difetto:

- Un IBAN o un codice fiscale con il carattere di controllo sbagliato **passa** e arriva
  alla ricevuta. È il danno reale: la pratica si chiude e si blocca settimane dopo.
- Il messaggio d'errore è uno solo, «Dati non validi. Verifica i dati inseriti e riprova.»,
  e **non dice mai quale campo**. È il punto 1 della definition of done.

Per il confronto prima/dopo serve quindi un errore che rompa il **formato** — un POD di 13
caratteri, o senza `IT` davanti — non `IT001E1234S678`, che è ben formato e passa.

## L'evento di conferma

A ogni submit la pagina emette su `document` un evento `portal:submit`:

```js
document.addEventListener('portal:submit', (e) => {
  e.detail; // { ok: boolean, code: string | null, at: number }
});
```

È l'aggancio per la metrica `submit_attempt` di `agents/spec.md`. `code` è il numero di
pratica, valorizzato solo quando `ok` è `true`.

Il `detail` **non dice quali campi hanno fallito**, di proposito: il portale non lo sa dire,
e l'estensione non deve poterlo scoprire da qui. Quello che l'estensione sa sugli errori
deve venire dai suoi validatori.

## Lavoro aperto su `app/demo/`

Niente. Il modulo copre luce e gas insieme, e il livello 3 si dimostra compilandolo due
volte: non serve una seconda pagina.
