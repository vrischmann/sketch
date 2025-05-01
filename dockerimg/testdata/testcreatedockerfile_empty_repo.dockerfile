FROM ghcr.io/boldsoftware/sketch:8ad6c62da599d2e478ef79d6ef563630

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="8680db4c498365658a6e773fde0d43f642ae6744f41a14ad6d01e9eae7064f65"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Install any Python dependencies but continue on error
RUN if [ -f requirements.txt ]; then pip3 install -r requirements.txt || true; fi

# Setup Go environment properly
RUN if [ -f go.sum ]; then go mod tidy || true; fi

# Make sure build scripts are executable
RUN find . -name "*.sh" -exec chmod +x {} \; || true

CMD ["/bin/sketch"]
