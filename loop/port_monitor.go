package loop

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"tailscale.com/portlist"
)

// PortMonitor monitors open/listening TCP ports and sends notifications
// to an Agent when ports are detected or removed.
type PortMonitor struct {
	mu       sync.RWMutex
	ports    []portlist.Port // cached list of current ports
	poller   *portlist.Poller
	agent    *Agent
	ctx      context.Context
	cancel   context.CancelFunc
	interval time.Duration
	running  bool
	wg       sync.WaitGroup
}

// NewPortMonitor creates a new PortMonitor instance.
func NewPortMonitor(agent *Agent, interval time.Duration) *PortMonitor {
	if interval <= 0 {
		interval = 5 * time.Second // default polling interval
	}

	ctx, cancel := context.WithCancel(context.Background())
	poller := &portlist.Poller{
		IncludeLocalhost: true, // include localhost-bound services
	}

	return &PortMonitor{
		poller:   poller,
		agent:    agent,
		ctx:      ctx,
		cancel:   cancel,
		interval: interval,
	}
}

// Start begins monitoring ports in a background goroutine.
func (pm *PortMonitor) Start(ctx context.Context) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if pm.running {
		return fmt.Errorf("port monitor is already running")
	}

	// Update the internal context to use the provided context
	pm.cancel() // Cancel the old context
	pm.ctx, pm.cancel = context.WithCancel(ctx)

	pm.running = true
	pm.wg.Add(1)

	// Do initial port scan
	if err := pm.initialScan(); err != nil {
		pm.running = false
		pm.wg.Done()
		return fmt.Errorf("initial port scan failed: %w", err)
	}

	go pm.monitor()
	return nil
}

// Stop stops the port monitor.
func (pm *PortMonitor) Stop() {
	pm.mu.Lock()
	if !pm.running {
		pm.mu.Unlock()
		return
	}

	pm.running = false
	pm.cancel()
	pm.mu.Unlock()
	pm.wg.Wait()
	pm.poller.Close()
}

// GetPorts returns the cached list of open ports.
func (pm *PortMonitor) GetPorts() []portlist.Port {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	// Return a copy to prevent data races
	ports := make([]portlist.Port, len(pm.ports))
	copy(ports, pm.ports)
	return ports
}

// initialScan performs the initial port scan without sending notifications.
func (pm *PortMonitor) initialScan() error {
	ports, _, err := pm.poller.Poll()
	if err != nil {
		return err
	}

	// Filter for TCP ports only
	pm.ports = filterTCPPorts(ports)
	sortPorts(pm.ports)

	return nil
}

// monitor runs the port monitoring loop.
func (pm *PortMonitor) monitor() {
	defer pm.wg.Done()

	ticker := time.NewTicker(pm.interval)
	defer ticker.Stop()

	for {
		select {
		case <-pm.ctx.Done():
			return
		case <-ticker.C:
			if err := pm.checkPorts(); err != nil {
				slog.WarnContext(pm.ctx, "port monitoring error", "error", err)
			}
		}
	}
}

// checkPorts polls for current ports and sends notifications for changes.
func (pm *PortMonitor) checkPorts() error {
	ports, changed, err := pm.poller.Poll()
	if err != nil {
		return err
	}

	if !changed {
		return nil
	}

	// Filter for TCP ports only
	currentTCPPorts := filterTCPPorts(ports)
	sortPorts(currentTCPPorts)

	pm.mu.Lock()
	previousPorts := pm.ports
	pm.ports = currentTCPPorts
	pm.mu.Unlock()

	// Find added and removed ports
	addedPorts := findAddedPorts(previousPorts, currentTCPPorts)
	removedPorts := findRemovedPorts(previousPorts, currentTCPPorts)

	// Send notifications for changes
	for _, port := range addedPorts {
		pm.sendPortNotification("opened", port)
	}

	for _, port := range removedPorts {
		pm.sendPortNotification("closed", port)
	}

	return nil
}

// sendPortNotification sends a port event notification to the agent.
func (pm *PortMonitor) sendPortNotification(event string, port portlist.Port) {
	if pm.agent == nil {
		return
	}

	// Skip low ports and sketch's ports
	if port.Port < 1024 || port.Pid == 1 {
		return
	}

	// Skip processes with SKETCH_IGNORE_PORTS environment variable
	if pm.shouldIgnoreProcess(port.Pid) {
		return
	}

	// TODO: Structure this so that UI can display it more nicely.
	content := fmt.Sprintf("Port %s: %s:%d", event, port.Proto, port.Port)
	if port.Process != "" {
		content += fmt.Sprintf(" (process: %s)", port.Process)
	}
	if port.Pid != 0 {
		content += fmt.Sprintf(" (pid: %d)", port.Pid)
	}

	msg := AgentMessage{
		Type:       PortMessageType,
		Content:    content,
		HideOutput: true,
	}

	pm.agent.pushToOutbox(pm.ctx, msg)
}

// filterTCPPorts filters the port list to include only TCP ports.
func filterTCPPorts(ports []portlist.Port) []portlist.Port {
	var tcpPorts []portlist.Port
	for _, port := range ports {
		if port.Proto == "tcp" {
			tcpPorts = append(tcpPorts, port)
		}
	}
	return tcpPorts
}

// sortPorts sorts ports by port number for consistent comparisons.
func sortPorts(ports []portlist.Port) {
	sort.Slice(ports, func(i, j int) bool {
		return ports[i].Port < ports[j].Port
	})
}

// findAddedPorts finds ports that are in current but not in previous.
func findAddedPorts(previous, current []portlist.Port) []portlist.Port {
	prevSet := make(map[uint16]bool)
	for _, port := range previous {
		prevSet[port.Port] = true
	}

	var added []portlist.Port
	for _, port := range current {
		if !prevSet[port.Port] {
			added = append(added, port)
		}
	}
	return added
}

// findRemovedPorts finds ports that are in previous but not in current.
func findRemovedPorts(previous, current []portlist.Port) []portlist.Port {
	currentSet := make(map[uint16]bool)
	for _, port := range current {
		currentSet[port.Port] = true
	}

	var removed []portlist.Port
	for _, port := range previous {
		if !currentSet[port.Port] {
			removed = append(removed, port)
		}
	}
	return removed
}

// shouldIgnoreProcess checks if a process should be ignored based on its environment variables.
func (pm *PortMonitor) shouldIgnoreProcess(pid int) bool {
	if pid <= 0 {
		return false
	}

	// Read the process environment from /proc/[pid]/environ
	envFile := fmt.Sprintf("/proc/%d/environ", pid)
	envData, err := os.ReadFile(envFile)
	if err != nil {
		// If we can't read the environment, don't ignore the process
		return false
	}

	// Parse the environment variables (null-separated)
	envVars := strings.Split(string(envData), "\x00")
	for _, envVar := range envVars {
		if envVar == "SKETCH_IGNORE_PORTS=1" {
			return true
		}
	}

	return false
}
