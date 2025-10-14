import { Note } from '../types/index.js';

/**
 * スコア評価クラス
 * シンプルなアプローチ：
 * - ±100msecの許容範囲でヒット判定
 * - 各ノートは最大1回まで正解
 * - 関係ない音は無視（ミスとしてカウントしない）
 * - 連打も無視
 */
export class ScoreEvaluator {
  private hitNoteIndices = new Set<number>();      // 正解したノートのindex（現在のループ）
  private activeNoteIndices = new Set<number>();   // 現在アクティブ（演奏対象）なノートのindex（現在のループ）
  private readonly hitWindow = 300; // ±100msec

  // ループ対応：累積スコア管理
  private totalCorrectCount = 0;  // 全ループ通しての正解数
  private totalNoteCount = 0;     // 全ループ通しての総ノート数

  /**
   * キーボード入力時の評価
   * @param inputNote 入力されたMIDIノート番号
   * @param currentTime 現在時刻（ミリ秒）
   * @param notes 楽譜のノート配列
   * @returns ヒットしたかどうか
   */
  public evaluateInput(inputNote: number, currentTime: number, notes: Note[]): {
    isHit: boolean;
    hitNoteIndex?: number;
  } {
    // 候補ノートを探す（未ヒット + 音程一致 + タイミング範囲内）
    const candidates = notes
      .map((note, index) => ({ note, index }))
      .filter(({ note, index }) =>
        !this.hitNoteIndices.has(index) &&
        note.pitch === inputNote &&
        Math.abs(note.startTime - currentTime) <= this.hitWindow
      )
      .sort((a, b) => a.index - b.index); // indexの小さい順

    if (candidates.length > 0) {
      const hitIndex = candidates[0]!.index;
      this.hitNoteIndices.add(hitIndex);

      return { isHit: true, hitNoteIndex: hitIndex };
    }


    return { isHit: false };
  }

  /**
   * 時間経過でアクティブノートを更新
   * ノートの開始タイミングに到達したらアクティブセットに追加
   * @param currentTime 現在時刻（ミリ秒）
   * @param notes 楽譜のノート配列
   */
  public updateActiveNotes(currentTime: number, notes: Note[]): void {
    notes.forEach((note, index) => {
      // ノートの開始タイミングに到達したらアクティブに追加
      if (currentTime >= note.startTime && !this.activeNoteIndices.has(index)) {
        this.activeNoteIndices.add(index);
      }
    });
  }

  /**
   * 現在のスコアを取得（累積スコア + 現在のループ）
   * @returns スコア情報
   */
  public getScore(): {
    correct: number;
    total: number;
    accuracy: number;
    hitIndices: number[];
    activeIndices: number[];
  } {
    // 累積スコア + 現在のループのスコア
    const currentCorrect = this.hitNoteIndices.size;
    const currentTotal = this.activeNoteIndices.size;

    const totalCorrect = this.totalCorrectCount + currentCorrect;
    const totalNotes = this.totalNoteCount + currentTotal;

    return {
      correct: totalCorrect,
      total: totalNotes,
      accuracy: totalNotes > 0 ? totalCorrect / totalNotes : 1.0,
      hitIndices: Array.from(this.hitNoteIndices).sort((a, b) => a - b),
      activeIndices: Array.from(this.activeNoteIndices).sort((a, b) => a - b)
    };
  }

  /**
   * 見逃したノートを取得
   * アクティブになったが、まだヒットしていないノート
   */
  public getMissedNotes(currentTime: number, notes: Note[]): number[] {
    const missedIndices: number[] = [];

    this.activeNoteIndices.forEach(index => {
      const note = notes[index];
      if (note && !this.hitNoteIndices.has(index)) {
        // ノートの終了時刻 + 許容範囲を過ぎていたら見逃し
        const noteEndTime = note.startTime + note.duration;
        if (currentTime > noteEndTime + this.hitWindow) {
          missedIndices.push(index);
        }
      }
    });

    return missedIndices;
  }

  /**
   * 現在ヒット可能なノートを取得（デバッグ用）
   */
  public getHitableNotes(inputNote: number, currentTime: number, notes: Note[]): Array<{
    index: number;
    note: Note;
    timingDiff: number;
  }> {
    return notes
      .map((note, index) => ({ note, index }))
      .filter(({ note, index }) =>
        !this.hitNoteIndices.has(index) &&
        note.pitch === inputNote &&
        Math.abs(note.startTime - currentTime) <= this.hitWindow
      )
      .map(({ note, index }) => ({
        index,
        note,
        timingDiff: note.startTime - currentTime
      }))
      .sort((a, b) => a.index - b.index);
  }

  /**
   * 現在のループのスコアを累積に追加（ループ終了時に呼び出し）
   */
  public finalizeCurrentLoop(): void {
    this.totalCorrectCount += this.hitNoteIndices.size;
    this.totalNoteCount += this.activeNoteIndices.size;

    // 現在のループの状態をクリア
    this.hitNoteIndices.clear();
    this.activeNoteIndices.clear();
  }

  /**
   * スコア評価をリセット（新しいセッション開始時）
   */
  public reset(): void {
    this.hitNoteIndices.clear();
    this.activeNoteIndices.clear();

    // 累積スコアもリセット
    this.totalCorrectCount = 0;
    this.totalNoteCount = 0;
  }

  /**
   * デバッグ情報を出力
   */
  public debugInfo(): void {
    const score = this.getScore();
    console.log('=== ScoreEvaluator Debug Info ===');
    console.log(`Current loop - Hit notes: [${score.hitIndices.join(', ')}]`);
    console.log(`Current loop - Active notes: [${score.activeIndices.join(', ')}]`);
    console.log(`Total accumulated score: ${score.correct}/${score.total} (${(score.accuracy * 100).toFixed(1)}%)`);
    console.log(`Accumulated from previous loops: ${this.totalCorrectCount}/${this.totalNoteCount}`);
    console.log(`Current loop: ${this.hitNoteIndices.size}/${this.activeNoteIndices.size}`);
  }
}