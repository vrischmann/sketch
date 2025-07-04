package loop

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"sync"
	"testing"
	"time"
)

// TestPortMonitor_IntegrationDemo demonstrates the full integration of PortMonitor with an Agent.
// This test shows how the PortMonitor detects port changes and sends notifications to an Agent.
func TestPortMonitor_IntegrationDemo(t *testing.T) {
	// Create a test agent
	agent := createTestAgent(t)

	// Create and start the port monitor
	pm := NewPortMonitor(agent, 100*time.Millisecond) // Fast polling for demo
	ctx := context.Background()
	err := pm.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start port monitor: %v", err)
	}
	defer pm.Stop()

	// Wait for initial scan
	time.Sleep(200 * time.Millisecond)

	// Show current ports
	currentPorts := pm.GetPorts()
	t.Logf("Initial TCP ports detected: %d", len(currentPorts))
	for _, port := range currentPorts {
		t.Logf("  - Port %d (process: %s, pid: %d)", port.Port, port.Process, port.Pid)
	}

	// Start multiple test servers to demonstrate detection
	var listeners []net.Listener
	var wg sync.WaitGroup

	// Start 3 test HTTP servers
	for i := 0; i < 3; i++ {
		listener, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			t.Fatalf("Failed to start test listener %d: %v", i, err)
		}
		listeners = append(listeners, listener)

		addr := listener.Addr().(*net.TCPAddr)
		port := addr.Port
		t.Logf("Started test HTTP server %d on port %d", i+1, port)

		// Start a simple HTTP server
		wg.Add(1)
		go func(l net.Listener, serverID int) {
			defer wg.Done()
			mux := http.NewServeMux()
			mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
				fmt.Fprintf(w, "Hello from test server %d!\n", serverID)
			})
			server := &http.Server{Handler: mux}
			server.Serve(l)
		}(listener, i+1)
	}

	// Wait for ports to be detected
	time.Sleep(500 * time.Millisecond)

	// Check that the new ports were detected
	updatedPorts := pm.GetPorts()
	t.Logf("Updated TCP ports detected: %d", len(updatedPorts))

	// Verify that we have at least 3 more ports than initially
	if len(updatedPorts) < len(currentPorts)+3 {
		t.Errorf("Expected at least %d ports, got %d", len(currentPorts)+3, len(updatedPorts))
	}

	// Find the new test server ports
	var testPorts []uint16
	for _, listener := range listeners {
		addr := listener.Addr().(*net.TCPAddr)
		testPorts = append(testPorts, uint16(addr.Port))
	}

	// Verify all test ports are detected
	portMap := make(map[uint16]bool)
	for _, port := range updatedPorts {
		portMap[port.Port] = true
	}

	allPortsDetected := true
	for _, testPort := range testPorts {
		if !portMap[testPort] {
			allPortsDetected = false
			t.Errorf("Test port %d was not detected", testPort)
		}
	}

	if allPortsDetected {
		t.Logf("All test ports successfully detected!")
	}

	// Close all listeners
	for i, listener := range listeners {
		t.Logf("Closing test server %d", i+1)
		listener.Close()
	}

	// Wait for servers to stop
	wg.Wait()

	// Wait for ports to be removed
	time.Sleep(500 * time.Millisecond)

	// Check that ports were removed
	finalPorts := pm.GetPorts()
	t.Logf("Final TCP ports detected: %d", len(finalPorts))

	// Verify the final port count is back to near the original
	if len(finalPorts) > len(currentPorts)+1 {
		t.Errorf("Expected final port count to be close to initial (%d), got %d", len(currentPorts), len(finalPorts))
	}

	// Verify test ports are no longer detected
	portMap = make(map[uint16]bool)
	for _, port := range finalPorts {
		portMap[port.Port] = true
	}

	allPortsRemoved := true
	for _, testPort := range testPorts {
		if portMap[testPort] {
			allPortsRemoved = false
			t.Errorf("Test port %d was not removed", testPort)
		}
	}

	if allPortsRemoved {
		t.Logf("All test ports successfully removed!")
	}

	t.Logf("Integration test completed successfully!")
	t.Logf("- Initial ports: %d", len(currentPorts))
	t.Logf("- Peak ports: %d", len(updatedPorts))
	t.Logf("- Final ports: %d", len(finalPorts))
	t.Logf("- Test ports added and removed: %d", len(testPorts))
}

// contains checks if a string contains a substring.
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr ||
		(len(s) > len(substr) &&
			(s[:len(substr)] == substr ||
				s[len(s)-len(substr):] == substr ||
				indexOfSubstring(s, substr) >= 0)))
}

// indexOfSubstring finds the index of substring in string.
func indexOfSubstring(s, substr string) int {
	if len(substr) == 0 {
		return 0
	}
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
