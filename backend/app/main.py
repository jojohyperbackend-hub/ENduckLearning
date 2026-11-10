import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.routes.ai_routes import router as ai_router
from app.routes.course_routes import router as course_router
from app.routes.lesson_routes import router as lesson_router
from app.routes.progress_routes import router as progress_router
from app.routes.review_routes import router as review_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")

app = FastAPI(title="EnglishDucAiLms API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(course_router)
app.include_router(lesson_router)
app.include_router(review_router)
app.include_router(progress_router)
app.include_router(ai_router)


@app.get("/")
def root():
    return {"message": "backend berjalan"}
