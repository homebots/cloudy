DOCKER_BASE="d.homebots.io/v2"

images=`ls -1 images/`
for image in $images; do
  (cd images/$image && source .env && docker build -t $DOCKER_BASE/$DOCKER_IMAGE . && docker push $DOCKER_BASE/$DOCKER_IMAGE)
done
