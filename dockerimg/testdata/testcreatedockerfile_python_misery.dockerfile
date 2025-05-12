FROM ghcr.io/boldsoftware/sketch:99a2e4afe316b3c6cf138830dbfb7796

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="7c933e98fc1d5fd35f964b6cf115bcf65b580c378069d078ab66723b2b1073c4"
COPY . /app
RUN rm -f /app/tmp-sketch-dockerfile

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Switch to lenient shell so we are more likely to get past failing extra_cmds.
SHELL ["/bin/bash", "-uo", "pipefail", "-c"]

RUN apt-get update && apt-get install -y python3.11 python3-pip || true

# Install DVC (Data Version Control)
RUN pip3 install --no-cache-dir dvc || true

# Clean up apt cache to keep image smaller
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Switch back to strict shell after extra_cmds.
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

CMD ["/bin/sketch"]
