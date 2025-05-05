FROM ghcr.io/boldsoftware/sketch:f5b4ebd9ca15d3dbd2cd08e6e7ab9548

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="79b4c82f0c892e5f79900afb235c0ab50044626be5d6d43b774f6f5da9537800"
COPY . /app
RUN rm -f /app/tmp-sketch-dockerfile

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Switch to lenient shell so we are more likely to get past failing extra_cmds.
SHELL ["/bin/bash", "-uo", "pipefail", "-c"]

# Install Python 3.11 (if not already the default version) and set it up
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3.11 python3.11-venv python3-pip || true && \
    update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 || true && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install DVC tool as mentioned in README
RUN pip3 install dvc || true

# Switch back to strict shell after extra_cmds.
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

CMD ["/bin/sketch"]
