# 🧠 BRAIN.md — Sistema de Gestió i Repartiment de Fanals i Emplaçaments Electorals (v1.0)

> Document de context, arquitectura i memòria tècnica del projecte **`eleccions-sant-joan` v1.0** (Ajuntament de Sant Joan de Vilatorrada).

---

## 1. Visió General del Projecte

Aplicació web *full-stack* dissenyada per a l'**Ajuntament de Sant Joan de Vilatorrada** per gestionar de forma digital, transparent i automatitzada la configuració tècnica municipal, la selecció de preferències i el sorteig/repartiment d'espais de propaganda electoral entre les candidatures polítiques:

1. **Inventari de faroles (`lamps`) amb model de 3 estats i Lots manuals (`lots`)**:
   - El sistema carrega les **1.540 faroles geolocalitzades** de `punts_de_llum.geojson` a l'inventari `db.lamps` classificades en **3 estats** amb aptitud configurable per l'administració:
     - **`NO_APTA` (`🔒 No apta — bloquejada`, 558 punts per defecte)**: Inclou els `434` suports de façana/paret (`Braç a façana` [392], `A paret` [30], `Braç a pal de fusta` [10], `Focus a façana` [2]) **més les `124` lluminàries secundàries** muntades sobre un mateix suport físic de doble/triple braç (`< 1,8 m` respecte a la principal, `findSecondaryPoleMap`), garantint que **1 columna física = 1 fanal electoral** i que mai s'adjudiquin dos partits diferents al mateix pal. Des de **`Gestió Municipal → 💡 Faroles`** es poden declarar com a `APTA` en qualsevol moment.
     - **`APTA` (`⚪ No seleccionada — Apta`, 982 suports físics únics per defecte)**: Els **`982` suports físics únics** de `Columna` i `Bàcul` (`suitable: true`, `selected: false`), més qualsevol altra farola declarada manualment com a apta. Són visibles al mapa per poder-les marcar com a `SELECCIONADA`, però **mentre no estiguin seleccionades no poden conformar cap lot**.
     - **`SELECCIONADA` (`✔ Seleccionada`, 0 inicials)**: Faroles aptes activades manualment per la comissió municipal (`selected: true`). **Només les faroles amb estat `SELECCIONADA` poden conformar un lot** i entrar al còmput de les quotes electorals.
   - **Espai unificat d'edició al mapa (`Faroles i Lots al Mapa`) i regla `Lot ⊆ SELECCIONADA`**: des d'un únic panell al mapa l'administració pot marcar punts en blau (clicant-los, arrossegant un rectangle amb el mapa fixat o afegint tot un carrer) i aplicar accions homogènies (**`✔ Marcar com a Seleccionades`** / **`⚪ Desmarcar com a Seleccionades`**) o crear/editar directament **Lots de `N` faroles seleccionades**. Per defecte `db.lots = []`, sense capa redundant de `Zones`.
   - **Assistent guiat de selecció per als partits (`PartySelectionPanel.jsx` — Opció 1)**: un únic panell lateral guiat (amb guia desplegable en 3 passos i mode minimitzat) concentra tota l'operativa del partit en 2 pestanyes:
     1. **`💡 Lots i Fanals`**: llista vertical per ordenar la **importància dels lots** (`1r, 2n, 3r...` amb `⋮⋮` i `↑/↓`, sincronitzada en viu amb les etiquetes `1r · LOT-XX` i ressaltat al mapa) i vista de detall (**`Numerar →`**) per numerar individualment les faroles seleccionades de cada lot (`#1, #2, #3...`). A l'hora del sorteig, cada partit té garantida la seva part entera proporcional a cada lot ($\lfloor \% \times N_{\text{lot}} \rfloor$), mentre que les **places de resta** s'adjudiquen seguint l'ordre de lots preferit de cada partit (màxim `+1` per lot, validat amb flux màxim *Edmonds-Karp* i torns D'Hondt desempatats per `orderRank`), i tot seguit les faroles concretes dins de cada lot s'assignen per quocient **D'Hondt** (`lotQuota / (assignadesAlLot + 1)`).
     2. **`📍 Emplaçaments`**: ordenació vertical (`#1, #2, #3...`) sincronitzada amb les xinxetes `📍+` del mapa, més accés directe al peu a **Importar Històric** i **Reiniciar tot**.
2. **Emplaçaments fixos (`locations`) gestionats al mapa i seleccionats com un Lot de Prioritat (`1..M`)**:
   - **Alta i edició directa sobre el mapa (`Emplaçaments al Mapa`)**: l'administració pot ubicar cartelleres, panells i pancartes clicant al plànol (amb autocompletat del carrer proper, càrrega/redimensionat de foto i arrossegament directe de xinxetes `📍`). En editar un emplaçament existent, el mapa manté el cursor normal (sense moure'n les coordenades per clics accidentals) i ofereix el botó explícit **`Moure clicant al mapa`** si es vol reubicar per clic.
   - **Regla d'1 plaça màxima per partit/emplaçament**: cada candidatura pot ocupar **com a màxim 1 plaça a cada emplaçament físic** (`allocatedLocationsQuota` limitada a `db.locations.length` i capacitat efectiva de cada punt limitada a `db.parties.length`), intercalant torns amb el quocient **D'Hondt** (`allocatedLocationsQuota / (assignats + 1)`).
3. **Candidatures polítiques, quotes i control de reinici (`parties` + `preferences`)**: Gestió CRUD completa des de `Gestió Municipal → 👥 Partits i Quotes` (alta, edició de dades i credencials, baixa amb invalidació de sessió, ordenació `1..N`, edició en línia de `% Quota` / regidors / vots i recàlcul automàtic per vots, per regidors amb `%` mínim reservat o igualitari), més **seguiment i reinici granular** tant de l'adjudicació del sorteig com de les seleccions/prioritats marcades pels partits (globalment per a tots els partits, individualment per a un partit concret o autogestionat pel propi partit mentre l'estat és `OPEN`).

El funcionament funcional i algorísmic pren com a referència el manual oficial *«Selecció de fanals i emplaçaments per la propaganda electoral (v1.1.1)»* (`Selecció de fanals i emplaçaments.pdf`), adaptat al flux operatiu i a les dades GIS obertes de Sant Joan de Vilatorrada.

---

## 2. Stack Tecnològic i Estructura del Repositori

### Tecnologies
- **Arrel (Monorepo lleuger)**: Orquestració amb `concurrently`.
- **Frontend (`client/`)**:
  - **React 19** + **Vite 8** (ESM) + `oxlint`, amb *code-splitting* per càrrega diferida (`React.lazy` + `Suspense`) dels modals i panells pesants (`AdminPanel`, `PartySelectionPanel`, `LotSelectionModal`, `AllocationAnimationModal`, `InfoModal`, `RestorePastModal`), deixant el paquet inicial en ~433 kB (`130 kB` gzip).
  - **Cartografia**: `leaflet` (`1.9.4`) + `react-leaflet` (`5.0.0`) amb renderitzat `preferCanvas` d'alt rendiment per a les 1.540 faroles, capes OpenStreetMap i ortofoto satèl·lit Esri World Imagery, selecció rectangular per arrossegament (`pointerdown` → `pointerup` amb `map.dragging.disable()` temporal, compatible amb ratolí, tàctil i 2 clics), càlcul geomètric d'envolupant convexa (*Andrew's Monotone Chain Convex Hull*) per dibuixar polígons de lots en temps real, i control de càmera no intrusiu (`MapSearchController` per seqüència monotònica `seq` amb `panTo` suau + `MapActiveLotFitter` que respecta el zoom manual i evita auto-zoom en clicar punts o refrescar dades).
  - **UI, Accessibilitat i Disseny *Responsive***: CSS nadiu (`color-scheme: light` amb alt contrast garantit), capçalera col·lapsable en mòbil (`<= 860px`), panells laterals de mapa convertits en *bottom-sheet* (`52dvh`, `<= 768px`) perquè la meitat superior del mapa segueixi clicable, pestanyes i capçaleres de taula fixes (*sticky*), `lucide-react` i `canvas-confetti`.
- **Backend (`server/`)**:
  - **Node.js** (ESM) + **Express 4** + `cors`.
  - **Autenticació i Seguretat**: Tokens signats amb HMAC-SHA256 (`server/auth.js`), *middlewares* `requireAuth`, `requireParty` i `requireAdmin`, i sanejament de `GET /api/data` segons rol (`lamps` complet només s'envia a `ADMIN`) + memòria cau HTTP condicional (`ETag` / `304 Not Modified`).
  - **Persistència**: Base de dades relacional **SQLite en mode `WAL`** (`eleccions.sqlite`, mitjançant el mòdul natiu `node:sqlite` de Node 24 sense dependències C++ `node-gyp`) gestionada per `server/db.js`, amb 9 taules normalitzades (`meta`, `lamps`, `lots`, `locations`, `parties`, `party_lot_preferences`, `party_lot_orders`, `party_location_preferences`, `election_history`), transaccions ACID `BEGIN IMMEDIATE ... COMMIT`, escriptures `O(1)` d'una sola fila per als clics de preferències dels partits (`~0,05 ms/tx`), memòria cau hidratada en RAM per a lectures en `< 0,1 ms`, tancament net de `WAL` en `SIGTERM`/`SIGINT`, i inicialització automàtica a la primera arrencada des de la llavor estàtica `server/seed.json` (o `punts_de_llum.geojson`).
  - **Informes**: `pdfkit` per generar l'acta oficial d'assignació en PDF, més exportadors nadius de **GeoJSON** i **CSV** (amb BOM UTF-8 per a Excel).

### Arbre de Fitxers Clau
```text
eleccions/
├── Dockerfile                          # Multi-stage Node 24 Alpine per a Dokploy (SQLite WAL a DATA_DIR=/app/data, port 3001)
├── .dockerignore                       # Exclusió de node_modules, dist, *.sqlite* i docs pesants en el context Docker
├── .gitignore                          # Exclusió de node_modules, dist, *.sqlite* i .env
├── .env.example                        # Plantilla de variables d'entorn per a producció / Dokploy
├── README.md                           # Guia ràpida i passos de desplegament a GitHub + Dokploy
├── package.json                        # Scripts d'arrencada conjunta, lint i build
├── brain.md                            # Memòria tècnica i arquitectura del projecte
├── MANUAL.md                           # Manual de funcionament per a administració i partits
├── punts_de_llum.geojson               # Dataset GIS original (1.563 registres / 1.540 geolocalitzats)
├── Selecció de fanals i emplaçaments.pdf # Manual funcional i regles de l'algorisme de referència
├── server/
│   ├── index.js                        # API REST Express (port 3001) + servidor estàtic dist/ + tancament net WAL
│   ├── auth.js                         # Tokens HMAC-SHA256 i middlewares d'autorització per rol
│   ├── db.js                           # Motor relacional SQLite WAL (9 taules), cau en RAM, ETag i quotes proporcionals
│   ├── seed.json                       # Llavor inicial estàtica (només es llegeix el 1r cop si no existeix eleccions.sqlite)
│   ├── algorithm.js                    # Motor de repartiment proporcional per lot (D'Hondt intercalat) + emplaçaments
│   ├── pdf.js                          # Generador d'acta oficial en PDF amb detall farola a farola per lot
│   ├── import_real_data.js             # Script ETL: reinicialitza SQLite des de punts_de_llum.geojson (0 lots)
│   └── data/
│       └── eleccions.sqlite            # Base de dades transaccional viva en execució (+ fitxers -wal / -shm, ignorada a Git)
└── client/
    ├── index.html
    ├── vite.config.js                  # Configuració Vite + proxy /api -> localhost:3001
    └── src/
        ├── api.js                      # Client HTTP centralitzat (Bearer token, sessionStorage i ETag)
        ├── utils.js                    # Utilitats compartides (estats de farola, prioritats i redimensionat d'imatges)
        ├── adminDrafts.js              # Esborranys inicials compartits per a lots, emplaçaments i partits
        ├── lotColors.js                # Paleta categòrica d'alt contrast perquè cada lot tingui un color distintiu
        ├── App.jsx                     # Estat global, càrrega diferida (lazy) de modals i coordinació UI
        ├── index.css                   # Estils globals, sistema responsive i modals amb capçaleres fixes
        └── components/
            ├── Header.jsx              # Barra superior institucional responsive (unifica vista Admin a Gestió Municipal + «Generar Acta»)
            ├── MapViewer.jsx           # Visor Leaflet + editor unificat «Faroles i Lots al Mapa» + insígnies 1r..Kè i xinxetes 1..N per partit
            ├── PartySelectionPanel.jsx # Assistent unificat guiat per als partits (Ajuda 3 passos, Ordre vertical de Lots, Faroles 1..N i Emplaçaments 1..M)
            ├── LoginModal.jsx          # Autenticació + accés ràpid de demostració segur via servidor
            ├── LotSelectionModal.jsx   # Fitxa modal d'inspecció i edició ràpida del lot per a Administració
            ├── RestorePastModal.jsx    # Importació intel·ligent de preferències per codi físic de farola (AP.XX) i lot
            ├── InfoModal.jsx           # Taula informativa de candidatures, regidors/vots i quotes per als partits
            ├── AdminPanel.jsx          # Gestió Municipal d'Espais Electorals (6 pestanyes: Faroles, Lots, Emplaçaments, Partits, Sorteig, Històric)
            └── AllocationAnimationModal.jsx # Resultat i simulació pas a pas del repartiment
```

---

## 3. Execució i Credencials d'Accés

### Comandes Principals
```powershell
# Des de l'arrel: arrenca simultàniament Backend (3001) i Frontend (5173)
npm run dev

# Només servidor (amb node --watch)
npm run server

# Només client Vite
npm run client

# Comprovació de qualitat (lint) i compilació de producció (client/dist)
npm run lint
npm run build

# Reinicialitzar l'inventari des de punts_de_llum.geojson (1.106 faroles Aptes, 434 No Aptes i 0 lots)
node server/import_real_data.js
```

### Rols i Credencials (Entorn actual / Demo)
| Rol | Usuari | Contrasenya | Ràtio proporcional (`quotaRatio`) |
| :--- | :--- | :--- | :--- |
| **Administració Municipal** | `admin` | `admin` | Gestió integral d'espais, aptitud, lots, emplaçaments i sorteig |
| **Partit (1r)** | `ERC` | `erc` | ERC-AM — 5 regidors (`26%` de la borsa de fanals aptes i emplaçaments) |
| **Partit (2n)** | `JUNTS` | `junts` | JUNTS — 4 regidors (`22%`) |
| **Partit (3r)** | `PSC` | `psc` | PSC-CP — 3 regidors (`17%`) |
| **Partit (4t)** | `AXSJ` | `axsj` | AxSJ — 2 regidors (`12%`) |
| **Partit (5è)** | `CXSJ` | `cxsj` | CxSJ — 2 regidors (`11%`) |
| **Partit (6è)** | `CUP` | `cup` | CUP-AMunt — 1 regidor (`8%`) |
| **Partit (7è)** | `PP` | `pp` | PP — 0 regidors (`4%`) |

---

## 4. Model de Dades i Esquema Relacional SQLite (`eleccions.sqlite`)

Tota la persistència viva resideix a `eleccions.sqlite` (`DATA_DIR/eleccions.sqlite`, mode `WAL`) distribuïda en **9 taules** (`lamps`, `lots`, `locations`, `parties`, `party_lot_preferences`, `party_lot_orders`, `party_location_preferences`, `election_history` i `meta`). El fitxer `server/seed.json` **no s'utilitza en temps d'execució**: només actua com a llavor inicial estàtica el primer cop que s'obre un volum buit (p. ex. el primer desplegament a `/app/data` de Dokploy).

- **`lamps` (1.540 faroles reals en 3 estats)**: Col·lecció principal de punts d'enllumenat públic (`id`, `codi`, `carrer`, `num`, `suport`, `lampada`, `potencia`, `lat`, `lng`, `status`: `'NO_APTA' | 'APTA' | 'SELECCIONADA'`, `suitable`, `selected`, `lockedUnsuitable`, `unsuitableReason`, `lotId`). Per defecte `isAptSupport(suport)` inicialitza `Columna` (970) i `Bàcul` (136) com a `'APTA'` i la resta (434) com a `'NO_APTA'`, però `normalizeLampState(lamp)` respecta qualsevol canvi d'aptitud desat per l'administració via `/api/admin/lamp/aptitude`.
- **`lots` (`[]` buit per defecte, exclusivament faroles `SELECCIONADA`)**: Lots creats manualment per l'administració. Per regla de negoci estricta (`Lot ⊆ SELECCIONADA`), un lot **només pot contenir faroles amb `status === 'SELECCIONADA'`** (si una farola es reverteix a `APTA` o `NO_APTA`, `recalculateLotsAndQuotas(db)` la retira automàticament del lot i elimina qualsevol lot que quedi buit). Cada lot hidrata `lamps`, `coords`, `totalLampCount`, `lampCount`, `partyMinQuotas` (part entera garantida), `partyMaxQuotas` (sostre proporcional amb `+1` de resta), `remainderSlots` i `partyQuotas`.
- **`parties`**: Llista ordenada (`orderRank` `1..N`) de candidatures polítiques (`id`, `name`, `acronym`, `color`, `seats`, `votes`, `quotaPct`, `effectiveQuotaPct`, `allocatedStreetlampsQuota`, `allocatedLocationsQuota`, `username`, `password`). `sanitizeDbForClient` oculta sempre `password` i exposa `username`/`hasPassword` únicament al rol `ADMIN`.
- **`locations`**: Emplaçaments fixos (`id`, `name`, `type`: `CARTELLERA | PANCARTA | PANELL`, `address`, `description`, `capacity`, `lat`, `lng`, `imageUrl`). La borsa efectiva `totalLocationsAvailable` comptabilitza `min(capacity, parties.length)` per emplaçament i `allocatedLocationsQuota` de cada partit es limita com a màxim a `locations.length` (màxim 1 plaça per partit per emplaçament físic).
- **`electionInfo`**: `title`, `date`, estat `"OPEN" | "CLOSED" | "ALLOCATED"`, `totalStreetlampsAvailable` i `totalLocationsAvailable` (recalculats automàticament a cada desament).
- **`lotPreferences` / `lotOrderPreferences` / `locationPreferences` / `allocationResults`**: `lotPreferences[partyId][lotId] = { orderedLampCodes: [...] }` desa l'ordre de prioritat `1..N` de les faroles dins de cada lot; `lotOrderPreferences[partyId] = ['LOT-03', 'LOT-01', ...]` desa l'ordre d'importància dels lots per a l'adjudicació de restes flexibles; `locationPreferences[partyId] = ['EMP-01', ...]` desa l'ordre de prioritat `1..M` dels emplaçaments fixos; `allocationResults` desa `lampAssignments`, `lotLampAssignments`, `lotPartyCounts`, `resolvedLotQuotas`, `locationAssignments`, `partyAssignedLamps`, `partyAssignedLocations` i `stepLogs`.

---

## 5. Mapa d'Endpoints de l'API (`server/index.js`)

| Mètode | Ruta | Accés | Descripció |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Públic | *Healthcheck* lleuger (`{ status: 'ok', engine: 'sqlite-wal', version: '1.0.0' }`) per a Docker, Dokploy i Traefik. |
| `POST` | `/api/auth/login` | Públic | Valida credencials (`ADMIN_USERNAME`/`ADMIN_PASSWORD` d'entorn o desades a SQLite) i emet token HMAC-SHA256. |
| `POST` | `/api/auth/demo-login` | Públic (Dev) | Accés ràpid de prova sense exposar contrasenyes al client. |
| `GET` | `/api/data` | Opcional | Estat sanejat per rol (`lamps` per a `ADMIN`, `lampStats` públic) amb `ETag` (`304`). |
| `POST` | `/api/preferences/lot-lamps` | `PARTY` (`OPEN`) | Desa l'ordre de prioritat (`orderedLampCodes`) de les faroles seleccionades dins d'un lot (també aliada a `/api/preferences/lot`). |
| `POST` | `/api/preferences/lot-order` | `PARTY` (`OPEN`) | Desa l'ordre d'importància dels lots (`lotIds`) del partit per al repartiment de places de resta. |
| `POST` | `/api/preferences/location` | `PARTY` (`OPEN`) | Desa l'ordre d'`emplaçaments` preferits del partit (`1..M`). |
| `POST` | `/api/preferences/reset` | `PARTY` (`OPEN`) | Esborra tota la selecció pròpia de fanals i emplaçaments del partit autenticat. |
| `POST` | `/api/preferences/restore-past` | `PARTY` (`OPEN`) | Importa preferències històriques creuant per lot i per codi físic de farola (`AP.XX`) encara que els lots s'hagin renumerat. |
| `POST` | `/api/admin/lamp/aptitude` | `ADMIN` | Declara faroles com a `APTA` o `NO_APTA` (`lampId` / `lampIds`, `apta`) o restaura l'aptitud per defecte (`resetDefault: true`). |
| `POST` | `/api/admin/lamp/suitable` | `ADMIN` | Alterna la selecció electoral (`APTA` ↔ `SELECCIONADA`) d'1 farola (`lampId`) o d'un conjunt (`lampIds`) apte. |
| `POST` | `/api/admin/bulk-suitability` | `ADMIN` | Actualització massiva de selecció (`APTA` ↔ `SELECCIONADA`) sobre les faroles aptes. |
| `POST` | `/api/admin/lots` | `ADMIN` | Crea o edita manualment un lot (`lampCodes`, `markLampsSelected`, `name`, `reserved`). |
| `DELETE` | `/api/admin/lots/:id` | `ADMIN` | Elimina un lot (les faroles tornen a quedar lliures a `db.lamps`) i recalcula quotes. |
| `DELETE` | `/api/admin/lots` | `ADMIN` | Esborra tots els lots i reinicia les referències. |
| `POST` | `/api/admin/lot` | `ADMIN` | Commuta la reserva municipal (`reserved` / `reservedReason`) d'un lot existent. |
| `POST` | `/api/admin/locations` | `ADMIN` | Crea o edita un emplaçament fix (`EMP-XX`) i recalcula quotes d'emplaçaments. |
| `DELETE` | `/api/admin/locations/:id` | `ADMIN` | Elimina un emplaçament fix i neteja preferències/assignacions. |
| `DELETE` | `/api/admin/locations` | `ADMIN` | Esborra tots els emplaçaments fixos. |
| `POST` | `/api/admin/parties` | `ADMIN` | Crea o edita una candidatura política (`name`, `acronym`, `color`, `seats`, `votes`, `quotaPct`, `orderRank`, `username`, `password`) i recalcula quotes. |
| `DELETE` | `/api/admin/parties/:id` | `ADMIN` | Elimina una candidatura, reindexa `orderRank` (`1..N`), neteja preferències i recalcula quotes. |
| `POST` | `/api/admin/parties/recalc-quotas` | `ADMIN` | Desa edicions en línia (`updates`) o recalcula automàticament les quotes (`VOTES`, `SEATS`, `EQUAL`, `SORT_BY_RESULTS`). |
| `POST` | `/api/admin/election-info` | `ADMIN` | Actualitza el títol i la data de la convocatòria electoral (`electionInfo.title`, `electionInfo.date`). |
| `POST` | `/api/admin/history/archive` | `ADMIN` | Arxiva un *snapshot* complet i compacte de la convocatòria actual (`selectedLampCodes`, `lots`, `locations`, `partiesSnapshot`, preferències i sorteig). |
| `POST` | `/api/admin/history/:id/restore` | `ADMIN` | Recupera una convocatòria en mode `TEMPLATE` (prepara espais per a noves eleccions en estat `OPEN`) o `FULL` (còpia completa amb resultats). |
| `DELETE` | `/api/admin/history/:id` | `ADMIN` | Elimina un registre històric desat. |
| `POST` | `/api/admin/status` | `ADMIN` | Obre (`"OPEN"`) o tanca (`"CLOSED"`) el període de selecció. |
| `POST` | `/api/admin/allocate` | `ADMIN` | Executa `runAllocation` (repartiment proporcional per lot D'Hondt + emplaçaments D'Hondt amb màxim 1 plaça/partit per ubicació) i passa l'estat a `"ALLOCATED"`. |
| `POST` | `/api/admin/reset` | `ADMIN` | Reinicia l'adjudicació i reobre el període (`"OPEN"`), amb opció `clearPreferences` per netejar també les seleccions. |
| `POST` | `/api/admin/preferences/reset` | `ADMIN` | Reinicia les seleccions de fanals i emplaçaments d'un partit concret (`partyId`) o de tots els partits alhora (i reobre si estava adjudicat). |
| `GET` | `/api/reports/pdf` | `ADMIN` | Descarrega l'acta oficial `Assignacio_Fanals_SantJoan.pdf` amb detall d'emplaçaments i farola per farola per lot. |
| `GET` | `/api/reports/geojson` | `ADMIN` | Exporta tant les faroles dels lots (`featureType: 'LAMP' / 'LOT'`) com els emplaçaments fixos (`featureType: 'LOCATION'`) en format GIS `GeoJSON`. |
| `GET` | `/api/reports/csv` | `ADMIN` | Exporta el detall conjunt de fanals per lot i d'emplaçaments fixos en format `CSV` (UTF-8 BOM per a Excel). |
