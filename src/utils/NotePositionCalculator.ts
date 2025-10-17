/**
 * ノートの位置計算を行うクラス
 * Canvas描画に依存しない純粋な計算ロジック
 */

import { Note } from '../types/index.js';

export class NotePositionCalculator {
  // ノート表示の定数
  private readonly SHOW_AHEAD_TIME = 2000; // ノートを2秒前から表示
  private readonly HIDE_AFTER_TIME = 1000; // ノート終了後1秒間表示

  // ノート高さ計算の定数
  private readonly BASE_DURATION = 500; // 基準duration（四分音符）
  private readonly MIN_HEIGHT = 30;     // 最小高さ
  private readonly MAX_HEIGHT = 300;    // 最大高さ（音符の長さを視覚的に表現するため増加）
  private readonly MAX_DURATION_RATIO = 4; // 最大4倍まで

  /**
   * ノートが表示される時刻を計算
   * @param noteStartTime ノート開始時刻
   * @returns 表示開始時刻
   */
  getShowTime(noteStartTime: number): number {
    return noteStartTime - this.SHOW_AHEAD_TIME;
  }

  /**
   * ノートが非表示になる時刻を計算
   * @param note ノート情報
   * @returns 非表示時刻
   */
  getHideTime(note: Note): number {
    return note.startTime + note.duration + this.HIDE_AFTER_TIME;
  }

  /**
   * ノートが現在表示範囲内かどうかを判定
   * @param currentTime 現在時刻
   * @param note ノート情報
   * @returns 表示範囲内の場合true
   */
  isNoteVisible(currentTime: number, note: Note): boolean {
    const showTime = this.getShowTime(note.startTime);
    const hideTime = this.getHideTime(note);
    return currentTime >= showTime && currentTime <= hideTime;
  }

  /**
   * ノートのY座標を計算（上から下に流れる）
   * @param currentTime 現在時刻
   * @param noteStartTime ノート開始時刻
   * @param noteAreaHeight ノート表示エリアの高さ
   * @param noteHeight ノートの高さ
   * @returns Y座標（ノートの上端）
   */
  calculateNoteY(
    currentTime: number,
    noteStartTime: number,
    noteAreaHeight: number,
    noteHeight: number
  ): number {
    const showTime = this.getShowTime(noteStartTime);
    const progress = Math.max(0, (currentTime - showTime) / this.SHOW_AHEAD_TIME);

    // ノートの下端がタイミングラインに到達するタイミングで音が鳴る
    return progress * noteAreaHeight - noteHeight;
  }

  /**
   * ノートの高さを計算（durationに応じて変化）
   * @param noteDuration ノートのduration（ミリ秒）
   * @returns ノートの高さ（ピクセル）
   * @deprecated 代わりにcalculateNoteHeightFromPositionsを使用してください
   */
  calculateNoteHeight(noteDuration: number): number {
    // durationが0以下の場合は最小高さ
    if (noteDuration <= 0) {
      return this.MIN_HEIGHT;
    }

    const durationRatio = Math.min(noteDuration / this.BASE_DURATION, this.MAX_DURATION_RATIO);

    // durationRatioが1未満（500ms未満）の場合は最小高さ
    if (durationRatio < 1) {
      return this.MIN_HEIGHT;
    }

    const height = this.MIN_HEIGHT + ((durationRatio - 1) * 100);
    return Math.min(this.MAX_HEIGHT, height);
  }

  /**
   * ノートの開始位置と終了位置のY座標から高さを計算
   * @param currentTime 現在時刻
   * @param note ノート情報
   * @param noteAreaHeight ノート表示エリアの高さ
   * @returns { y: number, height: number } ノートの上端Y座標と高さ
   */
  calculateNoteHeightFromPositions(
    currentTime: number,
    note: Note,
    noteAreaHeight: number
  ): { y: number; height: number } {
    const noteStartTime = note.startTime;
    const noteEndTime = note.startTime + note.duration;

    // 開始時刻と終了時刻のそれぞれのY座標を計算
    const showTimeStart = this.getShowTime(noteStartTime);
    const showTimeEnd = this.getShowTime(noteEndTime);

    // 開始位置のprogress（ノートの下端）
    const progressStart = Math.max(0, (currentTime - showTimeStart) / this.SHOW_AHEAD_TIME);
    const yBottom = progressStart * noteAreaHeight;

    // 終了位置のprogress（ノートの上端）
    const progressEnd = Math.max(0, (currentTime - showTimeEnd) / this.SHOW_AHEAD_TIME);
    const yTop = progressEnd * noteAreaHeight;

    // 高さは下端 - 上端（上から下に流れるため）
    const height = Math.max(this.MIN_HEIGHT, yBottom - yTop);

    return {
      y: yTop,
      height: height
    };
  }

  /**
   * ノートが画面外（下）に出たかどうかを判定
   * @param noteY ノートのY座標（上端）
   * @param canvasHeight キャンバスの高さ
   * @returns 画面外の場合true
   */
  isNoteOffScreen(noteY: number, canvasHeight: number): boolean {
    return noteY > canvasHeight;
  }

  /**
   * ノートの表示進行度を計算（0.0 ～ 1.0以上）
   * @param currentTime 現在時刻
   * @param noteStartTime ノート開始時刻
   * @returns 進行度（0.0 = 表示開始、1.0 = タイミングライン到達）
   */
  calculateProgress(currentTime: number, noteStartTime: number): number {
    const showTime = this.getShowTime(noteStartTime);
    return Math.max(0, (currentTime - showTime) / this.SHOW_AHEAD_TIME);
  }

  /**
   * ノートがアクティブ（演奏タイミング）かどうかを判定
   * @param currentTime 現在時刻
   * @param noteStartTime ノート開始時刻
   * @returns アクティブの場合true
   */
  isNoteActive(currentTime: number, noteStartTime: number): boolean {
    return currentTime >= noteStartTime;
  }

  /**
   * ノート表示の定数を取得
   */
  getConstants(): {
    showAheadTime: number;
    hideAfterTime: number;
    baseDuration: number;
    minHeight: number;
    maxHeight: number;
  } {
    return {
      showAheadTime: this.SHOW_AHEAD_TIME,
      hideAfterTime: this.HIDE_AFTER_TIME,
      baseDuration: this.BASE_DURATION,
      minHeight: this.MIN_HEIGHT,
      maxHeight: this.MAX_HEIGHT,
    };
  }
}
