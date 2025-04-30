FROM ghcr.io/boldsoftware/sketch:v1

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="2cfc5f8464b9aac599944b68917667ab7dd772029852cec23324f6e6b144ba70"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

RUN apk add --no-cache bash git make jq sqlite gcc musl-dev linux-headers npm nodejs go github-cli ripgrep fzf python3 curl vim grep || true

CMD ["/bin/sketch"]
