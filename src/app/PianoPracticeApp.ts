import {
  GameEngine,
  MIDIInputManager as IMIDIInputManager,
  UIRenderer as IUIRenderer,
  ContentManager,
  MetronomeService,
  GameState,
  GamePhase,
  PracticeContent,
  Note,
  ScoreResult,
  MusicalNote,
  BeatTimeConverter as IBeatTimeConverter
} from '../types/index.js';
import { MIDIInputManager } from '../components/MIDIInputManager';
import { UIRenderer } from '../components/UIRenderer';
import { BeatTimeConverter } from '../utils/BeatTimeConverter';
import { MusicalTimeManager } from '../utils/MusicalTimeManager';
import { AudioFeedbackManager } from '../utils/AudioFeedbackManager';

export class PianoPracticeApp {
  private gameEngine!: GameEngine;
  private midiManager!: IMIDIInputManager;
  private uiRenderer!: IUIRenderer;
  private contentManager!: ContentManager;
  private metronome!: MetronomeService;

  private canvas!: HTMLCanvasElement;
  private isInitialized = false;

  // 音楽的タイミングシステム
  private beatTimeConverter!: IBeatTimeConverter;
  private musicalTimeManager!: MusicalTimeManager;
  private audioFeedbackManager!: AudioFeedbackManager;
  private currentBPM = 120;

  // 現在のゲーム状態（UIRenderer統合用）
  private currentGameState: GameState = {
    phase: GamePhase.STOPPED,
    isPlaying: false,
    currentTime: 0, // 実時間（ミリ秒）
    score: 0,
    accuracy: 1.0
  };

  // カウントダウン関連
  private countdownTimer: NodeJS.Timeout | null = null;
  private countdownStartTime: number = 0;

  // 音楽的ノート（拍ベース）
  private musicalNotes: MusicalNote[] = [];
  // 現在表示中のノート（時間ベース、UIRenderer用）
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
      // 音楽的タイミングシステムの初期化
      this.beatTimeConverter = new BeatTimeConverter(this.currentBPM);
      this.musicalTimeManager = new MusicalTimeManager(this.currentBPM);
      this.audioFeedbackManager = new AudioFeedbackManager();

      // UIRendererの初期化
      this.uiRenderer = new UIRenderer();
      this.uiRenderer.initCanvas(this.canvas);
      this.uiRenderer.setTheme('dark'); // デフォルトテーマ
      this.uiRenderer.setBPM(this.currentBPM); // 初期BPMを設定

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

    // BPM調整コントロール
    this.setupBPMControls();

    // 音量調整コントロール
    this.setupVolumeControls();

    // ループ練習コントロール
    this.setupLoopControls();

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
          
          // オーディオコンテキストを開始
          await this.audioFeedbackManager.startAudioContext();
          
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

  private async handleStart(): Promise<void> {
    if (!this.isInitialized) return;
    console.log('Starting countdown...');

    // オーディオコンテキストを開始（ユーザージェスチャー）
    await this.audioFeedbackManager.startAudioContext();

    // カウントダウンを開始
    this.startCountdown();
  }

  /**
   * カウントダウンを開始
   */
  private startCountdown(): void {
    // ゲーム状態をカウントダウンに変更
    this.currentGameState.phase = GamePhase.COUNTDOWN;
    this.currentGameState.isPlaying = false;
    this.currentGameState.countdownValue = 4;

    // サンプルノートを追加（カウントダウン中に準備）
    this.loadSampleNotes();

    this.updateGameStateDisplay();

    // カウントダウンタイマーを開始
    this.countdownStartTime = Date.now();
    let countdownValue = 4;

    const countdownInterval = setInterval(() => {
      const elapsed = Date.now() - this.countdownStartTime;
      const beatDuration = 60000 / this.currentBPM; // 1拍の長さ（ミリ秒）
      const expectedCount = 4 - Math.floor(elapsed / beatDuration);

      if (expectedCount !== countdownValue && expectedCount >= 0) {
        countdownValue = expectedCount;
        this.currentGameState.countdownValue = countdownValue;
        
        // メトロノーム音を再生
        this.audioFeedbackManager.playCountdownBeep(countdownValue);
        
        console.log(`Countdown: ${countdownValue || 'START!'}`);
      }

      // カウントダウン完了
      if (elapsed >= beatDuration * 4) {
        clearInterval(countdownInterval);
        this.startActualGame();
      }
    }, 50); // 50msごとにチェック

    this.countdownTimer = countdownInterval as NodeJS.Timeout;
  }

  /**
   * 実際のゲームを開始（カウントダウン完了後）
   */
  private startActualGame(): void {
    console.log('Starting actual game...');

    // 音楽的時間管理を開始
    this.musicalTimeManager.start();

    // ゲーム状態を開始に変更
    this.currentGameState.phase = GamePhase.PLAYING;
    this.currentGameState.isPlaying = true;
    this.currentGameState.currentTime = 0;
    this.currentGameState.countdownValue = undefined;

    // 再生済みノートをクリア
    this.playedNotes.clear();

    this.updateGameStateDisplay();
  }



  private handlePause(): void {
    if (!this.isInitialized) return;

    // カウントダウン中は一時停止できない
    if (this.currentGameState.phase === GamePhase.COUNTDOWN) {
      return;
    }

    if (this.currentGameState.phase === GamePhase.PLAYING) {
      // 一時停止
      console.log('Pausing practice session...');
      this.musicalTimeManager.pause();
      this.currentGameState.phase = GamePhase.PAUSED;
      this.currentGameState.isPlaying = false;
    } else if (this.currentGameState.phase === GamePhase.PAUSED) {
      // 再開
      console.log('Resuming practice session...');
      this.musicalTimeManager.resume();
      this.currentGameState.phase = GamePhase.PLAYING;
      this.currentGameState.isPlaying = true;
    }

    this.updateGameStateDisplay();
  }

  private handleStop(): void {
    if (!this.isInitialized) return;
    console.log('Stopping practice session...');

    // カウントダウンタイマーをクリア
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer as NodeJS.Timeout);
      this.countdownTimer = null;
    }

    // 音楽的時間管理を停止
    this.musicalTimeManager.stop();

    // ゲーム状態をリセット
    this.currentGameState.phase = GamePhase.STOPPED;
    this.currentGameState.isPlaying = false;
    this.currentGameState.currentTime = 0;
    this.currentGameState.score = 0;
    this.currentGameState.accuracy = 1.0;
    this.currentGameState.countdownValue = undefined;

    // ノートをクリア
    this.currentNotes = [];
    this.musicalNotes = [];

    // 演奏ガイドをクリア
    this.uiRenderer.clearTargetKeys();

    // 再生済みノートをクリア
    this.playedNotes.clear();

    // ループ統計をクリア
    this.loopCount = 0;
    this.loopStats = [];

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
      accuracyElement.textContent = `${Math.round(state.accuracy * 100)}%`;
    }

    // ボタンの状態更新
    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    const pauseBtn = document.getElementById('pauseBtn') as HTMLButtonElement;
    const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;

    if (startBtn && pauseBtn && stopBtn) {
      switch (state.phase) {
        case GamePhase.STOPPED:
          startBtn.disabled = false;
          pauseBtn.disabled = true;
          stopBtn.disabled = true;
          pauseBtn.textContent = '一時停止';
          break;
          
        case GamePhase.COUNTDOWN:
          startBtn.disabled = true;
          pauseBtn.disabled = true; // カウントダウン中は一時停止不可
          stopBtn.disabled = false;
          pauseBtn.textContent = '一時停止';
          break;
          
        case GamePhase.PLAYING:
          startBtn.disabled = true;
          pauseBtn.disabled = false;
          stopBtn.disabled = false;
          pauseBtn.textContent = '一時停止';
          break;
          
        case GamePhase.PAUSED:
          startBtn.disabled = true;
          pauseBtn.disabled = false;
          stopBtn.disabled = false;
          pauseBtn.textContent = '再開';
          break;
      }
    }
  }

  private handleNoteOn(note: number, velocity: number, toneTime: number): void {
    console.log(`Note ON received: ${note} (${this.midiManager.convertNoteToNoteName(note)}), velocity: ${velocity}`);

    // 鍵盤のハイライトを開始
    this.uiRenderer.setKeyPressed(note, true);

    // TODO: GameEngineの実装後に演奏評価処理を追加
    // const result = this.gameEngine.processNoteInput(note, toneTime);

    // 仮のスコア結果を作成（GameEngine実装まで）
    const mockResult: ScoreResult = {
      isCorrect: true,
      timingAccuracy: 0.9,
      points: 100,
      feedback: 'perfect'
    };

    // 音声フィードバックを再生（演奏時のフィードバック）
    if (mockResult.isCorrect) {
      // 正解時：押したノートの音程を短く再生（楽譜の自動再生と区別）
      this.audioFeedbackManager.playNoteSound(note, 0.2);
    } else {
      // 不正解時：エラー音を再生
      this.audioFeedbackManager.playErrorSound();
    }

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

    // 鍵盤のハイライトを終了
    this.uiRenderer.setKeyPressed(note, false);

    // TODO: 必要に応じてNote Offの処理を追加
  }

  /**
   * 描画ループを開始
   */
  private startRenderLoop(): void {
    const render = () => {
      // ゲームが再生中の場合、時間を進める
      if (this.currentGameState.phase === GamePhase.PLAYING && this.musicalTimeManager.isStarted()) {
        // 音楽的時間管理から現在時刻を取得
        this.currentGameState.currentTime = this.musicalTimeManager.getCurrentRealTime();
        
        // 演奏ガイドを更新
        this.updatePlayingGuide();
        
        // 楽譜終了とループ処理をチェック
        this.checkForLoopRestart();
      }

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
      this.handleNoteOn(note, 100, 0); // velocity 100, toneTime 0 for keyboard input

      // キーボード入力の場合は短時間後にNote Offを送信
      setTimeout(() => {
        this.handleNoteOff(note, 0);
      }, 200);
    }
  }

  /**
   * テスト用のサンプルノートを読み込み（音楽的タイミングベース）
   */
  private loadSampleNotes(): void {
    // 音楽的ノートを定義（拍ベース）
    this.musicalNotes = [
      // 単音のメロディー（4拍子）
      { pitch: 60, timing: { beat: 0, duration: 1 }, velocity: 80 },    // C4: 0拍目
      { pitch: 62, timing: { beat: 1, duration: 1 }, velocity: 90 },    // D4: 1拍目
      { pitch: 64, timing: { beat: 2, duration: 1 }, velocity: 85 },    // E4: 2拍目
      { pitch: 65, timing: { beat: 3, duration: 1 }, velocity: 75 },    // F4: 3拍目

      // コード（和音）のテスト - Cメジャーコード
      { pitch: 60, timing: { beat: 4, duration: 2 }, velocity: 80, isChord: true, chordNotes: [64, 67] }, // C4
      { pitch: 64, timing: { beat: 4, duration: 2 }, velocity: 80, isChord: true },                        // E4
      { pitch: 67, timing: { beat: 4, duration: 2 }, velocity: 80, isChord: true },                        // G4

      // 黒鍵のテスト
      { pitch: 61, timing: { beat: 6, duration: 0.5 }, velocity: 70 },   // C#4: 6拍目（八分音符）
      { pitch: 63, timing: { beat: 6.5, duration: 0.5 }, velocity: 70 }, // D#4: 6.5拍目（八分音符）

      // より複雑なコード - Amコード
      { pitch: 57, timing: { beat: 8, duration: 3 }, velocity: 85, isChord: true, chordNotes: [60, 64] }, // A3
      { pitch: 60, timing: { beat: 8, duration: 3 }, velocity: 85, isChord: true },                       // C4
      { pitch: 64, timing: { beat: 8, duration: 3 }, velocity: 85, isChord: true },                       // E4

      // 3連符のテスト
      { pitch: 72, timing: { beat: 12, duration: 1 / 3 }, velocity: 80 },     // C5: 12拍目（3連符1つ目）
      { pitch: 74, timing: { beat: 12 + 1 / 3, duration: 1 / 3 }, velocity: 80 }, // D5: 3連符2つ目
      { pitch: 76, timing: { beat: 12 + 2 / 3, duration: 1 / 3 }, velocity: 80 }, // E5: 3連符3つ目
    ];

    // 音楽的ノートを時間ベースに変換してUIRenderer用に設定
    this.updateCurrentNotes();

    console.log('Musical notes loaded:', this.musicalNotes.length);
    console.log('Current BPM:', this.currentBPM);
  }

  /**
   * 音楽的ノートを時間ベースのノートに変換してcurrentNotesを更新
   */
  private updateCurrentNotes(): void {
    const timeBasedNotes = this.beatTimeConverter.convertNotes(this.musicalNotes);
    console.log("aaaaaa")

    // 相対時間として設定（ゲーム開始時刻は加算しない）
    this.currentNotes = timeBasedNotes.map(note => ({
      ...note,
      startTime: note.startTime // そのまま相対時間として使用
    }));

    console.log(`[PianoPracticeApp] Updated notes:`, {
      musicalNotesCount: this.musicalNotes.length,
      timeBasedNotesCount: this.currentNotes.length,
      firstNoteStartTime: this.currentNotes[0]?.startTime,
      sampleNotes: this.currentNotes.slice(0, 3).map(n => ({
        pitch: n.pitch,
        startTime: n.startTime,
        duration: n.duration
      }))
    });
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
   * BPM調整コントロールを設定
   */
  private setupBPMControls(): void {
    const bpmSlider = document.getElementById('bpmSlider') as HTMLInputElement;
    const bpmDisplay = document.getElementById('bpmDisplay');
    const bpmValue = document.getElementById('bpmValue');
    const bpmUp = document.getElementById('bpmUp');
    const bpmDown = document.getElementById('bpmDown');

    if (bpmSlider && bpmDisplay && bpmValue) {
      // スライダーの変更イベント
      bpmSlider.addEventListener('input', (event) => {
        const newBPM = parseInt((event.target as HTMLInputElement).value);
        this.setBPM(newBPM);
        this.updateBPMDisplay(newBPM);
      });

      // +ボタン
      if (bpmUp) {
        bpmUp.addEventListener('click', () => {
          const newBPM = Math.min(200, this.currentBPM + 5);
          this.setBPM(newBPM);
          this.updateBPMDisplay(newBPM);
          bpmSlider.value = newBPM.toString();
        });
      }

      // -ボタン
      if (bpmDown) {
        bpmDown.addEventListener('click', () => {
          const newBPM = Math.max(60, this.currentBPM - 5);
          this.setBPM(newBPM);
          this.updateBPMDisplay(newBPM);
          bpmSlider.value = newBPM.toString();
        });
      }

      // 初期表示を更新
      this.updateBPMDisplay(this.currentBPM);
    }
  }

  /**
   * BPM表示を更新
   */
  private updateBPMDisplay(bpm: number): void {
    const bpmDisplay = document.getElementById('bpmDisplay');
    const bpmValue = document.getElementById('bpmValue');

    if (bpmDisplay) {
      bpmDisplay.textContent = bpm.toString();
    }

    if (bpmValue) {
      bpmValue.textContent = bpm.toString();
    }
  }

  /**
   * BPMを変更（音楽的位置を保持）
   */
  public setBPM(newBPM: number): void {
    if (newBPM <= 0) {
      console.error('BPM must be greater than 0');
      return;
    }

    this.currentBPM = newBPM;
    
    // 音楽的時間管理でBPMを変更（音楽的位置を保持）
    this.musicalTimeManager.setBPM(newBPM);
    
    // BeatTimeConverterも更新
    this.beatTimeConverter.setBPM(newBPM);

    // UIRendererにもBPMを設定
    this.uiRenderer.setBPM(newBPM);

    // 既存の音楽的ノートを新しいBPMで再変換
    if (this.musicalNotes.length > 0) {
      this.updateCurrentNotes();
    }

    console.log(`BPM changed to: ${newBPM} (musical position preserved)`);
  }

  /**
   * 現在のBPMを取得
   */
  public getBPM(): number {
    return this.currentBPM;
  }

  /**
   * シークバー用：楽曲の進行度を取得（0-1）
   */
  public getProgress(): number {
    if (!this.musicalTimeManager.isStarted() || this.currentNotes.length === 0) {
      return 0;
    }
    
    // 最後のノートの終了時刻を楽曲の長さとする
    const lastNote = this.currentNotes[this.currentNotes.length - 1];
    if (!lastNote) return 0;
    
    const totalDuration = lastNote.startTime + lastNote.duration;
    return this.musicalTimeManager.getProgress(totalDuration);
  }

  /**
   * シークバー用：指定した進行度（0-1）の位置にシーク
   */
  public seekToProgress(progress: number): void {
    if (!this.musicalTimeManager.isStarted() || this.currentNotes.length === 0) {
      return;
    }
    
    const lastNote = this.currentNotes[this.currentNotes.length - 1];
    if (!lastNote) return;
    
    const totalDuration = lastNote.startTime + lastNote.duration;
    this.musicalTimeManager.setProgress(progress, totalDuration);
    
    console.log(`Seeked to ${(progress * 100).toFixed(1)}%`);
  }

  /**
   * シークバー用：指定した音楽的位置（拍数）にシーク
   */
  public seekToMusicalPosition(beats: number): void {
    this.musicalTimeManager.seekToMusicalPosition(beats);
    console.log(`Seeked to beat ${beats.toFixed(2)}`);
  }

  // 既に再生したノートを追跡
  private playedNotes = new Set<string>();

  // ループ練習機能
  private isLoopEnabled = false;
  private loopCount = 0; // 現在のループ回数
  private maxLoops = 3; // 最大ループ回数（0 = 無限）
  private loopStats: Array<{ score: number; accuracy: number; completedAt: number }> = [];

  /**
   * 演奏ガイドを更新
   */
  private updatePlayingGuide(): void {
    const currentTime = this.currentGameState.currentTime;

    // 現在演奏中のノート（開始時刻から終了時刻まで）
    const activeNotes = this.currentNotes.filter(note => {
      const noteStartTime = note.startTime;
      const noteEndTime = note.startTime + note.duration;
      return currentTime >= noteStartTime && currentTime <= noteEndTime;
    });

    // 現在のターゲット鍵盤を設定（ノート期間中のみ）
    const currentTargetKeys = activeNotes.map(note => note.pitch);
    this.uiRenderer.setCurrentTargetKeys(currentTargetKeys);

    // 楽譜のノートを自動再生
    this.playScheduledNotes(currentTime);
  }

  /**
   * 楽譜のノートを指定されたタイミングで自動再生
   */
  private playScheduledNotes(currentTime: number): void {
    const tolerance = 50; // 50ms の許容範囲

    this.currentNotes.forEach(note => {
      const noteId = `${note.pitch}-${note.startTime}`;
      
      // 既に再生済みのノートはスキップ
      if (this.playedNotes.has(noteId)) {
        return;
      }

      // ノートの開始タイミングに到達したか確認
      if (Math.abs(currentTime - note.startTime) <= tolerance && currentTime >= note.startTime) {
        console.log(`Auto-playing scheduled note: ${note.pitch} at time ${currentTime}`);
        
        // ノートを再生
        this.audioFeedbackManager.playNoteSound(note.pitch, note.duration / 1000); // msを秒に変換
        
        // 再生済みとしてマーク
        this.playedNotes.add(noteId);
      }
    });
  }

  /**
   * 音量調整コントロールを設定
   */
  private setupVolumeControls(): void {
    const volumeSlider = document.getElementById('volumeSlider') as HTMLInputElement;
    const volumeDisplay = document.getElementById('volumeDisplay');
    const muteBtn = document.getElementById('muteBtn');

    if (volumeSlider && volumeDisplay) {
      // スライダーの変更イベント
      volumeSlider.addEventListener('input', (event) => {
        const volumePercent = parseInt((event.target as HTMLInputElement).value);
        const volume = volumePercent / 100; // 0-1に変換
        this.setAudioVolume(volume);
        this.updateVolumeDisplay(volumePercent);
      });

      // 初期表示を更新
      const initialVolume = Math.round(this.getAudioVolume() * 100);
      volumeSlider.value = initialVolume.toString();
      this.updateVolumeDisplay(initialVolume);
    }

    // ミュートボタン
    if (muteBtn) {
      muteBtn.addEventListener('click', async () => {
        // オーディオコンテキストを開始（初回クリック時）
        await this.audioFeedbackManager.startAudioContext();
        
        const isMuted = this.toggleAudioMute();
        this.updateMuteButton(isMuted);
        
        // テスト音を再生（ミュート解除時）
        if (!isMuted) {
          console.log('Playing test sound...');
          this.audioFeedbackManager.playNoteSound(60, 0.3); // C4
        }
      });

      // 初期状態を更新
      this.updateMuteButton(this.isAudioMuted());
    }
  }

  /**
   * 音量表示を更新
   */
  private updateVolumeDisplay(volumePercent: number): void {
    const volumeDisplay = document.getElementById('volumeDisplay');
    if (volumeDisplay) {
      volumeDisplay.textContent = `${volumePercent}%`;
    }
  }

  /**
   * ミュートボタンの表示を更新
   */
  private updateMuteButton(isMuted: boolean): void {
    const muteBtn = document.getElementById('muteBtn');
    if (muteBtn) {
      muteBtn.textContent = isMuted ? '🔇' : '🔊';
      muteBtn.title = isMuted ? 'ミュート解除' : 'ミュート';
    }
  }

  /**
   * 音量を設定 (0-1)
   */
  public setAudioVolume(volume: number): void {
    this.audioFeedbackManager.setVolume(volume);
  }

  /**
   * 現在の音量を取得 (0-1)
   */
  public getAudioVolume(): number {
    return this.audioFeedbackManager.getVolume();
  }

  /**
   * ミュート状態をトグル
   */
  public toggleAudioMute(): boolean {
    return this.audioFeedbackManager.toggleMute();
  }

  /**
   * ミュート状態を取得
   */
  public isAudioMuted(): boolean {
    return this.audioFeedbackManager.isMutedState();
  }

  /**
   * 楽譜終了とループ処理をチェック
   */
  private checkForLoopRestart(): void {
    if (this.currentNotes.length === 0) return;

    const currentTime = this.currentGameState.currentTime;
    
    // 最後のノートの終了時刻を取得
    const lastNote = this.currentNotes[this.currentNotes.length - 1];
    if (!lastNote) return;
    
    const songEndTime = lastNote.startTime + lastNote.duration;
    
    // 楽譜が終了したかチェック（1秒のマージン）
    if (currentTime >= songEndTime + 1000) {
      console.log('Song completed, checking for loop restart...');
      
      if (this.isLoopEnabled) {
        this.handleLoopRestart();
      } else {
        this.handleSongComplete();
      }
    }
  }

  /**
   * ループ再開処理
   */
  private handleLoopRestart(): void {
    // 現在のループの統計を記録
    this.recordLoopStats();
    
    this.loopCount++;
    console.log(`Starting loop ${this.loopCount}/${this.maxLoops === 0 ? '∞' : this.maxLoops}`);
    
    // ループ状態表示を更新
    this.updateLoopStatus();
    
    // 最大ループ回数に達した場合は終了
    if (this.maxLoops > 0 && this.loopCount >= this.maxLoops) {
      console.log('Maximum loops reached, ending practice session');
      this.handleSongComplete();
      return;
    }
    
    // ループ再開
    this.restartSong();
  }

  /**
   * 楽曲完了処理
   */
  private handleSongComplete(): void {
    console.log('Practice session completed');
    
    // 最終統計を記録
    this.recordLoopStats();
    
    // 統計情報を表示
    this.showLoopStatistics();
    
    // ゲームを停止
    this.handleStop();
  }

  /**
   * 楽曲を最初から再開
   */
  private restartSong(): void {
    // 音楽的時間管理をリセット
    this.musicalTimeManager.stop();
    this.musicalTimeManager.start();
    
    // ゲーム状態をリセット（スコアは保持）
    this.currentGameState.currentTime = 0;
    
    // 再生済みノートをクリア
    this.playedNotes.clear();
    
    // 演奏ガイドをクリア
    this.uiRenderer.clearTargetKeys();
    
    console.log('Song restarted for loop practice');
  }

  /**
   * ループ統計を記録
   */
  private recordLoopStats(): void {
    this.loopStats.push({
      score: this.currentGameState.score,
      accuracy: this.currentGameState.accuracy,
      completedAt: Date.now()
    });
  }

  /**
   * ループ統計を表示
   */
  private showLoopStatistics(): void {
    if (this.loopStats.length === 0) return;
    
    const totalScore = this.loopStats.reduce((sum, stat) => sum + stat.score, 0);
    const averageScore = Math.round(totalScore / this.loopStats.length);
    
    const totalAccuracy = this.loopStats.reduce((sum, stat) => sum + stat.accuracy, 0);
    const averageAccuracy = (totalAccuracy / this.loopStats.length * 100).toFixed(1);
    
    console.log('=== Loop Practice Statistics ===');
    console.log(`Loops completed: ${this.loopStats.length}`);
    console.log(`Average score: ${averageScore}`);
    console.log(`Average accuracy: ${averageAccuracy}%`);
    
    // 改善度を計算（最初と最後の比較）
    if (this.loopStats.length > 1) {
      const firstLoop = this.loopStats[0];
      const lastLoop = this.loopStats[this.loopStats.length - 1];
      
      const scoreImprovement = lastLoop.score - firstLoop.score;
      const accuracyImprovement = ((lastLoop.accuracy - firstLoop.accuracy) * 100).toFixed(1);
      
      console.log(`Score improvement: ${scoreImprovement > 0 ? '+' : ''}${scoreImprovement}`);
      console.log(`Accuracy improvement: ${accuracyImprovement > 0 ? '+' : ''}${accuracyImprovement}%`);
    }
    
    // UIに統計情報を表示（簡易版）
    this.showStatsInUI(averageScore, parseFloat(averageAccuracy));
  }

  /**
   * UIに統計情報を表示
   */
  private showStatsInUI(averageScore: number, averageAccuracy: number): void {
    // 簡易的にアラートで表示（後でより良いUIに変更可能）
    const message = `ループ練習完了！\n` +
                   `完了回数: ${this.loopStats.length}\n` +
                   `平均スコア: ${averageScore}\n` +
                   `平均正解率: ${averageAccuracy}%`;
    
    setTimeout(() => {
      alert(message);
    }, 500);
  }

  /**
   * ループ練習を有効/無効にする
   */
  public setLoopEnabled(enabled: boolean): void {
    this.isLoopEnabled = enabled;
    console.log(`Loop practice ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * 最大ループ回数を設定
   */
  public setMaxLoops(maxLoops: number): void {
    this.maxLoops = maxLoops;
    console.log(`Max loops set to: ${maxLoops === 0 ? 'infinite' : maxLoops}`);
  }

  /**
   * ループ練習コントロールを設定
   */
  private setupLoopControls(): void {
    const loopEnabled = document.getElementById('loopEnabled') as HTMLInputElement;
    const loopCount = document.getElementById('loopCount') as HTMLSelectElement;
    const loopStatus = document.getElementById('loopStatus');

    if (loopEnabled) {
      loopEnabled.addEventListener('change', () => {
        this.setLoopEnabled(loopEnabled.checked);
        this.updateLoopStatus();
      });
    }

    if (loopCount) {
      loopCount.addEventListener('change', () => {
        const maxLoops = parseInt(loopCount.value);
        this.setMaxLoops(maxLoops);
        this.updateLoopStatus();
      });

      // 初期値を設定
      this.setMaxLoops(parseInt(loopCount.value));
    }

    // 初期状態を更新
    this.updateLoopStatus();
  }

  /**
   * ループ状態表示を更新
   */
  private updateLoopStatus(): void {
    const loopStatus = document.getElementById('loopStatus');
    if (!loopStatus) return;

    if (this.isLoopEnabled) {
      const maxText = this.maxLoops === 0 ? '無限' : `${this.maxLoops}回`;
      if (this.loopCount > 0) {
        loopStatus.textContent = `${this.loopCount}/${maxText}`;
      } else {
        loopStatus.textContent = `設定: ${maxText}`;
      }
    } else {
      loopStatus.textContent = '';
    }
  }

  /**
   * デバッグ用：音楽的時間管理の状態を取得
   */
  public getTimeDebugInfo(): any {
    return this.musicalTimeManager.getDebugInfo();
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

    if (this.audioFeedbackManager) {
      this.audioFeedbackManager.destroy();
    }

    console.log('PianoPracticeApp destroyed');
  }
}