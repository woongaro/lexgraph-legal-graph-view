#!/bin/bash
# LexGraph → Obsidian 볼트 빠른 배포 스크립트
# 사용법: ./scripts/deploy-to-vault.sh

VAULT_PLUGIN_DIR="/Users/woongaro/MyProjects/test11/vault/test-vault/.obsidian/plugins/lexgraph-legal-graph-view"
SRC_DIR="/Users/woongaro/MyProjects/infranodus-obsidian-plugin-master"

echo "빌드 중..."
cd "$SRC_DIR" && npm run build 2>&1

if [ $? -ne 0 ]; then
  echo "빌드 실패"
  exit 1
fi

echo "배포 중 → $VAULT_PLUGIN_DIR"
mkdir -p "$VAULT_PLUGIN_DIR"
cp "$SRC_DIR/main.js"      "$VAULT_PLUGIN_DIR/"
cp "$SRC_DIR/styles.css"   "$VAULT_PLUGIN_DIR/"
cp "$SRC_DIR/manifest.json" "$VAULT_PLUGIN_DIR/"

echo "완료. Obsidian에서 플러그인을 재로드하세요:"
echo "  설정 → 커뮤니티 플러그인 → LexGraph → 비활성화 후 재활성화"
echo "  또는: Ctrl+Shift+I 콘솔에서 app.plugins.plugins['lexgraph-legal-graph-view'].load()"
