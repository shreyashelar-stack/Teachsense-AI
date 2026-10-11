
"use strict";

/* =========================================================
   TEACHSENSE AI — PREMIUM JAVASCRIPT
   Assessment | Insights | Lesson Plans | AI Chat | Dashboard
   ========================================================= */

const API = {
    analyze: "/api/analyze",
    assessments: "/api/assessments",
    lessonPlan: "/api/lesson-plan",
    chat: "/api/chat",
    health: "/api/health"
};

/* -------------------- DOM HELPERS -------------------- */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function getValue(object, keys, fallback = "") {
    for (const key of keys) {
        if (object && object[key] != null) return object[key];
    }
    return fallback;
}

function setMessage(element, text, type = "info") {
    if (!element) return;

    element.textContent = text;
    element.className = `ts-message ts-message-${type}`;
    element.setAttribute("role", type === "error" ? "alert" : "status");
    element.hidden = false;
}

function setLoading(button, loading, text = "Processing...") {
    if (!button) return;

    if (loading) {
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }

        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        button.textContent = text;
    } else {
        button.disabled = false;
        button.removeAttribute("aria-busy");

        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }
}

/* -------------------- API REQUESTS -------------------- */

async function apiRequest(url, options = {}) {
    const headers = new Headers(options.headers || {});

    if (options.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: "same-origin"
    });

    const contentType = response.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
        data = await response.json();
    } else {
        const body = await response.text();
        data = { error: body || `Server error (${response.status})` };
    }

    if (!response.ok || data.success === false) {
        throw new Error(
            data.error || data.message || `Request failed (${response.status})`
        );
    }

    return data;
}

/* -------------------- PREMIUM RESULT DISPLAY -------------------- */

function createResultCard(title, content) {
    const card = document.createElement("section");
    card.className = "ts-result-card";

    const heading = document.createElement("h3");
    heading.className = "ts-result-heading";
    heading.textContent = title;

    const body = document.createElement("div");
    body.className = "ts-result-body";

    if (Array.isArray(content)) {
        const list = document.createElement("ul");

        content.forEach(item => {
            const li = document.createElement("li");
            li.textContent = typeof item === "object"
                ? JSON.stringify(item)
                : String(item);
            list.appendChild(li);
        });

        body.appendChild(list);
    } else if (content && typeof content === "object") {
        Object.entries(content).forEach(([key, value]) => {
            const row = document.createElement("div");
            row.className = "ts-result-row";

            const label = document.createElement("strong");
            label.textContent = key
                .replace(/([A-Z])/g, " $1")
                .replace(/[_-]/g, " ");

            const detail = document.createElement("p");
            detail.textContent = typeof value === "object" && value !== null
                ? JSON.stringify(value, null, 2)
                : String(value ?? "");

            row.append(label, detail);
            body.appendChild(row);
        });
    } else {
        const paragraph = document.createElement("p");
        paragraph.textContent = String(content ?? "");
        body.appendChild(paragraph);
    }

    card.append(heading, body);
    return card;
}

function renderResult(container, result) {
    if (!container) return;

    container.replaceChildren();

    const heading = document.createElement("h2");
    heading.className = "ts-results-title";
    heading.textContent = "Your Results";
    container.appendChild(heading);

    if (typeof result === "string") {
        container.appendChild(createResultCard("Analysis", result));
        return;
    }

    if (!result || typeof result !== "object") {
        container.appendChild(createResultCard("Analysis", result));
        return;
    }

    const sections = Object.entries(result);

    if (sections.length === 0) {
        container.appendChild(createResultCard("Analysis", "No results available."));
        return;
    }

    sections.forEach(([key, value]) => {
        const title = key
            .replace(/([A-Z])/g, " $1")
            .replace(/[_-]/g, " ")
            .replace(/^./, char => char.toUpperCase());

        container.appendChild(createResultCard(title, value));
    });
}

/* =========================================================
   1. ASSESSMENT PAGE
   ========================================================= */

function initializeAssessment() {
    const form = $("#assessmentForm");
    if (!form || form.dataset.premiumReady) return;

    form.dataset.premiumReady = "true";

    const rowsContainer = $("#responseRows");
    const addButton = $("#addResponse");
    const sampleButton = $("#loadSamples");
    const submitButton = $("#analyzeSubmit");
    const message = $("#assessmentMessage");
    const output = $("#analysisPreview");

    function addStudentRow(studentId = "", answer = "") {
        if (!rowsContainer) return;

        if ($$(".response-row", rowsContainer).length >= 100) {
            setMessage(message, "Maximum 100 student responses allowed.", "error");
            return;
        }

        const row = document.createElement("div");
        row.className = "response-row ts-response-card";

        const idLabel = document.createElement("label");
        idLabel.textContent = "Student ID or Name";

        const idInput = document.createElement("input");
        idInput.type = "text";
        idInput.name = "studentId[]";
        idInput.placeholder = "e.g. Student 1";
        idInput.value = studentId;

        const answerLabel = document.createElement("label");
        answerLabel.textContent = "Student Answer";

        const answerInput = document.createElement("textarea");
        answerInput.name = "studentAnswer[]";
        answerInput.rows = 3;
        answerInput.placeholder = "Enter the student's answer";
        answerInput.value = answer;

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-response";
        removeButton.textContent = "Remove";

        removeButton.addEventListener("click", () => {
            const allRows = $$(".response-row", rowsContainer);

            if (allRows.length <= 1) {
                idInput.value = "";
                answerInput.value = "";
                setMessage(message, "The last response row has been cleared.", "info");
                return;
            }

            row.remove();
        });

        idLabel.appendChild(idInput);
        answerLabel.appendChild(answerInput);
        row.append(idLabel, answerLabel, removeButton);
        rowsContainer.appendChild(row);
    }

    /*
     * If the HTML already contains a response row, leave it intact.
     * Otherwise, create the first row.
     */
    if (
        rowsContainer &&
        !$$('[name="studentAnswer[]"]', rowsContainer).length
    ) {
        addStudentRow();
    }

    if (addButton) {
        addButton.addEventListener("click", () => addStudentRow());
    }

    if (sampleButton) {
        sampleButton.addEventListener("click", () => {
            if (!rowsContainer) return;

            rowsContainer.replaceChildren();

            addStudentRow("Student 1", "2 + 3 × 4 = 20");
            addStudentRow("Student 2", "2 + 12 = 14");
            addStudentRow("Student 3", "I am not sure how to start.");

            const topic = $('[name="topic"]', form);
            const grade = $('[name="grade"]', form);
            const question = $('[name="question"]', form);
            const correctAnswer = $('[name="correctAnswer"]', form);

            if (topic) topic.value = "Order of Operations";
            if (grade) grade.value = "Grade 7";
            if (question) question.value = "Calculate 2 + 3 × 4";
            if (correctAnswer) correctAnswer.value = "14";

            setMessage(
                message,
                "Sample responses are ready. Click Analyze Responses.",
                "success"
            );
        });
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (output) output.replaceChildren();

        const topic = $('[name="topic"]', form)?.value.trim() || "";
        const grade = $('[name="grade"]', form)?.value.trim() || "";
        const question = $('[name="question"]', form)?.value.trim() || "";
        const correctAnswer =
            $('[name="correctAnswer"]', form)?.value.trim() || "";
        const teacherContext =
            $('[name="teacherContext"]', form)?.value.trim() || "";

        const ids = $$('[name="studentId[]"]', form);
        const answers = $$('[name="studentAnswer[]"]', form);

        const responses = answers.map((field, index) => ({
            studentId: ids[index]?.value.trim() || `Student ${index + 1}`,
            answer: field.value.trim()
        })).filter(item => item.answer.length > 0);

        if (!topic || !question || !correctAnswer) {
            setMessage(
                message,
                "Please complete the topic, question, and correct answer.",
                "error"
            );
            return;
        }

        if (responses.length < 1 || responses.length > 100) {
            setMessage(
                message,
                "Enter between 1 and 100 non-empty student responses.",
                "error"
            );
            return;
        }

        const studentIds = responses.map(item => item.studentId);
        const studentAnswers = responses.map(item => item.answer);

        const payload = {
            topic,
            grade,
            question,
            correctAnswer,
            correct_answer: correctAnswer,
            teacherContext,
            teacher_context: teacherContext,

            responses: responses.map(item => ({
                studentId: item.studentId,
                answer: item.answer
            })),

            studentIds,
            studentAnswers,
            student_ids: studentIds,
            student_answers: studentAnswers
        };

        setLoading(submitButton, true, "Analyzing Responses...");
        setMessage(message, "TeachSense AI is analyzing the responses...", "info");

        try {
            const data = await apiRequest(API.analyze, {
                method: "POST",
                body: JSON.stringify(payload)
            });

            const report = getValue(
                data,
                ["result", "analysis", "assessment", "report"],
                data
            );

            renderResult(output, report);

            setMessage(
                message,
                data.message || "Assessment analysis completed successfully.",
                "success"
            );
        } catch (error) {
            setMessage(
                message,
                `Analysis failed: ${error.message}. If the error mentions student responses, app.py must accept the response format sent by this page.`,
                "error"
            );
        } finally {
            setLoading(submitButton, false);
        }
    });
}

/* =========================================================
   2. DASHBOARD / ASSESSMENT HISTORY
   ========================================================= */

async function initializeDashboard() {
    const container =
        $("#assessmentHistory") ||
        $("#recentAssessments") ||
        $("#dashboardAssessments");

    if (!container) return;

    try {
        const data = await apiRequest(API.assessments);
        const assessments = getValue(
            data,
            ["assessments", "results", "data"],
            []
        );

        container.replaceChildren();

        if (!Array.isArray(assessments) || assessments.length === 0) {
            container.textContent = "No assessments yet. Create your first one!";
            return;
        }

        assessments.forEach(item => {
            const card = document.createElement("article");
            card.className = "ts-result-card";

            const title = document.createElement("h3");
            title.textContent = item.topic || item.title || "Assessment";

            const details = document.createElement("p");
            details.textContent =
                `Grade: ${item.grade || "Not specified"} | ` +
                `Date: ${item.created_at || item.createdAt || "Not available"}`;

            card.append(title, details);

            const id = item.id ?? item.assessment_id;

            if (id !== undefined && id !== null) {
                const link = document.createElement("a");
                link.href = `insights.html?id=${encodeURIComponent(id)}`;
                link.textContent = "View Insights →";
                card.appendChild(link);
            }

            container.appendChild(card);
        });
    } catch (error) {
        container.textContent = `Unable to load assessments: ${error.message}`;
    }
}

/* =========================================================
   3. INSIGHTS PAGE
   ========================================================= */

async function initializeInsights() {
    const container =
        $("#insightsContent") ||
        $("#insightsResults") ||
        $("#insightsContainer");

    if (!container) return;

    const id = new URLSearchParams(location.search).get("id");

    if (!id) {
        container.textContent =
            "Select an assessment from the dashboard to view insights.";
        return;
    }

    try {
        const data = await apiRequest(
            `${API.assessments}/${encodeURIComponent(id)}`
        );

        renderResult(
            container,
            getValue(data, ["assessment", "insights", "result", "data"], data)
        );
    } catch (error) {
        container.textContent = `Unable to load insights: ${error.message}`;
    }
}

/* =========================================================
   4. LESSON PLAN PAGE
   ========================================================= */

function initializeLessonPlan() {
    const form =
        $("#lessonPlanForm") ||
        $("#generateLessonPlanForm");

    if (!form || form.dataset.premiumReady) return;
    form.dataset.premiumReady = "true";

    const output =
        $("#lessonPlanOutput") ||
        $("#lessonPlanResult") ||
        $("#lessonPlanPreview");

    const message =
        $("#lessonPlanMessage") ||
        $("#lessonPlanStatus");

    const submitButton = $('button[type="submit"]', form);

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const fields = Object.fromEntries(
            $$("input[name], select[name], textarea[name]", form)
                .map(field => [field.name, field.value.trim()])
        );

        const payload = {
            ...fields,
            topic: fields.topic || fields.lessonTopic || "",
            grade: fields.grade || fields.class || "",
            duration: fields.duration || fields.lessonDuration || "",
            objectives: fields.objectives || fields.learningObjectives || "",
            teacherContext: fields.teacherContext || fields.context || ""
        };

        setLoading(submitButton, true, "Creating Lesson Plan...");
        setMessage(message, "Generating your lesson plan...", "info");

        try {
            const data = await apiRequest(API.lessonPlan, {
                method: "POST",
                body: JSON.stringify(payload)
            });

            renderResult(
                output,
                getValue(data, ["lessonPlan", "lesson_plan", "plan", "result"], data)
            );

            setMessage(
                message,
                data.message || "Lesson plan generated successfully.",
                "success"
            );
        } catch (error) {
            setMessage(message, `Lesson plan failed: ${error.message}`, "error");
        } finally {
            setLoading(submitButton, false);
        }
    });
}

/* =========================================================
   5. AI CHAT PAGE
   ========================================================= */

function initializeChat() {
    const form = $("#chatForm") || $("#chatbotForm");
    if (!form || form.dataset.premiumReady) return;

    const input =
        $("#chatInput") ||
        $("#messageInput") ||
        $('[name="message"]', form);

    const messages =
        $("#chatMessages") ||
        $("#chatHistory") ||
        $("#chatOutput");

    if (!input || !messages) return;

    form.dataset.premiumReady = "true";

    const submitButton = $('button[type="submit"]', form);

    function addMessage(role, text) {
        const bubble = document.createElement("div");
        bubble.className = `ts-chat-bubble ts-chat-${role}`;
        bubble.textContent = text;
        messages.appendChild(bubble);
        messages.scrollTop = messages.scrollHeight;
        return bubble;
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const text = input.value.trim();
        if (!text) return;

        addMessage("user", text);
        input.value = "";

        setLoading(submitButton, true, "Thinking...");
        const waiting = addMessage("assistant", "TeachSense AI is thinking...");

        try {
            const data = await apiRequest(API.chat, {
                method: "POST",
                body: JSON.stringify({
                    message: text,
                    prompt: text
                })
            });

            waiting.textContent = String(getValue(
                data,
                ["reply", "response", "answer", "message", "result"],
                "No response received."
            ));
        } catch (error) {
            waiting.textContent = `Sorry, something went wrong: ${error.message}`;
        } finally {
            setLoading(submitButton, false);
        }
    });
}

/* =========================================================
   6. OPTIONAL BACKEND STATUS
   Add an element with id="apiStatus" to display this.
   ========================================================= */

async function checkBackendStatus() {
    const status = $("#apiStatus");
    if (!status) return;

    try {
        const data = await apiRequest(API.health);

        status.textContent = data.message || "Backend connected";
        status.classList.add("connected");
        status.classList.remove("disconnected");
    } catch {
        status.textContent = "Backend unavailable";
        status.classList.add("disconnected");
        status.classList.remove("connected");
    }
}

/* =========================================================
   START APPLICATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initializeAssessment();
    initializeDashboard();
    initializeInsights();
    initializeLessonPlan();
    initializeChat();
    checkBackendStatus();
});
