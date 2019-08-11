FROM homebots-node
RUN cd /home \
  && git clone https://github.com/homebots/relay.git relay \
  && cd relay && npm ci

ENV SOCKET_PORT=3000
ENV HTTP_PORT=3000
ENV SLL=

CMD [ "node", "/home/relay/index.js" ]
