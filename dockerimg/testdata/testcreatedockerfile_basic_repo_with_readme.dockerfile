FROM ghcr.io/boldsoftware/sketch:f5b4ebd9ca15d3dbd2cd08e6e7ab9548

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="3226456072fc35733ff1b5e0f1a4dfc06bceafcf8824dbbb80face06aa167285"
COPY . /app
RUN rm -f /app/tmp-sketch-dockerfile

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Switch to lenient shell so we are more likely to get past failing extra_cmds.
SHELL ["/bin/bash", "-uo", "pipefail", "-c"]

# No additional commands needed for this simple Go test project
# The base Dockerfile already includes all necessary Go development tools

# Switch back to strict shell after extra_cmds.
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

CMD ["/bin/sketch"]
