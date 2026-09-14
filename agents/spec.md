# Cosa costruiamo

## In una frase

Un'estensione Chrome che, sul modulo di cambio fornitore luce/gas, guida Sara **un campo
alla volta**, verifica i codici **prima** dell'invio, e alla compilazione successiva
**si zittisce** sui campi che lei ormai padroneggia.

## I tre livelli

### Livello 1 — Un campo alla volta
Il resto della pagina si attenua. Il campo attivo viene evidenziato e portato a schermo.
Il pannello mostra: cosa vuole davvero quel campo, in parole di Sara; dove trovarlo (es. su
quale parte della bolletta); un esempio del formato.

### Livello 2 — Verifica prima dell'invio
Appena Sara finisce di scrivere, il campo viene verificato in locale. Se c'è un errore, il
messaggio dice **dove** guardare, non solo che c'è un errore. Il portale non ci sarebbe mai
arrivato: controlla solo la lunghezza.

### Livello 3 — Il supporto si ritira
Il profilo d'errore sopravvive alla sessione. Alla compilazione successiva il pannello
interviene solo sui tipi di campo dove Sara ha effettivamente sbagliato.

Si dimostra **sullo stesso modulo**, compilato due volte: la prima a supporto pieno, la
seconda in silenzio su tutto tranne dove aveva sbagliato. Non serve una seconda pagina —
serve che il profilo sopravviva alla sessione, ed è quello il punto.

**Il livello 3 è la capability agentica richiesta dal tema.** Senza, siamo fuori tema.

## Moduli

Tutti i file dell'estensione stanno in `app/extension/`.

Si caricano in quest'ordine dal manifest: `content.js` per ultimo, perché usa gli altri.

| File | Responsabilità | Chi | Stato |
|---|---|---|---|
| `manifest.json` | MV3 | insieme | ✅ |
| `log.js` | `log(evento, dati)` → storage | insieme | ✅ |
| `validators.js` | Verifica un valore per `kind`. Nessuna rete. | A | ✅ |
| `copy.js` | I testi per Sara, per `kind` e per campo specifico | B | ✅ |
| `profile.js` | Profilo d'errore e livello di supporto in `chrome.storage.local` | A | ✅ |
| `live.js` | Verifica mentre scrive, e la mostra | A | ✅ |
| `content.js` | Scoperta campi, flusso passo per passo, pannello, riepilogo | insieme | ✅ |
| `scanner.js` | Legge il form e produce la lista di `Field` | A | ❌ non nato |
| `panel.js` | Il pannello in Shadow DOM | B | ❌ non nato |

**I due file che non sono nati, e dove sta il loro lavoro oggi.** Non è un debito da
saldare prima della demo: è dove cercare le cose.

- `scanner.js` → `kindOf()` sta in `validators.js`, `discoverFields()` in `content.js`.
- `panel.js` → il pannello sta in `content.js`, il rendering della verifica in `live.js`.
  Il pannello **non** è in Shadow DOM: sul modulo demo, che è inerte, non serve.

Fuori da `app/extension/`: `tools/test-validators.js`, che si esegue con
`node tools/test-validators.js`.

**Cambio al contratto, dichiarato:** `copy.json` è diventato `copy.js`. Un content script
MV3 non può leggere un `.json` senza `web_accessible_resources` e una `fetch`, e
`CLAUDE.md` dice di non aggiungerli finché non servono davvero. Il contenuto e la forma
dell'oggetto `Copy` restano quelli concordati.

La pagina del modulo è `app/demo/form.html`. Una sola: il livello 3 si dimostra
compilandola due volte, non su un secondo modulo.

## Il contratto dati

**Questo è l'unico accordo fra A e B. Non cambiarlo senza dirlo all'altra persona e
aggiornare questo file.**

```js
// Prodotto dalla scoperta campi, consumato dal pannello
Field = {
  el,              // HTMLElement — il campo vero nella pagina
  id,              // string — identificatore stabile (id, name, o generato)
  label,           // string — l'etichetta leggibile, già ripulita
  kind,            // 'cf' | 'iban' | 'pod' | 'pdr' | 'cap' | 'data' | 'email' | 'tel'
                   // | 'select' | 'testo'
  required,        // boolean
  maxLength,       // number | null
}

// Prodotto da validators.js
Result = {
  ok,              // boolean
  message,         // string | null — in italiano, rivolto a Sara, con il passo successivo
  chunkIndex,      // number | null — quale gruppo di 4 caratteri ricontrollare
}

// Prodotto da copy.js, per kind o per id specifico (l'id vince sul kind)
Copy = {
  what,            // string — cosa vuole questo campo, in una frase
  where,           // string | null — dove trovarlo
  example,         // string | null — esempio di formato
  parts,           // Part[] | null — da cosa è composto il codice, pezzo per pezzo
  remember,        // string | null — cosa portarsi via per la prossima volta
}

// Un pezzo di un codice lungo. È la parte che insegna: senza questa, Sara copia
// caratteri senza capire cosa sta copiando, e fra sei mesi ricomincia da zero.
Part = {
  from,            // number — indice del primo carattere
  to,              // number — indice dell'ultimo carattere
  name,            // string — come si chiama questo pezzo ('Cognome', 'ABI')
  meaning,         // string — cosa vuol dire, in parole di Sara
}

// Salvato da profile.js in chrome.storage.local
Profile = {
  // per ogni kind: quante volte Sara ha sbagliato
  errorsByKind: { pod: 2, iban: 1, ... },
  // livello di supporto calcolato per la compilazione successiva
  supportByKind: { pod: 'pieno', cf: 'minimo', ... }   // 'pieno' | 'minimo' | 'muto'
}
```

## Regola sul livello di supporto

- `pieno` → inserimento a blocchi di 4, segnalazione caratteri ambigui, rilettura a
  specchio obbligatoria prima di confermare.
- `minimo` → solo verifica finale, nessuna interruzione.
- `muto` → il pannello non dice niente su questo campo.

Il calcolo è banale e deve restare banale: **un errore su quel `kind` → `pieno`; zero
errori → `minimo`; due compilazioni consecutive senza errori → `muto`.**

Con una precisazione: al **primo modulo in assoluto** il supporto è `pieno` su tutto.
Prima di aver visto Sara lavorare non sappiamo niente di lei, e il silenzio va guadagnato,
non dato per scontato. Senza questa clausola la regola darebbe `minimo` a una persona che
non ha ancora scritto un carattere.

## Ordine di costruzione

Costruire **in questo ordine**, e non passare al punto successivo finché il precedente non
funziona davvero nel browser:

1. ✅ `log.js` + manifest + content script che evidenzia il primo campo. **La fetta
   verticale.** Finché questa non gira, tutto il resto è rischio.
2. ✅ La scoperta dei campi sul modulo vero (vedi `agents/campi.md`).
3. ✅ La navigazione campo per campo.
4. ✅ `validators.js` agganciato ai campi critici.
5. ✅ `profile.js` e la seconda compilazione.
6. ✅ Schermata riassuntiva delle metriche.

Tutti e sei i punti girano nel browser. Quello che resta non è più costruzione, è
rifinitura: vedi la tabella delle divergenze in `agents/context.md`.

## Definition of done — cosa deve succedere in demo

1. POD compilato con un carattere sbagliato **senza** estensione → il portale risponde
   "Dati non validi" e non dice dove.
2. Stesso modulo **con** estensione: guida campo per campo, Sara sbaglia l'IBAN,
   l'estensione lo intercetta prima dell'invio e indica il gruppo da ricontrollare.
3. Stesso modulo, seconda compilazione: il pannello tace sui campi che Sara ha
   compilato bene, e resta accanto solo dove aveva sbagliato.
4. Schermata con le metriche delle due sessioni.

Se una funzionalità non serve a uno di questi quattro momenti, non va costruita.

## Metriche da loggare (dal primo commit)

- `field_focus` — id del campo, timestamp
- `field_error` — id, kind, tipo di errore
- `help_opened` — id del campo
- `submit_attempt` — esito
- `field_completed_unaided` — id
- `field_incomplete` — id, stato: Avanti premuto su un campo vuoto o non valido
- `field_skipped` — id, stato: ha scelto di andare avanti lo stesso
- `session_end` — durata totale
