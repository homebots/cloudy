images=`ls -1 images/`

for image in $images; do
  (cd images/$image && docker build -t homebots-$image .)
done
