import uuid

from flask import jsonify

from app.utils.supabase_client import get_supabase_admin

# Bucket público de Supabase Storage compartido por todos los uploads del sitio
# (imágenes de producto/variante, logo/banner, comprobantes de pago, etc.), separados
# por carpeta (ver admin/routes.py y orders/routes.py para las carpetas usadas).
SITE_ASSETS_BUCKET = "site-assets"
ALLOWED_IMAGE_MIMETYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
ALLOWED_VOUCHER_MIMETYPES = {**ALLOWED_IMAGE_MIMETYPES, "application/pdf": "pdf"}


def upload_image_file(file, folder, allowed_mimetypes=None):
    """Sube un archivo a Storage (dentro de `folder`) y devuelve (public_url, None)
    o (None, (json, status))."""
    if not file or not file.filename:
        return None, (jsonify({"message": "Falta el archivo."}), 400)

    ext = (allowed_mimetypes or ALLOWED_IMAGE_MIMETYPES).get(file.mimetype)
    if not ext:
        return None, (jsonify({"message": "Formato no soportado. Usa JPG, PNG o WEBP."}), 400)

    path = f"{folder}/{uuid.uuid4().hex}.{ext}"
    file_bytes = file.read()

    try:
        client = get_supabase_admin()
        client.storage.from_(SITE_ASSETS_BUCKET).upload(
            path, file_bytes, file_options={"content-type": file.mimetype, "upsert": "true"}
        )
        return client.storage.from_(SITE_ASSETS_BUCKET).get_public_url(path), None
    except RuntimeError as e:
        return None, (jsonify({"message": str(e)}), 500)
    except Exception as e:
        return None, (jsonify({"message": f"Error al subir la imagen: {e}"}), 500)
