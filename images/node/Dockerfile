FROM d.homebots.io/v2/node-app

ARG GIT_URL
ARG CACHEBUSTER

ENV RESTART_INTERVAL=5000

RUN [[ "${GIT_URL}" != "" ]] && bash /home/node/entrypoint.sh build ${GIT_URL};