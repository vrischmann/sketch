FROM ghcr.io/boldsoftware/sketch:82c32883426c519eada7250c0017e6b7

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="be15efa1d150735bb7ebd1cd8d9dee577f7bbad44e540822deb20a57988cbe1f"
COPY . /app
RUN rm -f /app/tmp-sketch-dockerfile

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Switch to lenient shell so we are more likely to get past failing extra_cmds.
SHELL ["/bin/bash", "-uo", "pipefail", "-c"]

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-dev python3.11-venv python3-pip-whl || true && \
    apt-get clean && rm -rf /var/lib/apt/lists/* || true

RUN python3.11 -m pip install --upgrade pip setuptools wheel || true
RUN python3.11 -m pip install dvc || true

# Switch back to strict shell after extra_cmds.
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

CMD ["/bin/sketch"]
