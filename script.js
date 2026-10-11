
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // =========================================
  // 1. COMMON HELPER FUNCTIONS
  // =========================================

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("The server returned an invalid response.");
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || `Server error: ${response.status}`);
    }

    return data;
  }

  function showMessage(element, message, type = "success") {
    if (!element) return;

    element.textContent = message;
    element.classList.remove("success", "error");
    element.classList.add(type);
    element.hidden = false;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function setLoading(button, loading, normalText) {
    if (!button) return;

    if (loading) {
      button.dataset.originalText = button.textContent;
      button.textContent = "Please wait...";
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || normalText;
      button.disabled = false;
    }
  }

  function formatDate(value) {
    if (!value) return "Recently";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString();
  }

  function resultValue(data, keys, fallback = "") {
    for (const key of keys) {
      if (data && data[key] !== undefined && data[key] !== null) {
        return data[key];
      }
    }

    return fallback;
  }

  // =========================================
  // 2. ANIMATIONS AND NAVIGATION
  // =========================================

  const revealItems = $$(".stat-card, .panel, .section-heading, .notice, .hero");

  revealItems.forEach((item, index) => {
    item.classList.add("reveal");
    item.style.transitionDelay = `${(index % 4) * 80}ms`;
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  $$("[data-count]").forEach((element) => {
    const target = Number(element.dataset.count);

    if (!Number.isFinite(target)) return;

    const start = performance.now();

    function animate(now) {
      const progress = Math.min((now - start) / 900, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      element.textContent = Math.round(target * eased).toLocaleString();

      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  });

  const currentPage = location.pathname.split("/").pop() || "index.html";

  $$(".nav-link").forEach((link) => {
    const href = link.getAttribute("href");

    link.classList.toggle(
      "active",
      Boolean(href) && href.split("#")[0] === currentPage
    );
  });

  $$(".btn").forEach((button) => {
    button.addEventListener("pointerdown", () => {
      if (!button.disabled) button.style.transform = "scale(.98)";
    });

    ["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
      button.addEventListener(eventName, () => {
        button.style.transform = "";
      });
    });
  });

  // =========================================
  // 3. ASSESSMENT FORM
  // =========================================

  const assessmentForm = $("#assessmentForm");
  const responseRows = $("#responseRows");
  const assessmentMessage = $("#assessmentMessage");
  const analysisPreview = $("#analysisPreview");
  const addResponseButton = $("#addResponse");
  const loadSamplesButton = $("#loadSamples");
  const analyzeButton = $("#analyzeSubmit");

  function addStudentRow(studentId = "", answer = "") {
    if (!responseRows) return;

    const row = document.createElement("div");
    row.className = "response-row grid-2";

    row.innerHTML = `
      <div class="form-group">
        <label>Student ID or nickname</label>
        <input
          type="text"
          name="studentId[]"
          placeholder="e.g. Student 1"
        >
      </div>

      <div class="form-group">
        <label>Student answer</label>
        <textarea
          name="studentAnswer[]"
          rows="3"
          placeholder="Enter the student's answer"
        ></textarea>
      </div>

      <button type="button" class="btn btn-secondary remove-response">
        Remove response
      </button>
    `;

    row.querySelector('[name="studentId[]"]').value = studentId;
    row.querySelector('[name="studentAnswer[]"]').value = answer;

    responseRows.appendChild(row);
  }

  if (addResponseButton && responseRows) {
    addResponseButton.addEventListener("click", () => {
      addStudentRow();
    });

    responseRows.addEventListener("click", (event) => {
      const removeButton = event.target.closest(".remove-response");

      if (!removeButton) return;

      const rows = responseRows.querySelectorAll(".response-row");

      if (rows.length <= 1) {
        showMessage(
          assessmentMessage,
          "Keep at least one student response.",
          "error"
        );
        return;
      }

      removeButton.closest(".response-row").remove();
    });
  }

  if (loadSamplesButton && responseRows) {
    loadSamplesButton.addEventListener("click", () => {
      responseRows.innerHTML = "";

      addStudentRow("Student 1", "2 + 3 × 4 = 20");
      addStudentRow("Student 2", "2 + 12 = 14");
      addStudentRow("Student 3", "I am not sure how to start.");

      const topic = $('[name="topic"]');
      const question = $('[name="question"]');
      const correctAnswer = $('[name="correctAnswer"]');
      const grade = $('[name="grade"]');

      if (topic) topic.value = "Order of Operations";
      if (question) question.value = "Calculate 2 + 3 × 4";
      if (correctAnswer) correctAnswer.value = "14";
      if (grade && !grade.value) grade.value = "Grade 7";

      showMessage(
        assessmentMessage,
        "Sample responses loaded. Review them before analyzing.",
        "success"
      );
    });
  }

  function renderAssessmentResult(data) {
    if (!analysisPreview) return;

    const result = resultValue(
      data,
      ["result", "analysis", "assessment", "report"],
      data
    );

    if (typeof result === "string") {
      analysisPreview.innerHTML = `
        <div class="result-block">
          <h3>Assessment result</h3>
          <p>${escapeHTML(result)}</p>
        </div>
      `;
      return;
    }

    const topic = resultValue(result, ["topic"], "Assessment");
    const summary = resultValue(
      result,
      ["summary", "overview", "message", "explanation"],
      "Review the findings below with your own teaching judgment."
    );

    const findings = resultValue(
      result,
      ["misconceptions", "insights", "findings", "patterns"],
      []
    );

    const recommendations = resultValue(
      result,
      ["recommendations", "suggestions", "nextSteps", "next_steps"],
      []
    );

    let html = `
      <div class="result-block">
        <h3>${escapeHTML(topic)}</h3>
        <p>${escapeHTML(summary)}</p>
      </div>
    `;

    if (Array.isArray(findings) && findings.length) {
      html += `<div class="result-block"><h3>Possible misconceptions</h3>`;

      findings.forEach((item) => {
        if (typeof item === "string") {
          html += `<p>• ${escapeHTML(item)}</p>`;
        } else {
          const title = resultValue(
            item,
            ["title", "name", "misconception", "pattern"],
            "Possible learning pattern"
          );

          const detail = resultValue(
            item,
            ["description", "explanation", "evidence", "detail"],
            ""
          );

          html += `<p><strong>${escapeHTML(title)}</strong></p>`;
          if (detail) html += `<p>${escapeHTML(detail)}</p>`;
        }
      });

      html += `</div>`;
    }

    if (Array.isArray(recommendations) && recommendations.length) {
      html += `<div class="result-block"><h3>Suggested next steps</h3><ul>`;

      recommendations.forEach((item) => {
        const text = typeof item === "string"
          ? item
          : resultValue(item, ["text", "title", "description"], JSON.stringify(item));

        html += `<li>${escapeHTML(text)}</li>`;
      });

      html += `</ul></div>`;
    }

    html += `
      <div class="result-block">
        <p><strong>Important:</strong> These are learning signals, not a diagnosis.
        Check the students' reasoning and confirm patterns with another question.</p>
      </div>
    `;

    analysisPreview.innerHTML = html;
  }

  if (assessmentForm) {
    assessmentForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const topic = $('[name="topic"]', assessmentForm)?.value.trim();
      const question = $('[name="question"]', assessmentForm)?.value.trim();
      const correctAnswer = $('[name="correctAnswer"]', assessmentForm)?.value.trim();

      const ids = [...assessmentForm.querySelectorAll('[name="studentId[]"]')];
      const answers = [...assessmentForm.querySelectorAll('[name="studentAnswer[]"]')];

      const studentAnswers = answers
        .map((field, index) => ({
          studentId: ids[index]?.value.trim() || `Student ${index + 1}`,
          answer: field.value.trim()
        }))
        .filter((student) => student.answer);

      if (!topic || !question || !correctAnswer) {
        showMessage(
          assessmentMessage,
          "Please enter the topic, question, and correct answer.",
          "error"
        );
        return;
      }

      if (!studentAnswers.length) {
        showMessage(
          assessmentMessage,
          "Enter at least one student answer.",
          "error"
        );
        return;
      }

      const payload = {
        topic,
        grade: $('[name="grade"]', assessmentForm)?.value.trim() || "",
        question,
        correctAnswer,
        teacherContext: $('[name="teacherContext"]', assessmentForm)?.value.trim() || "",
        responses: studentAnswers
      };

      setLoading(analyzeButton, true);

      if (analysisPreview) {
        analysisPreview.innerHTML = `
          <div class="result-block">
            <p>Analyzing responses. Please wait...</p>
          </div>
        `;
      }

      try {
        const data = await apiRequest("/api/analyze", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        renderAssessmentResult(data);

        showMessage(
          assessmentMessage,
          "Analysis completed. Review the findings before deciding what to teach next.",
          "success"
        );
      } catch (error) {
        showMessage(
          assessmentMessage,
          `Could not analyze responses: ${error.message}. Check that app.py is running.`,
          "error"
        );

        if (analysisPreview) {
          analysisPreview.innerHTML = `
            <div class="result-block">
              <p>Analysis could not be loaded.</p>
              <p>${escapeHTML(error.message)}</p>
            </div>
          `;
        }
      } finally {
        setLoading(analyzeButton, false, "Analyze responses");
      }
    });
  }

  // =========================================
  // 4. DASHBOARD AND SAVED ASSESSMENTS
  // =========================================

  async function loadAssessments() {
    try {
      const data = await apiRequest("/api/assessments");
      const assessments = Array.isArray(data)
        ? data
        : resultValue(data, ["assessments", "results", "reports"], []);

      renderDashboard(assessments);
      populateReportSelect(assessments);
    } catch (error) {
      const table = $("#recentAssessments");

      if (table) {
        table.innerHTML = `
          <tr><td colspan="4">
            Could not load assessments. Start the Flask server and refresh.
          </td></tr>
        `;
      }

      console.error("Assessment loading error:", error);
    }
  }

  function renderDashboard(assessments) {
    const totalAssessments = assessments.length;

    const totalResponses = assessments.reduce((total, item) => {
      const responses = resultValue(
        item,
        ["responses", "studentResponses", "student_answers"],
        []
      );

      return total + (Array.isArray(responses) ? responses.length : 0);
    }, 0);

    const assessmentCount = $("#dashAssessments");
    const responseCount = $("#dashResponses");
    const accuracyCount = $("#dashAccuracy");
    const insightsCount = $("#dashInsights");

    if (assessmentCount) assessmentCount.textContent = totalAssessments;
    if (responseCount) responseCount.textContent = totalResponses;
    if (accuracyCount) accuracyCount.textContent = "—";
    if (insightsCount) {
      insightsCount.textContent = assessments.reduce((total, item) => {
        const findings = resultValue(
          item,
          ["misconceptions", "insights", "findings", "patterns"],
          []
        );

        return total + (Array.isArray(findings) ? findings.length : 0);
      }, 0);
    }

    const table = $("#recentAssessments");

    if (!table) return;

    if (!assessments.length) {
      table.innerHTML = `
        <tr><td colspan="4">No assessments yet. Start by analyzing student responses.</td></tr>
      `;
      return;
    }

    table.innerHTML = assessments.slice().reverse().slice(0, 8).map((item) => {
      const id = resultValue(item, ["id", "assessmentId", "assessment_id"], "");
      const topic = resultValue(item, ["topic", "title"], "Untitled assessment");
      const date = resultValue(item, ["createdAt", "created_at", "timestamp", "date"], "");

      const responses = resultValue(
        item,
        ["responses", "studentResponses", "student_answers"],
        []
      );

      const count = Array.isArray(responses) ? responses.length : 0;

      return `
        <tr>
          <td>${escapeHTML(topic)}</td>
          <td>${escapeHTML(count)}</td>
          <td>${escapeHTML(formatDate(date))}</td>
          <td>
            <button class="btn btn-secondary view-assessment"
              type="button" data-assessment-id="${escapeHTML(id)}">
              View
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  const recentTable = $("#recentAssessments");

  if (recentTable) {
    recentTable.addEventListener("click", async (event) => {
      const button = event.target.closest(".view-assessment");

      if (!button) return;

      const id = button.dataset.assessmentId;
      if (!id) return;

      try {
        const data = await apiRequest(
          `/api/assessments/${encodeURIComponent(id)}`
        );

        const preview = $("#analysisPreview");

        if (preview) {
          renderAssessmentResult(data);
          preview.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          alert("Assessment loaded. Open the Insights page to review saved reports.");
        }
      } catch (error) {
        alert(`Could not open assessment: ${error.message}`);
      }
    });
  }

  // =========================================
  // 5. INSIGHTS PAGE
  // =========================================

  function populateReportSelect(assessments) {
    const select = $("#reportSelect");

    if (!select) return;

    const previousValue = select.value;

    select.innerHTML = `<option value="">Select an assessment</option>`;

    assessments.forEach((item) => {
      const id = resultValue(item, ["id", "assessmentId", "assessment_id"], "");
      if (!id) return;

      const option = document.createElement("option");
      option.value = id;
      option.textContent = resultValue(item, ["topic", "title"], `Assessment ${id}`);
      select.appendChild(option);
    });

    if (previousValue) select.value = previousValue;

    if (select.value) loadSelectedReport(select.value);
  }

  async function loadSelectedReport(id) {
    const output = $("#insightReport");

    if (!output || !id) return;

    output.innerHTML = `<div class="result-block"><p>Loading report...</p></div>`;

    try {
      const data = await apiRequest(
        `/api/assessments/${encodeURIComponent(id)}`
      );

      const oldPreview = analysisPreview;

      // Reuse the renderer without depending on another page's DOM.
      const result = resultValue(data, ["result", "analysis", "assessment", "report"], data);
      const summary = resultValue(
        result,
        ["summary", "overview", "message", "explanation"],
        "Review these findings alongside student work."
      );

      let html = `
        <div class="result-block">
          <h3>${escapeHTML(resultValue(result, ["topic"], "Assessment report"))}</h3>
          <p>${escapeHTML(summary)}</p>
        </div>
      `;

      const findings = resultValue(
        result,
        ["misconceptions", "insights", "findings", "patterns"],
        []
      );

      if (Array.isArray(findings) && findings.length) {
        html += `<div class="result-block"><h3>Possible misconceptions</h3>`;

        findings.forEach((item) => {
          if (typeof item === "string") {
            html += `<p>• ${escapeHTML(item)}</p>`;
          } else {
            html += `<p><strong>${escapeHTML(resultValue(item, ["title", "name", "pattern", "misconception"], "Learning pattern"))}</strong></p>`;
            html += `<p>${escapeHTML(resultValue(item, ["description", "explanation", "evidence", "detail"], ""))}</p>`;
          }
        });

        html += `</div>`;
      } else {
        html += `<div class="result-block"><p>No structured findings were returned for this report.</p></div>`;
      }

      html += `
        <div class="result-block">
          <p><strong>Teacher review:</strong> Confirm the pattern with follow-up questions.
          This report is a teaching aid, not a diagnosis of any student.</p>
        </div>
      `;

      output.innerHTML = html;
    } catch (error) {
      output.innerHTML = `
        <div class="result-block">
          <p>Could not load this report: ${escapeHTML(error.message)}</p>
        </div>
      `;
    }
  }

  const reportSelect = $("#reportSelect");

  if (reportSelect) {
    reportSelect.addEventListener("change", () => {
      if (reportSelect.value) {
        loadSelectedReport(reportSelect.value);
      } else if ($("#insightReport")) {
        $("#insightReport").innerHTML = `
          <div class="result-block"><p>Select an assessment to view its report.</p></div>
        `;
      }
    });
  }

  // =========================================
  // 6. LESSON PLAN GENERATOR
  // =========================================

  const lessonForm = $("#lessonForm");
  const lessonResult = $("#lessonResult");
  const lessonMessage = $("#lessonMessage");
  const lessonButton = $("#lessonSubmit");
  let latestLessonText = "";

  if (lessonForm) {
    lessonForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const payload = {
        topic: $("#lessonTopic")?.value.trim() || "",
        grade: $("#lessonLevel")?.value.trim() || "",
        duration: $("#duration")?.value || "40 minutes",
        learningGoal: $("#learningGoal")?.value.trim() || "",
        learningNeeds: $("#learningNeeds")?.value.trim() || "",
        resources: $("#resources")?.value.trim() || ""
      };

      if (!payload.topic) {
        showMessage(lessonMessage, "Enter a lesson topic first.", "error");
        return;
      }

      setLoading(lessonButton, true);

      try {
        const data = await apiRequest("/api/lesson-plan", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        const lesson = resultValue(
          data,
          ["lessonPlan", "lesson_plan", "content", "plan", "result"],
          data
        );

        latestLessonText = typeof lesson === "string"
          ? lesson
          : JSON.stringify(lesson, null, 2);

        // Keep the copy button in the page.
        const copyButton = $("#copyLesson");
        lessonResult.innerHTML = `
          <div class="result-block">
            <h3>Lesson plan</h3>
            <pre style="white-space:pre-wrap; overflow-wrap:anywhere;">${escapeHTML(latestLessonText)}</pre>
          </div>
        `;

        if (copyButton) lessonResult.appendChild(copyButton);

        showMessage(
          lessonMessage,
          "Lesson plan created. Review and adjust it before using it in class.",
          "success"
        );
      } catch (error) {
        showMessage(
          lessonMessage,
          `Could not create the lesson plan: ${error.message}`,
          "error"
        );
      } finally {
        setLoading(lessonButton, false, "Generate lesson plan");
      }
    });
  }

  const copyLessonButton = $("#copyLesson");

  if (copyLessonButton) {
    copyLessonButton.addEventListener("click", async () => {
      if (!latestLessonText) {
        showMessage(lessonMessage, "Generate a lesson plan before copying it.", "error");
        return;
      }

      try {
        await navigator.clipboard.writeText(latestLessonText);
        showMessage(lessonMessage, "Lesson plan copied to clipboard.", "success");
      } catch {
        showMessage(
          lessonMessage,
          "Copy was blocked by the browser. Select and copy the lesson text manually.",
          "error"
        );
      }
    });
  }

  // =========================================
  // 7. TEACHSENSE CHAT
  // =========================================

  const chatForm = $("#chatForm");
  const chatMessages = $("#chatMessages");
  const chatInput = $("#chatInput");
  const chatSend = $("#chatSend");
  const clearChatButton = $("#clearChat");
  const chatMessageStatus = $("#chatMessageStatus");

  function addChatBubble(sender, message) {
    if (!chatMessages) return;

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";

    const heading = document.createElement("strong");
    heading.textContent = sender;

    const paragraph = document.createElement("p");
    paragraph.textContent = message;

    bubble.append(heading, paragraph);
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  if (chatForm) {
    chatForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const message = chatInput?.value.trim();

      if (!message) {
        showMessage(chatMessageStatus, "Type a message first.", "error");
        return;
      }

      addChatBubble("You", message);
      chatInput.value = "";
      setLoading(chatSend, true);

      try {
        const data = await apiRequest("/api/chat", {
          method: "POST",
          body: JSON.stringify({ message })
        });

        const reply = resultValue(
          data,
          ["reply", "response", "message", "answer"],
          "I couldn't prepare a response. Please try again."
        );

        addChatBubble("TeachSense AI", typeof reply === "string" ? reply : JSON.stringify(reply));
        if (chatMessageStatus) chatMessageStatus.hidden = true;
      } catch (error) {
        addChatBubble(
          "TeachSense AI",
          `I couldn't connect to the local server. ${error.message}`
        );
      } finally {
        setLoading(chatSend, false, "Send");
      }
    });
  }

  $$(".prompt-button[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!chatInput) return;

      chatInput.value = button.dataset.prompt || "";
      chatInput.focus();
    });
  });

  if (clearChatButton && chatMessages) {
    clearChatButton.addEventListener("click", () => {
      chatMessages.innerHTML = `
        <div class="chat-bubble">
          <strong>TeachSense AI</strong>
          <p>Chat cleared. Ask me about student misconceptions or lesson activities.</p>
        </div>
      `;

      if (chatMessageStatus) chatMessageStatus.hidden = true;
    });
  }

  // =========================================
  // 8. CHECK BACKEND CONNECTION
  // =========================================

  async function checkServer() {
    try {
      await apiRequest("/api/health");
      console.log("TeachSense AI server connection: OK");
    } catch (error) {
      console.warn(
        "TeachSense AI backend is not responding. Start app.py to use the interactive features.",
        error.message
      );
    }
  }

  checkServer();

  // Load saved assessments wherever dashboard or reports appear.
  if ($("#recentAssessments") || $("#reportSelect")) {
    loadAssessments();
  }
});
