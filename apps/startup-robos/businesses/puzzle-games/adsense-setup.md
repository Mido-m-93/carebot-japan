# Google AdSense Setup Guide

This guide provides detailed instructions for maximizing AdSense revenue from puzzle games.

## Table of Contents
1. [AdSense Application](#adsense-application)
2. [Ad Unit Configuration](#ad-unit-configuration)
3. [HTML Integration](#html-integration)
4. [RPM Optimization Strategy](#rpm-optimization-strategy)
5. [Troubleshooting](#troubleshooting)

---

## AdSense Application

### Step 1: Pre-Application Preparation

申請するまえに、以下を確認してください:

```
✓ ドメイン所有権の確認
  - GitHub Pages: https://your-username.github.io/puzzle-games
  - または独自ドメイン

✓ コンテンツの充実
  - 両ゲーム共にアップロード済み
  - プライバシーポリシーページを作成 (重要)
  - 利用規約ページを作成

✓ トラフィック
  - 初回申請時は最低でも1日あたり100ページビュー推奨
  - 既存のコンテンツがある場合は必須ではありません
```

### Step 2: Create AdSense Account

1. Go to https://www.google.com/adsense
2. Log in with your Google account (create one if needed)
3. Click "Get Started Now"

### Step 3: Register Your Site

In the application form:

```
Site URL: https://your-username.github.io/puzzle-games
Time Zone: Japan (UTC+9)
Account Type: Individual
```

### Step 4: Insert Approval Tag

Insert the approval tag provided by AdSense into both game HTML files:

```html
<!-- Google AdSense Approval Tag -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-xxxxxxxxxxxxxxxx"
     crossorigin="anonymous"></script>
```

Insert this tag in the `<head>` section.

### Step 5: Submit Application and Wait for Approval

- Submit your application
- Google review period: typically 3-5 days
- Results will be sent via email

**Note:** AdSense requirements vary by country. For applications from Japan, content quality is heavily weighted.

---

## Ad Unit Configuration

### Ad Unit Types and Placement

#### 1. Responsive Ads (Recommended)

**Benefits:**
- Auto-adjusts to any device size
- High display efficiency
- Stable RPM

**Placement:**
```html
<!-- ゲーム下部 (最適な配置) -->
<div style="text-align: center; margin: 25px 0;">
  <ins class="adsbygoogle"
       style="display:block; text-align:center;"
       data-ad-layout="in-article"
       data-ad-format="fluid"
       data-ad-client="ca-pub-xxxxxxxxxxxxxxxx"
       data-ad-slot="xxxxxxxxxx"></ins>
  <script>
    (adsbygoogle = window.adsbygoogle || []).push({});
  </script>
</div>
```

#### 2. Square Ads (336x280)

**Placement:** Sidebar, right side of game

```html
<ins class="adsbygoogle"
     style="display:inline-block;width:336px;height:280px"
     data-ad-client="ca-pub-xxxxxxxxxxxxxxxx"
     data-ad-slot="xxxxxxxxxx"></ins>
<script>
  (adsbygoogle = window.adsbygoogle || []).push({});
</script>
```

#### 3. Banner Ads (728x90)

**Placement:** Header top

```html
<ins class="adsbygoogle"
     style="display:inline-block;width:728px;height:90px"
     data-ad-client="ca-pub-xxxxxxxxxxxxxxxx"
     data-ad-slot="xxxxxxxxxx"></ins>
<script>
  (adsbygoogle = window.adsbygoogle || []).push({});
</script>
```

---

## HTML Integration

### Sudoku Game Ad Placement

File to edit: `games/sudoku/index.html`

**Current placeholder:** around line 56

```html
<div class="adsense-placeholder">
    <!-- AdSense広告コード: 336x280 を挿入してください -->
    <!-- AdSense Ad Unit Code Here -->
</div>
```

**置換手順:**

1. AdSenseダッシュボードから広告ユニットを作成
2. 提供されるコードをコピー
3. プレースホルダーを以下に置換:

```html
<div style="text-align: center; margin-top: 25px; min-height: 300px;">
  <ins class="adsbygoogle"
       style="display:block; text-align:center;"
       data-ad-layout="in-article"
       data-ad-format="fluid"
       data-ad-client="ca-pub-xxxxxxxxxxxxxxxx"
       data-ad-slot="xxxxxxxxxx"></ins>
  <script>
    (adsbygoogle = window.adsbygoogle || []).push({});
  </script>
</div>
```

### Hiragana Matchゲーム広告配置

編集対象ファイル: `games/hiragana-match/index.html`

**現在のプレースホルダー:** ファイル末尾付近

同じ手順で置換してください。

### 承認タグの追加

両ゲームの `<head>` セクション内に以下を追加:

```html
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>...</title>
    
    <!-- Google AdSense -->
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-xxxxxxxxxxxxxxxx"
         crossorigin="anonymous"></script>
    
    <style>
    ...
</head>
```

---

## RPM最適化戦略

### 1. 広告配置最適化

#### 最適なRPMを得るための配置:

**Sudokuゲーム:**
```
優先度1: ゲーム下部 (レスポンシブ広告)
優先度2: ゲーム上部バナー
優先度3: ゲーム完成時ポップアップ (インタースティシャル)
```

**Hiragana Matchゲーム:**
```
優先度1: ゲーム下部 (レスポンシブ広告)
優先度2: ゲーム完成時モーダル
優先度3: サイドバースクエア (モバイルでは非表示)
```

#### ユーザー体験を損なわない配置:

```css
/* 広告のマージンを設定 */
.adsense-placeholder {
    margin: 25px 0;
    min-height: 300px; /* 確保されたスペース */
    text-align: center;
}

/* モバイル表示最適化 */
@media (max-width: 600px) {
    .adsense-placeholder {
        min-height: 250px;
    }
}
```

### 2. トラフィック戦略

#### 初期段階 (月1-2): 基礎構築

```
目標: 1日あたり500-1000セッション

実施内容:
- Google Search Console登録
  https://search.google.com/search-console
  
- Google Analytics設定
  https://analytics.google.com
  
- キーワード最適化
  - ゲームタイトルにキーワード含有
  - メタディスクリプション最適化
  - OpenGraph設定
```

**Search Consoleセットアップ:**

```html
<!-- games/sudoku/index.html と games/hiragana-match/index.html に追加 -->
<meta name="description" content="無料の数独パズル。日本語UI、難易度選択機能、ヒント機能付き。">
<meta property="og:title" content="数独パズル - 無料で遊べるJavaScript Sudoku">
<meta property="og:description" content="かんたん、ふつう、むずかしいの3段階難易度で楽しめる数独ゲーム">
<meta property="og:type" content="website">
<meta property="og:url" content="https://your-username.github.io/puzzle-games/games/sudoku/">
<meta property="og:image" content="https://your-username.github.io/puzzle-games/og-image-sudoku.png">
```

#### 中期段階 (月2-3): トラフィック拡大

```
目標: 1日あたり2000-5000セッション

実施内容:
- SNS推大
  Twitter: #数独 #ひらがな #JavaScriptゲーム
  TikTok: ゲームプレイ動画
  Instagram: ゲームスクリーンショット
  
- コンテンツ追加
  - ゲーム攻略ブログ記事
  - YouTube動画
  - Reddit/掲示板への投稿
  
- リンク獲得
  - ゲーム紹介サイトへ登録
  - テックブログでレビュー
```

#### 成長段階 (月3+): 最適化と拡大

```
目標: 1日あたり5000-15000セッション

実施内容:
- A/Bテスト
  - 広告サイズ変更
  - 広告配置変更
  - ゲームUIの改善
  
- ゲーム追加
  - シューティングゲーム
  - マッチング3ゲーム
  - 単語ゲーム
  
- マネタイズ多様化
  - アプリ化 (React Native)
  - プレミアム版
  - ゲーム内課金
```

### 3. RPM向上のテクニック

#### トラフィックセグメントの改善

```javascript
// AdSenseスクリプト前にセグメント設定
window.adsbygoogle = window.adsbygoogle || [];
window.adsbygoogle.push({
  google_ad_client: "ca-pub-xxxxxxxxxxxxxxxx",
  // 日本特化設定
  google_ad_region: "JP",
  overlays: { google_image_queries: true }
});
```

#### 広告フリークエンシー管理

```html
<!-- 1時間に3つ以上の広告を表示しない -->
<script>
document.addEventListener('adloaded', function() {
  var adCount = sessionStorage.getItem('adCount') || 0;
  if (parseInt(adCount) >= 3) {
    document.querySelector('.adsense-placeholder').style.display = 'none';
  }
  sessionStorage.setItem('adCount', parseInt(adCount) + 1);
});
</script>
```

#### ブランド安全性

```
実施項目:
✓ 不適切なコンテンツ・言語を排除
✓ 外部リンクは信頼できるサイトのみ
✓ プライバシーポリシーを明記
✓ 定期的にコンテンツ監査

AdSenseダッシュボード設定:
- 広告レビューセンター: すべての広告を事前確認
- サイト運営者プログラムポリシー遵守
```

---

## トラブルシューティング

### 広告が表示されない場合

```
1. 承認タグが正しく挿入されているか確認
   - <head>セクション内にある
   - client ID が正しい
   - async属性がある

2. 広告ユニットIDが正しいか確認
   - data-ad-slot="xxxxxxxxxx" の値

3. キャッシュをクリア
   - Ctrl+Shift+Delete (Windows)
   - Cmd+Shift+Delete (Mac)
   - ブラウザキャッシュをクリア

4. AdSenseステータスを確認
   - ダッシュボード > サイト管理 > サイト確認
   - "承認済み"と表示されているか

5. JavaScript エラーをチェック
   - F12 > Console タブ
   - エラーメッセージを確認
```

### RPM が低い場合

```
1. トラフィック構成を確認
   - ダッシュボード > パフォーマンスレポート
   - 地域別トラフィック: 日本/欧米比率
   → 欧米からのトラフィック増加でRPM向上

2. 広告タイプを変更
   - レスポンシブ→スクエア/バナー
   - 複数の広告ユニットを並行運用

3. コンテンツ質を向上
   - ページ読み込み速度: 3秒以下
   - モバイル最適化
   - ユーザー滞在時間の増加

4. スパム/不正クリック排除
   - 自分でクリックしない
   - ユーザーにクリック促奨しない
   - VPN経由のアクセス監視
```

### アカウント制限・停止の場合

```
よくある理由:
- クリック詐欺疑い
- 不適切なコンテンツ
- ユーザー生成コンテンツの悪用

対応方法:
1. AdSenseサポートに申し立て
   - ダッシュボード > サポート
   - 詳細な説明を記入

2. コンテンツを見直し
   - 不適切な広告をブロック
   - コンテンツを改善

3. 再申請 (7日間待機後)
   - 新しい申請フォームから
```

---

## パフォーマンス監視

### 推奨モニタリング指標

```
週1回チェック:
- PV (ページビュー)
- RPM (1000PVあたりの収益)
- CTR (クリック率)
- CPC (クリックあたりの単価)

月1回の詳細分析:
- デバイス別パフォーマンス
- 地域別パフォーマンス
- 広告サイズ別パフォーマンス
- トラフィックソース分析
```

### ダッシュボードの見方

```
AdSenseダッシュボード > パフォーマンスレポート

主要指標:
├─ 推定収益: 実際の収入目安
├─ ページRPM: 1000PVあたりの収益 (重要)
├─ クリック数: 広告をクリックしたユーザー数
├─ インプレッション数: 広告表示回数
└─ CTR: クリック数 ÷ インプレッション数 (%)

目標値 (日本語サイト):
- RPM: $1-5/1000PV
- CTR: 1-3%
```

---

## まとめ: 実装チェックリスト

```
初回セットアップ:
□ AdSenseアカウント作成
□ サイト申請と審査
□ 承認タグを両ゲームに挿入
□ 広告ユニット作成 (最低2つ)
□ HTMLファイルに広告コード追加
□ Google Search Console登録
□ Google Analytics設定
□ プライバシーポリシー作成

最適化:
□ 広告配置の視認性確認
□ ページ読み込み速度テスト
□ モバイル表示確認
□ 1週間のデータ収集
□ RPM分析と調整

グロース:
□ SNS投稿開始
□ ゲーム紹介ページ作成
□ SEO最適化継続
□ 追加ゲーム開発検討
□ 月次レポート作成
```

---

**質問やトラブルシューティングが必要な場合:**
- Google AdSense サポート: https://support.google.com/adsense
- ヘルプフォーラム: https://support.google.com/adsense/community

**成功を祈ります！** 🚀
