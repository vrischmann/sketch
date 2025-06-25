package loop

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"
)

// TestPortMonitoring tests the port monitoring functionality
func TestPortMonitoring(t *testing.T) {
	// Test with ss output format
	ssOutput := `Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:PortProcess
tcp   LISTEN 0      1024       127.0.0.1:40975      0.0.0.0:*          
tcp   LISTEN 0      4096               *:22               *:*          
tcp   LISTEN 0      4096               *:80               *:*          
udp   UNCONN 0      0               127.0.0.1:123            0.0.0.0:*          
`

	expected := map[string]bool{
		"tcp:127.0.0.1:40975": true,
		"tcp:*:22":            true,
		"tcp:*:80":            true,
	}

	result := parseSSPorts(ssOutput)

	// Check that all expected ports are found
	for port := range expected {
		if !result[port] {
			t.Errorf("Expected port %s not found in ss parsed output", port)
		}
	}

	// Check that UDP port is not included (since it's UNCONN, not LISTEN)
	if result["udp:127.0.0.1:123"] {
		t.Errorf("UDP UNCONN port should not be included in listening ports")
	}

	// Check that no extra ports are found
	for port := range result {
		if !expected[port] {
			t.Errorf("Unexpected port %s found in parsed output", port)
		}
	}
}

// TestPortMonitoringLogDifferences tests the port difference logging
func TestPortMonitoringLogDifferences(t *testing.T) {
	ctx := context.Background()

	oldPorts := `Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:PortProcess
tcp   LISTEN 0      4096               *:22               *:*          
tcp   LISTEN 0      1024       127.0.0.1:8080      0.0.0.0:*          
`

	newPorts := `Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:PortProcess
tcp   LISTEN 0      4096               *:22               *:*          
tcp   LISTEN 0      1024       127.0.0.1:9090      0.0.0.0:*          
`

	// Create a port monitor to test the logPortDifferences method
	pm := NewPortMonitor()

	// This test mainly ensures the method doesn't panic and processes the differences
	// The actual logging output would need to be captured via a test logger to verify fully
	pm.logPortDifferences(ctx, oldPorts, newPorts)

	// Test with no differences
	pm.logPortDifferences(ctx, oldPorts, oldPorts)
}

// TestPortMonitorCreation tests creating a new port monitor
func TestPortMonitorCreation(t *testing.T) {
	pm := NewPortMonitor()
	if pm == nil {
		t.Error("NewPortMonitor() returned nil")
	}

	// Verify initial state
	pm.mu.Lock()
	defer pm.mu.Unlock()
	if pm.lastPorts != "" {
		t.Error("NewPortMonitor() should have empty lastPorts initially")
	}
}

// TestParseSSPortsEdgeCases tests edge cases in ss output parsing
func TestParseSSPortsEdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		output   string
		expected map[string]bool
	}{
		{
			name:     "empty output",
			output:   "",
			expected: map[string]bool{},
		},
		{
			name:     "header only",
			output:   "Netid State  Recv-Q Send-Q Local Address:Port  Peer Address:PortProcess",
			expected: map[string]bool{},
		},
		{
			name:     "non-listen states filtered out",
			output:   "tcp   ESTAB  0      0       127.0.0.1:8080      127.0.0.1:45678\nudp   UNCONN 0      0       127.0.0.1:123       0.0.0.0:*",
			expected: map[string]bool{},
		},
		{
			name:     "insufficient fields",
			output:   "tcp LISTEN 0",
			expected: map[string]bool{},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			result := parseSSPorts(test.output)
			if len(result) != len(test.expected) {
				t.Errorf("Expected %d ports, got %d", len(test.expected), len(result))
			}
			for port := range test.expected {
				if !result[port] {
					t.Errorf("Expected port %s not found", port)
				}
			}
			for port := range result {
				if !test.expected[port] {
					t.Errorf("Unexpected port %s found", port)
				}
			}
		})
	}
}

// TestPortEventStorage tests the new event storage functionality
func TestPortEventStorage(t *testing.T) {
	pm := NewPortMonitor()

	// Initially should have no events
	allEvents := pm.GetAllRecentEvents()
	if len(allEvents) != 0 {
		t.Errorf("Expected 0 events initially, got %d", len(allEvents))
	}

	// Simulate port changes that would add events
	ctx := context.Background()
	oldPorts := "Netid State Recv-Q Send-Q Local Address:Port Peer Address:Port\ntcp   LISTEN 0      128    0.0.0.0:8080         0.0.0.0:*"
	newPorts := "Netid State Recv-Q Send-Q Local Address:Port Peer Address:Port\ntcp   LISTEN 0      128    0.0.0.0:9090         0.0.0.0:*"

	pm.logPortDifferences(ctx, oldPorts, newPorts)

	// Should now have events
	allEvents = pm.GetAllRecentEvents()
	if len(allEvents) != 2 {
		t.Errorf("Expected 2 events (1 opened, 1 closed), got %d", len(allEvents))
	}

	// Check event types
	foundOpened := false
	foundClosed := false
	for _, event := range allEvents {
		if event.Type == "opened" && event.Port == "tcp:0.0.0.0:9090" {
			foundOpened = true
		}
		if event.Type == "closed" && event.Port == "tcp:0.0.0.0:8080" {
			foundClosed = true
		}
	}

	if !foundOpened {
		t.Error("Expected to find 'opened' event for port tcp:0.0.0.0:9090")
	}
	if !foundClosed {
		t.Error("Expected to find 'closed' event for port tcp:0.0.0.0:8080")
	}
}

// TestPortEventFiltering tests the time-based filtering
func TestPortEventFiltering(t *testing.T) {
	pm := NewPortMonitor()
	ctx := context.Background()

	// Record time before adding events
	beforeTime := time.Now()
	time.Sleep(1 * time.Millisecond) // Small delay to ensure timestamp difference

	// Add some events
	oldPorts := "Netid State Recv-Q Send-Q Local Address:Port Peer Address:Port\ntcp   LISTEN 0      128    0.0.0.0:8080         0.0.0.0:*"
	newPorts := "Netid State Recv-Q Send-Q Local Address:Port Peer Address:Port\ntcp   LISTEN 0      128    0.0.0.0:9090         0.0.0.0:*"
	pm.logPortDifferences(ctx, oldPorts, newPorts)

	// Get events since beforeTime - should get all events
	recentEvents := pm.GetRecentEvents(beforeTime)
	if len(recentEvents) != 2 {
		t.Errorf("Expected 2 recent events, got %d", len(recentEvents))
	}

	// Get events since now - should get no events
	nowTime := time.Now()
	recentEvents = pm.GetRecentEvents(nowTime)
	if len(recentEvents) != 0 {
		t.Errorf("Expected 0 recent events since now, got %d", len(recentEvents))
	}
}

// TestParseAddress tests the hex address parsing for /proc/net files
func TestParseAddress(t *testing.T) {
	pm := NewPortMonitor()

	tests := []struct {
		name       string
		addrPort   string
		isIPv6     bool
		expectIP   string
		expectPort int
		expectErr  bool
	}{
		{
			name:       "IPv4 localhost:80",
			addrPort:   "0100007F:0050", // 127.0.0.1:80 in little-endian hex
			isIPv6:     false,
			expectIP:   "127.0.0.1",
			expectPort: 80,
			expectErr:  false,
		},
		{
			name:       "IPv4 any:22",
			addrPort:   "00000000:0016", // 0.0.0.0:22
			isIPv6:     false,
			expectIP:   "*",
			expectPort: 22,
			expectErr:  false,
		},
		{
			name:       "IPv4 high port",
			addrPort:   "0100007F:1F90", // 127.0.0.1:8080
			isIPv6:     false,
			expectIP:   "127.0.0.1",
			expectPort: 8080,
			expectErr:  false,
		},
		{
			name:       "IPv6 any port 22",
			addrPort:   "00000000000000000000000000000000:0016", // [::]:22
			isIPv6:     true,
			expectIP:   "*",
			expectPort: 22,
			expectErr:  false,
		},
		{
			name:      "Invalid format - no colon",
			addrPort:  "0100007F0050",
			isIPv6:    false,
			expectErr: true,
		},
		{
			name:      "Invalid port hex",
			addrPort:  "0100007F:ZZZZ",
			isIPv6:    false,
			expectErr: true,
		},
		{
			name:      "Invalid IPv4 hex length",
			addrPort:  "0100:0050",
			isIPv6:    false,
			expectErr: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ip, port, err := pm.parseAddress(test.addrPort, test.isIPv6)
			if test.expectErr {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if ip != test.expectIP {
				t.Errorf("Expected IP %s, got %s", test.expectIP, ip)
			}

			if port != test.expectPort {
				t.Errorf("Expected port %d, got %d", test.expectPort, port)
			}
		})
	}
}

// TestParseProcData tests parsing of mock /proc/net data
func TestParseProcData(t *testing.T) {
	pm := NewPortMonitor()

	// Test TCP data with listening sockets
	tcpData := `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:0050 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0        1
   1: 00000000:0016 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0        2
   2: 0100007F:1F90 0200007F:C350 01 00000000:00000000 00:00000000 00000000     0        0        3`

	var result strings.Builder
	result.WriteString("Netid State  Recv-Q Send-Q Local Address:Port Peer Address:Port\n")

	// Create temp file with test data
	tmpFile := "/tmp/test_tcp"
	err := os.WriteFile(tmpFile, []byte(tcpData), 0o644)
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile)

	err = pm.parseProc(tmpFile, "tcp", &result)
	if err != nil {
		t.Fatalf("parseProc failed: %v", err)
	}

	output := result.String()
	t.Logf("Generated output:\n%s", output)

	// Should contain listening ports (state 0A = LISTEN)
	if !strings.Contains(output, "127.0.0.1:80") {
		t.Error("Expected to find 127.0.0.1:80 in output")
	}
	if !strings.Contains(output, "*:22") {
		t.Error("Expected to find *:22 in output")
	}
	// Should not contain established connection (state 01)
	if strings.Contains(output, "127.0.0.1:8080") {
		t.Error("Should not find established connection 127.0.0.1:8080 in output")
	}
}

// TestGetListeningPortsFromProcFallback tests the complete /proc fallback
func TestGetListeningPortsFromProcFallback(t *testing.T) {
	pm := NewPortMonitor()

	// This test verifies the method runs without error
	// The actual files may or may not exist, but it should handle both cases gracefully
	output, err := pm.getListeningPortsFromProc()
	if err != nil {
		t.Logf("getListeningPortsFromProc failed (may be expected if /proc/net files don't exist): %v", err)
		// Don't fail the test - this might be expected in some environments
		return
	}

	t.Logf("Generated /proc fallback output:\n%s", output)

	// Should at least have a header
	if !strings.Contains(output, "Netid State") {
		t.Error("Expected header in /proc fallback output")
	}
}

// TestUpdatePortStateWithFallback tests updatePortState with both ss and /proc fallback
func TestUpdatePortStateWithFallback(t *testing.T) {
	pm := NewPortMonitor()
	ctx := context.Background()

	// Call updatePortState - should try ss first, then fall back to /proc if ss fails
	pm.updatePortState(ctx)

	// The method should complete without panicking
	// We can't easily test the exact behavior without mocking, but we can ensure it runs
	// Check if any port state was captured
	pm.mu.Lock()
	lastPorts := pm.lastPorts
	pm.mu.Unlock()

	t.Logf("Captured port state (length %d):", len(lastPorts))
	if len(lastPorts) > 0 {
		t.Logf("First 200 chars: %s", lastPorts[:min(200, len(lastPorts))])
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
