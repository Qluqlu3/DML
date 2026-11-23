"""
scripts/05_fetch_permit_type.py

BizNav（建設業者・宅建業者等企業情報検索システム）から
解体工事業許可業者の許可情報を取得し、data/processed/kaitai_companies.json に
付与して上書きするスクリプト。

取得項目:
  - permit_type            許可種別（一般建設業 / 特定建設業）
  - permit_number          許可番号（許可行政庁を含むフルテキスト）
  - representative_name    代表者名
  - office_address         主たる営業所の所在地（許可情報側。号室等の詳細を含む場合あり）
  - capital_thousand_yen   資本金額（単位: 千円）
  - licensed_trades        保有する建設業許可の一覧 [{trade, level}]
  - license_valid_from / license_valid_until  許可の有効期間

戦略:
  1. 都道府県ごとに一般建設業(gyosyuType=1)と特定建設業(gyosyuType=2)の両方を
     解体工事業(gyosyu=29)で検索し、会社名・許可番号・代表者名・所在地・
     詳細ページ用ライセンスコードを取得（一覧ページの時点で拾えるものはここで拾う）
  2. 会社名で既存データとマッチング（マッチしない会社は 一般建設業 のまま・新規項目は空）
  3. マッチした会社について、詳細ページ(ksGaiyo.do)を1件ずつ追加取得し、
     資本金・業種一覧・有効期間を取得

実行:
  python3 scripts/05_fetch_permit_type.py
"""

from __future__ import annotations

import json
import os
import re
import time

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://etsuran2.mlit.go.jp/TAKKEN"
SEARCH_URL = f"{BASE_URL}/kensetuKensaku.do"
DETAIL_URL = f"{BASE_URL}/ksGaiyo.do"

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

# gyosyuType=1(一般建設業) の検索結果には該当会社が一般建設業として現れ、
# gyosyuType=2(特定建設業) の検索結果には特定建設業として現れる。
GYOSYU_TYPE_LABELS = {"1": "一般建設業", "2": "特定建設業"}

# 業種一覧グリッドの列見出し（許可を受けた建設業の種類、29業種）
LEVEL_LABELS = {"1": "一般建設業", "2": "特定建設業"}


def normalize(name: str) -> str:
    """会社名の表記ゆれを吸収"""
    name = name.strip()
    name = re.sub(r"[\s　]", "", name)  # 空白除去
    name = name.replace("（株）", "株式会社").replace("(株)", "株式会社")
    name = name.replace("（有）", "有限会社").replace("(有)", "有限会社")
    name = name.replace("（合）", "合同会社").replace("(合)", "合同会社")
    return name


def fetch_list_by_type(session: requests.Session, pref_code: str, gyosyu_type: str) -> list[dict]:
    """指定都道府県・許可種別の解体工事業許可業者一覧を取得"""
    post = {
        "CMD": "search",
        "rdoSelect": "1",
        "rdoSelectJoken": "1",
        "kenCode": pref_code,
        "gyosyu": KAITAI_CODE,
        "gyosyuType": gyosyu_type,
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
        print(f"    [ERROR list] {e}")
        return [], None

    soup = BeautifulSoup(r.content, "html.parser")
    table = soup.find("table")
    if not table:
        return [], None

    # 詳細ページ(ksGaiyo.do)は、この検索結果ページのフォーム状態（resultCount等の
    # サーバー側で検証される値を含む）をそのまま使い、sv_licenseNoだけ差し替えて
    # 送信する必要がある。ここでhiddenフィールド一式をテンプレートとして保持しておく。
    form = soup.find("form")
    hidden_template = None
    if form:
        hidden_template = {
            inp.get("name"): (inp.get("value") or "")
            for inp in form.find_all("input", {"type": "hidden"})
            if inp.get("name")
        }

    results = []
    for row in table.find_all("tr")[1:]:
        tds = row.find_all("td")
        if len(tds) < 7:
            continue

        license_code = None
        a_tag = tds[3].find("a")
        if a_tag and a_tag.has_attr("onclick"):
            m = re.search(r"js_ShowDetail\('(\d+)'\)", a_tag["onclick"])
            if m:
                license_code = m.group(1)

        results.append({
            "name": tds[3].get_text(strip=True),
            "permit_number": tds[2].get_text(strip=True),
            "representative_name": tds[4].get_text(strip=True),
            "office_address": tds[6].get_text(strip=True),
            "license_code": license_code,
            "permit_type": GYOSYU_TYPE_LABELS.get(gyosyu_type, ""),
        })
    return results, hidden_template


def _field_value(table, label: str):
    """table内で <th>label</th><td>...</td> の td を返す"""
    for tr in table.find_all("tr"):
        th = tr.find("th")
        if th and label in th.get_text(strip=True):
            return tr.find("td")
    return None


def _parse_era_date(text: str) -> str | None:
    """'R08年05月30日' 形式の日付をISO形式 'YYYY-MM-DD' に変換（令和のみ対応）"""
    m = re.match(r"R(\d+)年(\d+)月(\d+)日", text)
    if not m:
        return None
    reiwa_year, month, day = map(int, m.groups())
    year = 2018 + reiwa_year  # 令和1年 = 2019年
    return f"{year:04d}-{month:02d}-{day:02d}"


def fetch_detail(session: requests.Session, hidden_template: dict, license_code: str) -> dict:
    """詳細ページ(ksGaiyo.do)から資本金・業種一覧・有効期間を取得

    hidden_template には fetch_list_by_type() が返す、実際の検索結果ページの
    hiddenフィールド一式（resultCount等サーバー側で検証される値を含む）を渡す。
    ゼロから値を組み立てると400エラーになるため、必ず実際のレスポンスから
    取得したテンプレートを使い回すこと。
    """
    hidden = {**hidden_template, "sv_licenseNo": license_code}
    try:
        r = session.post(DETAIL_URL, data=hidden, headers=HEADERS, timeout=30)
        r.raise_for_status()
    except requests.RequestException as e:
        print(f"      [ERROR detail] {e}")
        return {}

    soup = BeautifulSoup(r.content, "html.parser")
    tables = soup.find_all("table")
    if len(tables) < 6:
        return {}

    result: dict = {}

    # 資本金額
    capital_td = _field_value(tables[1], "資本金額")
    if capital_td:
        digits = re.sub(r"[^\d]", "", capital_td.get_text())
        if digits:
            result["capital_thousand_yen"] = int(digits)

    # 業種一覧（許可を受けた建設業の種類）
    # 一部の会社では値の行が見出し行より1セル少なく描画される既知の癖があるため、
    # 右詰め（末尾＝解体工事業から遡る）で対応させる。ずれが1を超える場合は不採用。
    trade_table = tables[2]
    trs = trade_table.find_all("tr")
    if len(trs) >= 2:
        headers = [c.get_text(strip=True) for c in trs[0].find_all(["td", "th"])][1:]
        values = [c.get_text(strip=True) for c in trs[1].find_all(["td", "th"])][1:]
        offset = len(headers) - len(values)
        if 0 <= offset <= 1:
            licensed = []
            for i, trade in enumerate(headers):
                v_idx = i - offset
                if v_idx < 0:
                    continue
                level = values[v_idx]
                if level in LEVEL_LABELS:
                    licensed.append({"trade": trade, "level": LEVEL_LABELS[level]})
            if licensed:
                result["licensed_trades"] = licensed

    # 許可の有効期間
    validity_td = _field_value(tables[5], "許可の有効期間")
    if validity_td:
        text = validity_td.get_text(strip=True)
        m = re.match(r"(R\d+年\d+月\d+日)から(R\d+年\d+月\d+日)まで", text)
        if m:
            valid_from = _parse_era_date(m.group(1))
            valid_until = _parse_era_date(m.group(2))
            if valid_from:
                result["license_valid_from"] = valid_from
            if valid_until:
                result["license_valid_until"] = valid_until

    return result


def main() -> None:
    with open(DATA_FILE, encoding="utf-8") as f:
        companies = json.load(f)

    print(f"既存データ: {len(companies)} 件")

    pref_to_companies: dict[str, list[dict]] = {}
    for c in companies:
        pref = c.get("prefecture_name", "") or ""
        pref_to_companies.setdefault(pref, []).append(c)

    for c in companies:
        c["permit_type"] = "一般建設業"

    match_count = 0
    detail_count = 0

    # 詳細ページ(ksGaiyo.do)はhiddenフィールド一式（resultCount等サーバー側で
    # 検証される値を含む）を検索結果ページと同じセッションで使い回す必要があるため、
    # 都道府県ごとに「一覧取得→即詳細取得」を同一セッション内で行う。
    with requests.Session() as session:
        session.get(f"{BASE_URL}/kensetuKensaku.do?outPutKbn=1", headers=HEADERS, timeout=15)

        for pref_code, pref_name in PREFECTURES.items():
            targets = pref_to_companies.get(pref_name, [])
            if not targets:
                continue

            print(f"[{pref_code}] {pref_name} ({len(targets)}社) ...", flush=True)

            by_name: dict[str, dict] = {}
            hidden_template = None
            for gyosyu_type in ("1", "2"):
                rows, template = fetch_list_by_type(session, pref_code, gyosyu_type)
                hidden_template = template or hidden_template
                for row in rows:
                    by_name[normalize(row["name"])] = row
                time.sleep(SLEEP_SEC)

            pref_match = 0
            for c in targets:
                row = by_name.get(normalize(c.get("name", "")))
                if not row:
                    continue
                c["permit_type"] = row["permit_type"]
                c["permit_number"] = row["permit_number"]
                c["representative_name"] = row["representative_name"]
                c["office_address"] = row["office_address"]
                pref_match += 1
                match_count += 1

                if row["license_code"] and hidden_template:
                    detail = fetch_detail(session, hidden_template, row["license_code"])
                    if detail:
                        c.update(detail)
                        detail_count += 1
                    time.sleep(SLEEP_SEC)

            print(f"  許可情報マッチ {pref_match} 件（詳細取得 {detail_count} 件 累計）")

            # 都道府県ごとに保存（長時間実行の途中で中断しても進捗を失わないため）
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                json.dump(companies, f, ensure_ascii=False, indent=2)

    print(f"\n一覧ページでのマッチ: {match_count} / {len(companies)} 件")
    print(f"詳細ページ取得: {detail_count} 件")

    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(companies, f, ensure_ascii=False, indent=2)
    print(f"→ {DATA_FILE} を更新しました")


if __name__ == "__main__":
    main()
