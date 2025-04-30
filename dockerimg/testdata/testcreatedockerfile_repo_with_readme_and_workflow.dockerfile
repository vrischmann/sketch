FROM ghcr.io/boldsoftware/sketch:v1

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="8f895f63fac0092de6bca4d6d9db358659720fc653b500b097761b558decb1de"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

RUN npm install -g corepack && corepack enable || true

CMD ["/bin/sketch"]
