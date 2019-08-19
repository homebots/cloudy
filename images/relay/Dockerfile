FROM homebots-node
RUN cd /home \
  && git clone https://github.com/homebots/relay.git relay \
  && cd relay \
  && npm ci

ENV SOCKET_PORT=3000
ENV HTTP_PORT=2999
ENV SSL=

CMD [ "node", "/home/relay/index.js" ]
