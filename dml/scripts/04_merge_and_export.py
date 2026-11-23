"""
04_merge_and_export.py
複数ソースのデータを統合・重複排除して最終的な JSON/CSV を生成するスクリプト。

出力:
  data/processed/companies_final.csv
  data/processed/companies_final.json
  data/processed/summary.txt
"""

import os
import csv
import json
from collections import defaultdict

PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "processed")
HOUJIN_FILE = os.path.join(PROCESSED_DIR, "kaitai_from_houjin.csv")
BIZNAV_FILE = os.path.join(PROCESSED_DIR, "kaitai_from_biznav.csv")
OUT_CSV = os.path.join(PROCESSED_DIR, "companies_final.csv")
OUT_JSON = os.path.join(PROCESSED_DIR, "companies_final.json")
OUT_SUMMARY = os.path.join(PROCESSED_DIR, "summary.txt")

OUTPUT_COLUMNS = [
    "id",
    "corporate_number",
    "name",
    "furigana",
    "prefecture_name",
    "city_name",
    "street_number",
    "post_code",
    "permit_number",
    "permit_type",
    "address_full",
    "sources",
]


def normalize_name(name: str) -> str:
    """法人名の表記ゆれを吸収（スペース除去・全角統一）"""
    return (
        name.replace("　", "")
            .replace(" ", "")
            .replace("（株）", "株式会社")
            .replace("(株)", "株式会社")
            .replace("（有）", "有限会社")
            .replace("(有)", "有限会社")
            .strip()
    )


def load_houjin(filepath: str) -> dict[str, dict]:
    """法人番号データを読み込んで法人番号をキーにした辞書を返す"""
    companies: dict[str, dict] = {}
    if not os.path.exists(filepath):
        print(f"[SKIP] Not found: {filepath}")
        return companies

    with open(filepath, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            cn = row.get("corporate_number", "").strip()
            name = row.get("name", "").strip()
            if not name:
                continue

            key = cn if cn else f"name:{normalize_name(name)}"
            address_full = " ".join(filter(None, [
                row.get("prefecture_name", ""),
                row.get("city_name", ""),
                row.get("street_number", ""),
            ]))
            companies[key] = {
                "corporate_number": cn,
                "name": name,
                "furigana": row.get("furigana", ""),
                "prefecture_name": row.get("prefecture_name", ""),
                "city_name": row.get("city_name", ""),
                "street_number": row.get("street_number", ""),
                "post_code": row.get("post_code", ""),
                "permit_number": "",
                "permit_type": "",
                "address_full": address_full,
                "sources": ["houjin_bangou"],
            }
    print(f"Loaded {len(companies):,} companies from 法人番号データ")
    return companies


def merge_biznav(companies: dict[str, dict], filepath: str) -> None:
    """BizNav データをマージ（法人番号不明なので法人名マッチング）"""
    if not os.path.exists(filepath):
        print(f"[SKIP] Not found: {filepath}")
        return

    new_count = 0
    merge_count = 0

    with open(filepath, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            name = row.get("name", "").strip()
            if not name:
                continue
            norm_name = normalize_name(name)
            name_key = f"name:{norm_name}"

            if name_key in companies:
                # 既存エントリにマージ
                companies[name_key]["permit_number"] = row.get("permit_number", "")
                companies[name_key]["permit_type"] = row.get("permit_type", "")
                if "biznav" not in companies[name_key]["sources"]:
                    companies[name_key]["sources"].append("biznav")
                merge_count += 1
            else:
                # 新規追加
                companies[name_key] = {
                    "corporate_number": "",
                    "name": name,
                    "furigana": "",
                    "prefecture_name": row.get("prefecture_name", ""),
                    "city_name": "",
                    "street_number": "",
                    "post_code": "",
                    "permit_number": row.get("permit_number", ""),
                    "permit_type": row.get("permit_type", ""),
                    "address_full": row.get("address", ""),
                    "sources": ["biznav"],
                }
                new_count += 1

    print(f"BizNav: {merge_count:,} 件マージ / {new_count:,} 件新規追加")


def export(companies: dict[str, dict]) -> None:
    company_list = list(companies.values())

    # 都道府県順にソート
    company_list.sort(key=lambda c: (c.get("prefecture_name") or "", c.get("name") or ""))

    # ID 付与
    for i, company in enumerate(company_list, 1):
        company["id"] = i
        company["sources"] = ",".join(company.get("sources", []))

    # CSV 出力
    with open(OUT_CSV, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(company_list)
    print(f"CSV: {OUT_CSV}")

    # JSON 出力
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(company_list, f, ensure_ascii=False, indent=2)
    print(f"JSON: {OUT_JSON}")

    # サマリー
    pref_counter: dict[str, int] = defaultdict(int)
    for c in company_list:
        pref = c.get("prefecture_name") or "不明"
        pref_counter[pref] += 1

    summary_lines = [
        f"=== 解体業企業データ サマリー ===",
        f"総件数: {len(company_list):,} 件",
        "",
        "【都道府県別件数】",
    ]
    for pref, cnt in sorted(pref_counter.items()):
        summary_lines.append(f"  {pref}: {cnt:,} 件")

    summary_text = "\n".join(summary_lines)
    print("\n" + summary_text)
    with open(OUT_SUMMARY, "w", encoding="utf-8") as f:
        f.write(summary_text)


def main() -> None:
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    companies = load_houjin(HOUJIN_FILE)
    merge_biznav(companies, BIZNAV_FILE)
    export(companies)
    print(f"\nSummary saved: {OUT_SUMMARY}")


if __name__ == "__main__":
    main()
