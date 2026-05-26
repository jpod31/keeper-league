#!/usr/bin/env python3
"""End-to-end smoke test for keeperlg.com after a deploy.

Hits a list of critical anonymous + authenticated endpoints and prints
a pass/fail summary. Designed to be run from the dev machine after
`update_server.sh` returns, so we catch 500s the way a real browser
would — not just "did the service start".

Anonymous endpoints: must return the expected status code (200 or 302).
Authenticated endpoints: must NOT return 500. We auth via a session
cookie file (cookies.txt) if present, else just check for the redirect.

Usage:
  python scripts/smoke_endpoints.py [--host https://keeperlg.com]

Exit codes:
  0 — all checks passed
  1 — one or more failures (prints list)
"""

import argparse
import http.cookiejar
import sys
import urllib.request
import urllib.error
from typing import Optional

DEFAULT_HOST = "https://keeperlg.com"

# Endpoints to check. (path, expected_status_set, requires_auth)
# expected_status_set is the set of OK status codes. 5xx is always a fail.
ANON_CHECKS = [
    ("/",                          {200, 302}, False),
    ("/auth/login",                {200, 302}, False),
    ("/leagues/3",                 {200, 302, 401}, False),  # 302 to login if anon, 200 if SPA shell, 401 if api
    ("/leagues/3/team/4",          {200, 302, 401}, False),
    ("/leagues/3/trades",          {200, 302, 401}, False),
    ("/leagues/3/trades/propose",  {200, 302, 401}, False),
]

# JSON endpoints that should return 401 when anon (not 200 or 500)
JSON_CHECKS = [
    ("/leagues/3/team/4?format=json",         {401}, False),
    ("/leagues/3/trades/propose?format=json", {401}, False),
]


def check_one(host: str, path: str, ok: set, cookie_file: Optional[str] = None) -> tuple[bool, int, str]:
    url = host + path
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "smoke-bot/1.0"})
        if cookie_file:
            cj = http.cookiejar.MozillaCookieJar(cookie_file)
            try:
                cj.load(ignore_discard=True, ignore_expires=True)
            except FileNotFoundError:
                pass
            opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
            r = opener.open(req, timeout=12)
        else:
            r = urllib.request.urlopen(req, timeout=12)
        status = r.getcode()
        body = r.read(200).decode(errors="replace")
    except urllib.error.HTTPError as e:
        status = e.code
        body = e.read(200).decode(errors="replace") if e.fp else ""
    except Exception as e:
        return False, 0, f"connection error: {e}"

    ok_status = status in ok and status < 500
    return ok_status, status, body[:120]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--cookies", default=None,
                        help="optional cookies.txt for authenticated checks")
    args = parser.parse_args()

    print(f"Smoke target: {args.host}")
    print(f"Cookies     : {args.cookies or '(none — anon checks only)'}")
    print("=" * 72)

    fails = []
    for path, ok, _ in ANON_CHECKS + JSON_CHECKS:
        passed, status, snippet = check_one(args.host, path, ok, args.cookies)
        mark = "OK  " if passed else "FAIL"
        print(f"  {mark}  {status:>3}  {path}")
        if not passed:
            fails.append((path, status, snippet))

    print("=" * 72)
    if fails:
        print(f"\n{len(fails)} FAILURE(S):")
        for path, status, snippet in fails:
            print(f"  - {path}  status={status}")
            if snippet:
                print(f"    body: {snippet!r}")
        sys.exit(1)
    print(f"\nAll {len(ANON_CHECKS) + len(JSON_CHECKS)} checks passed.")
    sys.exit(0)


if __name__ == "__main__":
    main()
