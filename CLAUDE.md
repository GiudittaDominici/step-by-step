# Campo per campo

Estensione Chrome che affianca **Sara** — 26 anni, dislessia e difficoltà di attenzione —
mentre compila il modulo online di cambio fornitore luce/gas, e le insegna a farlo da sola.

Progetto per Hagenthon (Accenture Application Engineering), Tema 03 — Educazione Digitale
Inclusiva. Team da 2 persone, **5 ore di sviluppo**. Questo vincolo governa ogni decisione:
a parità di risultato vince sempre la strada più corta.

## Contesto obbligatorio

Leggi questi file prima di scrivere codice:

| File | Cosa contiene |
|---|---|
| `agents/persona.md` | Chi è Sara, dove si blocca, cosa deve imparare |
| `agents/spec.md` | Cosa costruiamo, i moduli, il contratto dati fra loro |
| `agents/campi.md` | La mappa reale dei campi del modulo su cui lavoriamo |
| `agents/validatori.md` | Regole di validazione e casi di test |
| `agents/context.md` | Struttura del repo, come caricare l'estensione, stato attuale |

## Le tre regole che non si negoziano

1. **L'estensione non compila i campi al posto di Sara.** Mai. Nemmeno come comodità,
   nemmeno dietro un pulsante "riempi". Se compila lei, Sara non impara e il progetto
   perde il suo unico obiettivo. Sara scrive, noi spieghiamo e verifichiamo.

2. **I validatori funzionano offline, senza rete e senza modello.** Codice fiscale e IBAN
   hanno un controllo matematico deterministico. È il pezzo che non deve fallire mai
   davanti alla giuria.

3. **Il supporto si ritira.** Lo strumento ricorda su quali *tipi* di campo Sara sbaglia
   e al modulo successivo interviene solo lì. Senza questo, abbiamo costruito uno
   strumento di accessibilità, non un percorso di apprendimento — e siamo fuori tema.

## Architettura: decisioni già prese

- **Un solo content script.** Niente service worker, niente `chrome.sidePanel`, niente
  messaggi fra contesti. Tutto gira nella pagina.
- **Il pannello si inietta nella pagina**, posizione fissa a destra, dentro uno
  **Shadow DOM** (`attachShadow({mode:'open'})`) così il CSS del sito non lo tocca.
- **Manifest V3 minimo**: `permissions: ["storage"]` e un `content_scripts` che matcha
  `http://localhost:*/*`. Niente host_permissions, niente web_accessible_resources
  finché non servono davvero.
- **Nessuna build, nessun bundler, nessun framework.** JavaScript vanilla, file caricati
  in ordine dal manifest. Un passaggio di build in un hackathon è solo un modo di rompersi.
- **Nessuna libreria esterna** se non è indispensabile.
- **La pagina del modulo è una copia locale** in `app/demo/`, servita con
  `python3 -m http.server`. Gli script originali del sito sono stati rimossi: la pagina è
  inerte e prevedibile.

## Convenzioni

- Identificatori e nomi file in **inglese**; commenti e stringhe rivolte all'utente in
  **italiano**. Ogni parola che Sara può leggere è in italiano, semplice, seconda persona.
- Niente `async` dove non serve. Niente astrazioni preventive: un modulo, un file, una
  responsabilità.
- Ogni evento rilevante passa da `log(evento, dati)` fin dal primo commit. Le metriche
  sono un deliverable del progetto, non un extra finale.

## Divisione del lavoro (non aprire i file dell'altro)

- **Persona A** → `scanner.js`, `validators.js`, `profile.js`
- **Persona B** → `panel.js`, `copy.json`
- **Insieme** → `manifest.json`, `content.js`, `log.js`

Se una modifica richiede di cambiare il contratto dati in `agents/spec.md`, si dice ad alta
voce e si aggiorna il file prima di scrivere il codice.

## Cosa NON costruire

Queste cose non sono "da fare dopo": sono fuori scopo, e proporle costa tempo.

- Autocompletamento dei dati di Sara
- Impostazioni, onboarding, login, tema scuro, internazionalizzazione
- Supporto generico "per qualsiasi form del web": calibriamo su **un** modulo
- Un tutor conversazionale a chat aperta
- Test automatici oltre a quelli dei validatori
- Qualsiasi funzionalità nuova dopo le 4:30. Alle 4:30 il codice è congelato.
