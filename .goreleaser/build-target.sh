#!/bin/bash
set -e

# This script is called by GoReleaser for each target
# GOOS and GOARCH are set by GoReleaser
# We prepare the embedded assets, then let GoReleaser do the final go build

echo "Preparing embedded assets for GOOS=$GOOS GOARCH=$GOARCH"

# Build webui assets (only once)
if [ ! -d "embedded/webui-dist" ]; then
    echo "Building webui assets..."
    make webui-assets
fi

# Build innie binaries (only once)
if [ ! -f "embedded/sketch-linux/sketch-linux-amd64" ] || [ ! -f "embedded/sketch-linux/sketch-linux-arm64" ]; then
    echo "Building innie binaries..."
    make innie
fi

echo "Assets prepared. GoReleaser will now build the outie binary."
