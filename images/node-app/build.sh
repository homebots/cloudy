# set -xe

git clone --depth 1 "$1" /home/node/app
cd /home/node/app
npm ci
(npm run build || true)
