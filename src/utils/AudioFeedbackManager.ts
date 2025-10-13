const Tone = require('tone');

/**
 * 音声フィードバック管理クラス
 * 正解時の音程再生、不正解時の効果音などを管理
 */
export class AudioFeedbackManager {
  private polySynth: any = null; // Tone.js PolySynth（全ての音再生用）
  private reverb: any = null; // リバーブエフェクト
  private volume: number = 0.6; // 音量 (0-1)
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  constructor() {
    // 初期化はユーザージェスチャー後に遅延実行
    // Tone.jsの自動初期化を防ぐため、ここでは何もしない
  }

  /**
   * Tone.jsオーディオシステムを初期化
   */
  private async initializeAudio(): Promise<void> {
    try {
      // Tone.jsのオーディオコンテキストを開始
      console.log('Starting Tone.js initialization...');
      await Tone.start();
      console.log('Tone.js context started');

      // リバーブエフェクトを作成
      this.reverb = new Tone.Reverb({
        decay: 2.0,
        wet: 0.2 // 20%のリバーブ
      });

      // リバーブの初期化を待つ
      await this.reverb.generate();
      console.log('Reverb initialized');



      // ポリシンセ（和音用）- ボイス数を明示的に設定
      this.polySynth = new Tone.PolySynth({
        maxPolyphony: 128, // 最大16音同時発音
        voice: Tone.Synth,
        options: {
          oscillator: {
            type: 'fatsawtooth'
          },
          envelope: {
            attack: 0.005,
            decay: 0.1,
            sustain: 0.1,
            release: 0.01
          }
        }
      });
      console.log('PolySynth created with 16 voices');

      // 音量設定
      const volumeDb = this.volumeToDb(this.volume);
      this.polySynth.volume.value = volumeDb;

      // エフェクトチェーン: PolySynth -> Reverb -> Destination
      this.polySynth.chain(this.reverb, Tone.Destination);

      this.isInitialized = true;
      console.log('Tone.js audio system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Tone.js:', error);
      console.error('Error details:', error.message);
      this.isInitialized = false;
      throw error; // エラーを再スローしてフォールバックを無効化
    }
  }



  /**
   * 正解時にノートの音程を再生
   */
  public playNoteSound(midiNote: number, duration: number = 0.5): void {
    if (this.isMuted || !this.isInitialized) {
      return;
    }

    try {
      // MIDIノート番号を音程名に変換
      const noteName = this.midiToNoteName(midiNote);

      // PolySynthで音を再生（複数音の同時発音に対応）
      this.polySynth.triggerAttackRelease(noteName, duration);

      console.log(`Playing note: ${noteName} (MIDI ${midiNote}) for ${duration}s`);
    } catch (error) {
      console.error('Failed to play note:', error);
    }
  }

  /**
   * Web Audio APIフォールバック
   */
  private playNoteWithWebAudio(midiNote: number, duration: number): void {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'triangle';

      const volume = this.volume * 0.3;
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);

      console.log(`Playing note with Web Audio API: MIDI ${midiNote} (${frequency.toFixed(1)}Hz)`);
    } catch (error) {
      console.error('Failed to play note with Web Audio API:', error);
    }
  }

  /**
   * 和音を再生
   */
  public playChord(midiNotes: number[], duration: number = 0.5): void {
    if (this.isMuted || !this.isInitialized) {
      return;
    }

    try {
      // MIDIノート番号を音程名に変換
      const noteNames = midiNotes.map(note => this.midiToNoteName(note));

      // PolySynthの現在のボイス使用状況をログ出力
      if (this.polySynth.activeVoices !== undefined) {
        console.log(`Active voices before: ${this.polySynth.activeVoices}`);
      }

      // PolySynthで和音を再生
      this.polySynth.triggerAttackRelease(noteNames, duration);

      console.log(`Playing chord: [${noteNames.join(', ')}] (${noteNames.length} notes) for ${duration}s`);

      // 再生後のボイス使用状況もログ出力
      setTimeout(() => {
        if (this.polySynth.activeVoices !== undefined) {
          console.log(`Active voices after: ${this.polySynth.activeVoices}`);
        }
      }, 100);
    } catch (error) {
      console.error('Failed to play chord:', error);
    }
  }

  /**
   * 不正解時の効果音を再生
   */
  public playErrorSound(): void {
    if (this.isMuted || !this.isInitialized) return;

    try {
      // 不協和音的な効果音（短2度の不協和音）
      const errorNotes = ['C4', 'Db4', 'D4']; // 不協和な音程

      errorNotes.forEach((note, index) => {
        setTimeout(() => {
          this.polySynth.triggerAttackRelease(note, 0.1);
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
    if (this.isMuted || !this.isInitialized) return;

    try {
      // 上昇するアルペジオ（Aメジャーコード）
      const successNotes = ['A4', 'C#5', 'E5'];

      successNotes.forEach((note, index) => {
        setTimeout(() => {
          this.polySynth.triggerAttackRelease(note, 0.3);
        }, index * 100);
      });
    } catch (error) {
      console.error('Failed to play success sound:', error);
    }
  }

  /**
   * カウントダウン音を再生
   */
  public playCountdownBeep(count: number): void {
    if (this.isMuted || !this.isInitialized) {
      return;
    }

    try {
      // カウントが小さいほど高い音
      const note = count === 0 ? 'A5' : 'E5';
      const duration = count === 0 ? 0.5 : 0.2;

      // PolySynthでカウントダウン音を再生
      this.polySynth.triggerAttackRelease(note, duration);
    } catch (error) {
      console.error('Failed to play countdown beep:', error);
    }
  }

  /**
   * 音量を設定 (0-1)
   */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));

    // Tone.jsシンセの音量も更新
    if (this.isInitialized && this.polySynth) {
      const dbValue = this.volumeToDb(this.volume);
      this.polySynth.volume.value = dbValue;
    }
  }

  /**t gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine';

      const volume = this.volume * 0.3;
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
      
      console.log(`Playing beep with Web Audio API: ${frequency}Hz for ${duration}s`);
    } catch (error) {
      console.error('Failed to play beep with Web Audio API:', error);
    }
  }
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
   * MIDIノート番号を音程名に変換（Tone.js用）
   */
  private midiToNoteName(midiNote: number): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = noteNames[midiNote % 12];
    return `${noteName}${octave}`;
  }

  /**
   * 音量（0-1）をデシベル値に変換
   */
  private volumeToDb(volume: number): number {
    if (volume <= 0) return -Infinity;
    // 0-1を-40dB〜0dBに変換（より自然な音量カーブ）
    return Math.log10(volume) * 20;
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

      // 初期化に失敗していた場合は再試行
      if (!this.isInitialized) {
        await this.initializeAudio();
      }
    } catch (error) {
      console.error('Failed to start Tone.js audio context:', error);
    }
  }



  /**
   * リソースのクリーンアップ
   */
  public destroy(): void {
    try {
      if (this.polySynth) {
        this.polySynth.dispose();
        this.polySynth = null;
      }

      if (this.reverb) {
        this.reverb.dispose();
        this.reverb = null;
      }

      this.isInitialized = false;
      console.log('AudioFeedbackManager destroyed');
    } catch (error) {
      console.error('Error during AudioFeedbackManager cleanup:', error);
    }
  }
}