// @ts-ignore - Tone.jsのimport警告を無視
const Tone = require('tone');

/**
 * 音声フィードバック管理クラス
 * 正解時の音程再生、不正解時の効果音などを管理
 */
export class AudioFeedbackManager {
  private synth: any; // Tone.Synth
  private volume: number = 0.3; // 音量 (0-1)
  private isMuted: boolean = false;
  private isInitialized: boolean = false;
  private useWebAudioOnly: boolean = false; // Web Audio APIのみを使用するフラグ

  constructor() {
    // 初期化はユーザージェスチャー後に遅延実行
    console.log('AudioFeedbackManager created, initialization deferred until user gesture');
  }

  /**
   * オーディオシステムを初期化
   */
  private initializeAudio(): void {
    try {
      console.log('Initializing AudioFeedbackManager...');
      console.log('Available Tone properties:', Object.keys(Tone));
      
      // Tone.jsの構造を詳しく確認
      console.log('Tone object type:', typeof Tone);
      console.log('Tone.Synth:', Tone.Synth);
      console.log('Tone.default:', Tone.default);
      
      // 複数のアクセス方法を試す
      let SynthClass = null;
      
      if (Tone.Synth) {
        SynthClass = Tone.Synth;
        console.log('Using Tone.Synth');
      } else if (Tone.default && Tone.default.Synth) {
        SynthClass = Tone.default.Synth;
        console.log('Using Tone.default.Synth');
      } else if (typeof Tone === 'function') {
        // Tone自体がコンストラクタの場合
        try {
          SynthClass = Tone.Synth || Tone;
          console.log('Using Tone as constructor');
        } catch (e) {
          console.log('Tone is not a constructor');
        }
      }
      
      if (!SynthClass) {
        console.log('No Synth constructor found, using Web Audio API only');
        this.useWebAudioOnly = true;
        this.isInitialized = true; // Web Audio APIは利用可能
        return;
      }
      
      // Tone.jsのシンセサイザーを初期化
      this.synth = new SynthClass({
        oscillator: {
          type: 'sine'
        },
        envelope: {
          attack: 0.02,
          decay: 0.1,
          sustain: 0.3,
          release: 0.8
        }
      });

      // toDestinationメソッドの確認
      if (this.synth.toDestination) {
        this.synth.toDestination();
      } else if (this.synth.connect && Tone.Destination) {
        this.synth.connect(Tone.Destination);
      } else if (this.synth.connect && Tone.Master) {
        this.synth.connect(Tone.Master);
      }

      // 音量を設定
      if (this.synth.volume) {
        this.synth.volume.value = this.volumeToDecibels(this.volume);
      }

      this.isInitialized = true;
      console.log('AudioFeedbackManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      console.log('Falling back to Web Audio API only');
      this.isInitialized = false;
    }
  }

  /**
   * 正解時にノートの音程を再生
   */
  public playNoteSound(midiNote: number, duration: number = 0.5): void {
    console.log(`playNoteSound called: note=${midiNote}, initialized=${this.isInitialized}, muted=${this.isMuted}, useWebAudioOnly=${this.useWebAudioOnly}`);
    
    if (this.isMuted) {
      console.log('Audio is muted, skipping playback');
      return;
    }

    // Web Audio APIを優先的に使用
    if (this.useWebAudioOnly || !this.synth) {
      console.log('Using Web Audio API for note playback');
      this.playNoteWithWebAudio(midiNote, duration);
      return;
    }

    try {
      // MIDIノート番号を周波数に変換
      const frequency = this.midiToFrequency(midiNote);
      
      console.log(`Attempting to play with Tone.js: ${midiNote} (${frequency.toFixed(2)}Hz), duration: ${duration}s`);
      
      // 音を再生
      this.synth.triggerAttackRelease(frequency, duration);
      
      console.log(`Successfully triggered note with Tone.js: ${midiNote} (${frequency.toFixed(2)}Hz)`);
    } catch (error) {
      console.error('Failed to play note sound with Tone.js:', error);
      console.log('Falling back to Web Audio API');
      this.playNoteWithWebAudio(midiNote, duration);
    }
  }

  /**
   * Web Audio APIを直接使用してノートを再生（フォールバック）
   */
  private playNoteWithWebAudio(midiNote: number, duration: number): void {
    try {
      // 既存のAudioContextを再利用するか新規作成
      if (!this.webAudioContext) {
        this.webAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = this.webAudioContext;
      
      // AudioContextが停止している場合は再開
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // 周波数を設定
      const frequency = this.midiToFrequency(midiNote);
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine';

      // 音量を設定（エンベロープ付き）
      const volume = this.volume * 0.2; // 音量を調整
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01); // アタック
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration); // リリース

      // 音を再生
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);

      console.log(`Web Audio API: played ${midiNote} (${frequency.toFixed(2)}Hz), duration: ${duration}s`);
    } catch (error) {
      console.error('Failed to play note with Web Audio API:', error);
    }
  }

  // Web Audio APIコンテキストを保持
  private webAudioContext: AudioContext | null = null;

  /**
   * 不正解時の効果音を再生
   */
  public playErrorSound(): void {
    if (!this.isInitialized || this.isMuted) return;

    try {
      // 不協和音的な効果音
      const frequencies = [200, 250, 300]; // 不協和な周波数
      
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          this.synth.triggerAttackRelease(freq, 0.1);
        }, index * 50);
      });
      
      console.log('Playing error sound');
    } catch (error) {
      console.error('Failed to play error sound:', error);
    }
  }

  /**
   * 成功時の効果音を再生
   */
  public playSuccessSound(): void {
    if (!this.isInitialized || this.isMuted) return;

    try {
      // 上昇する音階
      const frequencies = [440, 554, 659]; // A4, C#5, E5 (Aメジャーコード)
      
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          this.synth.triggerAttackRelease(freq, 0.3);
        }, index * 100);
      });
      
      console.log('Playing success sound');
    } catch (error) {
      console.error('Failed to play success sound:', error);
    }
  }

  /**
   * カウントダウン音を再生（既存のビープ音を置き換え）
   */
  public playCountdownBeep(count: number): void {
    console.log(`playCountdownBeep called: count=${count}, muted=${this.isMuted}`);
    
    if (this.isMuted) {
      console.log('Audio is muted, skipping countdown beep');
      return;
    }

    // カウントが小さいほど高い音
    const frequency = count === 0 ? 880 : 660; // A5 or E5
    const duration = count === 0 ? 0.5 : 0.2;
    
    // Web Audio APIを優先的に使用
    if (this.useWebAudioOnly || !this.synth) {
      console.log('Using Web Audio API for countdown beep');
      this.playBeepWithWebAudio(frequency, duration);
      return;
    }

    try {
      this.synth.triggerAttackRelease(frequency, duration);
      console.log(`Playing countdown beep with Tone.js: ${count} (${frequency}Hz)`);
    } catch (error) {
      console.error('Failed to play countdown beep with Tone.js:', error);
      console.log('Falling back to Web Audio API for countdown beep');
      this.playBeepWithWebAudio(frequency, duration);
    }
  }

  /**
   * Web Audio APIでビープ音を再生
   */
  private playBeepWithWebAudio(frequency: number, duration: number): void {
    try {
      // 既存のAudioContextを再利用するか新規作成
      if (!this.webAudioContext) {
        this.webAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = this.webAudioContext;
      
      // AudioContextが停止している場合は再開
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine';

      // 音量を設定
      const volume = this.volume * 0.3;
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

      // 音を再生
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);

      console.log(`Web Audio API beep: ${frequency.toFixed(2)}Hz, duration: ${duration}s`);
    } catch (error) {
      console.error('Failed to play beep with Web Audio API:', error);
    }
  }

  /**
   * 音量を設定 (0-1)
   */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    
    if (this.isInitialized && this.synth) {
      this.synth.volume.value = this.volumeToDecibels(this.volume);
    }
    
    console.log(`Volume set to: ${(this.volume * 100).toFixed(0)}%`);
  }

  /**
   * 現在の音量を取得 (0-1)
   */
  public getVolume(): number {
    return this.volume;
  }

  /**
   * ミュート状態を設定
   */
  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    console.log(`Audio ${muted ? 'muted' : 'unmuted'}`);
  }

  /**
   * ミュート状態を取得
   */
  public isMutedState(): boolean {
    return this.isMuted;
  }

  /**
   * ミュート状態をトグル
   */
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    console.log(`Audio ${this.isMuted ? 'muted' : 'unmuted'}`);
    return this.isMuted;
  }

  /**
   * MIDIノート番号を周波数に変換
   */
  private midiToFrequency(midiNote: number): number {
    // A4 (440Hz) = MIDI note 69
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }

  /**
   * 音量 (0-1) をデシベルに変換
   */
  private volumeToDecibels(volume: number): number {
    if (volume === 0) return -Infinity;
    // 0-1 を -40dB から 0dB にマッピング
    return -40 + (volume * 40);
  }

  /**
   * オーディオコンテキストを開始（ユーザージェスチャー後に必要）
   */
  public async startAudioContext(): Promise<void> {
    try {
      console.log('Starting audio context after user gesture...');
      
      // 初回初期化
      if (!this.isInitialized) {
        console.log('Performing initial audio initialization...');
        this.initializeAudio();
      }
      
      // Tone.jsのコンテキストアクセス方法を修正
      const context = Tone.getContext ? Tone.getContext() : Tone.context;
      const contextState = context ? context.state : 'unknown';
      
      console.log(`Current audio context state: ${contextState}`);
      
      if (contextState !== 'running') {
        console.log('Starting Tone.js audio context...');
        
        // Tone.startの呼び出し方法を修正
        if (Tone.start) {
          await Tone.start();
        } else if (context && context.resume) {
          await context.resume();
        }
        
        const newState = context ? context.state : 'unknown';
        console.log(`Audio context started successfully. New state: ${newState}`);
      } else {
        console.log('Audio context already running');
      }
      
      // 初期化に失敗していた場合は再試行
      if (!this.isInitialized) {
        console.log('Retrying audio initialization after context start...');
        this.initializeAudio();
      }
    } catch (error) {
      console.error('Failed to start audio context:', error);
      console.log('Available Tone properties:', Object.keys(Tone));
      console.log('Will use Web Audio API fallback for audio playback');
    }
  }

  /**
   * リソースのクリーンアップ
   */
  public destroy(): void {
    if (this.synth && this.synth.dispose) {
      this.synth.dispose();
      this.synth = null;
    }
    
    if (this.webAudioContext && this.webAudioContext.close) {
      this.webAudioContext.close();
      this.webAudioContext = null;
    }
    
    this.isInitialized = false;
    console.log('AudioFeedbackManager destroyed');
  }
}