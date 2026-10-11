
import streamlit as st
import pandas as pd

st.set_page_config(
    page_title="TeachSense AI",
    page_icon="📚",
    layout="wide"
)

# ---------- TITLE ----------
st.title("📚 TeachSense AI")
st.subheader("AI Classroom Insight & Lesson Copilot")
st.info("Demo mode: All student data is fictional.")

# ---------- LOCAL LEARNING RULES ----------
def detect_misconception(question_id, answer):
    qid = str(question_id).strip().upper()
    ans = str(answer).strip()

    if qid == "Q1" and ans == "20":
        return {
            "label": "ORDER_OF_OPERATIONS",
            "confidence": 0.85,
            "reason": (
                "Answer 20 is consistent with adding "
                "before multiplying in 2 + 3 × 4."
            )
        }

    if qid == "Q2" and ans == "24":
        return {
            "label": "ORDER_OF_OPERATIONS",
            "confidence": 0.80,
            "reason": (
                "This answer may indicate confusion "
                "about the order of operations."
            )
        }

    if qid == "Q3" and ans == "18":
        return {
            "label": "NO_MISCONCEPTION",
            "confidence": 1.0,
            "reason": "Answer matches the correct answer."
        }

    return {
        "label": "UNCERTAIN",
        "confidence": 0.0,
        "reason": (
            "No known pattern explains this answer. "
            "Teacher review is required."
        )
    }


# ---------- TEACHING MATERIAL ----------
def generate_lesson(label):
    if label == "ORDER_OF_OPERATIONS":
        return {
            "explanation": (
                "Multiplication and division are performed "
                "before addition and subtraction, unless "
                "brackets change the order."
            ),
            "activity": (
                "Solve five expressions step by step. "
                "Ask students to explain their reasoning."
            ),
            "questions": [
                "3 + 2 * 5",
                "8 + 4 * 2",
                "20 - 3 * 4"
            ]
        }

    if label == "BRACKET_CONFUSION":
        return {
            "explanation": (
                "Calculate expressions inside brackets first."
            ),
            "activity": (
                "Compare expressions with and without brackets."
            ),
            "questions": [
                "(2 + 3) * 4",
                "3 * (4 + 2)",
                "(10 - 2) * 3"
            ]
        }

    return {
        "explanation": (
            "The learning difficulty is unclear. "
            "Ask the student to explain their working."
        ),
        "activity": (
            "Review the student's solution and identify "
            "the step where the error occurred."
        ),
        "questions": []
    }


# ---------- NAVIGATION ----------
page = st.sidebar.radio(
    "Teacher Menu",
    [
        "Dashboard",
        "Assessment Analysis",
        "Lesson Copilot",
        "Progress Report"
    ]
)

# Fictional demonstration data
demo = pd.DataFrame([
    {"student_id": "S01", "question_id": "Q1", "answer": "20"},
    {"student_id": "S01", "question_id": "Q2", "answer": "4"},
    {"student_id": "S02", "question_id": "Q1", "answer": "14"},
    {"student_id": "S02", "question_id": "Q2", "answer": "24"},
    {"student_id": "S03", "question_id": "Q1", "answer": "20"},
    {"student_id": "S03", "question_id": "Q3", "answer": "18"},
    {"student_id": "S04", "question_id": "Q1", "answer": "14"},
    {"student_id": "S04", "question_id": "Q2", "answer": "24"}
])

answer_key = {
    "Q1": "14",
    "Q2": "4",
    "Q3": "18"
}

# ---------- DASHBOARD ----------
if page == "Dashboard":
    st.header("Classroom Dashboard")

    c1, c2, c3 = st.columns(3)
    c1.metric("Demo Students", "4")
    c2.metric("Assessment Questions", "3")
    c3.metric("Misconception Types", "2")

    st.write(
        "Use Assessment Analysis to examine responses "
        "and Lesson Copilot to prepare revision material."
    )

# ---------- ASSESSMENT ----------
elif page == "Assessment Analysis":
    st.header("Assessment Analysis")

    uploaded = st.file_uploader(
        "Upload responses CSV (optional)",
        type=["csv"]
    )

    if uploaded is not None:
        data = pd.read_csv(uploaded)
    else:
        st.caption("Showing fictional demo responses.")
        data = demo.copy()

    st.write("Student responses")
    st.dataframe(data, use_container_width=True)

    required = {"student_id", "question_id", "answer"}

    if not required.issubset(data.columns):
        st.error(
            "CSV must contain student_id, question_id, answer."
        )
    else:
        results = []
        unmatched = []

        for _, row in data.iterrows():
            student = row["student_id"]
            qid = str(row["question_id"]).strip().upper()
            answer = row["answer"]

            if pd.isna(student) or str(student).strip() == "":
                unmatched.append({
                    "student_id": student,
                    "question_id": qid,
                    "answer": answer,
                    "reason": "Missing student ID"
                })
                continue

            if qid not in answer_key:
                unmatched.append({
                    "student_id": student,
                    "question_id": qid,
                    "answer": answer,
                    "reason": "Unknown question ID"
                })
                continue

            correct = str(answer).strip().casefold() == (
                answer_key[qid].casefold()
            )

            if correct:
                insight = {
                    "label": "NO_MISCONCEPTION",
                    "confidence": 1.0,
                    "reason": "Answer matches the answer key."
                }
            elif pd.isna(answer) or str(answer).strip() == "":
                insight = {
                    "label": "UNCERTAIN",
                    "confidence": 0.0,
                    "reason": "Student answer is missing."
                }
            else:
                insight = detect_misconception(qid, answer)

            results.append({
                "student_id": student,
                "question_id": qid,
                "answer": answer,
                "correct_answer": answer_key[qid],
                "correct": correct,
                "misconception": insight["label"],
                "confidence": insight["confidence"],
                "evidence": insight["reason"],
                "needs_teacher_review": (
                    not correct
                )
            })

        result_df = pd.DataFrame(results)

        st.subheader("Analysis results")
        st.dataframe(result_df, use_container_width=True)

        if not result_df.empty:
            accuracy = result_df["correct"].mean() * 100
            st.metric("Response Accuracy", f"{accuracy:.1f}%")

            st.download_button(
                "Download Analysis CSV",
                result_df.to_csv(index=False),
                file_name="teachsense_analysis.csv",
                mime="text/csv"
            )

        st.subheader("Unmatched responses")
        if unmatched:
            st.warning(
                "These records need correction. They were not discarded."
            )
            st.dataframe(pd.DataFrame(unmatched))
        else:
            st.success("No unmatched responses.")

        st.caption(
            "Misconception labels are suggestions, not diagnoses. "
            "Confidence scores are illustrative and not calibrated "
            "probabilities. Teacher review is required."
        )

# ---------- LESSON COPILOT ----------
elif page == "Lesson Copilot":
    st.header("AI Lesson Copilot")
    st.write("Create a revision-material draft for teacher review.")

    label = st.selectbox(
        "Choose a learning need",
        [
            "ORDER_OF_OPERATIONS",
            "BRACKET_CONFUSION",
            "UNCERTAIN"
        ]
    )

    lesson = generate_lesson(label)

    st.subheader("Explanation draft")
    st.write(lesson["explanation"])

    st.subheader("Revision activity draft")
    st.write(lesson["activity"])

    st.subheader("Follow-up questions")
    for i, question in enumerate(lesson["questions"], 1):
        st.write(f"{i}. {question}")

    st.warning("Draft only — not approved for students.")

    if "approved_lessons" not in st.session_state:
        st.session_state.approved_lessons = []

    if st.button("Approve this lesson"):
        if label not in st.session_state.approved_lessons:
            st.session_state.approved_lessons.append(label)
        st.success("Teacher approval recorded for this session.")

    if label in st.session_state.approved_lessons:
        st.success("Status: Approved by teacher.")

    st.caption(
        "Approval is stored for this app session only. "
        "This prototype does not publish lessons to students."
    )

# ---------- PROGRESS ----------
elif page == "Progress Report":
    st.header("Progress Report")

    st.write(
        "This section will compare an initial assessment "
        "with a follow-up assessment."
    )

    st.info(
        "Next development task: upload both assessments, "
        "match students and questions, and compare accuracy "
        "with the number of students included."
    )

st.divider()
st.caption(
    "TeachSense AI | Educational support tool | "
    "All demonstration data is fictional."
)
