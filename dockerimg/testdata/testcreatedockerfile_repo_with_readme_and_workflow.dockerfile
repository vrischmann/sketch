FROM ghcr.io/boldsoftware/sketch:f5b4ebd9ca15d3dbd2cd08e6e7ab9548

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="c0828a2b9bfbd0484300d9e371121aaf027862652780c0b007a154ae6bbaf6bc"
COPY . /app
RUN rm -f /app/tmp-sketch-dockerfile

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Switch to lenient shell so we are more likely to get past failing extra_cmds.
SHELL ["/bin/bash", "-uo", "pipefail", "-c"]

RUN npm install -g corepack && corepack enable || true

# If there are any Python dependencies, install them in a way that doesn't fail build
RUN if [ -f requirements.txt ]; then pip3 install -r requirements.txt || true; fi

# Switch back to strict shell after extra_cmds.
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

CMD ["/bin/sketch"]
