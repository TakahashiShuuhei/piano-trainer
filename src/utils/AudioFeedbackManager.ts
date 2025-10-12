// Tone.js依存を削除 - Web Audio APIのみ使用

/**
 * 音声フィードバック管理クラス
 * 正解時の音程再生、不正解時の効果音などを管理
 */
export class AudioFeedbackManager {
  private webAudioContext: AudioContext | null = null; // Web Audio APIコンテキスト
  private volume: number = 0.3; // 音量 (0-1)
  private isMuted: boolean = false;
  private isInitialized: boolean = false;
  private useWebAudioOnly: boolean = true; // Web Audio APIのみを使用

  constructor() {
    // 初期化はユーザージェスチャー後に遅延実行
  }

  /**
   * オーディオシステムを初期化（Web Audio APIのみ）
   * AudioContextの作成はユーザージェスチャー後に行う
   */
  private initializeAudio(): void {
    try {
      // AudioContextの作成はstartAudioContext()で行う
      // ここでは初期化フラグのみ設定
      this.useWebAudioOnly = true;
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Web Audio API:', error);
      this.isInitialized = false;
    }
  }

  /**
   * 正解時にノートの音程を再生
   */
  public playNoteSound(midiNote: number, duration: number = 0.5): void {
    if (this.isMuted) {
      return;
    }

    // Tone.jsが失敗しているため、直接Web Audio APIを使用
    this.playNoteWithWebAudio(midiNote, duration);
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
    } catch (error) {
      console.error('Failed to play note with Web Audio API:', error);
    }
  }

  /**
   * 不正解時の効果音を再生
   */
  public playErrorSound(): void {
    if (this.isMuted) return;

    try {
      // 不協和音的な効果音
      const frequencies = [200, 250, 300]; // 不協和な周波数
      
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          this.playBeepWithWebAudio(freq, 0.1);
        }, index * 50);
      });
    } catch (error) {
      console.error('Failed to play error sound:', error);
    }
  }

  /**
   * 成功時の効果音を再生
   */
  public playSuccessSound(): void {
    if (this.isMuted) return;

    try {
      // 上昇する音階
      const frequencies = [440, 554, 659]; // A4, C#5, E5 (Aメジャーコード)
      
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          this.playBeepWithWebAudio(freq, 0.3);
        }, index * 100);
      });
    } catch (error) {
      console.error('Failed to play success sound:', error);
    }
  }

  /**
   * カウントダウン音を再生（既存のビープ音を置き換え）
   */
  public playCountdownBeep(count: number): void {
    if (this.isMuted) {
      return;
    }

    // カウントが小さいほど高い音
    const frequency = count === 0 ? 880 : 660; // A5 or E5
    const duration = count === 0 ? 0.5 : 0.2;
    
    // Web Audio APIを使用
    this.playBeepWithWebAudio(frequency, duration);
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
    } catch (error) {
      console.error('Failed to play beep with Web Audio API:', error);
    }
  }

  /**
   * 音量を設定 (0-1)
   */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
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
   * オーディオコンテキストを開始（ユーザージェスチャー後に必要）
   */
  public async startAudioContext(): Promise<void> {
    try {
      // 初回初期化
      if (!this.isInitialized) {
        this.initializeAudio();
      }
      
      // Web Audio APIのコンテキストを取得
      if (!this.webAudioContext) {
        this.webAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const contextState = this.webAudioContext.state;
      
      if (contextState === 'suspended') {
        await this.webAudioContext.resume();
      }
      
      // 初期化に失敗していた場合は再試行
      if (!this.isInitialized) {
        this.initializeAudio();
      }
    } catch (error) {
      console.error('Failed to start audio context:', error);
    }
  }

  /**
   * リソースのクリーンアップ
   */
  public destroy(): void {
    if (this.webAudioContext && this.webAudioContext.close) {
      this.webAudioContext.close();
      this.webAudioContext = null;
    }
    
    this.isInitialized = false;
  }
}