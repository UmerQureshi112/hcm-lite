// js/payslip.js
// Payslip page: admin kisi bhi employee ki, employee sirf apni payslip dekhta hai.
// Hisab attendance.js ke calculatePayslip() se aata hai, taake helper aur
// payslip ke numbers hamesha barabar rahein.

document.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();
  const sheet = document.getElementById("payslipContent");

  // Sirf payslip page par chalao
  if (!user || !sheet) return;

  const isAdmin = user.role === "admin";

  const monthInput = document.getElementById("payslipMonthInput");
  const employeeField = document.getElementById("employeeField");
  const employeeSelect = document.getElementById("payslipEmployeeSelect");
  const controlsHint = document.getElementById("controlsHint");
  const emptyEl = document.getElementById("payslipEmpty");
  const printBtn = document.getElementById("printPayslipBtn");

  const text = (id, value) => {
    document.getElementById(id).textContent = value;
  };

  // Role ke hisab se sidebar dikhao
  document.querySelectorAll("[data-only-role]").forEach((el) => {
    el.hidden = el.dataset.onlyRole !== user.role;
  });

  function showEmpty(message) {
    sheet.hidden = true;
    emptyEl.textContent = message;
    emptyEl.hidden = false;
    printBtn.disabled = true;
  }

  function getSelectedEmployee() {
    const employees = getEmployees();

    // Employee ke session mein salary nahi hoti, isliye id se asal record dhoondo
    const id = isAdmin ? employeeSelect.value : user.id;
    return employees.find((item) => String(item.id) === String(id));
  }

  function render() {
    const month = monthInput.value;
    const employee = getSelectedEmployee();

    emptyEl.hidden = true;

    if (!employee) {
      showEmpty(
        isAdmin
          ? "No employees yet. Add an employee first to see a payslip."
          : "Your employee record was not found.",
      );
      return;
    }

    if (!month) {
      showEmpty("Please select a month.");
      return;
    }

    const slip = calculatePayslip(employee, month);
    const label = new Date(`${month}-01T00:00:00`).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });

    text("payslipCompany", getCompanyName());
    text("payslipMonth", label);
    text("payslipEmployee", employee.name);
    text("payslipDepartment", employee.department);
    text("payslipEmail", employee.email);
    text(
      "payslipJoined",
      employee.createdAt ? formatDate(employee.createdAt.slice(0, 10)) : "-",
    );

    text("workingDays", slip.monthWorkingDays);
    text("countedDays", slip.countedDays);
    text("presentDays", slip.present);
    text("lateDays", slip.late);
    text("halfDays", slip.halfDays);
    text("leaveDays", slip.leaveDays);
    text("absentDays", slip.absentDays);

    text("monthlySalary", formatCurrency(slip.monthlySalary));
    text("dailySalary", formatCurrency(slip.dailySalary));
    text("absentDeduction", `- ${formatCurrency(slip.absentDeduction)}`);
    text("halfDayDeduction", `- ${formatCurrency(slip.halfDayDeduction)}`);
    text("salaryDeduction", `- ${formatCurrency(slip.totalDeduction)}`);
    text("netSalary", formatCurrency(slip.netSalary));

    let note =
      "Daily salary = monthly salary ÷ working days. Absent = 1 day deducted, half day = 0.5 day deducted.";

    if (month === getToday().slice(0, 7)) {
      note +=
        " This month is still running, so only days up to today are counted.";
    } else if (slip.countedDays === 0) {
      note += " No working days were counted for this month.";
    }

    text("payslipMessage", note);

    sheet.hidden = false;
    printBtn.disabled = false;
  }

  function fillEmployeeSelect() {
    employeeSelect.innerHTML = "";

    getEmployees().forEach((employee) => {
      const option = document.createElement("option");
      option.value = employee.id;
      option.textContent = `${employee.name} (${employee.department})`;
      employeeSelect.appendChild(option);
    });
  }

  /* ---------- Start ---------- */

  const currentMonth = getToday().slice(0, 7);
  monthInput.value = currentMonth;
  monthInput.max = currentMonth; // aane wale mahine ki payslip nahi

  if (isAdmin) {
    employeeField.hidden = false;
    controlsHint.textContent = "Pick an employee and a month";
    fillEmployeeSelect();
    employeeSelect.addEventListener("change", render);
  }

  monthInput.addEventListener("change", render);
  printBtn.addEventListener("click", () => window.print());

  // Doosre tab mein data badle to payslip bhi update ho jaye
  window.addEventListener("storage", (event) => {
    const watched = [
      STORAGE_KEYS.attendance,
      STORAGE_KEYS.leaves,
      STORAGE_KEYS.employees,
      STORAGE_KEYS.settings,
    ];

    if (watched.includes(event.key)) {
      if (isAdmin) {
        const chosen = employeeSelect.value;
        fillEmployeeSelect();
        employeeSelect.value = chosen;
      }
      render();
    }
  });

  render();
});