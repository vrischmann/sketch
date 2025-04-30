FROM ghcr.io/boldsoftware/sketch:8ad6c62da599d2e478ef79d6ef563630

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

RUN npm install -g corepack && corepack enable
RUN go test ./... || true

CMD ["/bin/sketch"]
