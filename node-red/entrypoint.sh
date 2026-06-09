#!/bin/sh
# Node-RED ボリューム初期化スクリプト
# 初回起動時のみ flows.json をボリュームにコピーする

DEST="/data/flows.json"
SRC="/init/flows.json"

if [ ! -f "$DEST" ]; then
  echo "[init] flows.json が未存在のためコピーします"
  cp "$SRC" "$DEST"
  echo "[init] コピー完了: $DEST"
else
  echo "[init] flows.json は既に存在します（スキップ）"
fi

# Node-RED 本体を起動
exec node-red --userDir /data
