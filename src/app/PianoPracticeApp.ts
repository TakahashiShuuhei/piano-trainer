import { 
  GameEngine, 
  MIDIInputManager, 
  UIRenderer, 
  ContentManager, 
  MetronomeService,
  GameState,
  PracticeContent 
} from '../types/index.js';

export class PianoPracticeApp {
  private gameEngine!: GameEngine;
  private midiManager!: MIDIInputManager;
  private uiRenderer!: UIRenderer;
  private contentManager!: ContentManager;
  private metronome!: MetronomeService;
  
  private canvas!: HTMLCanvasElement;
  private isInitialized = false;

  constructor() {
    // コンストラクタは軽量に保つ
  }

  public async initialize(): Promise<void> {
    try {
      console.log('Piano Practice App initializing...');
      
      // DOM要素の取得
      this.setupDOMElements();
      
      // コンポーネントの初期化（後で実装）
      await this.initializeComponents();
      
      // イベントリスナーの設定
      this.setupEventListeners();
      
      // 初期コンテンツの読み込み
      this.loadInitialContent();
      
      this.isInitialized = true;
      console.log('Piano Practice App initialized successfully');
      
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
    // TODO: 各コンポーネントの実装後に初期化処理を追加
    console.log('Components will be initialized here');
  }

  private setupEventListeners(): void {
    // MIDI接続ボタン
    const connectMidiBtn = document.getElementById('connectMidiBtn');
    connectMidiBtn?.addEventListener('click', () => this.handleMidiConnect());

    // ゲーム制御ボタン
    const startBtn = document.getElementById('startBtn');
    startBtn?.addEventListener('click', () => this.handleStart());

    const pauseBtn = document.getElementById('pauseBtn');
    pauseBtn?.addEventListener('click', () => this.handlePause());

    const stopBtn = document.getElementById('stopBtn');
    stopBtn?.addEventListener('click', () => this.handleStop());

    // ウィンドウリサイズ
    window.addEventListener('resize', () => this.handleResize());
  }

  private loadInitialContent(): void {
    // TODO: ContentManagerの実装後に初期コンテンツを読み込み
    console.log('Initial content will be loaded here');
  }

  private async handleMidiConnect(): Promise<void> {
    try {
      console.log('Attempting MIDI connection...');
      // TODO: MIDIInputManagerの実装後に接続処理を追加
      this.updateMidiStatus(true);
    } catch (error) {
      console.error('MIDI connection failed:', error);
      this.showError('MIDI機器の接続に失敗しました。');
    }
  }

  private handleStart(): void {
    if (!this.isInitialized) return;
    console.log('Starting practice session...');
    // TODO: GameEngineの実装後に開始処理を追加
  }

  private handlePause(): void {
    if (!this.isInitialized) return;
    console.log('Pausing practice session...');
    // TODO: GameEngineの実装後に一時停止処理を追加
  }

  private handleStop(): void {
    if (!this.isInitialized) return;
    console.log('Stopping practice session...');
    // TODO: GameEngineの実装後に停止処理を追加
  }

  private handleResize(): void {
    // TODO: UIRendererの実装後にリサイズ処理を追加
    console.log('Window resized');
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
}