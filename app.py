
import os
import json
import urllib.request
import urllib.error
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
app = Flask(__name__)


# ---------- WEBSITE PAGES ----------
@app.route("/")
def home():
    return send_from_directory(str(BASE_DIR), "index.html")


@app.route("/<path:filename>")
def website_files(filename):
    # Serves the existing HTML, CSS, JavaScript and other frontend files.
    return send_from_directory(str(BASE_DIR), filename)


# ---------- LOCAL CHAT FALLBACK ----------
def local_teaching_reply(message):
    """Helpful demo response when no AI API key is configured."""
    text = message.lower().strip()

    if not text:
        return "Please enter a question so I can help."

    if any(word in text for word in ["quiz", "multiple-choice", "mcq"]):
        return (
            "Here is a simple quiz template you can adapt:\n\n"
            "1. What is the main idea of this topic?\n"
            "   A) Option A  B) Option B  C) Option C  D) Option D\n"
            "2. Give one real-life example of the topic.\n"
            "3. Explain the concept in your own words.\n\n"
            "Please tell me the subject, topic and grade to create "
            "specific questions with an answer key."
        )

    if any(word in text for word in ["activity", "activities", "classroom"]):
        return (
            "Try this classroom activity:\n\n"
            "1. Introduce the topic using a familiar real-life example.\n"
            "2. Ask students to predict what will happen.\n"
            "3. Let pairs solve a short task or discuss an example.\n"
            "4. Ask each pair to explain their reasoning.\n"
            "5. Finish with an individual exit question.\n\n"
            "Tell me the subject, topic and grade for a tailored activity."
        )

    if any(word in text for word in ["misconception", "misunderstand", "learning gap"]):
        return (
            "To investigate a possible misconception:\n\n"
            "1. Collect several student answers to the same question.\n"
            "2. Group answers that show similar reasoning.\n"
            "3. Ask students to explain how they reached their answers.\n"
            "4. Use a follow-up question to check the pattern.\n"
            "5. Choose a targeted explanation or worked example.\n\n"
            "An incorrect answer alone does not prove a misconception. "
            "A teacher should review the evidence."
        )

    if any(word in text for word in ["photosynthesis", "plants make food"]):
        return (
            "Photosynthesis is the process by which green plants use "
            "sunlight, water and carbon dioxide to make glucose (food). "
            "Oxygen is released during this process.\n\n"
            "A simple summary is:\n"
            "Carbon dioxide + water + light energy -> glucose + oxygen\n\n"
            "Class activity: let students identify the sunlight, water "
            "and carbon dioxide a plant needs. Ask them to explain why "
            "a plant kept in darkness may grow poorly."
        )

    if any(word in text for word in ["explain", "simple language", "example"]):
        return (
            "I can help prepare a student-friendly explanation, but this "
            "local demo mode does not have a full language model connected.\n\n"
            "For a more accurate explanation, tell me the subject, exact "
            "topic and grade. You can also configure an AI API key to enable "
            "open-ended answers."
        )

    return (
        "I received your question, but the local demo cannot reliably "
        "answer every subject or open-ended question without a language "
        "model. Add an AI API key to enable broader answers. Meanwhile, "
        "try asking for a quiz, classroom activity, photosynthesis "
        "explanation, or misconception-checking strategy."
    )


# ---------- OPTIONAL REAL AI ----------
def ask_openai(messages):
    """
    Uses the OpenAI API if OPENAI_API_KEY is configured.
    The key must be stored as an environment variable, never in frontend code.
    """
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        return None

    payload = {
        "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are TeachSense AI, a careful teaching assistant. "
                    "Give useful, accurate, student-friendly educational "
                    "answers. Adapt to the subject, grade and requested "
                    "format. Use headings and examples when helpful. For "
                    "quizzes, include an answer key. For lesson activities, "
                    "include steps and materials. If a question is ambiguous, "
                    "ask a brief clarifying question. Do not invent facts. "
                    "Treat student misconceptions as hypotheses that teachers "
                    "must verify, not diagnoses. Be clear when uncertain."
                )
            }
        ] + messages,
        "temperature": 0.5
    }

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=45) as response:
        result = json.loads(response.read().decode("utf-8"))

    return result["choices"][0]["message"]["content"].strip()


# ---------- CHAT API ----------
@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}

    message = data.get("message") or data.get("prompt") or ""
    if not isinstance(message, str) or not message.strip():
        return jsonify({
            "error": "Please enter a question before sending."
        }), 400

    # Keep only a limited amount of conversation history.
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

    if os.getenv("OPENAI_API_KEY"):
        try:
            reply = ask_openai(messages)
            if reply:
                return jsonify({
                    "reply": reply,
                    "response": reply,
                    "mode": "ai"
                })
        except urllib.error.HTTPError as exc:
            app.logger.error("AI API returned HTTP %s", exc.code)
            if exc.code in (401, 403):
                return jsonify({
                    "error": (
                        "The AI API key was rejected. Check the key and "
                        "account API access in your hosting settings."
                    )
                }), 502
            if exc.code == 429:
                return jsonify({
                    "error": (
                        "The AI service rate limit or quota was reached. "
                        "Check your API account and billing limits."
                    )
                }), 502
            return jsonify({
                "error": "The AI service returned an error. Please try again."
            }), 502
        except (urllib.error.URLError, TimeoutError, KeyError, ValueError):
            app.logger.exception("AI request failed")
            return jsonify({
                "error": (
                    "Could not get a response from the AI service. "
                    "Check the server internet connection and try again."
                )
            }), 502

    reply = local_teaching_reply(message)
    return jsonify({
        "reply": reply,
        "response": reply,
        "mode": "local-demo"
    })


# ---------- EXISTING ASSESSMENT ENDPOINT ----------
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
        return jsonify({"error": "All fields must contain text."}), 400

    try:
        from insights import analyze_answer
        result = analyze_answer(question, student_answer, correct_answer)
        return jsonify(result)
    except Exception:
        app.logger.exception("Answer analysis failed")
        return jsonify({
            "error": "Unable to analyze this answer."
        }), 500


@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "ai_configured": bool(os.getenv("OPENAI_API_KEY"))
    })


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=int(os.getenv("PORT", "5000")),
        debug=False
    )
