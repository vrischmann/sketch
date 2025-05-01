FROM ghcr.io/boldsoftware/sketch:8ad6c62da599d2e478ef79d6ef563630

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="3d03f73f3537490cbbce6b19d529404113eefbf09d3b77bbc1c05c35505b44fb"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

RUN npm install -g corepack && corepack enable || true

# If there are package.json files, install dependencies
RUN find . -name "package.json" -maxdepth 3 -execdir npm install \; || true

CMD ["/bin/sketch"]
