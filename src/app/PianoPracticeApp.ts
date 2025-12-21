import {
  MIDIInputManager as IMIDIInputManager,
  UIRenderer as IUIRenderer,
  GameState,
  GamePhase,
  Note,
  MusicalNote,
  SongMemo,
  Memo,
  BeatTimeConverter as IBeatTimeConverter,
  GameMode,
  GameSettings,
  WaitForInputState,
  DOMElements
} from '../types/index.js';
import { MIDIInputManager } from '../components/MIDIInputManager';
import { UIRenderer } from '../components/UIRenderer';
import { BeatTimeConverter } from '../utils/BeatTimeConverter';
import { MusicalTimeManager } from '../utils/MusicalTimeManager';
import { AudioFeedbackManager } from '../utils/AudioFeedbackManager';
import { ScoreEvaluator } from '../utils/ScoreEvaluator';
import { ContentLoader } from '../utils/ContentLoader';
import { TimeFormatter } from '../utils/TimeFormatter';
import { KeyboardNoteMapper } from '../utils/KeyboardNoteMapper';

export class PianoPracticeApp {
  // Wait-for-input mode timing constants
  private static readonly WAIT_THRESHOLD_MS = 50; // Enter waiting state 50ms before note
  private static readonly LOOK_AHEAD_MS = 100; // Look ahead window for finding next notes
  private static readonly SCHEDULED_NOTE_TOLERANCE_MS = 50; // Tolerance for auto-playing notes

  private scoreEvaluator!: ScoreEvaluator;
  private midiManager!: IMIDIInputManager;
  private uiRenderer!: IUIRenderer;

  // DOM要素への参照
  private dom!: DOMElements;

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
  // 音楽的メモ（拍ベース）
  private musicalMemos: SongMemo[] = [];
  // 現在表示中のメモ（時間ベース、UIRenderer用）
  private currentMemos: Memo[] = [];

  // Game mode settings
  private gameSettings: GameSettings = {
    gameMode: 'realtime' // Default to real-time mode
  };

  // Wait-for-input mode state
  private waitForInputState: WaitForInputState | null = null;
  // Track pitches from previous timing for re-press detection (C C problem)
  private lastTimingPitches: Set<number> = new Set();
  // Track which note timings we've already waited for (to avoid re-entering waiting state)
  private processedWaitTimings: Set<number> = new Set();
  // Flag to indicate we just seeked (to prevent selecting past notes immediately after seek)
  private justSeeked: boolean = false;

  constructor() {
    // コンストラクタは軽量に保つ
  }

  public async initialize(): Promise<void> {
    try {
      // DOM要素の取得
      this.bindDOMElements();

      // コンポーネントの初期化
      await this.initializeComponents();

      // イベントリスナーの設定
      this.setupEventListeners();

      // 初期コンテンツの読み込み
      await this.loadInitialContent();

      this.isInitialized = true;
      console.log('Piano Practice App initialized successfully');

    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('アプリケーションの初期化に失敗しました。');
    }
  }

  private bindDOMElements(): void {
    // ヘルパー関数：要素を取得して型チェック
    const getElement = <T extends HTMLElement>(id: string, type?: new () => T): T => {
      const element = document.getElementById(id);
      if (!element) {
        throw new Error(`Element with id '${id}' not found`);
      }
      if (type && !(element instanceof type)) {
        throw new Error(`Element with id '${id}' is not of expected type`);
      }
      return element as T;
    };

    // DOMElementsオブジェクトを構築
    this.dom = {
      // Canvas
      canvas: getElement('gameCanvas', HTMLCanvasElement),
      errorMessage: getElement('errorMessage'),
      songTitle: getElement('songTitle'),
      fileInput: getElement('fileInput', HTMLInputElement),

      // コントロールボタン
      playPauseBtn: getElement('playPauseBtn', HTMLButtonElement),
      stopBtn: getElement('stopBtn', HTMLButtonElement),

      // MIDI関連
      midiStatus: getElement('midiStatus'),
      midiStatusText: getElement('midiStatusText'),
      midiTooltip: getElement('midiTooltip'),

      // BPM関連
      bpmSlider: getElement('bpmSlider', HTMLInputElement),
      bpmDisplay: getElement('bpmDisplay'),
      bpmUpBtn: getElement('bpmUp'),
      bpmDownBtn: getElement('bpmDown'),

      // 音量関連
      volumeSlider: getElement('volumeSlider', HTMLInputElement),
      volumeDisplay: getElement('volumeDisplay'),
      muteBtn: getElement('muteBtn'),

      // シークバー関連
      seekBar: getElement('seekBar', HTMLInputElement),
      currentTimeDisplay: getElement('currentTimeDisplay'),
      totalTimeDisplay: getElement('totalTimeDisplay'),
      musicalPositionDisplay: getElement('musicalPositionDisplay'),

      // リピート関連
      partialRepeatEnabled: getElement('partialRepeatEnabled', HTMLInputElement),
      setPointABtn: getElement('setPointA'),
      setPointAToStartBtn: getElement('setPointAToStart'),
      setPointBBtn: getElement('setPointB'),
      setPointBToEndBtn: getElement('setPointBToEnd'),
      clearRepeatPointsBtn: getElement('clearRepeatPoints'),
      pointAInput: getElement('pointAInput', HTMLInputElement),
      pointBInput: getElement('pointBInput', HTMLInputElement),

      // 参考画像関連
      referenceImageArea: getElement('referenceImageArea'),
      referenceImageToggle: getElement('referenceImageToggle'),
      referenceImageContent: getElement('referenceImageContent'),
      toggleIcon: getElement('toggleIcon'),
      referenceImage: getElement('referenceImage', HTMLImageElement),

      // ゲームモード関連
      realtimeMode: getElement('realtimeMode'),
      waitMode: getElement('waitMode')
    };
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
      this.uiRenderer.initCanvas(this.dom.canvas);
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
    // MIDI接続ステータス（クリックで接続）
    this.dom.midiStatus.addEventListener('click', () => {
      // 未接続時のみ接続を試行
      const isDisconnected = this.dom.midiStatus.classList.contains('disconnected');
      if (isDisconnected) {
        this.handleMidiConnect();
      }
    });

    // ファイル読み込み
    this.dom.fileInput.addEventListener('change', (event) => this.handleFileLoad(event));

    // ゲーム制御ボタン（再生/一時停止統合）
    this.dom.playPauseBtn.addEventListener('click', () => {
      if (this.currentGameState.phase === GamePhase.STOPPED) {
        this.handleStart();
      } else if (this.currentGameState.phase === GamePhase.PLAYING || this.currentGameState.phase === GamePhase.WAITING_FOR_INPUT) {
        this.handlePause();
      } else if (this.currentGameState.phase === GamePhase.PAUSED) {
        this.handlePause(); // resume
      }
    });

    this.dom.stopBtn.addEventListener('click', () => this.handleStop());

    // キーボード入力のフォールバック（MIDI未接続時用）
    document.addEventListener('keydown', (event) => this.handleKeyboardInput(event));

    // BPM調整コントロール
    this.setupBPMControls();

    // 音量調整コントロール
    this.setupVolumeControls();

    // シークバーコントロール
    this.setupSeekBarControls();

    // リピート練習コントロール
    this.setupPartialRepeatControls();

    // 参考画像トグルコントロール
    this.setupReferenceImageToggle();

    // ゲームモード選択コントロール
    this.setupGameModeControls();
  }

  private async loadInitialContent(): Promise<void> {
    try {
      // URLパラメータから楽曲データを読み込み
      const songData = await this.contentLoader.loadFromURL();

      if (songData) {
        // 外部楽曲データを使用
        const songBPM = await this.contentLoader.getSongBPM();
        const songTitle = await this.contentLoader.getSongTitle();

        // 楽曲データを適用
        this.applySongData({
          notes: songData.notes,
          memos: songData.memos,
          bpm: songBPM ?? undefined,
          title: songTitle ?? undefined,
          referenceImageUrl: songData.referenceImageUrl
        });

        console.log('楽曲データを読み込みました:', songTitle || '無題', `(BPM: ${songBPM || 120})`);
      } else {
        // デフォルトのサンプルノートを使用
        await this.loadSampleNotes();
        console.log('デフォルトのサンプル楽曲を使用します');
      }

    } catch (error) {
      console.error('楽曲データの読み込みに失敗:', error);

      // エラー時はデフォルトのサンプルノートを使用
      await this.loadSampleNotes();

      // ユーザーフレンドリーなメッセージを表示
      const errorMessage = error instanceof Error ? error.message : '楽曲データの読み込みに失敗しました';
      this.showError(`${errorMessage} デフォルトの楽曲を使用します。`);
    }
  }

  /**
   * 楽曲データをアプリケーションに適用する共通処理
   */
  private applySongData(songData: { notes: MusicalNote[]; memos?: SongMemo[] | undefined; bpm?: number | undefined; title?: string | undefined; referenceImageUrl?: string | undefined }): void {
    // 楽曲データを設定
    this.musicalNotes = songData.notes;
    this.musicalMemos = songData.memos || [];

    // BPMを設定
    if (songData.bpm) {
      this.setBPM(songData.bpm);
    }

    // タイトルを表示に反映
    if (songData.title) {
      this.updateSongTitle(songData.title);
    }

    // 参考画像を表示
    if (songData.referenceImageUrl) {
      this.updateReferenceImage(songData.referenceImageUrl);
    } else {
      this.hideReferenceImage();
    }
  }

  /**
   * 楽曲タイトルをUIに反映
   */
  private updateSongTitle(title: string): void {
    this.dom.songTitle.textContent = title;
  }

  /**
   * 参考画像を表示
   */
  private updateReferenceImage(imageUrl: string): void {
    this.dom.referenceImage.src = imageUrl;
    this.dom.referenceImageArea.style.display = 'block';
  }

  /**
   * 参考画像を非表示
   */
  private hideReferenceImage(): void {
    this.dom.referenceImageArea.style.display = 'none';
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
      const songData = await this.contentLoader.loadFromFile(file);

      // 楽曲データを読み込んだJSONからタイトルとBPMを取得
      const fileReader = new FileReader();
      fileReader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target?.result as string);

          // 楽曲データを適用
          this.applySongData({
            notes: songData.notes,
            memos: songData.memos,
            bpm: jsonData.bpm,
            title: jsonData.title,
            referenceImageUrl: jsonData.referenceImageUrl
          });

          console.log('楽曲ファイルを読み込みました:', jsonData.title || '無題', `(BPM: ${jsonData.bpm || 120})`);
        } catch (error) {
          console.error('Failed to parse JSON for metadata:', error);
        }
      };
      fileReader.readAsText(file, 'utf-8');

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

    // Wait-for-input mode state をリセット
    this.waitForInputState = null;
    this.lastTimingPitches.clear();
    this.processedWaitTimings.clear();

    // シークバーを左端(0)にリセット
    this.dom.seekBar.value = '0';
    this.dom.currentTimeDisplay.textContent = '0:00';
    this.dom.musicalPositionDisplay.textContent = '0.0';

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

    // Wait-for-input mode state をクリア
    this.waitForInputState = null;
    this.lastTimingPitches.clear();
    this.processedWaitTimings.clear();

    this.updateGameStateDisplay();
  }

  private updateMidiStatus(connected: boolean): void {
    // MIDI状態表示を更新
    const midiIcon = this.dom.midiStatus.querySelector('.midi-status-icon');

    if (midiIcon) {
      if (connected) {
        this.dom.midiStatus.classList.remove('disconnected');
        this.dom.midiStatus.classList.add('connected');
        midiIcon.textContent = '✓';
        this.dom.midiStatusText.textContent = 'MIDI接続済み';
        this.dom.midiTooltip.innerHTML = 'MIDI機器が接続されています';
        // 接続済みの場合はカーソルを通常に
        this.dom.midiStatus.style.cursor = 'default';
      } else {
        this.dom.midiStatus.classList.remove('connected');
        this.dom.midiStatus.classList.add('disconnected');
        midiIcon.textContent = '⚠️';
        this.dom.midiStatusText.textContent = 'MIDI接続';
        this.dom.midiTooltip.innerHTML = 'クリックで接続';
        // 未接続の場合はカーソルをポインターに
        this.dom.midiStatus.style.cursor = 'pointer';
      }
    }

    // 再生/一時停止ボタンは常に有効（MIDI接続なしでも楽曲再生とキーボード入力が可能）
    this.dom.playPauseBtn.disabled = false;
  }

  private updateGameState(state: GameState): void {
    // ボタンの状態更新（Font Awesomeアイコン版）
    const icon = this.dom.playPauseBtn.querySelector('i');
    if (!icon) return;

    switch (state.phase) {
      case GamePhase.STOPPED:
        this.dom.playPauseBtn.disabled = false;
        icon.className = 'fas fa-play';
        this.dom.playPauseBtn.title = '開始';
        this.dom.stopBtn.disabled = true;
        break;

      case GamePhase.COUNTDOWN:
        this.dom.playPauseBtn.disabled = true;
        icon.className = 'fas fa-play';
        this.dom.stopBtn.disabled = false;
        break;

      case GamePhase.PLAYING:
      case GamePhase.WAITING_FOR_INPUT:
        this.dom.playPauseBtn.disabled = false;
        icon.className = 'fas fa-pause';
        this.dom.playPauseBtn.title = '一時停止';
        this.dom.stopBtn.disabled = false;
        break;

      case GamePhase.PAUSED:
        this.dom.playPauseBtn.disabled = false;
        icon.className = 'fas fa-play';
        this.dom.playPauseBtn.title = '再開';
        this.dom.stopBtn.disabled = false;
        break;
    }
  }

  private handleNoteOn(note: number, velocity: number, toneTime: number): void {
    // 鍵盤のハイライトを開始
    this.uiRenderer.setKeyPressed(note, true);

    // ゲーム中の場合のみ評価処理
    if (this.currentGameState.phase === GamePhase.PLAYING) {
      // ScoreEvaluatorで評価
      const evaluation = this.scoreEvaluator.evaluateInput(note, this.currentGameState.currentTime, this.currentNotes);

      // Wait-for-input mode: Play sound when user presses correct key
      if (this.gameSettings.gameMode === 'wait-for-input' && evaluation.isHit && evaluation.hitNoteIndex !== undefined) {
        // Boundary check for safety
        if (evaluation.hitNoteIndex < this.currentNotes.length) {
          const hitNote = this.currentNotes[evaluation.hitNoteIndex];
          if (hitNote) {
            this.audioFeedbackManager.playNoteSound(
              hitNote.pitch,
              hitNote.duration / 1000
            );
          }
        }
      }

      // スコア表示を更新
      const scoreInfo = this.scoreEvaluator.getScore();
      this.currentGameState.score = scoreInfo.correct;
      this.currentGameState.accuracy = scoreInfo.accuracy;
      this.currentGameState.totalNotes = scoreInfo.total;
      this.updateGameStateDisplay();
    }

    // Wait-for-input mode: Handle input in waiting state
    if (this.currentGameState.phase === GamePhase.WAITING_FOR_INPUT) {
      this.handleNoteOnInWaitMode(note);
    }
  }

  private handleNoteOff(note: number, toneTime: number): void {
    // 鍵盤のハイライトを終了
    this.uiRenderer.setKeyPressed(note, false);

    // Wait-for-input mode: Handle note release
    if (this.currentGameState.phase === GamePhase.WAITING_FOR_INPUT) {
      this.handleNoteOffInWaitMode(note);
    }
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

        // Wait-for-input mode: Check if we should enter waiting state
        if (this.gameSettings.gameMode === 'wait-for-input') {
          this.checkShouldEnterWaitingState();
        }

        // 楽曲終了チェック（ループ対応）
        this.checkSongEnd();
      }

      // Wait-for-input mode: Update current time and guide even when waiting
      if (this.currentGameState.phase === GamePhase.WAITING_FOR_INPUT && this.musicalTimeManager.isStarted()) {
        this.currentGameState.currentTime = this.musicalTimeManager.getCurrentRealTime();

        // ScoreEvaluatorでアクティブノートを更新（待機中もスコア評価を継続）
        this.scoreEvaluator.updateActiveNotes(this.currentGameState.currentTime, this.currentNotes);

        // Update playing guide to show required notes
        this.updatePlayingGuide();

        // 楽曲終了チェック（リピート対応）
        this.checkSongEnd();
      }

      // UIRendererで画面を描画
      this.uiRenderer.render(this.currentGameState, this.currentNotes, this.currentMemos);

      // シークバー表示を更新
      this.updateSeekBarDisplay();

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
    // 左右キーでシーク（再生中または一時停止中のみ）
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (this.currentGameState.phase === GamePhase.PLAYING || this.currentGameState.phase === GamePhase.PAUSED) {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        this.seekByBeats(direction);
        return;
      }
    }

    // キーボードをピアノの鍵盤として使用（フォールバック機能）
    const note = KeyboardNoteMapper.getMidiNote(event.key);
    if (note !== undefined && !event.repeat) {

      this.handleNoteOn(note, 100, 0); // velocity 100, toneTime 0 for keyboard input

      // キーボード入力の場合は短時間後にNote Offを送信
      setTimeout(() => {
        this.handleNoteOff(note, 0);
      }, 200);
    }
  }

  /**
   * テスト用のサンプルノートを読み込み（JSONファイルから）
   */
  private async loadSampleNotes(): Promise<void> {
    try {
      // sample-song.jsonをフェッチ
      const response = await fetch('sample-song.json');
      if (!response.ok) {
        throw new Error(`サンプル楽曲ファイルの読み込みに失敗: ${response.statusText}`);
      }

      const blob = await response.blob();
      const file = new File([blob], 'sample-song.json', { type: 'application/json' });

      // ContentLoaderのloadFromFileを使用（既存の処理を再利用）
      const songData = await this.contentLoader.loadFromFile(file);

      // JSONデータからBPMとタイトルを取得
      const jsonText = await blob.text();
      const jsonData = JSON.parse(jsonText);

      // 楽曲データを適用
      this.applySongData({
        notes: songData.notes,
        memos: songData.memos,
        bpm: jsonData.bpm,
        title: jsonData.title,
        referenceImageUrl: jsonData.referenceImageUrl
      });

      console.log('サンプル楽曲を読み込みました:', jsonData.title || 'サンプル楽曲');
    } catch (error) {
      console.error('サンプル楽曲の読み込みに失敗:', error);
      // フォールバック: 最低限のノートを設定
      this.musicalNotes = [
        { pitch: 60, timing: { beat: 0, duration: 1 }, velocity: 80 },
        { pitch: 62, timing: { beat: 1, duration: 1 }, velocity: 80 },
        { pitch: 64, timing: { beat: 2, duration: 1 }, velocity: 80 },
      ];
      this.musicalMemos = [];
      this.updateSongTitle('基本練習');
    }
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

    // メモも同時に変換
    this.updateCurrentMemos();
  }

  /**
   * 音楽的メモを時間ベースのメモに変換してcurrentMemosを更新
   */
  private updateCurrentMemos(): void {
    this.currentMemos = this.beatTimeConverter.convertMemos(this.musicalMemos);
  }

  private showError(message: string): void {
    this.dom.errorMessage.textContent = message;
    this.dom.errorMessage.style.display = 'block';
    this.dom.errorMessage.style.backgroundColor = '#f44336'; // 赤
    setTimeout(() => {
      this.dom.errorMessage.style.display = 'none';
    }, 5000);
  }

  private showSuccess(message: string): void {
    this.dom.errorMessage.textContent = message;
    this.dom.errorMessage.style.display = 'block';
    this.dom.errorMessage.style.backgroundColor = '#4caf50'; // 緑
    setTimeout(() => {
      this.dom.errorMessage.style.display = 'none';
    }, 3000);
  }

  /**
   * BPM調整コントロールを設定
   */
  private setupBPMControls(): void {
    // スライダーの変更イベント
    this.dom.bpmSlider.addEventListener('input', (event) => {
      const newBPM = parseInt((event.target as HTMLInputElement).value);
      this.setBPM(newBPM);
      this.updateBPMDisplay(newBPM);
    });

    // +ボタン
    this.dom.bpmUpBtn.addEventListener('click', () => {
      const newBPM = Math.min(300, this.currentBPM + 5);
      this.setBPM(newBPM);
      this.updateBPMDisplay(newBPM);
      this.dom.bpmSlider.value = newBPM.toString();
    });

    // -ボタン
    this.dom.bpmDownBtn.addEventListener('click', () => {
      const newBPM = Math.max(30, this.currentBPM - 5);
      this.setBPM(newBPM);
      this.updateBPMDisplay(newBPM);
      this.dom.bpmSlider.value = newBPM.toString();
    });

    // 初期表示を更新
    this.updateBPMDisplay(this.currentBPM);
    this.dom.bpmSlider.value = this.currentBPM.toString();
  }

  /**
   * BPM表示を更新
   */
  private updateBPMDisplay(bpm: number): void {
    this.dom.bpmDisplay.textContent = bpm.toString();
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

    // UI表示も更新
    this.updateBPMDisplay(newBPM);
    this.dom.bpmSlider.value = newBPM.toString();

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

    // Reset wait-for-input state when seeking
    this.resetWaitForInputState();
  }

  /**
   * シークバー用：指定した音楽的位置（拍数）にシーク
   */
  public seekToMusicalPosition(beats: number): void {
    this.musicalTimeManager.seekToMusicalPosition(beats);

    // Reset wait-for-input state when seeking
    this.resetWaitForInputState();
  }

  /**
   * Reset wait-for-input mode state (when seeking or mode switching)
   */
  private resetWaitForInputState(): void {
    // If currently waiting, unfreeze time
    if (this.currentGameState.phase === GamePhase.WAITING_FOR_INPUT) {
      this.musicalTimeManager.unfreezeTime();
      this.currentGameState.phase = GamePhase.PLAYING;
    }

    // Clear wait state
    this.waitForInputState = null;
    this.lastTimingPitches.clear();
    this.processedWaitTimings.clear();
  }

  // 既に再生したノートを追跡
  private playedNotes = new Set<string>();

  // リピート機能（部分リピートで全曲ループも実現）
  private isPartialRepeatEnabled = false;
  private repeatStartBeat: number | null = null;
  private repeatEndBeat: number | null = null;

  /**
   * 演奏ガイドを更新
   */
  private updatePlayingGuide(): void {
    const currentTime = this.currentGameState.currentTime;

    // Wait-for-input mode: Show required notes from waiting state
    if (this.currentGameState.phase === GamePhase.WAITING_FOR_INPUT && this.waitForInputState) {
      const requiredKeys = Array.from(this.waitForInputState.requiredNotes);
      this.uiRenderer.setCurrentTargetKeys(requiredKeys);
      return;
    }

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
    // Wait-for-input mode: Don't auto-play notes
    if (this.gameSettings.gameMode === 'wait-for-input') {
      return;
    }

    const tolerance = PianoPracticeApp.SCHEDULED_NOTE_TOLERANCE_MS;

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
    // スライダーの変更イベント
    this.dom.volumeSlider.addEventListener('input', (event) => {
      const volumePercent = parseInt((event.target as HTMLInputElement).value);
      const volume = volumePercent / 100; // 0-1に変換
      this.setAudioVolume(volume);
      this.updateVolumeDisplay(volumePercent);
    });

    // 初期表示を更新
    const initialVolume = Math.round(this.getAudioVolume() * 100);
    this.dom.volumeSlider.value = initialVolume.toString();
    this.updateVolumeDisplay(initialVolume);

    // ミュートボタン
    this.dom.muteBtn.addEventListener('click', async () => {
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

  /**
   * 音量表示を更新
   */
  private updateVolumeDisplay(volumePercent: number): void {
    this.dom.volumeDisplay.textContent = `${volumePercent}%`;
  }

  /**
   * ミュートボタンの表示を更新
   */
  private updateMuteButton(isMuted: boolean): void {
    this.dom.muteBtn.textContent = isMuted ? '🔇' : '🔊';
    this.dom.muteBtn.title = isMuted ? 'ミュート解除' : 'ミュート';
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
    const currentPosition = this.musicalTimeManager.getCurrentMusicalPosition();

    // 部分リピートが有効な場合
    if (this.isPartialRepeatEnabled && this.repeatStartBeat !== null && this.repeatEndBeat !== null) {
      // 終了位置を超えたら開始位置にシーク（半開区間 [start, end) ）
      // 微小な値を引いて、終了位置の音が鳴らないようにする
      const epsilon = 0.01; // 0.01拍 = 約5ms @ 120BPM
      if (currentPosition >= this.repeatEndBeat - epsilon) {
        // Reset wait-for-input state BEFORE seeking
        // これにより時間のフリーズが解除される
        this.resetWaitForInputState();

        // 開始位置にシーク
        this.musicalTimeManager.seekToMusicalPosition(this.repeatStartBeat);

        // シーク後の時刻を取得
        const seekedTime = this.musicalTimeManager.getCurrentRealTime();

        // 新しいプレイセッションを開始（シーク後の時刻を渡す）
        this.scoreEvaluator.startNewPlaySession(seekedTime);

        // 再生済みノートをクリア
        this.playedNotes.clear();

        // 演奏ガイドをクリア
        this.uiRenderer.clearTargetKeys();
      }
      return;
    }

    // リピート無効時は楽曲終了で停止
    const lastNote = this.currentNotes[this.currentNotes.length - 1];
    if (!lastNote) return;

    const songEndTime = lastNote.startTime + lastNote.duration;

    // 楽曲が終了したかチェック（1秒のマージン）
    if (currentTime >= songEndTime + 1000) {
      this.handleStop();
    }
  }

  /**
   * シークバーコントロールを設定
   */
  private setupSeekBarControls(): void {
    this.dom.seekBar.addEventListener('input', (event) => {
      const progress = parseInt((event.target as HTMLInputElement).value) / 1000;
      this.handleSeekBarChange(progress);
    });
  }

  /**
   * シークバー変更時の処理
   */
  private handleSeekBarChange(progress: number): void {
    // ノートが読み込まれていない場合は何もしない
    if (this.currentNotes.length === 0) {
      return;
    }

    const lastNote = this.currentNotes[this.currentNotes.length - 1];
    if (!lastNote) return;

    const totalDuration = lastNote.startTime + lastNote.duration;
    const targetTime = progress * totalDuration;

    // 一時停止中かどうかを記憶
    const wasPaused = this.currentGameState.phase === GamePhase.PAUSED;

    // Wait-for-inputモードの場合、時間の凍結を解除してからシーク
    if (this.currentGameState.phase === GamePhase.WAITING_FOR_INPUT) {
      this.musicalTimeManager.unfreezeTime();
      this.waitForInputState = null;
      this.currentGameState.phase = GamePhase.PLAYING;
    }

    // MusicalTimeManagerが開始されていない場合は開始する
    if (!this.musicalTimeManager.isStarted()) {
      this.musicalTimeManager.start();
    }

    // 一時停止中の場合、一時的に再開してからシーク
    if (wasPaused && this.musicalTimeManager.isPaused()) {
      this.musicalTimeManager.resume();
    }

    // シーク実行
    this.musicalTimeManager.seekToRealTime(targetTime);

    // シーク後の時刻を取得
    const seekedTime = this.musicalTimeManager.getCurrentRealTime();

    // currentGameState.currentTimeを更新（一時停止中でもUIに反映）
    this.currentGameState.currentTime = seekedTime;

    // 一時停止中だった場合、再度一時停止
    if (wasPaused) {
      this.musicalTimeManager.pause();
    }

    // 新しいプレイセッションを開始（シーク後の時刻を渡す）
    this.scoreEvaluator.startNewPlaySession(seekedTime);

    // 再生済みノートをクリア
    this.playedNotes.clear();

    // Wait-for-inputモードの処理済みタイミングもクリア
    if (this.gameSettings.gameMode === 'wait-for-input') {
      this.processedWaitTimings.clear();
      this.lastTimingPitches.clear();
      // Mark that we just seeked to prevent selecting past notes
      this.justSeeked = true;
    }
  }

  /**
   * 拍数単位でシーク
   */
  private seekByBeats(beatOffset: number): void {
    if (!this.musicalTimeManager.isStarted()) {
      return;
    }

    const currentPosition = this.musicalTimeManager.getCurrentMusicalPosition();
    const targetPosition = Math.max(0, currentPosition + beatOffset);

    // シーク実行
    this.musicalTimeManager.seekToMusicalPosition(targetPosition);

    // シーク後の時刻を取得
    const seekedTime = this.musicalTimeManager.getCurrentRealTime();

    // 新しいプレイセッションを開始（シーク後の時刻を渡す）
    this.scoreEvaluator.startNewPlaySession(seekedTime);

    // 再生済みノートをクリア
    this.playedNotes.clear();
  }

  /**
   * シークバーの表示を更新
   */
  private updateSeekBarDisplay(): void {
    if (!this.musicalTimeManager.isStarted() || this.currentNotes.length === 0) {
      return;
    }

    const currentTime = this.currentGameState.currentTime;
    const lastNote = this.currentNotes[this.currentNotes.length - 1];
    if (!lastNote) return;

    const totalDuration = lastNote.startTime + lastNote.duration;
    const progress = Math.max(0, Math.min(1, currentTime / totalDuration));

    // シークバーの値を更新
    this.dom.seekBar.value = Math.round(progress * 1000).toString();

    // 時間表示を更新
    this.dom.currentTimeDisplay.textContent = TimeFormatter.formatTime(Math.max(0, currentTime));
    this.dom.totalTimeDisplay.textContent = TimeFormatter.formatTime(totalDuration);

    // 拍数表示を更新
    const currentPosition = this.musicalTimeManager.getCurrentMusicalPosition();
    this.dom.musicalPositionDisplay.textContent = currentPosition.toFixed(1);
  }

  /**
   * 部分リピートコントロールを設定
   */
  private setupPartialRepeatControls(): void {
    this.dom.partialRepeatEnabled.addEventListener('change', () => {
      this.isPartialRepeatEnabled = this.dom.partialRepeatEnabled.checked;
      this.updateRepeatControlsState();
    });
    // 初期状態を設定
    this.updateRepeatControlsState();

    this.dom.setPointABtn.addEventListener('click', () => {
      this.setRepeatPoint('start');
    });

    this.dom.setPointAToStartBtn.addEventListener('click', () => {
      this.setRepeatPointToStart();
    });

    this.dom.setPointBBtn.addEventListener('click', () => {
      this.setRepeatPoint('end');
    });

    this.dom.setPointBToEndBtn.addEventListener('click', () => {
      this.setRepeatPointToEnd();
    });

    this.dom.clearRepeatPointsBtn.addEventListener('click', () => {
      this.clearRepeatPoints();
    });

    // 入力フィールドの変更イベント
    this.dom.pointAInput.addEventListener('change', () => {
      const value = parseFloat(this.dom.pointAInput.value);
      if (!isNaN(value) && value >= 0) {
        this.repeatStartBeat = value;
      }
    });

    this.dom.pointBInput.addEventListener('change', () => {
      const value = parseFloat(this.dom.pointBInput.value);
      if (!isNaN(value) && value >= 0) {
        this.repeatEndBeat = value;
      }
    });
  }

  /**
   * リピート位置を設定
   */
  private setRepeatPoint(type: 'start' | 'end'): void {
    if (!this.musicalTimeManager.isStarted()) {
      this.showError('再生中または一時停止中のみ設定できます');
      return;
    }

    const currentPosition = this.musicalTimeManager.getCurrentMusicalPosition();

    if (type === 'start') {
      this.repeatStartBeat = currentPosition;
      this.dom.pointAInput.value = currentPosition.toFixed(1);
      // アニメーションを適用
      this.dom.pointAInput.classList.remove('repeat-point-highlight');
      void this.dom.pointAInput.offsetWidth; // リフロー強制でアニメーションをリスタート
      this.dom.pointAInput.classList.add('repeat-point-highlight');
    } else {
      this.repeatEndBeat = currentPosition;
      this.dom.pointBInput.value = currentPosition.toFixed(1);
      // アニメーションを適用
      this.dom.pointBInput.classList.remove('repeat-point-highlight');
      void this.dom.pointBInput.offsetWidth; // リフロー強制でアニメーションをリスタート
      this.dom.pointBInput.classList.add('repeat-point-highlight');
    }
  }

  /**
   * 開始位置を楽曲の最初（0拍目）に設定
   */
  private setRepeatPointToStart(): void {
    this.repeatStartBeat = 0;
    this.dom.pointAInput.value = '0.0';
    // アニメーションを適用
    this.dom.pointAInput.classList.remove('repeat-point-highlight');
    void this.dom.pointAInput.offsetWidth;
    this.dom.pointAInput.classList.add('repeat-point-highlight');
  }

  /**
   * 終了位置を楽曲の最後に設定
   */
  private setRepeatPointToEnd(): void {
    if (this.musicalNotes.length === 0) {
      this.showError('楽曲データが読み込まれていません');
      return;
    }

    // 最後のノートの終了位置を計算（musicalNotesから取得）
    const lastMusicalNote = this.musicalNotes[this.musicalNotes.length - 1];
    if (!lastMusicalNote) {
      this.showError('楽曲データが正しく読み込まれていません');
      return;
    }

    const lastNoteBeat = lastMusicalNote.timing.beat + lastMusicalNote.timing.duration;

    this.repeatEndBeat = lastNoteBeat;
    this.dom.pointBInput.value = lastNoteBeat.toFixed(1);
    // アニメーションを適用
    this.dom.pointBInput.classList.remove('repeat-point-highlight');
    void this.dom.pointBInput.offsetWidth;
    this.dom.pointBInput.classList.add('repeat-point-highlight');
  }

  /**
   * リピート位置をクリア
   */
  private clearRepeatPoints(): void {
    this.repeatStartBeat = null;
    this.repeatEndBeat = null;

    this.dom.pointAInput.value = '';
    this.dom.pointAInput.classList.remove('repeat-point-highlight');
    this.dom.pointBInput.value = '';
    this.dom.pointBInput.classList.remove('repeat-point-highlight');
  }

  /**
   * リピートコントロールの有効/無効状態を更新
   */
  private updateRepeatControlsState(): void {
    const isEnabled = this.isPartialRepeatEnabled;

    // ボタンの有効/無効を切り替え
    (this.dom.setPointABtn as HTMLButtonElement).disabled = !isEnabled;
    (this.dom.setPointAToStartBtn as HTMLButtonElement).disabled = !isEnabled;
    (this.dom.setPointBBtn as HTMLButtonElement).disabled = !isEnabled;
    (this.dom.setPointBToEndBtn as HTMLButtonElement).disabled = !isEnabled;
    (this.dom.clearRepeatPointsBtn as HTMLButtonElement).disabled = !isEnabled;

    // 入力フィールドの有効/無効を切り替え
    this.dom.pointAInput.disabled = !isEnabled;
    this.dom.pointBInput.disabled = !isEnabled;
  }

  /**
   * 参考画像トグルコントロールを設定
   */
  private setupReferenceImageToggle(): void {
    this.dom.referenceImageToggle.addEventListener('click', () => {
      const isExpanded = this.dom.referenceImageContent.classList.contains('expanded');

      if (isExpanded) {
        // 折りたたむ
        this.dom.referenceImageContent.classList.remove('expanded');
        this.dom.referenceImageContent.classList.add('collapsed');
        this.dom.toggleIcon.classList.remove('expanded');
        this.dom.toggleIcon.textContent = '▶';
      } else {
        // 展開する
        this.dom.referenceImageContent.classList.remove('collapsed');
        this.dom.referenceImageContent.classList.add('expanded');
        this.dom.toggleIcon.classList.add('expanded');
        this.dom.toggleIcon.textContent = '▼';
      }
    });
  }

  /**
   * ゲームモード選択コントロールを設定
   */
  private setupGameModeControls(): void {
    // ラジオボタン風のモード選択
    this.dom.realtimeMode.addEventListener('click', () => {
      this.setGameMode('realtime');
      this.dom.realtimeMode.classList.add('active');
      this.dom.waitMode.classList.remove('active');
    });

    this.dom.waitMode.addEventListener('click', () => {
      this.setGameMode('wait-for-input');
      this.dom.waitMode.classList.add('active');
      this.dom.realtimeMode.classList.remove('active');
    });

    // 初期値を設定
    if (this.gameSettings.gameMode === 'realtime') {
      this.dom.realtimeMode.classList.add('active');
      this.dom.waitMode.classList.remove('active');
    } else {
      this.dom.waitMode.classList.add('active');
      this.dom.realtimeMode.classList.remove('active');
    }
  }

  /**
   * ゲームモードを設定
   */
  private setGameMode(mode: GameMode): void {
    this.gameSettings.gameMode = mode;

    // If switching to realtime mode while waiting, unfreeze time
    if (mode === 'realtime' && this.currentGameState.phase === GamePhase.WAITING_FOR_INPUT) {
      this.musicalTimeManager.unfreezeTime();
      this.currentGameState.phase = GamePhase.PLAYING;
      this.waitForInputState = null;
    }

    // If switching to wait-for-input mode, reset processed timings
    if (mode === 'wait-for-input') {
      this.processedWaitTimings.clear();
      this.lastTimingPitches.clear();
    }
  }

  /**
   * 現在のゲームモードを取得
   */
  public getGameMode(): GameMode {
    return this.gameSettings.gameMode;
  }

  // ========================================
  // Wait-for-input mode methods
  // ========================================

  /**
   * Check if we should enter waiting state for next note
   */
  private checkShouldEnterWaitingState(): void {
    // Already waiting
    if (this.currentGameState.phase === GamePhase.WAITING_FOR_INPUT) {
      return;
    }

    const currentTime = this.currentGameState.currentTime;
    const nextGroup = this.findNextNoteGroup(currentTime);

    if (nextGroup.length === 0) {
      return; // No more notes
    }

    const nextStartTime = nextGroup[0]?.startTime;
    if (nextStartTime === undefined) {
      return; // Safety check
    }

    // Enter waiting state slightly before the note
    // This ensures we catch the note timing accurately
    if (currentTime >= nextStartTime - PianoPracticeApp.WAIT_THRESHOLD_MS) {
      this.enterWaitingState(nextGroup);
    }
  }

  /**
   * Find the next group of notes (notes with same startTime)
   * Looks for notes that haven't been processed yet
   */
  private findNextNoteGroup(currentTime: number): Note[] {
    // Find notes that haven't been processed yet
    const futureNotes = this.currentNotes
      .filter(note => {
        // Only consider notes that haven't been processed yet
        const isNotProcessed = !this.processedWaitTimings.has(note.startTime);

        // CRITICAL FIX: Always reject notes that are too far in the past
        // This prevents going backwards after unfreezing time
        const MAX_PAST_TOLERANCE = 10; // Maximum 10ms in the past
        const timeDiff = note.startTime - currentTime;
        const isTooFarInPast = timeDiff < -MAX_PAST_TOLERANCE;

        if (isTooFarInPast) {
          return false; // Never go backwards more than 10ms
        }

        // If we just seeked, be STRICT: only allow future notes (no tolerance)
        if (this.justSeeked) {
          return isNotProcessed && note.startTime >= currentTime;
        }

        // Normal playback: allow small tolerance to catch notes that are
        // just about to start (within LOOK_AHEAD_MS)
        const tolerance = PianoPracticeApp.LOOK_AHEAD_MS;
        const isInFuture = note.startTime >= currentTime - tolerance;

        return isNotProcessed && isInFuture;
      })
      .sort((a, b) => a.startTime - b.startTime);

    if (futureNotes.length === 0) {
      return [];
    }

    const nextStartTime = futureNotes[0]?.startTime;
    if (nextStartTime === undefined) {
      return []; // Safety check
    }

    // Additional safety check: if the next note is in the past (beyond tolerance),
    // mark it as processed to prevent infinite loops
    // BUT: Don't auto-process the very first note group (startTime = 0)
    // This prevents the first notes from being auto-cleared at game start
    const isFirstNoteGroup = nextStartTime === 0;
    if (!isFirstNoteGroup && nextStartTime < currentTime - PianoPracticeApp.LOOK_AHEAD_MS) {
      this.processedWaitTimings.add(nextStartTime);
      return []; // Don't enter wait state for this note
    }

    // Get all notes with the same startTime (chord)
    return futureNotes.filter(note => note.startTime === nextStartTime);
  }

  /**
   * Enter waiting state for a group of notes
   */
  private enterWaitingState(noteGroup: Note[]): void {
    const firstNote = noteGroup[0];
    if (!firstNote) {
      return; // Safety check: empty noteGroup
    }

    const startTime = firstNote.startTime;

    // Clear the justSeeked flag now that we've found the first note after seek
    this.justSeeked = false;

    // Mark this timing as processed so we don't re-enter waiting state for it
    this.processedWaitTimings.add(startTime);

    this.waitForInputState = {
      requiredNotes: new Set(noteGroup.map(n => n.pitch)),
      pressedNotesForCurrentTiming: new Set(),
      currentTimingNotes: noteGroup,
      nextNoteStartTime: startTime,
      waitingStartTime: this.currentGameState.currentTime,
      lastInputPitches: new Set(this.lastTimingPitches) // Use saved pitches from previous timing
    };

    // Freeze time at the note's start time (not current time which might be slightly past)
    this.musicalTimeManager.freezeTimeAt(startTime);
    this.currentGameState.phase = GamePhase.WAITING_FOR_INPUT;

    // Update playing guide immediately to show required keys
    const requiredKeys = Array.from(this.waitForInputState.requiredNotes);
    this.uiRenderer.setCurrentTargetKeys(requiredKeys);
  }

  /**
   * Exit waiting state and resume playback
   */
  private exitWaitingState(): void {
    if (!this.waitForInputState) return;

    // Save pressed notes for next timing (for re-press detection)
    this.lastTimingPitches = new Set(this.waitForInputState.pressedNotesForCurrentTiming);

    // Unfreeze time and resume playback
    this.musicalTimeManager.unfreezeTime();
    this.currentGameState.phase = GamePhase.PLAYING;

    // Reset state
    this.waitForInputState = null;

    // Update playing guide for the next active notes
    // This will be called in the next render loop, so we don't need to do it here
  }

  /**
   * Check if all required notes have been pressed
   */
  private isAllRequiredNotesPressed(): boolean {
    if (!this.waitForInputState) return false;

    for (const requiredNote of this.waitForInputState.requiredNotes) {
      if (!this.waitForInputState.pressedNotesForCurrentTiming.has(requiredNote)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Handle note input in waiting mode
   */
  private handleNoteOnInWaitMode(note: number): void {
    if (!this.waitForInputState) return;

    const state = this.waitForInputState;

    // Check if this note is required
    if (!state.requiredNotes.has(note)) {
      return; // Ignore unrequired notes
    }

    // C C problem: If this pitch was held from previous timing,
    // don't count it until it's been released and re-pressed
    if (state.lastInputPitches.has(note)) {
      return; // Still held from previous note
    }

    // Find the note in currentTimingNotes and play sound
    const hitNote = state.currentTimingNotes.find(n => n.pitch === note);
    if (hitNote) {
      // Play the sound immediately for required notes
      this.audioFeedbackManager.playNoteSound(
        hitNote.pitch,
        hitNote.duration / 1000
      );
    }

    // Evaluate the input for scoring (use frozen time for accurate evaluation)
    this.scoreEvaluator.evaluateInput(
      note,
      state.nextNoteStartTime,
      state.currentTimingNotes
    );

    // Update score display
    const scoreInfo = this.scoreEvaluator.getScore();
    this.currentGameState.score = scoreInfo.correct;
    this.currentGameState.accuracy = scoreInfo.accuracy;
    this.currentGameState.totalNotes = scoreInfo.total;
    this.updateGameStateDisplay();

    // Mark this note as pressed
    state.pressedNotesForCurrentTiming.add(note);

    // Check if all required notes are now pressed
    if (this.isAllRequiredNotesPressed()) {
      this.exitWaitingState();
    }
  }

  /**
   * Handle note release in waiting mode
   */
  private handleNoteOffInWaitMode(note: number): void {
    if (!this.waitForInputState) return;

    // Record that this note has been released
    // (for C C problem - allows re-pressing)
    this.waitForInputState.lastInputPitches.delete(note);
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