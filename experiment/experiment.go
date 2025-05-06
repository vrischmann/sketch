// Package experiment provides support for experimental features.
package experiment

import (
	"fmt"
	"io"
	"log/slog"
	"strings"
	"sync"
)

// Experiment represents an experimental feature.
// Experiments are global.
type Experiment struct {
	Name        string // The name of the experiment used in -x flag
	Description string // A short description of what the experiment does
	Enabled     bool   // Whether the experiment is enabled
}

var (
	mu          sync.Mutex
	experiments = []Experiment{
		{
			Name:        "list",
			Description: "List all available experiments and exit",
		},
		{
			Name:        "all",
			Description: "Enable all experiments",
		},
		{
			Name:        "llm_review",
			Description: "Add an LLM step to the codereview tool",
		},
		{
			Name:        "memory",
			Description: "Enable memory subsystem (dear_llm.md)",
		},
		{
			Name:        "kb",
			Description: "Enable knowledge_base tool",
		},
	}
	byName = map[string]*Experiment{}
)

func Enabled(name string) bool {
	mu.Lock()
	defer mu.Unlock()
	e, ok := byName[name]
	if !ok {
		slog.Error("unknown experiment", "name", name)
		return false
	}
	return e.Enabled
}

func init() {
	for i := range experiments {
		e := &experiments[i]
		byName[e.Name] = e
	}
}

func (e Experiment) String() string {
	return fmt.Sprintf("\t%-15s %s\n", e.Name, e.Description)
}

// Fprint writes a list of all available experiments to w.
func Fprint(w io.Writer) {
	mu.Lock()
	defer mu.Unlock()

	fmt.Fprintln(w, "Available experiments:")
	for _, e := range experiments {
		fmt.Fprintln(w, e)
	}
}

// Flag is a custom flag type that allows for comma-separated
// values and can be used multiple times.
type Flag struct {
	Value string
}

// String returns the string representation of the flag value.
func (f *Flag) String() string {
	return f.Value
}

// Set adds a value to the flag.
func (f *Flag) Set(value string) error {
	if f.Value == "" {
		f.Value = value
	} else {
		f.Value = f.Value + "," + value // quadratic, doesn't matter, tiny N
	}
	return nil
}

// Get returns the flag values.
func (f *Flag) Get() any {
	return f.Value
}

// Process handles all flag values, enabling the appropriate experiments.
func (f *Flag) Process() error {
	mu.Lock()
	defer mu.Unlock()

	for name := range strings.SplitSeq(f.Value, ",") {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		e, ok := byName[name]
		if !ok {
			return fmt.Errorf("unknown experiment: %q", name)
		}
		e.Enabled = true
	}
	if byName["all"].Enabled {
		for i := range experiments {
			e := &experiments[i]
			if e.Name == "list" {
				continue
			}
			e.Enabled = true
		}
	}
	return nil
}
