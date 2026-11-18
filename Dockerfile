# Content Connect X — reproducible two-stage static frontend image.
# Supabase is the sole backend; no secret or service-role key belongs in this image.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SENTRY_DSN
ARG VITE_FLAGSMITH_ENVIRONMENT_ID
ARG VITE_HOSTING_MAP_TILE_URL
ARG VITE_HOSTING_PUSH_PUBLIC_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_FLAGSMITH_ENVIRONMENT_ID=$VITE_FLAGSMITH_ENVIRONMENT_ID
ENV VITE_HOSTING_MAP_TILE_URL=$VITE_HOSTING_MAP_TILE_URL
ENV VITE_HOSTING_PUSH_PUBLIC_KEY=$VITE_HOSTING_PUSH_PUBLIC_KEY
# Bolt/GitHub builds may intentionally omit public Vite env vars. The application
# then uses its checked-in, nonsecret Content Connect X publishable settings.
# Server/service-role credentials must NEVER be supplied as Docker build args.
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
ENV PORT=8080
COPY --from=build --chown=101:101 /app/dist/ /usr/share/nginx/html/
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
 CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-8080}/healthz" || exit 1
