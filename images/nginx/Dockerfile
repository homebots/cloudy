FROM d.homebots.io/v2/nginx

ARG GIT_URL
ARG GIT_BRANCH
ARG CACHEBUSTER

RUN [[ "${GIT_URL}" != "" ]] \
  && rm -rf /usr/share/nginx/html \
  && git clone --depth 1 ${GIT_URL} -b ${GIT_BRANCH} /usr/share/nginx/html \
  && rm -rf /usr/share/nginx/html/.git

WORKDIR /usr/share/nginx/html

