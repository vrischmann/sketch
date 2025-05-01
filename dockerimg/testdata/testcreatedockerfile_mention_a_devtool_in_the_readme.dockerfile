FROM ghcr.io/boldsoftware/sketch:8ad6c62da599d2e478ef79d6ef563630

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="fc9dd68c203618c0f878c9e10883e960cd88654a9a183f09f02db495ac0fb20a"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

RUN apt-get install -y --no-install-recommends graphviz || true

CMD ["/bin/sketch"]
