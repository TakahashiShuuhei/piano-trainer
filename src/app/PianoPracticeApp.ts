import { 
  GameEngine, 
  MIDIInputManager as IMIDIInputManager, 
  UIRenderer, 
  ContentManager, 
  MetronomeService,
  GameState,
  PracticeContent 
} from '../types/index.js';
import { MIDIInputManager } from '../components/MIDIInputManager.js';

export class PianoPracticeApp {
  private gameEngine!: GameEngine;
  private midiManager!: IMIDIInputManager;
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
    // MIDIInputManagerの初期化
    this.midiManager = new MIDIInputManager();
    
    // MIDI入力イベントのリスナーを設定
    this.midiManager.onNoteOn((note, velocity, toneTime) => {
      this.handleNoteOn(note, velocity, toneTime);
    });
    
    this.midiManager.onNoteOff((note, toneTime) => {
      this.handleNoteOff(note, toneTime);
    });

    console.log('MIDI Input Manager initialized');
    
    // TODO: 他のコンポーネントの実装後に初期化処理を追加
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
      
      const success = await this.midiManager.requestAccess();
      
      if (success) {
        const devices = this.midiManager.getAvailableDevices();
        console.log(`Found ${devices.length} MIDI input devices`);
        
        if (devices.length > 0) {
          // Transport との同期を開始
          this.midiManager.syncWithTransport();
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

  private handleNoteOn(note: number, velocity: number, toneTime: number): void {
    console.log(`Note ON received: ${note} (${this.midiManager.convertNoteToNoteName(note)}), velocity: ${velocity}`);
    
    // TODO: GameEngineの実装後に演奏評価処理を追加
    // const result = this.gameEngine.processNoteInput(note, toneTime);
    
    // 視覚的フィードバック（簡易版）
    this.showNoteHit(note, velocity);
  }

  private handleNoteOff(note: number, toneTime: number): void {
    console.log(`Note OFF received: ${note} (${this.midiManager.convertNoteToNoteName(note)})`);
    
    // TODO: 必要に応じてNote Offの処理を追加
  }

  private showNoteHit(note: number, velocity: number): void {
    // 簡易的な視覚フィードバック
    const canvas = this.canvas;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // 画面上部に音符名を表示
      ctx.fillStyle = `rgba(76, 175, 80, ${velocity / 127})`;
      ctx.font = '24px Arial';
      ctx.fillText(
        this.midiManager.convertNoteToNoteName(note), 
        Math.random() * (canvas.width - 100) + 50, 
        50
      );
      
      // 一定時間後にクリア（簡易版）
      setTimeout(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }, 1000);
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