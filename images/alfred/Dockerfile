FROM nginx:alpine
WORKDIR /home/alfred
ARG CACHEBUSTER

RUN apk add unzip wget \
  && wget --no-verbose -q -O alfred.zip https://github.com/homebots/alfred/archive/master.zip \
  && unzip -qq alfred.zip \
  && rm alfred.zip \
  && rm -rf /usr/share/nginx/html \
  && ln -s /home/alfred/alfred-master/app /usr/share/nginx/html \
  && wget https://raw.githubusercontent.com/homebots/bot-protocol/master/index.js -q -O /usr/share/nginx/html/protocol.js
