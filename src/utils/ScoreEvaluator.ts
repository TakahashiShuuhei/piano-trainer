import { Note } from '../types/index.js';

/**
 * スコア評価クラス
 * シンプルなアプローチ：
 * - ±100msecの許容範囲でヒット判定
 * - 各ノートは各プレイセッションで最大1回まで正解
 * - 関係ない音は無視（ミスとしてカウントしない）
 * - 連打も無視
 *
 * プレイセッション管理：
 * - シークや部分リピートに対応するため、セッションIDで管理
 * - ノートIDベースで管理（インデックスに依存しない）
 */
export class ScoreEvaluator {
  // プレイセッション管理
  private currentPlaySessionId = 0;
  private hitNotes = new Map<string, number>();    // noteId -> sessionId
  private activeNotes = new Map<string, number>(); // noteId -> sessionId
  private readonly hitWindow = 200; // ±200msec

  // ループ対応：累積スコア管理
  private totalCorrectCount = 0;  // 全ループ通しての正解数
  private totalNoteCount = 0;     // 全ループ通しての総ノート数

  /**
   * ノートの一意なIDを生成
   */
  private getNoteId(note: Note): string {
    return `${note.pitch}-${note.startTime}`;
  }

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
      .filter(({ note, index }) => {
        const noteId = this.getNoteId(note);
        const isAlreadyHit = this.hitNotes.get(noteId) === this.currentPlaySessionId;
        return !isAlreadyHit &&
          note.pitch === inputNote &&
          Math.abs(note.startTime - currentTime) <= this.hitWindow;
      })
      .sort((a, b) => a.note.startTime - b.note.startTime); // startTimeの早い順

    if (candidates.length > 0) {
      const { note, index } = candidates[0]!;
      const noteId = this.getNoteId(note);
      this.hitNotes.set(noteId, this.currentPlaySessionId);

      return { isHit: true, hitNoteIndex: index };
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
    notes.forEach((note) => {
      const noteId = this.getNoteId(note);
      const isAlreadyActive = this.activeNotes.get(noteId) === this.currentPlaySessionId;

      // ノートの開始タイミングに到達したらアクティブに追加
      if (currentTime >= note.startTime && !isAlreadyActive) {
        this.activeNotes.set(noteId, this.currentPlaySessionId);
      }
    });
  }

  /**
   * 現在のスコアを取得（累積スコア + 現在のセッション）
   * @returns スコア情報
   */
  public getScore(): {
    correct: number;
    total: number;
    accuracy: number;
    hitIndices: number[];
    activeIndices: number[];
  } {
    // 現在のセッションでヒット/アクティブなノート数を計算
    const currentCorrect = Array.from(this.hitNotes.values())
      .filter(sessionId => sessionId === this.currentPlaySessionId).length;
    const currentTotal = Array.from(this.activeNotes.values())
      .filter(sessionId => sessionId === this.currentPlaySessionId).length;

    const totalCorrect = this.totalCorrectCount + currentCorrect;
    const totalNotes = this.totalNoteCount + currentTotal;

    // インデックスの代わりにnoteIdを返す（後方互換性のため空配列）
    return {
      correct: totalCorrect,
      total: totalNotes,
      accuracy: totalNotes > 0 ? totalCorrect / totalNotes : 1.0,
      hitIndices: [], // 非推奨：IDベースに移行したため空
      activeIndices: [] // 非推奨：IDベースに移行したため空
    };
  }

  /**
   * 見逃したノートを取得
   * アクティブになったが、まだヒットしていないノート
   */
  public getMissedNotes(currentTime: number, notes: Note[]): string[] {
    const missedNoteIds: string[] = [];

    notes.forEach(note => {
      const noteId = this.getNoteId(note);
      const isActive = this.activeNotes.get(noteId) === this.currentPlaySessionId;
      const isHit = this.hitNotes.get(noteId) === this.currentPlaySessionId;

      if (isActive && !isHit) {
        // ノートの終了時刻 + 許容範囲を過ぎていたら見逃し
        const noteEndTime = note.startTime + note.duration;
        if (currentTime > noteEndTime + this.hitWindow) {
          missedNoteIds.push(noteId);
        }
      }
    });

    return missedNoteIds;
  }

  /**
   * 現在ヒット可能なノートを取得（デバッグ用）
   */
  public getHitableNotes(inputNote: number, currentTime: number, notes: Note[]): Array<{
    noteId: string;
    note: Note;
    timingDiff: number;
  }> {
    return notes
      .filter(note => {
        const noteId = this.getNoteId(note);
        const isAlreadyHit = this.hitNotes.get(noteId) === this.currentPlaySessionId;
        return !isAlreadyHit &&
          note.pitch === inputNote &&
          Math.abs(note.startTime - currentTime) <= this.hitWindow;
      })
      .map(note => ({
        noteId: this.getNoteId(note),
        note,
        timingDiff: note.startTime - currentTime
      }))
      .sort((a, b) => a.note.startTime - b.note.startTime);
  }

  /**
   * 現在のループのスコアを累積に追加（ループ終了時に呼び出し）
   */
  public finalizeCurrentLoop(): void {
    // 現在のセッションのスコアを累積に追加
    const currentCorrect = Array.from(this.hitNotes.values())
      .filter(sessionId => sessionId === this.currentPlaySessionId).length;
    const currentTotal = Array.from(this.activeNotes.values())
      .filter(sessionId => sessionId === this.currentPlaySessionId).length;

    this.totalCorrectCount += currentCorrect;
    this.totalNoteCount += currentTotal;

    // 新しいプレイセッションを開始
    this.startNewPlaySession();
  }

  /**
   * 新しいプレイセッションを開始（シークや部分リピート時に使用）
   */
  public startNewPlaySession(): void {
    this.currentPlaySessionId++;
    // 古いセッションのデータは保持（履歴として残す）
  }

  /**
   * スコア評価を完全リセット（新しいゲーム開始時）
   */
  public reset(): void {
    this.hitNotes.clear();
    this.activeNotes.clear();
    this.currentPlaySessionId = 0;

    // 累積スコアもリセット
    this.totalCorrectCount = 0;
    this.totalNoteCount = 0;
  }

  /**
   * デバッグ情報を出力
   */
  public debugInfo(): void {
    const score = this.getScore();
    const currentCorrect = Array.from(this.hitNotes.values())
      .filter(sessionId => sessionId === this.currentPlaySessionId).length;
    const currentTotal = Array.from(this.activeNotes.values())
      .filter(sessionId => sessionId === this.currentPlaySessionId).length;

    console.log('=== ScoreEvaluator Debug Info ===');
    console.log(`Current session ID: ${this.currentPlaySessionId}`);
    console.log(`Current session - Hit notes: ${currentCorrect}`);
    console.log(`Current session - Active notes: ${currentTotal}`);
    console.log(`Total accumulated score: ${score.correct}/${score.total} (${(score.accuracy * 100).toFixed(1)}%)`);
    console.log(`Accumulated from previous sessions: ${this.totalCorrectCount}/${this.totalNoteCount}`);
    console.log(`Total tracked notes: ${this.hitNotes.size} hit, ${this.activeNotes.size} active`);
  }
}