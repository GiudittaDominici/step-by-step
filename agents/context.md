# Contesto del progetto — Step by Step

## Cos'è
Estensione Chrome per la compilazione guidata di moduli web, progettata per utenti con dislessia o difficoltà di attenzione.
Realizzata per l'Hagenthon (hackathon Accenture Application Engineering), tema 03 — Educazione Digitale Inclusiva.

## Persona target
**Sara, 26 anni** — dislessia e difficoltà di attenzione diagnosticate.
- Usa benissimo WhatsApp, Instagram, delivery.
- La fatica è nel decodificare testo lungo e nelle stringhe alfanumeriche (IBAN, codice fiscale).
- Va in sovraccarico cognitivo oltre 3-4 nuove informazioni simultanee.
- Il blocco non è l'intelligenza né la tecnologia: è carico di lettura + tenuta della sequenza.

## Struttura del progetto
```
step-by-step/
├── app/
│   ├── extension/          ← codice estensione Chrome
│   │   ├── manifest.json
│   │   ├── content.js      ← logica principale (form detection, panel, step-by-step)
│   │   ├── background.js
│   │   ├── popup.html
│   │   └── popup.js
│   └── demo/
│       └── form.html       ← form Illumia mockato per la demo
├── agents/
│   └── context.md          ← questo file
├── presentation/           ← slide e materiale demo
└── README.md
```

## Come caricare l'estensione in Chrome
1. Aprire `chrome://extensions`
2. Attivare "Modalità sviluppatore" (in alto a destra)
3. Cliccare "Carica estensione non compressa"
4. Selezionare la cartella `app/extension/`
5. Aprire `app/demo/form.html` in Chrome

## Campi supportati con guidance specifica
I campi del form demo hanno id precisi che il content.js riconosce:
`nome`, `cognome`, `data_nascita`, `luogo_nascita`, `codice_fiscale`, `sesso`,
`email`, `telefono`, `indirizzo`, `civico`, `cap`, `citta`, `tipo_contratto`, `potenza`, `iban`

Per campi non in lista, il content.js inferisce una guida generica leggendo il `<label>`.

## Feature chiave
- **Un campo alla volta**: bordo pulsante blu sul campo attivo, tutti gli altri al 38% di opacità
- **Plain language**: istruzione breve + dettaglio + tip facoltativo
- **Chunked preview**: CF e IBAN vengono mostrati in gruppi da 4 con separatore · man mano che si scrive
- **Progress bar**: "Passo X di Y" aggiornato a ogni step
- **Timer inattività**: dopo 20 s senza input, mostra il tip o un suggerimento di aiuto
- **Schermata finale**: 🎉 con messaggio di completamento

## Note per la demo (prima/dopo)
- **Prima** (senza estensione): aprire form.html e mostrare l'utente sopraffatta da tutti i campi visibili contemporaneamente
- **Dopo** (con estensione attiva): cliccare il pulsante blu e mostrare il percorso guidato campo per campo
