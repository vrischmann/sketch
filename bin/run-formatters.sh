#!/bin/bash
set -e

# Script to run formatters for both Go and webui files
# Usage: bin/run-formatters.sh [check]
# If 'check' is provided, only checks formatting without making changes

CHECK_MODE=false
if [ "$1" = "check" ]; then
  CHECK_MODE=true
  echo "Running in check mode (formatting will not be modified)"
else
  echo "Running in fix mode (formatting will be modified)"
fi

# Run both formatters in parallel
echo "Running Go and webui formatters in parallel..."

# Run Go formatting in background
(
  echo "Checking Go formatting..."
  if [ "$CHECK_MODE" = true ]; then
    # In check mode, we want to display the files that need formatting and exit with error if any
    FILES_TO_FORMAT=$(gofumpt -l .)
    if [ -n "$FILES_TO_FORMAT" ]; then
      echo "The following Go files need formatting:"
      echo "$FILES_TO_FORMAT"
      exit 1
    else
      echo "Go formatting check passed"
    fi
  else
    # In fix mode, we apply the formatting
    echo "Fixing Go formatting with gofumpt"
    gofumpt -w .
    echo "Go formatting complete"
  fi
) &
GO_PID=$!

# Run webui formatting in background
(
  echo "Checking webui formatting..."
  if [ -d "./webui" ]; then
    cd webui
    if [ "$CHECK_MODE" = true ]; then
      echo "Checking webui formatting with Prettier"
      if ! npx prettier@3.5.3 --check .; then
        echo "Webui files need formatting"
        exit 1
      fi
    else
      echo "Fixing webui formatting with Prettier"
      npx prettier@3.5.3 --write .
      echo "Webui formatting complete"
    fi
  else
    echo "No webui directory found, skipping Prettier check"
  fi
) &
WEBUI_PID=$!

# Wait for both processes and capture exit codes
wait $GO_PID
GO_EXIT=$?
wait $WEBUI_PID
WEBUI_EXIT=$?

# Exit with error if either formatter failed
if [ $GO_EXIT -ne 0 ] || [ $WEBUI_EXIT -ne 0 ]; then
  exit 1
fi

if [ "$CHECK_MODE" = true ]; then
  echo "All formatting checks passed"
else
  echo "All formatting has been fixed"
fi
