# Piano Practice App

MIDI対応のピアノ練習用Webアプリケーション。電子ピアノと接続して、楽譜に合わせた演奏練習ができます。

サンプル : https://takahashishuuhei.github.io/apps/piano-practice/?song=https://raw.githubusercontent.com/TakahashiShuuhei/piano-trainer/refs/heads/master/test-song.json

## 機能

- 🎹 **MIDI入力対応**: 電子ピアノからのリアルタイム入力
- 🎵 **楽譜表示**: ノートが上から流れてくる視覚的な楽譜
- 📊 **スコア評価**: 演奏の正確性を評価
- 🔄 **ループ練習**: 楽曲を繰り返し練習
- 🎚️ **BPM調整**: テンポの変更
- 🔊 **音量調整**: 音声フィードバックの調整
- 📁 **外部楽曲読み込み**: JSONファイルやBase64データから楽曲を読み込み

## セットアップ

### 必要な環境
- Node.js (v16以上推奨)
- npm
- MIDI対応の電子ピアノ（オプション）

### インストール
```bash
# リポジトリをクローン
git clone <repository-url>
cd piano-practice-app

# 依存関係をインストール
npm install
```

### 開発環境での実行
```bash
# ビルド
npm run build

# ローカルサーバーを起動
npm run serve
```

ブラウザで `http://localhost:8081` にアクセス

### 開発モード（ファイル監視）
```bash
# ファイル変更を監視してビルド
npm run dev

# 別のターミナルでサーバー起動
npm run serve
```

## 使用方法

### 基本的な使い方
1. **MIDI接続**: 電子ピアノをUSBで接続し、「MIDI接続」ボタンをクリック
2. **楽曲選択**: デフォルトの楽曲または外部データを読み込み
3. **練習開始**: 「開始」ボタンでカウントダウン開始
4. **演奏**: 流れてくるノートに合わせて鍵盤を演奏

### キーボード操作（MIDI未接続時）
- `A` = C4 (ド)
- `W` = C#4 (ド#)
- `S` = D4 (レ)
- `E` = D#4 (レ#)
- `D` = E4 (ミ)
- `F` = F4 (ファ)
- `T` = F#4 (ファ#)
- `G` = G4 (ソ)
- `Y` = G#4 (ソ#)
- `H` = A4 (ラ)
- `U` = A#4 (ラ#)
- `J` = B4 (シ)
- `K` = C5 (ド)

## 外部楽曲データの読み込み

### JSONファイルから読み込み
```
http://localhost:8081/?song=楽曲ファイル.json
```

### Base64データから読み込み
```
http://localhost:8081/?data=Base64エンコードされたJSONデータ
```

### 楽曲データの形式
```json
{
  "title": "楽曲タイトル",
  "bpm": 120,
  "notes": [
    {
      "pitch": 60,
      "timing": {
        "beat": 0,
        "duration": 1
      },
      "velocity": 80
    }
  ]
}
```

#### パラメータ説明
- **title**: 楽曲のタイトル（文字列）
- **bpm**: テンポ（60-200、デフォルト: 120）
- **notes**: ノートの配列
  - **pitch**: MIDI音程番号（0-127、60=C4）
  - **beat**: 拍数（0から開始）
  - **duration**: 音符の長さ（拍数、デフォルト: 1）
  - **velocity**: 音の強さ（0-127、デフォルト: 80）

### テスト用楽曲データ
プロジェクトには以下のテスト用JSONファイルが含まれています：

- **test-song.json**: きらきら星（シンプルなメロディー）
- **test-chord.json**: 和音テスト（コード進行）
- **test-scale.json**: ドレミファソラシド（スケール練習）

使用例：
```
http://localhost:8081/?song=test-song.json
```

## デプロイ

### ビルド
```bash
npm run build
```

### デプロイファイル
`dist/` フォルダの中身をWebサーバーにアップロードします：

- `index.html` - メインのHTMLファイル
- `bundle.js` - バンドルされたJavaScriptファイル
- テスト用JSONファイル（オプション）

### 静的サイトホスティング
Netlify、Vercel、GitHub Pages等の静的サイトホスティングサービスに対応：

```bash
npm run build
# dist/ フォルダの中身をアップロード
```

### 従来のWebサーバー
Apache、Nginx等の従来のWebサーバーにも対応：

```bash
npm run build
# dist/ フォルダの中身をドキュメントルートにコピー
```

## 注意事項

### MIDI機能について
- **ブラウザ対応**: Chrome、Edge、Opera等のChromiumベースブラウザで動作
- **HTTPS必須**: 多くのブラウザでMIDI機能にはHTTPS接続が必要
- **デバイス接続**: 電子ピアノをUSBで接続し、ブラウザでMIDIアクセスを許可

### 外部ファイル読み込みについて
- **CORS対応**: 
  - 同一オリジンのファイルは制限なし
  - GitHub Gist Raw URL は CORS 対応済み
  - GitHub Pages 間のファイルアクセスは可能
  - その他の外部URLは制限あり
- **推奨方法**:
  1. **Base64データ**: 最も確実で制限なし
  2. **GitHub Gist**: 楽曲データをGistに保存してRaw URLを使用
  3. **同一リポジトリ**: テスト用JSONファイルを同梱
- **文字エンコーディング**: UTF-8対応のBase64デコードを実装済み

#### GitHub Gist の使用例
1. [GitHub Gist](https://gist.github.com/) で楽曲JSONファイルを作成
2. Raw URLを取得: `https://gist.githubusercontent.com/username/gist-id/raw/filename.json`
3. URLパラメータで指定: `?song=https://gist.githubusercontent.com/...`

## 開発

### プロジェクト構造
```
src/
├── app/                 # メインアプリケーション
├── components/          # UIコンポーネント
├── utils/              # ユーティリティ
├── types/              # TypeScript型定義
└── __tests__/          # テストファイル
```

### テスト実行
```bash
npm test
```

### 技術スタック
- **TypeScript**: 型安全な開発
- **esbuild**: 高速ビルドツール
- **Web MIDI API**: MIDI入力処理
- **Web Audio API**: 音声出力
- **Canvas API**: 楽譜描画

### TODO
- URLではなくファイルアップロードによるjsonの読み込み
- 繰り返し時のスコアの履歴表示
- メモとか小節の区切りとかの表示
- メトロノーム
- 音を良くする
- ピアノ画面のサイズをある程度可変に
- シークバー
- カウントダウン

## ライセンス

MIT License

## 貢献

プルリクエストやイシューの報告を歓迎します。

---

🎹 Happy Piano Practice! 🎵