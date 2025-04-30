FROM ghcr.io/astral-sh/uv:python3.11-alpine

RUN apk add bash git make jq sqlite gcc musl-dev linux-headers npm nodejs go github-cli ripgrep fzf python3 curl vim grep

ENV GOTOOLCHAIN=auto
ENV GOPATH=/go
ENV PATH="$GOPATH/bin:$PATH"

RUN go install golang.org/x/tools/cmd/goimports@latest
RUN go install golang.org/x/tools/gopls@latest
RUN go install mvdan.cc/gofumpt@latest

RUN mkdir -p /root/.cache/sketch/webui

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="7010851bfbb48df3a934ebc3eeff896d406d5f37c6a04d82a5ccdf403374d055"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

RUN apk add go || true

# Install DVC as mentioned in the README
RUN uv pip install --system dvc || true

# Make sure Go tools are still installed in this Python-based image
RUN go install golang.org/x/tools/cmd/goimports@latest || true
RUN go install golang.org/x/tools/gopls@latest || true
RUN go install mvdan.cc/gofumpt@latest || true

CMD ["/bin/sketch"]
