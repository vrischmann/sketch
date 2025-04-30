FROM ghcr.io/boldsoftware/sketch:v1

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="485cdfc1a8195b86dabf60d2f857498b190bc51c8b0b6b358ce5e26e34514e86"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

RUN apk add graphviz || true

CMD ["/bin/sketch"]
