# 📖 Manual de Funcionament — Gestió i Repartiment d'Espais de Propaganda Electoral (v1.0)

**Ajuntament de Sant Joan de Vilatorrada**  
*Oficina d'Estadística i Eleccions · Versió 1.0*

---

## Índex
1. [Introducció](#1-introducció)
2. [Flux de Treball Municipal i Electoral](#2-flux-de-treball-municipal-i-electoral)
3. [Accés i Identificació](#3-accés-i-identificació)
4. [Interfície Principal i Visor Cartogràfic](#4-interfície-principal-i-visor-cartogràfic)
5. [Guia per a l'Administració Municipal](#5-guia-per-a-ladministració-municipal)
   - [5.1. Aptitud i selecció de faroles (`💡 Faroles` i Mapa)](#51-aptitud-i-selecció-de-faroles--faroles-i-mapa)
   - [5.2. Creació i edició manual de lots de `N` faroles (`📦 Lots` i Mapa unificat)](#52-creació-i-edició-manual-de-lots-de-n-faroles--lots-i-mapa-unificat)
   - [5.3. Gestió d'emplaçaments fixos (`📍 Emplaçaments` i `Emplaçaments al Mapa`)](#53-gestió-demplaçaments-fixos--emplaçaments-i-emplaçaments-al-mapa)
   - [5.4. Gestió de candidatures polítiques i quotes (`👥 Partits i Quotes`)](#54-gestió-de-candidatures-polítiques-i-quotes--partits-i-quotes)
   - [5.5. Dades de la convocatòria, període de selecció i sorteig (`⚖️ Sorteig i Estat`)](#55-dades-de-la-convocatòria-període-de-selecció-i-sorteig-️-sorteig-i-estat)
   - [5.6. Històric i reutilització de convocatòries (`🗂️ Històric`)](#56-històric-i-reutilització-de-convocatòries-️-històric)
6. [Guia per a les Candidatures (Partits Polítics)](#6-guia-per-a-les-candidatures-partits-polítics)
   - [6.1. Ordre d'importància dels Lots i numeració de faroles (`💡 Lots i Fanals`)](#61-ordre-dimportància-dels-lots-i-numeració-de-faroles--lots-i-fanals)
   - [6.2. Numeració per prioritat dels Emplaçaments fixos (`📍 Emplaçaments`)](#62-numeració-per-prioritat-dels-emplaçaments-fixos--emplaçaments)
   - [6.3. Importar Històric i Reiniciar selecció](#63-importar-històric-i-reiniciar-selecció)
   - [6.4. Consulta de candidatures i quotes](#64-consulta-de-candidatures-i-quotes)
7. [Funcionament de l'Algorisme de Repartiment](#7-funcionament-de-lalgorisme-de-repartiment)
8. [Descàrrega d'Informes i Exportació de Dades](#8-descàrrega-dinformes-i-exportació-de-dades)

---

## 1. Introducció

Aquesta aplicació web facilita i automatitza la configuració municipal i l'adjudicació dels espais públics cedits per l'**Ajuntament de Sant Joan de Vilatorrada** per a la propaganda electoral:

- **Inventari de faroles (3 estats) i Lots de fanals**: A partir del parc municipal d'enllumenat públic (`1.540` punts de llum geolocalitzats), el sistema distingeix automàticament **3 estats**:
  1. **`🔒 No Apta` (no seleccionable — 434 punts)**: Suports ancorats a façana o paret (*Braç a façana*, *A paret*, *Braç a pal de fusta*, *Focus a façana*), bloquejats permanentment perquè no s'hi puguin penjar banderoles.
  2. **`⚪ Apta` (disponible — 1.106 punts)**: Totes les faroles de **`Columna` (970)** i **`Bàcul` (136)**, que són estructuralment vàlides i seleccionables.
  3. **`✔ Seleccionada`**: Faroles aptes (*Columna* o *Bàcul*) escollides per la comissió municipal per formar part activa dels lots i del repartiment electoral.
- **Emplaçaments fixos**: Panells, cartelleres i suports de pancartes municipals, cadascun amb una ubicació al mapa i una capacitat màxima de candidatures.

---

## 2. Flux de Treball Municipal i Electoral

1. **Pas 1 — Aptitud i selecció de faroles (Administració)**: Les 434 faroles que no són *Columna* ni *Bàcul* venen bloquejades inicialment com a **No Aptes** (amb opció de declarar-les com a *Aptes* per suport o carrer des de *Gestió Municipal*), i les 1.106 de *Columna* i *Bàcul* apareixen com a **Aptes disponibles**. L'Ajuntament marca com a **Seleccionades** les que vol habilitar per als comicis.
2. **Pas 2 — Creació manual de lots de `N` faroles i emplaçaments (Administració)**: Es creen manualment els lots agrupant conjunts de `N` faroles aptes i seleccionades (per barri, avinguda o sector) i es configuren els emplaçaments fixos. El sistema recalcula a l'instant tant la quota global com la **quota proporcional de faroles de cada candidatura dins de cada lot**.
3. **Pas 3 — Ordre d'importància de lots i numeració de faroles i emplaçaments (Candidatures)**: Amb el període en estat `OBERT`, des de l'Assistent de Selecció Electoral cada partit polític ordena els lots segons la seva importància (`1r, 2n, 3r...`), numera individualment les faroles de cada lot (`#1, #2, #3...`) clicant les xinxetes al mapa o des del panell lateral, i ordena els emplaçaments fixos.
4. **Pas 4 — Tancament, sorteig proporcional per lot i actes oficials (Administració)**: L'Administració tanca el període de selecció, executa el repartiment automàtic (garantint les parts enteres per lot, adjudicant les restes segons la importància de lots de cada partit i assignant les faroles concretes per torns **D'Hondt**) i genera l'acta oficial (`Generar Acta` en **PDF**) i les exportacions **GeoJSON** i **CSV**.

---

## 3. Accés i Identificació

En accedir a l'aplicació es mostra el diàleg d'inici de sessió:
1. Introduïu l'**Usuari** (sigles de la candidatura, p. ex. `ERC`, `JUNTS`, `PSC`, o l'usuari tècnic `admin`) i la **Contrasenya**.
2. Premeu **Iniciar Sessió**.
3. Per finalitzar la sessió en qualsevol moment, premeu el botó **Sortir** a l'extrem superior dret.

---

## 4. Interfície Principal i Visor Cartogràfic

### A. Barra Superior
- **Esquerra**: Escut i títol del procés electoral.
- **Centre**:
  - **Partits Polítics**: Acrònim, comptadors `Fanals Assignats: X / Quota` i `Emplaçaments: Y / Quota`, i indicador d'estat si la selecció està tancada o adjudicada.
  - **Administració**: Distintiu `Administració Municipal`.
- **Dreta (Accions)**:
  - **Quotes i Partits** *(visible per als partits)*: Mostra la taula de candidatures, vots/regidors i quotes proporcionals per garantir la transparència del repartiment.
  - **Gestió Municipal** *(només administració)*: Obre la finestra unificada **Gestió Municipal d'Espais Electorals** (faroles, lots, emplaçaments, partits/quotes, sorteig i històric).
  - **Generar Acta / GeoJSON / CSV** *(només administració)*: Descàrrega de l'acta oficial en PDF i exportació de dades geogràfiques i tabulars.

### B. Visor Cartogràfic
- **Cercador superior esquerre**: Cerca qualsevol carrer, codi de farola (`AP.01`), lot (`LOT-01`) o emplaçament (`EMP-01`) i hi centra el plànol.
- **Selector de capa base**: Commuta entre **Mapa Topogràfic** i **Ortofoto Satèl·lit**.
- **Eines ràpides sobre el mapa *(només Administració)***:
  - **`Faroles i Lots al Mapa (X/Y sel. · Z lots)`**: Activa en un únic espai integrat la visualització de faroles aptes/seleccionades, el canvi d'estat (`Marcar / Desmarcar com a Seleccionades`) i la creació/edició de lots directament sobre el plànol.
  - **`Emplaçaments al Mapa (N)`**: Obre el panell flotant per crear i editar panells, cartelleres i pancartes fent clic directament al punt exacte del mapa (autocompletant el nom del carrer més proper i permetent pujar foto o arrossegar la xinxeta).

---

## 5. Guia per a l'Administració Municipal

Prement **Gestió Municipal** a la capçalera s'obre la finestra **Gestió Municipal d'Espais Electorals**, estructurada en **6 pestanyes** fixes sempre visibles a la part superior:

### 5.1. Aptitud i selecció de faroles (`💡 Faroles` i Mapa)
Per defecte els suports de **`Columna`** (`970`) i **`Bàcul`** (`136`) venen marcats com a **`⚪ APTA`** (`1.106` punts) i la resta (`434` punts: *Braç a façana*, *A paret*, *Braç a pal de fusta* i *Focus a façana*) com a **`🔒 NO APTA`** (bloquejades al mapa). Tanmateix, des del menú de gestió municipal podeu modificar l'aptitud en qualsevol moment:

- **Declarar faroles com a Aptes o No Aptes (`Gestió Municipal → 💡 Faroles`)**:
  - **En bloc (per exemple, totes les faroles d'`A paret`)**: Trieu **`A paret (0/30 aptes)`** al desplegable de tipus de suport (o filtreu per carrer/codi) i premeu **`🔓 Declarar filtrades (30) com a Aptes`**. Automàticament passaran a `⚪ APTA` i ja es podran seleccionar al mapa i afegir a lots igual que les de columna o bàcul.
  - **En sentit invers**: Amb **`🔒 Declarar filtrades com a No Aptes`** (o el botó **`🔒 No apta`** de cada fila) podeu bloquejar una farola o un tram en obres perquè no es pugui seleccionar (si pertanyia a un lot, se'n retira automàticament).
  - **Restaurar valors inicials**: El botó **`Aptitud per defecte (Columna + Bàcul)`** torna a deixar únicament *Columna* i *Bàcul* com a aptes.
- **Marcar o desmarcar faroles com a Seleccionades (`⚪ No seleccionada` ↔ `✔ Seleccionada`)**:
  - **Des de la taula (`💡 Faroles`)**: Cliqueu **`⚪ Marcar com a Seleccionada` / `✔ Seleccionada (desmarcar)`** a cada fila, o utilitzeu **`✔ Marcar filtrades com a Seleccionades`** / **`⚪ Desmarcar filtrades com a Seleccionades`** (o **`⚪ Desmarcar totes les Seleccionades`**).
  - **Sobre el mapa (`Faroles i Lots al Mapa`)**: Feu clic sobre els punts del tram (es posen en blau), arrossegueu un rectangle amb **`Traçar rectangle al mapa`** (el plànol queda fixat perquè no es mogui mentre arrossegueu) o afegiu un carrer, i premeu **`✔ Marcar com a Seleccionades`** o **`⚪ Desmarcar com a Seleccionades`** (si pertanyien a un lot, se'n retiren automàticament).

### 5.2. Creació i edició manual de lots de `N` faroles (`📦 Lots` i Mapa unificat)
> **Regla fonamental:** Un lot **només** el poden conformar faroles amb estat **`✔ Seleccionada`**. Si una farola d'un lot es desmarca com a Seleccionada (o es declara `🔒 No Apta`), es retira automàticament del lot.

- **Opció A — Espai unificat sobre el mapa (`Faroles i Lots al Mapa`)**:
  1. Marqueu en blau un conjunt de punts al mapa (clicant-los, amb **`Traçar rectangle al mapa`** o amb **`+ Carrer`**).
  2. Si ja estan totes `✔ Seleccionades`, premeu **`Crear Lot (N Seleccionades)`**. Si n'hi ha encara no seleccionades, el botó **`Marcar com a Seleccionades i Crear Lot (N)`** les passa primer a `✔ Seleccionada` i crea el lot en un sol pas (o podeu triar crear-lo només amb les que ja estaven `✔ Seleccionades`).
  3. Feu clic sobre la insígnia **`LOT-XX (N) ✏️`** de qualsevol lot existent al mapa per carregar-lo directament al panell i editar-lo o eliminar-lo.
- **Opció B — Alta ràpida per carrer des de la pestanya `📦 Lots`**:
  1. Trieu al desplegable un carrer que tingui faroles **`✔ Seleccionades`** lliures i premeu **`Crear Lot del Carrer`**.
- **Gestió dels lots creats**:
  - Des de la taula inferior (o clicant qualsevol lot al mapa) podeu saltar directament a editar-ne les faroles al mapa (`🎯`), canviar-ne el nom, marcar-lo com a **Reservat** (p. ex. Festa Major) o eliminar-lo.

### 5.3. Gestió d'emplaçaments fixos (`📍 Emplaçaments` i `Emplaçaments al Mapa`)
Permet administrar tot el catàleg de panells, cartelleres i pancartes tant des del mapa com des de la taula:
- **Directament sobre el mapa (`Emplaçaments al Mapa`)**: Feu clic al punt exacte del plànol (s'autocompleta l'adreça del carrer més proper), indiqueu nom, tipus (`CARTELLERA`, `PANCARTA` o `PANELL / MONÒLIT`), capacitat i opcionalment foto, i premeu **`Crear Emplaçament`**. Podeu clicar qualsevol xinxeta `📍` existent per editar-la o eliminar-la sense sortir del mapa, o arrossegar-la per ajustar-ne la posició.
- **Des de la taula (`Gestió Municipal → 📍 Emplaçaments`)**: Consulta completa del catàleg, edició i botó **`Esborrar tots`** per buidar d'un sol cop els emplaçaments si cal començar de zero.

### 5.4. Gestió de candidatures polítiques i quotes (`👥 Partits i Quotes`)
S'hi accedeix de forma unificada des de **`Gestió Municipal → 👥 Partits i Quotes`**:
- **Crear, editar o eliminar candidatures**:
  - **Alta**: Introduïu nom complet, sigles/acrònim, color identificatiu al mapa, regidors, vots, `%` de quota (opcional; si es deixa a `0` es pot recalcular automàticament), ordre de prioritat (`1..N`) i credencials d'accés (`usuari` i `contrasenya`), i premeu **`Crear Candidatura`**.
  - **Edició i esborrat**: Cliqueu la icona **`✏️`** de qualsevol fila per editar-la (deixant la contrasenya en blanc es conserva l'actual) o **`🗑️`** per eliminar una candidatura (les preferències associades es netegen i l'ordre `1..N` es reindexa automàticament).
- **Actualització ràpida i recàlcul de quotes**:
  - **Edició en línia a la taula**: Modifiqueu directament `Regidors`, `Vots` o `% Quota` a la taula i premeu **`Desar canvis a la taula`**, o ajusteu l'ordre electoral amb les fletxes **`↑` / `↓`**.
  - **Recàlcul en 1 clic**: Utilitzeu els botons **`Recalcular % per Vots`**, **`Recalcular % per Regidors`** (amb `%` mínim reservat configurable per a noves candidatures sense representació prèvia), **`Quotes Igualitàries`** o **`Ordenar 1..N per resultats`**. Totes les quotes globals i les quotes proporcionals dins de cada lot s'actualitzen a l'instant.

### 5.5. Dades de la convocatòria, període de selecció i sorteig (`⚖️ Sorteig i Estat`)
1. **Dades de la Convocatòria Electoral**: Permet actualitzar el títol oficial dels comicis (p. ex. *Eleccions Municipals 2027*) i la data que es mostren a la capçalera i a l'acta PDF.
2. **Tancar / Reobrir Període de Selecció**: Bloqueja (`CLOSED`) o habilita (`OPEN`) la modificació de preferències per part dels partits.
3. **Executar Sorteig i Repartiment Automàtic**: Adjudica proporcionalment les faroles de cada lot (respectant les parts enteres garantides, la importància de lots de cada partit per a les restes i la numeració individual de faroles) i reparteix els emplaçaments fixos, obrint la finestra **Resultat i Simulació del Repartiment** pas a pas.
4. **Desar a l'Històric / Reiniciar Adjudicació i Seleccions**: Permet arxivar la convocatòria, **reiniciar només l'adjudicació** (mantenint les seleccions dels partits) o **reiniciar les seleccions i assignacions** (tant de tots els partits alhora com d'un partit concret des de la taula de seguiment inferior).

### 5.6. Històric i reutilització de convocatòries (`🗂️ Històric`)
- **📥 Desar a l'Històric**: Desa una còpia compacta de la configuració actual (faroles seleccionades i aptituds, lots, emplaçaments, partits/quotes, preferències dels partits i resultat del sorteig).
- **♻️ Preparar Noves Eleccions**: Recupera al mapa totes les faroles seleccionades, lots i emplaçaments d'una convocatòria anterior, deixant el període en estat `OBERT` i sense adjudicacions (amb opció de recuperar també o no les quotes de partits d'aquell procés).
- **📂 Restaurar Completa**: Recupera exactament tot l'estat d'una convocatòria arxivada (incloent preferències i acta del sorteig) per consultar-la o tornar-ne a descarregar PDF/GeoJSON/CSV.

---

## 6. Guia per a les Candidatures (Partits Polítics)

En iniciar sessió com a candidatura, a la dreta del mapa s'obre automàticament l'**Assistent de Selecció Electoral** (amb una guia desplegable **`Ajuda`** en 3 passos i opció de minimitzar el panell per veure tot el mapa):

### 6.1. Ordre d'importància dels Lots i numeració de faroles (`💡 Lots i Fanals`)
1. **Pas 1 — Ordre d'importància dels Lots (`1r, 2n, 3r...`)**:
   - A la llista vertical de lots podeu usar les fletxes **`↑` / `↓`** o arrossegar **`⋮⋮`** per situar a dalt de tot els lots/carrers que més us interessen (les etiquetes `1r · LOT-XX` del mapa s'actualitzen al moment).
   - Aquest ordre determina a quins lots s'adjudiquen les vostres places de resta proporcional (especialment útil si la vostra quota global és inferior al nombre total de lots).
2. **Pas 2 — Numerar faroles dins de cada Lot (`#1, #2, #3...`)**:
   - Premeu **`Numerar →`** a qualsevol lot de la llista (o cliqueu el lot directament al mapa).
   - Feu clic sobre les xinxetes **`+`** del mapa (o als botons `+ #N` de la llista) per numerar les faroles en l'ordre que les preferiu (`#1, #2, #3...`). Disposareu també de **`Numerar totes`**, **`Invertir`**, **`Buidar`**, navegació **`◀ / ▶`** entre lots i botó **`← Tornar a l'ordre de Lots`**.

### 6.2. Numeració per prioritat dels Emplaçaments fixos (`📍 Emplaçaments`)
1. Obriu la segona pestanya **`📍 Emplaçaments`** del mateix panell lateral (o feu clic sobre qualsevol xinxeta `📍+` del mapa).
2. Cliqueu les xinxetes **`📍+`** del plànol o els botons de la llista per ordenar els panells, cartelleres i pancartes per prioritat (`#1, #2, #3...`), amb un màxim d'**1 plaça per partit a cada emplaçament**.

### 6.3. Importar Històric i Reiniciar selecció
Al peu del panell de selecció disposeu de:
- **`Importar Històric`**: recupera l'ordre de lots, faroles (creuant per codi físic `AP.XX`) i emplaçaments d'una convocatòria anterior.
- **`Reiniciar tot`**: esborra d'un sol clic la vostra selecció pròpia mentre el període estigui obert.

### 6.4. Consulta de candidatures i quotes
El botó **Quotes i Partits** de la barra superior mostra el repartiment proporcional de quotes globals de fanals i emplaçaments entre totes les candidatures.

---

## 7. Funcionament de l'Algorisme de Repartiment

1. **Quotes globals i forquilla proporcional per lot (`Opció 1`)**:
   - La borsa total de faroles seleccionades en lots actius i la borsa de places d'emplaçaments (limitada com a màxim a 1 plaça per partit per ubicació) es distribueixen proporcionalment pel mètode de les restes majors (*Hare-Niemeyer*).
   - A cada lot actiu de `N` faroles, cada partit té garantida la seva part entera proporcional ($\lfloor \% \times N \rfloor$), i les places de resta es reparteixen per **torns D'Hondt** (amb desempat per ordre electoral `orderRank`) seguint **l'ordre d'importància de lots de cada partit** (màxim `+1` per lot, validat amb flux màxim *Edmonds-Karp* perquè la suma per lots coincideixi exactament amb `allocatedStreetlampsQuota`).
2. **Repartiment proporcional intercalat de faroles dins de cada lot (D'Hondt)**:
   - Un cop fixada la quota exacta de cada partit al lot, els torns s'intercalen escollint a cada pas el partit amb el **quocient D'Hondt més alt** (`lotQuota / (assignadesAlLot + 1)`, desempat per `orderRank`), adjudicant-li la **primera farola lliure** de la seva llista numerada (`#1, #2, #3...`) i completant opcionalment de forma aleatòria les places vacants no numerades.
3. **Emplaçaments fixos (tractats com un Lot per ordre de prioritat D'Hondt)**:
   - S'intercalen els torns pel **quocient D'Hondt** (`quotaEmplaçaments / (assignats + 1)`), adjudicant el primer emplaçament numerat (`#1, #2, #3...`) amb plaça lliure on el partit encara no estigui present (màxim 1 plaça per partit a cada emplaçament).

---

## 8. Descàrrega d'Informes i Exportació de Dades

L'**Administració Municipal** disposa a la capçalera dels tres formats d'exportació oficial:
- **`Generar Acta` (`Assignacio_Fanals_SantJoan.pdf`)**: Acta oficial en PDF amb quadre de quotes, detall d'emplaçaments i llistat individualitzat de cada farola adjudicada dins de cada lot.
- **`GeoJSON` (`fanals_santjoan.geojson`)**: Capa vectorial GIS amb totes les faroles dels lots (`LAMP` / `LOT`) i tots els emplaçaments fixos (`LOCATION`) geolocalitzats.
- **`CSV` (`fanals_santjoan.csv`)**: Taula detallada conjunta de fanals per lot i d'emplaçaments fixos compatible amb Microsoft Excel i LibreOffice Calc (UTF-8 amb BOM).
