
"use strict";

/* =========================================================
   TEACHSENSE AI — COMPLETE script.js
   Dashboard, Assessment, Insights, Lesson Plan, Chat,
   Login, Signup, and API helpers
   ========================================================= */

const API = {
    analyze: "/api/analyze",
    assessments: "/api/assessments",
    lessonPlan: "/api/lesson-plan",
    chat: "/api/chat",
    health: "/api/health"
};

const $ = (selector, root = document) =>
    root.querySelector(selector);

const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function showMessage(element, message, type = "info") {
    if (!element) return;

    element.textContent = message;
    element.className = `message ${type}`;
    element.hidden = false;
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(options.headers || {})
        }
    });

    const contentType = response.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/json")) {
        data = await response.json();
    } else {
        const text = await response.text();
        data = { error: text || `Server returned HTTP ${response.status}` };
    }

    if (!response.ok || data.success === false) {
        throw new Error(
            data.error || data.message || `Request failed (${response.status})`
        );
    }

    return data;
}

function setButtonLoading(button, loading, loadingText = "Please wait...") {
    if (!button) return;

    if (loading) {
        button.dataset.originalText = button.textContent;
        button.disabled = true;
        button.textContent = loadingText;
    } else {
        button.disabled = false;
        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }
}

function getFirstValue(object, keys, fallback = "") {
    for (const key of keys) {
        if (object && object[key] !== undefined && object[key] !== null) {
            return object[key];
        }
    }
    return fallback;
}

function formatValue(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return JSON.stringify(value, null, 2);
}

function renderObject(container, data) {
    if (!container) return;

    if (typeof data === "string") {
        container.innerHTML = `<p>${escapeHTML(data)}</p>`;
        return;
    }

    if (Array.isArray(data)) {
        container.innerHTML = data.map(item =>
            `<div class="result-item">${escapeHTML(formatValue(item))}</div>`
        ).join("");
        return;
    }

    if (data && typeof data === "object") {
        container.innerHTML = Object.entries(data).map(([key, value]) => `
            <section class="result-item">
                <h3>${escapeHTML(
                    key.replace(/([A-Z])/g, " $1")
                       .replace(/[_-]/g, " ")
                )}</h3>
                <p>${escapeHTML(formatValue(value))}</p>
            </section>
        `).join("");
        return;
    }

    container.innerHTML = `<p>${escapeHTML(formatValue(data))}</p>`;
}

/* =========================================================
   ASSESSMENT PAGE
   ========================================================= */

function initializeAssessment() {
    const form = $("#assessmentForm");
    if (!form) return;

    const responseRows = $("#responseRows");
    const addButton = $("#addResponse");
    const sampleButton = $("#loadSamples");
    const submitButton = $("#analyzeSubmit");
    const message = $("#assessmentMessage");
    const preview = $("#analysisPreview");

    function addStudentRow(studentId = "", answer = "") {
        if (!responseRows) return;

        const row = document.createElement("div");
        row.className = "response-row";

        row.innerHTML = `
            <div class="student-response-fields">
                <label>
                    Student ID or Name
                    <input
                        type="text"
                        name="studentId[]"
                        placeholder="e.g. Student 1"
                    >
                </label>

                <label>
                    Student Answer
                    <textarea
                        name="studentAnswer[]"
                        rows="2"
                        placeholder="Enter the student's answer"
                    ></textarea>
                </label>

                <button type="button" class="remove-response">
                    Remove
                </button>
            </div>
        `;

        const idInput = $('[name="studentId[]"]', row);
        const answerInput = $('[name="studentAnswer[]"]', row);

        idInput.value = studentId;
        answerInput.value = answer;

        row.querySelector(".remove-response").addEventListener("click", () => {
            const rows = $$(".response-row", responseRows);

            if (rows.length <= 1) {
                idInput.value = "";
                answerInput.value = "";
                showMessage(
                    message,
                    "Keep at least one response row. You can clear its fields instead.",
                    "info"
                );
                return;
            }

            row.remove();
        });

        responseRows.appendChild(row);
    }

    if (addButton && responseRows && !addButton.dataset.initialized) {
        addButton.dataset.initialized = "true";

        addButton.addEventListener("click", () => {
            if ($$(".response-row", responseRows).length >= 100) {
                showMessage(
                    message,
                    "You can analyze a maximum of 100 student responses at a time.",
                    "error"
                );
                return;
            }

            addStudentRow();
        });
    }

    // Support the response row already present in assessment.html.
    if (
        responseRows &&
        $$(".response-row", responseRows).length === 0 &&
        $$('[name="studentAnswer[]"]', responseRows).length > 0
    ) {
        $$('[name="studentAnswer[]"]', responseRows).forEach(field => {
            field.closest(".response-row")?.classList.add("response-row");
        });
    }

    if (sampleButton && !sampleButton.dataset.initialized) {
        sampleButton.dataset.initialized = "true";

        sampleButton.addEventListener("click", () => {
            if (!responseRows) return;

            responseRows.innerHTML = "";

            addStudentRow("Student 1", "2 + 3 × 4 = 20");
            addStudentRow("Student 2", "2 + 12 = 14");
            addStudentRow("Student 3", "I am not sure how to start.");

            const topic = $('[name="topic"]', form);
            const question = $('[name="question"]', form);
            const correctAnswer = $('[name="correctAnswer"]', form);
            const grade = $('[name="grade"]', form);

            if (topic) topic.value = "Order of Operations";
            if (question) question.value = "Calculate 2 + 3 × 4";
            if (correctAnswer) correctAnswer.value = "14";
            if (grade && !grade.value) grade.value = "Grade 7";

            showMessage(
                message,
                "Sample responses loaded. Click Analyze Responses to continue.",
                "success"
            );
        });
    }

    if (form.dataset.initialized) return;
    form.dataset.initialized = "true";

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (preview) preview.innerHTML = "";

        const topic = $('[name="topic"]', form)?.value.trim() || "";
        const grade = $('[name="grade"]', form)?.value.trim() || "";
        const question = $('[name="question"]', form)?.value.trim() || "";
        const correctAnswer =
            $('[name="correctAnswer"]', form)?.value.trim() || "";
        const teacherContext =
            $('[name="teacherContext"]', form)?.value.trim() || "";

        const idFields = $$('[name="studentId[]"]', form);
        const answerFields = $$('[name="studentAnswer[]"]', form);

        const responses = answerFields.map((field, index) => ({
            studentId:
                idFields[index]?.value.trim() || `Student ${index + 1}`,
            answer: field.value.trim()
        })).filter(student => student.answer !== "");

        if (!topic || !question || !correctAnswer) {
            showMessage(
                message,
                "Please enter the topic, question, and correct answer.",
                "error"
            );
            return;
        }

        if (responses.length < 1 || responses.length > 100) {
            showMessage(
                message,
                "Enter between 1 and 100 non-empty student responses.",
                "error"
            );
            return;
        }

        /*
         * Send the combined response objects AND parallel arrays.
         * The Flask endpoint must still accept at least one of
         * these formats. If it uses another schema, app.py must
         * be updated to match.
         */
        const payload = {
            topic,
            grade,
            question,
            correctAnswer,
            teacherContext,

            // Combined format:
            responses: responses.map(student => ({
                studentId: student.studentId,
                answer: student.answer
            })),

            // Parallel-array format:
            studentIds: responses.map(student => student.studentId),
            studentAnswers: responses.map(student => student.answer),

            // Alternative snake_case format:
            student_ids: responses.map(student => student.studentId),
            student_answers: responses.map(student => student.answer),

            // Alternative field names:
            correct_answer: correctAnswer,
            teacher_context: teacherContext
        };

        setButtonLoading(submitButton, true, "Analyzing...");
        showMessage(message, "Analyzing student responses...", "info");

        try {
            const result = await apiRequest(API.analyze, {
                method: "POST",
                body: JSON.stringify(payload)
            });

            renderAssessmentResult(result, preview);

            showMessage(
                message,
                result.message || "Assessment analysis completed.",
                "success"
            );
        } catch (error) {
            showMessage(
                message,
                `Could not analyze responses: ${error.message}. Check that the Flask backend is running and that app.py accepts the submitted response format.`,
                "error"
            );
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

function renderAssessmentResult(result, container) {
    if (!container) return;

    const report = getFirstValue(
        result,
        ["result", "analysis", "assessment", "report"],
        result
    );

    container.innerHTML = "";

    const heading = document.createElement("h2");
    heading.textContent = "Assessment Results";
    container.appendChild(heading);

    if (typeof report === "string") {
        const paragraph = document.createElement("p");
        paragraph.textContent = report;
        container.appendChild(paragraph);
    } else if (report && typeof report === "object") {
        renderObject(container, report);
    } else {
        const paragraph = document.createElement("p");
        paragraph.textContent = formatValue(report);
        container.appendChild(paragraph);
    }

    const findings = getFirstValue(
        result,
        ["findings", "keyFindings", "key_findings"],
        null
    );

    const recommendations = getFirstValue(
        result,
        ["recommendations", "nextSteps", "next_steps"],
        null
    );

    if (findings) {
        const section = document.createElement("section");
        section.innerHTML = "<h3>Key Findings</h3>";
        renderObject(section, findings);
        container.appendChild(section);
    }

    if (recommendations) {
        const section = document.createElement("section");
        section.innerHTML = "<h3>Recommendations</h3>";
        renderObject(section, recommendations);
        container.appendChild(section);
    }

    if (result.id || result.assessmentId || result.assessment_id) {
        const id = result.id || result.assessmentId || result.assessment_id;
        const note = document.createElement("p");
        note.textContent = `Assessment ID: ${id}`;
        container.appendChild(note);
    }
}

/* =========================================================
   DASHBOARD / ASSESSMENT HISTORY
   ========================================================= */

async function initializeDashboard() {
    const container =
        $("#assessmentHistory") ||
        $("#recentAssessments") ||
        $("#dashboardAssessments");

    if (!container) return;

    try {
        const data = await apiRequest(API.assessments);
        const assessments = getFirstValue(
            data,
            ["assessments", "results", "data"],
            []
        );

        container.innerHTML = "";

        if (!Array.isArray(assessments) || assessments.length === 0) {
            container.innerHTML = "<p>No assessments yet. Create your first assessment.</p>";
            return;
        }

        assessments.forEach(item => {
            const card = document.createElement("article");
            card.className = "assessment-card";

            const title = document.createElement("h3");
            title.textContent = item.topic || item.title || "Assessment";

            const detail = document.createElement("p");
            detail.textContent =
                `Grade: ${item.grade || "Not specified"} · ` +
                `Date: ${item.created_at || item.createdAt || "Not available"}`;

            card.append(title, detail);

            const id = item.id || item.assessment_id;

            if (id !== undefined && id !== null) {
                const link = document.createElement("a");
                link.href = `insights.html?id=${encodeURIComponent(id)}`;
                link.textContent = "View Insights";
                card.appendChild(link);
            }

            container.appendChild(card);
        });
    } catch (error) {
        container.innerHTML =
            `<p>Could not load assessments: ${escapeHTML(error.message)}</p>`;
    }
}

/* =========================================================
   INSIGHTS PAGE
   ========================================================= */

async function initializeInsights() {
    const container =
        $("#insightsContent") ||
        $("#insightsResults") ||
        $("#insightsContainer");

    if (!container) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (!id) {
        container.innerHTML =
            "<p>Select an assessment from the dashboard to view its insights.</p>";
        return;
    }

    try {
        const data = await apiRequest(
            `${API.assessments}/${encodeURIComponent(id)}`
        );

        renderObject(container, getFirstValue(
            data,
            ["assessment", "insights", "result", "data"],
            data
        ));
    } catch (error) {
        container.innerHTML =
            `<p>Could not load insights: ${escapeHTML(error.message)}</p>`;
    }
}

/* =========================================================
   LESSON PLAN GENERATOR
   ========================================================= */

function initializeLessonPlan() {
    const form =
        $("#lessonPlanForm") ||
        $("#generateLessonPlanForm");

    if (!form || form.dataset.initialized) return;
    form.dataset.initialized = "true";

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
                .filter(field => field.name)
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

        setButtonLoading(submitButton, true, "Generating...");
        showMessage(message, "Generating lesson plan...", "info");

        try {
            const result = await apiRequest(API.lessonPlan, {
                method: "POST",
                body: JSON.stringify(payload)
            });

            renderObject(output, getFirstValue(
                result,
                ["lessonPlan", "lesson_plan", "plan", "result", "data"],
                result
            ));

            showMessage(
                message,
                result.message || "Lesson plan generated successfully.",
                "success"
            );
        } catch (error) {
            showMessage(
                message,
                `Could not generate lesson plan: ${error.message}`,
                "error"
            );
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

/* =========================================================
   CHAT PAGE
   ========================================================= */

function initializeChat() {
    const form =
        $("#chatForm") ||
        $("#chatbotForm");

    if (!form || form.dataset.initialized) return;
    form.dataset.initialized = "true";

    const input =
        $("#chatInput") ||
        $("#messageInput") ||
        $('[name="message"]', form);

    const messages =
        $("#chatMessages") ||
        $("#chatHistory") ||
        $("#chatOutput");

    const submitButton = $('button[type="submit"]', form);

    if (!input || !messages) return;

    function addChatMessage(role, text) {
        const message = document.createElement("div");
        message.className = `chat-message ${role}`;
        message.textContent = text;
        messages.appendChild(message);
        messages.scrollTop = messages.scrollHeight;
        return message;
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const text = input.value.trim();
        if (!text) return;

        addChatMessage("user", text);
        input.value = "";

        setButtonLoading(submitButton, true, "Sending...");

        const waiting = addChatMessage("assistant", "Thinking...");

        try {
            const result = await apiRequest(API.chat, {
                method: "POST",
                body: JSON.stringify({
                    message: text,
                    prompt: text
                })
            });

            waiting.textContent = String(getFirstValue(
                result,
                ["reply", "response", "answer", "message", "result"],
                "I could not find a response."
            ));
        } catch (error) {
            waiting.textContent = `Sorry, an error occurred: ${error.message}`;
        } finally {
            setButtonLoading(submitButton, false);
        }
    });
}

/* =========================================================
   LOGIN / SIGNUP FORM UX
   These handlers submit normally unless the page has an
   explicit data-api attribute configured on its form.
   ========================================================= */

function initializeAuthForms() {
    const forms = [
        { selector: "#loginForm", endpoint: "/api/login" },
        { selector: "#signupForm", endpoint: "/api/signup" }
    ];

    forms.forEach(({ selector, endpoint }) => {
        const form = $(selector);
        if (!form || form.dataset.initialized) return;

        /*
         * Do not intercept a regular HTML form unless its
         * data-api attribute explicitly enables API submission.
         */
        if (form.dataset.api !== "true") return;

        form.dataset.initialized = "true";

        const message =
            $("#authMessage", form) ||
            $("#loginMessage") ||
            $("#signupMessage");

        const button = $('button[type="submit"]', form);

        form.addEventListener("submit", async event => {
            event.preventDefault();

            const payload = Object.fromEntries(
                $$("input[name]", form).map(input => [
                    input.name,
                    input.value
                ])
            );

            setButtonLoading(button, true, "Please wait...");
            showMessage(message, "Processing...", "info");

            try {
                const result = await apiRequest(endpoint, {
                    method: "POST",
                    body: JSON.stringify(payload)
                });

                showMessage(
                    message,
                    result.message || "Successful.",
                    "success"
                );

                if (result.redirect) {
                    window.location.href = result.redirect;
                } else if (selector === "#loginForm") {
                    window.location.href = "index.html";
                }
            } catch (error) {
                showMessage(message, error.message, "error");
            } finally {
                setButtonLoading(button, false);
            }
        });
    });
}

/* =========================================================
   BACKEND STATUS INDICATOR
   Optional element: #apiStatus
   ========================================================= */

async function checkBackendStatus() {
    const indicator = $("#apiStatus");
    if (!indicator) return;

    try {
        const result = await apiRequest(API.health);
        indicator.textContent = result.message || "Backend connected";
        indicator.classList.add("connected");
        indicator.classList.remove("disconnected");
    } catch (error) {
        indicator.textContent = "Backend unavailable";
        indicator.classList.add("disconnected");
        indicator.classList.remove("connected");
    }
}

/* =========================================================
   GLOBAL INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initializeAssessment();
    initializeDashboard();
    initializeInsights();
    initializeLessonPlan();
    initializeChat();
    initializeAuthForms();
    checkBackendStatus();
});
