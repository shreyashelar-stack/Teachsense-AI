
import os
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory
from google import genai

app = Flask(__name__)
BASE_DIR = Path(__file__).resolve().parent


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
def serve_file(filename):
    # Serve website files, but never expose environment variables.
    return send_from_directory(str(BASE_DIR), filename)


def ask_gemini(messages):
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is missing in Render Environment."
        )

    client = genai.Client(api_key=api_key)

    system_prompt = """
You are TeachSense AI, a helpful AI teaching assistant.

Your job is to help teachers:
- Explain topics in simple language.
- Create quizzes and classroom activities.
- Suggest ways to address possible student misconceptions.
- Prepare lesson plans and examples.
- Adapt explanations to a student's grade level.

Be friendly, clear, and accurate.
Do not label or judge a student based on one answer.
"""

    conversation = []

    for item in messages[-12:]:
        role = item.get("role", "user")
        content = item.get("content", "")

        if not isinstance(content, str) or not content.strip():
            continue

        speaker = "Teacher" if role == "user" else "TeachSense AI"
        conversation.append(f"{speaker}: {content}")

    prompt = system_prompt + "\n\n" + "\n\n".join(conversation)

    response = client.models.generate_content(
        model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
        contents=prompt
    )

    answer = response.text

    if not answer:
        raise RuntimeError("Gemini returned an empty response.")

    return answer


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}

    message = data.get("message") or data.get("prompt") or ""
    history = data.get("history", [])

    if not isinstance(message, str) or not message.strip():
        return jsonify({
            "error": "Please enter a message.",
            "reply": "Please enter a message."
        }), 400

    if not isinstance(history, list):
        history = []

    messages = history[-12:] + [
        {"role": "user", "content": message.strip()}
    ]

    try:
        reply = ask_gemini(messages)

        return jsonify({
            "reply": reply,
            "response": reply,
            "mode": "ai"
        })

    except Exception as error:
        # Keep the secret API key out of error messages.
        print("Gemini request failed:", type(error).__name__, str(error))

        return jsonify({
            "error": (
                "The AI request failed. Check your Gemini API key, "
                "model availability, usage limits, and Render logs."
            ),
            "reply": (
                "Sorry, I couldn't get an AI response. "
                "Please check the Gemini API settings and try again."
            ),
            "mode": "error"
        }), 502


@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        from insights import analyze_answer

        data = request.get_json(silent=True) or {}
        result = analyze_answer(data)

        return jsonify(result)

    except Exception as error:
        print("Analysis failed:", type(error).__name__, str(error))
        return jsonify({
            "error": "Analysis failed. Check the server logs."
        }), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
