FROM ghcr.io/boldsoftware/sketch:33392fad8fef8761c0ef3ec098713f00

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="301178240b689140442bd8e7fea6864f93b6a2eb467cb0510c99369c68156657"
COPY . /app
RUN rm -f /app/tmp-sketch-dockerfile

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Switch to lenient shell so we are more likely to get past failing extra_cmds.
SHELL ["/bin/bash", "-uo", "pipefail", "-c"]

RUN if [ -f requirements.txt ]; then pip3 install -r requirements.txt || true; fi

RUN if [ -f package.json ]; then npm install || true; fi

# Install any project-specific linters and tools
RUN go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest || true

# Switch back to strict shell after extra_cmds.
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

CMD ["/bin/sketch"]
