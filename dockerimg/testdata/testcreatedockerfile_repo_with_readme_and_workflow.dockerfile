FROM ghcr.io/boldsoftware/sketch:3a03b430af3cabf3415d263b7803b311

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="c07d7ee5f43192e235d71ecc6f1579b74bb669f20482e4768b86edd06b59271a"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Install Node.js specific tools based on workflow file
RUN npm install -g corepack && corepack enable || true

# Run tests to verify setup
RUN if [ -f go.mod ]; then go test ./... || true; fi

CMD ["/bin/sketch"]
