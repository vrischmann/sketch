FROM golang:1.24.2-alpine3.21

RUN apk add bash git make jq sqlite gcc musl-dev linux-headers npm nodejs go github-cli ripgrep fzf

ENV GOTOOLCHAIN=auto
ENV GOPATH=/go
ENV PATH="$GOPATH/bin:$PATH"

RUN go install golang.org/x/tools/cmd/goimports@latest
RUN go install golang.org/x/tools/gopls@latest
RUN go install mvdan.cc/gofumpt@latest

RUN mkdir -p /root/.cache/sketch/webui

RUN apk add --no-cache curl vim nano || true

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="b68650fb5536cd5049bcf01e464d6c2078d232ab2bb6b42cac5ad86a09363e9b"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

CMD ["/bin/sketch"]