# DEAR_LLM.md for Sketch Repository

## Repository Architecture

Sketch is an agentic coding tool with a multi-layer architecture:

1. **Outer Sketch**: The CLI command (`sketch`) running on the user's machine
2. **Inner Sketch**: The binary running inside Docker containers
3. **Container System**: Docker containers isolate work environments

## Key Components

### Outer Sketch (Host)

- **cmd/sketch/main.go**: Entry point and CLI definitions
- **dockerimg/**: Container management (building, configuration, orchestration)

### Inner Sketch (Container)

- **loop/agent.go**: Core agent logic and tool implementations
- **loop/server/**: Server implementation inside containers

### Shared Components

- **webui/**: Web-based user interface components
- **llm/**: Language model interaction

## Development Workflows

### Development Modes

1. **Container Mode** (Default): `go run ./cmd/sketch -C /path/to/codebase`

   - Creates Docker container for code analysis
   - Safe and isolated environment

2. **Unsafe Mode**: `go run ./cmd/sketch -unsafe -C /path/to/codebase`
   - Runs directly on host OS without containerization
   - Useful for quick testing during development

### Source/Container Relationship

- Target codebase: Copied into container via `COPY . /app`
- Sketch itself: Binary built specifically for containers (`GOOS=linux`)
- Container configuration: Generated based on target codebase detection

## Common Gotchas

1. **Container Caching**: Docker image caching may require `-force-rebuild-container` when the target codebase changes

2. **Two Git Contexts**:

   - Sketch's own repository (where outer and inner Sketch code lives)
   - The target repository being analyzed by Sketch
   - Keep these separate in your mental model

3. **Inner/Outer Code Changes**:
   - Changes to inner Sketch (loop/agent.go) are built into the Linux binary for containers
   - Changes to outer Sketch (dockerimg/) affect how containers are created

## Flags and Settings

- `-unsafe`: Run without containerization
- `-force-rebuild-container`: Force Docker image rebuilding
- `-verbose`: Show detailed output and logs
- `-C /path/to/repo`: Specify target codebase path

See CONTRIBUTING.md for additional development guidance.
