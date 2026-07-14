# Makefile for slinktool-website

.PHONY: install start dev stop clean

# Default port
PORT ?= 3000

# Default SeedLink server
SEEDLINK_HOST ?= rtserve.iris.washington.edu
SEEDLINK_PORT ?= 18000

install:
	@echo "Installing dependencies..."
	npm install

start:
	@echo "Starting slinktool-website server..."
	@echo "Server running at http://localhost:$(PORT)"
	@echo "SeedLink server: $(SEEDLINK_HOST):$(SEEDLINK_PORT)"
	SEEDLINK_HOST=$(SEEDLINK_HOST) SEEDLINK_PORT=$(SEEDLINK_PORT) PORT=$(PORT) node server/index.js

dev:
	@echo "Starting slinktool-website in development mode..."
	@echo "Server running at http://localhost:$(PORT)"
	SEEDLINK_HOST=$(SEEDLINK_HOST) SEEDLINK_PORT=$(SEEDLINK_PORT) PORT=$(PORT) npm run dev

stop:
	@echo "Stopping server..."
	pkill -f "node server/index.js" || true

clean:
	@echo "Cleaning up..."
	rm -rf node_modules/
	rm -f package-lock.json

# Run with custom configuration
run:
	@echo "Running with custom configuration..."
	SEEDLINK_HOST=$(SEEDLINK_HOST) SEEDLINK_PORT=$(SEEDLINK_PORT) PORT=$(PORT) node server/index.js

# Help
help:
	@echo "slinktool-website Makefile"
	@echo ""
	@echo "Commands:"
	@echo "  make install    - Install dependencies"
	@echo "  make start      - Start the server (default port: $(PORT))"
	@echo "  make dev        - Start in development mode with nodemon"
	@echo "  make stop       - Stop the server"
	@echo "  make clean      - Remove node_modules and package-lock.json"
	@echo ""
	@echo "Environment variables:"
	@echo "  PORT            - Web server port (default: 3000)"
	@echo "  SEEDLINK_HOST   - SeedLink server host (default: rtserve.iris.washington.edu)"
	@echo "  SEEDLINK_PORT   - SeedLink server port (default: 18000)"
	@echo ""
	@echo "Examples:"
	@echo "  make start PORT=8080"
	@echo "  make start SEEDLINK_HOST=geofon.gfz-potsdam.de SEEDLINK_PORT=18000"
