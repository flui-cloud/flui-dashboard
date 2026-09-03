# Semantic Surface — playbook per un producer su una nuova pagina Flui

**Data:** 2026-09-02, aggiornato 2026-09-03 dopo il primo giro su 38 pagine reali.
**A chi è rivolto:** un coding agent (o una persona) a cui viene chiesto di aggiungere
un producer Semantic Surface a una pagina della dashboard Flui che non ne ha ancora
uno. Autosufficiente: chi lo riceve legge questo documento più la specifica, non il
resto della conversazione che lo ha prodotto.

**Perché questo documento esiste, e perché non è un generatore.** La specifica vieta,
per principio, che uno strumento generico deduca "questo è il vero focus dell'utente"
guardando il DOM o le route di una pagina (§2.4, §3.4) — è un giudizio, non un fatto
meccanico. Investire in un generatore statico contraddirebbe esattamente la disciplina
che rende la Surface affidabile. La strada scelta è diversa: dare a un coding agent
capace un brief preciso — questo documento — e lasciare che sia lui a scrivere il
producer, pagina per pagina, con la stessa cura con cui lo farebbe una persona. Il primo
producer Flui (dettaglio applicazione) è stato costruito così, revisionato da una
persona, e ha comunque prodotto due bug reali (§ "Errori già fatti" sotto) — motivo in
più per mettere quei due errori per iscritto qui, non per lasciare il compito a un tool.

---

## 1. Fonte di verità

La specifica normativa è **congelata**, vive fuori da questo repo:
- `~/Project/flui/semantic-surface/docs/agent-surface/semantic-surface-core-v0.2.md`
- `~/Project/flui/semantic-surface/docs/agent-surface/semantic-surface.schema.json`

Se il codice di un producer e la specifica divergono, ha ragione la specifica. Se serve
cambiare il formato del wire, ci si ferma e si chiede all'autore — non si adatta la
specifica alla comodità del momento.

**Da leggere per intero prima di scrivere qualsiasi producer**, in questo ordine:
sezione 1.3 (cosa una Surface non deve mai diventare), 3.4 (regola anti-drift), 4 (la
forma esatta di `SurfaceSnapshot`/`SemanticScopeSnapshot`/`EntityReference`/
`AttentionTarget`/`Observation`), 6 (vocabolari riservati per `kind`/`reason`), 8.2
(redazione prima della serializzazione), 8.4 (il digest).

Il secondo riferimento è il primo producer reale già scritto in questo repo —
`src/app/features/components/application/application-surface.ts` — non un mock-up, il
codice vero, revisionato. Copiarne la forma è più sicuro che inventarne una nuova.

Un terzo riferimento, per un caso diverso da quello che questo repo ha già affrontato
(una pagina-lista senza selezione, non una pagina-dettaglio a entità singola): il
producer `surface-fleet.js` nel repo `vops` — vedi § "Attenzione vs correlato" sotto.

---

## 2. Convenzioni già scelte in questo repo — non reinventarle

- **`app.id` del producer:** `'flui-dashboard'` (`SURFACE_APP_ID` in
  `application-surface.ts`) — lo stesso per ogni producer di questo repo, non uno per
  pagina.
- **Grammatica dei `ref`:** `flui://<entity-type>/<entity-id>` (§5.1 della specifica).
  L'id è quello reale del dominio (es. l'uuid dell'applicazione), mai un id sintetico
  inventato per la Surface.
- **Namespace delle chiavi di osservazione:** `flui.<area>.<campo>`, es.
  `flui.application.status`, `flui.application.replicas_ready` — coerente con §6.1.
- **Id degli scope:** per-istanza, non per-definizione (§4.2) — `app-detail:<app.id>`,
  non `app-detail` da solo.
- **Id composti per entità senza uno spazio-id condiviso:** quando una pagina elenca
  righe di tipi diversi con id che possono collidere (es. una lista di migrazioni che
  mescola migrazioni applicazione/database/full, ciascuna con la propria sequenza di
  id) — `flui://<tipo>/<sottotipo>:<id>`, non un `ref` che si limita all'id nudo. Vedi
  `migrations-list-surface.ts` per l'esempio reale.
- **Una pagina con più liste già ha un helper condiviso — usalo.**
  `src/app/shared/utils/surface-kit.ts` fornisce `entityRef`/`compositeEntityRef`,
  `textObservation`/`valueObservation`/`boolObservation`, e `buildSurfaceList` (pagina →
  uno scope `list` → uno scope `region` per riga, con `completeness`, sullo stesso
  schema di `vops/src/ui/dashboard/surface-kit.js`). Se stai scrivendo un producer per
  una pagina-lista, importa da lì invece di riscrivere la logica di troncamento/
  completeness da zero — la maggioranza dei producer di questo repo già lo fa.

---

## 3. Il file per pagina, e la sua forma

Un producer vive in un file fratello del componente della pagina, non dentro al
componente stesso — es. `application-surface.ts` accanto ad
`application-detail.component.ts`. Il componente resta piccolo: importa e chiama, non
costruisce la logica della Surface inline.

**Forma obbligatoria, in tre pezzi — non collassarli in uno:**

```ts
// 1. Cosa viene VERAMENTE mostrato, senza la busta di revisione/timestamp attorno.
//    Usata sia per costruire lo snapshot finale, sia per far avanzare la revisione.
export function presentedContent(input: XSurfaceInput): PresentedContent | null { ... }

// 2. Lo snapshot completo, con la busta.
export function buildXSurface(input: XSurfaceInput, context: XSurfaceContext): SurfaceSnapshot | null {
  const content = presentedContent(input);
  if (!content) return null;
  return { schemaVersion: '0.2', app: {...}, surface: {...}, attention: content.attention, scopes: content.scopes };
}

// 3. Il contatore di revisione — vedi § "Errori già fatti", punto 1, PRIMA di scriverlo.
export class XSurfaceRevision { ... }
```

Il motivo dei tre pezzi separati, non uno: il contatore di revisione deve fare l'hash
di **esattamente** ciò che `presentedContent` produce, non dell'input grezzo del
componente — vedi sotto.

---

## 4. Attenzione vs correlato — l'unica vera decisione di giudizio

`attention` (a livello di snapshot) dice *dove sta guardando l'utente*. `role: 'related'`
su un'entità dentro uno scope dice *questa entità è elencata qui, ma non è ciò che
l'utente sta guardando ora*. La differenza è deittica: "riavvia questo" deve poter
risolvere solo su ciò che è in `attention`.

**Due casi, due pattern diversi — non forzare l'uno nell'altro:**

- **Pagina di dettaglio, un'entità reale al centro** (dettaglio applicazione, dettaglio
  cluster, dettaglio istanza): `attention` nomina quell'entità, `reason: 'route'`, e
  l'entità dentro lo scope ha `role: 'primary'`. Questo è il pattern già scritto in
  `application-surface.ts`.
- **Pagina-lista senza selezione reale** (una tabella dove cliccare una riga naviga
  altrove, non seleziona): `attention` non nomina **nessuna** entità — solo la pagina
  stessa, se serve. Ogni riga della lista è `role: 'related'`, mai `'primary'`. Questo è
  onesto: "riavvia questo" non deve risolvere su una riga a caso. Vedi
  `vops/src/ui/dashboard/surface-fleet.js` e il suo stesso commento sul perché.
  **Non inventare uno stato di selezione che il prodotto non ha** solo per poter
  scrivere un `attention` più ricco — se la pagina non ha selezione, dichiaralo, non
  aggirarlo.

**Terzo e quarto caso, trovati costruendo il primo giro su 38 pagine reali — non più
teorici, hanno un file di riferimento ciascuno:**

- **Selezione multipla reale** (checkbox, bulk-select) — es. `ssh-keys-surface.ts`. Ogni
  riga selezionata prende `role: 'selected'`, e `attention` le elenca **tutte**, in un
  ordine deciso esplicitamente (es. l'ordine di selezione, o l'ordine della lista) — la
  specifica non impone un ordine tra più target di attenzione, quindi va scelto e
  dichiarato nel file, non lasciato implicito. Verifica sempre nel codice reale se la
  selezione esiste davvero (checkbox/set di id selezionati) prima di assumerla — la
  lista applicazioni sembrava un candidato ovvio e non ce l'ha affatto (click = naviga,
  non seleziona).
- **Selezione guidata da deep-link/query param** — es. `templates-catalog-surface.ts`
  (`?framework=` evidenzia una card). È uno stato di selezione reale e intenzionale del
  prodotto, non inventato — ma va gestito con un test esplicito per il caso in cui il
  filtro/ricerca corrente nasconda l'elemento linkato: `attention` allora ripiega sulla
  sola pagina, mai su un'entità che non è effettivamente visibile in quel momento.

**Quinto caso: non ogni riga cliccabile merita un `ref`.** Un modale che elenca
candidati che non sono ancora entità del dominio Flui (es. repository GitHub non
ancora importati, vedi `repositories-list-surface.ts`) **non** deve ricevere un `ref`
`flui://` — quell'id non corrisponde a niente che un tool Flui possa risolvere finché
l'importazione non è avvenuta. Modella lo scope senza entità (solo un conteggio/stato),
non forzare un namespace su qualcosa che non gli appartiene ancora.

**Sesto: se più scope potrebbero reclamare l'attenzione contemporaneamente** (due
overlay aperti insieme, anche se l'interfaccia oggi non lo permette), scrivi una regola
di arbitraggio esplicita e testala — non lasciare che vinca "quello che capita di essere
valutato per ultimo nel codice". Vedi `repositories-list-surface.ts`: tra un overlay di
conferma-cancellazione (nomina un'entità reale) e un overlay di importazione (non nomina
nessuna entità), vince il primo, per iscritto e con un test dedicato.

---

## 5. Regola anti-drift, applicata concretamente

Il producer legge lo **stesso** stato reattivo che il template già usa per disegnare la
pagina — mai un secondo modello parallelo (§3.4). Conseguenza pratica trovata scrivendo
il primo producer: `application-detail.component.ts` non aveva un signal "tab attiva"
già pronto — è stato derivato dal router (`route.snapshot.firstChild?.routeConfig?.path`
via `router.events`), la stessa fonte che il binding `routerLinkActive` del template già
legge. **Non creare un nuovo signal "per la Surface"** se un'informazione equivalente è
già ricavabile dalla stessa fonte del template.

---

## 6. Errori già fatti — non ripeterli

Il primo producer li ha fatti entrambi, sono stati trovati da una revisione indipendente
(Fable 5.1) e corretti. Sono scritti qui perché il prossimo producer non ha bisogno di
riscoprirli.

1. **La revisione deve fare l'hash di ciò che è presentato, mai dell'input grezzo.**
   `ApplicationSurfaceRevision.next()` inizialmente faceva `JSON.stringify(input)` — ma
   `input` porta campi (es. l'intero oggetto `runtime`) che il producer non presenta mai
   come osservazione. Un campo mai mostrato che cambia faceva comunque avanzare la
   revisione, in contraddizione con §7.1 ("cambia quando cambia il contenuto che uno
   snapshot esprimerebbe"). **Fai l'hash del risultato di `presentedContent(input)`**,
   non di `input` stesso — vedi § 3 sopra, ed è per questo che `presentedContent` è un
   pezzo separato.
2. **`scope.state` descrive la vista, mai la salute del dominio.** `state.error`
   significa "questa vista non è riuscita a caricare/mostrare qualcosa", non "l'entità
   che sto mostrando è in stato di errore" (§4.3). Un'applicazione con
   `status: 'failed'` ha comunque caricato bene la sua pagina di dettaglio — quello stato
   va in un'**osservazione** (`flui.application.status`), mai in `scope.state`.
3. **Non pubblicizzare nel digest un tool che non esiste.** Era un problema reale — il
   digest citava `read_surface` mentre nessun tool con quel nome esisteva. Chiuso: il
   tool ora esiste in `flui-core/src/modules/assistant/services/assistant-agent.service.ts`
   (`execReadSurface`, iniettato solo quando `ctx.semanticSurface` è presente — non è nel
   registro condiviso `ALL_TOOLS`, è specifico al loop assistant perché solo lì esiste "il
   turno corrente"). `surface-block.util.ts` fissa esplicitamente
   `fullSnapshotTool: READ_SURFACE_TOOL` invece di appoggiarsi al default del pacchetto,
   proprio per impedire che i due tornino a divergere in silenzio.
4. **Non fidarti che un campo "sembri sicuro" — verifica la classificazione backend
   reale prima di includerlo.** Il producer VNet ha scoperto che `VNetResponseDto` non
   aveva **nessuna** `@Sensitivity` sui suoi campi IP/CIDR/gateway — non perché fossero
   giudicati sicuri, ma perché nessuno li aveva mai classificati. Un campo non
   classificato passa sempre in chiaro dall'interceptor di mascheramento, mask mode
   attivo o no. Prima di includere un IP, un indirizzo, un identificativo di rete in
   un'osservazione: apri il DTO reale in `flui-core/src/modules/**/dto/*.dto.ts` e
   verifica che porti `@Sensitivity(Sensitivity.NETWORK_IDENTIFIER)` (o
   `TENANT_IDENTITY` per email/nomi persona) — se non ce l'ha, **non è un problema del
   producer da aggirare**, è un buco nel modulo mask da segnalare e chiudere lì, prima
   di decidere se il campo entra nella Surface.
5. **La Surface legge dagli stessi segnali che il mascheramento della pagina ha già
   deciso — non un canale a parte.** Se una pagina applica correttamente mask mode ai
   dati che mostra, e il producer legge quegli stessi segnali (§5, anti-drift), la
   Surface eredita automaticamente quella protezione — non serve una seconda logica di
   mascheramento nel producer. Il rischio reale è l'opposto: un producer che leggesse i
   dati **prima** che passassero dal mascheramento, o da una fonte diversa da quella che
   il template usa, aggirerebbe silenziosamente mask mode. Verificalo esplicitamente
   quando scrivi un producer su una pagina che mostra dati classificati.
6. **"Il campo è nel DTO" non basta — verifica che la *rotta* dichiari quel DTO.**
   `GET /iam/grants`, `/iam/principals`, `/iam/groups` non avevano nessun
   `@ApiResponse`/`@ApiOkResponse` sul controller: l'interceptor di mascheramento risolve
   il tipo di risposta dalla metadata di `@nestjs/swagger` (non da `instanceof`, i
   controller restituiscono oggetti semplici), quindi senza quel decoratore era un no-op
   totale — email reali arrivavano sullo schermo e nella Surface anche a mask mode
   attivo. Prima di fidarti di una classificazione `@Sensitivity`, apri anche il
   controller e conferma che la rotta che il producer legge dichiari davvero quel DTO
   in un `@ApiResponse`/`@ApiOkResponse`.
7. **Un canale può bypassare mask mode senza passare dalla Surface.** Il digest della
   Surface (≤2KB) non era il buco più grande — lo era il risultato completo e non
   troncato di ogni tool call MCP verso il modello, che non portava mai l'header
   `x-mask-mode` (le chiamate loopback di `McpApiCaller` non lo impostavano), quindi
   arrivava sempre in chiaro indipendentemente dal toggle mask dell'utente sullo
   schermo. Non serviva un nuovo concetto di "livello di mascheramento" — bastava far
   scattare lo stesso `maskOn` anche quando la richiesta porta un header
   `x-flui-agent-surface` valido (vedi `agentSurfaceOf()` in
   `auth/utils/actor-surface.ts`, che è già fail-closed su token forgiati). Se aggiungi
   un nuovo canale che porta dati verso un agente (non verso lo schermo), la domanda da
   farsi è sempre questa, non "che livello di mascheramento serve qui".

---

## 7. Redazione — checklist, non fiducia

Prima di aggiungere un'osservazione, verifica esplicitamente che il campo letto non sia:
variabili d'ambiente, credenziali, testo grezzo di errore/stack trace, metadata interni
non pensati per essere mostrati. Il primo producer ha un test dedicato proprio a questo
(`application-surface.spec.ts`, il test "redacts") — scrivine uno equivalente per ogni
nuovo producer, non fidarti che "tanto non ci ho messo mano".

---

## 8. Il cancello — obbligatorio, non facoltativo

`expectValidSurface(snapshot)` da `src/testing/surface-test-utils.ts` fa passare lo
snapshot vero contro lo **schema reale e congelato**, non un doppio scritto a mano — più
`validateSurfaceSemantics`. `expectDeterministicDigest(snapshot)` chiama il digest due
volte e verifica byte per byte. Questi due helper già risolvono il problema che le
funzioni di validazione/digest del pacchetto sono Node-only (`node:fs`, `Buffer`) e non
caricano nel bundle di test del browser — **non riscrivere lo shim `Buffer`/l'istanza
Ajv in ogni nuovo file di test**, importa da lì.

Un nuovo producer non è finito finché il suo file di test non:
- chiama `expectValidSurface` su almeno uno snapshot realistico;
- chiama `expectDeterministicDigest`;
- esercita **davvero** il controllo `invalid-revision` con una `previousSnapshot` (non
  solo affermare che il contatore "dovrebbe" incrementare — un test che chiama
  `validateSurfaceSemantics` con una revisione volutamente non avanzata, e verifica che
  l'errore scatti);
- verifica che nessuno stato sia inventato quando l'entità principale non è ancora
  caricata (niente snapshot, non uno snapshot vuoto — § "no scopes → no snapshot" nel
  precedente vops);
- copre la checklist di redazione del § 7.

`pnpm run build` e `npx ng test --no-watch --browsers=ChromeHeadless` puliti, sulla
baseline corrente (475 al momento di questo documento) più i test nuovi — mai un test
preesistente modificato nelle sue attese per far passare il lavoro nuovo.

---

## 9. Il registro — un solo slot, con una canarina che lo grida se si rompe

`CurrentSurfaceService` (`src/app/core/services/current-surface.service.ts`) tiene **un
solo** snapshot alla volta, ultimo-scritto-vince, senza concetto di "quale pagina". È una
scelta YAGNI deliberata (vedi il doc comment nel file), non una svista: oggi una sola
pagina-producer è mai montata alla volta, perché Angular distrugge il componente A (che
pulisce la propria voce in `ngOnDestroy`) prima che il componente B scriva la propria.
Costruire un registro multi-slot ora sarebbe idraulica per una UI che non esiste ancora
(master-detail, un modale sopra una pagina-producer), e la specifica stessa non ha ancora
deciso come arbitrare due snapshot vivi insieme (§4, sesto caso).

Non è più "silenzioso": `set()` porta una canarina solo-dev (`isDevMode()`) che confronta
`surface.id` prima di sovrascrivere — se uno snapshot diverso sostituisce uno vivo senza
una scrittura `null` in mezzo (cioè nessun `ngOnDestroy` è girato), stampa un
`console.error` esplicito e prosegue comunque la scrittura (non blocca mai). Test in
`current-surface.service.spec.ts` (4 casi: stato iniziale, clear pulito, stessa pagina che
riscrive la propria snapshot, e la canarina che scatta). Se il producer che stai scrivendo
è per una pagina master-detail/modale del genere, la canarina te lo dirà in sviluppo — a
quel punto fermati e segnalalo, il registro va esteso con un concetto di identità/scope
prima di procedere, non dopo.

---

## 10. Cosa NON fare, mai

- Nessun tag `sensitivity`/`capabilityHints`/suggerimento di azioni correlate nello
  snapshot — la specifica lo vieta per principio (§1.3, §14). La Surface consegna
  riferimenti (`ref`), non azioni. Il ponte verso un'azione (un tool MCP che accetta
  quell'id) è un problema del lato consumer, non del producer.
- Mai il JSON completo nel prompt — solo il digest (§8.4). Il JSON completo esiste solo
  come risultato di un tool esplicito (vedi punto 3 di § 6).
- Mai un'osservazione per un dato che la pagina non mostra davvero in quel momento.
- Mai uno stato di selezione/attivo inventato per rendere `attention` più interessante.
- **Un primo A/B/C reale (Mistral, 4 scenari sintetici) sembrava mostrare che
  "identità senza dati" induce il modello a inventare fatti falsi con sicurezza — una
  revisione indipendente (Fable) ha trovato che il test aveva difetti reali che
  confondono quella conclusione: gli snapshot sintetici erano **non validi contro lo
  schema** (mancava `scopeId` su `attention`, `kind` sullo scope, `Observation` usava
  `id` invece di `key`) — il digest che il modello vedeva davvero conteneva
  `undefined Running`, non `flui.application.status Running`, e nessun `tools` era
  passato mentre il prompt ordina esplicitamente di usarne — condizioni in cui
  qualunque modello tende a inscenare un finto uso di tool invece di rispondere. La
  produzione reale, inoltre, spedisce già "identità + dati ridotti" di proposito (vedi
  `vnet-details-surface.ts`, che omette CIDR/gateway per scelta anche dopo la
  classificazione `@Sensitivity`) — il caso davvero pericoloso da testare
  (digest reale con un campo redatto + una domanda proprio su quel campo) non è mai
  stato provato. **Non trattare "mai identità senza dati" come regola consolidata.**
  Resta buona pratica ometterla l'intero blocco su una validazione fallita (integrità,
  non anti-allucinazione) — ma la regola più ampia richiede un test rifatto con
  snapshot validi e tool reali prima di essere presa per buona.
- **La riga `att` del digest ora mostra la label — FATTO, nel pacchetto
  `semantic-surface`.** Era un bug del renderer, non un buco di specifica:
  `EntityReference.label` esisteva già nello schema ed era già popolato dai producer
  reali, ma `attentionLine()`/`roleOf()` in `surface-digest.ts` non lo leggevano mai.
  Ora `att 1 <reason> <ref> · <role> · "<label>"` — con fallback cross-scope quando la
  label vive su una copia dell'entità in uno scope diverso da quello attenzionato
  (caso reale, trovato nel fixture di vops), mai una label inventata quando nessuno
  scope ne ha una. Stessa label anche sulle righe `entity` correlate, deduplicata
  contro il titolo dello scope solo quando lo scope ha una sola entità (altrimenti su
  uno scope multi-entità si perderebbe la label di un'entità diversa che coincide per
  caso col nome dello scope — es. un VNet con lo stesso nome di un server collegato).
  4 giri di revisione indipendente (Fable) prima di considerarlo chiuso, incluso
  mutation-testing sui test nuovi. Verificato su tutti e 3 i consumer (`flui-core`,
  `flui-dashboard` — 418 producer test, `vops` — 2295 test), nessuna rottura.
  **Staged in `semantic-surface`, non ancora committato.**
- **Il sospetto sulla parola "untrusted" nella fence resta aperto, non confermato.**
  L'ablazione che sembrava confermarlo girava sullo stesso digest non valido del punto
  sopra (`undefined Running`) e senza tool disponibili — due confonditori più forti
  della singola parola nella fence. Non agire su questo (né qui né nel pacchetto
  condiviso con vops) finché non viene rifatto con uno snapshot valido e tool reali.

---

## 11. Quale pagina fare dopo, e perché

**Aggiornato 2026-09-03: la copertura è sostanzialmente completa.** 37 producer coprono
ogni pagina autenticata reale del dashboard — le pagine a tab multipli (Application,
Cluster, Scaling) non hanno un producer per tab, sono coperte dal producer della pagina
madre via scope `activeTab` composto (§4). Le uniche route senza producer sono
pre-login (`auth/callback`, `auth/login`, `sandbox-claim`) e uno shell/demo interno —
corretto che non ne abbiano. L'arbitraggio tra entità multiple non è più teorico —
coperto da `ssh-keys-surface.ts` (selezione multipla reale) e
`templates-catalog-surface.ts` (selezione da deep-link). Quello che resta scoperto:

- **Le console database sono escluse per design, non rimandate.** Prima ipotesi era
  "meritano un giro dedicato con più redazione" — rivista: hanno già un meccanismo
  assistant separato e dedicato (`db-assistant-chat.component.ts`, il copilot per
  Postgres/Mongo/Redis/Kafka/KV/ricerca full-text ecc., costruito in un lavoro
  precedente). Costruire un producer Semantic Surface lì duplicherebbe o entrerebbe in
  conflitto con quel meccanismo, oltre al rischio strutturale di far passare righe di
  query/documenti/valori KV reali nel prompt della chat principale. Non serve nessun
  nuovo codice per "dire che manca il contesto" sulla chat principale quando l'utente è
  su una di queste pagine: nessun producer → nessun blocco Surface nel prompt (già il
  comportamento di default), e le guardrail esistenti ("se non sai, dillo, non
  indovinare") coprono già il caso. Se emergesse un dubbio specifico sul comportamento
  del copilot dedicato di queste pagine, è un audit separato — non fa parte di questo
  playbook.
- **La tab Nodi di un cluster**, se espone una selezione vera — non ancora verificato.
- Qualunque pagina con **due producer potenzialmente montati insieme** (una vista
  master-detail, un modale sopra una pagina che ha già un producer attivo) — vedi § 9:
  il registro oggi non regge questo caso, va risolto **prima**, non scoperto in corsa.

---

## 12. Come riferire, a fine lavoro

Per ogni producer costruito: cosa è stato costruito (i tre file/pezzi di § 3) · l'esito
del cancello del § 8, incollato per intero, non riassunto · quale pattern di § 4 è stato
usato e perché · qualsiasi punto del § 6 rischiato e come evitato · cosa è rimasto fuori
e perché. Mai `git commit`, mai `git push` — ci si ferma allo staging e si consegna il
comando.
