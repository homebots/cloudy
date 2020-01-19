FROM d.homebots.io/v2/homebots-node
ARG CACHEBUST=1
RUN cd /home \
  && git clone https://github.com/homebots/bot-protocol.git app \
  && cd app \
  && npm ci \
  && npm run build

ENV PORT=8017
ENV SSL=

CMD [ "node", "/home/app/index.js" ]
