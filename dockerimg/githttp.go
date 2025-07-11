package dockerimg

import (
	"context"
	"crypto/subtle"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/cgi"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

type gitHTTP struct {
	gitRepoRoot string
	pass        []byte
	browserC    chan bool // browser launch requests
}

func (g *gitHTTP) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if err := recover(); err != nil {
			slog.ErrorContext(r.Context(), "gitHTTP.ServeHTTP panic", slog.Any("recovered_err", err))

			// Return an error response to the client
			http.Error(w, fmt.Sprintf("panic: %v\n", err), http.StatusInternalServerError)
		}
	}()

	// Get the Authorization header
	username, password, ok := r.BasicAuth()

	// Check if credentials were provided
	if !ok {
		// No credentials provided, return 401 Unauthorized
		w.Header().Set("WWW-Authenticate", `Basic realm="Sketch Git Repository"`)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		slog.InfoContext(r.Context(), "githttp: denied (basic auth)", "remote addr", r.RemoteAddr)
		return
	}

	// Check if credentials are valid
	if username != "sketch" || subtle.ConstantTimeCompare([]byte(password), g.pass) != 1 {
		w.Header().Set("WWW-Authenticate", `Basic realm="Git Repository"`)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		slog.InfoContext(r.Context(), "githttp: denied (basic auth)", "remote addr", r.RemoteAddr)
		return
	}

	// TODO: real mux?
	if strings.HasPrefix(r.URL.Path, "/browser") {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		defer r.Body.Close()

		select {
		case g.browserC <- true:
			slog.InfoContext(r.Context(), "open browser requested")
			w.WriteHeader(http.StatusOK)
		default:
			http.Error(w, "Too many browser launch requests", http.StatusTooManyRequests)
		}
		return
	}

	if runtime.GOOS == "darwin" {
		// On the Mac, Docker connections show up from localhost. On Linux, the docker
		// network is more arbitrary, so we don't do this additional check there.
		if !strings.HasPrefix(r.RemoteAddr, "127.0.0.1:") {
			slog.InfoContext(r.Context(), "githttp: denied", "remote addr", r.RemoteAddr)
			http.Error(w, "no", http.StatusUnauthorized)
			return
		}
	}
	gitBin, err := exec.LookPath("git")
	if err != nil {
		http.Error(w, "no git: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Check if this is a .git/info/refs request for git-upload-pack service (which happens during git fetch)
	// Use `GIT_CURL_VERBOSE=1 git fetch origin` to inspect what's going on under the covers for git.
	if r.Method == http.MethodGet && strings.Contains(r.URL.Path, ".git/info/refs") && r.URL.Query().Get("service") == "git-upload-pack" {
		slog.InfoContext(r.Context(), "detected git info/refs request, running git fetch origin")

		// Create a context with a 5 second timeout
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		// Run git fetch origin in the background
		cmd := exec.CommandContext(ctx, gitBin, "fetch", "origin")
		cmd.Dir = g.gitRepoRoot

		// Execute the command
		output, err := cmd.CombinedOutput()
		if err != nil {
			slog.WarnContext(r.Context(), "git fetch failed",
				"error", err,
				"output", string(output))
			// We don't return here, continue with normal processing
		} else {
			slog.InfoContext(r.Context(), "git fetch completed successfully")
		}
	}

	// Dumb hack for bare repos: if the path starts with .git, and there is no .git, strip it off.
	path := r.URL.Path
	if _, err := os.Stat(filepath.Join(g.gitRepoRoot, path)); os.IsNotExist(err) {
		path = strings.TrimPrefix(path, "/.git") // turn /.git/info/refs into /info/refs
	}

	w.Header().Set("Cache-Control", "no-cache")
	h := &cgi.Handler{
		Path: gitBin,
		Args: []string{"http-backend"},
		Dir:  g.gitRepoRoot,
		Env: []string{
			"GIT_PROJECT_ROOT=" + g.gitRepoRoot,
			"PATH_INFO=" + path,
			"QUERY_STRING=" + r.URL.RawQuery,
			"REQUEST_METHOD=" + r.Method,
			"GIT_HTTP_EXPORT_ALL=true",
			"GIT_HTTP_ALLOW_REPACK=true",
			"GIT_HTTP_ALLOW_PUSH=true",
			"GIT_HTTP_VERBOSE=1",
		},
	}
	h.ServeHTTP(w, r)
}
