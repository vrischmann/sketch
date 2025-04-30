FROM ghcr.io/boldsoftware/sketch:v1

ARG GIT_USER_EMAIL
ARG GIT_USER_NAME

RUN git config --global user.email "$GIT_USER_EMAIL" && \
    git config --global user.name "$GIT_USER_NAME"

LABEL sketch_context="17320ef95f67844208ac1b3e00f1f4dd0951e229517619bdbc8085eba3a7e067"
COPY . /app

WORKDIR /app
RUN if [ -f go.mod ]; then go mod download; fi

RUN apk add --no-cache python3 py3-pip || true
RUN pip3 install --upgrade pip || true

CMD ["/bin/sketch"]
