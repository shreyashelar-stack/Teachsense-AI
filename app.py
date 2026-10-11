
import os
import sqlite3
from pathlib import Path
from functools import wraps

from flask import (
    Flask, request, jsonify, send_from_directory,
    session, redirect, url_for
)
from werkzeug.security import generate_password_hash, check_password_hash
from google import genai

# ---------- CONFIGURATION ----------

BASE_DIR = Path(__file__).resolve().parent
DATABASE = BASE_DIR / "users.db"

app = Flask(__name__)

app.secret_key = os.getenv("SESSION_SECRET")

if not app.secret_key:
    app.logger.warning(
        "SESSION_SECRET is not configured. Set it in your environment."
    )
    app.secret_key = os.urandom(32)


# ---------- DATABASE ----------

def get_db():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with get_db() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            )
        """)


init_db()


# ---------- AUTHENTICATION ----------

def login_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("login"))
        return function(*args, **kwargs)
    return wrapper


# ---------- LOGIN PAGE ----------

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        with get_db() as connection:
            user = connection.execute(
                "SELECT * FROM users WHERE email = ?",
                (email,)
            ).fetchone()

        if user and check_password_hash(
            user["password_hash"], password
        ):
            session.clear()
            session["user_id"] = user["id"]
            session["user_name"] = user["name"]
            return redirect(url_for("home"))

        return "Invalid email or password. Please try again.", 401

    return send_from_directory(str(BASE_DIR), "login.html")


# ---------- SIGN UP PAGE ----------

@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        if not name or not email or not password:
            return "Please fill in all fields.", 400

        if len(password) < 8:
            return "Password must be at least 8 characters.", 400

        try:
            with get_db() as connection:
                cursor = connection.execute(
                    """
                    INSERT INTO users (name, email, password_hash)
                    VALUES (?, ?, ?)
                    """,
                    (
                        name,
                        email,
                        generate_password_hash(password)
                    )
                )
                user_id = cursor.lastrowid

            session.clear()
            session["user_id"] = user_id
            session["user_name"] = name

            return redirect(url_for("home"))

        except sqlite3.IntegrityError:
            return "This email is already registered. Please log in.", 409

    return send_from_directory(str(BASE_DIR), "signup.html")


# ---------- LOGOUT ----------

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ---------- WEBSITE HOME ----------

@app.route("/")
@login_required
def home():
    return send_from_directory(str(BASE_DIR), "index.html")


# ---------- WEBSITE FILES ----------

@app.route("/<path:filename>")
def website_files(filename):
    allowed_pages = {
        "index.html",
        "assessment.html",
        "insights.html",
        "lesson-plan.html",
        "chat.html"
    }

    allowed_assets = {
        "style.css",
        "script.js"
    }

    if filename in allowed_pages:
        if "user_id" not in session:
            return redirect(url_for("login"))

    elif filename not in allowed_assets:
        return "Not found", 404

    return send_from_directory(str(BASE_DIR), filename)


# ---------- HEALTH CHECK ----------

@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "ai_configured": bool(os.getenv("GEMINI_API_KEY")),
        "logged_in": "user_id" in session
    })


# ---------- GEMINI AI ----------

def ask_gemini(messages):
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    system_prompt = """
You are TeachSense AI, a helpful AI teaching assistant.

Help teachers to:
- Explain topics in simple language.
- Create quizzes and classroom activities.
- Prepare lesson plans and examples.
- Suggest ways to address possible student misconceptions.
- Adapt explanations to a student's grade level.

Be friendly, clear and accurate.
Use headings and examples when helpful.
Include an answer key when creating quizzes.
Do not judge a student based on one answer.
"""

    conversation = []

    for item in messages[-12:]:
        if not isinstance(item, dict):
            continue

        role = item.get("role")
        content = item.get("content")

        if role not in ("user", "assistant"):
            continue

        if not isinstance(content, str) or not content.strip():
            continue

        speaker = "Teacher" if role == "user" else "TeachSense AI"
        conversation.append(f"{speaker}: {content[:6000]}")

    if not conversation:
        raise ValueError("Please enter a message.")

    prompt = system_prompt + "\n\n" + "\n\n".join(conversation)

    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        contents=prompt
    )

    if not response.text:
        raise RuntimeError("Gemini returned an empty response.")

    return response.text.strip()


# ---------- LOCAL FALLBACK ----------

def local_teaching_reply(message):
    text = message.lower()

    if "photosynthesis" in text:
        return (
            "Photosynthesis is the process by which green plants use "
            "sunlight, water and carbon dioxide to make glucose. "
            "Oxygen is released during this process."
        )

    if any(word in text for word in ("quiz", "mcq", "multiple-choice")):
        return (
            "I can help create a quiz. Please specify the subject, "
            "topic and grade level."
        )

    if any(word in text for word in ("lesson plan", "lesson")):
        return (
            "A lesson plan can include objectives, materials, "
            "introduction, teaching activities, assessment and conclusion."
        )

    return (
        "Gemini is temporarily unavailable. Please try again shortly."
    )


# ---------- CHAT API ----------

@app.route("/api/chat", methods=["POST"])
@login_required
def chat():
    data = request.get_json(silent=True) or {}

    message = data.get("message") or data.get("prompt") or ""

    if not isinstance(message, str) or not message.strip():
        return jsonify({
            "error": "Please enter a message.",
            "reply": "Please enter a message."
        }), 400

    history = data.get("history", [])

    if not isinstance(history, list):
        history = []

    messages = []

    for item in history[-12:]:
        if not isinstance(item, dict):
            continue

        role = item.get("role")
        content = item.get("content")

        if role in ("user", "assistant") and isinstance(content, str):
            messages.append({
                "role": role,
                "content": content[:6000]
            })

    messages.append({
        "role": "user",
        "content": message.strip()[:6000]
    })

    try:
        reply = ask_gemini(messages)

        return jsonify({
            "reply": reply,
            "response": reply,
            "mode": "ai"
        })

    except Exception as error:
        app.logger.error(
            "Gemini request failed: %s: %s",
            type(error).__name__,
            str(error)
        )

        fallback = local_teaching_reply(message)

        return jsonify({
            "reply": fallback,
            "response": fallback,
            "mode": "fallback"
        })


# ---------- ANSWER ANALYSIS ----------

@app.route("/analyze", methods=["POST"])
@login_required
def analyze():
    data = request.get_json(silent=True) or {}

    question = data.get("question", "")
    student_answer = data.get("student_answer", "")
    correct_answer = data.get("correct_answer", "")

    if not all(
        isinstance(value, str)
        for value in (question, student_answer, correct_answer)
    ):
        return jsonify({
            "error": "All fields must contain text."
        }), 400

    try:
        from insights import analyze_answer

        result = analyze_answer(
            question,
            student_answer,
            correct_answer
        )

        return jsonify(result)

    except Exception:
        app.logger.exception("Answer analysis failed")

        return jsonify({
            "error": "Unable to analyze this answer."
        }), 500


# ---------- RUN SERVER ----------

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
