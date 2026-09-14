# Cosa costruiamo

## In una frase

Un'estensione Chrome che, sul modulo di cambio fornitore luce/gas, guida Sara **un campo
alla volta**, verifica i codici **prima** dell'invio, e al modulo successivo **si zittisce**
sui campi che lei ormai padroneggia.

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
Il profilo d'errore sopravvive alla sessione. Al secondo modulo il pannello interviene solo
sui tipi di campo dove Sara ha effettivamente sbagliato.

**Il livello 3 è la capability agentica richiesta dal tema.** Senza, siamo fuori tema.

## Moduli

Tutti i file dell'estensione stanno in `app/extension/`.

| File | Responsabilità | Chi |
|---|---|---|
| `manifest.json` | MV3 minimo | insieme |
| `content.js` | Entry point: avvia scanner, costruisce il pannello, orchestra il flusso | insieme |
| `scanner.js` | Legge il form e produce la lista di `Field` | A |
| `validators.js` | Verifica un valore per `kind`. Nessuna rete. | A |
| `profile.js` | Legge/scrive il profilo d'errore e le metriche in `chrome.storage.local` | A |
| `panel.js` | Il pannello in Shadow DOM: render, navigazione, stati | B |
| `copy.json` | I testi per Sara, uno per `kind` e per campo specifico | B |
| `log.js` | `log(evento, dati)` → storage. Da scrivere per primo. | insieme |

Le pagine del modulo stanno in `app/demo/`: `form.html` (luce) e `form-gas.html` (gas, il
secondo modulo che serve al livello 3).

## Il contratto dati

**Questo è l'unico accordo fra A e B. Non cambiarlo senza dirlo all'altra persona e
aggiornare questo file.**

```js
// Prodotto da scanner.js, consumato da panel.js
Field = {
  el,              // HTMLElement — il campo vero nella pagina
  id,              // string — identificatore stabile (id, name, o generato)
  label,           // string — l'etichetta leggibile, già ripulita
  kind,            // 'cf' | 'iban' | 'pod' | 'pdr' | 'cap' | 'data' | 'select' | 'testo'
  required,        // boolean
  maxLength,       // number | null
}

// Prodotto da validators.js
Result = {
  ok,              // boolean
  message,         // string | null — in italiano, rivolto a Sara, con il passo successivo
  chunkIndex,      // number | null — quale gruppo di 4 caratteri ricontrollare
}

// Prodotto da copy.json, per kind o per id specifico (l'id vince sul kind)
Copy = {
  what,            // string — cosa vuole questo campo, in una frase
  where,           // string | null — dove trovarlo
  example,         // string | null — esempio di formato
}

// Salvato da profile.js in chrome.storage.local
Profile = {
  // per ogni kind: quante volte Sara ha sbagliato
  errorsByKind: { pod: 2, iban: 1, ... },
  // livello di supporto calcolato per il modulo successivo
  supportByKind: { pod: 'pieno', cf: 'minimo', ... }   // 'pieno' | 'minimo' | 'muto'
}
```

## Regola sul livello di supporto

- `pieno` → inserimento a blocchi di 4, segnalazione caratteri ambigui, rilettura a
  specchio obbligatoria prima di confermare.
- `minimo` → solo verifica finale, nessuna interruzione.
- `muto` → il pannello non dice niente su questo campo.

Il calcolo è banale e deve restare banale: **un errore su quel `kind` → `pieno`; zero
errori → `minimo`; due moduli consecutivi senza errori → `muto`.**

## Ordine di costruzione

Costruire **in questo ordine**, e non passare al punto successivo finché il precedente non
funziona davvero nel browser:

1. `log.js` + manifest + content script che evidenzia il primo campo e ne scrive
   l'etichetta in un div iniettato. **La fetta verticale.** Finché questa non gira, tutto
   il resto è rischio.
2. `scanner.js` sui campi veri del modulo (vedi `agents/campi.md`).
3. `panel.js` con la navigazione campo per campo.
4. `validators.js` agganciato ai campi critici.
5. `profile.js` + il secondo modulo.
6. Schermata riassuntiva delle metriche.

Se alle 4:00 il punto 5 non è pronto, si taglia il punto 6 e si mostrano i numeri dalla
console. Se alle 4:00 il punto 5 non è nemmeno iniziato, si taglia il secondo modulo e si
racconta il livello 3 a voce con i dati loggati.

## Definition of done — cosa deve succedere in demo

1. POD compilato con un carattere sbagliato **senza** estensione → il portale risponde
   "Dati non validi" e non dice dove.
2. Stesso modulo **con** estensione: guida campo per campo, Sara sbaglia l'IBAN,
   l'estensione lo intercetta prima dell'invio e indica il gruppo da ricontrollare.
3. Secondo modulo (gas), mai visto: il pannello interviene **solo su due campi**.
4. Schermata con le metriche delle due sessioni.

Se una funzionalità non serve a uno di questi quattro momenti, non va costruita.

## Metriche da loggare (dal primo commit)

- `field_focus` — id del campo, timestamp
- `field_error` — id, kind, tipo di errore
- `help_opened` — id del campo
- `submit_attempt` — esito
- `field_completed_unaided` — id
- `session_end` — durata totale
