FROM ghcr.io/boldsoftware/sketch:538be6f879a81c5caca6bc08e5c2097c

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="d27408dab7235a7280709f1023a865867040b21a41ebfbe40272ad4447895482"
COPY . /app
RUN rm -f /app/tmp-sketch-dockerfile

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Switch to lenient shell so we are more likely to get past failing extra_cmds.
SHELL ["/bin/bash", "-uo", "pipefail", "-c"]

RUN apt-get update && apt-get install -y --no-install-recommends software-properties-common || true
RUN add-apt-repository ppa:deadsnakes/ppa || true
RUN apt-get update && apt-get install -y --no-install-recommends python3.11 python3.11-pip python3.11-venv || true
RUN python3.11 -m pip install --upgrade pip || true
RUN python3.11 -m pip install dvc || true

# Switch back to strict shell after extra_cmds.
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

CMD ["/bin/sketch"]
