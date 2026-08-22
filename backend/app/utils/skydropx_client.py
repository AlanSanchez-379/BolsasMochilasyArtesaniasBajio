"""Cliente de Skydropx Pro (cotizacion y compra de guias de envio).

Contrato de /oauth/token y /quotations CONFIRMADO en vivo contra la cuenta real del
usuario (2026-08-21) -- ver detalle abajo. El de /shipments y /orders/{id}/labels
(compra real de guia) sigue siendo inferido por analogía, nunca se probó en vivo a
propósito porque compra de verdad y gasta saldo real de la cuenta.

  1. POST {base}/api/v1/oauth/token  {client_id, client_secret, grant_type:
     "client_credentials"} -> {access_token, token_type, expires_in (~7200s)}. CONFIRMADO.
  2. Llamadas subsecuentes: header "Authorization: Bearer <access_token>". CONFIRMADO.
  3. POST {base}/api/v1/quotations  {"quotation": {address_from, address_to, parcel}}
     -- cada address necesita name/phone/street1/area_level1(=estado)/area_level2(=
     ciudad o alcaldía)/area_level3(=colonia, SÍ obligatoria)/postal_code/country_code
     ("mx"). CONFIRMADO (incluye los 422 de validación que revelaron los nombres reales
     de campo). La cotización es ASÍNCRONA: el POST regresa de inmediato con
     is_completed=false y rates en status "pending"; hay que hacer polling a
     GET {base}/api/v1/quotations/{id} hasta que is_completed sea true. En pruebas
     reales tardó ~3s. Cada rate trae success=true/false -- solo usar las success=true;
     el precio final a cobrar es el campo "total" (ya incluye service_fee), no "amount".
  4. POST {base}/api/v1/shipments -- INFERIDO por analogía con /quotations (probablemente
     envuelto en {"shipment": {quotation_id, rate_id}} o similar), NO CONFIRMADO.
  5. GET {base}/api/v1/orders/{shipment_id}/labels -- INFERIDO, NO CONFIRMADO.

Base URL: producción = https://pro.skydropx.com, sandbox = https://sb-pro.skydropx.com
(mismo /api/v1 en ambas). SKYDROPX_API_BASE_URL en la config decide cuál se usa.

TODO CRÍTICO: antes de comprar una guía real por primera vez (purchase_label con
SKYDROPX_MOCK_MODE=false), confirmar el payload exacto de /shipments y /labels -- lo
más seguro es probarlo primero contra sb-pro.skydropx.com (sandbox, credenciales
separadas) en vez de la cuenta de producción. Si Skydropx responde 422 con un mensaje
de campo, ajustar SOLO _shipment_payload de este archivo -- ningún otro módulo debe
hablarle a Skydropx directamente, todos pasan por get_rates()/purchase_label().

Mientras current_app.config["SKYDROPX_MOCK_MODE"] sea True (default), ninguna función
de este módulo llama a requests -- devuelven datos falsos pero realistas, para poder
probar el resto del sistema sin gastar saldo real de la cuenta de Skydropx.
"""
import random
import string
import time
import hashlib

import requests
from flask import current_app

QUOTATION_POLL_ATTEMPTS = 6
QUOTATION_POLL_DELAY_SECONDS = 1.5


class SkydropxError(Exception):
    pass


def _base_url():
    return current_app.config["SKYDROPX_API_BASE_URL"].rstrip("/")


def _mock_mode():
    return current_app.config.get("SKYDROPX_MOCK_MODE", True)


def _fake_id(prefix):
    suffix = "".join(random.choices(string.digits, k=8))
    return f"{prefix}_mock_{suffix}"


# Cache del access_token en memoria del proceso -- dura ~2h (expires_in), evita pedir
# un token nuevo en cada llamada (límite documentado: 2 req/s).
_token_cache = {"access_token": None, "expires_at": 0}


def _get_access_token():
    if _token_cache["access_token"] and time.time() < _token_cache["expires_at"]:
        return _token_cache["access_token"]

    payload = {
        "client_id": current_app.config["SKYDROPX_CLIENT_ID"],
        "client_secret": current_app.config["SKYDROPX_CLIENT_SECRET"],
        "grant_type": "client_credentials",
    }
    try:
        resp = requests.post(f"{_base_url()}/api/v1/oauth/token", json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        raise SkydropxError(f"No se pudo autenticar con Skydropx: {e}") from e

    access_token = data.get("access_token")
    if not access_token:
        raise SkydropxError("Skydropx no devolvió access_token al autenticar.")

    # Margen de 60s antes de que expire de verdad, para no usar un token a punto de vencer.
    _token_cache["access_token"] = access_token
    _token_cache["expires_at"] = time.time() + int(data.get("expires_in", 7200)) - 60
    return access_token


def _headers():
    return {
        "Authorization": f"Bearer {_get_access_token()}",
        "Content-Type": "application/json",
    }


def _address_payload(address):
    """Mapea el shape interno de la app {name, phone, street, colonia, city, state,
    postal_code} al shape real de Skydropx (area_level1=estado, area_level2=ciudad/
    alcaldía, area_level3=colonia -- los tres son obligatorios, confirmado en vivo)."""
    return {
        "name": address.get("name"),
        "phone": address.get("phone"),
        "street1": address.get("street"),
        "area_level1": address.get("state"),
        "area_level2": address.get("city"),
        "area_level3": address.get("colonia"),
        "postal_code": address.get("postal_code"),
        "country_code": "mx",
    }


def _quotation_payload(origin, destination, weight_kg, length_cm, width_cm, height_cm):
    return {
        "quotation": {
            "address_from": _address_payload(origin),
            "address_to": _address_payload(destination),
            "parcel": {
                "weight": weight_kg,
                "length": length_cm,
                "width": width_cm,
                "height": height_cm,
            },
        }
    }


def get_rates(origin: dict, destination: dict, weight_kg: float,
              length_cm=None, width_cm=None, height_cm=None) -> list[dict]:
    """Cotiza tarifas reales de envío.

    origin/destination: dicts con name/phone/street/colonia/city/state/postal_code (ver
    app.utils.shipping_estimate.get_origin_address).

    Devuelve una lista de dicts normalizados:
    [{rate_id, quotation_id, carrier_name, service_level, cost, eta_days}, ...]

    Lanza SkydropxError si la llamada o el polling fallan; el caller decide cómo degradar.
    """
    if _mock_mode():
        # IDs deterministicos (derivados del origen/destino/peso), no aleatorios: el
        # checkout cotiza una vez para mostrarle opciones al cliente y vuelve a cotizar
        # en el servidor al crear la orden para confirmar el precio -- con IDs al azar
        # el rate_id elegido nunca coincidiría en la segunda llamada.
        seed = f"{origin.get('postal_code')}:{destination.get('postal_code')}:{weight_kg}"
        digest = hashlib.sha256(seed.encode()).hexdigest()[:10]
        quotation_id = f"quotation_mock_{digest}"
        base = 80 + weight_kg * 35
        options = [
            ("DHL", "Express", 1.0, 2),
            ("Fedex", "Ground", 0.75, 4),
            ("Estafeta", "Terrestre", 0.6, 5),
        ]
        return [
            {
                "rate_id": f"rate_mock_{digest}_{i}",
                "quotation_id": quotation_id,
                "carrier_name": carrier,
                "service_level": service,
                "cost": round(base * factor, 2),
                "eta_days": days,
            }
            for i, (carrier, service, factor, days) in enumerate(options)
        ]

    payload = _quotation_payload(origin, destination, weight_kg, length_cm, width_cm, height_cm)
    try:
        resp = requests.post(f"{_base_url()}/api/v1/quotations", json=payload, headers=_headers(), timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        detail = getattr(e.response, "text", "") if getattr(e, "response", None) is not None else ""
        raise SkydropxError(f"No se pudo cotizar con Skydropx: {e} {detail}".strip()) from e

    quotation_id = data.get("id")

    for _ in range(QUOTATION_POLL_ATTEMPTS):
        if data.get("is_completed"):
            break
        time.sleep(QUOTATION_POLL_DELAY_SECONDS)
        try:
            poll_resp = requests.get(f"{_base_url()}/api/v1/quotations/{quotation_id}", headers=_headers(), timeout=15)
            poll_resp.raise_for_status()
            data = poll_resp.json()
        except requests.RequestException as e:
            raise SkydropxError(f"No se pudo consultar la cotización de Skydropx: {e}") from e
    else:
        raise SkydropxError("Skydropx tardó demasiado en cotizar. Intenta de nuevo.")

    rates = [r for r in (data.get("rates") or []) if r.get("success")]
    return [
        {
            "rate_id": rate["id"],
            "quotation_id": quotation_id,
            "carrier_name": rate.get("provider_display_name") or rate.get("provider_name"),
            "service_level": rate.get("provider_service_name"),
            "cost": float(rate["total"]),
            "eta_days": rate.get("days"),
        }
        for rate in rates
    ]


def _shipment_payload(rate_id, quotation_id):
    return {"shipment": {"quotation_id": quotation_id, "rate_id": rate_id}}


def purchase_label(rate_id: str, quotation_id: str = None) -> dict:
    """Compra la guía real para una tarifa ya cotizada (POST /shipments) y obtiene el
    PDF de la guía (GET /orders/{shipment_id}/labels).

    Devuelve {shipment_id, tracking_number, label_url, tracking_url_provider, real_cost}.
    Lanza SkydropxError si la compra falla. OJO: en modo no-mock esto gasta saldo real
    de la cuenta de Skydropx -- nunca llamar salvo que el admin explícitamente eligió
    comprar esa guía, y el payload de /shipments todavía no está confirmado en vivo
    (ver TODO arriba del archivo) -- probar primero en sandbox.
    """
    if _mock_mode():
        return {
            "shipment_id": _fake_id("shipment"),
            "tracking_number": "".join(random.choices(string.ascii_uppercase + string.digits, k=12)),
            "label_url": f"https://example-mock-labels.local/{_fake_id('label')}.pdf",
            "tracking_url_provider": None,
            "real_cost": round(80 + random.random() * 200, 2),
        }

    try:
        shipment_resp = requests.post(
            f"{_base_url()}/api/v1/shipments",
            json=_shipment_payload(rate_id, quotation_id),
            headers=_headers(),
            timeout=20,
        )
        shipment_resp.raise_for_status()
        shipment_data = shipment_resp.json()
    except requests.RequestException as e:
        raise SkydropxError(f"No se pudo comprar la guía con Skydropx: {e}") from e

    shipment_id = shipment_data.get("id") or shipment_data.get("shipment_id")
    tracking_number = shipment_data.get("tracking_number")
    real_cost = shipment_data.get("total") or shipment_data.get("cost")

    label_url = None
    tracking_url_provider = shipment_data.get("tracking_url_provider")
    try:
        labels_resp = requests.get(f"{_base_url()}/api/v1/orders/{shipment_id}/labels", headers=_headers(), timeout=20)
        labels_resp.raise_for_status()
        labels_data = labels_resp.json()
        label_url = labels_data.get("label_url") or labels_data.get("url")
        tracking_url_provider = tracking_url_provider or labels_data.get("tracking_url_provider")
    except requests.RequestException as e:
        # El envío ya se compró (se cobró) aunque falle obtener el PDF -- no lo tratamos
        # como error fatal, el admin puede volver a consultar la guía después.
        current_app.logger.error(f"Envío comprado en Skydropx (shipment_id={shipment_id}) pero falló obtener el PDF: {e}")

    return {
        "shipment_id": shipment_id,
        "tracking_number": tracking_number,
        "label_url": label_url,
        "tracking_url_provider": tracking_url_provider,
        "real_cost": float(real_cost) if real_cost is not None else None,
    }
