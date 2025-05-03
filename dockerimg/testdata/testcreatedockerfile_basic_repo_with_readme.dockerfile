FROM ghcr.io/boldsoftware/sketch:3a03b430af3cabf3415d263b7803b311

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME" && \
    git config --global http.postBuffer 524288000

LABEL sketch_context="f6830cad46a9b0d71acb50ff81972f4494fe1a9d90869544b692bc26dd43adfb"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

# No additional setup required for this simple Go test project

CMD ["/bin/sketch"]
