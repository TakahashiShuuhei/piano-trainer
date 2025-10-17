import { BeatTimeConverter as IBeatTimeConverter, MusicalNote, Note, SongMemo, Memo } from '../types/index.js';

/**
 * 音楽的タイミング（拍）と実時間（ミリ秒）の変換を行うクラス
 * 四分音符を1.0として扱う
 */
export class BeatTimeConverter implements IBeatTimeConverter {
  private bpm: number;

  constructor(bpm: number = 120) {
    this.bpm = bpm;
  }

  /**
   * 拍数をミリ秒に変換
   * @param beats 四分音符単位での拍数
   * @returns ミリ秒
   */
  beatsToMs(beats: number): number {
    const quarterNoteMs = (60 / this.bpm) * 1000;
    return beats * quarterNoteMs;
  }

  /**
   * ミリ秒を拍数に変換
   * @param ms ミリ秒
   * @returns 四分音符単位での拍数
   */
  msToBeats(ms: number): number {
    const quarterNoteMs = (60 / this.bpm) * 1000;
    return ms / quarterNoteMs;
  }

  /**
   * BPMを設定
   * @param bpm 新しいBPM
   */
  setBPM(bpm: number): void {
    if (bpm <= 0) {
      throw new Error('BPM must be greater than 0');
    }
    this.bpm = bpm;
  }

  /**
   * 現在のBPMを取得
   * @returns 現在のBPM
   */
  getBPM(): number {
    return this.bpm;
  }

  /**
   * 音楽的ノートを時間ベースのノートに変換
   * @param musicalNote 音楽的タイミングのノート
   * @returns 時間ベースのノート
   */
  convertNote(musicalNote: MusicalNote): Note {
    const result: Note = {
      pitch: musicalNote.pitch,
      startTime: this.beatsToMs(musicalNote.timing.beat),
      duration: this.beatsToMs(musicalNote.timing.duration),
      velocity: musicalNote.velocity
    };
    

    

    
    return result;
  }

  /**
   * 音楽的ノート配列を時間ベースのノート配列に変換
   * @param musicalNotes 音楽的タイミングのノート配列
   * @returns 時間ベースのノート配列
   */
  convertNotes(musicalNotes: MusicalNote[]): Note[] {
    return musicalNotes.map(note => this.convertNote(note));
  }

  /**
   * 時間ベースのノートを音楽的ノートに変換（逆変換）
   * @param note 時間ベースのノート
   * @returns 音楽的タイミングのノート
   */
  convertToMusicalNote(note: Note): MusicalNote {
    const result: MusicalNote = {
      pitch: note.pitch,
      timing: {
        beat: this.msToBeats(note.startTime),
        duration: this.msToBeats(note.duration)
      },
      velocity: note.velocity
    };
    

    

    
    return result;
  }

  /**
   * 時間ベースのノート配列を音楽的ノート配列に変換（逆変換）
   * @param notes 時間ベースのノート配列
   * @returns 音楽的タイミングのノート配列
   */
  convertToMusicalNotes(notes: Note[]): MusicalNote[] {
    return notes.map(note => this.convertToMusicalNote(note));
  }

  /**
   * SongMemoを時間ベースのMemoに変換
   * @param songMemo 拍ベースのメモ
   * @returns 時間ベースのメモ
   */
  convertMemo(songMemo: SongMemo): Memo {
    return {
      startTime: this.beatsToMs(songMemo.timing.beat),
      text: songMemo.text,
      align: songMemo.align || 'center',
      color: songMemo.color || 'default'
    };
  }

  /**
   * SongMemo配列を時間ベースのMemo配列に変換
   * @param songMemos 拍ベースのメモ配列
   * @returns 時間ベースのメモ配列
   */
  convertMemos(songMemos: SongMemo[]): Memo[] {
    return songMemos.map(memo => this.convertMemo(memo));
  }

  /**
   * 指定された拍数での四分音符の長さ（ミリ秒）を取得
   * @returns 四分音符の長さ（ミリ秒）
   */
  getQuarterNoteMs(): number {
    return (60 / this.bpm) * 1000;
  }

  /**
   * 指定されたBPMでの四分音符の長さ（ミリ秒）を取得（静的メソッド）
   * @param bpm BPM
   * @returns 四分音符の長さ（ミリ秒）
   */
  static getQuarterNoteMsForBPM(bpm: number): number {
    return (60 / bpm) * 1000;
  }
}