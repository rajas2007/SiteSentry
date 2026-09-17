.PHONY: dev test lint

dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

test:
	pytest services/api/tests

lint:
	cd services/api && ruff check . && black --check . && mypy src
