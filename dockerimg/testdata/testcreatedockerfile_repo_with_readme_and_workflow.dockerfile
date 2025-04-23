FROM golang:1.24.2-alpine3.21

RUN apk add bash git make jq sqlite gcc musl-dev linux-headers npm nodejs go github-cli ripgrep fzf python3 curl vim

ENV GOTOOLCHAIN=auto
ENV GOPATH=/go
ENV PATH="$GOPATH/bin:$PATH"

RUN go install golang.org/x/tools/cmd/goimports@latest
RUN go install golang.org/x/tools/gopls@latest
RUN go install mvdan.cc/gofumpt@latest

RUN mkdir -p /root/.cache/sketch/webui

RUN npm install -g corepack && corepack enable || true

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="3e95953d80d7eb73175a05c7d1499dc9a0fc5e7afdbcc0ae59d26aafffa8eb66"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

CMD ["/bin/sketch"]