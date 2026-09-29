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
    name="Alex Morgan",
    role="Product designer & developer",
    location="Based in Austin, TX",
    availability="Available for select projects",
    bio="I turn complicated ideas into calm, useful digital products. I care about the small details, the big picture, and everything in between.",
    email="hello@alexmorgan.design",
    stats={"experience": "8+ years", "projects": "42 shipped", "focus": "Web & product"},
)

PROJECTS = [
    Project(
        id=1,
        title="Field notes",
        description="A thoughtful workspace for independent teams to turn research into momentum.",
        category="Product design",
        year="2024",
        accent="orange",
        tags=["Strategy", "UX/UI", "Prototyping"],
    ),
    Project(
        id=2,
        title="Common ground",
        description="Making local volunteering feel as easy and welcoming as sending a message.",
        category="Brand & web",
        year="2023",
        accent="blue",
        tags=["Identity", "Web design", "Development"],
    ),
    Project(
        id=3,
        title="North star",
        description="A clearer way for growing teams to see what matters, and what comes next.",
        category="Product design",
        year="2023",
        accent="green",
        tags=["Research", "Design system", "Launch"],
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
