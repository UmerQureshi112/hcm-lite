/**
 * HCM Lite - Admin Dashboard Module (js/dashboard.js)
 * Calculates and updates all metrics, attendance rosters, and leave pipelines dynamically from localStorage.
 */

const DashboardModule = {
  init() {
    this.renderMetrics();
    this.renderTodayAttendanceTable();
    this.renderRecentLeaves();
  },

  renderMetrics() {
    const employees = StorageService.getEmployees();
    const activeEmployees = employees.filter((e) => e.status === "Active");
    const todayStr = new Date().toISOString().split("T")[0];
    const todayLogs = StorageService.getTodayAttendance(todayStr);
    const leaves = StorageService.getLeaves();
    const company = StorageService.getCompany() || {};
    const currency = company.currency || "$";

    const elTotalEmployees = document.getElementById("statTotalEmployees");
    const elActiveEmployeesSub = document.getElementById(
      "statActiveEmployeesSub",
    );
    if (elTotalEmployees) elTotalEmployees.textContent = employees.length;
    if (elActiveEmployeesSub)
      elActiveEmployeesSub.textContent = `${activeEmployees.length} Active`;

    const presentCount = todayLogs.filter((a) => a.status === "Present").length;
    const elPresent = document.getElementById("statPresentToday");
    if (elPresent) elPresent.textContent = presentCount;

    const lateCount = todayLogs.filter((a) => a.status === "Late").length;
    const elLate = document.getElementById("statLateToday");
    if (elLate) elLate.textContent = lateCount;

    const halfDayCount = todayLogs.filter(
      (a) => a.status === "HalfDay" || a.status === "Half Day",
    ).length;
    const elHalfDay = document.getElementById("statHalfDayToday");
    if (elHalfDay) elHalfDay.textContent = halfDayCount;

    const pendingLeaves = leaves.filter((l) => l.status === "Pending").length;
    const elPendingLeaves = document.getElementById("statPendingLeaves");
    if (elPendingLeaves) elPendingLeaves.textContent = pendingLeaves;

    const totalPayroll = activeEmployees.reduce(
      (sum, emp) => sum + (parseFloat(emp.monthlySalary) || 0),
      0,
    );
    const elPayroll = document.getElementById("statTotalPayroll");
    if (elPayroll) {
      elPayroll.textContent = `${currency}${totalPayroll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  },

  renderTodayAttendanceTable() {
    const tableBody = document.getElementById("todayAttendanceTableBody");
    const emptyState = document.getElementById("todayAttendanceEmptyState");
    const tableContainer = document.getElementById("todayAttendanceContainer");

    if (!tableBody) return;

    const todayStr = new Date().toISOString().split("T")[0];
    const logs = StorageService.getTodayAttendance(todayStr);
    const employees = StorageService.getEmployees();

    if (logs.length === 0) {
      tableBody.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      if (tableContainer) tableContainer.style.display = "none";
      return;
    }

    if (emptyState) emptyState.style.display = "none";
    if (tableContainer) tableContainer.style.display = "block";

    tableBody.innerHTML = logs
      .map((log) => {
        const emp = employees.find((e) => e.employeeId === log.employeeId);
        const empName = emp ? emp.fullName : log.employeeId;
        const dept = emp ? emp.department : "-";

        const statusBadge =
          log.status === "Present"
            ? "badge-present"
            : log.status === "Late"
              ? "badge-late"
              : "badge-half-day";

        const worked =
          log.workedMinutes > 0
            ? AttendanceModule.formatMinutesToHours(log.workedMinutes)
            : log.checkOutTime
              ? "0h"
              : "In progress";

        return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--text-primary);">${this.escapeHtml(empName)}</div>
            <div style="font-size: 0.775rem; color: var(--text-muted);">${log.employeeId} &bull; ${this.escapeHtml(dept)}</div>
          </td>
          <td>${log.checkInTime}</td>
          <td>${log.checkOutTime || '<span style="color: var(--text-muted);">Clocked in</span>'}</td>
          <td><strong>${worked}</strong></td>
          <td>
            <span class="badge ${statusBadge}">
              <span class="badge-dot"></span>
              ${log.status}
            </span>
          </td>
        </tr>
      `;
      })
      .join("");
  },

  renderRecentLeaves() {
    const tableBody = document.getElementById("recentLeavesTableBody");
    const emptyState = document.getElementById("recentLeavesEmptyState");
    const tableContainer = document.getElementById("recentLeavesContainer");

    if (!tableBody) return;

    const leaves = StorageService.getLeaves();
    const employees = StorageService.getEmployees();

    const recent = [...leaves]
      .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
      .slice(0, 5);

    if (recent.length === 0) {
      tableBody.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      if (tableContainer) tableContainer.style.display = "none";
      return;
    }

    if (emptyState) emptyState.style.display = "none";
    if (tableContainer) tableContainer.style.display = "block";

    tableBody.innerHTML = recent
      .map((leave) => {
        const emp = employees.find((e) => e.employeeId === leave.employeeId);
        const empName = emp ? emp.fullName : leave.employeeId;

        const statusBadge =
          leave.status === "Approved"
            ? "badge-approved"
            : leave.status === "Rejected"
              ? "badge-rejected"
              : "badge-pending";

        return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--text-primary);">${this.escapeHtml(empName)}</div>
            <div style="font-size: 0.775rem; color: var(--text-muted);">${leave.leaveType} &bull; ${leave.daysCount} day(s)</div>
          </td>
          <td>${leave.startDate} to ${leave.endDate}</td>
          <td>
            <span class="badge ${statusBadge}">
              <span class="badge-dot"></span>
              ${leave.status}
            </span>
          </td>
          <td>
            <a href="leaves.html" class="btn btn-secondary btn-sm">Review</a>
          </td>
        </tr>
      `;
      })
      .join("");
  },

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },
};

window.DashboardModule = DashboardModule;
