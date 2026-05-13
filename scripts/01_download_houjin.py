"""
01_download_houjin.py
国税庁 法人番号公表サイトから全国CSV（Unicode）をダウンロードし
data/raw/ に保存するスクリプト。
"""

import os
import re
import zipfile
import requests
from bs4 import BeautifulSoup

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
DOWNLOAD_PAGE = "https://www.houjin-bangou.nta.go.jp/download/zenken/"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}


def find_national_csv_url(page_url: str) -> str | None:
    """ダウンロードページを解析して全国版 CSV(Unicode) の ZIP URL を返す"""
    resp = requests.get(page_url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    # CSV形式・Unicode セクション内の「全国」リンクを探す
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        text = a_tag.get_text(strip=True)
        # 全国 zip かつ csv_unicode パスを優先
        if re.search(r"csv_unicode.*all", href, re.IGNORECASE):
            return href if href.startswith("http") else f"https://www.houjin-bangou.nta.go.jp{href}"
        # フォールバック: zip ファイルで「全国」テキストが近くにある
        if "全国" in text and href.endswith(".zip"):
            return href if href.startswith("http") else f"https://www.houjin-bangou.nta.go.jp{href}"

    # 見つからなかった場合は全リンクを出力してデバッグ
    print("[DEBUG] Found zip links:")
    for a_tag in soup.find_all("a", href=True):
        if ".zip" in a_tag["href"]:
            print(f"  text={a_tag.get_text(strip=True)!r}  href={a_tag['href']}")
    return None


def download_file(url: str, dest_path: str) -> None:
    """ファイルをストリーミングダウンロード"""
    print(f"Downloading: {url}")
    with requests.get(url, headers=HEADERS, stream=True, timeout=120) as resp:
        resp.raise_for_status()
        total = int(resp.headers.get("Content-Length", 0))
        downloaded = 0
        with open(dest_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=1024 * 1024):
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded / total * 100
                    print(f"\r  {downloaded // (1024*1024)} MB / {total // (1024*1024)} MB ({pct:.1f}%)", end="", flush=True)
    print(f"\n  Saved: {dest_path}")


def extract_zip(zip_path: str, extract_dir: str) -> list[str]:
    """ZIP を解凍して展開されたファイルパスのリストを返す"""
    os.makedirs(extract_dir, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(extract_dir)
        names = zf.namelist()
    print(f"  Extracted: {names}")
    return [os.path.join(extract_dir, n) for n in names]


def main() -> None:
    os.makedirs(RAW_DIR, exist_ok=True)
    zip_path = os.path.join(RAW_DIR, "houjin_all.zip")

    # ① 既にダウンロード済みならスキップ
    if os.path.exists(zip_path):
        print(f"[SKIP] Already exists: {zip_path}")
    else:
        # ② ページから URL を取得
        url = find_national_csv_url(DOWNLOAD_PAGE)
        if url is None:
            raise RuntimeError("全国 CSV の URL が見つかりませんでした。ページ構造を確認してください。")
        print(f"Found URL: {url}")
        download_file(url, zip_path)

    # ③ 解凍
    extract_dir = os.path.join(RAW_DIR, "houjin_all")
    if os.path.isdir(extract_dir) and os.listdir(extract_dir):
        print(f"[SKIP] Already extracted: {extract_dir}")
    else:
        extract_zip(zip_path, extract_dir)

    print("Done.")


if __name__ == "__main__":
    main()
