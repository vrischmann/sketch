FROM ghcr.io/boldsoftware/sketch:v1

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="c94b5070bcccf737554bc3e44eea559cf127c86b33d80218f3a1689411fab529"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

RUN apk add --no-cache build-base || true

CMD ["/bin/sketch"]
