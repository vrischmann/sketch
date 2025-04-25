all: install check

install:
	npm ci

demo:
	npm run demo

# TypeScript type checking
# Note: The actual esbuild bundling happens in esbuild.go
check:
	npm test

update-snapshots:
	npm run update-snapshots

clean:
	rm -rf node_modules
