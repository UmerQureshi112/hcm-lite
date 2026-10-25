// js/attendance.js
// Check-in / check-out, attendance table, dashboard stats aur monthly summary.
// Ye script admin.html, employee.html aur payslip.html par load hoti hai.

/* =========================================================
   Shared functions (payslip.js bhi inhe use karti hai)
   ========================================================= */

// Check-in ke time se status nikalta hai, Admin ke rules ke mutabiq
function getAttendanceStatus(checkInTime, settings = getSettings()) {
  const start = timeToMinutes(settings.officeStartTime);
  const arrived = timeToMinutes(checkInTime);

  if (arrived <= start + settings.graceMinutes) return "Present";
  if (arrived <= start + settings.halfDayAfterMinutes) return "Late";
  return "Half Day";
}

// Is date par employee ki approved leave (agar hai)
function getApprovedLeaveOn(employeeId, date) {
  return getLeaves().find(
    (leave) =>
      String(leave.employeeId) === String(employeeId) &&
      leave.status === "Approved" &&
      leave.from <= date &&
      leave.to >= date,
  );
}

// "8h 05m" jaisa text
function getWorkHours(record) {
  if (!record.checkIn) return "-";

  if (!record.checkOut) {
    return record.date === getToday() ? "In progress" : "No check-out";
  }

  const minutes =
    timeToMinutes(record.checkOut) - timeToMinutes(record.checkIn);
  if (minutes < 0) return "-";

  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

const ATTENDANCE_BADGES = {
  Present: "badge-success",
  Late: "badge-warning",
  "Half Day": "badge-danger",
  "On Leave": "badge-info",
};

function createAttendanceBadge(status) {
  const badge = document.createElement("span");
  badge.className = `badge ${ATTENDANCE_BADGES[status] || "badge-muted"}`;
  badge.textContent = status;
  return badge;
}

// Ek mahine ka summary. month ka format "YYYY-MM" hai.
// Sirf Admin ke working days ginti mein aate hain.
function getMonthlySummary(employeeId, month) {
  const settings = getSettings();
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const today = getToday();

  const employee = getEmployees().find(
    (item) => String(item.id) === String(employeeId),
  );

  // Employee mahine ke beech mein join hua ho to usse pehle ke din absent nahi ginte
  const joined = employee?.createdAt
    ? toDateString(new Date(employee.createdAt))
    : "";

  const records = {};
  getAttendance()
    .filter((record) => String(record.employeeId) === String(employeeId))
    .forEach((record) => {
      records[record.date] = record;
    });

  const approvedLeaves = getLeaves().filter(
    (leave) =>
      String(leave.employeeId) === String(employeeId) &&
      leave.status === "Approved",
  );

  const summary = {
    monthWorkingDays: 0, // poore mahine ke working days
    countedDays: 0, // ab tak ginay gaye din
    present: 0,
    late: 0,
    halfDays: 0,
    leaveDays: 0,
    absentDays: 0,
  };

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, monthNumber - 1, day);
    const dateString = toDateString(date);

    if (!settings.workingDays.includes(date.getDay())) continue;

    summary.monthWorkingDays++;

    // Aane wale din aur join hone se pehle ke din ginti mein nahi
    if (dateString > today) continue;
    if (joined && dateString < joined) continue;

    const record = records[dateString];

    if (record) {
      summary.countedDays++;
      if (record.status === "Present") summary.present++;
      else if (record.status === "Late") summary.late++;
      else summary.halfDays++;
      continue;
    }

    const onLeave = approvedLeaves.some(
      (leave) => leave.from <= dateString && leave.to >= dateString,
    );

    if (onLeave) {
      summary.countedDays++;
      summary.leaveDays++;
      continue;
    }

    // Aaj abhi check-in nahi hua to absent nahi, din abhi khatam nahi hua
    if (dateString === today) continue;

    summary.countedDays++;
    summary.absentDays++;
  }

  return summary;
}

/* =========================================================
   Page ka kaam
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();

  // Employee dashboard
  const todayDateEl = document.getElementById("todayDate");
  const liveClockEl = document.getElementById("liveClock");
  const myCheckInEl = document.getElementById("myCheckIn");
  const myCheckOutEl = document.getElementById("myCheckOut");
  const myWorkHoursEl = document.getElementById("myWorkHours");
  const myStatusEl = document.getElementById("myAttendanceStatus");
  const myHistoryBody = document.getElementById("myAttendanceBody");
  const checkInBtn = document.getElementById("checkInBtn");
  const checkOutBtn = document.getElementById("checkOutBtn");

  const monthPresentEl = document.getElementById("monthPresent");
  const monthLateEl = document.getElementById("monthLate");
  const monthHalfDayEl = document.getElementById("monthHalfDay");
  const monthAbsentEl = document.getElementById("monthAbsent");

  // Admin dashboard
  const attendanceTableBody = document.getElementById("attendanceTableBody");
  const totalEmployeesEl = document.getElementById("totalEmployees");
  const presentTodayEl = document.getElementById("presentToday");
  const onLeaveTodayEl = document.getElementById("onLeaveToday");
  const lateTodayEl = document.getElementById("lateToday");
  const weekChartEl = document.getElementById("weekChart");

  function createCell(content) {
    const cell = document.createElement("td");

    if (content instanceof Node) {
      cell.appendChild(content);
    } else {
      cell.textContent = content ?? "";
    }

    return cell;
  }

  function findMyRecord(date) {
    if (!user) return undefined;

    return getAttendance().find(
      (record) =>
        String(record.employeeId) === String(user.id) && record.date === date,
    );
  }

  /* ---------- Employee: check in / check out ---------- */

  function checkIn() {
    if (!user || user.role !== "employee") {
      showToast("Please log in as an employee.", "error");
      return;
    }

    const today = getToday();

    if (findMyRecord(today)) {
      showToast("You have already checked in today.", "error");
      return;
    }

    if (getApprovedLeaveOn(user.id, today)) {
      showToast("You are on approved leave today.", "error");
      return;
    }

    const time = getCurrentTime();
    const status = getAttendanceStatus(time);
    const attendance = getAttendance();

    attendance.push({
      id: generateId(),
      employeeId: user.id,
      employeeName: user.name,
      date: today,
      checkIn: time,
      checkOut: "",
      status,
    });

    if (!saveData(STORAGE_KEYS.attendance, attendance)) {
      showToast("Could not save check-in.", "error");
      return;
    }

    showToast(
      `Checked in at ${time} (${status})`,
      status === "Present" ? "success" : "info",
    );
    renderAll();
  }

  function checkOut() {
    if (!user || user.role !== "employee") {
      showToast("Please log in as an employee.", "error");
      return;
    }

    const attendance = getAttendance();
    const record = attendance.find(
      (item) =>
        String(item.employeeId) === String(user.id) && item.date === getToday(),
    );

    if (!record) {
      showToast("Please check in first.", "error");
      return;
    }

    if (record.checkOut) {
      showToast("You have already checked out today.", "error");
      return;
    }

    record.checkOut = getCurrentTime();

    if (!saveData(STORAGE_KEYS.attendance, attendance)) {
      showToast("Could not save check-out.", "error");
      return;
    }

    showToast(`Checked out at ${record.checkOut}`, "success");
    renderAll();
  }

  /* ---------- Employee: dashboard ---------- */

  function renderEmployeeView() {
    if (!user || user.role !== "employee") return;

    const today = getToday();
    const record = findMyRecord(today);

    if (todayDateEl) {
      todayDateEl.textContent = new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }

    if (myCheckInEl) myCheckInEl.textContent = record?.checkIn || "--:--";
    if (myCheckOutEl) myCheckOutEl.textContent = record?.checkOut || "--:--";
    if (myWorkHoursEl)
      myWorkHoursEl.textContent = record ? getWorkHours(record) : "-";

    if (myStatusEl) {
      const onLeave = Boolean(getApprovedLeaveOn(user.id, today));
      const status =
        record?.status || (onLeave ? "On Leave" : "Not checked in");

      myStatusEl.innerHTML = "";
      myStatusEl.appendChild(createAttendanceBadge(status));
    }

    if (checkInBtn) checkInBtn.disabled = Boolean(record);
    if (checkOutBtn) checkOutBtn.disabled = !record || Boolean(record.checkOut);

    // Is mahine ke stats
    const summary = getMonthlySummary(user.id, today.slice(0, 7));

    if (monthPresentEl) monthPresentEl.textContent = summary.present;
    if (monthLateEl) monthLateEl.textContent = summary.late;
    if (monthHalfDayEl) monthHalfDayEl.textContent = summary.halfDays;
    if (monthAbsentEl) monthAbsentEl.textContent = summary.absentDays;

    renderMyHistory();
  }

  function renderMyHistory() {
    if (!myHistoryBody) return;

    const records = getAttendance()
      .filter((record) => String(record.employeeId) === String(user.id))
      .sort((a, b) => b.date.localeCompare(a.date));

    myHistoryBody.innerHTML = "";

    if (records.length === 0) {
      const row = document.createElement("tr");
      row.className = "empty-row";

      const cell = createCell("No attendance yet. Check in to get started.");
      cell.colSpan = 5;

      row.appendChild(cell);
      myHistoryBody.appendChild(row);
      return;
    }

    records.forEach((record) => {
      const row = document.createElement("tr");

      row.append(
        createCell(formatDate(record.date)),
        createCell(record.checkIn || "-"),
        createCell(record.checkOut || "-"),
        createCell(getWorkHours(record)),
        createCell(createAttendanceBadge(record.status)),
      );

      myHistoryBody.appendChild(row);
    });
  }

  /* ---------- Admin: dashboard ---------- */

  function createEmployeeCell(employee) {
    const wrapper = document.createElement("div");
    wrapper.className = "emp-cell";

    const avatar = document.createElement("span");
    avatar.className = "avatar avatar-sm";
    avatar.textContent = getInitials(employee.name);

    const info = document.createElement("div");

    const name = document.createElement("strong");
    name.textContent = employee.name;

    const email = document.createElement("small");
    email.textContent = employee.email;

    info.append(name, email);
    wrapper.append(avatar, info);

    return wrapper;
  }

  function renderAdminView() {
    if (!attendanceTableBody && !totalEmployeesEl) return;

    const employees = getEmployees();
    const today = getToday();
    const settings = getSettings();

    const todayRecords = getAttendance().filter(
      (record) => record.date === today,
    );
    const recordByEmployee = new Map(
      todayRecords.map((record) => [String(record.employeeId), record]),
    );

    const onLeaveIds = new Set(
      getLeaves()
        .filter(
          (leave) =>
            leave.status === "Approved" &&
            leave.from <= today &&
            leave.to >= today,
        )
        .map((leave) => String(leave.employeeId)),
    );

    const isWorkingDay = settings.workingDays.includes(new Date().getDay());

    // Stats cards
    if (totalEmployeesEl) totalEmployeesEl.textContent = employees.length;
    if (presentTodayEl) presentTodayEl.textContent = todayRecords.length;
    if (lateTodayEl) {
      lateTodayEl.textContent = todayRecords.filter(
        (record) => record.status === "Late",
      ).length;
    }
    if (onLeaveTodayEl) {
      onLeaveTodayEl.textContent = employees.filter((employee) =>
        onLeaveIds.has(String(employee.id)),
      ).length;
    }

    // Aaj ki attendance table, har employee ki ek row
    if (attendanceTableBody) {
      attendanceTableBody.innerHTML = "";

      if (employees.length === 0) {
        const row = document.createElement("tr");
        row.className = "empty-row";

        const cell = createCell(
          "No employees yet. Add employees to see attendance.",
        );
        cell.colSpan = 5;

        row.appendChild(cell);
        attendanceTableBody.appendChild(row);
      }

      employees.forEach((employee) => {
        const record = recordByEmployee.get(String(employee.id));

        let status = record?.status;
        if (!status) {
          if (onLeaveIds.has(String(employee.id))) status = "On Leave";
          else status = isWorkingDay ? "Not checked in" : "Day off";
        }

        const row = document.createElement("tr");

        row.append(
          createCell(createEmployeeCell(employee)),
          createCell(employee.department),
          createCell(record?.checkIn || "-"),
          createCell(record?.checkOut || "-"),
          createCell(createAttendanceBadge(status)),
        );

        attendanceTableBody.appendChild(row);
      });
    }

    renderWeekChart(employees.length);
  }

  // Last 7 din mein roz kitne log aaye (simple bar chart, bina library ke)
  function renderWeekChart(totalEmployees) {
    if (!weekChartEl) return;

    const attendance = getAttendance();
    const scale = Math.max(totalEmployees, 1);

    weekChartEl.innerHTML = "";

    for (let offset = 6; offset >= 0; offset--) {
      const date = new Date();
      date.setDate(date.getDate() - offset);

      const dateString = toDateString(date);
      const count = attendance.filter(
        (record) => record.date === dateString,
      ).length;

      const column = document.createElement("div");
      column.className = "bar-col";
      if (offset === 0) column.classList.add("today");

      const value = document.createElement("span");
      value.className = "bar-value";
      value.textContent = count;

      const track = document.createElement("div");
      track.className = "bar-track";

      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = `${Math.min((count / scale) * 100, 100)}%`;
      track.appendChild(bar);

      const label = document.createElement("span");
      label.className = "bar-label";
      label.textContent = date.toLocaleDateString("en-GB", {
        weekday: "short",
      });

      column.append(value, track, label);
      weekChartEl.appendChild(column);
    }
  }

  /* ---------- Start ---------- */

  function renderAll() {
    renderEmployeeView();
    renderAdminView();
  }

  checkInBtn?.addEventListener("click", checkIn);
  checkOutBtn?.addEventListener("click", checkOut);

  // Doosre tab mein data badle to ye page bhi update ho jaye
  window.addEventListener("storage", (event) => {
    const watched = [
      STORAGE_KEYS.attendance,
      STORAGE_KEYS.leaves,
      STORAGE_KEYS.employees,
      STORAGE_KEYS.settings,
    ];

    if (watched.includes(event.key)) renderAll();
  });

  // Live clock
  if (liveClockEl) {
    const tick = () => {
      liveClockEl.textContent = new Date().toLocaleTimeString("en-GB");
    };

    tick();
    setInterval(tick, 1000);
  }

  renderAll();
});

// Payslip ka hisaab: daily salary = monthly salary / mahine ke working days.
// Absent = 1 din ki katoti, Half Day = aadhe din ki katoti.
// Late par koi katoti nahi.
function calculatePayslip(employee, month) {
  const summary = getMonthlySummary(employee.id, month);
  const round = (value) => Math.round(value * 100) / 100;

  const monthlySalary = Number(employee.salary) || 0;
  const dailySalary =
    summary.monthWorkingDays > 0 ? monthlySalary / summary.monthWorkingDays : 0;

  const absentDeduction = summary.absentDays * dailySalary;
  const halfDayDeduction = summary.halfDays * dailySalary * 0.5;
  const totalDeduction = absentDeduction + halfDayDeduction;

  return {
    ...summary,
    monthlySalary: round(monthlySalary),
    dailySalary: round(dailySalary),
    absentDeduction: round(absentDeduction),
    halfDayDeduction: round(halfDayDeduction),
    totalDeduction: round(totalDeduction),
    netSalary: round(Math.max(monthlySalary - totalDeduction, 0)),
  };
}
