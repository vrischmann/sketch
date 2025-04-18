FROM ghcr.io/astral-sh/uv:python3.11-alpine

RUN apk add bash git make jq sqlite gcc musl-dev linux-headers npm nodejs go github-cli ripgrep fzf

ENV GOTOOLCHAIN=auto
ENV GOPATH=/go
ENV PATH="$GOPATH/bin:$PATH"

RUN go install golang.org/x/tools/cmd/goimports@latest
RUN go install golang.org/x/tools/gopls@latest
RUN go install mvdan.cc/gofumpt@latest

RUN mkdir -p /root/.cache/sketch/webui

RUN apk add go || true

# Install Python requirements and DVC
RUN uv pip install --system dvc || true

# Install any additional Python dependencies if present
RUN if [ -f requirements.txt ]; then uv pip install --system -r requirements.txt || true; fi

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="cae736ee4f2f50e5bdf62697f39cba09beb8ae47c241c3db73df424f6fc03625"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

CMD ["/bin/sketch"]