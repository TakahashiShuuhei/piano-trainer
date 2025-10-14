#!/usr/bin/env python3
"""
JSON楽曲データ編集ユーティリティ

json-spec.md形式のJSONファイルを編集するツール
- 小節範囲の抽出
- 音高による音符のフィルタリング（右手/左手練習用）
"""

import json
import sys
import argparse
from typing import Dict, List, Optional
from copy import deepcopy


class SongEditor:
    """楽曲データを編集するクラス"""

    def __init__(self, song_data: Dict):
        """
        Args:
            song_data: json-spec.md形式の楽曲データ
        """
        self.song_data = deepcopy(song_data)
        self.title = song_data.get("title", "Untitled")
        self.bpm = song_data.get("bpm", 120)
        self.notes = song_data.get("notes", [])

    def extract_measures(self, start_measure: int, end_measure: int, beats_per_measure: int = 4) -> Dict:
        """
        指定した小節範囲を抽出

        Args:
            start_measure: 開始小節番号（1から開始）
            end_measure: 終了小節番号（1から開始、この小節を含む）
            beats_per_measure: 1小節の拍数（デフォルト: 4）

        Returns:
            抽出された楽曲データ
        """
        # 小節番号をbeat位置に変換（1始まりを0始まりに変換）
        start_beat = (start_measure - 1) * beats_per_measure
        end_beat = end_measure * beats_per_measure

        # 範囲内の音符を抽出
        extracted_notes = []
        for note in self.notes:
            note_beat = note["timing"]["beat"]
            if start_beat <= note_beat < end_beat:
                # 新しい音符を作成（beat位置を調整）
                new_note = deepcopy(note)
                new_note["timing"]["beat"] = note_beat - start_beat
                extracted_notes.append(new_note)

        # 結果を作成
        result = {
            "title": f"{self.title} (小節 {start_measure}-{end_measure})",
            "bpm": self.bpm,
            "notes": extracted_notes
        }

        return result

    def filter_by_pitch(self, min_pitch: Optional[int] = None, max_pitch: Optional[int] = None) -> Dict:
        """
        指定した音高範囲の音符のみを抽出

        Args:
            min_pitch: 最小MIDI音高（この値を含む、Noneの場合は下限なし）
            max_pitch: 最大MIDI音高（この値を含む、Noneの場合は上限なし）

        Returns:
            フィルタリングされた楽曲データ
        """
        filtered_notes = []

        for note in self.notes:
            pitch = note["pitch"]

            # 音高範囲チェック
            if min_pitch is not None and pitch < min_pitch:
                continue
            if max_pitch is not None and pitch > max_pitch:
                continue

            filtered_notes.append(deepcopy(note))

        # タイトルを更新
        title_suffix = []
        if min_pitch is not None:
            title_suffix.append(f"≥{min_pitch}")
        if max_pitch is not None:
            title_suffix.append(f"≤{max_pitch}")

        title = f"{self.title} ({', '.join(title_suffix)})" if title_suffix else self.title

        result = {
            "title": title,
            "bpm": self.bpm,
            "notes": filtered_notes
        }

        return result

    def filter_right_hand(self, threshold: int = 60) -> Dict:
        """
        右手パート（高音部）のみを抽出

        Args:
            threshold: 右手とみなすMIDI音高の閾値（デフォルト: 60 = C4）

        Returns:
            右手パートの楽曲データ
        """
        result = self.filter_by_pitch(min_pitch=threshold)
        result["title"] = f"{self.title} (右手)"
        return result

    def filter_left_hand(self, threshold: int = 60) -> Dict:
        """
        左手パート（低音部）のみを抽出

        Args:
            threshold: 左手とみなすMIDI音高の閾値（デフォルト: 60 = C4）

        Returns:
            左手パートの楽曲データ
        """
        result = self.filter_by_pitch(max_pitch=threshold - 1)
        result["title"] = f"{self.title} (左手)"
        return result


def load_json(file_path: str) -> Dict:
    """JSONファイルを読み込む"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(data: Dict, file_path: str):
    """JSONファイルに保存"""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser(
        description='JSON楽曲データ編集ユーティリティ',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  # 3-8小節を抽出
  python edit_json.py input.json -o output.json --measures 3 8

  # 3-8小節を抽出（1小節=3拍）
  python edit_json.py input.json -o output.json --measures 3 8 --beats 3

  # 右手パートのみ抽出（C4=60以上）
  python edit_json.py input.json -o output.json --right-hand

  # 左手パートのみ抽出（C4=60未満）
  python edit_json.py input.json -o output.json --left-hand

  # 左手パートのみ抽出（カスタム閾値: A3=57未満）
  python edit_json.py input.json -o output.json --left-hand --threshold 57

  # 音高範囲で抽出（C3=48からC5=72まで）
  python edit_json.py input.json -o output.json --min-pitch 48 --max-pitch 72

  # 組み合わせ: 3-8小節の右手パートのみ
  python edit_json.py input.json -o output.json --measures 3 8 --right-hand
        """
    )

    parser.add_argument('input', help='入力JSONファイル')
    parser.add_argument('-o', '--output', required=True, help='出力JSONファイル')

    # 小節抽出オプション
    measure_group = parser.add_argument_group('小節抽出')
    measure_group.add_argument('--measures', nargs=2, type=int, metavar=('START', 'END'),
                               help='抽出する小節範囲（開始 終了）。小節番号は1から開始')
    measure_group.add_argument('--beats', type=int, default=4,
                               help='1小節の拍数（デフォルト: 4）')

    # 音高フィルタリングオプション
    pitch_group = parser.add_argument_group('音高フィルタリング')
    pitch_group.add_argument('--right-hand', action='store_true',
                            help='右手パート（高音部）のみ抽出')
    pitch_group.add_argument('--left-hand', action='store_true',
                            help='左手パート（低音部）のみ抽出')
    pitch_group.add_argument('--threshold', type=int, default=60,
                            help='右手/左手の閾値となるMIDI音高（デフォルト: 60 = C4）')
    pitch_group.add_argument('--min-pitch', type=int,
                            help='最小MIDI音高（この値を含む）')
    pitch_group.add_argument('--max-pitch', type=int,
                            help='最大MIDI音高（この値を含む）')

    args = parser.parse_args()

    # 矛盾するオプションのチェック
    if args.right_hand and args.left_hand:
        print("エラー: --right-hand と --left-hand は同時に指定できません", file=sys.stderr)
        sys.exit(1)

    if (args.right_hand or args.left_hand) and (args.min_pitch or args.max_pitch):
        print("エラー: --right-hand/--left-hand と --min-pitch/--max-pitch は同時に指定できません", file=sys.stderr)
        sys.exit(1)

    try:
        # JSONファイルを読み込み
        print(f"読み込み中: {args.input}")
        song_data = load_json(args.input)

        # エディタを作成
        editor = SongEditor(song_data)
        result = song_data

        # 小節抽出
        if args.measures:
            start, end = args.measures
            print(f"小節 {start}-{end} を抽出中（{args.beats}拍/小節）...")
            result = editor.extract_measures(start, end, args.beats)
            editor = SongEditor(result)  # 結果を新しいエディタに

        # 音高フィルタリング
        if args.right_hand:
            print(f"右手パート抽出中（≥{args.threshold}）...")
            result = editor.filter_right_hand(args.threshold)
        elif args.left_hand:
            print(f"左手パート抽出中（<{args.threshold}）...")
            result = editor.filter_left_hand(args.threshold)
        elif args.min_pitch is not None or args.max_pitch is not None:
            print(f"音高フィルタリング中...")
            result = editor.filter_by_pitch(args.min_pitch, args.max_pitch)

        # 結果を保存
        save_json(result, args.output)

        # 統計情報を表示
        original_count = len(song_data.get("notes", []))
        result_count = len(result.get("notes", []))
        print(f"\n✓ 完了: {args.output}")
        print(f"  タイトル: {result['title']}")
        print(f"  音符数: {original_count} → {result_count}")

    except FileNotFoundError:
        print(f"エラー: ファイルが見つかりません: {args.input}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"エラー: JSONパースエラー: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"エラー: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
