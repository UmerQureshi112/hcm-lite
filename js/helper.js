/**
 * HCM Lite - Smart Helper Chatbot (js/helper.js)
 * Lightweight rule-based HR assistant operating strictly over localStorage data.
 * Adheres to strict role-based access control and scope boundaries.
 */

const SmartHelper = {
  container: null,
  windowElement: null,
  messagesElement: null,
  inputElement: null,
  suggestionsElement: null,
  isOpen: false,

  init() {
    const session = AuthService.getSession();
    if (!session) return;

    this.renderWidget(session);
    this.bindEvents(session);
    this.sendGreeting(session);
  },

  renderWidget(session) {
    const existing = document.getElementById("hcmSmartHelper");
    if (existing) existing.remove();

    const wrapper = document.createElement("div");
    wrapper.id = "hcmSmartHelper";
    wrapper.className = "chatbot-wrapper";
    wrapper.innerHTML = `
      <div class="chatbot-window" id="chatbotWindow" role="dialog" aria-label="Smart Helper Chat">
        <div class="chatbot-header">
          <div class="chatbot-header-info">
            <div class="chatbot-avatar">🤖</div>
            <div>
              <div class="chatbot-title">Smart Helper</div>
              <div class="chatbot-subtitle">${session.role === "admin" ? "Company Assistant" : "Personal Assistant"}</div>
            </div>
          </div>
          <button type="button" class="chatbot-close-btn" id="chatbotCloseBtn" title="Close chat">&times;</button>
        </div>

        <div class="chatbot-messages" id="chatbotMessages"></div>

        <div class="chatbot-suggestions" id="chatbotSuggestions"></div>

        <form class="chatbot-input-area" id="chatbotForm">
          <input type="text" id="chatbotInput" class="chatbot-input" placeholder="Ask a question..." autocomplete="off">
          <button type="submit" class="btn btn-primary btn-sm" id="chatbotSendBtn">Send</button>
        </form>
      </div>

      <button type="button" class="chatbot-toggle-btn" id="chatbotToggleBtn" title="Open Smart Helper" aria-label="Open HR Smart Helper">
        💬
      </button>
    `;

    document.body.appendChild(wrapper);

    this.container = wrapper;
    this.windowElement = document.getElementById("chatbotWindow");
    this.messagesElement = document.getElementById("chatbotMessages");
    this.inputElement = document.getElementById("chatbotInput");
    this.suggestionsElement = document.getElementById("chatbotSuggestions");
  },

  bindEvents(session) {
    const toggleBtn = document.getElementById("chatbotToggleBtn");
    const closeBtn = document.getElementById("chatbotCloseBtn");
    const form = document.getElementById("chatbotForm");

    toggleBtn.addEventListener("click", () => this.toggleChat());
    closeBtn.addEventListener("click", () => this.toggleChat(false));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleUserSubmit(session);
    });
  },

  toggleChat(forceState = null) {
    this.isOpen = forceState !== null ? forceState : !this.isOpen;
    if (this.isOpen) {
      this.windowElement.classList.add("active");
      this.inputElement.focus();
    } else {
      this.windowElement.classList.remove("active");
    }
  },

  sendGreeting(session) {
    const firstName = session.fullName
      ? session.fullName.split(" ")[0]
      : "there";
    let welcomeText = "";
    let suggestions = [];

    if (session.role === "admin") {
      welcomeText = `Hello ${firstName}! I am your HR Assistant. You can ask me about employees, today's attendance, pending leaves, or total payroll.`;
      suggestions = [
        "How many employees are there?",
        "How many employees are present today?",
        "How many employees are late today?",
        "How many leave requests are pending?",
        "What is the total monthly payroll?",
        "Office hours",
      ];
    } else {
      welcomeText = `Hello ${firstName}! I can answer questions about your attendance status, remaining leave balance, salary, and company policies.`;
      suggestions = [
        "What is my remaining leave balance?",
        "What is my attendance status today?",
        "How many hours have I worked today?",
        "What is my monthly salary?",
        "How many approved leaves do I have?",
        "Office hours",
      ];
    }

    this.addBotMessage(welcomeText);
    this.renderSuggestions(suggestions, session);
  },

  renderSuggestions(suggestions, session) {
    this.suggestionsElement.innerHTML = "";
    suggestions.forEach((text) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "suggestion-chip";
      chip.textContent = text;
      chip.addEventListener("click", () => {
        this.addUserMessage(text);
        const reply = this.processQuery(text, session);
        setTimeout(() => this.addBotMessage(reply), 200);
      });
      this.suggestionsElement.appendChild(chip);
    });
  },

  handleUserSubmit(session) {
    const text = this.inputElement.value.trim();
    if (!text) return;

    this.addUserMessage(text);
    this.inputElement.value = "";

    setTimeout(() => {
      const reply = this.processQuery(text, session);
      this.addBotMessage(reply);
    }, 150);
  },

  addUserMessage(text) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble user";
    bubble.textContent = text;
    this.messagesElement.appendChild(bubble);
    this.scrollToBottom();
  },

  addBotMessage(text) {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble bot";
    bubble.innerHTML = text.replace(/\n/g, "<br>");
    this.messagesElement.appendChild(bubble);
    this.scrollToBottom();
  },

  scrollToBottom() {
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
  },

  processQuery(rawQuery, session) {
    const q = rawQuery.toLowerCase().trim();
    const company = StorageService.getCompany() || {};
    const employees = StorageService.getEmployees();
    const attendance = StorageService.getAttendance();
    const leaves = StorageService.getLeaves();
    const todayStr = new Date().toISOString().split("T")[0];

    if (q.includes("hello") || q.includes("hi") || q === "hey") {
      return `Hello! How can I assist you with HR information today?`;
    }

    if (q.includes("help") || q.includes("what can you do")) {
      if (session.role === "admin") {
        return `As an Admin, you can ask me about:\n- Total employee counts or department headcounts\n- Today's attendance numbers (present, late, half-day)\n- Pending leave requests\n- Total monthly payroll expenditure\n- Company office hours and grace periods.`;
      } else {
        return `As an Employee, you can ask me about:\n- Your remaining leave quota\n- Your today's attendance status and hours worked\n- Your monthly base salary\n- Your approved leave count\n- Company office hours and half-day cutoffs.`;
      }
    }

    if (
      q.includes("office hour") ||
      q.includes("working hour") ||
      q.includes("timings")
    ) {
      const start = company.officeStartTime || "09:00";
      const end = company.officeEndTime || "18:00";
      const grace = company.gracePeriodMinutes || 15;
      const cutoff = company.halfDayCutoff || "12:00";
      return `🏢 <strong>Office Timings:</strong>\n- Regular Hours: ${start} to ${end}\n- Grace Period: ${grace} minutes (Check-in before grace period ends is marked Present)\n- Half-Day Cutoff: ${cutoff} (Check-in after this is marked Half Day).`;
    }

    // ADMIN-SPECIFIC INTENTS
    if (session.role === "admin") {
      if (
        q.includes("how many employee") ||
        q.includes("total employee") ||
        q.includes("employee count")
      ) {
        const activeCount = employees.filter(
          (e) => e.status === "Active",
        ).length;
        const total = employees.length;
        if (total === 0) {
          return `There are currently no employees registered in the system.`;
        }
        return `There are currently <strong>${total}</strong> employee(s) in total (<strong>${activeCount}</strong> Active).`;
      }

      if (
        q.includes("department") ||
        q.includes("engineering") ||
        q.includes("marketing") ||
        q.includes("sales") ||
        q.includes("finance") ||
        q.includes("hr")
      ) {
        const departments = [
          ...new Set(employees.map((e) => e.department).filter(Boolean)),
        ];
        const matchedDept = departments.find((d) =>
          q.includes(d.toLowerCase()),
        );
        if (matchedDept) {
          const count = employees.filter(
            (e) => e.department.toLowerCase() === matchedDept.toLowerCase(),
          ).length;
          return `There are <strong>${count}</strong> employee(s) working in the <strong>${matchedDept}</strong> department.`;
        }
      }

      if (
        q.includes("present today") ||
        q.includes("who is present") ||
        q.includes("attendance today")
      ) {
        const todayLogs = attendance.filter((a) => a.date === todayStr);
        const presentLogs = todayLogs.filter((a) => a.status === "Present");
        return `Today, <strong>${presentLogs.length}</strong> employee(s) are checked in on time (Present) out of ${todayLogs.length} total check-in(s).`;
      }

      if (q.includes("late today") || q.includes("who is late")) {
        const todayLogs = attendance.filter((a) => a.date === todayStr);
        const lateLogs = todayLogs.filter((a) => a.status === "Late");
        if (lateLogs.length === 0) {
          return `No employees are marked Late today. Great punctuality!`;
        }
        const lateNames = lateLogs
          .map((l) => {
            const emp = employees.find((e) => e.employeeId === l.employeeId);
            return emp ? `${emp.fullName} (${l.checkInTime})` : l.employeeId;
          })
          .join(", ");
        return `Today, <strong>${lateLogs.length}</strong> employee(s) arrived late: ${lateNames}.`;
      }

      if (q.includes("half day") || q.includes("half-day")) {
        const todayLogs = attendance.filter((a) => a.date === todayStr);
        const halfDayLogs = todayLogs.filter((a) => a.status === "Half Day");
        return `Today, <strong>${halfDayLogs.length}</strong> employee(s) are on a Half Day.`;
      }

      if (
        q.includes("leave") &&
        (q.includes("pending") || q.includes("request"))
      ) {
        const pending = leaves.filter((l) => l.status === "Pending");
        if (pending.length === 0) {
          return `There are currently <strong>0</strong> pending leave requests.`;
        }
        return `There are <strong>${pending.length}</strong> pending leave request(s) waiting for your review.`;
      }

      if (
        q.includes("payroll") ||
        q.includes("total salary") ||
        q.includes("monthly payroll")
      ) {
        const activeEmployees = employees.filter((e) => e.status === "Active");
        const totalPayroll = activeEmployees.reduce(
          (sum, emp) => sum + (parseFloat(emp.monthlySalary) || 0),
          0,
        );
        const currency = company.currency || "$";
        return `The total monthly payroll for <strong>${activeEmployees.length}</strong> active employee(s) is <strong>${currency}${totalPayroll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.`;
      }
    }

    // EMPLOYEE-SPECIFIC INTENTS
    if (session.role === "employee") {
      const empId = session.employeeId;
      const empRecord = employees.find((e) => e.employeeId === empId);

      if (
        q.includes("leave balance") ||
        q.includes("remaining leave") ||
        q.includes("how many leaves left") ||
        q.includes("my leave")
      ) {
        if (!empRecord) {
          return `Could not find an employee record associated with your account.`;
        }
        const quota = empRecord.leaveQuota || company.defaultLeaveQuota || 20;
        const myApprovedLeaves = leaves.filter(
          (l) => l.employeeId === empId && l.status === "Approved",
        );
        const approvedDays = myApprovedLeaves.reduce(
          (sum, l) => sum + (parseInt(l.daysCount, 10) || 0),
          0,
        );
        const remaining = Math.max(0, quota - approvedDays);
        return `Your leave balance:\n- Total Quota: <strong>${quota}</strong> days\n- Approved / Used: <strong>${approvedDays}</strong> days\n- Remaining: <strong>${remaining}</strong> days.`;
      }

      if (q.includes("approved leave")) {
        const myApproved = leaves.filter(
          (l) => l.employeeId === empId && l.status === "Approved",
        );
        const totalDays = myApproved.reduce(
          (sum, l) => sum + (parseInt(l.daysCount, 10) || 0),
          0,
        );
        return `You have <strong>${myApproved.length}</strong> approved leave request(s) totaling <strong>${totalDays}</strong> day(s).`;
      }

      if (
        q.includes("attendance") ||
        q.includes("status today") ||
        q.includes("am i present")
      ) {
        const todayLog = attendance.find(
          (a) => a.employeeId === empId && a.date === todayStr,
        );
        if (!todayLog) {
          return `You have not checked in yet today (${todayStr}). Please use the Check-In button on your dashboard.`;
        }
        return `Your attendance status today is <strong>${todayLog.status}</strong>.\n- Check-In: ${todayLog.checkInTime}\n- Check-Out: ${todayLog.checkOutTime || "Not checked out yet"}.`;
      }

      if (
        q.includes("hour") ||
        q.includes("hours worked") ||
        q.includes("worked today")
      ) {
        const todayLog = attendance.find(
          (a) => a.employeeId === empId && a.date === todayStr,
        );
        if (!todayLog) {
          return `You have not logged any hours yet today.`;
        }
        if (todayLog.checkOutTime) {
          const hours = (todayLog.workedMinutes / 60).toFixed(1);
          return `You worked <strong>${hours}</strong> hours today (Checked in at ${todayLog.checkInTime}, Checked out at ${todayLog.checkOutTime}).`;
        } else {
          return `You are currently clocked in (Checked in at ${todayLog.checkInTime}). Your worked hours will be finalized when you check out.`;
        }
      }

      if (
        q.includes("salary") ||
        q.includes("pay") ||
        q.includes("compensation")
      ) {
        if (!empRecord) {
          return `Salary record is not available.`;
        }
        const currency = company.currency || "$";
        const salary = parseFloat(empRecord.monthlySalary) || 0;
        return `Your base monthly salary is <strong>${currency}${salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>. You can view your full itemized breakdown on your Payslip page.`;
      }

      if (
        q.includes("employee id") ||
        q.includes("my id") ||
        q.includes("my department")
      ) {
        if (!empRecord) return `Employee details not found.`;
        return `Your Details:\n- Employee ID: <strong>${empRecord.employeeId}</strong>\n- Department: <strong>${empRecord.department}</strong>\n- Title: <strong>${empRecord.jobTitle}</strong>\n- Joined: <strong>${empRecord.joiningDate}</strong>`;
      }
    }

    return `I'm sorry, I didn't quite understand that question. You can try asking one of the suggested topics or type "help" to see what I can do!`;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  SmartHelper.init();
});

window.SmartHelper = SmartHelper;
