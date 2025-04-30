FROM ghcr.io/boldsoftware/sketch:8ad6c62da599d2e478ef79d6ef563630

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

RUN go install golang.org/x/tools/cmd/stringer@latest

# Install any potentially useful development tools
RUN apt-get install -y --no-install-recommends gcc build-essential make || true

# Try to setup Python environment if needed
RUN python3 -m pip install --upgrade pip || true

CMD ["/bin/sketch"]
