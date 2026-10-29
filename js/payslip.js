/**
 * HCM Lite - Monthly Payslip Module (js/payslip.js)
 * Generates transparent, verifiable monthly salary slips from actual attendance & leave records.
 * Provides documented salary deduction math and print/PDF support.
 */

const PayslipModule = {
  currentEmployeeId: null,
  selectedYear: new Date().getFullYear(),
  selectedMonth: new Date().getMonth() + 1,

  init() {
    const session = AuthService.getSession();
    if (!session) return;

    this.setupControls(session);
    this.bindEvents();
    this.generatePayslip();
  },

  setupControls(session) {
    const empSelect = document.getElementById("payslipEmployeeSelect");
    const monthSelect = document.getElementById("payslipMonthSelect");
    const yearSelect = document.getElementById("payslipYearSelect");
    const empSelectorGroup = document.getElementById(
      "payslipEmployeeSelectorGroup",
    );

    const currentYear = new Date().getFullYear();
    if (yearSelect) {
      yearSelect.innerHTML = "";
      for (let y = currentYear - 2; y <= currentYear + 1; y++) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
      }
    }

    if (monthSelect) {
      monthSelect.value = String(new Date().getMonth() + 1);
    }

    if (session.role === "employee") {
      this.currentEmployeeId = session.employeeId;
      if (empSelectorGroup) {
        empSelectorGroup.style.display = "none";
      }
    } else {
      const employees = StorageService.getEmployees();
      if (empSelect) {
        empSelect.innerHTML = "";
        if (employees.length === 0) {
          empSelect.innerHTML = '<option value="">No employees found</option>';
        } else {
          employees.forEach((emp) => {
            const opt = document.createElement("option");
            opt.value = emp.employeeId;
            opt.textContent = `${emp.fullName} (${emp.employeeId}) - ${emp.department}`;
            empSelect.appendChild(opt);
          });
          this.currentEmployeeId = employees[0].employeeId;
        }
      }
    }
  },

  bindEvents() {
    const empSelect = document.getElementById("payslipEmployeeSelect");
    const monthSelect = document.getElementById("payslipMonthSelect");
    const yearSelect = document.getElementById("payslipYearSelect");
    const printBtn = document.getElementById("printPayslipBtn");

    empSelect?.addEventListener("change", (e) => {
      this.currentEmployeeId = e.target.value;
      this.generatePayslip();
    });

    monthSelect?.addEventListener("change", (e) => {
      this.selectedMonth = parseInt(e.target.value, 10);
      this.generatePayslip();
    });

    yearSelect?.addEventListener("change", (e) => {
      this.selectedYear = parseInt(e.target.value, 10);
      this.generatePayslip();
    });

    printBtn?.addEventListener("click", () => {
      window.print();
    });
  },

  generatePayslip() {
    const container = document.getElementById("payslipDocumentContainer");
    const emptyState = document.getElementById("payslipEmptyState");
    if (!container) return;

    if (!this.currentEmployeeId) {
      container.style.display = "none";
      if (emptyState) emptyState.style.display = "block";
      return;
    }

    const employee = StorageService.getEmployeeByEmpId(this.currentEmployeeId);
    if (!employee) {
      container.style.display = "none";
      if (emptyState) emptyState.style.display = "block";
      return;
    }

    container.style.display = "block";
    if (emptyState) emptyState.style.display = "none";

    const company = StorageService.getCompany() || {};
    const currency = company.currency || "$";
    const standardWorkDays = company.workDaysPerMonth || 22;
    const baseSalary = parseFloat(employee.monthlySalary) || 0;

    const targetMonthStr = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, "0")}`;
    const allAttendance = StorageService.getEmployeeAttendance(
      employee.employeeId,
    );
    const monthAttendance = allAttendance.filter(
      (a) => a.date && a.date.startsWith(targetMonthStr),
    );

    const presentDays = monthAttendance.filter(
      (a) => a.status === "Present",
    ).length;
    const lateDays = monthAttendance.filter((a) => a.status === "Late").length;
    const halfDays = monthAttendance.filter(
      (a) => a.status === "Half Day" || a.status === "HalfDay",
    ).length;

    const allLeaves = StorageService.getEmployeeLeaves(employee.employeeId);
    const approvedLeaves = allLeaves.filter(
      (l) =>
        l.status === "Approved" &&
        l.startDate &&
        l.startDate.startsWith(targetMonthStr),
    );
    const paidLeaveDays = approvedLeaves
      .filter((l) => l.leaveType !== "Unpaid")
      .reduce((sum, l) => sum + (parseInt(l.daysCount, 10) || 0), 0);
    const unpaidLeaveDays = approvedLeaves
      .filter((l) => l.leaveType === "Unpaid")
      .reduce((sum, l) => sum + (parseInt(l.daysCount, 10) || 0), 0);

    const dailyRate = standardWorkDays > 0 ? baseSalary / standardWorkDays : 0;
    const halfDayDeduction = halfDays * (dailyRate * 0.5);
    const unpaidLeaveDeduction = unpaidLeaveDays * dailyRate;
    const totalDeductions = halfDayDeduction + unpaidLeaveDeduction;
    const netSalary = Math.max(0, baseSalary - totalDeductions);

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const monthName = monthNames[this.selectedMonth - 1];

    container.innerHTML = `
      <div class="payslip-container">
        <!-- Letterhead Header -->
        <div class="payslip-header">
          <div>
            <div class="payslip-company-title">${this.escapeHtml(company.companyName || "HCM Lite")}</div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
              Official Monthly Salary Statement
            </p>
          </div>
          <div style="text-align: right;">
            <div class="payslip-badge">PAYSLIP</div>
            <div style="font-weight: 700; font-size: 1.15rem; color: var(--text-primary); margin-top: 0.25rem;">
              ${monthName} ${this.selectedYear}
            </div>
          </div>
        </div>

        <!-- Employee & Period Metadata -->
        <div class="payslip-meta-grid">
          <div class="payslip-meta-item">
            <div class="label">Employee Name</div>
            <div class="value">${this.escapeHtml(employee.fullName)}</div>
          </div>
          <div class="payslip-meta-item">
            <div class="label">Employee ID</div>
            <div class="value font-mono">${this.escapeHtml(employee.employeeId)}</div>
          </div>
          <div class="payslip-meta-item">
            <div class="label">Department</div>
            <div class="value">${this.escapeHtml(employee.department)}</div>
          </div>
          <div class="payslip-meta-item">
            <div class="label">Job Title</div>
            <div class="value">${this.escapeHtml(employee.jobTitle)}</div>
          </div>
          <div class="payslip-meta-item">
            <div class="label">Joining Date</div>
            <div class="value">${employee.joiningDate || "-"}</div>
          </div>
          <div class="payslip-meta-item">
            <div class="label">Standard Work Days</div>
            <div class="value">${standardWorkDays} Days (Daily Rate: ${currency}${dailyRate.toFixed(2)})</div>
          </div>
        </div>

        <!-- Attendance & Activity Summary -->
        <div class="payslip-section-title">Attendance & Activity Summary</div>
        <table class="payslip-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Recorded Count</th>
              <th>Impact on Payroll</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>On-Time Days (Present)</td>
              <td><strong>${presentDays}</strong> day(s)</td>
              <td>Full Day Pay</td>
            </tr>
            <tr>
              <td>Late Arrivals</td>
              <td><strong>${lateDays}</strong> day(s)</td>
              <td>Full Day Pay (No penalty deducted)</td>
            </tr>
            <tr>
              <td>Half-Days</td>
              <td><strong>${halfDays}</strong> day(s)</td>
              <td>0.5 Day deduction per instance (-${currency}${halfDayDeduction.toFixed(2)})</td>
            </tr>
            <tr>
              <td>Approved Paid Leaves</td>
              <td><strong>${paidLeaveDays}</strong> day(s)</td>
              <td>Fully Covered by Quota ($0 deduction)</td>
            </tr>
            ${
              unpaidLeaveDays > 0
                ? `
            <tr>
              <td>Approved Unpaid Leaves</td>
              <td><strong>${unpaidLeaveDays}</strong> day(s)</td>
              <td>1.0 Day deduction per instance (-${currency}${unpaidLeaveDeduction.toFixed(2)})</td>
            </tr>
            `
                : ""
            }
          </tbody>
        </table>

        <!-- Earnings & Deductions Tables -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.5rem;">
          <div>
            <div class="payslip-section-title">Earnings</div>
            <table class="payslip-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Monthly Base Salary</td>
                  <td class="text-right font-mono">${currency}${baseSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td><strong>Total Earnings</strong></td>
                  <td class="text-right font-mono"><strong>${currency}${baseSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <div class="payslip-section-title">Deductions</div>
            <table class="payslip-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Half-Day Deductions (${halfDays} × 0.5 day)</td>
                  <td class="text-right font-mono">${currency}${halfDayDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>Unpaid Leave Deductions (${unpaidLeaveDays} day(s))</td>
                  <td class="text-right font-mono">${currency}${unpaidLeaveDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td><strong>Total Deductions</strong></td>
                  <td class="text-right font-mono" style="color: #ef4444;"><strong>${currency}${totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Net Salary Box -->
        <div class="payslip-net-box">
          <div>
            <div class="payslip-net-label">NET TAKE-HOME PAY</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
              Earnings minus documented deductions for ${monthName} ${this.selectedYear}
            </div>
          </div>
          <div class="payslip-net-amount font-mono">
            ${currency}${netSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <!-- Documentation & Policy Note -->
        <div class="payslip-formula-note">
          <strong>Payroll Policy & Formula Documentation:</strong>
          Daily Rate = Monthly Base Salary (${currency}${baseSalary.toFixed(2)}) ÷ Standard Work Days (${standardWorkDays}) = ${currency}${dailyRate.toFixed(2)}/day.<br>
          Half-day occurrences deduct 50% of the daily rate. Late arrivals are noted for punctuality and do not incur automatic wage deduction. Net Pay = Base Salary - Deductions.
        </div>
      </div>
    `;
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

window.PayslipModule = PayslipModule;
