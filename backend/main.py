from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr


app = FastAPI(title="Portfolio API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Profile(BaseModel):
    name: str
    role: str
    location: str
    availability: str
    bio: str
    email: EmailStr
    stats: dict[str, str]


class Project(BaseModel):
    id: int
    title: str
    description: str
    category: str
    year: str
    accent: Literal["orange", "blue", "green"]
    tags: list[str]


class ContactMessage(BaseModel):
    name: str
    email: EmailStr
    message: str


PROFILE = Profile(
    name="Prakash Kusari",
    role="Computer science student & frontend developer",
    location="Based in Hammond, LA",
    availability="Open to internships and software opportunities",
    bio="I build accessible web experiences and practical systems across frontend development, AI, data, and Solana. I enjoy turning complex ideas into products people can use.",
    email="prakashkusari0@gmail.com",
    stats={"experience": "Research + internship", "projects": "3 featured", "focus": "AI, Web3 & data"},
)

PROJECTS = [
    Project(
        id=1,
        title="SolPOS",
        description="An AI-powered Solana point-of-sale platform helping small merchants accept fast, low-cost USDC payments.",
        category="Solana · HackLion",
        year="2025",
        accent="orange",
        tags=["Next.js", "Solana Pay", "Gemini AI"],
    ),
    Project(
        id=2,
        title="Credence",
        description="A decentralized certificate verification platform using Solana and IPFS to make academic credentials tamper-proof.",
        category="Blockchain platform",
        year="2025",
        accent="blue",
        tags=["React", "Anchor", "IPFS"],
    ),
    Project(
        id=3,
        title="AI Teaching Assistant",
        description="A real-time AI-powered teaching assistant research project designed to improve student learning and academic support.",
        category="University research",
        year="2025–present",
        accent="green",
        tags=["LLMs", "Retrieval", "AI workflows"],
    ),
]


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/profile", response_model=Profile)
def get_profile() -> Profile:
    return PROFILE


@app.get("/api/projects", response_model=list[Project])
def get_projects() -> list[Project]:
    return PROJECTS


@app.post("/api/contact")
def send_message(message: ContactMessage) -> dict[str, str]:
    # Replace this with email delivery or a database when the project grows.
    return {
        "status": "received",
        "message": f"Thanks {message.name}, I’ll get back to you soon.",
        "received_at": datetime.now(timezone.utc).isoformat(),
    }
