# ==============================================================================
# Stage 1: Build Frontend (React 19 + Vite 8 on Alpine musl)
# ==============================================================================
FROM node:24-alpine AS client-build

WORKDIR /app/client

# Use `npm install` without Windows lockfile so npm resolves Alpine `linux-musl` native Vite/Rolldown bindings cleanly
COPY client/package.json ./
RUN npm install --no-audit --no-fund

COPY client/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Production Server (Express + Native SQLite WAL + Static Frontend)
# ==============================================================================
FROM node:24-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/app/data

# Install backend production dependencies only
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# Copy backend source (including initial seed `server/seed.json`), GIS dataset & built frontend
COPY server/ ./server/
COPY punts_de_llum.geojson ./punts_de_llum.geojson
COPY --from=client-build /app/client/dist ./client/dist

# Prepare persistent SQLite volume directory
RUN mkdir -p /app/data

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "--no-warnings=ExperimentalWarning", "server/index.js"]
