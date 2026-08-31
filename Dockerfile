FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

# Only the manifest first, so `npm ci` is cached until deps actually change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# The rebuild branch commits self-contained browser + WASM artifacts, so
# SoloHost users need no Emscripten / compiler / source at install time. Only
# the runtime code and the built frontend go into the image.
COPY server ./server
COPY public ./public

# Drop privileges and own only what the app writes to.
RUN mkdir -p /data && chown -R node:node /app /data
USER node

EXPOSE 3000
VOLUME ["/data"]

# Liveness: the safe version surface, no secrets. Used by SoloHost / compose.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>{if(!r.ok)process.exit(1);return r.json()}).then(j=>process.exit(j.ok?0:1)).catch(()=>process.exit(1))"

# Exec form + direct node so SIGTERM reaches the process and server.js can
# close the listener and flush the store before exit.
CMD ["node", "server/server.js"]
