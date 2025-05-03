FROM ghcr.io/boldsoftware/sketch:3a03b430af3cabf3415d263b7803b311

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="7f08d4359542e0a924280791b6d7baae3480d3878b309e30eaf24d291b41e1df"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

RUN set -eux; \
    # Install any Python dependencies if applicable, continuing on failure
    if [ -f requirements.txt ]; then pip3 install -r requirements.txt || true; fi

# Ensure sketch binary is available
RUN if [ ! -f /bin/sketch ]; then ln -s /app/sketch /bin/sketch || true; fi

CMD ["/bin/sketch"]
