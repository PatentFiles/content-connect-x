# Railway root directory: /server/idv-worker. This is NOT the web frontend.
# policy.mjs is checked byte-for-byte against the Edge policy in identity CI.
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates python3 make g++ libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev librsvg2-dev pkg-config wget bzip2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN git init . && git remote add origin https://github.com/team-idswyft/idswyft-community.git && git fetch --depth=1 origin 3c6f17f1aba84bc980dc759f6be42f69b576f439 && git checkout --detach FETCH_HEAD && test "$(git rev-parse HEAD)" = 3c6f17f1aba84bc980dc759f6be42f69b576f439
RUN npm ci --include=optional --workspace=shared --workspace=engine --include-workspace-root
COPY prepare-build.mjs /app/ccx/prepare-build.mjs
RUN node /app/ccx/prepare-build.mjs
RUN cd shared && ../node_modules/.bin/tsc && ../node_modules/.bin/tsc-alias
RUN cd engine && ../node_modules/.bin/tsc && ../node_modules/.bin/tsc-alias
RUN npm prune --omit=dev --workspace=shared --workspace=engine --include-workspace-root
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libcairo2 libjpeg62-turbo libpango-1.0-0 libpangocairo-1.0-0 libgif7 librsvg2-2 ffmpeg wget && rm -rf /var/lib/apt/lists/*
WORKDIR /app/engine
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/engine/dist /app/engine/dist
COPY --from=build /app/engine/models /app/engine/models
COPY --from=build /app/engine/package.json /app/engine/package.json
COPY --from=build /app/shared/dist /app/shared/dist
COPY --from=build /app/shared/models /app/shared/models
COPY --from=build /app/shared/package.json /app/shared/package.json
COPY --from=build /app/LICENSE /app/ccx/LICENSE-IDSWYFT
COPY --from=build /app/ccx/model-manifest.json /app/ccx/model-manifest.json
COPY --from=build /app/ccx/LICENSE-FACE-MODELS /app/ccx/LICENSE-FACE-MODELS
COPY worker.mjs policy.mjs /app/ccx/
RUN mkdir -p /home/node/.cache/ppu-paddle-ocr && chown -R node:node /app /home/node/.cache
USER node
ENV NODE_ENV=production LOG_LEVEL=error PORT=8080 SUPABASE_URL=https://yxuqbygykpfbioslljlf.supabase.co
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
CMD ["node","/app/ccx/worker.mjs"]
