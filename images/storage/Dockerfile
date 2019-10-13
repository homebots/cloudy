FROM homebots-node
RUN cd /home \
  && git clone https://github.com/homebots/jsonstore.git store \
  && cd store \
  && npm ci

CMD [ "ts-node", "/home/store/server.ts" ]
