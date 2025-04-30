// Package browser provides functions for opening URLs in a web browser.
package browser

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"runtime"
)

// Open opens the specified URL in the system's default browser.
// It detects the OS and uses the appropriate command:
// - 'open' for macOS
// - 'cmd /c start' for Windows
// - 'xdg-open' for Linux and other Unix-like systems
func Open(ctx context.Context, url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.CommandContext(ctx, "open", url)
	case "windows":
		cmd = exec.CommandContext(ctx, "cmd", "/c", "start", url)
	default: // Linux and other Unix-like systems
		cmd = exec.CommandContext(ctx, "xdg-open", url)
	}
	if b, err := cmd.CombinedOutput(); err != nil {
		fmt.Fprintf(os.Stderr, "failed to open browser: %v: %s\n", err, b)
	}
}
