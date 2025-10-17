/**
 * 88鍵盤のレイアウト計算を行うクラス
 * Canvas描画に依存しない純粋な計算ロジック
 */

export interface KeyboardLayout {
  whiteKeyWidth: number;
  blackKeyWidth: number;
  whiteKeyHeight: number;
  blackKeyHeight: number;
}

export interface KeyboardConfig {
  whiteKeys: number[];  // [0, 2, 4, 5, 7, 9, 11] (C, D, E, F, G, A, B)
  blackKeys: number[];  // [1, 3, 6, 8, 10] (C#, D#, F#, G#, A#)
  midiRange: { min: number; max: number };  // A0(21) to C8(108)
  totalWhiteKeys: number;  // 52 keys
}

export class KeyboardLayoutCalculator {
  private readonly config: KeyboardConfig = {
    whiteKeys: [0, 2, 4, 5, 7, 9, 11], // C, D, E, F, G, A, B
    blackKeys: [1, 3, 6, 8, 10], // C#, D#, F#, G#, A#
    midiRange: { min: 21, max: 108 }, // A0 to C8 (88 keys)
    totalWhiteKeys: 52, // 88鍵盤の白鍵数
  };

  /**
   * キャンバスサイズから鍵盤レイアウトを計算
   * @param canvasWidth キャンバスの幅
   * @param canvasHeight キャンバスの高さ
   * @param keyboardHeightRatio 鍵盤エリアの高さ比率（デフォルト0.2 = 20%）
   * @returns 鍵盤のレイアウト情報
   */
  calculateLayout(
    canvasWidth: number,
    canvasHeight: number,
    keyboardHeightRatio: number = 0.2
  ): KeyboardLayout {
    const keyboardHeight = canvasHeight * keyboardHeightRatio;
    const whiteKeyWidth = canvasWidth / this.config.totalWhiteKeys;
    const blackKeyWidth = whiteKeyWidth * 0.6;
    const whiteKeyHeight = keyboardHeight;
    const blackKeyHeight = keyboardHeight * 0.6;

    return {
      whiteKeyWidth,
      blackKeyWidth,
      whiteKeyHeight,
      blackKeyHeight,
    };
  }

  /**
   * 音程（MIDIノート番号）が黒鍵かどうかを判定
   * @param pitch MIDIノート番号
   * @returns 黒鍵の場合true
   */
  isBlackKey(pitch: number): boolean {
    const noteInOctave = pitch % 12;
    return this.config.blackKeys.includes(noteInOctave);
  }

  /**
   * 音程（MIDIノート番号）が白鍵かどうかを判定
   * @param pitch MIDIノート番号
   * @returns 白鍵の場合true
   */
  isWhiteKey(pitch: number): boolean {
    const noteInOctave = pitch % 12;
    return this.config.whiteKeys.includes(noteInOctave);
  }

  /**
   * 音程（MIDIノート番号）に基づいてノートのX座標を計算
   * @param pitch MIDIノート番号
   * @param layout 鍵盤レイアウト
   * @returns X座標（ノートの中央位置）、範囲外の場合は-1
   */
  getNoteXPosition(pitch: number, layout: KeyboardLayout): number {
    // 88鍵盤の範囲チェック
    if (pitch < this.config.midiRange.min || pitch > this.config.midiRange.max) {
      return -1; // 表示範囲外
    }

    const noteInOctave = pitch % 12;
    let whiteKeyIndex = 0;

    // 指定されたピッチまでの白鍵数をカウント
    for (let midiNote = this.config.midiRange.min; midiNote <= pitch; midiNote++) {
      const currentNoteInOctave = midiNote % 12;

      // 白鍵の位置をカウント（黒鍵の位置計算のため）
      if (this.config.whiteKeys.includes(currentNoteInOctave)) {
        whiteKeyIndex++;
      }

      // 目的のピッチに到達したら処理を終了
      if (midiNote === pitch) {
        break;
      }
    }

    if (this.config.whiteKeys.includes(noteInOctave)) {
      // 白鍵の場合：中央に配置
      return (whiteKeyIndex - 1) * layout.whiteKeyWidth + layout.whiteKeyWidth / 2;
    } else {
      // 黒鍵の場合：白鍵の間に配置
      const x = (whiteKeyIndex - 1) * layout.whiteKeyWidth +
        layout.whiteKeyWidth - layout.blackKeyWidth / 2;
      // 黒鍵の中央を返す
      return x + layout.blackKeyWidth / 2;
    }
  }

  /**
   * 白鍵のX座標を計算
   * @param whiteKeyIndex 白鍵のインデックス（0始まり）
   * @param layout 鍵盤レイアウト
   * @returns X座標
   */
  getWhiteKeyX(whiteKeyIndex: number, layout: KeyboardLayout): number {
    return whiteKeyIndex * layout.whiteKeyWidth;
  }

  /**
   * 黒鍵のX座標を計算
   * @param whiteKeyIndex 直前の白鍵のインデックス
   * @param layout 鍵盤レイアウト
   * @returns X座標
   */
  getBlackKeyX(whiteKeyIndex: number, layout: KeyboardLayout): number {
    return (whiteKeyIndex - 1) * layout.whiteKeyWidth +
      layout.whiteKeyWidth - layout.blackKeyWidth / 2;
  }

  /**
   * 指定範囲のMIDIノート番号に対して、白鍵と黒鍵の情報を取得
   * @param layout 鍵盤レイアウト
   * @returns 白鍵と黒鍵の配列
   */
  getKeyPositions(layout: KeyboardLayout): {
    whiteKeys: Array<{ pitch: number; x: number }>;
    blackKeys: Array<{ pitch: number; x: number }>;
  } {
    const whiteKeys: Array<{ pitch: number; x: number }> = [];
    const blackKeys: Array<{ pitch: number; x: number }> = [];
    let whiteKeyIndex = 0;

    for (let midiNote = this.config.midiRange.min; midiNote <= this.config.midiRange.max; midiNote++) {
      const noteInOctave = midiNote % 12;

      if (this.config.whiteKeys.includes(noteInOctave)) {
        // 白鍵
        whiteKeys.push({
          pitch: midiNote,
          x: this.getWhiteKeyX(whiteKeyIndex, layout),
        });
        whiteKeyIndex++;
      } else if (this.config.blackKeys.includes(noteInOctave)) {
        // 黒鍵
        blackKeys.push({
          pitch: midiNote,
          x: this.getBlackKeyX(whiteKeyIndex, layout),
        });
      }
    }

    return { whiteKeys, blackKeys };
  }

  /**
   * 設定を取得
   */
  getConfig(): Readonly<KeyboardConfig> {
    return this.config;
  }

  /**
   * 白鍵の総数を取得
   */
  getTotalWhiteKeys(): number {
    return this.config.totalWhiteKeys;
  }

  /**
   * MIDIノート番号の範囲を取得
   */
  getMidiRange(): Readonly<{ min: number; max: number }> {
    return this.config.midiRange;
  }
}
