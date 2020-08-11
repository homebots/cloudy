FROM d.homebots.io/v2/node-app

ARG GIT_URL
ARG CACHEBUSTER

RUN [[ "${GIT_URL}" != "" ]] && bash /home/node/entrypoint.sh build ${GIT_URL};