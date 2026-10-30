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

## Run the frontend (PeteOS)

The frontend is **PeteOS**, a retro Linux-style terminal portfolio (React + TypeScript + Vite + Tailwind).
It runs a small Bash-like shell (`pete-sh`) against an in-browser virtual filesystem. Nothing touches the
visitor's real machine.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run test:e2e   # browser tests (Playwright); set CHROME_PATH to use a system Chrome/Chromium,
                   # or run `npx playwright install chromium` once
```

### Editing your content

Portfolio content lives in `frontend/src/portfolio/` and is turned into files under `/home/prakash`:

- `profile.ts`: name, bio, education, experience, achievements, links (`null` = "not set yet")
- `projects.ts`: each project's README and architecture notes
- `skills.ts`: skill groups

### Portrait ASCII art

`neofetch` and the welcome screen show your photo as ASCII art. Generate it once:

```bash
cd frontend
python3 scripts/portrait_to_ascii.py path/to/photo.jpg            # needs Pillow
python3 scripts/portrait_to_ascii.py photo.jpg --width 48         # wider / more detail
python3 scripts/portrait_to_ascii.py photo.jpg --bg-threshold 200 # if the wall is not removed
```

This writes `src/portfolio/portrait.ts`. The photo itself is not copied into the site.

### Shell features

Pipelines, `&&`/`||`/`;`, redirection (`>`, `>>`, `<`, `2>`, `2>&1`, `&>`), quoting, `$VAR`, `$?`, `~`,
globbing, tab completion and history. Run `man pete-sh` in the terminal for the full list and what is
not supported. Portfolio files are read-only; `~`, `~/sandbox` and `/tmp` are writable.

### Adding a command

Add a `Command` to one of the files in `frontend/src/shell/commands/`. It gets `args`, `stdin`,
`stdout`/`stderr` writers, and the shell (filesystem, env). It shows up in `help`, `man`, `/bin`,
`which`, and tab completion automatically.

## Structure

```text
backend/
  main.py                    # FastAPI routes (profile, projects, contact)
frontend/
  scripts/portrait_to_ascii.py
  src/
    shell/                   # lexer, parser (AST), executor, registry, commands/ (+ tests)
    filesystem/              # VirtualFileSystem, paths, seeded content
    portfolio/               # editable content + ASCII art
    components/boot/         # POST boot sequence
    components/terminal/     # terminal UI, welcome screen
    store/settings.ts        # theme + CRT settings (saved in localStorage)
    styles/index.css         # themes and CRT effects
  e2e/                       # Playwright tests
```
