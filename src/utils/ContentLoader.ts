import { SongData, SongNote, SongMemo, MusicalNote } from '../types/index.js';

/**
 * 楽曲データの読み込みとバリデーションを行うクラス
 */
export class ContentLoader {
  
  /**
   * URLパラメータから楽曲データを読み込み
   */
  public async loadFromURL(): Promise<{ notes: MusicalNote[], memos: SongMemo[], referenceImageUrl?: string } | null> {
    const urlParams = new URLSearchParams(window.location.search);

    // 外部JSONファイルのURL指定
    const songUrl = urlParams.get('song');
    if (songUrl) {
      return await this.loadFromExternalURL(songUrl);
    }

    // Base64エンコードされたJSONデータ
    const dataParam = urlParams.get('data');
    if (dataParam) {
      return this.loadFromBase64(dataParam);
    }

    return null; // パラメータなし
  }

  /**
   * ローカルファイルから楽曲データを読み込み
   */
  public async loadFromFile(file: File): Promise<{ notes: MusicalNote[], memos: SongMemo[], referenceImageUrl?: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const jsonString = event.target?.result as string;
          const jsonData = JSON.parse(jsonString);
          const result = this.processSongData(jsonData);
          resolve({ notes: result.notes, memos: result.memos, referenceImageUrl: result.referenceImageUrl });
        } catch (error) {
          reject(new Error('ファイルの読み込みに失敗しました'));
        }
      };

      reader.onerror = () => {
        reject(new Error('ファイルの読み込みに失敗しました'));
      };

      reader.readAsText(file, 'utf-8');
    });
  }
  
  /**
   * 外部URLからJSONファイルを読み込み
   */
  private async loadFromExternalURL(url: string): Promise<{ notes: MusicalNote[], memos: SongMemo[], referenceImageUrl?: string }> {
    try {
      // CORSプロキシを使用する場合のオプション
      const corsProxyUrl = this.shouldUseCorsProxy(url) ? `https://cors-anywhere.herokuapp.com/${url}` : url;

      const response = await fetch(corsProxyUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const jsonData = await response.json();
      const result = this.processSongData(jsonData);
      return { notes: result.notes, memos: result.memos, referenceImageUrl: result.referenceImageUrl };

    } catch (error) {
      console.error('Failed to load song from URL:', error);
      throw new Error(`楽曲の読み込みに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * CORSプロキシが必要かどうかを判定
   */
  private shouldUseCorsProxy(url: string): boolean {
    // 同一オリジンまたは相対パスの場合はプロキシ不要
    const currentOrigin = window.location.origin;
    
    // GitHub Gist Raw URLはCORS対応済み
    if (url.includes('gist.githubusercontent.com')) {
      return false;
    }
    
    // GitHub Pages内のファイル
    if (url.includes('github.io') || url.includes('githubusercontent.com')) {
      return false;
    }
    
    return !url.startsWith(currentOrigin) && !url.startsWith('/') && !url.startsWith('./');
  }
  
  /**
   * Base64エンコードされたJSONデータを読み込み
   */
  private loadFromBase64(base64Data: string): { notes: MusicalNote[], memos: SongMemo[], referenceImageUrl?: string } {
    try {
      // UTF-8対応のBase64デコード
      const jsonString = this.decodeBase64UTF8(base64Data);
      const jsonData = JSON.parse(jsonString);
      const result = this.processSongData(jsonData);
      return { notes: result.notes, memos: result.memos, referenceImageUrl: result.referenceImageUrl };

    } catch (error) {
      console.error('Failed to decode base64 data:', error);
      throw new Error('Base64データの解析に失敗しました');
    }
  }

  /**
   * UTF-8対応のBase64デコード
   */
  private decodeBase64UTF8(base64: string): string {
    try {
      // 標準のatobを使用してバイナリ文字列を取得
      const binaryString = atob(base64);
      
      // バイナリ文字列をUint8Arrayに変換
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // UTF-8デコード
      return new TextDecoder('utf-8').decode(bytes);
    } catch (error) {
      // フォールバック：標準のatobを使用
      console.warn('UTF-8 decoding failed, falling back to standard atob:', error);
      return atob(base64);
    }
  }
  
  /**
   * SongDataをMusicalNoteに変換し、バリデーションを実行
   */
  private processSongData(data: any): { notes: MusicalNote[], memos: SongMemo[], referenceImageUrl?: string } {
    // バリデーション
    const songData = this.validateSongData(data);

    // 空のノート配列の場合は警告を出すが処理は続行
    if (songData.notes.length === 0) {
      console.warn('楽曲データにノートが含まれていません。空の楽曲として読み込みます。');
    }

    // SongNoteをMusicalNoteに変換
    const notes = this.convertToMusicalNotes(songData);

    // memosを取得（存在しない場合は空配列）
    const memos = songData.memos || [];

    // referenceImageUrlを取得（存在しない場合はundefined）
    const referenceImageUrl = songData.referenceImageUrl;

    return { notes, memos, referenceImageUrl };
  }
  
  /**
   * SongDataのバリデーション
   */
  private validateSongData(data: any): SongData {
    if (!data || typeof data !== 'object') {
      throw new Error('楽曲データが正しくありません');
    }
    
    // title の検証
    if (!data.title || typeof data.title !== 'string') {
      throw new Error('楽曲タイトルが必要です');
    }
    
    // bpm の検証（オプション）
    if (data.bpm !== undefined) {
      if (typeof data.bpm !== 'number' || data.bpm < 60 || data.bpm > 200) {
        throw new Error('BPMは60-200の範囲で指定してください');
      }
    }
    
    // notes の検証
    if (!Array.isArray(data.notes)) {
      throw new Error('notesは配列である必要があります');
    }
    
    // 各ノートの検証
    data.notes.forEach((note: any, index: number) => {
      this.validateSongNote(note, index);
    });

    // memos の検証（オプション）
    if (data.memos !== undefined) {
      if (!Array.isArray(data.memos)) {
        throw new Error('memosは配列である必要があります');
      }
      data.memos.forEach((memo: any, index: number) => {
        this.validateSongMemo(memo, index);
      });
    }

    return {
      title: data.title,
      bpm: data.bpm || 120, // デフォルト値
      notes: data.notes,
      memos: data.memos,
      referenceImageUrl: data.referenceImageUrl
    };
  }
  
  /**
   * SongNoteのバリデーション
   */
  private validateSongNote(note: any, index: number): void {
    const notePrefix = `ノート${index + 1}`;
    
    if (!note || typeof note !== 'object') {
      throw new Error(`${notePrefix}: ノートデータが正しくありません`);
    }
    
    // pitch の検証
    if (typeof note.pitch !== 'number' || note.pitch < 0 || note.pitch > 127) {
      throw new Error(`${notePrefix}: pitchは0-127の範囲で指定してください`);
    }
    
    // timing の検証
    if (!note.timing || typeof note.timing !== 'object') {
      throw new Error(`${notePrefix}: timingが必要です`);
    }
    
    // beat の検証
    if (typeof note.timing.beat !== 'number' || note.timing.beat < 0) {
      throw new Error(`${notePrefix}: beatは0以上の数値で指定してください`);
    }
    
    // duration の検証（オプション）
    if (note.timing.duration !== undefined) {
      if (typeof note.timing.duration !== 'number' || note.timing.duration <= 0) {
        throw new Error(`${notePrefix}: durationは0より大きい数値で指定してください`);
      }
    }
    
    // velocity の検証（オプション）
    if (note.velocity !== undefined) {
      if (typeof note.velocity !== 'number' || note.velocity < 0 || note.velocity > 127) {
        throw new Error(`${notePrefix}: velocityは0-127の範囲で指定してください`);
      }
    }
  }
  
  /**
   * SongMemoのバリデーション
   */
  private validateSongMemo(memo: any, index: number): void {
    const memoPrefix = `メモ${index + 1}`;

    if (!memo || typeof memo !== 'object') {
      throw new Error(`${memoPrefix}: メモデータが正しくありません`);
    }

    // timing の検証
    if (!memo.timing || typeof memo.timing !== 'object') {
      throw new Error(`${memoPrefix}: timingが必要です`);
    }

    // beat の検証
    if (typeof memo.timing.beat !== 'number' || memo.timing.beat < 0) {
      throw new Error(`${memoPrefix}: beatは0以上の数値で指定してください`);
    }

    // text の検証
    if (typeof memo.text !== 'string') {
      throw new Error(`${memoPrefix}: textは文字列で指定してください`);
    }

    // align の検証（オプション）
    if (memo.align !== undefined) {
      if (!['left', 'center', 'right'].includes(memo.align)) {
        throw new Error(`${memoPrefix}: alignは'left'、'center'、'right'のいずれかで指定してください`);
      }
    }
  }

  /**
   * SongDataをMusicalNoteに変換
   */
  private convertToMusicalNotes(songData: SongData): MusicalNote[] {
    return songData.notes.map((songNote: SongNote): MusicalNote => ({
      pitch: songNote.pitch,
      timing: {
        beat: songNote.timing.beat,
        duration: songNote.timing.duration || 1 // デフォルト値
      },
      velocity: songNote.velocity || 80 // デフォルト値
    }));
  }
  
  /**
   * 楽曲データのタイトルを取得
   */
  public async getSongTitle(): Promise<string | null> {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      
      // 外部JSONファイルのURL指定
      const songUrl = urlParams.get('song');
      if (songUrl) {
        const response = await fetch(songUrl);
        const jsonData = await response.json();
        return jsonData.title || null;
      }
      
      // Base64エンコードされたJSONデータ
      const dataParam = urlParams.get('data');
      if (dataParam) {
        const jsonString = this.decodeBase64UTF8(dataParam);
        const jsonData = JSON.parse(jsonString);
        return jsonData.title || null;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get song title:', error);
      return null;
    }
  }
  
  /**
   * 楽曲データのBPMを取得
   */
  public async getSongBPM(): Promise<number | null> {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      
      // 外部JSONファイルのURL指定
      const songUrl = urlParams.get('song');
      if (songUrl) {
        const response = await fetch(songUrl);
        const jsonData = await response.json();
        return jsonData.bpm || 120;
      }
      
      // Base64エンコードされたJSONデータ
      const dataParam = urlParams.get('data');
      if (dataParam) {
        const jsonString = this.decodeBase64UTF8(dataParam);
        const jsonData = JSON.parse(jsonString);
        return jsonData.bpm || 120;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get song BPM:', error);
      return null;
    }
  }
}