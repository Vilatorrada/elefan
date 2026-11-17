# 🗳️ Gestió i Repartiment d'Espais de Propaganda Electoral (v1.0)

Aplicació web *full-stack* per a l'**Ajuntament de Sant Joan de Vilatorrada** per gestionar l'inventari geolocalitzat de faroles (`1.540` punts de llum), la configuració de lots i emplaçaments fixos, la selecció guiada de preferències per part de les candidatures polítiques i el sorteig/repartiment automàtic proporcional (**D'Hondt**), amb generació d'acta oficial en **PDF**, **GeoJSON** i **CSV**.

- 📖 Consulteu el manual complet d'usuari a **[MANUAL.md](./MANUAL.md)**.
- 🧠 Consulteu l'arquitectura i el detall tècnic a **[brain.md](./brain.md)**.

---

## 💻 Execució en Local (Desenvolupament)

```bash
# Instal·lar dependències d'arrel, servidor i client
npm install
npm --prefix server install
npm --prefix client install

# Arrencar simultàniament Backend (http://localhost:3001) i Frontend Vite (http://localhost:5173)
npm run dev
```

Comprovació de qualitat i compilació de producció:
```bash
npm run lint
npm run build
```

---

## 🚀 Desplegament a GitHub i Dokploy

El projecte inclou persistència relacional en **SQLite (`WAL` mode)** integrada a Node 24 (`node:sqlite`, zero compilació C++ `node-gyp`) i un **[Dockerfile](./Dockerfile)** *multi-stage* (`Node 24 Alpine`) llest per desplegar com a servei **`Application`** a **Dokploy**.

### 1. Pujar el projecte a un repositori privat de GitHub

Creeu un repositori buit (**Privat**) a GitHub i executeu des de l'arrel del projecte:

```bash
git init -b main
git add .
git commit -m "feat: release v1.0.0 eleccions-sant-joan"
git remote add origin https://github.com/Vilatorrada/elefan.git
git push -u origin main
```

### 2. Configurar l'aplicació a Dokploy

1. **Crear servei**: Dins del vostre projecte de Dokploy, cliqueu **Create Service → Application**.
2. **Provider (GitHub)**: Seleccioneu el repositori privat i la branca `main`.
3. **Build Type**: Seleccioneu **`Dockerfile`** (`Dockerfile Path`: `Dockerfile`, `Docker Context Path`: `.`).
4. **Environment (Variables d'entorn)**: A la pestanya **Environment**, afegiu:
   ```env
   NODE_ENV=production
   PORT=3001
   DATA_DIR=/app/data
   AUTH_SECRET=poseu_aqui_una_clau_aleatoria_llarga_de_32_o_mes_caracters
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=poseu_aqui_una_contrasenya_municipal_segura
   ```
   *(Opcional: si voleu mantenir visibles els botons d'accés ràpid durant proves internes a Dokploy, afegiu `ENABLE_DEMO_LOGIN=true`; per defecte en producció queden desactivats).*
5. **Mounts / Volumes (MOLT IMPORTANT — Persistència de dades)**:
   - Aneu a la pestanya **Advanced → Mounts (Volumes)** i afegiu un **Volume Mount**:
     - **Type**: `Volume`
     - **Volume Name**: `eleccions-santjoan-data`
     - **Mount Path (dins del contenidor)**: `/app/data`
   - *Com funciona*: En el **primer desplegament**, com que `/app/data/eleccions.sqlite` encara no existeix, el servidor inicialitza automàticament la base de dades **SQLite (`WAL`)** important la llavor inicial (`server/data/db.json` del repositori). En **tots els desplegaments futurs**, Dokploy conserva intacta la base de dades transaccional `/app/data/eleccions.sqlite`.
6. **Domains**: A la pestanya **Domains**, afegiu el vostre domini/subdomini (p. ex. `eleccions.santjoanvilatorrada.cat`), activeu **HTTPS (Let's Encrypt)** i indiqueu **`Container Port: 3001`**.
7. Premeu **Deploy**!
