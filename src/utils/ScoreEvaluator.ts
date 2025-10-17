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
  private currentSessionStartTime: number | undefined = undefined; // 現在のセッションの開始時刻 (msec)
  private hitNotes = new Map<string, Set<number>>();    // noteId -> Set<sessionId>
  private activeNotes = new Map<string, Set<number>>(); // noteId -> Set<sessionId>
  private readonly hitWindow = 200; // ±200msec

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
        const sessions = this.hitNotes.get(noteId);
        const isAlreadyHit = sessions?.has(this.currentPlaySessionId) ?? false;
        return !isAlreadyHit &&
          note.pitch === inputNote &&
          Math.abs(note.startTime - currentTime) <= this.hitWindow;
      })
      .sort((a, b) => a.note.startTime - b.note.startTime); // startTimeの早い順

    if (candidates.length > 0) {
      const { note, index } = candidates[0]!;
      const noteId = this.getNoteId(note);

      // セッションIDをSetに追加
      if (!this.hitNotes.has(noteId)) {
        this.hitNotes.set(noteId, new Set());
      }
      this.hitNotes.get(noteId)!.add(this.currentPlaySessionId);

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
      const sessions = this.activeNotes.get(noteId);
      const isAlreadyActive = sessions?.has(this.currentPlaySessionId) ?? false;

      // ノートの開始タイミングに到達したらアクティブに追加
      // ただし、セッション開始時刻より前のノートは除外（シーク対応）
      if (currentTime >= note.startTime && !isAlreadyActive) {
        // セッション開始時刻が記録されている場合、それより前のノートはスキップ
        if (this.currentSessionStartTime !== undefined && note.startTime < this.currentSessionStartTime) {
          return;
        }

        if (!this.activeNotes.has(noteId)) {
          this.activeNotes.set(noteId, new Set());
        }
        this.activeNotes.get(noteId)!.add(this.currentPlaySessionId);
      }
    });
  }

  /**
   * 現在のスコアを取得（全セッション通しての累積）
   * @returns スコア情報
   */
  public getScore(): {
    correct: number;
    total: number;
    accuracy: number;
    hitIndices: number[];
    activeIndices: number[];
  } {
    // 各noteIdのSet内のセッション数を合計
    let totalCorrect = 0;
    for (const sessions of this.hitNotes.values()) {
      totalCorrect += sessions.size;
    }

    let totalNotes = 0;
    for (const sessions of this.activeNotes.values()) {
      totalNotes += sessions.size;
    }

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
      const activeSessions = this.activeNotes.get(noteId);
      const hitSessions = this.hitNotes.get(noteId);
      const isActive = activeSessions?.has(this.currentPlaySessionId) ?? false;
      const isHit = hitSessions?.has(this.currentPlaySessionId) ?? false;

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
        const sessions = this.hitNotes.get(noteId);
        const isAlreadyHit = sessions?.has(this.currentPlaySessionId) ?? false;
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
   * 新しいプレイセッションを開始（シークや部分リピート時に使用）
   * @param startTime セッションの開始時刻（ミリ秒）。省略時は制限なし
   */
  public startNewPlaySession(startTime?: number): void {
    this.currentPlaySessionId++;
    this.currentSessionStartTime = startTime; // undefined の場合は制限なし
    // 古いセッションのデータは保持（履歴として残す）
  }

  /**
   * スコア評価を完全リセット（新しいゲーム開始時）
   */
  public reset(): void {
    this.hitNotes.clear();
    this.activeNotes.clear();
    this.currentPlaySessionId = 0;
    this.currentSessionStartTime = undefined;
  }

  /**
   * デバッグ情報を出力
   */
  public debugInfo(): void {
    const score = this.getScore();
    let currentCorrect = 0;
    for (const sessions of this.hitNotes.values()) {
      if (sessions.has(this.currentPlaySessionId)) {
        currentCorrect++;
      }
    }
    let currentTotal = 0;
    for (const sessions of this.activeNotes.values()) {
      if (sessions.has(this.currentPlaySessionId)) {
        currentTotal++;
      }
    }

    console.log('=== ScoreEvaluator Debug Info ===');
    console.log(`Current session ID: ${this.currentPlaySessionId}`);
    console.log(`Current session - Hit notes: ${currentCorrect}`);
    console.log(`Current session - Active notes: ${currentTotal}`);
    console.log(`Total accumulated score: ${score.correct}/${score.total} (${(score.accuracy * 100).toFixed(1)}%)`);
    console.log(`Total tracked notes: ${this.hitNotes.size} unique notes hit, ${this.activeNotes.size} unique notes active`);
  }
}