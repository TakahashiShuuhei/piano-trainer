/**
 * 音声フィードバック管理クラス（軽量版 - Web Audio APIのみ使用）
 * Tone.jsを使わず、ネイティブWeb Audio APIで最小限の実装
 * タブレット・モバイル対応を重視
 */
export class AudioFeedbackManager {
  private audioContext: AudioContext | null = null;
  private volume: number = 0.6; // 音量 (0-1)
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // アクティブな音源を追跡して、適切にクリーンアップ
  private activeOscillators: Set<OscillatorNode> = new Set();

  // 同時発音数の制限（タブレット対応）
  private readonly MAX_VOICES = 16;

  constructor() {
    // 初期化はユーザージェスチャー後に遅延実行
  }

  /**
   * Web Audio APIオーディオシステムを初期化
   */
  private async initializeAudio(): Promise<void> {
    try {
      console.log('Starting Web Audio API initialization...');

      // AudioContextを作成
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();

      // コンテキストを開始（モバイル対応）
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.isInitialized = true;
      console.log('Web Audio API initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Web Audio API:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * 正解時にノートの音程を再生（軽量版）
   */
  public playNoteSound(midiNote: number, duration: number = 0.5): void {
    if (this.isMuted || !this.isInitialized || !this.audioContext) {
      return;
    }

    try {
      // 同時発音数の制限
      if (this.activeOscillators.size >= this.MAX_VOICES) {
        console.warn(`Max voices (${this.MAX_VOICES}) reached, skipping note`);
        return;
      }

      const currentTime = this.audioContext.currentTime;

      // オシレーター（音源）を作成
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      // 接続: オシレーター -> ゲイン -> 出力
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // 周波数を計算（MIDI番号から）
      const frequency = this.midiToFrequency(midiNote);
      oscillator.frequency.setValueAtTime(frequency, currentTime);

      // シンプルなサイン波（最も軽量）
      oscillator.type = 'sine';

      // エンベロープ（音量の時間変化）- シンプルに
      const attackTime = 0.005; // 5ms
      const releaseTime = 0.05; // 50ms
      const peakVolume = this.volume * 0.3;

      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(peakVolume, currentTime + attackTime);
      gainNode.gain.setValueAtTime(peakVolume, currentTime + duration - releaseTime);
      gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);

      // 再生
      oscillator.start(currentTime);
      oscillator.stop(currentTime + duration);

      // アクティブリストに追加
      this.activeOscillators.add(oscillator);

      // 停止後にクリーンアップ
      oscillator.onended = () => {
        oscillator.disconnect();
        gainNode.disconnect();
        this.activeOscillators.delete(oscillator);
      };

    } catch (error) {
      console.error('Failed to play note:', error);
    }
  }

  /**
   * 和音を再生（軽量版）
   */
  public playChord(midiNotes: number[], duration: number = 0.5): void {
    if (this.isMuted || !this.isInitialized) {
      return;
    }

    try {
      // 各音を個別に再生
      midiNotes.forEach(note => {
        this.playNoteSound(note, duration);
      });

      console.log(`Playing chord: ${midiNotes.length} notes for ${duration}s`);
    } catch (error) {
      console.error('Failed to play chord:', error);
    }
  }

  /**
   * 不正解時の効果音を再生（軽量版）
   */
  public playErrorSound(): void {
    if (this.isMuted || !this.isInitialized || !this.audioContext) return;

    try {
      // 短い不協和音
      const errorFreqs = [200, 210, 220]; // 微妙にずれた周波数

      errorFreqs.forEach((freq, index) => {
        setTimeout(() => {
          this.playFrequency(freq, 0.1);
        }, index * 50);
      });
    } catch (error) {
      console.error('Failed to play error sound:', error);
    }
  }

  /**
   * 成功時の効果音を再生（軽量版）
   */
  public playSuccessSound(): void {
    if (this.isMuted || !this.isInitialized) return;

    try {
      // 上昇するアルペジオ
      const successNotes = [69, 73, 76]; // A4, C#5, E5

      successNotes.forEach((note, index) => {
        setTimeout(() => {
          this.playNoteSound(note, 0.3);
        }, index * 100);
      });
    } catch (error) {
      console.error('Failed to play success sound:', error);
    }
  }

  /**
   * カウントダウン音を再生（軽量版）
   */
  public playCountdownBeep(count: number): void {
    if (this.isMuted || !this.isInitialized) {
      return;
    }

    try {
      // カウントが小さいほど高い音
      const note = count === 0 ? 81 : 76; // A5 or E5
      const duration = count === 0 ? 0.5 : 0.2;

      this.playNoteSound(note, duration);
    } catch (error) {
      console.error('Failed to play countdown beep:', error);
    }
  }

  /**
   * 周波数を直接指定して音を再生（内部用）
   */
  private playFrequency(frequency: number, duration: number): void {
    if (!this.audioContext) return;

    try {
      const currentTime = this.audioContext.currentTime;

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.setValueAtTime(frequency, currentTime);
      oscillator.type = 'sine';

      const peakVolume = this.volume * 0.2;
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(peakVolume, currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);

      oscillator.start(currentTime);
      oscillator.stop(currentTime + duration);

      this.activeOscillators.add(oscillator);

      oscillator.onended = () => {
        oscillator.disconnect();
        gainNode.disconnect();
        this.activeOscillators.delete(oscillator);
      };
    } catch (error) {
      console.error('Failed to play frequency:', error);
    }
  }

  /**
   * MIDI番号を周波数に変換
   */
  private midiToFrequency(midiNote: number): number {
    // A4 (MIDI 69) = 440Hz
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }

  /**
   * 音量を設定 (0-1)
   */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

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
   * オーディオコンテキストを開始（ユーザージェスチャー後に必要）
   */
  public async startAudioContext(): Promise<void> {
    try {
      // 初回初期化
      if (!this.isInitialized) {
        await this.initializeAudio();
      }

      // コンテキストが一時停止していたら再開
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('AudioContext resumed');
      }
    } catch (error) {
      console.error('Failed to start audio context:', error);
    }
  }

  /**
   * リソースのクリーンアップ
   */
  public destroy(): void {
    try {
      // すべてのアクティブな音源を停止
      this.activeOscillators.forEach(osc => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {
          // 既に停止している場合は無視
        }
      });
      this.activeOscillators.clear();

      // AudioContextをクローズ
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }

      this.isInitialized = false;
      console.log('AudioFeedbackManager destroyed');
    } catch (error) {
      console.error('Error during AudioFeedbackManager cleanup:', error);
    }
  }
}
