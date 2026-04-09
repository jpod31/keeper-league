import requests, re

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

# Check AFL.com.au player page source for image patterns
url = "https://www.afl.com.au/players/4527/patrick-cripps"
r = requests.get(url, timeout=10, headers=headers)

# Find all image URLs
img_urls = re.findall(r'https?://[^\s"\'<>]+\.(?:png|jpg|webp|jpeg)', r.text, re.IGNORECASE)
seen = set()
for u in img_urls:
    if u in seen:
        continue
    seen.add(u)
    skip = any(w in u.lower() for w in ["icon", "logo", "sprite", "favicon", "analytics", "tracking"])
    if not skip:
        print(u[:200])

print("\n--- resources.afl.com.au ---")
afl_res = re.findall(r'https?://resources\.afl\.com\.au[^\s"\'<>]+', r.text)
for u in set(afl_res):
    print(u[:200])

print("\n--- Testing direct photo URLs ---")
# AFL uses these for player headshots
test_patterns = [
    "https://resources.afl.com.au/photo-resources/2025/01/15/headshots/4527.png",
    "https://resources.afl.com.au/afl/photo/headshots/4527.png",
    "https://cdn.afl.com.au/players/headshots/4527.png",
    "https://s.afl.com.au/staticfile/AFL%20Tenant/AFL/Players/ChampIDImages/XLarge2026/CD_I1003333.png",
]
for url in test_patterns:
    try:
        r2 = requests.head(url, timeout=5, headers=headers, allow_redirects=True)
        print(f"  {r2.status_code} {url}")
    except Exception as e:
        print(f"  ERR {url}: {e}")
