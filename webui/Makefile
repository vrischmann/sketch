all: install check

install:
	npm ci

demo:
	npm run demo

# TypeScript type checking
# Note: The actual esbuild bundling happens in esbuild.go
check:
	npx tsc --noEmit

clean:
	rm -rf node_modules
