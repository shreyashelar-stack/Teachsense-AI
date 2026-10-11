
import os
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory
from google import genai

BASE_DIR = Path(__file__).resolve().parent
app = Flask(__name__)


# ---------- WEBSITE PAGES ----------

@app.route("/")
def home():
    return send_from_directory(str(BASE_DIR), "index.html")


@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "ai_configured": bool(os.getenv("GEMINI_API_KEY"))
    })


@app.route("/<path:filename>")
def website_files(filename):
    # Only serve files inside the project directory.
    return send_from_directory(str(BASE_DIR), filename)


# ---------- LOCAL FALLBACK ----------

def local_teaching_reply(message):
    text = message.lower().strip()

    if not text:
        return "Please enter a question."

    if "photosynthesis" in text:
        return (
            "Photosynthesis is the process by which green plants use "
            "sunlight, water and carbon dioxide to make glucose. "
            "Oxygen is released during this process."
        )

    if any(word in text for word in ["quiz", "mcq", "multiple-choice"]):
        return (
            "I can help create a quiz. Please specify the subject, "
            "topic and grade level."
        )

    if any(word in text for word in ["lesson plan", "lesson"]):
        return (
            "A lesson plan can include learning objectives, materials, "
            "an introduction, teaching activities, assessment and a "
            "conclusion. Tell me the subject and grade level."
        )

    return (
        "TeachSense AI is temporarily unable to contact Gemini. "
        "Please try again shortly."
    )


# ---------- GEMINI AI ----------

def ask_gemini(messages):
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is missing from the server environment."
        )

    system_prompt = """
You are TeachSense AI, a helpful AI teaching assistant.

Your job is to help teachers:
- Explain topics in simple language.
- Create quizzes and classroom activities.
- Suggest ways to address possible student misconceptions.
- Prepare lesson plans and examples.
- Adapt explanations to a student's grade level.

Be friendly, clear and accurate.
Use examples and headings when helpful.
Include answer keys when creating quizzes.
Do not judge a student based on one answer.
"""

    conversation = []

    for item in messages[-12:]:
        if not isinstance(item, dict):
            continue

        role = item.get("role", "user")
        content = item.get("content", "")

        if role not in ("user", "assistant"):
            continue

        if not isinstance(content, str) or not content.strip():
            continue

        speaker = "Teacher" if role == "user" else "TeachSense AI"
        conversation.append(f"{speaker}: {content[:6000]}")

    if not conversation:
        raise ValueError("No valid message was provided.")

    prompt = system_prompt + "\n\n" + "\n\n".join(conversation)

    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        contents=prompt
    )

    answer = response.text

    if not answer:
        raise RuntimeError("Gemini returned an empty response.")

    return answer.strip()


# ---------- CHAT API ----------

@app.route("/api/chat", methods=["POST"])
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

    # Keep only recent messages.
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
        # Do not send secret keys or technical details to the browser.
        app.logger.error(
            "Gemini request failed: %s: %s",
            type(error).__name__,
            str(error)
        )

        return jsonify({
            "reply": local_teaching_reply(message),
            "response": local_teaching_reply(message),
            "mode": "fallback",
            "error": (
                "Gemini is temporarily unavailable. "
                "Please try again."
            )
        }), 200


# ---------- EXISTING ANSWER ANALYSIS ----------

@app.route("/analyze", methods=["POST"])
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


# ---------- START SERVER ----------

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
