FROM ghcr.io/boldsoftware/sketch:a73fec46b81f26cba546a2f4c44ff381

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="a3bd8846442c78a988c7ff949506cbf1c78c470af9c2b36d37672c015052df39"
COPY . /app
RUN rm -f /app/tmp-sketch-dockerfile

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Switch to lenient shell so we are more likely to get past failing extra_cmds.
SHELL ["/bin/bash", "-uo", "pipefail", "-c"]



# Switch back to strict shell after extra_cmds.
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]

CMD ["/bin/sketch"]
