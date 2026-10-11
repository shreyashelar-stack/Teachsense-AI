
import os
import json
import sqlite3
from pathlib import Path
from functools import wraps
from datetime import datetime, timezone

from flask import (
    Flask, request, jsonify, send_from_directory,
    session, redirect, url_for
)
from werkzeug.security import generate_password_hash, check_password_hash
from google import genai

# ==================================================
# CONFIGURATION
# ==================================================

BASE_DIR = Path(__file__).resolve().parent
DATABASE = BASE_DIR / "users.db"

app = Flask(__name__)

app.secret_key = os.getenv("SESSION_SECRET")
if not app.secret_key:
    app.secret_key = os.urandom(32)
    app.logger.warning(
        "SESSION_SECRET is missing. Set it in your environment."
    )

app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024


# ==================================================
# DATABASE
# ==================================================

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

        connection.execute("""
            CREATE TABLE IF NOT EXISTS assessments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                topic TEXT NOT NULL,
                grade TEXT NOT NULL,
                question TEXT NOT NULL,
                correct_answer TEXT NOT NULL,
                report_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)


init_db()


# ==================================================
# AUTHENTICATION
# ==================================================

def login_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            if request.path.startswith("/api/") or request.path == "/analyze":
                return jsonify({
                    "error": "Your session has expired. Please log in again."
                }), 401

            return redirect(url_for("login"))

        return function(*args, **kwargs)

    return wrapper


# ==================================================
# LOGIN
# ==================================================

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

        return "Invalid email or password.", 401

    return send_from_directory(str(BASE_DIR), "login.html")


# ==================================================
# SIGNUP
# ==================================================

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


# ==================================================
# LOGOUT
# ==================================================

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ==================================================
# WEBSITE PAGES
# ==================================================

@app.route("/")
@login_required
def home():
    return send_from_directory(str(BASE_DIR), "index.html")


@app.route("/<path:filename>")
def website_files(filename):
    protected_pages = {
        "index.html",
        "assessment.html",
        "insights.html",
        "lesson-plan.html",
        "chat.html"
    }

    public_pages = {
        "login.html",
        "signup.html"
    }

    public_assets = {
        "style.css",
        "script.js"
    }

    if filename in protected_pages:
        if "user_id" not in session:
            return redirect(url_for("login"))

    elif filename not in public_pages and filename not in public_assets:
        return "Not found", 404

    return send_from_directory(str(BASE_DIR), filename)


# ==================================================
# HEALTH CHECK
# ==================================================

@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "ai_configured": bool(os.getenv("GEMINI_API_KEY")),
        "logged_in": "user_id" in session
    })


@app.route("/api/me")
@login_required
def current_user():
    return jsonify({
        "logged_in": True,
        "name": session.get("user_name", "")
    })


# ==================================================
# GEMINI AI CHAT
# ==================================================

def ask_gemini(messages):
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    system_prompt = """
You are TeachSense AI, a helpful AI teaching assistant.

Help teachers:
- Explain topics in simple language.
- Create quizzes and classroom activities.
- Prepare lesson plans and examples.
- Suggest ways to address possible misconceptions.
- Adapt explanations to students' grade levels.

Be friendly, clear and accurate. Do not judge a student
based on one answer. Teachers should review AI suggestions.
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
        conversation.append(
            f"{speaker}: {content[:6000]}"
        )

    if not conversation:
        raise ValueError("Please enter a message.")

    prompt = system_prompt + "\n\n" + "\n\n".join(conversation)

    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        contents=prompt
    )

    if not response.text:
        raise RuntimeError("The AI returned an empty response.")

    return response.text.strip()


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

    if "lesson" in text:
        return (
            "A lesson plan can include learning objectives, materials, "
            "an introduction, teaching activities, assessment and conclusion."
        )

    return (
        "The AI service is temporarily unavailable. "
        "Please check your API key and try again."
    )


@app.route("/api/chat", methods=["POST"])
@login_required
def chat():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Please send a valid JSON request."}), 400

    message = data.get("message") or data.get("prompt") or ""

    if not isinstance(message, str) or not message.strip():
        return jsonify({"error": "Please enter a message."}), 400

    history = data.get("history", [])
    if not isinstance(history, list):
        history = []

    messages = []

    for item in history[-12:]:
        if (
            isinstance(item, dict)
            and item.get("role") in ("user", "assistant")
            and isinstance(item.get("content"), str)
        ):
            messages.append({
                "role": item["role"],
                "content": item["content"][:6000]
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
            "Chat AI failed: %s: %s",
            type(error).__name__,
            str(error)
        )

        fallback = local_teaching_reply(message)

        return jsonify({
            "reply": fallback,
            "response": fallback,
            "mode": "fallback"
        })


# ==================================================
# ASSESSMENT ANALYSIS HELPERS
# ==================================================

def analyze_one_answer(question, answer, correct_answer):
    """
    Uses the project's insights.py rules.
    Unknown or unsupported answers remain ungraded.
    """

    from insights import analyze_answer

    result = analyze_answer(question, answer, correct_answer)

    if not isinstance(result, dict):
        result = {"explanation": str(result)}

    # Accept common output field names from different analyzers.
    is_correct = result.get("is_correct")

    if is_correct is None and isinstance(result.get("correct"), bool):
        is_correct = result["correct"]

    status = result.get("status")

    if is_correct is None and status in ("correct", "incorrect"):
        is_correct = status == "correct"

    return {
        "is_correct": is_correct if isinstance(is_correct, bool) else None,
        "status": status or (
            "correct" if is_correct is True else
            "incorrect" if is_correct is False else
            "needs_review"
        ),
        "misconception": result.get("misconception"),
        "explanation": result.get(
            "explanation",
            result.get("message", result.get("feedback", ""))
        ),
        "teaching_suggestion": result.get(
            "teaching_suggestion",
            result.get("recommendation", "")
        ),
        "practice_question": result.get("practice_question", ""),
        "confidence": result.get("confidence", "not available"),
        "method": result.get("method", "insights.py")
    }


def build_assessment_report(data):
    topic = str(data.get("topic", "")).strip()
    grade = str(data.get("grade", "")).strip()
    question = str(data.get("question", "")).strip()

    correct_answer = str(
        data.get("correctAnswer", data.get("correct_answer", ""))
    ).strip()

    teacher_context = str(
        data.get("teacherContext", data.get("teacher_context", ""))
    ).strip()

    # Support both array-based assessment forms and single-answer requests.
    student_ids = data.get("studentIds", data.get("student_ids", []))
    student_answers = data.get(
        "studentAnswers",
        data.get("student_answers", [])
    )

    if not student_ids and (
        "student_answer" in data or "studentAnswer" in data
    ):
        student_ids = [
            data.get("student", "Student 1")
        ]
        student_answers = [
            data.get("student_answer", data.get("studentAnswer", ""))
        ]

    if not all([topic, grade, question, correct_answer]):
        raise ValueError(
            "Enter the topic, grade, question and correct answer."
        )

    if not isinstance(student_ids, list) or not isinstance(student_answers, list):
        raise ValueError("Student IDs and answers must be lists.")

    if len(student_ids) != len(student_answers):
        raise ValueError("Student IDs and answers do not match.")

    if not student_answers or len(student_answers) > 100:
        raise ValueError("Enter between 1 and 100 student responses.")

    responses = []

    for index, (student_id, answer) in enumerate(
        zip(student_ids, student_answers), start=1
    ):
        student_id = str(student_id).strip()[:100]
        answer = str(answer).strip()[:5000]

        if not answer:
            continue

        try:
            result = analyze_one_answer(
                question, answer, correct_answer
            )

        except Exception as error:
            app.logger.error(
                "Individual answer analysis failed: %s: %s",
                type(error).__name__,
                str(error)
            )
            result = {
                "is_correct": None,
                "status": "needs_review",
                "misconception": None,
                "explanation": (
                    "This answer could not be analyzed. "
                    "Please review it manually."
                ),
                "teaching_suggestion": "",
                "practice_question": "",
                "confidence": "not available",
                "method": "manual_review"
            }

        responses.append({
            "student": student_id or f"Student {index}",
            "answer": answer,
            **result
        })

    if not responses:
        raise ValueError("Enter at least one non-empty student answer.")

    graded = [
        item for item in responses
        if isinstance(item["is_correct"], bool)
    ]

    correct_count = sum(
        item["is_correct"] is True for item in graded
    )

    accuracy = (
        round(correct_count / len(graded) * 100, 1)
        if graded else None
    )

    counts = {}

    for item in responses:
        misconception = item.get("misconception")

        if misconception:
            counts[misconception] = counts.get(misconception, 0) + 1

    insights = [
        {"misconception": name, "count": count}
        for name, count in sorted(
            counts.items(),
            key=lambda entry: entry[1],
            reverse=True
        )
    ]

    suggestions = [
        item["teaching_suggestion"]
        for item in responses
        if item.get("teaching_suggestion")
    ]

    report = {
        "topic": topic,
        "grade": grade,
        "question": question,
        "correct_answer": correct_answer,
        "teacher_context": teacher_context,
        "total_students": len(responses),
        "graded_students": len(graded),
        "correct_count": correct_count,
        "accuracy": accuracy,
        "responses": responses,
        "insights": insights,
        "recommendation": (
            suggestions[0] if suggestions
            else "Review student responses and reteach difficult concepts."
        ),
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    return report


# ==================================================
# ASSESSMENT API
# ==================================================

def handle_assessment_request():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "success": False,
            "error": "Please send assessment data as JSON."
        }), 400

    try:
        report = build_assessment_report(data)

        with get_db() as connection:
            cursor = connection.execute(
                """
                INSERT INTO assessments
                (user_id, topic, grade, question, correct_answer,
                 report_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session["user_id"],
                    report["topic"],
                    report["grade"],
                    report["question"],
                    report["correct_answer"],
                    json.dumps(report),
                    report["created_at"]
                )
            )

            report["id"] = cursor.lastrowid

        return jsonify({
            "success": True,
            "assessment_id": report["id"],
            **report
        })

    except ValueError as error:
        return jsonify({
            "success": False,
            "error": str(error)
        }), 400

    except Exception:
        app.logger.exception("Assessment analysis failed")
        return jsonify({
            "success": False,
            "error": (
                "Assessment analysis failed. Check insights.py "
                "and the Flask server logs."
            )
        }), 500


@app.route("/api/analyze", methods=["POST"])
@login_required
def analyze_assessment():
    return handle_assessment_request()


# Compatibility endpoint for older JavaScript.
@app.route("/analyze", methods=["POST"])
@login_required
def analyze():
    return handle_assessment_request()


# ==================================================
# LEARNING INSIGHTS: LIST SAVED REPORTS
# ==================================================

@app.route("/api/assessments", methods=["GET"])
@login_required
def list_assessments():
    with get_db() as connection:
        rows = connection.execute(
            """
            SELECT id, topic, grade, created_at, report_json
            FROM assessments
            WHERE user_id = ?
            ORDER BY id DESC
            """,
            (session["user_id"],)
        ).fetchall()

    reports = []

    for row in rows:
        try:
            report = json.loads(row["report_json"])
        except (ValueError, TypeError):
            report = {}

        reports.append({
            "id": row["id"],
            "topic": row["topic"],
            "grade": row["grade"],
            "created_at": row["created_at"],
            "total_students": report.get("total_students", 0),
            "accuracy": report.get("accuracy")
        })

    return jsonify({"assessments": reports})


# ==================================================
# LEARNING INSIGHTS: GET ONE REPORT
# ==================================================

@app.route("/api/assessments/<int:assessment_id>", methods=["GET"])
@login_required
def get_assessment(assessment_id):
    with get_db() as connection:
        row = connection.execute(
            """
            SELECT id, report_json
            FROM assessments
            WHERE id = ? AND user_id = ?
            """,
            (assessment_id, session["user_id"])
        ).fetchone()

    if row is None:
        return jsonify({
            "error": "Assessment report not found."
        }), 404

    try:
        report = json.loads(row["report_json"])
    except (ValueError, TypeError):
        return jsonify({
            "error": "The saved report is invalid."
        }), 500

    report["id"] = row["id"]
    return jsonify(report)


# ==================================================
# START SERVER
# ==================================================

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
