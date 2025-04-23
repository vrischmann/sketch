package server

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"syscall"
	"unsafe"

	"github.com/creack/pty"
	"github.com/gliderlabs/ssh"
)

func setWinsize(f *os.File, w, h int) {
	syscall.Syscall(syscall.SYS_IOCTL, f.Fd(), uintptr(syscall.TIOCSWINSZ),
		uintptr(unsafe.Pointer(&struct{ h, w, x, y uint16 }{uint16(h), uint16(w), 0, 0})))
}

func (s *Server) ServeSSH(ctx context.Context, hostKey, authorizedKeys []byte) error {
	// Parse all authorized keys
	allowedKeys := make([]ssh.PublicKey, 0)
	rest := authorizedKeys
	var err error

	// Continue parsing as long as there are bytes left
	for len(rest) > 0 {
		var key ssh.PublicKey
		key, _, _, rest, err = ssh.ParseAuthorizedKey(rest)
		if err != nil {
			// If we hit an error, check if we have more lines to try
			if i := bytes.IndexByte(rest, '\n'); i >= 0 {
				// Skip to the next line and continue
				rest = rest[i+1:]
				continue
			}
			// No more lines and we hit an error, so stop parsing
			break
		}
		allowedKeys = append(allowedKeys, key)
	}
	if len(allowedKeys) == 0 {
		return fmt.Errorf("ServeSSH: no valid authorized keys found")
	}

	return ssh.ListenAndServe(":22",
		func(s ssh.Session) {
			handleSessionfunc(ctx, s)
		},
		ssh.HostKeyPEM(hostKey),
		ssh.PublicKeyAuth(func(ctx ssh.Context, key ssh.PublicKey) bool {
			// Check if the provided key matches any of our allowed keys
			for _, allowedKey := range allowedKeys {
				if ssh.KeysEqual(key, allowedKey) {
					return true
				}
			}
			return false
		}),
	)
}

func handleSessionfunc(ctx context.Context, s ssh.Session) {
	cmd := exec.CommandContext(ctx, "/bin/bash")
	ptyReq, winCh, isPty := s.Pty()
	if isPty {
		cmd.Env = append(cmd.Env, fmt.Sprintf("TERM=%s", ptyReq.Term))
		f, err := pty.Start(cmd)
		if err != nil {
			panic(err)
		}
		go func() {
			for win := range winCh {
				setWinsize(f, win.Width, win.Height)
			}
		}()
		go func() {
			io.Copy(f, s) // stdin
		}()
		io.Copy(s, f) // stdout
		cmd.Wait()
	} else {
		io.WriteString(s, "No PTY requested.\n")
		s.Exit(1)
	}
}
