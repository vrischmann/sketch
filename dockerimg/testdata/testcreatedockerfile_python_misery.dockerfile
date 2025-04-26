FROM ghcr.io/astral-sh/uv:python3.11-alpine

RUN apk add bash git make jq sqlite gcc musl-dev linux-headers npm nodejs go github-cli ripgrep fzf python3 curl vim

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

LABEL sketch_context="1e26552a9d39a0cdaacc7efdcb4d9dd0f94b2d041bb583c3214f0c02be93c89f"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

RUN apk add go || true
# Install DVC tool as mentioned in the README
RUN uv pip install --system dvc || true

# Ensure git is properly configured for DVC
RUN git config --global init.defaultBranch main || true

CMD ["/bin/sketch"]
