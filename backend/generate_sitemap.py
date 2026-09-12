import os
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime
from dotenv import load_dotenv

# Load root .env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app import create_app
from app.models import Product, Category

app = create_app()

FRONTEND_URL = os.environ.get("FRONTEND_ORIGIN", "https://bolsasdelbajio.com").rstrip("/")
# For production sitemap, we ideally want the production URL. 
if "localhost" in FRONTEND_URL or "127.0.0.1" in FRONTEND_URL or "bolsasmochilasyartesaniasbajio.com" in FRONTEND_URL:
    print(f"Warning: FRONTEND_ORIGIN is {FRONTEND_URL}. Using a placeholder production URL for sitemap.xml. Please update .env or environment variables.")
    FRONTEND_URL = "https://bolsasdelbajio.com"

SITEMAP_PATH = os.path.join(os.path.dirname(__file__), "..", "frontend", "sitemap.xml")
ROBOTS_PATH = os.path.join(os.path.dirname(__file__), "..", "frontend", "robots.txt")

def create_url_element(urlset, loc, lastmod=None, changefreq="weekly", priority="0.8"):
    url = ET.SubElement(urlset, "url")
    ET.SubElement(url, "loc").text = loc
    if lastmod:
        ET.SubElement(url, "lastmod").text = lastmod
    ET.SubElement(url, "changefreq").text = changefreq
    ET.SubElement(url, "priority").text = priority

def generate_sitemap():
    urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    
    # Static pages
    now = datetime.utcnow().strftime("%Y-%m-%d")
    create_url_element(urlset, f"{FRONTEND_URL}/", lastmod=now, changefreq="daily", priority="1.0")
    create_url_element(urlset, f"{FRONTEND_URL}/categoria/Todos", lastmod=now, changefreq="daily", priority="0.9")
    create_url_element(urlset, f"{FRONTEND_URL}/politica-envios", changefreq="monthly", priority="0.5")
    create_url_element(urlset, f"{FRONTEND_URL}/politica-privacidad", changefreq="monthly", priority="0.5")
    create_url_element(urlset, f"{FRONTEND_URL}/terminos-y-condiciones", changefreq="monthly", priority="0.5")

    with app.app_context():
        # Categories
        categories = Category.query.all()
        for cat in categories:
            encoded_name = urllib.parse.quote(cat.name)
            create_url_element(urlset, f"{FRONTEND_URL}/categoria/{encoded_name}", lastmod=now, changefreq="weekly", priority="0.8")
        
        # Products
        products = Product.query.filter_by(is_public=True).all()
        for prod in products:
            # We use created_at as a fallback for lastmod if updated_at is not there
            lastmod_date = now
            if hasattr(prod, 'updated_at') and prod.updated_at:
                lastmod_date = prod.updated_at.strftime("%Y-%m-%d")
            create_url_element(urlset, f"{FRONTEND_URL}/producto/{prod.slug}", lastmod=lastmod_date, changefreq="weekly", priority="0.9")

    # Save sitemap
    tree = ET.ElementTree(urlset)
    if hasattr(ET, "indent"):
        ET.indent(tree, space="  ", level=0)
    tree.write(SITEMAP_PATH, encoding="utf-8", xml_declaration=True)
    print(f"Éxito: sitemap.xml generado en {SITEMAP_PATH}")

    # Generate robots.txt
    robots_content = f"""User-agent: *
Allow: /
Disallow: /carrito
Disallow: /checkout
Disallow: /login
Disallow: /registro
Disallow: /mis-pedidos

Sitemap: {FRONTEND_URL}/sitemap.xml
"""
    with open(ROBOTS_PATH, "w", encoding="utf-8") as f:
        f.write(robots_content)
    print(f"Éxito: robots.txt generado en {ROBOTS_PATH}")

if __name__ == "__main__":
    generate_sitemap()
