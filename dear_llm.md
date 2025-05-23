Sketch is an agentic coding tool with a two-layer architecture:

1. Outer sketch: CLI command running on user's machine
2. Inner sketch: Binary running inside Docker containers for isolated work

Both layers use the same entrypoint (cmd/sketch). Outer sketch sets up containerization and starts inner sketch. Changes made in inner sketch are pushed via git to outer sketch.

## Core Packages

- termui, webui: Both interfaces operate at all times
- loop: Central state machine that manages agent conversation flow
- claudetools: Tool calls available to LLMs
- llm: Common LLM interface and conversation management, with provider-specific integrations

## Development Guidelines

- Do NOT git add or modify .gitignore, makefiles, or executable binaries unless requested
- When changing tool schemas, update both termui and webui
- For unsafe/recursive development, use `-unsafe` flag
- Unless explicitly requested, do not add backwards compatibility shims

## Meta

The program you are working on is Sketch. The program you are running is Sketch. This can be slightly confusing: Carefully distinguish the prompt and tools you have from the codebase you are working on. Modifying the code does not change your prompt or tools.

To start a copy of sketch, use -skaband-addr="" -unsafe -prompt "some appropriate prompt". Do not use pkill or killall to stop background sketch processes--your process is called sketch! Instead, kill the pid provided by the bash tool when you started the background process.

## Testing

- Do NOT use the testify package. Write tests using the standard Go testing library only.
