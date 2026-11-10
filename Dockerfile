# --- build the SPA ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- serve with nginx (static files + /api proxy; auth is Django's token auth) ---
FROM nginx:1.27-alpine
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Django runs on the host (`uv run python manage.py runserver`).
ENV API_UPSTREAM=http://host.docker.internal:8000 \
    API_HOST_HEADER=localhost \
    NGINX_ENVSUBST_FILTER=^API_

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
