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
// The test focuses on specific ports it creates rather than making assumptions about total port counts.
func TestPortMonitor_IntegrationDemo(t *testing.T) {
	// Create a test agent
	agent := createTestAgent(t)

	// Create and start the port monitor
	pm := NewPortMonitor(agent, 25*time.Millisecond) // Fast polling for demo
	ctx := context.Background()
	err := pm.Start(ctx)
	if err != nil {
		t.Fatalf("Failed to start port monitor: %v", err)
	}
	defer pm.Stop()

	// Show current ports
	currentPorts := pm.GetPorts()
	t.Logf("Initial TCP ports detected: %d", len(currentPorts))
	for _, port := range currentPorts {
		t.Logf("  - Port %d (process: %s, pid: %d)", port.Port, port.Process, port.Pid)
	}

	// Start multiple test servers to demonstrate detection
	var listeners []net.Listener
	var wg sync.WaitGroup
	var testPorts []uint16

	// Start 3 test HTTP servers
	for i := 0; i < 3; i++ {
		listener, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			t.Fatalf("Failed to start test listener %d: %v", i, err)
		}
		listeners = append(listeners, listener)

		addr := listener.Addr().(*net.TCPAddr)
		port := addr.Port
		testPorts = append(testPorts, uint16(port))
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

	// Wait for ports to be detected with timeout
	detectionTimeout := time.After(15 * time.Second)
	detectionTicker := time.NewTicker(25 * time.Millisecond)
	defer detectionTicker.Stop()

	allPortsDetected := false
detectionLoop:
	for !allPortsDetected {
		select {
		case <-detectionTimeout:
			t.Fatalf("Timeout waiting for test ports to be detected")
		case <-detectionTicker.C:
			// Check if all test ports are detected
			updatedPorts := pm.GetPorts()
			portMap := make(map[uint16]bool)
			for _, port := range updatedPorts {
				portMap[port.Port] = true
			}

			allPortsDetected = true
			for _, testPort := range testPorts {
				if !portMap[testPort] {
					allPortsDetected = false
					break
				}
			}
			if allPortsDetected {
				t.Logf("All test ports successfully detected: %v", testPorts)
				break detectionLoop
			}
		}
	}

	// Close all listeners
	for i, listener := range listeners {
		t.Logf("Closing test server %d", i+1)
		listener.Close()
	}

	// Wait for servers to stop
	wg.Wait()

	// Wait for ports to be removed with timeout
	removalTimeout := time.After(15 * time.Second)
	removalTicker := time.NewTicker(25 * time.Millisecond)
	defer removalTicker.Stop()

	allPortsRemoved := false
removalLoop:
	for !allPortsRemoved {
		select {
		case <-removalTimeout:
			t.Fatalf("Timeout waiting for test ports to be removed")
		case <-removalTicker.C:
			// Check if all test ports are removed
			finalPorts := pm.GetPorts()
			portMap := make(map[uint16]bool)
			for _, port := range finalPorts {
				portMap[port.Port] = true
			}

			allPortsRemoved = true
			for _, testPort := range testPorts {
				if portMap[testPort] {
					allPortsRemoved = false
					break
				}
			}
			if allPortsRemoved {
				t.Logf("All test ports successfully removed: %v", testPorts)
				break removalLoop
			}
		}
	}

	t.Logf("Integration test completed successfully!")
	t.Logf("- Test ports created and monitored: %v", testPorts)
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
