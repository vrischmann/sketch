//go:build linux

package claudetool

import (
	"log/slog"
	"os"
	"syscall"
	"time"

	"golang.org/x/sys/unix"
)

// reapZombies attempts to reap zombie child processes from the specified
// process group that may have been left behind after a process group cleanup.
// This is important when running as PID 1 (init process) since no other process
// will reap zombies.
//
// This function reaps zombies until the process group is empty or no more
// zombies are available.
func reapZombies(pgid int) {
	if os.Getpid() != 1 {
		return // not running as init (e.g. -unsafe), no need to reap
	}
	// Quick exit for the common case.
	if !processGroupHasProcesses(pgid) {
		return // no processes in the group, nothing to reap
	}

	// Reap in the background.
	go func() {
		maxAttempts := 1000 // shouldn't ever hit this, so be generous, this isn't particularly expensive

		for range maxAttempts {
			if !processGroupHasProcesses(pgid) {
				return
			}

			var wstatus unix.WaitStatus
			pid, err := unix.Wait4(-pgid, &wstatus, unix.WNOHANG, nil)

			switch err {
			case syscall.EINTR:
				// interrupted, retry
				continue
			case syscall.ECHILD:
				// no children, therefore no zombies
				return
			case nil:
				// fall through to handle pid
			default:
				slog.Debug("unexpected error in reapZombies", "error", err, "pgid", pgid)
				return
			}

			if pid == 0 {
				// No zombies available right now, wait and check again
				// There's no great rush, so give it some time.
				time.Sleep(100 * time.Millisecond)
				continue
			}

			slog.Debug("reaped zombie process", "pid", pid, "pgid", pgid, "status", wstatus)
		}
	}()
}
