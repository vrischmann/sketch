FROM ghcr.io/boldsoftware/sketch:f5b4ebd9ca15d3dbd2cd08e6e7ab9548

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="852a43dfbf76c6272f41ade86ac1b4567acb77141edfec6c1df20b07a4758d1a"
COPY . /app
RUN rm -f /app/tmp-sketch-dockerfile

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Switch to lenient shell so we are more likely to get past failing extra_cmds.
SHELL ["/bin/bash", "-uo", "pipefail", "-c"]

# Install any Go tools that might be useful for development
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest || true
go install github.com/rakyll/gotest@latest || true

# Install Python dependencies if needed (with error handling)
if [ -f requirements.txt ]; then
    pip3 install -r requirements.txt || true
fi

# If Makefile exists, run make prepare or similar setup target
if [ -f Makefile ]; then
    grep -q "prepare:" Makefile && make prepare || true
fi

# Switch back to strict shell after extra_cmds.
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

CMD ["/bin/sketch"]
