// Core data models
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
  feedback: 'perfect' | 'good' | 'miss';
}

export interface GameState {
  isPlaying: boolean;
  currentTime: number;
  score: number;
  accuracy: number;
  currentMeasure: number;
}

// Component interfaces
export interface MIDIInputManager {
  requestAccess(): Promise<boolean>;
  getAvailableDevices(): MIDIInput[];
  onNoteOn(callback: (note: number, velocity: number, toneTime: number) => void): void;
  onNoteOff(callback: (note: number, toneTime: number) => void): void;
  convertNoteToFrequency(note: number): number;
  disconnect(): void;
}

export interface GameEngine {
  loadContent(content: PracticeContent): void;
  start(): void;
  pause(): void;
  stop(): void;
  processNoteInput(note: number, timestamp: number): ScoreResult;
  getCurrentState(): GameState;
  onStateChange(callback: (state: GameState) => void): void;
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
  startAnimationLoop(): void;
  stopAnimationLoop(): void;
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
  onBeat(callback: (beat: number, measure: number) => void): void;
  setVolume(volume: number): void;
  getTransport(): any; // Tone.Transport type
  scheduleCallback(callback: () => void, time: string): void;
  scheduleRepeat(callback: () => void, interval: string): void;
  getCurrentTime(): number;
  convertTimeToBeats(time: number): number;
}