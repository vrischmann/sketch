package loop

import (
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// PortMonitor handles periodic monitoring of listening ports in containers
type PortMonitor struct {
	mu        sync.Mutex // protects following
	lastPorts string     // last netstat/ss output for comparison
}

// NewPortMonitor creates a new PortMonitor instance
func NewPortMonitor() *PortMonitor {
	return &PortMonitor{}
}

// Start begins periodic port monitoring in a background goroutine
func (pm *PortMonitor) Start(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(5 * time.Second) // Check every 5 seconds
		defer ticker.Stop()

		// Get initial port state
		pm.updatePortState(ctx)

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				pm.updatePortState(ctx)
			}
		}
	}()
}

// updatePortState runs ss and checks for changes in listening ports
func (pm *PortMonitor) updatePortState(ctx context.Context) {
	cmd := exec.CommandContext(ctx, "ss", "-lntu")
	output, err := cmd.Output()
	if err != nil {
		// Log the error but don't fail - port monitoring is not critical
		slog.DebugContext(ctx, "Failed to run ss command", "error", err)
		return
	}

	currentPorts := string(output)

	pm.mu.Lock()
	defer pm.mu.Unlock()

	// Check if ports have changed
	if pm.lastPorts != "" && pm.lastPorts != currentPorts {
		// Ports have changed, log the difference
		slog.InfoContext(ctx, "Container port changes detected",
			slog.String("previous_ports", pm.lastPorts),
			slog.String("current_ports", currentPorts))

		// Parse and compare the port lists for more detailed logging
		pm.logPortDifferences(ctx, pm.lastPorts, currentPorts)
	}

	pm.lastPorts = currentPorts
}

// logPortDifferences parses ss output and logs specific port changes
func (pm *PortMonitor) logPortDifferences(ctx context.Context, oldPorts, newPorts string) {
	oldPortSet := parseSSPorts(oldPorts)
	newPortSet := parseSSPorts(newPorts)

	// Find newly opened ports
	for port := range newPortSet {
		if !oldPortSet[port] {
			slog.InfoContext(ctx, "New port detected", slog.String("port", port))
		}
	}

	// Find closed ports
	for port := range oldPortSet {
		if !newPortSet[port] {
			slog.InfoContext(ctx, "Port closed", slog.String("port", port))
		}
	}
}

// parseSSPorts extracts listening ports from ss -lntu output
// Returns a map with "proto:address:port" as keys
// ss output format: Netid State Recv-Q Send-Q Local Address:Port Peer Address:Port
func parseSSPorts(output string) map[string]bool {
	ports := make(map[string]bool)
	lines := strings.Split(output, "\n")

	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}

		// Skip header line and non-LISTEN states
		if fields[0] == "Netid" || fields[1] != "LISTEN" {
			continue
		}

		proto := fields[0]
		localAddr := fields[4] // Local Address:Port
		portKey := fmt.Sprintf("%s:%s", proto, localAddr)
		ports[portKey] = true
	}

	return ports
}
