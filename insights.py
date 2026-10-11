
"""
TeachSense AI
Member 3: AI & Learning Insights

Features:
1. Analyze student answers
2. Detect common misconceptions
3. Generate teaching suggestions
4. Recommend practice questions
5. Work offline using Python rules
"""

from fractions import Fraction


def analyze_answer(question, student_answer, correct_answer):
    """
    Analyze a student's answer and return learning insights.
    """

    question = question.strip()
    student_answer = student_answer.strip()
    correct_answer = correct_answer.strip()

    # Validate inputs
    if not question or not student_answer or not correct_answer:
        return {
            "status": "error",
            "message": "Question, student answer, and correct answer are required."
        }

    # Check whether this is a supported fraction question
    if "/" not in question or "+" not in question:
        return {
            "status": "unsupported",
            "is_correct": None,
            "misconception": "Not identified",
            "explanation": "This version supports fraction addition questions.",
            "teaching_suggestion": "Add a rule for this question type.",
            "practice_question": "Calculate 1/4 + 1/2.",
            "confidence": "not applicable",
            "method": "local_rule"
        }

    try:
        # Example question format: 1/2 + 1/3
        parts = question.split("+")

        if len(parts) != 2:
            raise ValueError("Invalid question format.")

        first_fraction = Fraction(parts[0].strip())
        second_fraction = Fraction(parts[1].strip())
        expected_answer = Fraction(correct_answer)
        student_value = Fraction(student_answer)

        # Verify the supplied correct answer
        calculated_answer = first_fraction + second_fraction

        if calculated_answer != expected_answer:
            return {
                "status": "error",
                "message": "The supplied correct answer does not match the question."
            }

    except (ValueError, ZeroDivisionError):
        return {
            "status": "error",
            "message": "Invalid fraction format. Example: 1/2 + 1/3, answer: 5/6."
        }

    # Case 1: Student answered correctly
    if student_value == expected_answer:
        return {
            "status": "success",
            "is_correct": True,
            "misconception": None,
            "explanation": "The student correctly added the fractions.",
            "teaching_suggestion": (
                "Introduce a slightly more challenging fraction problem."
            ),
            "practice_question": "Calculate 2/3 + 1/6.",
            "confidence": "high",
            "method": "local_rule"
        }

    # Case 2: Detect direct addition of numerators and denominators
    direct_answer = Fraction(
        first_fraction.numerator + second_fraction.numerator,
        first_fraction.denominator + second_fraction.denominator
    )

    if student_value == direct_answer:
        return {
            "status": "success",
            "is_correct": False,
            "misconception": (
                "Direct addition of numerators and denominators"
            ),
            "explanation": (
                "The student appears to add both numerators and denominators "
                "directly. Fractions must have a common denominator before "
                "their numerators are added."
            ),
            "teaching_suggestion": (
                "Use fraction strips or visual diagrams to demonstrate "
                "equivalent fractions and common denominators."
            ),
            "practice_question": "Calculate 1/4 + 1/2.",
            "confidence": "high",
            "method": "local_rule"
        }

    # Case 3: Incorrect answer without a known pattern
    return {
        "status": "success",
        "is_correct": False,
        "misconception": "Unknown or unclassified error",
        "explanation": (
            "The answer is incorrect, but the system cannot confidently "
            "identify the student's reasoning from the answer alone."
        ),
        "teaching_suggestion": (
            "Ask the student to explain their calculation, then review "
            "equivalent fractions and common denominators if needed."
        ),
        "practice_question": "Calculate 1/3 + 1/6.",
        "confidence": "low",
        "method": "local_rule"
    }


def display_result(result):
    """Display learning insights in a readable format."""

    print("\n" + "=" * 45)
    print("       TEACHSENSE AI LEARNING INSIGHTS")
    print("=" * 45)

    for key, value in result.items():
        print(f"{key.replace('_', ' ').title()}: {value}")

    print("=" * 45)


def main():
    print("\nWelcome to TeachSense AI")
    print("Student Misconception Detection System\n")

    question = input("Enter question (example: 1/2 + 1/3): ")
    student_answer = input("Enter student's answer (example: 2/5): ")
    correct_answer = input("Enter correct answer (example: 5/6): ")

    result = analyze_answer(
        question,
        student_answer,
        correct_answer
    )

    display_result(result)


if __name__ == "__main__":
    main()
