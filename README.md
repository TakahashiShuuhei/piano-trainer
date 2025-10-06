# Piano Practice App

MIDI対応電子ピアノを使用した音ゲー風ピアノ練習Webアプリケーション

## 特徴

- 🎹 MIDI対応電子ピアノとの連携
- 🎮 音ゲー風の視覚的インターフェース
- 📊 リアルタイム演奏評価とスコア表示
- 🎵 メトロノーム機能とテンポ調整
- 📚 様々な難易度の練習コンテンツ

## 技術スタック

- **TypeScript** - 型安全な開発
- **Tone.js** - Web Audio APIとMIDI統合
- **Canvas API** - 2D描画とアニメーション
- **Jest** - テストフレームワーク

## 開発環境のセットアップ

### 前提条件

- Node.js (v16以上)
- npm または yarn
- MIDI対応の電子ピアノ（推奨）

### インストール

```bash
# 依存関係のインストール
npm install

# TypeScriptのコンパイル
npm run build

# 開発サーバーの起動
npm run serve
```

### 開発モード

```bash
# TypeScriptの監視モード
npm run dev

# 別ターミナルでサーバー起動
npm run serve
```

## プロジェクト構造

```
src/
├── app/                 # メインアプリケーション
├── components/          # 各コンポーネント実装
├── types/              # TypeScript型定義
├── utils/              # ユーティリティ関数
├── data/               # 練習コンテンツデータ
└── __tests__/          # テストファイル
```

## 使用方法

1. ブラウザでアプリケーションを開く
2. MIDI対応電子ピアノをPCに接続
3. 「MIDI接続」ボタンをクリック
4. 練習コンテンツを選択
5. 「開始」ボタンで練習開始

## 対応ブラウザ

- Chrome 66+
- Firefox 63+
- Safari 14+
- Edge 79+

## ライセンス

MIT License