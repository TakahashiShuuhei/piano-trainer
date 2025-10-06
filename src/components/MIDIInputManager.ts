import * as Tone from 'tone';
import { MIDIInputManager as IMIDIInputManager } from '../types/index.js';

export class MIDIInputManager implements IMIDIInputManager {
  private midiAccess: MIDIAccess | null = null;
  private connectedInputs: MIDIInput[] = [];
  private noteOnCallbacks: Array<(note: number, velocity: number, toneTime: number) => void> = [];
  private noteOffCallbacks: Array<(note: number, toneTime: number) => void> = [];
  private isConnected = false;

  constructor() {
    console.log('MIDIInputManager initialized');
  }

  public async requestAccess(): Promise<boolean> {
    try {
      // Web MIDI APIの利用可能性をチェック
      if (!navigator.requestMIDIAccess) {
        console.warn('Web MIDI API is not supported in this browser');
        return false;
      }

      // MIDI アクセスを要求
      this.midiAccess = await navigator.requestMIDIAccess();
      console.log('MIDI access granted');

      // 接続状態の変化を監視
      this.midiAccess.onstatechange = (event) => {
        this.handleStateChange(event);
      };

      // 既存の入力デバイスを検出
      this.detectInputDevices();

      return true;
    } catch (error) {
      console.error('Failed to request MIDI access:', error);
      return false;
    }
  }

  public getAvailableDevices(): MIDIInput[] {
    if (!this.midiAccess) {
      return [];
    }

    const inputs: MIDIInput[] = [];
    this.midiAccess.inputs.forEach((input) => {
      inputs.push(input);
    });

    return inputs;
  }

  public onNoteOn(callback: (note: number, velocity: number, toneTime: number) => void): void {
    this.noteOnCallbacks.push(callback);
  }

  public onNoteOff(callback: (note: number, toneTime: number) => void): void {
    this.noteOffCallbacks.push(callback);
  }

  public convertNoteToFrequency(note: number): number {
    // フォールバック: A4 (MIDI note 69) = 440Hz を基準に計算
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  public convertNoteToNoteName(note: number): string {
    // フォールバック: 計算で音名を求める
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(note / 12) - 1;
    const noteName = noteNames[note % 12];
    return `${noteName}${octave}`;
  }

  public async syncWithTransport(): Promise<void> {
    try {
      console.log('Sync with Transport - skipping for now due to Tone.js import issues');
      // TODO: Fix Tone.js import issues later
      // AudioContextを開始（ユーザージェスチャー後に必要）
      // if (Tone.context && Tone.context.state === 'suspended') {
      //   console.log('Resuming AudioContext...');
      //   await Tone.context.resume();
      // }
      
      // Tone.js Transportとの同期を確保
      // Transport が開始されていない場合は開始
      // if (Tone.Transport && Tone.Transport.state !== 'started') {
      //   console.log('Starting Tone.js Transport for MIDI sync');
      //   Tone.Transport.start();
      // }
    } catch (error) {
      console.error('Failed to sync with Transport:', error);
    }
  }

  public getTransportTime(): number {
    // Tone.js Transport の現在時刻を取得
    return Tone.Transport.seconds;
  }

  public convertMidiTimeToTransportTime(midiTimestamp: number): number {
    // MIDIタイムスタンプをTone.js Transport時間に変換
    // Web MIDI APIのタイムスタンプは performance.now() ベース
    // Tone.js は AudioContext.currentTime ベース
    const performanceNow = performance.now();
    const audioContextTime = Tone.context.currentTime;
    const timeDiff = (midiTimestamp - performanceNow) / 1000; // ミリ秒を秒に変換
    
    return audioContextTime + timeDiff;
  }

  public disconnect(): void {
    // 全ての入力デバイスからイベントリスナーを削除
    this.connectedInputs.forEach(input => {
      input.onmidimessage = null;
    });

    this.connectedInputs = [];
    this.noteOnCallbacks = [];
    this.noteOffCallbacks = [];
    this.isConnected = false;

    console.log('MIDI input manager disconnected');
  }

  public isDeviceConnected(): boolean {
    return this.isConnected && this.connectedInputs.length > 0;
  }

  private detectInputDevices(): void {
    if (!this.midiAccess) return;

    this.connectedInputs = [];
    
    this.midiAccess.inputs.forEach((input) => {
      console.log(`MIDI input detected: ${input.name} (${input.manufacturer})`);
      this.connectToInput(input);
    });

    this.isConnected = this.connectedInputs.length > 0;
  }

  private connectToInput(input: MIDIInput): void {
    // 既に接続済みの場合はスキップ
    if (this.connectedInputs.includes(input)) {
      return;
    }

    // MIDIメッセージのイベントリスナーを設定
    input.onmidimessage = (event) => {
      this.handleMidiMessage(event);
    };

    this.connectedInputs.push(input);
    console.log(`Connected to MIDI input: ${input.name}`);
  }

  private handleMidiMessage(event: MIDIMessageEvent): void {
    try {
      const data = event.data;
      if (!data || data.length < 3) {
        return;
      }
      
      const command = data[0]! >> 4;
      const channel = data[0]! & 0xf;
      const note = data[1]!;
      const velocity = data[2]!;

      // Tone.jsの現在時刻を取得（フォールバック付き）
      const toneTime = performance.now() / 1000; // Tone.now() の代替

      switch (command) {
        case 0x9: // Note On
          if (velocity > 0) {
            // Note Onの処理
            this.triggerNoteOnCallbacks(note, velocity, toneTime);
          } else {
            // velocity が 0 の場合は Note Off として扱う
            this.triggerNoteOffCallbacks(note, toneTime);
          }
          break;

        case 0x8: // Note Off
          this.triggerNoteOffCallbacks(note, toneTime);
          break;

        case 0xB: // Control Change
          // 必要に応じてコントロールチェンジの処理を追加
          break;

        default:
          // その他のMIDIメッセージは無視
          break;
      }
    } catch (error) {
      // エラーが発生した場合はログに記録
      if (typeof console !== 'undefined' && console.error) {
        console.error('MIDI message handling error:', error);
      }
    }
  }

  private handleStateChange(event: MIDIConnectionEvent): void {
    const port = event.port;
    if (!port) {
      return;
    }
    
    console.log(`MIDI port ${port.name} ${port.state}`);

    if (port.type === 'input') {
      if (port.state === 'connected') {
        this.connectToInput(port as MIDIInput);
      } else if (port.state === 'disconnected') {
        this.disconnectFromInput(port as MIDIInput);
      }
    }

    this.isConnected = this.connectedInputs.length > 0;
  }

  private disconnectFromInput(input: MIDIInput): void {
    const index = this.connectedInputs.indexOf(input);
    if (index > -1) {
      input.onmidimessage = null;
      this.connectedInputs.splice(index, 1);
      console.log(`Disconnected from MIDI input: ${input.name}`);
    }
  }

  private triggerNoteOnCallbacks(note: number, velocity: number, toneTime: number): void {
    this.noteOnCallbacks.forEach(callback => {
      try {
        if (typeof callback === 'function') {
          callback(note, velocity, toneTime);
        }
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('Error in note on callback:', error);
        }
      }
    });
  }

  private triggerNoteOffCallbacks(note: number, toneTime: number): void {
    this.noteOffCallbacks.forEach(callback => {
      try {
        if (typeof callback === 'function') {
          callback(note, toneTime);
        }
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('Error in note off callback:', error);
        }
      }
    });
  }
}