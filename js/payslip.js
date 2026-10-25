
document.addEventListener("DOMContentLoaded", function () {
  const $ = (id) => document.getElementById(id);

  const content = $("payslipContent");
  const employeeSelect = $("payslipEmployeeSelect");
  const monthInput = $("payslipMonthInput");
  const emptyMessage = $("payslipEmpty");
  const message = $("payslipMessage");
  const printButton = $("printPayslipBtn");
  const employeeField = $("employeeField");
  const controlsHint = $("controlsHint");

  if (!content || !employeeSelect || !monthInput) {
    console.error("Payslip setup error: Check payslip.html IDs.");
    return;
  }

  if (typeof getEmployees !== "function" ||
      typeof calculatePayslip !== "function") {
    if (message) message.textContent = "Salary data could not be loaded.";
    return;
  }

  const currentUser =
    typeof getCurrentUser === "function" ? getCurrentUser() : null;

  const isEmployee = currentUser &&
    String(currentUser.role).toLowerCase() === "employee";

  function employeeId(employee) {
    return String(employee.id ?? employee.employeeId ?? "");
  }

  function employeeName(employee) {
    return employee.name || employee.fullName ||
      employee.employeeName ||
      [employee.firstName, employee.lastName].filter(Boolean).join(" ") ||
      "Employee";
  }

  function money(value) {
    const amount = Number(value);
    return "Rs. " + (Number.isFinite(amount) ? amount : 0)
      .toLocaleString("en-PK", { maximumFractionDigits: 2 });
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value ?? "—";
  }

  function showEmpty(text) {
    content.hidden = true;
    if (emptyMessage) {
      emptyMessage.hidden = false;
      emptyMessage.textContent = text;
    }
  }

  function showMessage(text) {
    if (message) message.textContent = text || "";
  }

  function loadEmployees() {
    const allEmployees = getEmployees() || [];

    const availableEmployees = isEmployee
      ? allEmployees.filter((employee) =>
          (employeeId(employee) === String(currentUser.id) ||
           employee.email?.toLowerCase() === currentUser.email?.toLowerCase()) &&
          employee.status !== "Inactive"
        )
      : allEmployees;

    employeeSelect.innerHTML = '<option value="">Select employee</option>';

    availableEmployees.forEach((employee) => {
      const id = employeeId(employee);
      if (!id) return;

      const option = document.createElement("option");
      option.value = id;
      option.textContent = employeeName(employee);
      employeeSelect.appendChild(option);
    });

    if (isEmployee) {
      employeeSelect.disabled = true;
      if (employeeField) employeeField.hidden = true;

      if (availableEmployees.length === 1) {
        employeeSelect.value = employeeId(availableEmployees[0]);
      }
    }

    if (!availableEmployees.length) {
      showEmpty(isEmployee
        ? "Your employee profile was not found or is inactive."
        : "No employees found. Add an employee first.");
    }

    return availableEmployees;
  }

  function renderPayslip() {
    showMessage("");

    const month = monthInput.value;
    const selectedId = employeeSelect.value;

    if (!selectedId) {
      showEmpty("Please select an employee.");
      return;
    }

    if (!month) {
      showEmpty("Please select a salary month.");
      return;
    }

    const employee = (getEmployees() || []).find(
      (item) => employeeId(item) === selectedId
    );

    if (!employee || employee.status === "Inactive") {
      showEmpty("Employee not found or inactive.");
      return;
    }

    // Security guard: employees may view only their own payslip.
    if (isEmployee &&
        employee.email?.toLowerCase() !== currentUser.email?.toLowerCase() &&
        employeeId(employee) !== String(currentUser.id)) {
      showEmpty("You can only view your own payslip.");
      return;
    }

    let result;

    try {
      result = calculatePayslip(employee, month);
    } catch (error) {
      console.error("Payslip calculation failed:", error);
      showEmpty("Unable to calculate payslip. Check attendance.js.");
      return;
    }

    if (!result || typeof result !== "object") {
      showEmpty("No payslip data is available.");
      return;
    }

    // calculatePayslip returns attendance summary fields directly.
    const summary = result.summary || result;
    const monthlySalary = Number(
      result.monthlySalary ?? employee.salary ??
      employee.monthlySalary ?? employee.basicSalary ?? 0
    );
    const absentDeduction = Number(result.absentDeduction ?? 0);
    const halfDayDeduction = Number(result.halfDayDeduction ?? 0);
    const totalDeduction = Number(
      result.totalDeduction ??
      result.salaryDeduction ??
      absentDeduction + halfDayDeduction
    );
    const netSalary = Number(
      result.netSalary ?? Math.max(monthlySalary - totalDeduction, 0)
    );

    const monthDate = new Date(month + "-01T00:00:00");
    const monthLabel = Number.isNaN(monthDate.getTime())
      ? month
      : monthDate.toLocaleDateString("en-PK", {
          month: "long",
          year: "numeric"
        });

    setText("payslipCompany",
      typeof getCompanyName === "function" ? getCompanyName() : "HCM Lite");
    setText("payslipMonth", monthLabel);
    setText("payslipEmployee", employeeName(employee));
    setText("payslipDepartment",
      employee.department || employee.designation || "—");
    setText("payslipEmail", employee.email || "—");

    const joined = employee.joiningDate || employee.joinDate ||
      employee.dateJoined || "—";
    setText("payslipJoined", joined);

    const values = {
      workingDays: ["workingDays", "monthWorkingDays", "totalWorkingDays"],
      countedDays: ["countedDays", "recordedDays", "totalRecords"],
      presentDays: ["presentDays", "present"],
      lateDays: ["lateDays", "late"],
      halfDays: ["halfDays", "halfDay"],
      leaveDays: ["leaveDays", "approvedLeaveDays"],
      absentDays: ["absentDays", "absent"]
    };

    Object.entries(values).forEach(([id, keys]) => {
      let value = 0;
      for (const key of keys) {
        if (summary[key] != null) {
          value = summary[key];
          break;
        }
      }
      setText(id, Number(value) || 0);
    });

    setText("monthlySalary", money(monthlySalary));
    setText("dailySalary", money(result.dailySalary ?? 0));
    setText("absentDeduction", money(absentDeduction));
    setText("halfDayDeduction", money(halfDayDeduction));
    setText("salaryDeduction", money(totalDeduction));
    setText("netSalary", money(netSalary));

    content.hidden = false;
    if (emptyMessage) emptyMessage.hidden = true;

    if (controlsHint) {
      controlsHint.textContent =
        "Payslip generated for " + employeeName(employee) +
        " — " + monthLabel + ".";
    }
  }

  const now = new Date();
  monthInput.value = now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0");

  loadEmployees();

  employeeSelect.addEventListener("change", renderPayslip);
  monthInput.addEventListener("change", renderPayslip);

  if (printButton) {
    printButton.addEventListener("click", function () {
      if (content.hidden) {
        showMessage("Generate a payslip before printing.");
        return;
      }
      window.print();
    });
  }

  window.addEventListener("storage", function () {
    const previous = employeeSelect.value;
    loadEmployees();

    if ([...employeeSelect.options].some((option) => option.value === previous)) {
      employeeSelect.value = previous;
    }

    renderPayslip();
  });

  renderPayslip();
});
