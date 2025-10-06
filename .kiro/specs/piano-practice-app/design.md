# 設計書

## 概要

MIDI対応電子ピアノを使用した音ゲー風ピアノ練習Webアプリケーション。TypeScriptとTone.jsを使用してブラウザ上で動作し、リアルタイムMIDI入力処理、視覚的フィードバック、演奏評価機能を提供する。

## 技術スタック

**Web MIDI API**: ブラウザでMIDI機器にアクセスするための標準API。`navigator.requestMIDIAccess()`でMIDI入力を取得。

**Tone.js**: Web Audio APIのラッパーライブラリ。Transportクラスによる精密なタイミング制御、メトロノーム、音声合成が可能。Tone.MidiオブジェクトによるMIDI統合機能も提供。

**TypeScript**: 型安全性を提供し、大規模なフロントエンドアプリケーション開発に適している。

**Canvas API**: HTML5 Canvasを使用した2D描画。音ゲー風のノート表示、アニメーション、視覚エフェクトを実装。

### 技術統合戦略
- **MIDI入力**: Tone.MidiオブジェクトでMIDI入力を処理し、Tone.Transport.nowと同期
- **タイミング同期**: Tone.Transport.scheduleを使用してゲームイベントを正確にスケジュール
- **音程変換**: Tone.Midi(note).toFrequency()でMIDIノート番号を周波数に変換
- **オーディオ出力**: Tone.jsのOscillator、Synth、Playerでメトロノームや効果音を再生
- **視覚描画**: Canvas APIでリアルタイム描画、requestAnimationFrameで60FPS更新

## アーキテクチャ

### システム構成

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MIDI Piano    │───▶│   Web Browser   │───▶│   Game Display  │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Audio Output  │
                       │  (Metronome)    │
                       └─────────────────┘
```

### レイヤー構成

1. **プレゼンテーション層** - UI表示とユーザーインタラクション
2. **アプリケーション層** - ゲームロジックと状態管理
3. **インフラストラクチャ層** - MIDI入力とオーディオ出力

## コンポーネントとインターフェース

### 1. MIDIInputManager
**責務**: MIDI機器の検出、接続、入力イベントの処理（Tone.js MIDI統合）

```typescript
interface MIDIInputManager {
  requestAccess(): Promise<boolean>
  getAvailableDevices(): MIDIInput[]
  onNoteOn(callback: (note: number, velocity: number, toneTime: number) => void): void
  onNoteOff(callback: (note: number, toneTime: number) => void): void
  convertNoteToFrequency(note: number): number
  disconnect(): void
}
```

### 2. GameEngine
**責務**: ゲームの状態管理、スコア計算、タイミング制御

```typescript
interface GameEngine {
  loadContent(content: PracticeContent): void
  start(): void
  pause(): void
  stop(): void
  processNoteInput(note: number, timestamp: number): ScoreResult
  getCurrentState(): GameState
  onStateChange(callback: (state: GameState) => void): void
}

interface GameState {
  isPlaying: boolean
  currentTime: number
  score: number
  accuracy: number
  currentMeasure: number
}
```

### 3. ScoreEvaluator
**責務**: 演奏の正確性評価とスコア計算

```typescript
interface ScoreEvaluator {
  evaluateNote(expectedNote: Note, actualNote: number, timing: number): ScoreResult
  calculateAccuracy(results: ScoreResult[]): number
  getTimingTolerance(): number
  setTimingTolerance(ms: number): void
}

interface ScoreResult {
  isCorrect: boolean
  timingAccuracy: number
  points: number
  feedback: 'perfect' | 'good' | 'miss'
}
```

### 4. UIRenderer
**責務**: Canvas APIを使用したゲーム画面の描画とアニメーション

```typescript
interface UIRenderer {
  initCanvas(canvasElement: HTMLCanvasElement): void
  render(gameState: GameState, notes: Note[]): void
  showNoteHit(note: Note, result: ScoreResult): void
  updateScore(score: number, accuracy: number): void
  showMetronome(beat: number): void
  setTheme(theme: 'light' | 'dark'): void
  startAnimationLoop(): void
  stopAnimationLoop(): void
}
```

### 5. ContentManager
**責務**: 練習コンテンツの管理と提供

```typescript
interface ContentManager {
  getAvailableContent(): PracticeContent[]
  loadContent(id: string): Promise<PracticeContent>
  createCustomContent(notes: Note[]): PracticeContent
}

interface PracticeContent {
  id: string
  title: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  bpm: number
  timeSignature: [number, number]
  notes: Note[]
  duration: number
}
```

### 6. MetronomeService
**責務**: メトロノーム機能とテンポ管理（Tone.js Transportベース）

```typescript
interface MetronomeService {
  start(bpm: number): void
  stop(): void
  setBPM(bpm: number): void
  onBeat(callback: (beat: number, measure: number) => void): void
  setVolume(volume: number): void
  getTransport(): Tone.Transport
  scheduleCallback(callback: () => void, time: string): void
  scheduleRepeat(callback: () => void, interval: string): void
  getCurrentTime(): number
  convertTimeToBeats(time: number): number
}
```

## データモデル

### Note
```typescript
interface Note {
  pitch: number        // MIDI note number (0-127)
  startTime: number    // milliseconds from start
  duration: number     // milliseconds
  velocity: number     // 0-127
  isChord?: boolean    // true if part of chord
  chordNotes?: number[] // other notes in chord
}
```

### PracticeSession
```typescript
interface PracticeSession {
  contentId: string
  startTime: Date
  endTime?: Date
  finalScore: number
  accuracy: number
  noteResults: ScoreResult[]
  completed: boolean
}
```

## エラーハンドリング

### MIDI関連エラー
- **MIDIAccessDenied**: ユーザーがMIDIアクセスを拒否
- **NoMIDIDevices**: MIDI機器が検出されない
- **MIDIConnectionLost**: 練習中にMIDI接続が切断

### ゲーム関連エラー
- **ContentLoadError**: 練習コンテンツの読み込み失敗
- **AudioContextError**: Web Audio APIの初期化失敗

### エラー処理戦略
1. **グレースフルデグラデーション**: MIDI未対応環境でもキーボード入力で動作
2. **ユーザーフレンドリーなメッセージ**: 技術的エラーを分かりやすく説明
3. **自動復旧**: 可能な場合は自動的に接続を再試行

## テスト戦略

### 単体テスト
- **ScoreEvaluator**: タイミング評価ロジックのテスト
- **GameEngine**: ゲーム状態遷移のテスト
- **ContentManager**: コンテンツ読み込みのテスト

### 統合テスト
- **MIDI入力からUI更新まで**の一連の流れ
- **複数コンポーネント間**のデータフロー

### E2Eテスト
- **実際のMIDI機器**を使用した動作確認
- **ブラウザ互換性**テスト（Chrome, Firefox, Safari）

### テスト用モック
- **MockMIDIInput**: MIDI入力をシミュレート
- **MockAudioContext**: オーディオ機能をモック
- **TestPracticeContent**: テスト用の練習コンテンツ

## パフォーマンス考慮事項

### リアルタイム処理
- **MIDI入力の低レイテンシ処理**: 10ms以下の応答時間
- **60FPSでの滑らかなアニメーション**: requestAnimationFrameの使用
- **メモリ効率**: 不要なオブジェクトの適切な破棄

### 最適化戦略
- **Canvas描画の最適化**: 差分更新による描画負荷軽減
- **イベントリスナーの管理**: 適切な登録・解除
- **Web Workerの活用**: 重い計算処理の分離（将来的な拡張）