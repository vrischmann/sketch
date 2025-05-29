FROM ghcr.io/boldsoftware/sketch:a73fec46b81f26cba546a2f4c44ff381

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="1d1c9c1f11f73ce13926ecb7fd8d24b37aae41a512a3a8e181fb4edbea523931"
COPY . /app
RUN rm -f /app/tmp-sketch-dockerfile

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Switch to lenient shell so we are more likely to get past failing extra_cmds.
SHELL ["/bin/bash", "-uo", "pipefail", "-c"]

RUN apt-get update && apt-get install -y --no-install-recommends python3.11 python3.11-pip python3.11-venv || true && apt-get clean && rm -rf /var/lib/apt/lists/*
RUN python3.11 -m pip install --no-cache-dir dvc || true

# Switch back to strict shell after extra_cmds.
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

CMD ["/bin/sketch"]
