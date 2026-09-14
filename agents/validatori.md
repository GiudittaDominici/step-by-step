# Validatori

> `validators.js` non fa rete, non chiama modelli, non ha dipendenze. È il pezzo che non
> deve fallire mai davanti alla giuria.

Due firme:

```js
validate(kind, value)   -> { ok, message, chunkIndex }
checkLive(kind, value)  -> { state, message, charIndex, chunkIndex, raw, expected }
```

`validate` è la verifica finale. `checkLive` è quella che gira mentre Sara scrive:
`state` vale `'vuoto' | 'in-corso' | 'ok' | 'errore'`.

Mentre il codice è incompleto **non si può dire che è sbagliato**: il checksum non è
ancora calcolabile. Quindi durante la digitazione segnaliamo solo i caratteri
*impossibili in quella posizione* — una lettera dove va una cifra, un mese che non
esiste. È vero subito e non dà falsi allarmi. Il checksum scatta a lunghezza piena.

`message` è in italiano, rivolto a Sara, e **dice sempre dove guardare** (vedi le regole di
tono in `agents/persona.md`). `chunkIndex` è l'indice del gruppo di 4 caratteri da
ricontrollare, oppure `null`.

---

## La distinzione che regge tutto il progetto

Ci sono **due classi** di validazione, e confonderle è l'errore da non fare.

**Classe 1 — controllo matematico.** Codice fiscale e IBAN hanno un carattere di controllo
calcolato dagli altri. Un errore di trascrizione si intercetta con **certezza**.

**Classe 2 — solo formato.** POD e PDR non hanno checksum pubblico. Si può verificare solo
lunghezza, prefisso e quali posizioni sono lettere o cifre. **Un codice ben formato ma
sbagliato passa.** Questo è un limite da dichiarare in demo, non da nascondere.

Per la classe 2 la difesa non è la validazione, è l'interazione: inserimento a blocchi di
4, segnalazione dei caratteri ambigui, rilettura a specchio prima di confermare.

---

## Dove è l'errore: come lo troviamo

Il checksum dice *che* il codice è sbagliato, mai *dove*. Ma gli errori di Sara sono di
due tipi soli (`agents/persona.md`): scambio di due caratteri adiacenti, e confusione fra
caratteri che si somigliano (`0`/`O`, `1`/`I`/`L`, `5`/`S`, `2`/`Z`, `8`/`B`).

Allora proviamo a correggere il codice in tutti quei modi — una cinquantina di tentativi,
istantanei — e guardiamo quali correzioni fanno tornare il checksum.

- Se le correzioni che funzionano cadono **tutte nello stesso gruppo di 4**, quel gruppo è
  il sospettato: «Nel gruppo 4 potresti aver sbagliato un carattere.»
- Se cadono in gruppi diversi, o se nessuna funziona, **non diciamo un gruppo**:
  «Rileggilo un gruppo alla volta, dal primo.»

Questo secondo caso non è una resa, è la regola che tiene onesto lo strumento. Mandare
Sara a ricontrollare il gruppo sbagliato è peggio che non dirle niente: perde fiducia
nello strumento e la prossima volta lo ignora.

**Limite da dichiarare in demo:** il gruppo indicato è il più probabile, non il certo. Il
messaggio usa «potresti» apposta.

---

## `cf` — Codice fiscale

**Formato:** 16 caratteri.
`^[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z]$`

**Controllo matematico:** i primi 15 caratteri si sommano usando due tabelle diverse —
una per le posizioni **dispari** (1ª, 3ª, 5ª…) e una per le **pari**. La tabella pari è
banale (`0-9` → `0-9`, `A-Z` → `0-25`); quella dispari è una tabella fissa da riportare per
intero. Il totale modulo 26 dà una lettera: deve coincidere con il 16° carattere.

**Casi di test — verificati:**

| Valore | Atteso |
|---|---|
| `RSSMRA85M01H501Q` | ✅ valido |
| `BNCLRA92E45F205F` | ✅ valido |
| `VRDGPP78T12L219L` | ✅ valido |
| `RSSMRA85M10H501Q` | ❌ (scambio di due cifre adiacenti) |
| `RSSMRA85M01H501A` | ❌ (carattere di controllo errato) |
| `RSSMRA85M01H50` | ❌ (lunghezza) |

**Messaggio d'errore:** «Questo codice fiscale non torna. Ricontrolla la data di nascita,
sono le cifre dal 7° al 11° carattere.»

---

## `iban` — IBAN italiano

**Formato:** 27 caratteri.
`^IT\d{2}[A-Z]\d{10}[A-Z0-9]{12}$`

**Controllo matematico (mod 97):**
1. sposta i primi 4 caratteri in fondo;
2. sostituisci ogni lettera col numero corrispondente (`A`=10 … `Z`=35);
3. il numero risultante modulo 97 deve dare **1**.

Usa aritmetica a blocchi (resto progressivo su 9 cifre alla volta) oppure `BigInt`:
un IBAN supera la precisione di `Number`.

**Casi di test — verificati:**

| Valore | Atteso |
|---|---|
| `IT60X0542811101000000123456` | ✅ valido |
| `IT60X0542811101000001023456` | ❌ (scambio di due cifre adiacenti) |
| `IT61X0542811101000000123456` | ❌ (cifre di controllo errate) |
| `IT60X05428111010000001234` | ❌ (lunghezza) |

**Messaggio d'errore:** «Questo IBAN non torna. Ricontrolla il gruppo {chunkIndex}: è il
punto in cui si sbaglia più spesso.»

---

## `pod` — Punto di prelievo (energia elettrica)

**Solo formato.** 14 caratteri: `^IT\d{3}E[A-Z0-9]{8}$`
`IT` + 3 cifre del distributore + `E` + 8 caratteri alfanumerici.

**Casi di test:**

| Valore | Atteso |
|---|---|
| `IT001E12345678` | ✅ formato valido |
| `IT001E1234S678` | ✅ formato valido — **e questo è il punto**: è il codice sbagliato di Sara e passa comunque |
| `IT001F12345678` | ❌ (la 6ª posizione deve essere `E`) |
| `IT01E12345678` | ❌ (lunghezza) |

**Caratteri ambigui da segnalare mentre scrive:** `0`/`O`, `1`/`I`/`l`, `5`/`S`, `2`/`Z`, `8`/`B`.

**Comportamento richiesto:** inserimento in 4 gruppi visivamente separati, e prima di
confermare una **rilettura a specchio** — il pannello mostra il codice a blocchi e chiede
conferma esplicita gruppo per gruppo.

**Messaggio (non è un errore, è una conferma):** «Rileggi un gruppo alla volta. Il quarto
carattere del gruppo 2 può essere una S o un 5.»

---

## `pdr` — Punto di riconsegna (gas)

**Solo formato.** 14 cifre: `^\d{14}$`

Nessun appiglio visivo, nessun checksum: è il campo peggiore del progetto per Sara, e per
questo è il campo su cui il supporto resta pieno più a lungo. Stesso trattamento del POD:
blocchi da 4 e rilettura a specchio.

| Valore | Atteso |
|---|---|
| `01234567890123` | ✅ formato valido |
| `0123456789012` | ❌ (13 cifre) |
| `0123456789012A` | ❌ (contiene una lettera) |

---

---

## I gruppi: una sola divisione

Un codice lungo non si legge a fette da quattro: si legge a pezzi che vogliono dire
qualcosa. `validators.js` dichiara la segmentazione in `SEGMENTS`, ed è **l'unica del
progetto**.

| `kind` | Gruppi |
|---|---|
| `cf` | Cognome · Nome · Anno · Mese · Giorno · Comune · Controllo |
| `iban` | Paese · Controllo · CIN · Banca · Filiale · Conto |
| `pod` | Paese · Distributore · Energia · Contatore |
| `tel` | 3 · 3 · 4 per i cellulari, altrimenti a gruppi di 3 |
| `email` | Nome · Chiocciola · Dominio (calcolati dalla posizione della `@`) |
| `pdr`, `cap` | nessuna: si torna ai blocchi da 4, numerati |

Da questa segmentazione dipendono tre cose, e **devono restare allineate**:

1. i riquadri che il pannello disegna;
2. la spiegazione pezzo per pezzo sotto i riquadri (`copy.js` fornisce solo i
   *significati*, agganciati per nome — non ridichiara la divisione);
3. il `chunkIndex` dei messaggi d'errore, così il gruppo nominato è quello evidenziato.

Se si scollano, Sara legge due divisioni diverse dello stesso codice. C'è un test che lo
impedisce (sezione 7 di `tools/test-validators.js`).

**`pdr` e `cap` non hanno gruppi con un significato**, e va detto così com'è: sono cifre
senza struttura. `tel` ha i riquadri ma non la spiegazione, perché staccare le cifre serve
solo a rileggerle, non a capirle.

---

## `email`

Nessuna regex mostruosa. Controlliamo le cose che Sara sbaglia davvero, e per ognuna
sappiamo dire dove guardare:

| Caso | Messaggio |
|---|---|
| spazio dentro | «C'è uno spazio dentro l'indirizzo. Toglilo.» |
| due `@` | «Ci sono due chiocciole. Ne serve una sola.» |
| nessuna `@` | «Manca la chiocciola. Un indirizzo è fatto così: nome@esempio.it» |
| niente prima della `@` | «Prima della chiocciola manca il nome.» |
| dominio senza punto | «Dopo la chiocciola manca il punto. Esempio: gmail.com» |
| dominio finale troppo corto | «Manca la parte finale. Dopo l'ultimo punto va .it oppure .com» |

Mentre scrive segnaliamo solo gli errori **già certi** — lo spazio, la doppia chiocciola,
un carattere impossibile nel dominio. Un indirizzo incompleto non è un indirizzo
sbagliato: `sara.bia` è `in-corso`, non `errore`.

## `tel`

Si normalizza prima: via spazi, punti, trattini, parentesi, e il prefisso `+39` o `0039`.

- solo cifre;
- se comincia per `3` è un cellulare: **esattamente 10 cifre**;
- altrimenti da 9 a 11 cifre.

**Visualizzazione:** le cifre si staccano `3 · 3 · 4` per i cellulari, a gruppi di 3
altrimenti. Dieci cifre di fila non si rileggono, ed è l'unico aiuto che questo campo
può dare.

| Valore | Atteso |
|---|---|
| `3401234567` | ✅ |
| `340 123 4567` | ✅ (gli spazi si ignorano) |
| `+39 340 123 4567` | ✅ (il prefisso si ignora) |
| `0212345678` | ✅ (fisso) |
| `34012345` | ❌ (cellulare troppo corto) |
| `3401234A67` | ❌ (contiene una lettera) |

## `cap`

`^\d{5}$`. Messaggio: «Il CAP è di 5 cifre.»

## `data`

Formato `gg/mm/aaaa`, data reale (attenzione a `31/02`), non nel futuro per una data di
nascita. Messaggio: «Questa data non esiste. Controlla il giorno.»

> Nel modulo demo il campo è un `<input type="date">`: il browser consegna il valore come
> `aaaa-mm-gg`. Il validatore accetta entrambe le forme e normalizza prima di controllare.

## `select` — campi a scelta

Nessuna validazione: qui il lavoro è nel testo, non nel controllo.

Sara non sbaglia a trascrivere, sbaglia a **capire**. Il gergo non le sembra difficile, le
sembra ovvio, e sceglie con sicurezza l'opzione sbagliata senza chiedere aiuto. È il caso
peggiore descritto in `agents/persona.md`.

Da qui tre regole:

1. **Un gruppo di radio è una domanda sola.** Un passo, non uno per opzione. Il campo si
   accende tutto insieme: attenuare metà delle opzioni nasconde parte della domanda.
2. **Le opzioni si mostrano tutte, spiegate, prima di scegliere.** Non si lascia indovinare
   e non si spiega solo quella "giusta". I significati stanno in `OPTIONS` dentro
   `copy.js`, per `id` del campo (per i radio, il `name`) e poi per `value`.
3. **Il pannello non sceglie.** Mostra e spiega; il clic lo fa Sara, sul campo vero, che
   intanto è evidenziato. Vedi regola 1 di `CLAUDE.md`.

Il testo della guida non ripete le opzioni: le elenca il pannello. Altrimenti Sara legge
due volte la stessa cosa, e sono quattro informazioni nuove invece di due.

---

## Come generare i casi negativi

Non inventarli a mano. La proprietà da testare è una sola, ed è esattamente l'errore di
Sara:

> **Scambiare due caratteri adiacenti in un codice valido deve sempre produrre un codice
> non valido**, per `cf` e `iban`.

Genera i negativi programmaticamente da ogni valore valido, scambiando ogni coppia
adiacente. Se un solo scambio passa la validazione, il validatore è sbagliato.

## Come si eseguono

```
node tools/test-validators.js
```

88 asserzioni. Coprono i casi elencati qui sopra, la proprietà degli scambi adiacenti su
3 codici fiscali e 4 IBAN, email e telefono, l'allineamento fra riquadri e spiegazione, la
verifica dal vivo, e la regola di ritiro del supporto di `profile.js`.
