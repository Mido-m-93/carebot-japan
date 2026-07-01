# Launchpad Puzzle Games

**30-Day AdSense Monetization Experiment with 2 HTML5 Casual Games**

This project is an experiment to generate revenue from casual games hosted on GitHub Pages using Google AdSense. The goal is to measure RPM and traffic patterns within 30 days.

---

## Project Overview

### Game 1: Sudoku Puzzle

- **URL**: `/games/sudoku/index.html`
- **Features**:
  - Full JavaScript Sudoku puzzle generator
  - 3 difficulty levels (Easy/Medium/Hard)
  - Hint feature
  - Timer
  - Error counter
  - Full mobile support

### Game 2: Hiragana Match (Memory Game)

- **URL**: `/games/hiragana-match/index.html`
- **Features**:
  - Memory card game (Hiragana ↔ Romanji)
  - 3 difficulty levels
  - Timer and score system
  - Full mobile support
  - Japanese aesthetic design (minimalist and refined)

### Target Audience

- **Language**: Japanese language users
- **Platform**: Desktop, tablet, and smartphone compatible
- **Monetization**: Google AdSense
- **Hosting**: GitHub Pages (free)

---

## Quick Start

### ステップ1: リポジトリのセットアップ

```bash
# このディレクトリをGitリポジトリとして初期化
git init
git add .
git commit -m "初期: パズルゲーム"
git branch -M main

# GitHubにリモートを追加 (your-usernameを自分のGitHubユーザー名に置き換え)
git remote add origin https://github.com/your-username/puzzle-games.git
git push -u origin main
```

### ステップ2: GitHub Pages有効化

1. GitHub.com でリポジトリにアクセス
2. **Settings** → **Pages**
3. **Source** で **Deploy from a branch** を選択
4. **Branch**: `main`, **Folder**: `/root` を選択
5. **Save** をクリック

**数分後、ゲームが以下のURLで利用可能になります:**
```
https://your-username.github.io/puzzle-games/games/sudoku/
https://your-username.github.io/puzzle-games/games/hiragana-match/
```

### ステップ3: デプロイスクリプトで自動デプロイ

```bash
# スクリプトに実行権限を付与
chmod +x deploy.sh

# 実行
./deploy.sh
```

このスクリプトは:
- ファイルをチェック
- Gitリモートを確認
- コミット・プッシュを自動化
- デプロイ完了後にURLを表示

---

## AdSense Integration

### 基本セットアップ

詳細な手順は `adsense-setup.md` を参照してください。

```bash
cat adsense-setup.md
```

### クイック統合手順

1. **AdSense アカウント作成**
   - https://www.google.com/adsense にアクセス
   - Googleアカウントでログイン
   - サイト情報を登録

2. **承認タグを挿入**

   両ゲームの `<head>` セクションに追加:

   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-YOUR_PUBLISHER_ID"
        crossorigin="anonymous"></script>
   ```

3. **広告ユニットコードを挿入**

   各ゲームの既存プレースホルダー (ファイル末尾付近) を置換:

   ```html
   <div style="text-align: center; margin-top: 25px; min-height: 300px;">
     <ins class="adsbygoogle"
          style="display:block; text-align:center;"
          data-ad-layout="in-article"
          data-ad-format="fluid"
          data-ad-client="ca-pub-YOUR_PUBLISHER_ID"
          data-ad-slot="YOUR_AD_SLOT_ID"></ins>
     <script>
       (adsbygoogle = window.adsbygoogle || []).push({});
     </script>
   </div>
   ```

4. **デプロイ**

   ```bash
   git add games/sudoku/index.html games/hiragana-match/index.html
   git commit -m "追加: Google AdSense統合"
   git push
   ```

---

## Traffic Strategy

### フェーズ1: 基礎構築 (週1-2)

**目標**: 1日500-1000セッション

```
実施項目:
✓ Google Search Console登録
  - https://search.google.com/search-console
  - サイトマップ送信
  - キーワード監視

✓ Google Analytics設定
  - https://analytics.google.com
  - トラッキングコード挿入
  - 基本的なゴール設定

✓ メタタグ最適化
  - タイトルにキーワード含有
  - ディスクリプション最適化
  - OpenGraph設定 (SNS シェア対応)

✓ robots.txt / sitemap.xml
```

**HTMLメタタグ例:**

```html
<head>
  <meta name="description" content="無料の数独パズルゲーム。日本語UI、難易度選択機能、ヒント機能付き。">
  <meta property="og:title" content="数独パズル - 無料でプレイできるJavaScript">
  <meta property="og:description" content="かんたん、ふつう、むずかしいの3段階難易度。タイマー機能搭載。">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://your-username.github.io/puzzle-games/games/sudoku/">
  <meta property="og:image" content="https://your-username.github.io/puzzle-games/og-image.png">
</head>
```

### フェーズ2: トラフィック拡大 (週3-4)

**目標**: 1日2000-5000セッション

```
SNS戦略:
- Twitter
  投稿: "#数独 #JavaScriptゲーム #無料ゲーム"
  頻度: 週3-5回
  内容: ゲームプレイスクリーンショット、スコア投稿

- TikTok
  投稿: ゲームプレイ動画 (15-30秒)
  BGM: 日本の流行曲
  ハッシュタグ: #ゲーム #数独 #ひらがな

- Instagram
  投稿: 美しいゲームスクリーンショット
  ストーリーズ: 日替わりチャレンジ

- Reddit / 掲示板
  投稿: r/LearnJapanese, r/Games
  フォーラム: 2channel, 5channel (関連スレッド)

外部リンク獲得:
- GameJam の公開プロジェクト登録
- テックブログ/ゲームブログへの掲載依頼
- ゲーム紹介サイト登録 (Itch.io など)
```

### フェーズ3: 最適化と成長 (週5+)

**目標**: 1日5000セッション以上

```
A/Bテスト:
- 広告サイズ (336x280 vs 728x90)
- 広告配置 (上部 vs 下部)
- ゲームUIの改善

コンテンツ拡大:
- YouTube チャンネル開設
  動画タイプ: ゲームプレイ、チュートリアル、高スコア集
  
- ブログ記事追加
  記事タイプ: 攻略ガイド、日本語学習TIP、ゲーム開発解説

- ゲーム追加
  案: シューティング、マッチング3、ワードサーチ
```

### トラフィックチャネル別の期待値

```
チャネル           初期%  中期%  成熟期%  RPM倍率
Direct/Organic     30%   50%   60%    1.0x
Social             40%   25%   20%    0.8x
Referral           15%   15%   10%    1.2x
Paid (検討中)      15%   10%   10%    2.0x
```

---

## RPM Optimization

### 広告配置のベストプラクティス

```
優先度順:
1. ゲーム下部 (完成後)
   - ユーザーが通常ここまでスクロール
   - レスポンシブ広告推奨

2. ゲーム上部 (インタースティシャル)
   - ゲーム開始時のみ表示
   - クローズボタン必須

3. 右サイドバー
   - PC表示のみ (スクエア 336x280)
   - モバイルでは非表示
```

### RPM向上の指標

```
目標RPM: $2-5 / 1000 PV (日本)
        $5-15 / 1000 PV (欧米)

向上のコツ:
- ページ読み込み速度: 2秒以下
  > Lighthouse スコア 90+
  > Core Web Vitals: Good
  
- ユーザー滞在時間: 3分以上
  > ゲームの難易度調整
  > リプレイ性の向上
  
- 地域別トラフィック
  > 欧米からのトラフィック増加
  > 各地域の季節イベント対応
```

### パフォーマンス監視ダッシュボード

毎日チェック項目:
```
AdSense ダッシュボード:
├─ 推定収益 (毎日更新, 実際の24時間遅延)
├─ ページRPM (重要指標)
├─ CTR (目標: 1-3%)
├─ インプレッション数
└─ トラフィックソース

Google Analytics:
├─ セッション数
├─ ユーザー数
├─ 平均セッション時間
├─ バウンスレート (目標: <40%)
└─ デバイス別分析
```

---

## Game Detailed Specifications

### Sudoku ゲーム

**ファイル**: `games/sudoku/index.html`

**機能実装:**
```javascript
// 数独パズル生成アルゴリズム
- バックトラック法で有効なパズル生成
- 難易度別セル削除 (40/50/60 セル)
- リアルタイム検証 (エラーハイライト)
- キーボード対応 (1-9 で入力)

ゲーム統計:
- 経過時間自動計算
- エラーカウント
- 埋埋まった数 / 81
```

**UI要素:**
```
1. ディフィカルティセレクタ
   - かんたん (40削除)
   - ふつう (50削除)
   - むずかしい (60削除)

2. 9x9 グリッド
   - 太枠で 3x3 ボックス区切り
   - 選択セルハイライト
   - 読み取り専用セルは薄い背景

3. 数値パッド (1-9, 消)

4. 操作ボタン
   - 新しいゲーム (難易度リセット)
   - ヒント (1つ埋める)
   - 解答 (全表示)
```

### Hiragana Match ゲーム

**ファイル**: `games/hiragana-match/index.html`

**機能実装:**
```javascript
// メモリカードゲーム
- 10枚カード (5ペア)
- クリック検証とマッチング
- タイマーと自動スコアリング

レベル実装:
1. あいうえお (基本5字)
2. か行 (か-こ)
3. 混合 (複数行から5文字)
```

**スコアリング:**
```
基本スコア: +10 (マッチ時)
ペナルティ: -1 (ノーマッチ時)
ボーナス: 時間ボーナス (6秒以内: +5)
```

**UI要素:**
```
1. レベルセレクタ (3段階)
2. 4x5 カードグリッド (モバイル: 4x5)
3. スコア / タイマー / ペア数表示
4. 操作ボタン (新規, リセット)
```

---

## File Structure

```
puzzle-games/
├── README.md                          ← 本ドキュメント
├── adsense-setup.md                  ← 詳細AdSenseガイド
├── deploy.sh                          ← 自動デプロイスクリプト
│
└── games/
    ├── sudoku/
    │   └── index.html               ← 完全な数独ゲーム (単一ファイル)
    │
    └── hiragana-match/
        └── index.html               ← ひらがなメモリゲーム (単一ファイル)
```

**特徴:**
- 両ゲーム共に **単一HTMLファイル** (HTML5/CSS/JavaScript)
- 外部依存なし (CDN ライブラリ不要)
- SEO フレンドリー
- 完全にモバイル対応

---

## Privacy and Legal Compliance

### 必須ページ

GitHub Pages でのホスティングのため、以下のページを作成してください:

**プライバシーポリシー** (`/privacy.html`)

```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <title>プライバシーポリシー</title>
</head>
<body>
    <h1>プライバシーポリシー</h1>
    
    <h2>Google AdSenseについて</h2>
    <p>本サイトは Google Adsense による広告配信を行っています。</p>
    
    <h2>クッキーとトラッキング</h2>
    <p>Google およびそのパートナーは、
    以前のサイト訪問に基づいてユーザーに広告を配信するためにクッキーを使用します。</p>
    
    <h2>広告設定</h2>
    <p>ユーザーは
    <a href="https://myaccount.google.com/privacy">
    Google の広告設定ページ</a>
    で、広告配信の設定を変更できます。</p>
</body>
</html>
```

**利用規約** (`/terms.html`)

```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <title>利用規約</title>
</head>
<body>
    <h1>利用規約</h1>
    
    <h2>免責事項</h2>
    <p>本サイト上のゲームは現状のまま提供されます。
    使用によるいかなる損害についても
    責任を負いません。</p>
    
    <h2>著作権</h2>
    <p>本サイトのコンテンツの著作権は
    [あなたの名前] に帰属します。</p>
</body>
</html>
```

### Google AdSense ポリシー遵守

```
禁止行為:
✗ 自分のゲームのクリック
✗ ユーザーへのクリック強要
✗ 不正なトラフィック生成
✗ クローキング
✗ 隠れた広告

推奨:
✓ 正規のトラフィックのみ
✓ 高品質なコンテンツ
✓ ユーザーとの誠実な関係
✓ 広告の明示的な開示
```

---

## Expected Results

### 保守的な見通し (月1)

```
トラフィック:
- PV: 5,000-10,000
- セッション: 1,000-2,000
- ユーザー: 500-1,000

収益:
- 推定RPM: $1-2 / 1000 PV
- 推定収益: $5-20
```

### 中程度の成長 (月2)

```
トラフィック:
- PV: 20,000-50,000
- セッション: 5,000-10,000
- ユーザー: 2,000-5,000

収益:
- 推定RPM: $2-4 / 1000 PV
- 推定収益: $40-200
```

### 積極的な成長 (月3)

```
トラフィック:
- PV: 100,000+
- セッション: 20,000+
- ユーザー: 10,000+

収益:
- 推定RPM: $2-5 / 1000 PV
- 推定月収: $200-500+
```

**注意:** これらは推定値です。実際の結果はコンテンツの質、トラフィック戦略、ユーザーの地域に大きく依存します。

---

## Development and Customization

### ゲームのカスタマイズ

#### 難易度追加 (Sudoku)

`games/sudoku/index.html` 内の `this.levels` オブジェクトを編集:

```javascript
this.difficulty = {
    easy: 40,
    medium: 50,
    hard: 60,
    expert: 75  // 新規追加
};
```

#### 新しいレベル追加 (Hiragana Match)

`games/hiragana-match/index.html` 内で:

```javascript
3: {
    pairs: [
        { hiragana: 'さ', romaji: 'sa' },
        { hiragana: 'し', romaji: 'shi' },
        { hiragana: 'す', romaji: 'su' },
        // ...
    ]
}
```

### パフォーマンス最適化

```html
<!-- 画像最適化 -->
<img src="image.png" loading="lazy" alt="説明">

<!-- CSS 最適化 -->
<style>
  /* クリティカルCSS のみ inline -->
  body { font-family: sans-serif; }
</style>

<!-- JavaScript 最適化 -->
<!-- async または defer を使用 -->
<script async src="analytics.js"></script>
```

---

## Support and Resources

### 公式ドキュメント

```
Google AdSense:
https://support.google.com/adsense

Google Analytics:
https://support.google.com/analytics

Search Console:
https://support.google.com/webmasters
```

### コミュニティ

```
StackOverflow:
https://stackoverflow.com/questions/tagged/adsense

Google AdSense ヘルプフォーラム:
https://support.google.com/adsense/community
```

---

## Checklist

### 初回セットアップ

- [ ] リポジトリをGitHubで作成
- [ ] ローカルでgit init実行
- [ ] GitHub Pages 有効化
- [ ] ゲームURL確認
- [ ] Google Analytics 登録
- [ ] Google Search Console 登録

### AdSense準備

- [ ] AdSenseアカウント作成申請
- [ ] 承認待機 (3-5日)
- [ ] 承認タグを両ゲームに挿入
- [ ] 広告ユニット作成 (最低2つ)
- [ ] HTMLファイルに広告コード追加
- [ ] デプロイ確認

### トラフィック戦略開始

- [ ] プライバシーポリシー作成
- [ ] 利用規約作成
- [ ] Twitter/TikTok アカウント作成
- [ ] 初回投稿 (#数独 #ひらがな)
- [ ] Reddit/掲示板への投稿
- [ ] ゲーム紹介サイト登録

### 監視と最適化

- [ ] 初日のレポート確認
- [ ] 1週間のデータ分析
- [ ] RPM測定と広告調整
- [ ] コンテンツ改善実装
- [ ] 月次報告書作成

---

## KPI and Goals

```
30日実験の成功基準:

トラフィック:
✓ 目標: 20,000+ PV
✓ 検証: Google Analytics で確認

収益:
✓ 目標: $50+ 総収益
✓ 検証: AdSense ダッシュボードで確認

ユーザーエンゲージメント:
✓ 目標: 3分以上の平均セッション時間
✓ 検証: Analytics セッション継続時間

継続性:
✓ 目標: 1日500+ セッション達成後も継続
✓ 検証: 日次レポート
```

---

## Next Steps

実験後の拡大計画:

```
フェーズ2 (3-6ヶ月):
- 5つ以上のゲーム追加
- YouTube チャンネル開設
- モバイルアプリ化検討 (React Native)

フェーズ3 (6-12ヶ月):
- プレミアム版 (広告なし: $0.99)
- ゲーム内課金機能
- リーダーボード / ソーシャル機能
- 複数言語対応

フェーズ4 (1年+):
- プロダクション最適化
- 分析レポート販売
- パートナーシップ模索
```

---

## License

このプロジェクトはMITライセンスの下で提供されます。自由に改変・配布できます。

---

**始める準備はできていますか？** 🎮

1. `deploy.sh` を実行してゲームをデプロイ
2. `adsense-setup.md` に従ってAdSenseを設定
3. トラフィック戦略を開始
4. 30日後に結果を分析

**成功を祈ります！** 🚀
