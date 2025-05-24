FROM ghcr.io/boldsoftware/sketch:33392fad8fef8761c0ef3ec098713f00

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="d1a2565ff3402ed91077dff3b4fee531722ad1651156d8178a3920acd41a4f92"
COPY . /app
RUN rm -f /app/tmp-sketch-dockerfile

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Switch to lenient shell so we are more likely to get past failing extra_cmds.
SHELL ["/bin/bash", "-uo", "pipefail", "-c"]

RUN apt-get update && apt-get install -y --no-install-recommends python3.11 python3.11-venv python3.11-dev python3-pip || true
RUN python3.11 -m pip install --upgrade pip || true
RUN python3.11 -m pip install dvc || true

# Switch back to strict shell after extra_cmds.
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

CMD ["/bin/sketch"]
