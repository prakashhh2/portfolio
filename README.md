# Portfolio starter

A small full-stack portfolio starter with a React/Vite client and a Python/FastAPI backend.

## Run the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API is available at `http://localhost:8000` and its interactive docs are at `http://localhost:8000/docs`.

## Run the frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

The client runs at `http://localhost:5173`. Set `VITE_API_URL` if the backend is hosted somewhere else.

## Structure

```text
backend/
  main.py          # profile, projects, and contact API routes
  requirements.txt
frontend/
  src/
    App.jsx        # portfolio page and API loading
    styles.css     # responsive visual system
    main.jsx
```
