FROM ghcr.io/boldsoftware/sketch:f5b4ebd9ca15d3dbd2cd08e6e7ab9548

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="26cda6870ba9562802f4a56d488b5f48d95d8ec7834ba62f043bbd50a2a18c1e"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Switch to lenient shell so we are more likely to get past failing extra_cmds.
SHELL ["/bin/bash", "-uo", "pipefail", "-c"]

# Install Python 3.11 and pip
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3.11 python3.11-dev python3.11-venv python3-pip || true

# Set up Python alternatives to make 3.11 the default
RUN if command -v update-alternatives &> /dev/null; then \
      update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 || true; \
    fi

# Install DVC tool
RUN pip3 install dvc || true

# Clean up apt cache
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Switch back to strict shell after extra_cmds.
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

CMD ["/bin/sketch"]
