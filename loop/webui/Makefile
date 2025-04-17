all: install check build-tailwind

install:
	npm ci

# TypeScript type checking
# Note: The actual esbuild bundling happens in esbuild.go
check:
	npx tsc --noEmit

build-tailwind:
	npx postcss ./src/input.css -o ./src/tailwind.css

watch-tailwind:
	npx postcss -i ./src/input.css -o ./src/tailwind.css --watch

clean:
	rm -rf node_modules
	-rm -f ./src/tailwind.css
