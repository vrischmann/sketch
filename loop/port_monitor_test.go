package loop

import (
	"context"
	"testing"
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
