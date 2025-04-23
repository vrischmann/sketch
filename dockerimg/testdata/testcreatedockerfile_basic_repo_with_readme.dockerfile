FROM golang:1.24.2-alpine3.21

RUN apk add bash git make jq sqlite gcc musl-dev linux-headers npm nodejs go github-cli ripgrep fzf python3 curl vim

ENV GOTOOLCHAIN=auto
ENV GOPATH=/go
ENV PATH="$GOPATH/bin:$PATH"

RUN go install golang.org/x/tools/cmd/goimports@latest
RUN go install golang.org/x/tools/gopls@latest
RUN go install mvdan.cc/gofumpt@latest

RUN mkdir -p /root/.cache/sketch/webui

RUN apk add --no-cache build-base || true

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="f20a1b665182f3a8a94fe3e1e2042ee1d820fe00af69c72989146e26de9569ba"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

CMD ["/bin/sketch"]