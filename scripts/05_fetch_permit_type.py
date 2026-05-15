"""
scripts/05_fetch_permit_type.py

BizNav（建設業者・宅建業者等企業情報検索システム）から
解体工事業の許可種別（特定/一般建設業）を取得し、
data/processed/kaitai_companies.json に付与して上書きする。

戦略:
  1. 都道府県ごとに特定建設業（解体工事業）の全業者をBizNavから取得
  2. 既存データの会社名と部分一致マッチング
  3. マッチした業者 → 「特定建設業」
     マッチしなかった業者 → 「一般建設業」

実行:
  python3 scripts/05_fetch_permit_type.py
"""

import json
import os
import re
import time

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://etsuran2.mlit.go.jp/TAKKEN"
SEARCH_URL = f"{BASE_URL}/kensetuKensaku.do"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
}

DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "processed", "kaitai_companies.json")

SLEEP_SEC = 1.0

# 都道府県コード
PREFECTURES = {
    "01": "北海道", "02": "青森県", "03": "岩手県", "04": "宮城県",
    "05": "秋田県", "06": "山形県", "07": "福島県", "08": "茨城県",
    "09": "栃木県", "10": "群馬県", "11": "埼玉県", "12": "千葉県",
    "13": "東京都", "14": "神奈川県", "15": "新潟県", "16": "富山県",
    "17": "石川県", "18": "福井県", "19": "山梨県", "20": "長野県",
    "21": "岐阜県", "22": "静岡県", "23": "愛知県", "24": "三重県",
    "25": "滋賀県", "26": "京都府", "27": "大阪府", "28": "兵庫県",
    "29": "奈良県", "30": "和歌山県", "31": "鳥取県", "32": "島根県",
    "33": "岡山県", "34": "広島県", "35": "山口県", "36": "徳島県",
    "37": "香川県", "38": "愛媛県", "39": "高知県", "40": "福岡県",
    "41": "佐賀県", "42": "長崎県", "43": "熊本県", "44": "大分県",
    "45": "宮崎県", "46": "鹿児島県", "47": "沖縄県",
}

KAITAI_CODE = "29"  # 解体工事業（新システムでは29）


def normalize(name: str) -> str:
    """会社名の表記ゆれを吸収"""
    name = name.strip()
    name = re.sub(r"[\s\u3000]", "", name)          # 空白除去
    name = name.replace("（株）", "株式会社").replace("(株)", "株式会社")
    name = name.replace("（有）", "有限会社").replace("(有)", "有限会社")
    name = name.replace("（合）", "合同会社").replace("(合)", "合同会社")
    return name


def fetch_tokutei_by_pref(session: requests.Session, pref_code: str) -> list[str]:
    """指定都道府県の特定建設業（解体工事業）の業者名リストを取得"""
    post = {
        "CMD": "search",
        "rdoSelect": "1",
        "rdoSelectJoken": "1",
        "kenCode": pref_code,
        "gyosyu": KAITAI_CODE,
        "gyosyuType": "2",   # 特定建設業
        "choice": "1",
        "dispCount": "10000",
        "dispPage": "1",
        "sortValue": "1",
        "rdoSelectSort": "1",
    }
    try:
        r = session.post(SEARCH_URL, data=post, headers=HEADERS, timeout=30)
        r.raise_for_status()
    except requests.RequestException as e:
        print(f"  [ERROR] {e}")
        return []

    soup = BeautifulSoup(r.content, "html.parser")
    table = soup.find("table")
    if not table:
        return []

    names = []
    for row in table.find_all("tr")[1:]:
        tds = row.find_all("td")
        if len(tds) >= 4:
            raw_name = tds[3].get_text(strip=True)  # 商号又は名称
            names.append(normalize(raw_name))
    return names


def main() -> None:
    # 既存データ読み込み
    with open(DATA_FILE, encoding="utf-8") as f:
        companies = json.load(f)

    print(f"既存データ: {len(companies)} 件")

    # 都道府県別にグループ化（高速マッチング用）
    pref_to_companies: dict[str, list[dict]] = {}
    for c in companies:
        pref = c.get("prefecture_name", "") or ""
        if pref not in pref_to_companies:
            pref_to_companies[pref] = []
        pref_to_companies[pref].append(c)

    # permit_type を初期化（全社「一般建設業」に）
    for c in companies:
        c["permit_type"] = "一般建設業"

    tokutei_match_count = 0

    with requests.Session() as session:
        # 初期ページを取得してセッション確立
        session.get(f"{BASE_URL}/kensetuKensaku.do?outPutKbn=1", headers=HEADERS, timeout=15)

        for pref_code, pref_name in PREFECTURES.items():
            print(f"[{pref_code}] {pref_name} ...", end=" ", flush=True)
            tokutei_names = fetch_tokutei_by_pref(session, pref_code)
            tokutei_set = set(tokutei_names)
            print(f"特定 {len(tokutei_set)} 件")

            # 同じ都道府県の既存データとマッチング
            targets = pref_to_companies.get(pref_name, [])
            for c in targets:
                norm = normalize(c.get("name", ""))
                if norm in tokutei_set:
                    c["permit_type"] = "特定建設業"
                    tokutei_match_count += 1

            time.sleep(SLEEP_SEC)

    print(f"\n特定建設業マッチ: {tokutei_match_count} 件")
    print(f"一般建設業: {len(companies) - tokutei_match_count} 件")

    # 上書き保存
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(companies, f, ensure_ascii=False, indent=2)
    print(f"→ {DATA_FILE} を更新しました")


if __name__ == "__main__":
    main()
