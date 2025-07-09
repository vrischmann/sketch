#!/bin/bash
set -e

rm -rf embedded/webui-dist
unset GOOS GOARCH && go run ./cmd/genwebui -- embedded/webui-dist
