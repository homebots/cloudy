FROM node:lts-alpine

RUN sed -i -e 's/^root::/root:!:/' /etc/shadow
ENV HOME=/home/node
WORKDIR /home/node
ADD conf/.npmrc /home/node
RUN set -xe && apk add --no-cache bash git openssh && npm i -g nodemon
ENV PATH "$PATH:/home/node/npm/bin"
