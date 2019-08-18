images=`ls -1 images/`

for image in $images; do
   docker build --no-cache -t homebots-$image images/$image
done
