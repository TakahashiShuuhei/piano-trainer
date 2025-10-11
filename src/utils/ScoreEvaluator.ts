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
  private hitNoteIndices = new Set<number>();      // 正解したノートのindex
  private activeNoteIndices = new Set<number>();   // 現在アクティブ（演奏対象）なノートのindex
  private readonly hitWindow = 100; // ±100msec

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
      const hitIndex = candidates[0].index;
      this.hitNoteIndices.add(hitIndex);
      console.log(`🎯 Hit! Note ${inputNote} at index ${hitIndex}, timing diff: ${Math.abs(notes[hitIndex].startTime - currentTime)}ms`);
      return { isHit: true, hitNoteIndex: hitIndex };
    }

    console.log(`❌ Miss: Note ${inputNote} at time ${currentTime}, no matching candidates`);
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
        console.log(`📝 Note ${note.pitch} (index ${index}) became active at time ${currentTime}`);
      }
    });
  }

  /**
   * 現在のスコアを取得
   * @returns スコア情報
   */
  public getScore(): { 
    correct: number; 
    total: number; 
    accuracy: number;
    hitIndices: number[];
    activeIndices: number[];
  } {
    const correct = this.hitNoteIndices.size;
    const total = this.activeNoteIndices.size;
    
    return {
      correct,
      total,
      accuracy: total > 0 ? correct / total : 1.0,
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
   * スコア評価をリセット（新しいセッション開始時）
   */
  public reset(): void {
    this.hitNoteIndices.clear();
    this.activeNoteIndices.clear();
    console.log('🔄 ScoreEvaluator reset');
  }

  /**
   * デバッグ情報を出力
   */
  public debugInfo(): void {
    const score = this.getScore();
    console.log('=== ScoreEvaluator Debug Info ===');
    console.log(`Hit notes: [${score.hitIndices.join(', ')}]`);
    console.log(`Active notes: [${score.activeIndices.join(', ')}]`);
    console.log(`Score: ${score.correct}/${score.total} (${(score.accuracy * 100).toFixed(1)}%)`);
  }
}