
/* =========================================================
   HCM Lite - Attendance Management
   Works with admin.html, employee.html and payslip.html
   ========================================================= */

function getAttendanceStatus(checkInTime, settings = getSettings()) {
  const start = timeToMinutes(settings.officeStartTime || "09:00");
  const arrived = timeToMinutes(checkInTime);
  const grace = Number(settings.graceMinutes) || 0;
  const halfDayAfter = Number(settings.halfDayAfterMinutes) || 120;

  if (arrived <= start + grace) return "Present";
  if (arrived <= start + halfDayAfter) return "Late";
  return "Half Day";
}

function getApprovedLeaveOn(employeeId, date) {
  return getLeaves().find(
    (leave) =>
      String(leave.employeeId) === String(employeeId) &&
      String(leave.status).toLowerCase() === "approved" &&
      leave.from <= date &&
      leave.to >= date
  );
}

function getWorkHours(record) {
  if (!record || !record.checkIn) return "-";

  if (!record.checkOut) {
    return record.date === getToday() ? "In progress" : "No check-out";
  }

  const start = timeToMinutes(record.checkIn);
  const end = timeToMinutes(record.checkOut);
  const minutes = end - start;

  if (minutes < 0) return "-";

  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

const ATTENDANCE_BADGES = {
  Present: "badge-success",
  Late: "badge-warning",
  "Half Day": "badge-danger",
  "On Leave": "badge-info",
  "Not checked in": "badge-muted",
  "Day off": "badge-muted",
};

function createAttendanceBadge(status) {
  const badge = document.createElement("span");
  badge.className = `badge ${ATTENDANCE_BADGES[status] || "badge-muted"}`;
  badge.textContent = status || "Unknown";
  return badge;
}

/* =========================================================
   Monthly attendance summary
   ========================================================= */

function getMonthlySummary(employeeId, month) {
  const settings = getSettings();
  const [year, monthNumber] = String(month).split("-").map(Number);

  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) {
    return {
      monthWorkingDays: 0,
      workingDays: 0,
      countedDays: 0,
      present: 0,
      presentDays: 0,
      late: 0,
      lateDays: 0,
      halfDays: 0,
      leaveDays: 0,
      absentDays: 0,
    };
  }

  const lastDay = new Date(year, monthNumber, 0).getDate();
  const today = getToday();

  const employee = getEmployees().find(
    (item) => String(item.id) === String(employeeId)
  );

  const joined =
    employee?.joinDate ||
    employee?.joiningDate ||
    (employee?.createdAt
      ? toDateString(new Date(employee.createdAt))
      : "");

  const records = {};

  getAttendance()
    .filter((record) => String(record.employeeId) === String(employeeId))
    .forEach((record) => {
      records[record.date] = record;
    });

  const approvedLeaves = getLeaves().filter(
    (leave) =>
      String(leave.employeeId) === String(employeeId) &&
      String(leave.status).toLowerCase() === "approved"
  );

  const workingDays = Array.isArray(settings.workingDays)
    ? settings.workingDays
    : [1, 2, 3, 4, 5];

  const summary = {
    monthWorkingDays: 0,
    workingDays: 0,
    countedDays: 0,
    present: 0,
    presentDays: 0,
    late: 0,
    lateDays: 0,
    halfDays: 0,
    leaveDays: 0,
    absentDays: 0,
  };

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, monthNumber - 1, day);
    const dateString = toDateString(date);

    if (!workingDays.includes(date.getDay())) continue;

    summary.monthWorkingDays++;
    summary.workingDays++;

    // Do not count future days or days before the employee joined.
    if (dateString > today || (joined && dateString < joined)) continue;

    const record = records[dateString];

    if (record) {
      summary.countedDays++;

      if (record.status === "Present") {
        summary.present++;
        summary.presentDays++;
      } else if (record.status === "Late") {
        summary.late++;
        summary.lateDays++;
      } else if (record.status === "Half Day") {
        summary.halfDays++;
      } else if (record.status === "On Leave") {
        summary.leaveDays++;
      } else {
        // Unknown recorded status is counted as a half day for reporting.
        summary.halfDays++;
      }

      continue;
    }

    const onLeave = approvedLeaves.some(
      (leave) => leave.from <= dateString && leave.to >= dateString
    );

    if (onLeave) {
      // Approved leave is paid and never creates an absence deduction.
      summary.countedDays++;
      summary.leaveDays++;
      continue;
    }

    // Today's attendance is still in progress.
    if (dateString === today) continue;

    summary.countedDays++;
    summary.absentDays++;
  }

  return summary;
}

/* =========================================================
   Page setup
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();

  // Employee dashboard
  const currentDateEl = document.getElementById("currentDate");
  const employeeNameEl = document.getElementById("employeeName");
  const welcomeNameEl = document.getElementById("welcomeName");
  const designationEl = document.getElementById("employeeDesignation");

  const checkInTimeEl = document.getElementById("checkInTime");
  const checkOutTimeEl = document.getElementById("checkOutTime");
  const workHoursEl = document.getElementById("workHours");
  const attendanceStatusEl = document.getElementById("attendanceStatus");
  const myAttendanceTable = document.getElementById("myAttendanceTable");

  const checkInBtn = document.getElementById("checkInBtn");
  const checkOutBtn = document.getElementById("checkOutBtn");

  const profileIdEl = document.getElementById("profileEmployeeId");
  const profileEmailEl = document.getElementById("profileEmail");
  const profileDepartmentEl = document.getElementById("profileDepartment");
  const profileDesignationEl = document.getElementById("profileDesignation");
  const monthlySalaryEl = document.getElementById("monthlySalary");
  const leaveBalanceEl = document.getElementById("leaveBalance");

  // Optional monthly statistics
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
        String(record.employeeId) === String(user.id) &&
        record.date === date
    );
  }

  function renderEmployeeView() {
    if (!user || user.role !== "employee") return;

    const today = getToday();
    const record = findMyRecord(today);

    const employee = getEmployees().find(
      (item) => String(item.id) === String(user.id)
    ) || user;

    if (currentDateEl) {
      currentDateEl.textContent = new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }

    if (employeeNameEl) {
      employeeNameEl.textContent = employee.name || "Employee";
    }

    if (welcomeNameEl) {
      welcomeNameEl.textContent = employee.name || "Employee";
    }

    if (designationEl) {
      designationEl.textContent =
        employee.designation || "Your work overview";
    }

    if (checkInTimeEl) {
      checkInTimeEl.textContent = record?.checkIn || "--:--";
    }

    if (checkOutTimeEl) {
      checkOutTimeEl.textContent = record?.checkOut || "--:--";
    }

    if (workHoursEl) {
      workHoursEl.textContent = record ? getWorkHours(record) : "0h 0m";
    }

    if (attendanceStatusEl) {
      const onLeave = Boolean(getApprovedLeaveOn(user.id, today));
      attendanceStatusEl.textContent =
        record?.status || (onLeave ? "On Leave" : "Not checked in");
    }

    if (checkInBtn) {
      checkInBtn.disabled =
        Boolean(record) || Boolean(getApprovedLeaveOn(user.id, today));
    }

    if (checkOutBtn) {
      checkOutBtn.disabled = !record || Boolean(record.checkOut);
    }

    if (profileIdEl) profileIdEl.textContent = employee.id || "—";
    if (profileEmailEl) profileEmailEl.textContent = employee.email || "—";
    if (profileDepartmentEl) {
      profileDepartmentEl.textContent = employee.department || "—";
    }
    if (profileDesignationEl) {
      profileDesignationEl.textContent = employee.designation || "—";
    }

    if (monthlySalaryEl) {
      monthlySalaryEl.textContent = formatCurrency(Number(employee.salary) || 0);
    }

    if (leaveBalanceEl && typeof getLeaveBalance === "function") {
      const balance = getLeaveBalance(employee.id);

      leaveBalanceEl.textContent =
        typeof balance === "number"
          ? balance
          : balance?.remaining ?? balance?.available ?? 0;
    }

    const summary = getMonthlySummary(user.id, today.slice(0, 7));

    if (monthPresentEl) monthPresentEl.textContent = summary.presentDays;
    if (monthLateEl) monthLateEl.textContent = summary.lateDays;
    if (monthHalfDayEl) monthHalfDayEl.textContent = summary.halfDays;
    if (monthAbsentEl) monthAbsentEl.textContent = summary.absentDays;

    renderMyHistory();
  }

  function renderMyHistory() {
    if (!myAttendanceTable || !user || user.role !== "employee") return;

    const records = getAttendance()
      .filter((record) => String(record.employeeId) === String(user.id))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    myAttendanceTable.innerHTML = "";

    if (records.length === 0) {
      const row = document.createElement("tr");
      const cell = createCell("No attendance yet. Check in to get started.");
      cell.colSpan = 5;
      row.appendChild(cell);
      myAttendanceTable.appendChild(row);
      return;
    }

    records.forEach((record) => {
      const row = document.createElement("tr");

      row.append(
        createCell(record.date ? formatDate(record.date) : "—"),
        createCell(record.checkIn || "-"),
        createCell(record.checkOut || "-"),
        createCell(getWorkHours(record)),
        createCell(createAttendanceBadge(record.status))
      );

      myAttendanceTable.appendChild(row);
    });
  }

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
      employeeName: user.name || user.fullName || "Employee",
      date: today,
      checkIn: time,
      checkOut: "",
      status,
    });

    if (!saveData(STORAGE_KEYS.attendance, attendance)) {
      showToast("Could not save attendance. Please try again.", "error");
      return;
    }

    showToast(
      `Checked in at ${time} (${status})`,
      status === "Present" ? "success" : "info"
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
        String(item.employeeId) === String(user.id) &&
        item.date === getToday()
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
      showToast("Could not save check-out. Please try again.", "error");
      return;
    }

    showToast(`Checked out at ${record.checkOut}`, "success");
    renderAll();
  }

  function createEmployeeCell(employee) {
    const wrapper = document.createElement("div");
    wrapper.className = "emp-cell";

    const avatar = document.createElement("span");
    avatar.className = "avatar avatar-sm";
    avatar.textContent = getInitials(employee.name);

    const info = document.createElement("div");

    const name = document.createElement("strong");
    name.textContent = employee.name || "Employee";

    const email = document.createElement("small");
    email.textContent = employee.email || "";

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
      (record) => record.date === today
    );

    const recordByEmployee = new Map(
      todayRecords.map((record) => [String(record.employeeId), record])
    );

    const onLeaveIds = new Set(
      getLeaves()
        .filter(
          (leave) =>
            String(leave.status).toLowerCase() === "approved" &&
            leave.from <= today &&
            leave.to >= today
        )
        .map((leave) => String(leave.employeeId))
    );

    const workingDays = Array.isArray(settings.workingDays)
      ? settings.workingDays
      : [1, 2, 3, 4, 5];

    const isWorkingDay = workingDays.includes(new Date().getDay());

    if (totalEmployeesEl) {
      totalEmployeesEl.textContent = employees.length;
    }

    if (presentTodayEl) {
      presentTodayEl.textContent = todayRecords.filter(
        (record) => record.status === "Present"
      ).length;
    }

    if (lateTodayEl) {
      lateTodayEl.textContent = todayRecords.filter(
        (record) => record.status === "Late"
      ).length;
    }

    if (onLeaveTodayEl) {
      onLeaveTodayEl.textContent = employees.filter(
        (employee) => onLeaveIds.has(String(employee.id))
      ).length;
    }

    if (attendanceTableBody) {
      attendanceTableBody.innerHTML = "";

      if (employees.length === 0) {
        const row = document.createElement("tr");
        const cell = createCell(
          "No employees yet. Add employees to see attendance."
        );
        cell.colSpan = 5;
        row.appendChild(cell);
        attendanceTableBody.appendChild(row);
      }

      employees.forEach((employee) => {
        const record = recordByEmployee.get(String(employee.id));
        let status = record?.status;

        if (!status) {
          if (onLeaveIds.has(String(employee.id))) {
            status = "On Leave";
          } else {
            status = isWorkingDay ? "Not checked in" : "Day off";
          }
        }

        const row = document.createElement("tr");

        row.append(
          createCell(createEmployeeCell(employee)),
          createCell(employee.department || "-"),
          createCell(record?.checkIn || "-"),
          createCell(record?.checkOut || "-"),
          createCell(createAttendanceBadge(status))
        );

        attendanceTableBody.appendChild(row);
      });
    }

    renderWeekChart(employees.length);
  }

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
        (record) => record.date === dateString
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

  function renderAll() {
    renderEmployeeView();
    renderAdminView();
  }

  checkInBtn?.addEventListener("click", checkIn);
  checkOutBtn?.addEventListener("click", checkOut);

  window.addEventListener("storage", (event) => {
    const watched = [
      STORAGE_KEYS.attendance,
      STORAGE_KEYS.leaves,
      STORAGE_KEYS.employees,
      STORAGE_KEYS.settings,
    ];

    if (watched.includes(event.key)) renderAll();
  });

  renderAll();
});

/* =========================================================
   Payroll calculation
   Rules:
   - Present: no deduction
   - Late: no deduction
   - Half Day: half-day deduction
   - Absent: full-day deduction
   - Approved leave: paid, no deduction
   ========================================================= */

function calculatePayslip(employee, month) {
  const employeeId = employee.id ?? employee.employeeId;
  const summary = getMonthlySummary(employeeId, month);
  const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  const monthlySalary = Math.max(0, Number(employee.salary ?? employee.monthlySalary) || 0);

  // Use the working-day count for the selected calendar month.
  const dailySalary =
    summary.monthWorkingDays > 0
      ? monthlySalary / summary.monthWorkingDays
      : 0;

  // Late attendance and approved paid leave do not reduce salary.
  const absentDeduction = summary.absentDays * dailySalary;
  const halfDayDeduction = summary.halfDays * dailySalary * 0.5;
  const totalDeduction = absentDeduction + halfDayDeduction;

  const netSalary = Math.max(monthlySalary - totalDeduction, 0);

  return {
    ...summary,
    monthlySalary: round(monthlySalary),
    dailySalary: round(dailySalary),
    absentDeduction: round(absentDeduction),
    halfDayDeduction: round(halfDayDeduction),
    totalDeduction: round(totalDeduction),
    netSalary: round(netSalary),
  };
}
