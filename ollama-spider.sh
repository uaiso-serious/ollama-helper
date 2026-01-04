#!/bin/bash

mkdir -p models

curl "https://ollama.com/search?o=newest" > models/001_search.html
grep "href=\"/library/" models/001_search.html | grep -oP 'href="\K[^"]+' > models/002_search_links.html

while read -r link; do
  curl "https://ollama.com${link}/tags" > models/$(basename "${link}")-tags.html
done < models/002_search_links.html

for file in models/*-tags.html; do
  raw_date=$(grep -oP 'title="\K[A-Z][a-z]{2} [ 0-9]{1,2}, [0-9]{4}' "$file" | head -n1)
  if [[ -n "$raw_date" ]]; then
    date_fmt=$(date -d "$raw_date" +%Y-%m-%d 2>/dev/null)
  else
    date_fmt=""
  fi

  xmllint --html --xpath "//div[contains(@class,'group')]/div[@class='hidden md:flex flex-col space-y-[6px]']/div[@class='grid grid-cols-12 items-center']" "$file" 2>/dev/null \
  | xmllint --html --xpath "//a/text() | //p[@class='col-span-2 text-neutral-500 text-[13px]']/text()" - 2>/dev/null \
  | awk 'ORS=NR%3?",":"\n"' \
  | sed 's/,$//' \
  | awk -v fname="$(basename "$file" -tags.html)" 'BEGIN{FS=",";OFS=","} {print fname,$1,$2,$3}' > models/tmp1.csv

  tags=$(xmllint --html --xpath "//div[contains(@class,'flex flex-wrap space-x-2')]" "$file" 2>/dev/null \
    | grep -oP '<span[^>]*>[^<]*</span>' \
    | sed -E 's/<[^>]+>//g' \
    | paste -sd'|' -)

  awk -v tags="$tags" -v date="$date_fmt" -F, 'BEGIN{OFS=","} {print $0, tags, date}' models/tmp1.csv >> models/tmp.csv
done

echo "model,name,size,context,tags,date" > docs/models.csv
awk -F, '{
  size=$3;
  if(size ~ /TB/) val=substr(size,1,length(size)-2)*1024*1024*1024*1024;
  else if(size ~ /GB/) val=substr(size,1,length(size)-2)*1024*1024*1024;
  else if(size ~ /MB/) val=substr(size,1,length(size)-2)*1024*1024;
  else val=size;
  $3=val;

  ctx=$4;
  if(ctx ~ /M/) ctxval=substr(ctx,1,length(ctx)-1)*1000*1000;
  else if(ctx ~ /K/) ctxval=substr(ctx,1,length(ctx)-1)*1000;
  else ctxval=ctx;
  $4=ctxval;

  OFS=","; printf "%s,%s,%d,%d,%s,%s\n", $1, $2, $3, $4, $5, $6
}' models/tmp.csv | sort -u >> docs/models.csv
