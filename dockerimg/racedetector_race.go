//go:build race

// Package dockerimg provides functionality for creating and managing Docker images.
package dockerimg

// RaceEnabled returns whether the race detector is enabled.
// This function will always return true when compiled with the race detector.
func RaceEnabled() bool {
	return true
}
