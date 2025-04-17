package claudetool

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os/exec"
	"strings"
	"syscall"
	"time"

	"sketch.dev/ant"
	"sketch.dev/claudetool/bashkit"
)

// The Bash tool executes shell commands with bash -c and optional timeout
var Bash = &ant.Tool{
	Name:        bashName,
	Description: strings.TrimSpace(bashDescription),
	InputSchema: ant.MustSchema(bashInputSchema),
	Run:         BashRun,
}

const (
	bashName        = "bash"
	bashDescription = `
Executes a shell command using bash -c with an optional timeout, returning combined stdout and stderr.

Executables pre-installed in this environment include:
- standard unix tools
- go
- git
- rg
- jq
- gopls
- sqlite
- fzf
- gh
- python3
`
	// If you modify this, update the termui template for prettier rendering.
	bashInputSchema = `
{
  "type": "object",
  "required": ["command"],
  "properties": {
    "command": {
      "type": "string",
      "description": "Shell script to execute"
    },
    "timeout": {
      "type": "string",
      "description": "Timeout as a Go duration string, defaults to '1m'"
    }
  }
}
`
)

type bashInput struct {
	Command string `json:"command"`
	Timeout string `json:"timeout,omitempty"`
}

func (i *bashInput) timeout() time.Duration {
	dur, err := time.ParseDuration(i.Timeout)
	if err != nil {
		return 1 * time.Minute
	}
	return dur
}

func BashRun(ctx context.Context, m json.RawMessage) (string, error) {
	var req bashInput
	if err := json.Unmarshal(m, &req); err != nil {
		return "", fmt.Errorf("failed to unmarshal bash command input: %w", err)
	}
	// do a quick permissions check (NOT a security barrier)
	err := bashkit.Check(req.Command)
	if err != nil {
		return "", err
	}
	out, execErr := executeBash(ctx, req)
	if execErr == nil {
		return out, nil
	}
	return "", execErr
}

const maxBashOutputLength = 131072

func executeBash(ctx context.Context, req bashInput) (string, error) {
	execCtx, cancel := context.WithTimeout(ctx, req.timeout())
	defer cancel()

	// Can't do the simple thing and call CombinedOutput because of the need to kill the process group.
	cmd := exec.CommandContext(execCtx, "bash", "-c", req.Command)
	cmd.Dir = WorkingDir(ctx)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	var output bytes.Buffer
	cmd.Stdin = nil
	cmd.Stdout = &output
	cmd.Stderr = &output
	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("command failed: %w", err)
	}
	proc := cmd.Process
	done := make(chan struct{})
	go func() {
		select {
		case <-execCtx.Done():
			if execCtx.Err() == context.DeadlineExceeded && proc != nil {
				// Kill the entire process group.
				syscall.Kill(-proc.Pid, syscall.SIGKILL)
			}
		case <-done:
		}
	}()

	err := cmd.Wait()
	close(done)

	if execCtx.Err() == context.DeadlineExceeded {
		return "", fmt.Errorf("command timed out after %s", req.timeout())
	}
	longOutput := output.Len() > maxBashOutputLength
	var outstr string
	if longOutput {
		outstr = fmt.Sprintf("output too long: got %v, max is %v\ninitial bytes of output:\n%s",
			humanizeBytes(output.Len()), humanizeBytes(maxBashOutputLength),
			output.Bytes()[:1024],
		)
	} else {
		outstr = output.String()
	}

	if err != nil {
		return "", fmt.Errorf("command failed: %w\n%s", err, outstr)
	}

	if longOutput {
		return "", fmt.Errorf("%s", outstr)
	}

	return output.String(), nil
}

func humanizeBytes(bytes int) string {
	switch {
	case bytes < 4*1024:
		return fmt.Sprintf("%dB", bytes)
	case bytes < 1024*1024:
		kb := int(math.Round(float64(bytes) / 1024.0))
		return fmt.Sprintf("%dkB", kb)
	case bytes < 1024*1024*1024:
		mb := int(math.Round(float64(bytes) / (1024.0 * 1024.0)))
		return fmt.Sprintf("%dMB", mb)
	}
	return "more than 1GB"
}
