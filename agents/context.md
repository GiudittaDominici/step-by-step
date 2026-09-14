# Contesto del progetto — Step by Step

> Questo file descrive **lo stato attuale del repo**: cosa c'è, come si esegue, cosa
> diverge dalla specifica. Le decisioni di prodotto stanno altrove:
> `agents/persona.md`, `agents/spec.md`, `agents/campi.md`, `agents/validatori.md`.
> Le regole per chi scrive codice stanno in `CLAUDE.md`.

## Cos'è

Estensione Chrome per la compilazione guidata di moduli web, progettata per utenti con
dislessia o difficoltà di attenzione. Realizzata per l'Hagenthon (hackathon Accenture
Application Engineering), tema 03 — Educazione Digitale Inclusiva.

Persona target: **Sara, 26 anni**. Il profilo completo è in `agents/persona.md` — è quello
che vale in caso di disaccordo.

## Struttura del repo

```
step-by-step/
├── CLAUDE.md               ← regole per chi scrive codice
├── README.md
├── presentation/           ← slide e materiale demo
├── agents/
│   ├── context.md          ← questo file: stato del repo
│   ├── persona.md          ← chi è Sara, tono, cosa deve imparare
│   ├── spec.md             ← cosa costruiamo, moduli, contratto dati
│   ├── campi.md            ← mappa reale dei campi del modulo
│   └── validatori.md       ← regole di validazione e casi di test
└── app/
    ├── extension/          ← codice estensione Chrome
    │   ├── manifest.json
    │   ├── content.js      ← oggi: tutta la logica in un file solo
    │   ├── background.js
    │   ├── popup.html
    │   └── popup.js
    └── demo/
        └── form.html       ← modulo mockato (luce e gas, senza branding)
```

## Come eseguire la demo

1. Servire la pagina: `python3 -m http.server` dalla cartella `app/demo/`.
   **Non aprirla da `file://`**: la specifica prevede un content script che matcha
   `http://localhost:*/*`.
2. Aprire `chrome://extensions`, attivare «Modalità sviluppatore».
3. «Carica estensione non compressa» → cartella `app/extension/`.
4. Aprire `http://localhost:8000/form.html`.

## Stato attuale del codice

`content.js` (776 righe, un file solo) implementa oggi:

- **Un campo alla volta**: bordo blu sul campo attivo, gli altri attenuati.
- **Testo di guida per campo**: istruzione breve + dettaglio + tip, da una tabella
  `FIELD_GUIDE` interna; per i campi non in tabella, guida inferita dalla `<label>`.
- **Anteprima a blocchi** di CF e IBAN in gruppi da 4 mentre si scrive.
- **Barra di avanzamento** «Passo X di Y».
- **Timer di inattività**: dopo 20 s mostra il tip.
- **Schermata finale** di completamento.

## Divergenze fra codice attuale e specifica

Da chiudere prima della demo. Ognuna è un lavoro breve, ma nessuna è opzionale.

| Cosa                      | Oggi                                                     | Specifica                                                           |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| Livello 2 — validazione   | assente                                                  | `validators.js`: CF e IBAN con controllo matematico                 |
| Livello 3 — profilo       | assente                                                  | `profile.js` su `chrome.storage.local`, il supporto si ritira       |
| Metriche                  | assenti                                                  | `log(evento, dati)` dal primo commit                                |
| Secondo modulo (gas)      | non esiste: `pod` e `pdr` stanno nella stessa pagina     | serve una seconda pagina mai vista, al punto 3 della definition of done |
| Struttura file            | tutto in `content.js`                                    | 8 file, vedi tabella moduli in `agents/spec.md`                     |
| Pannello                  | iniettato senza isolamento                               | Shadow DOM `attachShadow({mode:'open'})`                            |
| Manifest                  | `<all_urls>` + `file://*/*`, `activeTab`, service worker | solo `storage`, match `http://localhost:*/*`, niente service worker |
| Tono                      | usa emoji ed entusiasmo                                  | `agents/persona.md`: niente emoji, niente esclamativi               |

## Note per la demo (prima/dopo)

- **Prima** (senza estensione): aprire il modulo e mostrare tutti i campi insieme. Inserire
  un POD con un carattere sbagliato: il portale risponde «Dati non validi» e non dice dove.
- **Dopo** (con estensione attiva): percorso guidato campo per campo; l'IBAN sbagliato
  viene intercettato prima dell'invio, con l'indicazione del gruppo da ricontrollare.
- **Secondo modulo (gas)**: il pannello interviene solo sui campi dove Sara ha sbagliato.
- **Chiusura**: schermata con le metriche delle due sessioni.

La definition of done completa è in `agents/spec.md`.

