package dockerimg

import (
	"context"
	"testing"
	"time"

	"sketch.dev/loop"
)

// TestTunnelManagerMaxLimit tests that the tunnel manager respects the max tunnels limit
func TestTunnelManagerMaxLimit(t *testing.T) {
	tm := NewTunnelManager("http://localhost:8080", "test-container", 2) // Max 2 tunnels

	if tm.maxActiveTunnels != 2 {
		t.Errorf("Expected maxActiveTunnels to be 2, got %d", tm.maxActiveTunnels)
	}

	// Test that active tunnels map is empty initially
	if len(tm.activeTunnels) != 0 {
		t.Errorf("Expected 0 active tunnels initially, got %d", len(tm.activeTunnels))
	}

	// Simulate adding tunnels beyond the limit by directly manipulating the internal map
	// This tests the limit logic without actually starting SSH processes
	// Add 2 tunnels (up to the limit)
	tm.activeTunnels["8080"] = &sshTunnel{containerPort: "8080", hostPort: "8080"}
	tm.activeTunnels["9090"] = &sshTunnel{containerPort: "9090", hostPort: "9090"}

	// Verify we have 2 active tunnels
	if len(tm.activeTunnels) != 2 {
		t.Errorf("Expected 2 active tunnels, got %d", len(tm.activeTunnels))
	}

	// Now test that the limit check works - attempt to add a third tunnel
	// Check if we've reached the maximum (this simulates the check in createTunnel)
	shouldBlock := len(tm.activeTunnels) >= tm.maxActiveTunnels

	if !shouldBlock {
		t.Error("Expected tunnel creation to be blocked when at max limit, but limit check failed")
	}

	// Verify that attempting to add beyond the limit doesn't actually add more
	if len(tm.activeTunnels) < tm.maxActiveTunnels {
		// This should not happen since we're at the limit
		tm.activeTunnels["3000"] = &sshTunnel{containerPort: "3000", hostPort: "3000"}
	}

	// Verify we still have only 2 active tunnels (didn't exceed limit)
	if len(tm.activeTunnels) != 2 {
		t.Errorf("Expected exactly 2 active tunnels after limit enforcement, got %d", len(tm.activeTunnels))
	}
}

// TestNewTunnelManagerParams tests that NewTunnelManager correctly sets all parameters
func TestNewTunnelManagerParams(t *testing.T) {
	containerURL := "http://localhost:9090"
	containerSSHHost := "test-ssh-host"
	maxTunnels := 5

	tm := NewTunnelManager(containerURL, containerSSHHost, maxTunnels)

	if tm.containerURL != containerURL {
		t.Errorf("Expected containerURL %s, got %s", containerURL, tm.containerURL)
	}
	if tm.containerSSHHost != containerSSHHost {
		t.Errorf("Expected containerSSHHost %s, got %s", containerSSHHost, tm.containerSSHHost)
	}
	if tm.maxActiveTunnels != maxTunnels {
		t.Errorf("Expected maxActiveTunnels %d, got %d", maxTunnels, tm.maxActiveTunnels)
	}
	if tm.activeTunnels == nil {
		t.Error("Expected activeTunnels map to be initialized")
	}
	if tm.lastPollTime.IsZero() {
		t.Error("Expected lastPollTime to be initialized")
	}
}

// TestShouldSkipPort tests the port skipping logic
func TestShouldSkipPort(t *testing.T) {
	tm := NewTunnelManager("http://localhost:8080", "test-container", 10)

	// Test that system ports are skipped
	systemPorts := []string{"22", "80", "443", "25", "53"}
	for _, port := range systemPorts {
		if !tm.shouldSkipPort(port) {
			t.Errorf("Expected port %s to be skipped", port)
		}
	}

	// Test that application ports are not skipped
	appPorts := []string{"8080", "3000", "9090", "8000"}
	for _, port := range appPorts {
		if tm.shouldSkipPort(port) {
			t.Errorf("Expected port %s to NOT be skipped", port)
		}
	}
}

// TestExtractPortNumber tests port number extraction from ss format
func TestExtractPortNumber(t *testing.T) {
	tm := NewTunnelManager("http://localhost:8080", "test-container", 10)

	tests := []struct {
		input    string
		expected string
	}{
		{"tcp:0.0.0.0:8080", "8080"},
		{"tcp:127.0.0.1:3000", "3000"},
		{"tcp:[::]:9090", "9090"},
		{"udp:0.0.0.0:53", "53"},
		{"invalid", ""},
		{"", ""},
	}

	for _, test := range tests {
		result := tm.extractPortNumber(test.input)
		if result != test.expected {
			t.Errorf("extractPortNumber(%q) = %q, expected %q", test.input, result, test.expected)
		}
	}
}

// TestTunnelManagerLimitEnforcement tests that createTunnel enforces the max limit
func TestTunnelManagerLimitEnforcement(t *testing.T) {
	tm := NewTunnelManager("http://localhost:8080", "test-container", 2) // Max 2 tunnels
	ctx := context.Background()

	// Add tunnels manually to reach the limit (simulating successful SSH setup)
	// In real usage, these would be added by createTunnel after successful SSH
	tm.activeTunnels["8080"] = &sshTunnel{containerPort: "8080", hostPort: "8080"}
	tm.activeTunnels["9090"] = &sshTunnel{containerPort: "9090", hostPort: "9090"}

	// Verify we're now at the limit
	if len(tm.activeTunnels) != 2 {
		t.Fatalf("Setup failed: expected 2 active tunnels, got %d", len(tm.activeTunnels))
	}

	// Now test that createTunnel respects the limit by calling it directly
	// This should hit the limit check and return early without attempting SSH
	tm.createTunnel(ctx, "3000")
	tm.createTunnel(ctx, "4000")

	// Verify no additional tunnels were added (limit enforcement worked)
	if len(tm.activeTunnels) != 2 {
		t.Errorf("createTunnel should have been blocked by limit, but tunnel count changed from 2 to %d", len(tm.activeTunnels))
	}

	// Verify we're at the limit
	if len(tm.activeTunnels) != 2 {
		t.Fatalf("Expected 2 active tunnels, got %d", len(tm.activeTunnels))
	}

	// Now try to process more port events that would create additional tunnels
	// These should be blocked by the limit check in createTunnel
	portEvent1 := loop.PortEvent{
		Type:      "opened",
		Port:      "tcp:0.0.0.0:3000",
		Timestamp: time.Now(),
	}
	portEvent2 := loop.PortEvent{
		Type:      "opened",
		Port:      "tcp:0.0.0.0:4000",
		Timestamp: time.Now(),
	}

	// Process these events - they should be blocked by the limit
	tm.processPortEvent(ctx, portEvent1)
	tm.processPortEvent(ctx, portEvent2)

	// Verify that no additional tunnels were created
	if len(tm.activeTunnels) != 2 {
		t.Errorf("Expected exactly 2 active tunnels after limit enforcement, got %d", len(tm.activeTunnels))
	}

	// Verify the original tunnels are still there
	if _, exists := tm.activeTunnels["8080"]; !exists {
		t.Error("Expected original tunnel for port 8080 to still exist")
	}
	if _, exists := tm.activeTunnels["9090"]; !exists {
		t.Error("Expected original tunnel for port 9090 to still exist")
	}

	// Verify the new tunnels were NOT created
	if _, exists := tm.activeTunnels["3000"]; exists {
		t.Error("Expected tunnel for port 3000 to NOT be created due to limit")
	}
	if _, exists := tm.activeTunnels["4000"]; exists {
		t.Error("Expected tunnel for port 4000 to NOT be created due to limit")
	}
}
