# Piano Practice App - JSON楽曲データ仕様

## 概要

Piano Practice Appで使用する楽曲データのJSON仕様を定義します。この仕様に従ったJSONファイルをURLパラメータで指定することで、外部の楽曲データを読み込むことができます。

## 基本構造

```json
{
  "title": "楽曲名",
  "notes": [
    {
      "pitch": 60,
      "timing": {
        "beat": 0
      }
    }
  ]
}
```

### 完全な例（全フィールド指定）

```json
{
  "title": "楽曲名",
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

## フィールド詳細

### ルートオブジェクト

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `title` | string | ✅ | 楽曲のタイトル |
| `bpm` | number | ❌ | テンポ（1分間の四分音符数、デフォルト: 120） |
| `notes` | Note[] | ✅ | ノート配列 |

### Note オブジェクト

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `pitch` | number | ✅ | MIDIノート番号（0-127）<br>例: C4=60, A4=69 |
| `timing` | Timing | ✅ | タイミング情報 |
| `velocity` | number | ❌ | ベロシティ（0-127、デフォルト: 80） |

### Timing オブジェクト

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `beat` | number | ✅ | 開始位置（四分音符単位）<br>例: 0=開始, 1=1拍目, 2.5=2拍目の裏 |
| `duration` | number | ❌ | 長さ（四分音符単位、デフォルト: 1）<br>例: 1=四分音符, 0.5=八分音符, 2=二分音符 |

## MIDIノート番号対応表

### オクターブ4（中央C周辺）
| 音名 | MIDIノート番号 |
|------|---------------|
| C4   | 60           |
| C#4  | 61           |
| D4   | 62           |
| D#4  | 63           |
| E4   | 64           |
| F4   | 65           |
| F#4  | 66           |
| G4   | 67           |
| G#4  | 68           |
| A4   | 69           |
| A#4  | 70           |
| B4   | 71           |

### 計算式
```
MIDIノート番号 = (オクターブ + 1) × 12 + 音程番号
```

音程番号: C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11

## 使用例

### 1. 最小限の楽曲（全デフォルト値使用）

```json
{
  "title": "ドレミファソ",
  "notes": [
    { "pitch": 60, "timing": { "beat": 0 } },
    { "pitch": 62, "timing": { "beat": 1 } },
    { "pitch": 64, "timing": { "beat": 2 } },
    { "pitch": 65, "timing": { "beat": 3 } },
    { "pitch": 67, "timing": { "beat": 4 } }
  ]
}
```

### 2. BPMとdurationを指定した楽曲

```json
{
  "title": "Cメジャーコード",
  "bpm": 100,
  "notes": [
    { "pitch": 60, "timing": { "beat": 0, "duration": 2 } },
    { "pitch": 64, "timing": { "beat": 0, "duration": 2 } },
    { "pitch": 67, "timing": { "beat": 0, "duration": 2 } }
  ]
}
```

### 3. 複雑なリズムとベロシティ

```json
{
  "title": "八分音符と三連符",
  "bpm": 140,
  "notes": [
    { "pitch": 60, "timing": { "beat": 0, "duration": 0.5 }, "velocity": 90 },
    { "pitch": 62, "timing": { "beat": 0.5, "duration": 0.5 }, "velocity": 70 },
    { "pitch": 64, "timing": { "beat": 1, "duration": 0.333 } },
    { "pitch": 65, "timing": { "beat": 1.333, "duration": 0.333 } },
    { "pitch": 67, "timing": { "beat": 1.666, "duration": 0.333 } }
  ]
}
```

## URLパラメータでの使用方法

### 1. 外部JSONファイルを指定

```
https://your-app.com/?song=https://example.com/songs/twinkle-star.json
```

### 2. Base64エンコードされたJSONデータを直接指定

```
https://your-app.com/?data=eyJ0aXRsZSI6IuODhuOCueODiCIsImJwbSI6MTIwLCJub3RlcyI6W119
```

## バリデーション

アプリケーションは以下の検証を行います：

1. **必須フィールドの存在確認**
2. **データ型の検証**
3. **値の範囲チェック**
   - `bpm`: 60-200（省略時は120）
   - `pitch`: 0-127
   - `velocity`: 0-127（省略時は80）
   - `beat`: 0以上
   - `duration`: 0より大きい値（省略時は1）
4. **論理的整合性の確認**
   - ノートの重複チェック
   - タイミングの妥当性確認

## エラーハンドリング

不正なデータが検出された場合：

1. **軽微なエラー**: デフォルト値で補完
2. **重大なエラー**: エラーメッセージを表示してデフォルト楽曲を使用
3. **ネットワークエラー**: 再試行またはデフォルト楽曲を使用

## 今後の拡張予定

- **メタデータ**: 作曲者、難易度、ジャンル等
- **表現記号**: スタッカート、レガート等
- **テンポ変更**: 楽曲中でのBPM変更