import {
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
import { ScoreEvaluator } from '../utils/ScoreEvaluator';
import { ContentLoader } from '../utils/ContentLoader';

export class PianoPracticeApp {
  private scoreEvaluator!: ScoreEvaluator;
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
  private contentLoader!: ContentLoader;
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
      await this.loadInitialContent();

      this.isInitialized = true;
      console.log('Piano Practice App initialized successfully');

      // 初期化完了時に開始ボタンを有効化（MIDI接続なしでも使用可能）
      const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
      if (startBtn) {
        startBtn.disabled = false;
      }

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
      this.scoreEvaluator = new ScoreEvaluator();
      this.contentLoader = new ContentLoader();

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
    } catch (error) {
      console.error('Component initialization failed:', error);
      throw error;
    }
  }



  private setupEventListeners(): void {
    // MIDI接続ボタン
    const connectMidiBtn = document.getElementById('connectMidiBtn');
    if (connectMidiBtn) {
      connectMidiBtn.addEventListener('click', () => {
        this.handleMidiConnect();
      });
    } else {
      console.error('MIDI connect button not found in setupEventListeners');
    }

    // ファイル読み込み
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.addEventListener('change', (event) => this.handleFileLoad(event));
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
  }

  private async loadInitialContent(): Promise<void> {
    try {
      // URLパラメータから楽曲データを読み込み
      const musicalNotes = await this.contentLoader.loadFromURL();
      
      if (musicalNotes) {
        // 外部楽曲データを使用
        this.musicalNotes = musicalNotes;
        
        // BPMも外部データから取得
        const songBPM = await this.contentLoader.getSongBPM();
        if (songBPM) {
          this.setBPM(songBPM);
        }
        
        // タイトルを表示に反映
        const songTitle = await this.contentLoader.getSongTitle();
        if (songTitle) {
          this.updateSongTitle(songTitle);
        }
        
        console.log('楽曲データを読み込みました:', songTitle || '無題', `(BPM: ${songBPM || 120})`);
      } else {
        // デフォルトのサンプルノートを使用
        this.loadSampleNotes();
        console.log('デフォルトのサンプル楽曲を使用します');
      }
      
    } catch (error) {
      console.error('楽曲データの読み込みに失敗:', error);
      
      // エラー時はデフォルトのサンプルノートを使用
      this.loadSampleNotes();
      
      // ユーザーフレンドリーなメッセージを表示
      const errorMessage = error instanceof Error ? error.message : '楽曲データの読み込みに失敗しました';
      this.showError(`${errorMessage} デフォルトの楽曲を使用します。`);
    }
  }
  
  /**
   * 楽曲タイトルをUIに反映
   */
  private updateSongTitle(title: string): void {
    const headerElement = document.querySelector('.header h1');
    if (headerElement) {
      headerElement.textContent = `🎹 ${title}`;
    }
  }

  /**
   * ファイル読み込みを処理
   */
  private async handleFileLoad(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    try {
      // ファイルから楽曲データを読み込み
      const musicalNotes = await this.contentLoader.loadFromFile(file);

      // 楽曲データを読み込んだJSONからタイトルとBPMを取得
      const fileReader = new FileReader();
      fileReader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target?.result as string);

          // タイトルを更新
          if (jsonData.title) {
            this.updateSongTitle(jsonData.title);
          }

          // BPMを更新
          if (jsonData.bpm) {
            this.setBPM(jsonData.bpm);
          }

          console.log('楽曲ファイルを読み込みました:', jsonData.title || '無題', `(BPM: ${jsonData.bpm || 120})`);
        } catch (error) {
          console.error('Failed to parse JSON for metadata:', error);
        }
      };
      fileReader.readAsText(file, 'utf-8');

      // 楽曲データを設定
      this.musicalNotes = musicalNotes;

      // 再生中の場合は停止
      if (this.currentGameState.phase !== GamePhase.STOPPED) {
        this.handleStop();
      }

      // 成功メッセージを表示
      this.showSuccess(`楽曲ファイル "${file.name}" を読み込みました`);

    } catch (error) {
      console.error('Failed to load file:', error);
      const errorMessage = error instanceof Error ? error.message : 'ファイルの読み込みに失敗しました';
      this.showError(errorMessage);
    } finally {
      // ファイル入力をリセット（同じファイルを再度選択できるように）
      input.value = '';
    }
  }

  private async handleMidiConnect(): Promise<void> {


    if (!this.midiManager) {
      console.error('MIDI Manager not initialized');
      alert('MIDI Manager が初期化されていません');
      return;
    }



    try {


      const success = await this.midiManager.requestAccess();

      if (success) {
        const devices = this.midiManager.getAvailableDevices();


        if (devices.length > 0) {
          // Transport との同期を開始
          await this.midiManager.syncWithTransport();

          // オーディオコンテキストを開始
          await this.audioFeedbackManager.startAudioContext();

          this.updateMidiStatus(true);

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

    // オーディオコンテキストを開始（ユーザージェスチャー）
    await this.audioFeedbackManager.startAudioContext();

    // ScoreEvaluatorをリセット
    this.scoreEvaluator.reset();

    // ゲーム状態のスコアもリセット
    this.currentGameState.score = 0;
    this.currentGameState.accuracy = 1.0;
    this.currentGameState.totalNotes = 0;

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

    // カウントダウン中にノートを表示するため、楽曲データを時間ベースに変換
    this.updateCurrentNotes();

    // カウントダウン中の時間を設定（最初のノートがカウントダウン終了時にタイミングラインに到達するように）
    const beatDuration = 60000 / this.currentBPM; // 1拍の長さ（ミリ秒）
    const countdownDuration = beatDuration * 4; // 4拍分のカウントダウン
    this.currentGameState.currentTime = -countdownDuration; // 負の時間から開始

    this.updateGameStateDisplay();

    // カウントダウンタイマーを開始
    this.countdownStartTime = Date.now();
    let countdownValue = 4;

    // 最初の4のbeepを即座に再生
    this.audioFeedbackManager.playCountdownBeep(4);

    const countdownInterval = setInterval(() => {
      const elapsed = Date.now() - this.countdownStartTime;
      const beatDuration = 60000 / this.currentBPM; // 1拍の長さ（ミリ秒）
      const expectedCount = 4 - Math.floor(elapsed / beatDuration);

      if (expectedCount !== countdownValue && expectedCount >= 1) {
        countdownValue = expectedCount;
        this.currentGameState.countdownValue = countdownValue;

        // メトロノーム音を再生
        this.audioFeedbackManager.playCountdownBeep(countdownValue);
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

      this.musicalTimeManager.pause();
      this.currentGameState.phase = GamePhase.PAUSED;
      this.currentGameState.isPlaying = false;
    } else if (this.currentGameState.phase === GamePhase.PAUSED) {
      // 再開

      this.musicalTimeManager.resume();
      this.currentGameState.phase = GamePhase.PLAYING;
      this.currentGameState.isPlaying = true;
    }

    this.updateGameStateDisplay();
  }

  private handleStop(): void {
    if (!this.isInitialized) return;


    // カウントダウンタイマーをクリア
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer as NodeJS.Timeout);
      this.countdownTimer = null;
    }

    // 音楽的時間管理を停止
    this.musicalTimeManager.stop();

    // ゲーム状態をリセット（スコアは保持）
    this.currentGameState.phase = GamePhase.STOPPED;
    this.currentGameState.isPlaying = false;
    this.currentGameState.currentTime = 0;
    this.currentGameState.countdownValue = undefined;

    // 表示用ノートのみクリア（楽曲データは保持）
    this.currentNotes = [];

    // 演奏ガイドをクリア
    this.uiRenderer.clearTargetKeys();

    // 再生済みノートをクリア
    this.playedNotes.clear();

    this.updateGameStateDisplay();
  }

  private handleResize(): void {
    // UIRendererは自動的にリサイズを処理するため、特別な処理は不要

  }

  private updateMidiStatus(connected: boolean): void {
    // MIDI接続ボタンのテキストを変更
    const connectMidiBtn = document.getElementById('connectMidiBtn') as HTMLButtonElement;
    if (connectMidiBtn) {
      connectMidiBtn.textContent = connected ? 'MIDI接続済み' : 'MIDI接続';
      connectMidiBtn.disabled = connected; // 接続済みの場合は無効化
    }

    // 開始ボタンは常に有効（MIDI接続なしでも楽曲再生とキーボード入力が可能）
    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    if (startBtn) {
      startBtn.disabled = false; // 常に有効
    }
  }

  private updateGameState(state: GameState): void {
    // 削除されたスコア表示要素への参照を削除

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
    // 鍵盤のハイライトを開始
    this.uiRenderer.setKeyPressed(note, true);

    // ゲーム中の場合のみ評価処理
    if (this.currentGameState.phase === GamePhase.PLAYING) {
      // ScoreEvaluatorで評価
      const evaluation = this.scoreEvaluator.evaluateInput(note, this.currentGameState.currentTime, this.currentNotes);

      // 音声フィードバックを再生
      if (evaluation.isHit) {
        // 正解時：押したノートの音程を短く再生
        this.audioFeedbackManager.playNoteSound(note, 0.2);

      } else {

      }

      // スコア表示を更新
      const scoreInfo = this.scoreEvaluator.getScore();
      this.currentGameState.score = scoreInfo.correct;
      this.currentGameState.accuracy = scoreInfo.accuracy;
      this.currentGameState.totalNotes = scoreInfo.total;
      this.updateGameStateDisplay();
    }
  }

  private handleNoteOff(note: number, toneTime: number): void {
    // 鍵盤のハイライトを終了
    this.uiRenderer.setKeyPressed(note, false);
  }

  /**
   * 描画ループを開始
   */
  private startRenderLoop(): void {
    const render = () => {
      // カウントダウン中も時間を進める
      if (this.currentGameState.phase === GamePhase.COUNTDOWN) {
        const elapsed = Date.now() - this.countdownStartTime;
        const beatDuration = 60000 / this.currentBPM;
        const countdownDuration = beatDuration * 4;
        this.currentGameState.currentTime = elapsed - countdownDuration; // 負の時間から0に向かって進む
      }

      // ゲームが再生中の場合、時間を進める
      if (this.currentGameState.phase === GamePhase.PLAYING && this.musicalTimeManager.isStarted()) {
        // 音楽的時間管理から現在時刻を取得
        this.currentGameState.currentTime = this.musicalTimeManager.getCurrentRealTime();

        // ScoreEvaluatorでアクティブノートを更新
        this.scoreEvaluator.updateActiveNotes(this.currentGameState.currentTime, this.currentNotes);

        // 演奏ガイドを更新
        this.updatePlayingGuide();

        // 楽曲終了チェック（ループ対応）
        this.checkSongEnd();
      }

      // UIRendererで画面を描画
      this.uiRenderer.render(this.currentGameState, this.currentNotes);

      // 次のフレームをリクエスト
      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);

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
      { pitch: 60, timing: { beat: 4, duration: 2 }, velocity: 80 }, // C4
      { pitch: 64, timing: { beat: 4, duration: 2 }, velocity: 80 }, // E4
      { pitch: 67, timing: { beat: 4, duration: 2 }, velocity: 80 }, // G4

      // 黒鍵のテスト
      { pitch: 61, timing: { beat: 6, duration: 0.5 }, velocity: 70 },   // C#4: 6拍目（八分音符）
      { pitch: 63, timing: { beat: 6.5, duration: 0.5 }, velocity: 70 }, // D#4: 6.5拍目（八分音符）

      // より複雑なコード - Amコード
      { pitch: 57, timing: { beat: 8, duration: 3 }, velocity: 85 }, // A3
      { pitch: 60, timing: { beat: 8, duration: 3 }, velocity: 85 }, // C4
      { pitch: 64, timing: { beat: 8, duration: 3 }, velocity: 85 }, // E4

      // 3連符のテスト
      { pitch: 72, timing: { beat: 12, duration: 1 / 3 }, velocity: 80 },     // C5: 12拍目（3連符1つ目）
      { pitch: 74, timing: { beat: 12 + 1 / 3, duration: 1 / 3 }, velocity: 80 }, // D5: 3連符2つ目
      { pitch: 76, timing: { beat: 12 + 2 / 3, duration: 1 / 3 }, velocity: 80 }, // E5: 3連符3つ目
    ];

    // ノートの変換はゲーム開始時に行う


  }

  /**
   * 音楽的ノートを時間ベースのノートに変換してcurrentNotesを更新
   */
  private updateCurrentNotes(): void {
    const timeBasedNotes = this.beatTimeConverter.convertNotes(this.musicalNotes);


    // 相対時間として設定（ゲーム開始時刻は加算しない）
    this.currentNotes = timeBasedNotes.map(note => ({
      ...note,
      startTime: note.startTime // そのまま相対時間として使用
    }));


  }

  private showError(message: string): void {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      errorElement.style.backgroundColor = '#f44336'; // 赤
      setTimeout(() => {
        errorElement.style.display = 'none';
      }, 5000);
    }
  }

  private showSuccess(message: string): void {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      errorElement.style.backgroundColor = '#4caf50'; // 緑
      setTimeout(() => {
        errorElement.style.display = 'none';
      }, 3000);
    }
  }

  /**
   * BPM調整コントロールを設定
   */
  private setupBPMControls(): void {
    const bpmSlider = document.getElementById('bpmSlider') as HTMLInputElement;
    const bpmDisplay = document.getElementById('bpmDisplay');
    const bpmUp = document.getElementById('bpmUp');
    const bpmDown = document.getElementById('bpmDown');

    if (bpmSlider && bpmDisplay) {
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
          const newBPM = Math.max(30, this.currentBPM - 5);
          this.setBPM(newBPM);
          this.updateBPMDisplay(newBPM);
          bpmSlider.value = newBPM.toString();
        });
      }

      // 初期表示を更新
      this.updateBPMDisplay(this.currentBPM);
      bpmSlider.value = this.currentBPM.toString();
    }
  }

  /**
   * BPM表示を更新
   */
  private updateBPMDisplay(bpm: number): void {
    const bpmDisplay = document.getElementById('bpmDisplay');

    if (bpmDisplay) {
      bpmDisplay.textContent = bpm.toString();
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


  }

  /**
   * シークバー用：指定した音楽的位置（拍数）にシーク
   */
  public seekToMusicalPosition(beats: number): void {
    this.musicalTimeManager.seekToMusicalPosition(beats);

  }

  // 既に再生したノートを追跡
  private playedNotes = new Set<string>();

  // シンプルなループ機能
  private isLoopEnabled = false;

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

    // スコア表示を更新（アクティブノートが変わった可能性があるため）
    const scoreInfo = this.scoreEvaluator.getScore();
    const scoreChanged =
      this.currentGameState.score !== scoreInfo.correct ||
      this.currentGameState.totalNotes !== scoreInfo.total;

    if (scoreChanged) {
      this.currentGameState.score = scoreInfo.correct;
      this.currentGameState.accuracy = scoreInfo.accuracy;
      this.currentGameState.totalNotes = scoreInfo.total;
      this.updateGameStateDisplay();
    }

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
   * 楽曲終了をチェックしてループ処理
   */
  private checkSongEnd(): void {
    if (this.currentNotes.length === 0) return;

    const currentTime = this.currentGameState.currentTime;
    const lastNote = this.currentNotes[this.currentNotes.length - 1];
    if (!lastNote) return;

    const songEndTime = lastNote.startTime + lastNote.duration;

    // 楽曲が終了したかチェック（1秒のマージン）
    if (currentTime >= songEndTime + 1000) {
      if (this.isLoopEnabled) {
        this.startLoop();
      } else {
        this.handleStop();
      }
    }
  }

  /**
   * ループを開始（カウントダウン→演奏の繰り返し）
   */
  private startLoop(): void {
    // 現在のループのスコアを累積に追加
    this.scoreEvaluator.finalizeCurrentLoop();

    // 再生済みノートをクリア
    this.playedNotes.clear();

    // 演奏ガイドをクリア
    this.uiRenderer.clearTargetKeys();

    // カウントダウンを開始（既存の処理を再利用）
    this.startCountdown();
  }

  /**
   * ループ練習を有効/無効にする
   */
  public setLoopEnabled(enabled: boolean): void {
    this.isLoopEnabled = enabled;
  }

  /**
   * ループ練習コントロールを設定
   */
  private setupLoopControls(): void {
    const loopEnabled = document.getElementById('loopEnabled') as HTMLInputElement;

    if (loopEnabled) {
      loopEnabled.addEventListener('change', () => {
        this.setLoopEnabled(loopEnabled.checked);
      });
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


  }
}