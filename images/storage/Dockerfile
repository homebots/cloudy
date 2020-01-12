FROM homebots-node
ARG CACHEBUST=1
RUN cd /home \
  && git clone https://github.com/homebots/jsonstore.git storage \
  && cd storage \
  && npm ci

WORKDIR /home/storage

CMD [ "./node_modules/.bin/ts-node", "/home/storage/server.ts" ]
