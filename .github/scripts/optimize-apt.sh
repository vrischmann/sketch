#!/bin/bash
set -e

# Skip installing package docs (makes the man-db trigger much faster)
# (I disabled `/doc` and `/info` too, just in case.)
sudo tee /etc/dpkg/dpkg.cfg.d/01_nodoc > /dev/null << 'EOF'
path-exclude /usr/share/doc/*
path-exclude /usr/share/man/*
path-exclude /usr/share/info/*
EOF

echo "APT optimization configured - documentation installation disabled"
