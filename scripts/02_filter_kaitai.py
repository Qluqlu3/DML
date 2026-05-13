"""
02_filter_kaitai.py
法人番号 CSV から解体業関連企業を抽出して
data/processed/kaitai_from_houjin.csv に保存するスクリプト。

法人番号 CSV の列定義（Unicode版）:
  0: seq_no
  1: corporate_number   ← 法人番号
  2: kind               (01=国の機関, 02=地方公共団体, 03=設立登記法人, 04=その他)
  3: update_date
  4: change_date
  5: name               ← 法人名
  6: name_image_id
  7: furigana
  8: kind2
  9: prefecture_name    ← 都道府県名
 10: city_name          ← 市区町村
 11: street_number      ← 番地
 12: address_image_id
 13: prefecture_code    ← 都道府県コード
 14: city_code
 15: post_code          ← 郵便番号
 16: address_outside
 17: address_outside_image_id
 18: close_date         ← 閉鎖日（廃業等）
 19: close_cause
 ...
"""

import os
import glob
import csv

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "houjin_all")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "processed")
OUT_FILE = os.path.join(OUT_DIR, "kaitai_from_houjin.csv")

# 解体業に関連するキーワード（法人名に含まれるもの）
KAITAI_KEYWORDS = [
    "解体",
    "かいたい",
    "カイタイ",
]

# 廃業済み企業は除外（close_date が空のもの = 現在も存在）
EXCLUDE_CLOSED = True

OUTPUT_COLUMNS = [
    "corporate_number",
    "name",
    "furigana",
    "prefecture_name",
    "city_name",
    "street_number",
    "post_code",
    "source",
]


def is_kaitai(name: str) -> bool:
    return any(kw in name for kw in KAITAI_KEYWORDS)


def process_csv_file(csv_path: str, writer: csv.DictWriter, counter: list[int]) -> None:
    """1つの CSV ファイルを処理してフィルタリング結果を書き込む"""
    try:
        with open(csv_path, encoding="utf-8-sig", errors="replace") as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) < 16:
                    continue
                corporate_number = row[1].strip()
                name = row[5].strip()
                close_date = row[18].strip() if len(row) > 18 else ""
                prefecture_name = row[9].strip()
                city_name = row[10].strip()
                street_number = row[11].strip()
                furigana = row[7].strip()
                post_code = row[15].strip()

                # 廃業除外
                if EXCLUDE_CLOSED and close_date:
                    continue

                # 解体キーワードフィルタ
                if not is_kaitai(name):
                    continue

                writer.writerow({
                    "corporate_number": corporate_number,
                    "name": name,
                    "furigana": furigana,
                    "prefecture_name": prefecture_name,
                    "city_name": city_name,
                    "street_number": street_number,
                    "post_code": post_code,
                    "source": "houjin_bangou",
                })
                counter[0] += 1
    except Exception as e:
        print(f"  [WARN] Error processing {csv_path}: {e}")


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    # 解凍ディレクトリ内の CSV ファイルを検索
    csv_files = sorted(glob.glob(os.path.join(RAW_DIR, "**", "*.csv"), recursive=True))
    if not csv_files:
        raise FileNotFoundError(
            f"CSV ファイルが見つかりません: {RAW_DIR}\n"
            "先に 01_download_houjin.py を実行してください。"
        )
    print(f"Found {len(csv_files)} CSV file(s) to process")

    counter = [0]
    with open(OUT_FILE, "w", newline="", encoding="utf-8-sig") as out_f:
        writer = csv.DictWriter(out_f, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        for i, csv_path in enumerate(csv_files, 1):
            print(f"[{i}/{len(csv_files)}] Processing: {os.path.basename(csv_path)}")
            process_csv_file(csv_path, writer, counter)

    print(f"\n解体業関連企業 {counter[0]:,} 件 → {OUT_FILE}")


if __name__ == "__main__":
    main()
