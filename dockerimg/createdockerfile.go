package dockerimg

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/fs"
	"maps"
	"net/http"
	"slices"
	"strings"
	"text/template"

	"sketch.dev/ant"
)

func hashInitFiles(initFiles map[string]string) string {
	h := sha256.New()
	for _, path := range slices.Sorted(maps.Keys(initFiles)) {
		fmt.Fprintf(h, "%s\n%s\n\n", path, initFiles[path])
	}
	fmt.Fprintf(h, "docker template 1\n%s\n", dockerfileCustomTmpl)
	fmt.Fprintf(h, "docker template 2\n%s\n", dockerfileDefaultTmpl)
	return hex.EncodeToString(h.Sum(nil))
}

// DefaultImage is intended to ONLY be used by the pushdockerimg.go script.
func DefaultImage() (name, dockerfile, hash string) {
	buf := new(bytes.Buffer)
	err := template.Must(template.New("dockerfile").Parse(dockerfileBaseTmpl)).Execute(buf, map[string]string{
		"From": defaultBaseImg,
	})
	if err != nil {
		panic(err)
	}
	return dockerfileDefaultImg, buf.String(), hashInitFiles(nil)
}

const dockerfileDefaultImg = "ghcr.io/boldsoftware/sketch:v1"

const defaultBaseImg = "golang:1.24.2-alpine3.21"

// TODO: add semgrep, prettier -- they require node/npm/etc which is more complicated than apk
// If/when we do this, add them into the list of available tools in bash.go.
const dockerfileBaseTmpl = `FROM {{.From}}

RUN apk add bash git make jq sqlite gcc musl-dev linux-headers npm nodejs go github-cli ripgrep fzf python3 curl vim grep

ENV GOTOOLCHAIN=auto
ENV GOPATH=/go
ENV PATH="$GOPATH/bin:$PATH"

RUN go install golang.org/x/tools/cmd/goimports@latest
RUN go install golang.org/x/tools/gopls@latest
RUN go install mvdan.cc/gofumpt@latest

RUN mkdir -p /root/.cache/sketch/webui
`

const dockerfileFragment = `
ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="{{.InitFilesHash}}"
COPY . /app

WORKDIR /app{{.SubDir}}
RUN if [ -f go.mod ]; then go mod download; fi

{{.ExtraCmds}}

CMD ["/bin/sketch"]
`

// dockerfileCustomTmpl is the dockerfile template used when the LLM
// chooses a custom base image.
const dockerfileCustomTmpl = dockerfileBaseTmpl + dockerfileFragment

// dockerfileDefaultTmpl is the dockerfile used when the LLM went with
// the defaultBaseImg. In this case, we use a pre-canned image.
const dockerfileDefaultTmpl = "FROM " + dockerfileDefaultImg + "\n" + dockerfileFragment

// createDockerfile creates a Dockerfile for a git repo.
// It expects the relevant initFiles to have been provided.
// If the sketch binary is being executed in a sub-directory of the repository,
// the relative path is provided on subPathWorkingDir.
func createDockerfile(ctx context.Context, httpc *http.Client, antURL, antAPIKey string, initFiles map[string]string, subPathWorkingDir string) (string, error) {
	if subPathWorkingDir == "." {
		subPathWorkingDir = ""
	} else if subPathWorkingDir != "" && subPathWorkingDir[0] != '/' {
		subPathWorkingDir = "/" + subPathWorkingDir
	}
	toolCalled := false
	var dockerfileFROM, dockerfileExtraCmds string
	runDockerfile := func(ctx context.Context, input json.RawMessage) (string, error) {
		// TODO: unmarshal straight into a struct
		var m map[string]any
		if err := json.Unmarshal(input, &m); err != nil {
			return "", fmt.Errorf(`input=%[1]v (%[1]T), wanted a map[string]any, got: %w`, input, err)
		}
		var ok bool
		dockerfileFROM, ok = m["from"].(string)
		if !ok {
			return "", fmt.Errorf(`input["from"]=%[1]v (%[1]T), wanted a string`, m["path"])
		}
		dockerfileExtraCmds, ok = m["extra_cmds"].(string)
		if !ok {
			return "", fmt.Errorf(`input["extra_cmds"]=%[1]v (%[1]T), wanted a string`, m["path"])
		}
		toolCalled = true
		return "OK", nil
	}
	convo := ant.NewConvo(ctx, antAPIKey)
	if httpc != nil {
		convo.HTTPC = httpc
	}
	if antURL != "" {
		convo.URL = antURL
	}
	convo.Tools = []*ant.Tool{{
		Name:        "dockerfile",
		Description: "Helps define a Dockerfile that sets up a dev environment for this project.",
		Run:         runDockerfile,
		InputSchema: ant.MustSchema(`{
  "type": "object",
  "required": ["from", "extra_cmds"],
  "properties": {
    "from": {
	  "type": "string",
	  "description": "The alpine base image provided to the dockerfile FROM command"
	},
    "extra_cmds": {
      "type": "string",
      "description": "Extra commands to add to the dockerfile."
    }
  }
}`),
	}}

	// TODO: it's basically impossible to one-shot a python env. We need an agent loop for that.
	// Right now the prompt contains a set of half-baked workarounds.

	// If you want to edit the model prompt, run:
	//
	//	go test ./dockerimg -httprecord ".*" -rewritewant
	//
	// Then look at the changes with:
	//
	//	git diff dockerimg/testdata/*.dockerfile
	//
	// If the dockerfile changes are a strict improvement, commit all the changes.
	msg := ant.Message{
		Role: ant.MessageRoleUser,
		Content: []ant.Content{{
			Type: ant.ContentTypeText,
			Text: `
Call the dockerfile tool to create a Dockerfile.
The parameters to dockerfile fill out the From and ExtraCmds
template variables in the following Go template:

` + "```\n" + dockerfileCustomTmpl + "\n```" + `

In particular:
- Assume it is primarily a Go project. For a minimal env, prefer ` + defaultBaseImg + ` as a base image.
- If any python is needed at all, switch to using a python alpine image as a the base and apk add go.
  Favor using uv, and use one of these base images, depending on the preferred python version:
    ghcr.io/astral-sh/uv:python3.13-alpine
    ghcr.io/astral-sh/uv:python3.12-alpine
    ghcr.io/astral-sh/uv:python3.11-alpine
- When using pip to install packages, use: uv pip install --system.
- Python env setup is challenging and often no required, so any RUN commands involving python tooling should be written to let docker build continue if there is a failure.
- Include any tools particular to this repository that can be inferred from the given context.
- Append || true to any apk add commands in case the package does not exist.
- Do NOT expose any ports.
- Do NOT generate any CMD or ENTRYPOINT extra commands.
`,
		}},
	}
	if len(initFiles) > 0 {
		msg.Content[0].Text += "Here is the content of several files from the repository that may be relevant:\n\n"
	}

	for _, name := range slices.Sorted(maps.Keys(initFiles)) {
		msg.Content = append(msg.Content, ant.Content{
			Type: ant.ContentTypeText,
			Text: fmt.Sprintf("Here is the contents %s:\n<file>\n%s\n</file>\n\n", name, initFiles[name]),
		})
	}
	msg.Content = append(msg.Content, ant.Content{
		Type: ant.ContentTypeText,
		Text: "Now call the dockerfile tool.",
	})
	res, err := convo.SendMessage(msg)
	if err != nil {
		return "", err
	}
	if res.StopReason != ant.StopReasonToolUse {
		return "", fmt.Errorf("expected stop reason %q, got %q", ant.StopReasonToolUse, res.StopReason)
	}
	if _, err := convo.ToolResultContents(context.TODO(), res); err != nil {
		return "", err
	}
	if !toolCalled {
		return "", fmt.Errorf("no dockerfile returned")
	}

	tmpl := dockerfileCustomTmpl
	if dockerfileFROM == defaultBaseImg {
		// Because the LLM has chosen the image we recommended, we
		// can use a pre-canned image of our entire template, which
		// saves a lot of build time.
		tmpl = dockerfileDefaultTmpl
	}

	buf := new(bytes.Buffer)
	err = template.Must(template.New("dockerfile").Parse(tmpl)).Execute(buf, map[string]string{
		"From":          dockerfileFROM,
		"ExtraCmds":     dockerfileExtraCmds,
		"InitFilesHash": hashInitFiles(initFiles),
		"SubDir":        subPathWorkingDir,
	})
	if err != nil {
		return "", fmt.Errorf("dockerfile template failed: %w", err)
	}

	return buf.String(), nil
}

// For future reference: we can find the current git branch/checkout with: git symbolic-ref -q --short HEAD || git describe --tags --exact-match 2>/dev/null || git rev-parse HEAD

func readInitFiles(fsys fs.FS) (map[string]string, error) {
	result := make(map[string]string)

	err := fs.WalkDir(fsys, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() && (d.Name() == ".git" || d.Name() == "node_modules") {
			return fs.SkipDir
		}
		if !d.Type().IsRegular() {
			return nil
		}

		// Case 1: Check for README files
		// TODO: find README files between the .git root (where we start)
		// and the dir that sketch was initialized. This needs more info
		// plumbed to this function.
		if strings.HasPrefix(strings.ToLower(path), "readme") {
			content, err := fs.ReadFile(fsys, path)
			if err != nil {
				return err
			}
			result[path] = string(content)
			return nil
		}

		// Case 2: Check for GitHub workflow files
		if strings.HasPrefix(path, ".github/workflows/") {
			content, err := fs.ReadFile(fsys, path)
			if err != nil {
				return err
			}
			result[path] = string(content)
			return nil
		}

		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}
