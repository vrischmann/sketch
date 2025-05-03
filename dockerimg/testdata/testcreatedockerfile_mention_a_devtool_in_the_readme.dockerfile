FROM ghcr.io/boldsoftware/sketch:3a03b430af3cabf3415d263b7803b311

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="7af343271500f08da1a4792a6f9a19f1f749495ee67d46ebc61917ca0f56ac1e"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

RUN apt-get update && \
    apt-get install -y --no-install-recommends graphviz || true && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

CMD ["/bin/sketch"]
