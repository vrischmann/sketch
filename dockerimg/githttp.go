package dockerimg

import (
	"fmt"
	"log/slog"
	"net/http"
	"net/http/cgi"
	"os/exec"
	"strings"
)

type gitHTTP struct {
	gitRepoRoot string
}

func (g *gitHTTP) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if err := recover(); err != nil {
			slog.ErrorContext(r.Context(), "gitHTTP.ServeHTTP panic", slog.Any("recovered_err", err))

			// Return an error response to the client
			http.Error(w, fmt.Sprintf("panic: %v\n", err), http.StatusInternalServerError)
		}
	}()
	if !strings.HasPrefix(r.RemoteAddr, "127.0.0.1:") {
		slog.InfoContext(r.Context(), "githttp: denied", "remote addr", r.RemoteAddr)
		http.Error(w, "no", http.StatusUnauthorized)
		return
	}
	gitBin, err := exec.LookPath("git")
	if err != nil {
		http.Error(w, "no git: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Cache-Control", "no-cache")
	h := &cgi.Handler{
		Path: gitBin,
		Args: []string{"http-backend"},
		Dir:  g.gitRepoRoot,
		Env: []string{
			"GIT_PROJECT_ROOT=" + g.gitRepoRoot,
			"PATH_INFO=" + r.URL.Path,
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
