package loop

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

// PortEvent represents a port change event
type PortEvent struct {
	Type      string    `json:"type"`      // "opened" or "closed"
	Port      string    `json:"port"`      // "proto:address:port" format
	Timestamp time.Time `json:"timestamp"` // when the event occurred
}

// PortMonitor handles periodic monitoring of listening ports in containers
type PortMonitor struct {
	mu        sync.Mutex  // protects following
	lastPorts string      // last netstat/ss output for comparison
	events    []PortEvent // circular buffer of recent port events
	maxEvents int         // maximum events to keep in buffer
}

// NewPortMonitor creates a new PortMonitor instance
func NewPortMonitor() *PortMonitor {
	return &PortMonitor{
		maxEvents: 100, // keep last 100 events
		events:    make([]PortEvent, 0, 100),
	}
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
// Falls back to /proc/net/tcp* parsing if ss is not available
func (pm *PortMonitor) updatePortState(ctx context.Context) {
	var currentPorts string
	var err error

	// Try ss command first
	cmd := exec.CommandContext(ctx, "ss", "-lntu")
	output, err := cmd.Output()
	if err != nil {
		// ss command failed, try /proc filesystem fallback
		slog.DebugContext(ctx, "ss command failed, trying /proc fallback", "error", err)
		currentPorts, err = pm.getListeningPortsFromProc()
		if err != nil {
			// Both methods failed - log and return
			slog.DebugContext(ctx, "Failed to get listening ports", "ss_error", err)
			return
		}
	} else {
		currentPorts = string(output)
	}

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
	now := time.Now()

	// Find newly opened ports
	for port := range newPortSet {
		if !oldPortSet[port] {
			slog.InfoContext(ctx, "New port detected", slog.String("port", port))
			pm.addEvent(PortEvent{
				Type:      "opened",
				Port:      port,
				Timestamp: now,
			})
		}
	}

	// Find closed ports
	for port := range oldPortSet {
		if !newPortSet[port] {
			slog.InfoContext(ctx, "Port closed", slog.String("port", port))
			pm.addEvent(PortEvent{
				Type:      "closed",
				Port:      port,
				Timestamp: now,
			})
		}
	}
}

// addEvent adds a port event to the circular buffer (must be called with mutex held)
func (pm *PortMonitor) addEvent(event PortEvent) {
	// If buffer is full, remove oldest event
	if len(pm.events) >= pm.maxEvents {
		// Shift all events left by 1 to remove oldest
		copy(pm.events, pm.events[1:])
		pm.events = pm.events[:len(pm.events)-1]
	}
	// Add new event
	pm.events = append(pm.events, event)
}

// GetRecentEvents returns a copy of recent port events since the given timestamp
func (pm *PortMonitor) GetRecentEvents(since time.Time) []PortEvent {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	// Find events since the given timestamp
	var result []PortEvent
	for _, event := range pm.events {
		if event.Timestamp.After(since) {
			result = append(result, event)
		}
	}
	return result
}

// UpdatePortState is a public wrapper for updatePortState for testing purposes
func (pm *PortMonitor) UpdatePortState(ctx context.Context) {
	pm.updatePortState(ctx)
}

// GetAllRecentEvents returns a copy of all recent port events
func (pm *PortMonitor) GetAllRecentEvents() []PortEvent {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	// Return a copy of all events
	result := make([]PortEvent, len(pm.events))
	copy(result, pm.events)
	return result
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

// getListeningPortsFromProc reads /proc/net/tcp and /proc/net/tcp6 to find listening ports
// Returns output in a format similar to ss -lntu
func (pm *PortMonitor) getListeningPortsFromProc() (string, error) {
	var result strings.Builder
	result.WriteString("Netid State  Recv-Q Send-Q Local Address:Port Peer Address:Port\n")

	// Parse IPv4 listening ports
	if err := pm.parseProc("/proc/net/tcp", "tcp", &result); err != nil {
		return "", fmt.Errorf("failed to parse /proc/net/tcp: %w", err)
	}

	// Parse IPv6 listening ports
	if err := pm.parseProc("/proc/net/tcp6", "tcp", &result); err != nil {
		// IPv6 might not be available, log but don't fail
		slog.Debug("Failed to parse /proc/net/tcp6", "error", err)
	}

	// Parse UDP ports
	if err := pm.parseProc("/proc/net/udp", "udp", &result); err != nil {
		slog.Debug("Failed to parse /proc/net/udp", "error", err)
	}

	if err := pm.parseProc("/proc/net/udp6", "udp", &result); err != nil {
		slog.Debug("Failed to parse /proc/net/udp6", "error", err)
	}

	return result.String(), nil
}

// parseProc parses a /proc/net/* file for listening sockets
func (pm *PortMonitor) parseProc(filename, protocol string, result *strings.Builder) error {
	data, err := os.ReadFile(filename)
	if err != nil {
		return err
	}

	lines := strings.Split(string(data), "\n")
	for i, line := range lines {
		if i == 0 || strings.TrimSpace(line) == "" {
			continue // Skip header and empty lines
		}

		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}

		// Parse socket state (4th field, index 3)
		stateHex := fields[3]
		state, err := strconv.ParseInt(stateHex, 16, 32)
		if err != nil {
			continue
		}

		// Check if socket is in LISTEN state (0x0A for TCP) or bound state for UDP
		isListening := false
		if protocol == "tcp" && state == 0x0A {
			isListening = true
		} else if protocol == "udp" && state == 0x07 {
			// UDP sockets in state 0x07 (TCP_CLOSE) are bound/listening
			isListening = true
		}

		if !isListening {
			continue
		}

		// Parse local address (2nd field, index 1)
		localAddr := fields[1]
		addr, port, err := pm.parseAddress(localAddr, strings.Contains(filename, "6"))
		if err != nil {
			continue
		}

		// Format similar to ss output
		result.WriteString(fmt.Sprintf("%s   LISTEN 0      0          %s:%d        0.0.0.0:*\n",
			protocol, addr, port))
	}

	return nil
}

// parseAddress parses hex-encoded address:port from /proc/net files
func (pm *PortMonitor) parseAddress(addrPort string, isIPv6 bool) (string, int, error) {
	parts := strings.Split(addrPort, ":")
	if len(parts) != 2 {
		return "", 0, fmt.Errorf("invalid address:port format: %s", addrPort)
	}

	// Parse port (stored in hex, big-endian)
	portHex := parts[1]
	port, err := strconv.ParseInt(portHex, 16, 32)
	if err != nil {
		return "", 0, fmt.Errorf("invalid port hex: %s", portHex)
	}

	// Parse IP address
	addrHex := parts[0]
	var addr string

	if isIPv6 {
		// IPv6: 32 hex chars representing 16 bytes
		if len(addrHex) != 32 {
			return "", 0, fmt.Errorf("invalid IPv6 address hex length: %d", len(addrHex))
		}
		// Convert hex to IPv6 address
		var ipBytes [16]byte
		for i := 0; i < 16; i++ {
			b, err := strconv.ParseInt(addrHex[i*2:(i+1)*2], 16, 8)
			if err != nil {
				return "", 0, fmt.Errorf("invalid IPv6 hex: %s", addrHex)
			}
			ipBytes[i] = byte(b)
		}
		// /proc stores IPv6 in little-endian 32-bit chunks, need to reverse each chunk
		for i := 0; i < 16; i += 4 {
			ipBytes[i], ipBytes[i+1], ipBytes[i+2], ipBytes[i+3] = ipBytes[i+3], ipBytes[i+2], ipBytes[i+1], ipBytes[i]
		}
		addr = net.IP(ipBytes[:]).String()
	} else {
		// IPv4: 8 hex chars representing 4 bytes in little-endian
		if len(addrHex) != 8 {
			return "", 0, fmt.Errorf("invalid IPv4 address hex length: %d", len(addrHex))
		}
		// Parse as little-endian 32-bit integer
		addrInt, err := strconv.ParseInt(addrHex, 16, 64)
		if err != nil {
			return "", 0, fmt.Errorf("invalid IPv4 hex: %s", addrHex)
		}
		// Convert to IP address (reverse byte order for little-endian)
		addr = fmt.Sprintf("%d.%d.%d.%d",
			addrInt&0xFF,
			(addrInt>>8)&0xFF,
			(addrInt>>16)&0xFF,
			(addrInt>>24)&0xFF)
	}

	// Handle special addresses
	if addr == "0.0.0.0" {
		addr = "*"
	} else if addr == "::" {
		addr = "*"
	}

	return addr, int(port), nil
}
