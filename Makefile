# Makefile for building sketch with embedded assets
#
# Two-layer architecture:
# 1. Linux binary ("innie") - runs in container, embeds webui assets
# 2. Native binary ("outie") - runs on user's machine, embeds innie

BUILD_TIME := $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT := $(shell git rev-parse HEAD 2>/dev/null || echo "unknown")
VERSION := $(shell git describe --tags --dirty --always 2>/dev/null || echo "dev")
LDFLAGS := -X main.version=$(VERSION) -X main.commit=$(COMMIT) -X main.date=$(BUILD_TIME) -X main.makefile=true

.PHONY: all clean help
.PHONY: outie innie
.PHONY: webui-assets

all: outie

outie: innie
	go build -ldflags="$(LDFLAGS)" -tags=outie -o sketch ./cmd/sketch

innie: webui-assets
	CGO_ENABLED=0 GOOS=linux go build -ldflags="$(LDFLAGS)" -tags=innie -o embedded/sketch-linux/sketch-linux ./cmd/sketch

webui-assets:
	rm -rf embedded/webui-dist
	go run ./cmd/genwebui -- embedded/webui-dist

clean:
	@echo "Cleaning build artifacts..."
	rm -f sketch
	rm -rf embedded/sketch-linux embedded/webui-dist
	cd webui && rm -rf node_modules dist
