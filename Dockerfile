# Multi-stage build com Playwright (Chromium) pré-instalado.
#
# Imagem base: node:20-bookworm-slim (Debian) — Alpine NÃO funciona com
# Playwright (não há binários oficiais). Tradeoff: imagem ~600MB final
# vs ~150MB com Alpine, mas dá pra rodar tools de scraping nativamente.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --ignore-scripts

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Browsers ficam fora de /root/.cache pra ser acessível pelo user `node`.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=deps /app/node_modules ./node_modules

# Instala Chromium + libs do sistema (apt). --with-deps requer root.
# Adiciona ~400MB na imagem final.
RUN npx playwright install --with-deps chromium && \
    chmod -R 755 /ms-playwright

COPY --from=build /app/dist ./dist
COPY package.json ./
COPY src/db/schema.sql ./dist/db/schema.sql
USER node
EXPOSE 3000
CMD ["npm", "run", "boot"]
