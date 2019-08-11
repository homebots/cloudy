FROM d.homebots.io/v2/node
RUN cd /home \
  && git clone https://github.com/homebots/relay.git relay \
  && cd relay && npm ci

CMD [ "node", "/home/relay/index.js" ]
