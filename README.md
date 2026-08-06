# BolsasMochilasyArtesaniasBajio

Aplicación web progresiva ecommerce para la venta de productos en mayoreo y menudeo.

## Stack

- **Backend**: Flask (Blueprints) + Flask-SQLAlchemy + Flask-Migrate, conectado directo al Postgres de Supabase.
- **Auth**: Supabase Auth (pendiente de implementar en `backend/app/blueprints/auth`).
- **Frontend**: JS vanilla (ES modules) + Tailwind CSS (CLI), sin framework/bundler.
- **DB/Storage**: Supabase.

## Estructura

```
backend/    Flask API (Blueprints: catalog, auth, cart, checkout, orders, admin)
frontend/   JS vanilla + Tailwind, consume la API vía fetch
.env        Variables de entorno (no se sube a git)
```

## Backend

```bash
cd backend
python -m venv .venv
./.venv/Scripts/pip install -r requirements.txt
./.venv/Scripts/python run.py        # http://127.0.0.1:5000
```

Migraciones:

```bash
./.venv/Scripts/python -m flask db migrate -m "mensaje"
./.venv/Scripts/python -m flask db upgrade
```

Sembrar datos de prueba: `./.venv/Scripts/python seed.py`

## Frontend

```bash
cd frontend
npm install
npm run dev        # compila Tailwind + sirve en http://127.0.0.1:5173
```

## Variables de entorno (.env en la raíz)

Ver `.env.example`. Incluye `DATABASE_URL` (Postgres de Supabase, con la contraseña URL-encodeada) y las llaves de `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.
