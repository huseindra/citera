.PHONY: dev db api web test seed

db:
	docker compose up -d

api: db
	uv run uvicorn app.main:app --app-dir apps/api --reload --port 8000

web:
	pnpm --dir apps/web dev

dev: db
	@echo "Run 'make api' and 'make web' in separate terminals."

test:
	uv run pytest

seed: db
	uv run python scripts/seed_demo.py
