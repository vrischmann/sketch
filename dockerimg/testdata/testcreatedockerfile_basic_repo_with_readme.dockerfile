FROM ghcr.io/boldsoftware/sketch:f5b4ebd9ca15d3dbd2cd08e6e7ab9548

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="1f68d38855871143c58b80c7f052e42141dd82d9a1214074ee734f758f463b8a"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Switch to lenient shell so we are more likely to get past failing extra_cmds.
SHELL ["/bin/bash", "-uo", "pipefail", "-c"]

# Install common development tools
RUN go install github.com/rakyll/gotest@latest || true
RUN go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest || true

# If there's a requirements.txt file for Python deps, install them (continue on error)
RUN if [ -f requirements.txt ]; then pip3 install -r requirements.txt || true; fi

# Switch back to strict shell after extra_cmds.
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

CMD ["/bin/sketch"]
