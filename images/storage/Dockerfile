FROM d.homebots.io/v2/homebots-node
ARG CACHEBUST=1
RUN cd /home \
  && git clone https://github.com/homebots/jsonstore.git storage \
  && cd storage \
  && npm ci

WORKDIR /home/storage
EXPOSE 3000

CMD [ "./node_modules/.bin/ts-node", "/home/storage/server.ts" ]
