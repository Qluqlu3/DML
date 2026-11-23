"""
scripts/fix_furigana.py
run_collect.py の COL_FURIGANA が誤った列（7=名称イメージID）を
参照していたバグを修正するための一回限りのパッチスクリプト。

data/raw/houjin_all_unicode.zip（既にダウンロード済み・追加通信なし）の
正しい列（28=フリガナ）を法人番号で突き合わせて、
data/processed/kaitai_companies.json の furigana のみを上書きする。
permit_type など他のフィールドには触れない。

実行:
  python3 scripts/fix_furigana.py
"""

import csv
import io
import json
import os
import zipfile

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
ZIP_PATH = os.path.join(DATA_DIR, "raw", "houjin_all_unicode.zip")
JSON_PATH = os.path.join(DATA_DIR, "processed", "kaitai_companies.json")

COL_CORP_NUM = 1
COL_FURIGANA = 28  # 正しい列（旧コードは誤って7=名称イメージIDを参照していた）


def load_furigana_map() -> dict[str, str]:
    furigana_by_corp_num: dict[str, str] = {}
    with zipfile.ZipFile(ZIP_PATH, "r") as zf:
        csv_names = [n for n in zf.namelist() if n.endswith(".csv")]
        for csv_name in csv_names:
            with zf.open(csv_name) as raw_f:
                text_f = io.TextIOWrapper(raw_f, encoding="utf-8-sig", errors="replace")
                for row in csv.reader(text_f):
                    if len(row) <= COL_FURIGANA:
                        continue
                    furigana = row[COL_FURIGANA].strip()
                    if furigana:
                        furigana_by_corp_num[row[COL_CORP_NUM].strip()] = furigana
    return furigana_by_corp_num


def main() -> None:
    print("Loading furigana map from raw CSV ...")
    furigana_map = load_furigana_map()
    print(f"  {len(furigana_map):,} corporate numbers have furigana")

    with open(JSON_PATH, encoding="utf-8") as f:
        companies = json.load(f)

    updated = 0
    for c in companies:
        cn = c.get("corporate_number", "")
        furigana = furigana_map.get(cn)
        if furigana and furigana != c.get("furigana"):
            c["furigana"] = furigana
            updated += 1

    print(f"Updated furigana for {updated:,} / {len(companies):,} companies")

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(companies, f, ensure_ascii=False, indent=2)
    print(f"Saved: {JSON_PATH}")


if __name__ == "__main__":
    main()
