"""
03_scrape_biznav.py
国土交通省 建設業者・宅建業者等企業情報検索システム（BizNav）から
解体工事業の建設業許可業者リストをスクレイピングするスクリプト。

対象URL: https://etsuran.mlit.go.jp/TAKKEN/kensetu.do
業種コード: 解体工事業 = 28

スクレイピング前に robots.txt を確認済み。
"""

import os
import csv
import time
import requests
from bs4 import BeautifulSoup

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "processed")
OUT_FILE = os.path.join(OUT_DIR, "kaitai_from_biznav.csv")

BASE_URL = "https://etsuran.mlit.go.jp/TAKKEN"
SEARCH_URL = f"{BASE_URL}/kensetsu.do"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": SEARCH_URL,
}

# 都道府県コード（BizNav の selectbox value に対応）
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

# BizNav の解体工事業コード
KAITAI_CODE = "28"

OUTPUT_COLUMNS = [
    "name",
    "permit_number",
    "permit_type",
    "prefecture_name",
    "address",
    "source",
]

SLEEP_SEC = 1.5  # サーバー負荷軽減


def check_robots(base_url: str) -> bool:
    """robots.txt を確認して scraping が許可されているか確認"""
    robots_url = f"{base_url}/robots.txt"
    try:
        resp = requests.get(robots_url, headers=HEADERS, timeout=10)
        if resp.status_code == 404:
            print(f"[INFO] robots.txt not found (404) → scraping allowed")
            return True
        print(f"[INFO] robots.txt:\n{resp.text[:500]}")
        # Disallow: / が含まれる場合は中断
        if "Disallow: /" in resp.text and "User-agent: *" in resp.text:
            return False
        return True
    except Exception as e:
        print(f"[WARN] robots.txt check failed: {e}")
        return True


def get_initial_form_data(session: requests.Session) -> dict:
    """検索フォームの初期値（セッショントークン等）を取得"""
    resp = session.get(SEARCH_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    form_data = {}
    for inp in soup.find_all("input"):
        name = inp.get("name")
        value = inp.get("value", "")
        if name:
            form_data[name] = value
    return form_data


def search_by_prefecture(session: requests.Session, pref_code: str, pref_name: str, writer: csv.DictWriter) -> int:
    """指定都道府県の解体工事業許可業者を検索してページ送りで全件取得"""
    count = 0
    page = 1

    while True:
        post_data = {
            "gyosyu": KAITAI_CODE,          # 解体工事業
            "todoufuken": pref_code,
            "shikuchoson": "",
            "kaisha_name": "",
            "daijin": "",
            "chiji": pref_code,
            "page": str(page),
            "pageSize": "100",
        }

        try:
            resp = session.post(SEARCH_URL, data=post_data, headers=HEADERS, timeout=30)
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"  [ERROR] page={page} {e}")
            break

        soup = BeautifulSoup(resp.text, "html.parser")
        rows = parse_result_rows(soup, pref_name)

        if not rows:
            break

        for row in rows:
            writer.writerow(row)
        count += len(rows)

        # 次ページがあるか確認
        if not has_next_page(soup):
            break

        page += 1
        time.sleep(SLEEP_SEC)

    return count


def parse_result_rows(soup: BeautifulSoup, pref_name: str) -> list[dict]:
    """検索結果テーブルから企業データを抽出"""
    rows = []
    # BizNav の結果テーブルを探す（実際のHTML構造に依存）
    tables = soup.find_all("table")
    for table in tables:
        trs = table.find_all("tr")
        for tr in trs[1:]:  # ヘッダー行をスキップ
            tds = tr.find_all("td")
            if len(tds) < 3:
                continue
            texts = [td.get_text(strip=True) for td in tds]
            # 典型的な列: 許可番号 | 商号名 | 所在地 | ...
            rows.append({
                "name": texts[1] if len(texts) > 1 else "",
                "permit_number": texts[0] if texts else "",
                "permit_type": "",
                "prefecture_name": pref_name,
                "address": texts[2] if len(texts) > 2 else "",
                "source": "biznav",
            })
    return rows


def has_next_page(soup: BeautifulSoup) -> bool:
    """「次へ」リンクまたはページネーションを確認"""
    # 「次へ」や「次ページ」のリンクを探す
    for a_tag in soup.find_all("a"):
        text = a_tag.get_text(strip=True)
        if "次" in text or "next" in text.lower():
            return True
    return False


def main() -> None:
    # robots.txt 確認
    if not check_robots(BASE_URL):
        print("[STOP] robots.txt により scraping が禁止されています。")
        return

    os.makedirs(OUT_DIR, exist_ok=True)

    with requests.Session() as session, \
         open(OUT_FILE, "w", newline="", encoding="utf-8-sig") as out_f:

        writer = csv.DictWriter(out_f, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()

        total = 0
        for pref_code, pref_name in PREFECTURES.items():
            print(f"Scraping [{pref_code}] {pref_name} ...", end=" ")
            count = search_by_prefecture(session, pref_code, pref_name, writer)
            print(f"{count} 件")
            total += count
            time.sleep(SLEEP_SEC)

    print(f"\nBizNav から解体工事業許可業者 {total:,} 件 → {OUT_FILE}")


if __name__ == "__main__":
    main()
