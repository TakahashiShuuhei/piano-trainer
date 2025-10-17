/**
 * 時間フォーマット用ユーティリティクラス
 * Canvas/DOMに依存しない純粋な関数
 */

export class TimeFormatter {
  /**
   * ミリ秒を "M:SS" 形式にフォーマット
   * @param milliseconds ミリ秒
   * @returns "M:SS" 形式の文字列（例: "0:00", "1:23", "12:45"）
   */
  static formatTime(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * ミリ秒を "MM:SS" 形式にフォーマット（分も2桁表示）
   * @param milliseconds ミリ秒
   * @returns "MM:SS" 形式の文字列（例: "00:00", "01:23", "12:45"）
   */
  static formatTimeWithPadding(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * ミリ秒を秒数に変換（小数点以下1桁）
   * @param milliseconds ミリ秒
   * @returns 秒数（例: 1234 → 1.2）
   */
  static toSeconds(milliseconds: number): number {
    return Math.round(milliseconds / 100) / 10;
  }

  /**
   * 秒数をミリ秒に変換
   * @param seconds 秒数
   * @returns ミリ秒
   */
  static toMilliseconds(seconds: number): number {
    return Math.round(seconds * 1000);
  }
}
