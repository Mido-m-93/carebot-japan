#!/bin/bash

# Launchpad Puzzle Games Deployment Script
# Deploy両ゲームをGitHub Pagesにデプロイします

set -e

echo "=== Launchpad Puzzle Games デプロイメント ==="
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "エラー: このディレクトリはGitリポジトリではありません。"
    echo ""
    echo "セットアップ手順:"
    echo "1. GitHub上で新しいリポジトリを作成してください (例: puzzle-games)"
    echo "2. 以下のコマンドを実行してください:"
    echo ""
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m '初期: パズルゲーム'"
    echo "   git branch -M main"
    echo "   git remote add origin https://github.com/your-username/puzzle-games.git"
    echo "   git push -u origin main"
    echo ""
    echo "3. GitHubのリポジトリ設定で以下を実施:"
    echo "   - Settings > Pages"
    echo "   - Source: Deploy from a branch"
    echo "   - Branch: main / root"
    echo "   - Save"
    echo ""
    echo "4. このスクリプトを再実行してください"
    exit 1
fi

# Check if we have the necessary files
if [ ! -f "games/sudoku/index.html" ] || [ ! -f "games/hiragana-match/index.html" ]; then
    echo "エラー: ゲームファイルが見つかりません。"
    echo "games/sudoku/index.html と games/hiragana-match/index.html が必要です。"
    exit 1
fi

echo "ファイルの確認: OK"
echo ""

# Get the git remote URL
REMOTE_URL=$(git config --get remote.origin.url 2>/dev/null || echo "")

if [ -z "$REMOTE_URL" ]; then
    echo "エラー: Gitリモートが設定されていません。"
    echo "以下を実行してください:"
    echo "git remote add origin https://github.com/your-username/puzzle-games.git"
    exit 1
fi

echo "リモート: $REMOTE_URL"
echo ""

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "未コミットの変更があります。"
    echo "以下を実行してください:"
    echo "  git add ."
    echo "  git commit -m 'メッセージ'"
    echo ""
    read -p "続行しますか？ (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "デプロイ用コンテンツ更新 ($(date +'%Y-%m-%d %H:%M:%S'))"
    else
        exit 1
    fi
fi

echo "GitHubにプッシュしています..."
git push origin main

echo ""
echo "=== デプロイメント完了 ==="
echo ""
echo "ゲームのURL:"
echo "  Sudoku: https://$(echo $REMOTE_URL | sed 's/.*[:/]\([^/]*\)\/\(.*\)\.git/\1.github.io\/\2/')/games/sudoku/"
echo "  Hiragana Match: https://$(echo $REMOTE_URL | sed 's/.*[:/]\([^/]*\)\/\(.*\)\.git/\1.github.io\/\2/')/games/hiragana-match/"
echo ""
echo "注意: GitHub Pagesの初回デプロイには数分かかる場合があります。"
echo ""
echo "次のステップ:"
echo "1. Google AdSenseに申し込んでください (adsense-setup.md を参照)"
echo "2. AdSenseコードをHTMLファイルに挿入してください"
echo "3. Google Analytics / Search Consoleを設定してください"
echo "4. トラフィック戦略を実施してください (README.md を参照)"
