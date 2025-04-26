FROM ghcr.io/boldsoftware/sketch:v1

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="a8fa928cd209a4990326ce7f0996bc72ce496d9fb09d69c6409923f6773285ec"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

RUN npm install -g corepack || true
RUN corepack enable || true

CMD ["/bin/sketch"]
