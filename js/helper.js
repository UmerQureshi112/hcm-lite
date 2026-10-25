// js/helper.js
// Smart Helper: app ke data se sawalon ke jawab. admin.html aur employee.html par chalta hai.

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("helperForm");
  const input = document.getElementById("helperQuestion");
  const messages = document.getElementById("helperMessages");

  // Helper ka HTML page par na ho to code yahin ruk jaye
  if (!form || !input || !messages) return;

  const user = getCurrentUser();
  const DAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  /* ---------- Chat box ---------- */

  function addMessage(text, sender) {
    const bubble = document.createElement("div");
    bubble.className = `helper-message ${sender}`;
    bubble.textContent = text;

    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  /* ---------- Sawal samajhna ---------- */

  // Poore lafz ya jumle ke hisaab se match karta hai ("this" mein "hi" nahi milega)
  function matcher(text) {
    return (...phrases) =>
      phrases.some((phrase) =>
        new RegExp(`(^|[^a-z])${phrase}([^a-z]|$)`).test(text),
      );
  }

  function plural(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
  }

  function joinNames(records, limit = 5) {
    const names = records.map((record) => record.employeeName);
    if (names.length <= limit) return names.join(", ");
    return `${names.slice(0, limit).join(", ")} and ${names.length - limit} more`;
  }

  function getWorkingDaysText(settings) {
    return [...settings.workingDays]
      .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) // Monday se shuru
      .map((day) => DAY_NAMES[day])
      .join(", ");
  }

  /* ---------- Admin ke jawab ---------- */

  function getAdminReply(text, has) {
    const employees = getEmployees();
    const today = getToday();
    const todayRecords = getAttendance().filter(
      (record) => record.date === today,
    );

    if (
      has("how many", "total", "count") &&
      has("employees", "employee", "staff")
    ) {
      return employees.length === 0
        ? "You have not added any employees yet. Open the Employees page to add one."
        : `You have ${plural(employees.length, "employee")} in the company.`;
    }

    if (has("pending")) {
      const pending = getLeaves().filter((leave) => leave.status === "Pending");

      if (pending.length === 0) return "There are no pending leave requests.";

      return `${plural(pending.length, "leave request")} waiting for your decision: ${pending
        .slice(0, 4)
        .map((leave) => leave.employeeName)
        .join(", ")}. Open Leave Requests to review them.`;
    }

    if (has("on leave", "leave today", "leaves today", "chutti")) {
      const onLeave = employees.filter((employee) =>
        getApprovedLeaveOn(employee.id, today),
      );

      return onLeave.length === 0
        ? "Nobody is on approved leave today."
        : `${plural(onLeave.length, "employee")} on leave today: ${onLeave
            .map((employee) => employee.name)
            .join(", ")}.`;
    }

    if (has("late")) {
      const late = todayRecords.filter((record) => record.status === "Late");

      return late.length === 0
        ? "Nobody has checked in late today."
        : `${plural(late.length, "employee")} late today: ${joinNames(late)}.`;
    }

    if (has("half day", "half-day")) {
      const half = todayRecords.filter(
        (record) => record.status === "Half Day",
      );

      return half.length === 0
        ? "Nobody is marked as half day today."
        : `Half day today: ${joinNames(half)}.`;
    }

    if (has("present", "attendance", "checked in", "came", "absent")) {
      if (employees.length === 0)
        return "Add employees first to see attendance.";

      const late = todayRecords.filter(
        (record) => record.status === "Late",
      ).length;
      const half = todayRecords.filter(
        (record) => record.status === "Half Day",
      ).length;
      const present = todayRecords.length - late - half;
      const waiting = employees.filter(
        (employee) =>
          !todayRecords.some(
            (record) => String(record.employeeId) === String(employee.id),
          ) && !getApprovedLeaveOn(employee.id, today),
      ).length;

      return (
        `Today ${todayRecords.length} of ${employees.length} employees checked in ` +
        `(${present} present, ${late} late, ${half} half day). ` +
        `${waiting} not checked in yet.`
      );
    }

    if (has("salary", "payslip", "payroll", "tankhwah")) {
      const payroll = employees.reduce(
        (total, employee) => total + Number(employee.salary || 0),
        0,
      );

      return `Total monthly payroll is ${formatCurrency(payroll)} for ${plural(employees.length, "employee")}. Open Payslips to view an individual salary slip.`;
    }

    return null;
  }

  /* ---------- Employee ke jawab ---------- */

  function getEmployeeReply(text, has) {
    const today = getToday();
    const record = getAttendance().find(
      (item) =>
        String(item.employeeId) === String(user.id) && item.date === today,
    );
    const employee = getEmployees().find(
      (item) => String(item.id) === String(user.id),
    );

    if (has("check-out", "check out", "checkout")) {
      if (!record)
        return "You have not checked in yet. Check in first, then you can check out.";
      if (record.checkOut)
        return `You already checked out today at ${record.checkOut}.`;
      return `You checked in at ${record.checkIn}. Press the Check Out button when you finish work.`;
    }

    if (
      has("attendance", "check-in", "check in", "checkin", "checked", "status")
    ) {
      if (has("month")) {
        const summary = getMonthlySummary(user.id, today.slice(0, 7));

        return (
          `This month: ${summary.present} present, ${summary.late} late, ` +
          `${summary.halfDays} half day, ${summary.leaveDays} on leave, ` +
          `and ${summary.absentDays} absent.`
        );
      }

      if (record) {
        return (
          `You checked in at ${record.checkIn} (${record.status}).` +
          (record.checkOut
            ? ` Checked out at ${record.checkOut}.`
            : " You have not checked out yet.")
        );
      }

      if (getApprovedLeaveOn(user.id, today))
        return "You are on approved leave today.";

      if (!getSettings().workingDays.includes(new Date().getDay())) {
        return "Today is a day off, so no check-in is needed.";
      }

      return "You have not checked in today. Press the Check In button to start.";
    }

    if (has("leave", "leaves", "chutti", "balance")) {
      if (has("apply", "request", "take")) {
        return "Use the Apply for Leave form on this page. Pick the type and dates, then submit.";
      }

      const balance = getLeaveBalance(user.id);
      const mine = getLeaves().filter(
        (leave) => String(leave.employeeId) === String(user.id),
      );
      const count = (status) =>
        mine.filter((leave) => leave.status === status).length;

      return (
        `You have ${balance.remaining} of ${balance.quota} leave days left ` +
        `(${balance.used} used, ${balance.pending} waiting for approval). ` +
        `Requests so far: ${count("Pending")} pending, ${count("Approved")} approved, ${count("Rejected")} rejected.`
      );
    }

    if (has("salary", "payslip", "pay", "deduction", "net", "tankhwah")) {
      if (!employee) return "I could not find your salary record.";

      // calculatePayslip() attendance.js mein hai
      const slip = calculatePayslip(employee, today.slice(0, 7));

      return (
        `Your monthly salary is ${formatCurrency(slip.monthlySalary)}. ` +
        `This month so far you have ${plural(slip.absentDays, "absent day")} and ${plural(slip.halfDays, "half day")}, ` +
        `a deduction of ${formatCurrency(slip.totalDeduction)}. ` +
        `Estimated net salary: ${formatCurrency(slip.netSalary)}. Open Payslip for the full slip.`
      );
    }

    if (has("profile", "my name", "who am i", "department", "email")) {
      return employee
        ? `You are ${employee.name}, in the ${employee.department} department. Your login email is ${employee.email}.`
        : `You are logged in as ${user.name}.`;
    }

    return null;
  }

  /* ---------- Sab ke liye jawab ---------- */

  function getCommonReply(text, has) {
    if (
      has(
        "office",
        "timing",
        "timings",
        "start time",
        "grace",
        "working days",
        "half day rule",
        "rules",
      )
    ) {
      const settings = getSettings();
      const start = timeToMinutes(settings.officeStartTime);

      const toTime = (total) =>
        `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

      return (
        `Office starts at ${settings.officeStartTime}. ` +
        `Present up to ${toTime(start + settings.graceMinutes)}, ` +
        `late up to ${toTime(start + settings.halfDayAfterMinutes)}, ` +
        `and half day after that. Working days: ${getWorkingDaysText(settings)}.`
      );
    }

    return null;
  }

  function getReply(question) {
    const text = question.toLowerCase().trim();
    const has = matcher(text);

    if (!user) return "Please log in first.";

    if (has("help", "what can you do", "commands")) {
      return user.role === "admin"
        ? "Ask me about: total employees, who is present today, who is late, who is on leave, pending leave requests, payroll, or office rules."
        : "Ask me about: today's attendance, this month's attendance, check-out, leave balance, your salary, office timings, or your profile.";
    }

    const specific =
      (user.role === "admin"
        ? getAdminReply(text, has)
        : getEmployeeReply(text, has)) || getCommonReply(text, has);

    if (specific) return specific;

    if (has("thanks", "thank you", "shukriya", "thx"))
      return "You are welcome!";

    // Salam ya hello sab se aakhir mein, taake "hi, my salary?" ka jawab salary ka aaye
    if (has("hello", "hi", "hey", "salam", "assalamualaikum", "aoa")) {
      return `Hello ${user.name.split(" ")[0]}! How can I help you today? Type "help" to see what I can answer.`;
    }

    return 'Sorry, I did not understand that. Type "help" to see what you can ask.';
  }

  /* ---------- Sawal bhejna ---------- */

  function ask(question) {
    const clean = question.trim();
    if (!clean) return;

    addMessage(clean, "user");

    let reply;

    try {
      reply = getReply(clean);
    } catch (error) {
      console.error("Helper error:", error);
      reply = "Something went wrong while reading the data. Please try again.";
    }

    addMessage(reply, "bot");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    ask(input.value);
    input.value = "";
    input.focus();
  });

  // Quick buttons: <button type="button" data-helper-question="leave balance">
  document.querySelectorAll("[data-helper-question]").forEach((button) => {
    button.addEventListener("click", () => ask(button.dataset.helperQuestion));
  });

  // Pehla message
  if (user) {
    addMessage(
      `Hi ${user.name.split(" ")[0]}! I answer from your app's data. Type "help" to see what you can ask.`,
      "bot",
    );
  }
});
