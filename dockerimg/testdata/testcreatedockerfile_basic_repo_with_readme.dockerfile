FROM ghcr.io/boldsoftware/sketch:8ad6c62da599d2e478ef79d6ef563630

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="afa0b82fd799233b6a1a96e027ea08f77f5727c5565b49d4455d3f58b19b3d8d"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# No additional setup required for this simple Go test project

CMD ["/bin/sketch"]
