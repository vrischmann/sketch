FROM ghcr.io/boldsoftware/sketch:8ad6c62da599d2e478ef79d6ef563630

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="06ae0e78aabfa84fc629e6585f6260ec08fb49fc84330a9307173654d41a5628"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Install Python 3.11
RUN apt-get update && apt-get install -y --no-install-recommends python3.11 python3.11-dev python3.11-venv python3-pip || true

# Set up Python environment
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 || true

# Install DVC tool
RUN pip3 install dvc || true

CMD ["/bin/sketch"]
