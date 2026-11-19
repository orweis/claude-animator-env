#!/bin/bash
# usage: render_chunk.sh <k>  -> out/factory/chunk_<k>.mp4, frames k*460 .. k*460+459 (last chunk to 2299)
set -e
cd ~/remotion-shorts
k=$1; a=$((k*460)); b=$((a+459)); [ $b -gt 2299 ] && b=2299
export TEMP=/tmp/claude-0/-home-user-claude-animator-env/521c6cdb-797d-5252-82ed-bbabeacd9c5c/scratchpad/rtmp TMP=$TEMP
s=$(date +%s)
npx remotion render src/index.ts FactoryShort out/factory/chunk_$k.mp4 --frames=$a-$b --scale=1.3333333333333333 --gl=swangle \
  --browser-executable=/opt/pw-browsers/chromium --timeout=300000 --codec=h264 --crf=16 --log=error 2>&1 | grep -vE "^\s+at |404|Failed to load|memory|CGroup|meminfo|docker|lower amount" | tail -5
echo "chunk $k frames $a-$b done in $(( $(date +%s) - s )) s"
