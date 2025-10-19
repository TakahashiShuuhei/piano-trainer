// Musical timing system
export interface MusicalTiming {
  beat: number;         // Position in quarter notes (0 = start)
  duration: number;     // Duration in quarter notes
}

export interface MusicalNote {
  pitch: number;        // MIDI note number (0-127)
  timing: MusicalTiming;
  velocity: number;     // 0-127
}

// Legacy time-based note (for backward compatibility)
export interface Note {
  pitch: number;        // MIDI note number (0-127)
  startTime: number;    // milliseconds from start
  duration: number;     // milliseconds
  velocity: number;     // 0-127
}

export interface PracticeContent {
  id: string;
  title: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  bpm: number;
  timeSignature: [number, number];
  notes: Note[];
  duration: number;
}

// JSON楽曲データの型定義（仕様に基づく）
export interface SongData {
  title: string;
  bpm?: number;        // デフォルト: 120
  notes: SongNote[];
  memos?: SongMemo[];  // オプション: 楽曲中のメモ・アノテーション
  referenceImageUrl?: string;  // オプション: 参考画像のURL
}

export interface SongNote {
  pitch: number;       // MIDI note number (0-127)
  timing: SongTiming;
  velocity?: number;   // デフォルト: 80
}

export interface SongTiming {
  beat: number;        // 開始位置（四分音符単位）
  duration?: number;   // デフォルト: 1
}

export interface SongMemo {
  timing: { beat: number };  // 表示タイミング（四分音符単位）
  text: string;              // 表示するテキスト
  align?: 'left' | 'center' | 'right';  // デフォルト: 'center'
  color?: 'default' | 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'red' | 'cyan';  // デフォルト: 'default'
}

// 時間ベースのメモ（内部使用）
export interface Memo {
  startTime: number;  // ミリ秒
  text: string;
  align: 'left' | 'center' | 'right';
  color: 'default' | 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'red' | 'cyan';
}

export interface PracticeSession {
  contentId: string;
  startTime: Date;
  endTime?: Date;
  finalScore: number;
  accuracy: number;
  noteResults: ScoreResult[];
  completed: boolean;
}

export interface ScoreResult {
  isCorrect: boolean;
  timingAccuracy: number;
  points: number;
  feedback: 'perfect' | 'good' | 'miss' | 'game_not_playing' | 'ignored' | 'no_content';
}

export enum GamePhase {
  STOPPED = 'stopped',
  COUNTDOWN = 'countdown',
  PLAYING = 'playing',
  PAUSED = 'paused'
}

export interface GameState {
  phase: GamePhase;
  isPlaying: boolean;
  currentTime: number;
  score: number;
  accuracy: number;
  totalNotes?: number; // 通過したノート数
  countdownValue?: number | undefined; // カウントダウン中の数値（3, 2, 1）
}

// Component interfaces
export interface MIDIInputManager {
  requestAccess(): Promise<boolean>;
  getAvailableDevices(): MIDIInput[];
  onNoteOn(callback: (note: number, velocity: number, toneTime: number) => void): void;
  onNoteOff(callback: (note: number, toneTime: number) => void): void;
  convertNoteToFrequency(note: number): number;
  convertNoteToNoteName(note: number): string;
  syncWithTransport(): Promise<void>;
  getTransportTime(): number;
  convertMidiTimeToTransportTime(midiTimestamp: number): number;
  isDeviceConnected(): boolean;
  disconnect(): void;
}

export interface ScoreEvaluator {
  evaluateNote(expectedNote: Note, actualNote: number, timing: number): ScoreResult;
  calculateAccuracy(results: ScoreResult[]): number;
  getTimingTolerance(): number;
  setTimingTolerance(ms: number): void;
}

export interface UIRenderer {
  initCanvas(canvasElement: HTMLCanvasElement): void;
  render(gameState: GameState, notes: Note[], memos?: Memo[]): void;
  updateScore(score: number, accuracy: number): void;
  setTheme(theme: 'light' | 'dark'): void;
  setBPM(bpm: number): void;
  setCurrentTargetKeys(keys: number[]): void;
  clearTargetKeys(): void;
  setKeyPressed(pitch: number, pressed: boolean): void;
  clearPressedKeys(): void;
  destroy(): void;
}

export interface ContentManager {
  getAvailableContent(): PracticeContent[];
  loadContent(id: string): Promise<PracticeContent>;
  createCustomContent(notes: Note[]): PracticeContent;
}

export interface MetronomeService {
  start(bpm: number): void;
  stop(): void;
  setBPM(bpm: number): void;
  setVolume(volume: number): void;
  getTransport(): any; // Tone.Transport type
  scheduleCallback(callback: () => void, time: string): void;
  scheduleRepeat(callback: () => void, interval: string): void;
  getCurrentTime(): number;
  convertTimeToBeats(time: number): number;
}

// Beat-time conversion interface
export interface BeatTimeConverter {
  beatsToMs(beats: number): number;
  msToBeats(ms: number): number;
  setBPM(bpm: number): void;
  getBPM(): number;
  convertNote(musicalNote: MusicalNote): Note;
  convertNotes(musicalNotes: MusicalNote[]): Note[];
  convertMemo(songMemo: SongMemo): Memo;
  convertMemos(songMemos: SongMemo[]): Memo[];
}