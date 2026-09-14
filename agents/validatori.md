# Validatori

> `validators.js` non fa rete, non chiama modelli, non ha dipendenze. È il pezzo che non
> deve fallire mai davanti alla giuria.

Firma unica:

```js
validate(kind, value) -> { ok, message, chunkIndex }
```

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
questo è quello del secondo modulo. Stesso trattamento del POD: blocchi da 4 e rilettura a
specchio.

| Valore | Atteso |
|---|---|
| `01234567890123` | ✅ formato valido |
| `0123456789012` | ❌ (13 cifre) |
| `0123456789012A` | ❌ (contiene una lettera) |

---

## `cap`

`^\d{5}$`. Messaggio: «Il CAP è di 5 cifre.»

## `data`

Formato `gg/mm/aaaa`, data reale (attenzione a `31/02`), non nel futuro per una data di
nascita. Messaggio: «Questa data non esiste. Controlla il giorno.»

> Nel modulo demo il campo è un `<input type="date">`: il browser consegna il valore come
> `aaaa-mm-gg`. Il validatore accetta entrambe le forme e normalizza prima di controllare.

## `select`

Nessuna validazione: qui il lavoro è nel testo, non nel controllo. Il gergo di questi campi
va spiegato in `copy.json` (vedi «Tipo di utilizzo» in `agents/campi.md`).

---

## Come generare i casi negativi

Non inventarli a mano. La proprietà da testare è una sola, ed è esattamente l'errore di
Sara:

> **Scambiare due caratteri adiacenti in un codice valido deve sempre produrre un codice
> non valido**, per `cf` e `iban`.

Genera i negativi programmaticamente da ogni valore valido, scambiando ogni coppia
adiacente. Se un solo scambio passa la validazione, il validatore è sbagliato.
