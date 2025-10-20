/**
 * 音楽的時間と実時間の変換・管理を行うクラス
 * BPM変更やシークバー機能に対応
 */
export class MusicalTimeManager {
  private currentBPM: number;
  private gameStartTime: number = 0;
  private pausedTime: number = 0;
  private totalPausedDuration: number = 0;
  private seekOffset: number = 0; // シークバーによる位置調整
  private pausedMusicalPosition: number = 0; // 一時停止時の音楽的位置

  // Wait-for-input mode support
  private timeMode: 'realtime' | 'frozen' = 'realtime';
  private frozenTime: number = 0; // Time when frozen (for wait-for-input mode)

  constructor(initialBPM: number = 120) {
    this.currentBPM = initialBPM;
  }

  /**
   * ゲーム開始
   */
  public start(): void {
    this.gameStartTime = Date.now();
    this.pausedTime = 0;
    this.totalPausedDuration = 0;
    this.seekOffset = 0;
    this.timeMode = 'realtime';
    this.frozenTime = 0;
  }

  /**
   * 一時停止
   */
  public pause(): void {
    if (this.pausedTime === 0) {
      this.pausedTime = Date.now();
      // 一時停止時の音楽的位置を記録
      this.pausedMusicalPosition = this.getCurrentMusicalPosition();
    }
  }

  /**
   * 再開
   */
  public resume(): void {
    if (this.pausedTime > 0) {
      this.totalPausedDuration += Date.now() - this.pausedTime;
      this.pausedTime = 0;
      this.pausedMusicalPosition = 0; // リセット
    }
  }

  /**
   * 停止・リセット
   */
  public stop(): void {
    this.gameStartTime = 0;
    this.pausedTime = 0;
    this.totalPausedDuration = 0;
    this.seekOffset = 0;
    this.pausedMusicalPosition = 0;
    this.timeMode = 'realtime';
    this.frozenTime = 0;
  }

  /**
   * BPMを変更（音楽的位置を保持）
   */
  public setBPM(newBPM: number): void {
    if (newBPM <= 0) return;

    // 現在の音楽的位置を取得
    const currentMusicalPosition = this.getCurrentMusicalPosition();
    
    // BPMを更新
    this.currentBPM = newBPM;
    
    // 一時停止中の場合は、一時停止時の音楽的位置も更新
    if (this.pausedTime > 0) {
      this.pausedMusicalPosition = currentMusicalPosition;
    }
    
    // 新しいBPMで同じ音楽的位置になるように時間を調整
    this.seekToMusicalPosition(currentMusicalPosition);
  }

  /**
   * 現在の音楽的位置を取得（拍数）
   */
  public getCurrentMusicalPosition(): number {
    // 一時停止中は固定された位置を返す
    if (this.pausedTime > 0) {
      return this.pausedMusicalPosition;
    }
    
    const realTime = this.getCurrentRealTime();
    return this.realTimeToMusicalPosition(realTime);
  }

  /**
   * 現在の実時間を取得（一時停止時間を除外）
   */
  public getCurrentRealTime(): number {
    if (this.gameStartTime === 0) return 0;

    // Wait-for-input mode: return frozen time
    if (this.timeMode === 'frozen') {
      return this.frozenTime;
    }

    const now = Date.now();
    const pausedDuration = this.pausedTime > 0 ? (now - this.pausedTime) : 0;
    return now - this.gameStartTime - this.totalPausedDuration - pausedDuration + this.seekOffset;
  }

  /**
   * 実時間を音楽的位置（拍数）に変換
   */
  public realTimeToMusicalPosition(realTimeMs: number): number {
    // 1拍の長さ（ミリ秒）= 60000ms / BPM
    const beatDurationMs = 60000 / this.currentBPM;
    return realTimeMs / beatDurationMs;
  }

  /**
   * 音楽的位置（拍数）を実時間に変換
   */
  public musicalPositionToRealTime(beats: number): number {
    const beatDurationMs = 60000 / this.currentBPM;
    return beats * beatDurationMs;
  }

  /**
   * 指定した音楽的位置にシーク
   */
  public seekToMusicalPosition(targetBeats: number): void {
    const targetRealTime = this.musicalPositionToRealTime(targetBeats);
    const currentRealTime = this.getCurrentRealTime();
    this.seekOffset += targetRealTime - currentRealTime;
  }

  /**
   * 指定した実時間にシーク
   */
  public seekToRealTime(targetRealTimeMs: number): void {
    const currentRealTime = this.getCurrentRealTime();
    this.seekOffset += targetRealTimeMs - currentRealTime;
  }

  /**
   * シークバー用：進行度を0-1で取得
   */
  public getProgress(totalDurationMs: number): number {
    const currentTime = this.getCurrentRealTime();
    return Math.max(0, Math.min(1, currentTime / totalDurationMs));
  }

  /**
   * シークバー用：進行度(0-1)から位置を設定
   */
  public setProgress(progress: number, totalDurationMs: number): void {
    const targetTime = progress * totalDurationMs;
    this.seekToRealTime(targetTime);
  }

  /**
   * 現在のBPMを取得
   */
  public getBPM(): number {
    return this.currentBPM;
  }

  /**
   * ゲーム開始済みかどうか
   */
  public isStarted(): boolean {
    return this.gameStartTime > 0;
  }

  /**
   * 一時停止中かどうか
   */
  public isPaused(): boolean {
    return this.pausedTime > 0;
  }

  /**
   * Wait-for-input mode: Freeze time at current position
   */
  public freezeTimeAt(timeMs: number): void {
    this.timeMode = 'frozen';
    this.frozenTime = timeMs;
  }

  /**
   * Wait-for-input mode: Unfreeze and continue from frozen time
   */
  public unfreezeTime(): void {
    if (this.timeMode === 'frozen') {
      // Adjust gameStartTime so that getCurrentRealTime() continues from frozenTime
      // Formula: now - gameStartTime - totalPausedDuration + seekOffset = frozenTime
      // Therefore: gameStartTime = now - frozenTime - totalPausedDuration + seekOffset
      const now = Date.now();
      this.gameStartTime = now - this.frozenTime - this.totalPausedDuration + this.seekOffset;

      this.timeMode = 'realtime';
      this.frozenTime = 0;
    }
  }

  /**
   * Check if time is currently frozen
   */
  public isFrozen(): boolean {
    return this.timeMode === 'frozen';
  }

  /**
   * デバッグ情報を取得
   */
  public getDebugInfo(): {
    gameStartTime: number;
    pausedTime: number;
    totalPausedDuration: number;
    seekOffset: number;
    pausedMusicalPosition: number;
    currentBPM: number;
    currentRealTime: number;
    currentMusicalPosition: number;
    isPaused: boolean;
    timeMode: 'realtime' | 'frozen';
    frozenTime: number;
  } {
    return {
      gameStartTime: this.gameStartTime,
      pausedTime: this.pausedTime,
      totalPausedDuration: this.totalPausedDuration,
      seekOffset: this.seekOffset,
      pausedMusicalPosition: this.pausedMusicalPosition,
      currentBPM: this.currentBPM,
      currentRealTime: this.getCurrentRealTime(),
      currentMusicalPosition: this.getCurrentMusicalPosition(),
      isPaused: this.isPaused(),
      timeMode: this.timeMode,
      frozenTime: this.frozenTime
    };
  }
}