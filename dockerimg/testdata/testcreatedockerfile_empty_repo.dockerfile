FROM golang:1.24.2-alpine3.21

RUN apk add bash git make jq sqlite gcc musl-dev linux-headers npm nodejs go github-cli ripgrep fzf python3 curl vim

ENV GOTOOLCHAIN=auto
ENV GOPATH=/go
ENV PATH="$GOPATH/bin:$PATH"

RUN go install golang.org/x/tools/cmd/goimports@latest
RUN go install golang.org/x/tools/gopls@latest
RUN go install mvdan.cc/gofumpt@latest

RUN mkdir -p /root/.cache/sketch/webui

RUN apk add --no-cache ca-certificates && \
    update-ca-certificates

# Set up Go environment variables
ENV CGO_ENABLED=1
ENV GO111MODULE=on

# Install any additional dependencies if needed
RUN apk add --no-cache openssh-client || true

# Create necessary directories
RUN mkdir -p /root/.config/gh

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="ecacc023382f310d25253734931f73bdfa48bd71cd92bd2c3ae1a6099ce5eb40"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

CMD ["/bin/sketch"]