package browse

import (
	"context"
	"log"

	"sketch.dev/llm"
)

// RegisterBrowserTools initializes the browser tools and returns all the tools
// ready to be added to an agent. It also returns a cleanup function that should
// be called when done to properly close the browser.
func RegisterBrowserTools(ctx context.Context, supportsScreenshots bool) ([]*llm.Tool, func()) {
	browserTools := NewBrowseTools(ctx)

	// Initialize the browser
	if err := browserTools.Initialize(); err != nil {
		log.Printf("Warning: Failed to initialize browser: %v", err)
	}

	return browserTools.GetTools(supportsScreenshots), func() {
		browserTools.Close()
	}
}

// Tool is an alias for llm.Tool to make the documentation clearer
type Tool = llm.Tool
