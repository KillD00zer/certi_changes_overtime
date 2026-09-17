import urllib.request, ssl, sys, json, hashlib
from concurrent.futures import ThreadPoolExecutor
sys.path.append('src')
from wayback_engine import load_wayback_config, lonlat_to_tile

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Tanah, Mansoura sample coordinate
lat, lon, zoom = 31.0664, 31.4884, 18
tx, ty = lonlat_to_tile(lon, lat, zoom)
cfg = load_wayback_config()

# Group releases by year and find distinct ones
items = []
for k, v in cfg.items():
    title = v.get("itemTitle", "")
    import re
    m = re.search(r'(\d{4})-(\d{2})-(\d{2})', title)
    if m:
        y, mth, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        url_template = v.get("itemURL", "").replace("{level}", "{z}").replace("{row}", "{y}").replace("{col}", "{x}")
        items.append({
            "key": k,
            "year": y,
            "month": mth,
            "day": d,
            "date": f"{y}-{mth:02d}-{d:02d}",
            "title": title,
            "url_template": url_template
        })

# Sort oldest to newest
items.sort(key=lambda x: x["date"])

def fetch_hash(item):
    url = item["url_template"].format(z=zoom, x=tx, y=ty)
    try:
        data = urllib.request.urlopen(url, context=ctx, timeout=6).read()
        return (item, hashlib.md5(data).hexdigest()[:12], len(data))
    except Exception as e:
        return (item, None, 0)

with ThreadPoolExecutor(max_workers=20) as ex:
    results = list(ex.map(fetch_hash, items))

# Group consecutive duplicate tiles or detect distinct image updates
distinct_passes = []
current_hash = None

for item, h, sz in results:
    if h and h != current_hash:
        distinct_passes.append({
            "key": item["key"],
            "date": item["date"],
            "year": item["year"],
            "hash": h,
            "size": sz
        })
        current_hash = h

print(f"Total Wayback Archive Releases: {len(results)}")
print(f"ACTUAL SATELLITE/AERIAL PASSES (Unique imagery updates at this location): {len(distinct_passes)}")
for p in distinct_passes:
    print(f"  -> Pass on {p['date']} (Year {p['year']}) [Tile size: {p['size']} bytes]")
