FROM ghcr.io/boldsoftware/sketch:33392fad8fef8761c0ef3ec098713f00

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="32f3dfaaf9794fb866df21522ace42c3d6c9f5664a7edd77e0a90daf57c315ba"
COPY . /app
RUN rm -f /app/tmp-sketch-dockerfile

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Switch to lenient shell so we are more likely to get past failing extra_cmds.
SHELL ["/bin/bash", "-uo", "pipefail", "-c"]

RUN echo "Go test project environment ready" || true

# Switch back to strict shell after extra_cmds.
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

CMD ["/bin/sketch"]
