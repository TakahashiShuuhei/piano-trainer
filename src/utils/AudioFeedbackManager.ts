/**
 * 音声フィードバック管理クラス（Web Audio APIのみ使用）
 * サンプルベースのピアノ音源とオシレーターベースのシンセ音源に対応
 * タブレット・モバイル対応を重視
 */
export class AudioFeedbackManager {
  private audioContext: AudioContext | null = null;
  private volume: number = 0.6; // 音量 (0-1)
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // アクティブな音源を追跡して、適切にクリーンアップ
  private activeOscillators: Set<OscillatorNode> = new Set();
  private activeBufferSources: Set<AudioBufferSourceNode> = new Set();

  // 同時発音数の制限（タブレット対応）
  private readonly MAX_VOICES = 16;

  // サンプルベースのピアノ音源
  private sampleBuffers: Map<number, AudioBuffer> = new Map();
  private useSamples: boolean = true; // デフォルトでサンプル音源を使用
  private samplesLoaded: boolean = false;

  // ピアノサンプルのMIDI番号（C2=24, C3=36, C4=48, C5=60, C6=72, C7=84）
  private readonly SAMPLE_NOTES = [24, 36, 48, 60, 72, 84];

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

      // サンプル音源を読み込み（バックグラウンドで実行）
      this.loadPianoSamples().catch(error => {
        console.warn('Failed to load piano samples, falling back to oscillator:', error);
        this.useSamples = false; // サンプル読み込み失敗時はオシレーターにフォールバック
      });
    } catch (error) {
      console.error('Failed to initialize Web Audio API:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * ピアノサンプルを読み込み
   */
  private async loadPianoSamples(): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext is not initialized');
    }

    console.log('Loading piano samples...');

    const loadPromises = this.SAMPLE_NOTES.map(async (midiNote) => {
      // MIDI番号からオクターブ番号を計算
      // C2 = MIDI 24 → 24/12 = 2
      // C3 = MIDI 36 → 36/12 = 3
      const octave = Math.floor(midiNote / 12);
      const url = `/audio/C${octave}v10.mp3`;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
        this.sampleBuffers.set(midiNote, audioBuffer);
        console.log(`Loaded sample: ${url} (MIDI ${midiNote})`);
      } catch (error) {
        console.error(`Failed to load sample ${url}:`, error);
        throw error;
      }
    });

    await Promise.all(loadPromises);
    this.samplesLoaded = true;
    console.log('All piano samples loaded successfully');
  }

  /**
   * 指定されたMIDI番号に最も近いサンプルを見つける
   */
  private findClosestSample(midiNote: number): { sampleNote: number; detune: number } | null {
    if (this.sampleBuffers.size === 0) {
      return null;
    }

    // 最も近いサンプルを探す
    let closestNote = this.SAMPLE_NOTES[0]!;
    let minDistance = Math.abs(midiNote - closestNote);

    for (const sampleNote of this.SAMPLE_NOTES) {
      const distance = Math.abs(midiNote - sampleNote);
      if (distance < minDistance) {
        minDistance = distance;
        closestNote = sampleNote;
      }
    }

    // デチューン値を計算（セント単位: 100セント = 1半音）
    const detune = (midiNote - closestNote) * 100;

    return { sampleNote: closestNote, detune };
  }

  /**
   * ノートの音程を再生（サンプルベースまたはオシレーターベース）
   */
  public playNoteSound(midiNote: number, duration: number = 0.5): void {
    if (this.isMuted || !this.isInitialized || !this.audioContext) {
      return;
    }

    // サンプルが読み込み済みで、サンプル使用モードの場合
    if (this.useSamples && this.samplesLoaded) {
      this.playSampleNote(midiNote, duration);
    } else {
      // フォールバック: オシレーター方式
      this.playOscillatorNote(midiNote, duration);
    }
  }

  /**
   * サンプルベースでノートを再生
   */
  private playSampleNote(midiNote: number, duration: number): void {
    if (!this.audioContext) return;

    try {
      // 同時発音数の制限
      if (this.activeBufferSources.size >= this.MAX_VOICES) {
        console.warn(`Max voices (${this.MAX_VOICES}) reached, skipping note`);
        return;
      }

      const sampleInfo = this.findClosestSample(midiNote);
      if (!sampleInfo) {
        console.warn('No sample found, falling back to oscillator');
        this.playOscillatorNote(midiNote, duration);
        return;
      }

      const audioBuffer = this.sampleBuffers.get(sampleInfo.sampleNote);
      if (!audioBuffer) {
        console.warn(`Sample buffer not found for MIDI ${sampleInfo.sampleNote}`);
        this.playOscillatorNote(midiNote, duration);
        return;
      }

      const currentTime = this.audioContext.currentTime;

      // AudioBufferSourceNodeを作成
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // ゲインノードを作成（音量調整用）
      const gainNode = this.audioContext.createGain();

      // 接続: ソース -> ゲイン -> 出力
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // ピッチシフト（デチューン）を適用
      if (source.detune) {
        source.detune.setValueAtTime(sampleInfo.detune, currentTime);
      } else {
        // 古いブラウザ用フォールバック: playbackRateで調整
        const playbackRate = Math.pow(2, sampleInfo.detune / 1200);
        source.playbackRate.setValueAtTime(playbackRate, currentTime);
      }

      // エンベロープ（音量の時間変化）
      const attackTime = 0.01; // 10ms
      const releaseTime = 0.1; // 100ms
      const peakVolume = this.volume;

      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(peakVolume, currentTime + attackTime);

      // サンプルが短い場合に備えて、duration と audioBuffer.duration の短い方を使用
      const actualDuration = Math.min(duration, audioBuffer.duration);

      if (actualDuration > releaseTime) {
        gainNode.gain.setValueAtTime(peakVolume, currentTime + actualDuration - releaseTime);
        gainNode.gain.linearRampToValueAtTime(0, currentTime + actualDuration);
      } else {
        // durationが短すぎる場合は即座にフェードアウト
        gainNode.gain.linearRampToValueAtTime(0, currentTime + actualDuration);
      }

      // 再生
      source.start(currentTime);
      source.stop(currentTime + actualDuration);

      // アクティブリストに追加
      this.activeBufferSources.add(source);

      // 停止後にクリーンアップ
      source.onended = () => {
        source.disconnect();
        gainNode.disconnect();
        this.activeBufferSources.delete(source);
      };

    } catch (error) {
      console.error('Failed to play sample note:', error);
      // エラー時はオシレーターにフォールバック
      this.playOscillatorNote(midiNote, duration);
    }
  }

  /**
   * オシレーターベースでノートを再生（従来の方式）
   */
  private playOscillatorNote(midiNote: number, duration: number): void {
    if (!this.audioContext) return;

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
      console.error('Failed to play oscillator note:', error);
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
   * サンプル音源とオシレーター音源を切り替え
   */
  public setUseSamples(useSamples: boolean): void {
    this.useSamples = useSamples;
    console.log(`Audio mode changed to: ${useSamples ? 'Sample-based' : 'Oscillator-based'}`);
  }

  /**
   * 現在の音源タイプを取得
   */
  public isUsingSamples(): boolean {
    return this.useSamples && this.samplesLoaded;
  }

  /**
   * リソースのクリーンアップ
   */
  public destroy(): void {
    try {
      // すべてのアクティブなオシレーターを停止
      this.activeOscillators.forEach(osc => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {
          // 既に停止している場合は無視
        }
      });
      this.activeOscillators.clear();

      // すべてのアクティブなバッファソースを停止
      this.activeBufferSources.forEach(source => {
        try {
          source.stop();
          source.disconnect();
        } catch (e) {
          // 既に停止している場合は無視
        }
      });
      this.activeBufferSources.clear();

      // サンプルバッファをクリア
      this.sampleBuffers.clear();
      this.samplesLoaded = false;

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
