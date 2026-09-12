"""Read-only public audit; no authentication, account creation or order submission."""
import concurrent.futures
import json
import pathlib
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

OUT = pathlib.Path(__file__).parent
SITE = "https://bolsasdelbajio.com"
API = "https://bolsasmochilasyartesaniasbajio.onrender.com/api"

def read(url):
    try:
        r = urllib.request.urlopen(url, timeout=35)
    except urllib.error.HTTPError as e:
        r = e
    body = r.read()
    return {"url":url, "final_url":r.url, "status":r.code, "content_type":r.headers.get("Content-Type"), "bytes":len(body)}, body

def main():
    _, body = read(API + "/products")
    products = json.loads(body)["products"]
    (OUT / "public-products.json").write_text(json.dumps(products,ensure_ascii=False,indent=2),encoding="utf-8")
    _, sitemap = read(SITE + "/sitemap.xml")
    root = ET.fromstring(sitemap)
    urls = [el.text for el in root.findall(".//{*}loc")]
    def check(url):
        result, _ = read(urllib.parse.quote(url, safe=":/?=&%"))
        return result
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        checks = list(pool.map(check,urls))
    known = {p["slug"] for p in products}
    sitemap_products = {urllib.parse.unquote(u.split("/producto/")[1]) for u in urls if "/producto/" in u}
    summaries = []
    for path in ["/producto/prueba", "/producto/fd", "/auditoria-pagina-inexistente-20260912", "/src/js/archivo-inexistente-auditoria.js", "/login", "/checkout"]:
        record, data = read(SITE + path)
        record["has_empty_root"] = b'<div id="root"></div>' in data
        summaries.append(record)
    protected = [read(API+path)[0] for path in ["/auth/me", "/orders/admin/all", "/admin/settings"]]
    result = {"product_count":len(products), "test_products":[p["name"] for p in products if p["name"].lower() in ["prueba","fd"]], "sitemap_count":len(urls), "missing_from_sitemap":sorted(known-sitemap_products), "stale_sitemap_products":sorted(sitemap_products-known), "sitemap_unescaped_spaces":[u for u in urls if " " in u], "sitemap_http":checks, "edge_routes":summaries, "unauthenticated_endpoints":protected, "categories_with_products":sorted({p["category"] for p in products}), "bundles":sum(p["is_bundle"] for p in products)}
    (OUT / "public-checks.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({**result,"sitemap_http_summary":{str(s):sum(r["status"]==s for r in checks) for s in {r["status"] for r in checks}}, "sitemap_http":None},ensure_ascii=False,indent=2))

if __name__ == "__main__": main()
