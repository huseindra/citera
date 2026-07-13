.PHONY: dev db api web test seed clean-data

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

# delete reviews older than MAX_AGE (default 24 hours) plus documents no
# review references anymore; the append-only audit log is untouched
clean-data: db
	docker compose exec postgres psql -U citera -d citera -c "\
	DELETE FROM reviews WHERE created_at < now() - interval '$${MAX_AGE:-24 hours}'; \
	DELETE FROM documents WHERE id NOT IN (SELECT document_id FROM reviews) \
	AND id NOT IN (SELECT protocol_document_id FROM reviews WHERE protocol_document_id IS NOT NULL);"
