
"use strict";

/* ==========================================================
   TEACHSENSE AI — PREMIUM COMPLETE SCRIPT
   Assessment | Dashboard | Insights | Lesson Plans | AI Chat
   ========================================================== */

const API = {
    analyze: "/api/analyze",
    assessments: "/api/assessments",
    lessonPlan: "/api/lesson-plan",
    chat: "/api/chat",
    health: "/api/health"
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

/* ==================== UTILITIES ==================== */

function getValue(object, keys, fallback = "") {
    for (const key of keys) {
        if (object && object[key] !== undefined && object[key] !== null) {
            return object[key];
        }
    }
    return fallback;
}

function showMessage(element, message, type = "info") {
    if (!element) return;

    element.textContent = message;
    element.className = `ts-message ts-message-${type}`;
    element.setAttribute("role", type === "error" ? "alert" : "status");
    element.hidden = false;
}

function setLoading(button, loading, loadingText = "Please wait...") {
    if (!button) return;

    if (loading) {
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }

        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        button.textContent = loadingText;
    } else {
        button.disabled = false;
        button.removeAttribute("aria-busy");

        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }
}

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

    const type = response.headers.get("content-type") || "";
    let data;

    if (type.includes("application/json")) {
        data = await response.json();
    } else {
        const body = await response.text();
        data = {
            error: body || `Server returned status ${response.status}`
        };
    }

    if (!response.ok || data.success === false) {
        throw new Error(
            data.error || data.message || `Request failed (${response.status})`
        );
    }

    return data;
}

/* ==================== PREMIUM RESULT CARDS ==================== */

function createResultCard(title, content) {
    const card = document.createElement("article");
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
            li.textContent =
                typeof item === "object" && item !== null
                    ? JSON.stringify(item, null, 2)
                    : String(item ?? "");

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
            detail.textContent =
                typeof value === "object" && value !== null
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

function renderResult(container, data, headingText = "Results") {
    if (!container) return;

    container.replaceChildren();

    const heading = document.createElement("h2");
    heading.className = "ts-results-title";
    heading.textContent = headingText;
    container.appendChild(heading);

    if (typeof data === "string" || typeof data !== "object" || data === null) {
        container.appendChild(createResultCard("Analysis", data));
        return;
    }

    const entries = Object.entries(data);

    if (!entries.length) {
        container.appendChild(createResultCard("Analysis", "No results available."));
        return;
    }

    entries.forEach(([key, value]) => {
        const title = key
            .replace(/([A-Z])/g, " $1")
            .replace(/[_-]/g, " ")
            .replace(/^./, char => char.toUpperCase());

        container.appendChild(createResultCard(title, value));
    });
}

/* ==========================================================
   PREMIUM ASSESSMENT HISTORY CARD
   ========================================================== */

function renderAssessmentCard(item) {
    const card = document.createElement("article");
    card.className = "assessment-premium-card";

    const header = document.createElement("div");
    header.className = "assessment-card-header";

    const icon = document.createElement("div");
    icon.className = "assessment-card-icon";
    icon.textContent = "✦";
    icon.setAttribute("aria-hidden", "true");

    const titleArea = document.createElement("div");
    titleArea.className = "assessment-title-area";

    const title = document.createElement("h3");
    title.textContent = item.topic || item.title || "Untitled Assessment";

    const grade = document.createElement("span");
    grade.className = "assessment-grade-badge";
    grade.textContent = item.grade || "Grade not specified";

    titleArea.append(title, grade);
    header.append(icon, titleArea);

    const divider = document.createElement("div");
    divider.className = "assessment-card-divider";

    const dateRow = document.createElement("div");
    dateRow.className = "assessment-date-row";

    const dateLabel = document.createElement("span");
    dateLabel.textContent = "CREATED ON";

    const dateValue = document.createElement("time");
    const rawDate = item.created_at || item.createdAt;

    if (rawDate) {
        const parsedDate = new Date(rawDate);

        if (!Number.isNaN(parsedDate.getTime())) {
            dateValue.dateTime = parsedDate.toISOString();
            dateValue.textContent = parsedDate.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
        } else {
            dateValue.textContent = String(rawDate);
        }
    } else {
        dateValue.textContent = "Date unavailable";
    }

    dateRow.append(dateLabel, dateValue);

    const footer = document.createElement("div");
    footer.className = "assessment-card-footer";

    const status = document.createElement("span");
    status.className = "assessment-status";

    const dot = document.createElement("span");
    dot.className = "assessment-status-dot";

    status.append(dot, document.createTextNode("Assessment saved"));
    footer.appendChild(status);

    const id = item.id ?? item.assessment_id;

    if (id !== undefined && id !== null) {
        const link = document.createElement("a");
        link.className = "assessment-view-button";
        link.href = `insights.html?id=${encodeURIComponent(id)}`;
        link.append(
            document.createTextNode("View Insights "),
            document.createTextNode("↗")
        );
        footer.appendChild(link);
    }

    card.append(header, divider, dateRow, footer);
    return card;
}

/* ==========================================================
   1. ASSESSMENT PAGE
   ========================================================== */

function initializeAssessment() {
    const form = $("#assessmentForm");

    if (!form || form.dataset.initialized) return;
    form.dataset.initialized = "true";

    const rowsContainer = $("#responseRows");
    const addButton = $("#addResponse");
    const sampleButton = $("#loadSamples");
    const submitButton = $("#analyzeSubmit");
    const message = $("#assessmentMessage");
    const output = $("#analysisPreview");

    function addStudentRow(studentId = "", answer = "") {
        if (!rowsContainer) return;

        if ($$('[name="studentAnswer[]"]', rowsContainer).length >= 100) {
            showMessage(message, "Maximum 100 responses allowed.", "error");
            return;
        }

        const row = document.createElement("div");
        row.className = "response-row ts-response-card";

        const idLabel = document.createElement("label");
        idLabel.textContent = "Student ID or Name";

        const idInput = document.createElement("input");
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
            const rows = $$(".response-row", rowsContainer);

            if (rows.length <= 1) {
                idInput.value = "";
                answerInput.value = "";
                showMessage(message, "Response row cleared.", "info");
                return;
            }

            row.remove();
        });

        idLabel.appendChild(idInput);
        answerLabel.appendChild(answerInput);
        row.append(idLabel, answerLabel, removeButton);
        rowsContainer.appendChild(row);
    }

    // Keep the first row already present in assessment.html.
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
            const correct = $('[name="correctAnswer"]', form);

            if (topic) topic.value = "Order of Operations";
            if (grade) grade.value = "Grade 7";
            if (question) question.value = "Calculate 2 + 3 × 4";
            if (correct) correct.value = "14";

            showMessage(
                message,
                "Sample responses loaded. Ready to analyze!",
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

        const idFields = $$('[name="studentId[]"]', form);
        const answerFields = $$('[name="studentAnswer[]"]', form);

        const responses = answerFields.map((field, index) => ({
            studentId: idFields[index]?.value.trim() || `Student ${index + 1}`,
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
                "Enter between 1 and 100 student responses.",
                "error"
            );
            return;
        }

        const studentIds = responses.map(student => student.studentId);
        const studentAnswers = responses.map(student => student.answer);

        const payload = {
            topic,
            grade,
            question,
            correctAnswer,
            correct_answer: correctAnswer,
            teacherContext,
            teacher_context: teacherContext,
            responses,
            studentIds,
            studentAnswers,
            student_ids: studentIds,
            student_answers: studentAnswers
        };

        setLoading(submitButton, true, "Analyzing Responses...");
        showMessage(message, "TeachSense AI is analyzing the answers...", "info");

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

            renderResult(output, report, "Assessment Analysis");

            showMessage(
                message,
                data.message || "Analysis completed successfully.",
                "success"
            );
        } catch (error) {
            showMessage(
                message,
                `Analysis failed: ${error.message}. Verify the response format in app.py.`,
                "error"
            );
        } finally {
            setLoading(submitButton, false);
        }
    });
}

/* ==========================================================
   2. DASHBOARD
   ========================================================== */

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
            const empty = document.createElement("div");
            empty.className = "assessment-empty-state";

            const title = document.createElement("h3");
            title.textContent = "No assessments yet";

            const description = document.createElement("p");
            description.textContent =
                "Your student analysis reports will appear here.";

            empty.append(title, description);
            container.appendChild(empty);
            return;
        }

        assessments.forEach(item => {
            container.appendChild(renderAssessmentCard(item));
        });
    } catch (error) {
        container.textContent = `Unable to load assessments: ${error.message}`;
    }
}

/* ==========================================================
   3. INSIGHTS PAGE
   ========================================================== */

async function initializeInsights() {
    const container =
        $("#insightsContent") ||
        $("#insightsResults") ||
        $("#insightsContainer");

    if (!container) return;

    const id = new URLSearchParams(window.location.search).get("id");

    if (!id) {
        container.textContent =
            "Choose an assessment from the dashboard to view its insights.";
        return;
    }

    try {
        const data = await apiRequest(
            `${API.assessments}/${encodeURIComponent(id)}`
        );

        const result = getValue(
            data,
            ["assessment", "insights", "result", "data"],
            data
        );

        renderResult(container, result, "Assessment Insights");
    } catch (error) {
        container.textContent = `Unable to load insights: ${error.message}`;
    }
}

/* ==========================================================
   4. LESSON PLAN GENERATOR
   ========================================================== */

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

    const button = $('button[type="submit"]', form);

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

        setLoading(button, true, "Generating Lesson Plan...");
        showMessage(message, "Creating your lesson plan...", "info");

        try {
            const data = await apiRequest(API.lessonPlan, {
                method: "POST",
                body: JSON.stringify(payload)
            });

            renderResult(
                output,
                getValue(data, ["lessonPlan", "lesson_plan", "plan", "result"], data),
                "Generated Lesson Plan"
            );

            showMessage(message, "Lesson plan generated successfully.", "success");
        } catch (error) {
            showMessage(message, `Lesson plan failed: ${error.message}`, "error");
        } finally {
            setLoading(button, false);
        }
    });
}

/* ==========================================================
   5. AI CHAT
   ========================================================== */

function initializeChat() {
    const form = $("#chatForm") || $("#chatbotForm");

    if (!form || form.dataset.initialized) return;

    const input =
        $("#chatInput") ||
        $("#messageInput") ||
        $('[name="message"]', form);

    const messages =
        $("#chatMessages") ||
        $("#chatHistory") ||
        $("#chatOutput");

    if (!input || !messages) return;

    form.dataset.initialized = "true";

    const button = $('button[type="submit"]', form);

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

        setLoading(button, true, "Thinking...");

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
            waiting.textContent = `Sorry, an error occurred: ${error.message}`;
        } finally {
            setLoading(button, false);
        }
    });
}

/* ==========================================================
   6. OPTIONAL BACKEND STATUS
   ========================================================== */

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

/* ==========================================================
   INITIALIZE
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {
    initializeAssessment();
    initializeDashboard();
    initializeInsights();
    initializeLessonPlan();
    initializeChat();
    checkBackendStatus();
});
