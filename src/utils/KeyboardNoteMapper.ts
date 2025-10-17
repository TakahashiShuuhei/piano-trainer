/**
 * キーボードキーをMIDIノート番号にマッピングするユーティリティクラス
 * MIDI接続がない場合のフォールバック機能として使用
 */

export class KeyboardNoteMapper {
  // キーボードキーとMIDIノート番号のマッピング
  // C4 (Middle C) = MIDI note 60 を中心に配置
  private static readonly keyToNote: { [key: string]: number } = {
    'a': 60, // C4 (Middle C)
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

  /**
   * キーボードキーからMIDIノート番号を取得
   * @param key キーボードキー（小文字または大文字）
   * @returns MIDIノート番号（マッピングが存在しない場合はundefined）
   */
  static getMidiNote(key: string): number | undefined {
    return this.keyToNote[key.toLowerCase()];
  }

  /**
   * キーがマッピングされているか確認
   * @param key キーボードキー
   * @returns マッピングが存在する場合true
   */
  static hasMapping(key: string): boolean {
    return key.toLowerCase() in this.keyToNote;
  }

  /**
   * すべてのマッピングを取得
   * @returns キーとMIDIノート番号のマッピング
   */
  static getAllMappings(): { [key: string]: number } {
    return { ...this.keyToNote };
  }

  /**
   * MIDIノート番号からキーボードキーを取得
   * @param midiNote MIDIノート番号
   * @returns キーボードキーの配列（複数のキーが同じノートにマッピングされている可能性があるため）
   */
  static getKeysForNote(midiNote: number): string[] {
    return Object.entries(this.keyToNote)
      .filter(([_, note]) => note === midiNote)
      .map(([key, _]) => key);
  }

  /**
   * マッピングされているキーの一覧を取得
   * @returns キーの配列
   */
  static getAllKeys(): string[] {
    return Object.keys(this.keyToNote);
  }

  /**
   * マッピングされているノートの一覧を取得（重複なし）
   * @returns MIDIノート番号の配列（昇順）
   */
  static getAllNotes(): number[] {
    const notes = Array.from(new Set(Object.values(this.keyToNote)));
    return notes.sort((a, b) => a - b);
  }

  /**
   * マッピングされているノートの範囲を取得
   * @returns { min: 最小ノート番号, max: 最大ノート番号 }
   */
  static getNoteRange(): { min: number; max: number } {
    const notes = this.getAllNotes();
    if (notes.length === 0) {
      throw new Error('No notes mapped');
    }
    return {
      min: notes[0]!,
      max: notes[notes.length - 1]!
    };
  }
}
