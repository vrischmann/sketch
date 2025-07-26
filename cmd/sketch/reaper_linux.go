//go:build linux

package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"

	"golang.org/x/sys/unix"
)

func startReaper(ctx context.Context) error {
	if err := unix.Prctl(unix.PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0); err != nil {
		return err
	}
	go reapZombies(ctx)
	return nil
}

// reapZombies runs until ctx is cancelled.
func reapZombies(ctx context.Context) {
	sig := make(chan os.Signal, 16)
	signal.Notify(sig, unix.SIGCHLD)

	for range sig {
	Reap:
		for {
			var status unix.WaitStatus
			pid, err := unix.Wait4(-1, &status, unix.WNOHANG, nil)
			switch {
			case pid > 0:
				slog.DebugContext(ctx, "reaper ran", "pid", pid, "exit", status.ExitStatus())
			case err == unix.EINTR:
				// interrupted: fall through to retry
			case err == unix.ECHILD || pid == 0:
				break Reap // no more ready children; wait for next SIGCHLD
			default:
				slog.WarnContext(ctx, "wait4 error", "error", err)
				break Reap
			}
		}
	}
}
