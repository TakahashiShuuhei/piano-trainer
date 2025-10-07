import {
  GameEngine,
  MIDIInputManager as IMIDIInputManager,
  UIRenderer as IUIRenderer,
  ContentManager,
  MetronomeService,
  GameState,
  PracticeContent,
  Note,
  ScoreResult
} from '../types/index.js';
import { MIDIInputManager } from '../components/MIDIInputManager.js';
import { UIRenderer } from '../components/UIRenderer.js';

export class PianoPracticeApp {
  private gameEngine!: GameEngine;
  private midiManager!: IMIDIInputManager;
  private uiRenderer!: IUIRenderer;
  private contentManager!: ContentManager;
  private metronome!: MetronomeService;

  private canvas!: HTMLCanvasElement;
  private isInitialized = false;

  // 現在のゲーム状態（UIRenderer統合用）
  private currentGameState: GameState = {
    isPlaying: false,
    currentTime: 0,
    score: 0,
    accuracy: 1.0,
    currentMeasure: 1
  };

  // 現在表示中のノート（UIRenderer統合用）
  private currentNotes: Note[] = [];

  constructor() {
    // コンストラクタは軽量に保つ
  }

  public async initialize(): Promise<void> {
    try {
      // DOM要素の取得
      this.setupDOMElements();

      // コンポーネントの初期化
      await this.initializeComponents();

      // イベントリスナーの設定
      this.setupEventListeners();

      // 初期コンテンツの読み込み
      this.loadInitialContent();

      this.isInitialized = true;
      console.log('Piano Practice App ready');

    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('アプリケーションの初期化に失敗しました。');
    }
  }

  private setupDOMElements(): void {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error('Canvas element not found');
    }
  }

  private async initializeComponents(): Promise<void> {
    try {
      // UIRendererの初期化
      this.uiRenderer = new UIRenderer();
      this.uiRenderer.initCanvas(this.canvas);
      this.uiRenderer.setTheme('dark'); // デフォルトテーマ

      // MIDIInputManagerの初期化
      this.midiManager = new MIDIInputManager();

      // MIDI入力イベントのリスナーを設定
      this.midiManager.onNoteOn((note, velocity, toneTime) => {
        this.handleNoteOn(note, velocity, toneTime);
      });

      this.midiManager.onNoteOff((note, toneTime) => {
        this.handleNoteOff(note, toneTime);
      });

      // 描画ループを開始
      this.startRenderLoop();

      // TODO: 他のコンポーネントの実装後に初期化処理を追加
    } catch (error) {
      console.error('Component initialization failed:', error);
      throw error;
    }
  }



  private setupEventListeners(): void {
    console.log('=== SETTING UP EVENT LISTENERS ===');

    // MIDI接続ボタン
    const connectMidiBtn = document.getElementById('connectMidiBtn');
    if (connectMidiBtn) {
      console.log('MIDI connect button found, adding APP event listener');
      connectMidiBtn.addEventListener('click', () => {
        console.log('=== APP MIDI CONNECT BUTTON CLICKED ===');
        this.handleMidiConnect();
      });
    } else {
      console.error('MIDI connect button not found in setupEventListeners');
    }

    // ゲーム制御ボタン
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.handleStart());
    }

    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.handlePause());
    }

    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.handleStop());
    }

    // ウィンドウリサイズ
    window.addEventListener('resize', () => this.handleResize());

    // キーボード入力のフォールバック（MIDI未接続時用）
    document.addEventListener('keydown', (event) => this.handleKeyboardInput(event));

    console.log('Event listeners setup completed');
  }

  private loadInitialContent(): void {
    // TODO: ContentManagerの実装後に初期コンテンツを読み込み
    console.log('Initial content will be loaded here');
  }

  private async handleMidiConnect(): Promise<void> {
    console.log('=== APP MIDI CONNECT HANDLER CALLED ===');

    if (!this.midiManager) {
      console.error('=== MIDI MANAGER NOT INITIALIZED ===');
      alert('MIDI Manager が初期化されていません');
      return;
    }

    console.log('=== MIDI MANAGER EXISTS, PROCEEDING ===');

    try {
      console.log('Attempting MIDI connection...');

      const success = await this.midiManager.requestAccess();

      if (success) {
        const devices = this.midiManager.getAvailableDevices();
        console.log(`Found ${devices.length} MIDI input devices`);

        if (devices.length > 0) {
          // Transport との同期を開始
          await this.midiManager.syncWithTransport();
          this.updateMidiStatus(true);
          console.log('MIDI connection successful');
        } else {
          this.showError('MIDI入力デバイスが見つかりません。電子ピアノが接続されているか確認してください。');
          this.updateMidiStatus(false);
        }
      } else {
        this.showError('MIDI アクセスが拒否されました。ブラウザの設定を確認してください。');
        this.updateMidiStatus(false);
      }
    } catch (error) {
      console.error('MIDI connection failed:', error);
      this.showError('MIDI機器の接続に失敗しました。');
      this.updateMidiStatus(false);
    }
  }

  private handleStart(): void {
    if (!this.isInitialized) return;
    console.log('Starting practice session...');

    // ゲーム状態を開始に変更
    this.currentGameState.isPlaying = true;
    this.currentGameState.currentTime = 0;

    // サンプルノートを追加（テスト用）
    this.loadSampleNotes();

    this.updateGameStateDisplay();

    // TODO: GameEngineの実装後に開始処理を追加
  }

  private handlePause(): void {
    if (!this.isInitialized) return;
    console.log('Pausing practice session...');

    // ゲーム状態を一時停止に変更
    this.currentGameState.isPlaying = false;
    this.updateGameStateDisplay();

    // TODO: GameEngineの実装後に一時停止処理を追加
  }

  private handleStop(): void {
    if (!this.isInitialized) return;
    console.log('Stopping practice session...');

    // ゲーム状態をリセット
    this.currentGameState.isPlaying = false;
    this.currentGameState.currentTime = 0;
    this.currentGameState.score = 0;
    this.currentGameState.accuracy = 1.0;
    this.currentGameState.currentMeasure = 1;

    // ノートをクリア
    this.currentNotes = [];

    this.updateGameStateDisplay();

    // TODO: GameEngineの実装後に停止処理を追加
  }

  private handleResize(): void {
    // UIRendererは自動的にリサイズを処理するため、特別な処理は不要
    console.log('Window resized - UIRenderer will handle canvas resize automatically');
  }

  private updateMidiStatus(connected: boolean): void {
    const statusElement = document.getElementById('midiStatus');
    if (statusElement) {
      statusElement.textContent = connected ? 'MIDI接続済み' : 'MIDI未接続';
      statusElement.className = connected ? 'midi-status midi-connected' : 'midi-status midi-disconnected';
    }

    // ボタンの有効/無効を切り替え
    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    if (startBtn) {
      startBtn.disabled = !connected;
    }
  }

  private updateGameState(state: GameState): void {
    // スコア表示の更新
    const scoreElement = document.getElementById('scoreValue');
    if (scoreElement) {
      scoreElement.textContent = state.score.toString();
    }

    const accuracyElement = document.getElementById('accuracyValue');
    if (accuracyElement) {
      accuracyElement.textContent = `${Math.round(state.accuracy)}%`;
    }

    // ボタンの状態更新
    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
    const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;

    if (startBtn && pauseBtn && stopBtn) {
      startBtn.disabled = state.isPlaying;
      pauseBtn.disabled = !state.isPlaying;
      stopBtn.disabled = !state.isPlaying;
    }
  }

  private handleNoteOn(note: number, velocity: number, toneTime: number): void {
    console.log(`Note ON received: ${note} (${this.midiManager.convertNoteToNoteName(note)}), velocity: ${velocity}`);

    // TODO: GameEngineの実装後に演奏評価処理を追加
    // const result = this.gameEngine.processNoteInput(note, toneTime);

    // 仮のスコア結果を作成（GameEngine実装まで）
    const mockResult: ScoreResult = {
      isCorrect: true,
      timingAccuracy: 0.9,
      points: 100,
      feedback: 'perfect'
    };

    // UIRendererで視覚的フィードバックを表示
    const noteObj: Note = {
      pitch: note,
      startTime: Date.now(),
      duration: 500,
      velocity: velocity
    };

    this.uiRenderer.showNoteHit(noteObj, mockResult);

    // スコアを更新（仮）
    this.currentGameState.score += mockResult.points;
    this.updateGameStateDisplay();
  }

  private handleNoteOff(note: number, toneTime: number): void {
    console.log(`Note OFF received: ${note} (${this.midiManager.convertNoteToNoteName(note)})`);

    // TODO: 必要に応じてNote Offの処理を追加
    // 現在は特別な処理は不要
  }

  /**
   * 描画ループを開始
   */
  private startRenderLoop(): void {
    const render = () => {
      // UIRendererで画面を描画
      this.uiRenderer.render(this.currentGameState, this.currentNotes);

      // 次のフレームをリクエスト
      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
    console.log('Render loop started');
  }

  /**
   * ゲーム状態表示を更新
   */
  private updateGameStateDisplay(): void {
    // DOM要素の更新
    this.updateGameState(this.currentGameState);

    // UIRendererのスコア表示も更新
    this.uiRenderer.updateScore(this.currentGameState.score, this.currentGameState.accuracy);
  }

  private handleKeyboardInput(event: KeyboardEvent): void {
    console.log(`Key pressed: ${event.key}`);

    // キーボードをピアノの鍵盤として使用（フォールバック機能）
    const keyToNote: { [key: string]: number } = {
      'a': 60, // C4
      'w': 61, // C#4
      's': 62, // D4
      'e': 63, // D#4
      'd': 64, // E4
      'f': 65, // F4
      't': 66, // F#4
      'g': 67, // G4
      'y': 68, // G#4
      'h': 69, // A4
      'u': 70, // A#4
      'j': 71, // B4
      'k': 72, // C5
    };

    const note = keyToNote[event.key.toLowerCase()];
    if (note !== undefined && !event.repeat) {
      console.log(`=== KEYBOARD NOTE: ${event.key} -> Note ${note} ===`);
      alert(`キーボード入力: ${event.key} -> 音符 ${note}`);
      this.handleNoteOn(note, 100, 0); // velocity 100, toneTime 0 for keyboard input

      // キーボード入力の場合は短時間後にNote Offを送信
      setTimeout(() => {
        this.handleNoteOff(note, 0);
      }, 200);
    }
  }

  /**
   * テスト用のサンプルノートを読み込み
   */
  private loadSampleNotes(): void {
    const now = Date.now();
    this.currentNotes = [
      {
        pitch: 60, // C4
        startTime: now + 2000,
        duration: 500,
        velocity: 80
      },
      {
        pitch: 62, // D4
        startTime: now + 3000,
        duration: 500,
        velocity: 80
      },
      {
        pitch: 64, // E4
        startTime: now + 4000,
        duration: 500,
        velocity: 80
      },
      {
        pitch: 65, // F4
        startTime: now + 5000,
        duration: 500,
        velocity: 80
      }
    ];

    console.log('Sample notes loaded:', this.currentNotes.length);
  }

  private showError(message: string): void {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      setTimeout(() => {
        errorElement.style.display = 'none';
      }, 5000);
    }
  }

  /**
   * リソースのクリーンアップ
   */
  public destroy(): void {
    if (this.uiRenderer) {
      this.uiRenderer.destroy();
    }

    if (this.midiManager) {
      this.midiManager.disconnect();
    }

    console.log('PianoPracticeApp destroyed');
  }
}