FROM ghcr.io/boldsoftware/sketch:99a2e4afe316b3c6cf138830dbfb7796

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="731625e8ccb108e34ec80ec82ad2eff3d65cd962c13cc9a33e3456d828b48b65"
COPY . /app
RUN rm -f /app/tmp-sketch-dockerfile

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Switch to lenient shell so we are more likely to get past failing extra_cmds.
SHELL ["/bin/bash", "-uo", "pipefail", "-c"]

RUN go mod tidy || true

# Install any Python dependencies if a requirements.txt exists, but continue on failure
RUN if [ -f requirements.txt ]; then pip3 install -r requirements.txt || true; fi

# Install any npm dependencies if package.json exists
RUN if [ -f package.json ]; then npm install || true; fi

# Install additional tools that might be useful for Go development
RUN go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest || true

# Install any additional needed packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    make \
    protobuf-compiler \
    || true

# Switch back to strict shell after extra_cmds.
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

CMD ["/bin/sketch"]
