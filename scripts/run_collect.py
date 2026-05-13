"""
run_collect.py
全国法人番号データをダウンロード→解体業フィルタリング→CSV/JSON出力する
ワンショット実行スクリプト。
"""

import os
import io
import csv
import json
import zipfile
import requests
import time
from bs4 import BeautifulSoup
from collections import defaultdict

# ========== 設定 ==========
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
RAW_DIR = os.path.join(DATA_DIR, "raw")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")
ZIP_PATH = os.path.join(RAW_DIR, "houjin_all_unicode.zip")
OUT_CSV = os.path.join(PROCESSED_DIR, "kaitai_companies.csv")
OUT_JSON = os.path.join(PROCESSED_DIR, "kaitai_companies.json")
OUT_SUMMARY = os.path.join(PROCESSED_DIR, "summary.txt")

BASE_URL = "https://www.houjin-bangou.nta.go.jp"
DOWNLOAD_PAGE = f"{BASE_URL}/download/zenken/"
# 全国 Unicode CSV の fileNo（ページの onclick から取得した値）
NATIONAL_UNICODE_FILE_NO = "26973"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}

# 解体業関連の法人名キーワード
KAITAI_KEYWORDS = ["解体", "かいたい", "カイタイ"]

# 法人番号 CSV の列インデックス（Unicode版）
COL_CORP_NUM = 1    # 法人番号
COL_NAME = 6        # 法人名（実際の列: 0=連番,1=法人番号,2=種別,3=最新フラグ,4=更新日,5=変更日,6=名称）
COL_FURIGANA = 7    # 名称イメージID（ふりがなは別途）
COL_PREF_NAME = 9   # 都道府県名
COL_CITY_NAME = 10  # 市区町村
COL_STREET = 11     # 番地
COL_POST_CODE = 15  # 郵便番号
COL_CLOSE_DATE = 18 # 閉鎖日（廃業等）

OUTPUT_COLUMNS = [
    "id", "corporate_number", "name", "furigana",
    "prefecture_name", "city_name", "street_number",
    "post_code", "address_full", "sources",
]


# ==========================
# Step 1: Download
# ==========================
def download_zip() -> None:
    os.makedirs(RAW_DIR, exist_ok=True)
    if os.path.exists(ZIP_PATH):
        print(f"[SKIP] Already downloaded: {ZIP_PATH}")
        return

    print("Step 1: Fetching CSRF token ...")
    session = requests.Session()
    resp = session.get(DOWNLOAD_PAGE, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    token_input = soup.find("input", {"name": lambda n: n and "token" in n})
    if not token_input:
        raise RuntimeError("CSRF token が見つかりません")
    token_name = token_input["name"]
    token_value = token_input["value"]

    print(f"Step 1: Downloading national Unicode CSV (file ID={NATIONAL_UNICODE_FILE_NO}) ...")
    post_data = {
        token_name: token_value,
        "event": "download",
        "selDlFileNo": NATIONAL_UNICODE_FILE_NO,
    }
    with session.post(
        f"{BASE_URL}/download/zenken/index.html",
        data=post_data,
        headers=HEADERS,
        stream=True,
        timeout=300,
    ) as r:
        r.raise_for_status()
        total = int(r.headers.get("Content-Length", 0))
        downloaded = 0
        start = time.time()
        with open(ZIP_PATH, "wb") as f:
            for chunk in r.iter_content(chunk_size=2 * 1024 * 1024):
                f.write(chunk)
                downloaded += len(chunk)
                elapsed = time.time() - start
                speed = downloaded / elapsed / 1024 / 1024 if elapsed > 0 else 0
                if total:
                    pct = downloaded / total * 100
                    print(
                        f"\r  {downloaded // (1024*1024)} MB / {total // (1024*1024)} MB "
                        f"({pct:.1f}%) @ {speed:.1f} MB/s",
                        end="",
                        flush=True,
                    )
                else:
                    print(f"\r  {downloaded // (1024*1024)} MB @ {speed:.1f} MB/s", end="", flush=True)
    print(f"\n  Saved: {ZIP_PATH} ({os.path.getsize(ZIP_PATH) // (1024*1024)} MB)")


# ==========================
# Step 2: Filter
# ==========================
def is_kaitai(name: str) -> bool:
    return any(kw in name for kw in KAITAI_KEYWORDS)


def normalize_address(*parts: str) -> str:
    return " ".join(p.strip() for p in parts if p.strip())


def filter_and_save() -> list[dict]:
    print("Step 2: Filtering for 解体業 companies ...")
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    companies = []
    total_rows = 0

    with zipfile.ZipFile(ZIP_PATH, "r") as zf:
        csv_names = [n for n in zf.namelist() if n.endswith(".csv")]
        if not csv_names:
            raise RuntimeError("ZIP 内に CSV が見つかりません")

        for csv_name in csv_names:
            print(f"  Processing: {csv_name}")
            with zf.open(csv_name) as raw_f:
                # ZIP内のCSVをストリームで読む（メモリ効率）
                text_f = io.TextIOWrapper(raw_f, encoding="utf-8-sig", errors="replace")
                reader = csv.reader(text_f)
                for row in reader:
                    total_rows += 1
                    if len(row) <= COL_CLOSE_DATE:
                        continue
                    close_date = row[COL_CLOSE_DATE].strip()
                    if close_date:  # 廃業済みは除外
                        continue
                    name = row[COL_NAME].strip()
                    if not is_kaitai(name):
                        continue

                    pref = row[COL_PREF_NAME].strip()
                    city = row[COL_CITY_NAME].strip()
                    street = row[COL_STREET].strip()
                    companies.append({
                        "corporate_number": row[COL_CORP_NUM].strip(),
                        "name": name,
                        "furigana": row[COL_FURIGANA].strip() if len(row) > COL_FURIGANA else "",
                        "prefecture_name": pref,
                        "city_name": city,
                        "street_number": street,
                        "post_code": row[COL_POST_CODE].strip() if len(row) > COL_POST_CODE else "",
                        "address_full": normalize_address(pref, city, street),
                        "sources": "houjin_bangou",
                    })

                    if len(companies) % 1000 == 0:
                        print(f"  ... {len(companies):,} matched / {total_rows:,} scanned", end="\r")

    print(f"\n  Total scanned: {total_rows:,} / Matched: {len(companies):,}")
    return companies


# ==========================
# Step 3: Export
# ==========================
def export(companies: list[dict]) -> None:
    # 都道府県・法人名順にソート
    companies.sort(key=lambda c: (c.get("prefecture_name") or "", c.get("name") or ""))

    # ID 付与
    for i, c in enumerate(companies, 1):
        c["id"] = i

    print(f"Step 3: Writing CSV → {OUT_CSV}")
    with open(OUT_CSV, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(companies)

    print(f"Step 3: Writing JSON → {OUT_JSON}")
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(companies, f, ensure_ascii=False, indent=2)

    # サマリー
    pref_counter: dict[str, int] = defaultdict(int)
    for c in companies:
        pref_counter[c.get("prefecture_name") or "不明"] += 1

    lines = [
        "=== 解体業企業データ サマリー ===",
        f"データ取得日: 令和8年4月30日時点（法人番号公表サイト）",
        f"総件数: {len(companies):,} 件",
        "",
        "【都道府県別件数】",
    ]
    for pref in sorted(pref_counter):
        lines.append(f"  {pref}: {pref_counter[pref]:,} 件")

    summary = "\n".join(lines)
    print("\n" + summary)
    with open(OUT_SUMMARY, "w", encoding="utf-8") as f:
        f.write(summary)
    print(f"\nSummary saved: {OUT_SUMMARY}")


# ==========================
# Main
# ==========================
def main() -> None:
    start = time.time()
    download_zip()
    companies = filter_and_save()
    export(companies)
    print(f"\n完了 ({time.time() - start:.1f}s)")


if __name__ == "__main__":
    main()
