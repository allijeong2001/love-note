#!/usr/bin/env bash
# 把网页文件同步进 Android 工程的 assets（GitHub Actions 和本地都能用）
set -e
cd "$(dirname "$0")"

DEST="android/app/src/main/assets/www"
rm -rf "$DEST"
mkdir -p "$DEST/js"

cp index.html home.html chat.html note.html timer.html music.html \
   moments.html letter.html settings.html \
   style.css player.js config.js "$DEST"/

cp js/store.js js/cards.js js/avatar.js js/shell.js js/stickers.js "$DEST"/js/

echo "网页文件已同步到 $DEST"
