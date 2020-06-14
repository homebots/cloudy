# set -xe

git clone --depth 1 "$GIT_URL" /home/node/app
cd /home/node/app
npm ci
(npm run build || true)
npm start
