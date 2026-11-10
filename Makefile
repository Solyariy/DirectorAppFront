# Director Admin: manage the frontend (admin UI container and local dev).
# The backend and .env are managed by hand. Run `make` or `make help` for the commands.

SHELL        := /bin/sh
COMPOSE      := docker compose
SERVICE      := admin
IMAGE        := director-admin

# Read ADMIN_PORT from .env (default 8080) for the printed URL and health check.
ADMIN_PORT   := $(or $(shell sed -n "s/^ADMIN_PORT=['\"]*\([0-9]*\).*/\1/p" .env 2>/dev/null),8080)
URL          := http://localhost:$(ADMIN_PORT)

.DEFAULT_GOAL := help
.PHONY: help up down restart rebuild build logs ps status health open shell config \
        install dev typecheck dist preview clean prune

help: ## Show this help
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make <target>\n"} \
		/^##@/ {printf "\n\033[1m%s\033[0m\n", substr($$0, 5)} \
		/^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

##@ Server (Docker)

up: .env ## Build if needed and start the admin UI in the background
	$(COMPOSE) up -d --build
	@echo "Admin UI: $(URL)"

down: ## Stop and remove the container
	$(COMPOSE) down

restart: .env ## Recreate the container (picks up .env changes)
	$(COMPOSE) up -d --force-recreate $(SERVICE)

rebuild: .env ## Rebuild the image without cache and restart
	$(COMPOSE) build --no-cache
	$(COMPOSE) up -d --force-recreate $(SERVICE)

build: .env ## Build the Docker image only
	$(COMPOSE) build

logs: ## Follow container logs (Ctrl-C to stop)
	$(COMPOSE) logs -f --tail=100 $(SERVICE)

ps: ## Show container state
	$(COMPOSE) ps

status: ## Container state and UI health check
	@$(COMPOSE) ps 2>/dev/null || echo "Container: not configured (no .env)"
	@$(MAKE) --no-print-directory health || true

health: ## Check the container health endpoint
	@code=$$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 $(URL)/healthz); \
	if [ "$$code" = 200 ]; then echo "UI: up ($(URL))"; else echo "UI: down (HTTP $$code)"; exit 1; fi

open: ## Open the admin UI in the browser
	@open $(URL) 2>/dev/null || xdg-open $(URL) 2>/dev/null || echo $(URL)

shell: ## Open a shell inside the running container
	$(COMPOSE) exec $(SERVICE) sh

config: ## Show the resolved compose config and the rendered nginx config
	$(COMPOSE) config
	@$(COMPOSE) exec $(SERVICE) cat /etc/nginx/conf.d/default.conf 2>/dev/null || echo "(container not running)"

##@ Local development

install: ## Install npm dependencies
	npm install

dev: node_modules ## Run the Vite dev server with hot reload (http://localhost:5173)
	npm run dev

typecheck: node_modules ## Type-check the TypeScript sources
	npm run typecheck

dist: node_modules ## Production build into dist/
	npm run build

preview: dist ## Serve the production build locally (no API proxy)
	npm run preview

node_modules: package.json
	npm install
	@touch node_modules

##@ Cleanup

clean: ## Remove dist/ and node_modules/
	rm -rf dist node_modules

prune: down ## Stop the container and remove its image
	-docker image rm $(IMAGE)

.env:
	@echo "No .env file: copy .env.example to .env and fill it in."; exit 1
