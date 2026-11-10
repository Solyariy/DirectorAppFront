# Director Admin

Single-user admin UI for the DirectorApp API (`../../PycharmProjects/DirectorApp`, contract
`postman/specs/director-api.yaml`, v0.3.0). React + TypeScript + Vite, served by nginx in Docker.

Pages: **Dashboard** (latest reading, job counts, "can this app run?"), **Apps**, **Policies**
(rule links, apps using a policy), **Rules** (JSON editor with the `/rules/catalog/` fields and
operators, readable preview), **Jobs** (inline status change), **Energy** (history with date range,
live read).

## Run in Docker

1. `cp .env.example .env` (optionally change the port and upstream).
2. `make up`, then open http://localhost:8080 and sign in with a Django user
   (`uv run python manage.py createsuperuser` in the backend).

The Makefile only manages the frontend; the backend is started separately. `make help` lists everything:

| Command | Does |
|---|---|
| `make up` / `down` / `restart` | start (build if needed) / stop / recreate after `.env` changes |
| `make rebuild` / `build` | rebuild without cache and restart / build the image only |
| `make logs` / `ps` / `status` / `health` | follow logs / container state / state + health / UI health check |
| `make open` / `shell` / `config` | open in the browser / shell in the container / rendered compose and nginx config |
| `make dev` / `typecheck` / `dist` / `preview` | Vite dev server / type check / production build / serve the build |
| `make clean` / `prune` | remove `dist` and `node_modules` / stop and remove the image |

Without make: `docker compose up -d --build`.

How it fits together:

```
browser ──Token──▶ nginx :8080 (container)
                         ├─ /        → built SPA
                         ├─ /api/*   → http://host.docker.internal:8000 (Django on the host)
                         └─ /healthz → 200 (Docker health check)
```

- **Auth**: Django token auth (`postman/specs/director-api.yaml`). The login form posts to
  `POST /api/auth/token/`; the token is kept in `localStorage` and sent as
  `Authorization: Token <key>` on every request. Any 401 (token deleted in the Django admin, etc.)
  drops it and shows the login form again; **Log out** in the sidebar does the same. The token
  doesn't expire on the server, so logging out only forgets it in this browser.
- **No CORS needed**: the browser only talks to nginx, so `CORS_ALLOWED_ORIGINS` doesn't have
  to change.
- **Only on this machine**: the port is bound to `127.0.0.1`. Plain HTTP is fine on localhost;
  put TLS in front before exposing it on a network (the password and token travel in clear).
- **Django host check**: nginx sends `Host: localhost`, which Django accepts with `DEBUG=True`
  and empty `ALLOWED_HOSTS`. Change it with `API_HOST_HEADER` if the backend config changes.
- **Linux without Docker Desktop**: uncomment `extra_hosts` in `compose.yaml` and run Django on
  `0.0.0.0:8000`.

## Develop locally (hot reload)

```sh
npm install
npm run dev                 # http://localhost:5173, /api proxied to 127.0.0.1:8000
```

Set `DEV_API_UPSTREAM` in `.env.local` to proxy elsewhere. Log in with a Django user, as in Docker.

## Notes

- "Evaluate" / "Can it run?" and "Read inverter now" read the inverter live and **store a
  snapshot** on every call, so they only run when you click them.
- Deleting a rule that policies use asks to unlink it first. Deleting a policy that apps use
  shows those apps (409 from the API).
- `max_concurrent_jobs` is stored but not enforced by the backend yet. Jobs aren't executed by
  anything yet either.
