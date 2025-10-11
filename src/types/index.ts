// Musical timing system
export interface MusicalTiming {
  beat: number;         // Position in quarter notes (0 = start)
  duration: number;     // Duration in quarter notes
}

export interface MusicalNote {
  pitch: number;        // MIDI note number (0-127)
  timing: MusicalTiming;
  velocity: number;     // 0-127
  isChord?: boolean;    // true if part of chord
  chordNotes?: number[]; // other notes in chord
}

// Legacy time-based note (for backward compatibility)
export interface Note {
  pitch: number;        // MIDI note number (0-127)
  startTime: number;    // milliseconds from start
  duration: number;     // milliseconds
  velocity: number;     // 0-127
  isChord?: boolean;    // true if part of chord
  chordNotes?: number[]; // other notes in chord
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
  render(gameState: GameState, notes: Note[]): void;
  showNoteHit(note: Note, result: ScoreResult): void;
  updateScore(score: number, accuracy: number): void;
  showMetronome(beat: number): void;
  setTheme(theme: 'light' | 'dark'): void;
  setBPM(bpm: number): void;
  setCurrentTargetKeys(keys: number[]): void;
  clearTargetKeys(): void;
  startAnimationLoop(): void;
  stopAnimationLoop(): void;
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
}