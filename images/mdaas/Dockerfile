FROM d.homebots.io/v2/homebots-node
ARG CACHEBUST=1
RUN cd /home \
  && git clone https://github.com/homebots/mdaas.git app \
  && cd app \
  && npm ci

ENV PORT=8888
ENV SSL=

CMD [ "node", "/home/app/index.js" ]
