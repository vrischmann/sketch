//go:build !linux

package claudetool

func reapZombies(pgid int) {
	// No-op
}
