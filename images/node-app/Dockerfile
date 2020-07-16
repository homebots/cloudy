FROM d.homebots.io/v2/homebots-node

WORKDIR /home/node/
ADD build.sh ./
ADD run.sh ./

RUN chmod a+x *.sh && npm i -g pm2

WORKDIR /home/node/app

ENTRYPOINT ["/bin/bash", "/home/node/run.sh" ]
