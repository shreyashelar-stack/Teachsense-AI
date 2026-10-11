
from flask import Flask, request, jsonify, send_from_directory
from datetime import datetime
import os
import re

app = Flask(__name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Temporary report storage for the local demo.
# Reports remain available until the server restarts.
assessments = []
next_report_id = 1


# ---------------- WEBSITE PAGES ----------------

@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:filename>")
def website_files(filename):
    # Prevent access to files outside the project folder.
    safe_path = os.path.abspath(os.path.join(BASE_DIR, filename))

    if not safe_path.startswith(BASE_DIR + os.sep):
        return "Invalid path", 403

    if not os.path.isfile(safe_path):
        return "File not found", 404

    return send_from_directory(BASE_DIR, filename)


# ---------------- HELPER FUNCTIONS ----------------

def clean_text(value, limit=3000):
    if not isinstance(value, str):
        return ""
    return value.strip()[:limit]


def normalize(value):
    value = clean_text(value).lower()
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", value)).strip()


# ---------------- HEALTH CHECK ----------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "success": True,
        "application": "TeachSense AI",
        "mode": "local-demo"
    })


# ---------------- ASSESSMENT ANALYSIS ----------------

@app.route("/api/analyze", methods=["POST"])
def analyze():
    global next_report_id

    data = request.get_json(silent=True) or {}

    topic = clean_text(data.get("topic"), 250)
    grade = clean_text(data.get("grade") or data.get("level"), 100)
    question = clean_text(data.get("question"), 1500)
    correct_answer = clean_text(
        data.get("correctAnswer") or data.get("correct_answer"), 1500
    )
    context = clean_text(
        data.get("teacherContext") or data.get("context"), 1500
    )

    # Accept either studentAnswers or studentAnswer.
    answers = data.get("studentAnswers", data.get("studentAnswer", []))
    ids = data.get("studentIds", data.get("studentId", []))

    # Also accept responses as a list of answer objects.
    if isinstance(data.get("responses"), list):
        response_items = data["responses"]

        if response_items and isinstance(response_items[0], dict):
            answers = [item.get("answer", "") for item in response_items]
            ids = [
                item.get("id", f"Response {i + 1}")
                for i, item in enumerate(response_items)
            ]
        elif response_items:
            answers = response_items

    if not topic or not question or not correct_answer:
        return jsonify({
            "error": "Topic, question and correct answer are required."
        }), 400

    if isinstance(answers, str):
        answers = [answers]

    if not isinstance(answers, list):
        return jsonify({"error": "Student answers must be a list."}), 400

    if len(answers) > 100:
        return jsonify({"error": "Maximum 100 responses per assessment."}), 400

    if not isinstance(ids, list):
        ids = [ids]

    results = []

    for index, raw_answer in enumerate(answers):
        answer = clean_text(raw_answer, 1500)
        answer_matches = (
            bool(answer)
            and normalize(answer) == normalize(correct_answer)
        )

        if not answer:
            status = "No answer provided"
            suggestion = "Offer another opportunity to respond."
        elif answer_matches:
            status = "Matches expected answer"
            suggestion = (
                "Ask a follow-up question to check deeper understanding."
            )
        else:
            status = "Needs teacher review"
            suggestion = (
                "Ask the student to explain their reasoning. "
                "Use a worked example and a short follow-up question."
            )

            topic_lower = topic.lower()
            answer_lower = answer.lower()

            if "photosynthesis" in topic_lower and (
                "soil" in answer_lower or "roots" in answer_lower
            ):
                status = "Possible misconception: plant food"
                suggestion = (
                    "Use a diagram to explain how plants make food "
                    "using light, water and carbon dioxide."
                )

            elif "fraction" in topic_lower:
                status = "Possible fraction misunderstanding"
                suggestion = (
                    "Use fraction strips or shaded diagrams, then "
                    "ask the student to compare a new pair of fractions."
                )

        results.append({
            "studentId": f"Response {index + 1}",
            "answer": answer,
            "status": status,
            "suggestion": suggestion,
            "matchesExpectedAnswer": answer_matches
        })

    total = len(results)
    matched = sum(
        1 for item in results if item["matchesExpectedAnswer"]
    )

    report = {
        "id": next_report_id,
        "topic": topic,
        "grade": grade,
        "question": question,
        "correctAnswer": correct_answer,
        "teacherContext": context,
        "createdAt": datetime.now().isoformat(timespec="seconds"),
        "totalResponses": total,
        "matchingResponses": matched,
        "matchRate": round(matched / total * 100, 1) if total else 0,
        "results": results,
        "summary": (
            f"Reviewed {total} response(s); "
            f"{matched} exactly match the expected answer."
        ),
        "limitations": (
            "This local demo uses text matching and simple rules. "
            "Alternative correct answers may be flagged. "
            "Review suggestions before acting on them."
        )
    }

    assessments.append(report)
    next_report_id += 1

    return jsonify({
        "success": True,
        "report": report,
        "analysis": report,
        "insights": results
    })


# ---------------- REPORTS ----------------

@app.route("/api/assessments", methods=["GET"])
def get_assessments():
    return jsonify({
        "success": True,
        "assessments": assessments
    })


@app.route("/api/assessments/<int:report_id>", methods=["GET"])
def get_assessment(report_id):
    for report in assessments:
        if report["id"] == report_id:
            return jsonify({
                "success": True,
                "report": report
            })

    return jsonify({"error": "Report not found."}), 404


# ---------------- LESSON PLANNER ----------------

@app.route("/api/lesson-plan", methods=["POST"])
def create_lesson_plan():
    data = request.get_json(silent=True) or {}

    topic = clean_text(data.get("topic"), 250)
    grade = clean_text(data.get("grade") or data.get("level"), 100)
    duration = clean_text(data.get("duration"), 50) or "45 minutes"
    goals = clean_text(
        data.get("learningGoal") or data.get("learning_goal"), 1500
    )
    needs = clean_text(
        data.get("learningNeeds") or data.get("learning_needs"), 1500
    )
    resources = clean_text(data.get("resources"), 500) or "Board and notebook"

    if not topic or not goals:
        return jsonify({
            "error": "Enter a topic and learning objectives."
        }), 400

    plan = f"""
TEACHSENSE AI — LESSON PLAN

Topic: {topic}
Class: {grade or "Not specified"}
Duration: {duration}

1. LEARNING OBJECTIVES
{goals}

2. INTRODUCTION
Introduce {topic} with a familiar example or opening question.

3. EXPLANATION
Explain the main concepts step by step. Demonstrate one example
and check understanding during the explanation.

4. GUIDED PRACTICE
Solve an example with the class. Ask students to explain their reasoning.

5. INDEPENDENT PRACTICE
Give students a short task related to {topic}.

6. QUICK ASSESSMENT
Ask two or three questions aligned with the learning objectives.

7. STUDENT SUPPORT
{needs or "No specific learning needs provided."}

Use additional examples or visual explanations where appropriate.
Confirm learning needs through classroom evidence.

8. RESOURCES
{resources}

9. TEACHER REFLECTION
Review student responses and decide which concepts need revision.

Teacher review is required before using this draft in class.
""".strip()

    return jsonify({
        "success": True,
        "lessonPlan": plan,
        "lesson_plan": plan,
        "content": plan,
        "mode": "local-demo"
    })


# ---------------- TEACHING ASSISTANT ----------------

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    message = clean_text(data.get("message") or data.get("prompt"), 3000)

    if not message:
        return jsonify({"error": "Enter a message first."}), 400

    lower_message = message.lower()

    if "photosynthesis" in lower_message:
        reply = (
            "Photosynthesis is how green plants use light, water and "
            "carbon dioxide to make food. Try a plant diagram activity "
            "and ask students to label the inputs and outputs."
        )
    elif "quiz" in lower_message:
        reply = (
            "To create a useful quiz, align each question with a learning "
            "objective. Include recall, application and explanation questions. "
            "Tell me the topic and class level for more specific examples."
        )
    elif "misconception" in lower_message:
        reply = (
            "Ask the student to explain their reasoning, compare two "
            "examples and answer a follow-up question. One incorrect answer "
            "is not enough to establish a persistent misconception."
        )
    elif "fraction" in lower_message:
        reply = (
            "Use paper strips or shaded shapes to show fractions visually. "
            "Ask students to compare two fractions and explain their choice."
        )
    else:
        reply = (
            "Try this teaching sequence: state the learning objective, "
            "explain the concept with a real-life example, demonstrate a "
            "worked example, provide guided practice, and finish with a "
            "short question to check understanding. Add your topic and "
            "class level for a more focused suggestion."
        )

    return jsonify({
        "success": True,
        "reply": reply,
        "response": reply,
        "mode": "local-demo"
    })


# ---------------- START SERVER ----------------

if __name__ == "__main__":
    print("TeachSense AI is starting...")
    print("Open http://127.0.0.1:5000 in your browser.")

    app.run(host="127.0.0.1", port=5000, debug=True)
