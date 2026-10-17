.PHONY: help setup dev api web build run test clean

BIN := bin/garmin-app

help: ## Daftar perintah
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-7s %s\n", $$1, $$2}'

# Fills KEY in .env with a random 32-byte hex value, only when it is missing or empty.
# Existing values are never replaced: a new TOKEN_ENC_KEY would make stored Garmin tokens unreadable.
define ensure_secret
@grep -q '^$(1)=.' .env || { grep -v '^$(1)=' .env > .env.tmp; echo "$(1)=$$(openssl rand -hex 32)" >> .env.tmp; mv .env.tmp .env; echo "  $(1) dibuat"; }
endef

setup: ## Install dependency Go + npm, siapkan .env dan secret
	go mod download
	cd web && npm install --no-audit --no-fund
	@test -f .env || { grep -v '^API_KEY=' .env.example > .env; echo "  .env dibuat dari .env.example"; }
	$(call ensure_secret,API_KEY)
	$(call ensure_secret,TOKEN_ENC_KEY)
	$(call ensure_secret,JWT_SECRET)
	@chmod 600 .env
	@grep -q '^API_KEY=change-me$$' .env && echo "  Peringatan: API_KEY masih 'change-me', ganti sebelum dipakai di luar lokal." || true
	@echo "Setup selesai. Jalankan: make dev"

dev: ## Jalankan backend (:8080) + frontend dev server (:5173) bersamaan
	@$(MAKE) -j2 --no-print-directory api web

api: ## Jalankan backend saja
	go run .

web: ## Jalankan frontend dev server saja (proxy /api & /auth ke :8080)
	cd web && npm run dev

build: ## Build frontend (web/dist) dan binary backend (bin/)
	cd web && npm run build
	go build -o $(BIN) .

run: build ## Build lalu jalankan versi produksi di :8080 (frontend disajikan Fiber)
	./$(BIN)

test: ## Test Go + type-check frontend
	go vet ./...
	go test ./...
	cd web && npx tsc --noEmit

clean: ## Hapus hasil build
	rm -rf bin web/dist
