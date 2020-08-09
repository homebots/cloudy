FROM d.homebots.io/v2/homebots-nginx

ARG GIT_URL
ARG CACHEBUSTER

RUN [[ "${GIT_URL}" != "" ]] \
  && rm -rf /usr/share/nginx/html \
  && git clone --depth 1 ${GIT_URL} /usr/share/nginx/html \
  && rm -rf /usr/share/nginx/html/.git
