FROM ghcr.io/boldsoftware/sketch:33392fad8fef8761c0ef3ec098713f00

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="7e1f552b9580950cbed404c55363e639b1a653106d13b5d0a8d1977312f9aa73"
COPY . /app
RUN rm -f /app/tmp-sketch-dockerfile

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Switch to lenient shell so we are more likely to get past failing extra_cmds.
SHELL ["/bin/bash", "-uo", "pipefail", "-c"]

RUN apt-get update && apt-get install -y --no-install-recommends graphviz || true

# Switch back to strict shell after extra_cmds.
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

CMD ["/bin/sketch"]
