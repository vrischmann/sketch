FROM ghcr.io/boldsoftware/sketch:3a03b430af3cabf3415d263b7803b311

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="2c865c897e88f0bc021007a21d2ed036f3918b5e8b9dbbd5708662980afb4ee6"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# Install Python 3.11 and DVC as required by the project
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3.11 python3.11-venv python3-pip || true && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install DVC
RUN pip3 install dvc || true

CMD ["/bin/sketch"]
