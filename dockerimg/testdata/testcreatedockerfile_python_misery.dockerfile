FROM ghcr.io/astral-sh/uv:python3.11-alpine

RUN apk add bash git make jq sqlite gcc musl-dev linux-headers npm nodejs go github-cli ripgrep fzf python3 curl vim

ENV GOTOOLCHAIN=auto
ENV GOPATH=/go
ENV PATH="$GOPATH/bin:$PATH"

RUN go install golang.org/x/tools/cmd/goimports@latest
RUN go install golang.org/x/tools/gopls@latest
RUN go install mvdan.cc/gofumpt@latest

RUN mkdir -p /root/.cache/sketch/webui

RUN apk add go || true

# Install DVC as mentioned in README.md
RUN uv pip install --system dvc || true

# Set up Go environment since it's primarily a Go project
ENV GOTOOLCHAIN=auto
ENV GOPATH=/go
ENV PATH="$GOPATH/bin:$PATH"

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="eab53f6f296061461bd8461cbd9a350cb6e6b57a1df1e8bcc902aa5306eba849"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

CMD ["/bin/sketch"]