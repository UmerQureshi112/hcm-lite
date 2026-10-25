// js/employees.js
// Employees page: add, edit, delete, search aur department filter.

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("employeeForm");
  const tableBody = document.getElementById("employeesTableBody");

  // Sirf employees page par chalao
  if (!form || !tableBody) return;

  const idInput = document.getElementById("employeeId");
  const nameInput = document.getElementById("employeeName");
  const emailInput = document.getElementById("employeeEmail");
  const passwordInput = document.getElementById("employeePassword");
  const departmentInput = document.getElementById("department");
  const salaryInput = document.getElementById("salary");

  const errorEl = document.getElementById("employeeError");
  const saveBtn = document.getElementById("saveEmployeeBtn");
  const cancelBtn = document.getElementById("cancelEditBtn");
  const formTitle = document.getElementById("formTitle");
  const formCard = document.getElementById("employeeFormCard");

  const searchInput = document.getElementById("searchEmployee");
  const filterInput = document.getElementById("filterDepartment");
  const resultCount = document.getElementById("resultCount");

  const statTotal = document.getElementById("statTotal");
  const statDepartments = document.getElementById("statDepartments");
  const statPayroll = document.getElementById("statPayroll");

  let employees = getEmployees();

  function showError(message = "") {
    errorEl.textContent = message;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /* ---------- Summary cards ---------- */

  function renderStats() {
    const departments = new Set(employees.map((item) => item.department));
    const payroll = employees.reduce(
      (total, item) => total + Number(item.salary || 0),
      0,
    );

    statTotal.textContent = employees.length;
    statDepartments.textContent = departments.size;
    statPayroll.textContent = formatCurrency(payroll);
  }

  /* ---------- Table ---------- */

  function createCell(content) {
    const cell = document.createElement("td");

    if (content instanceof Node) {
      cell.appendChild(content);
    } else {
      cell.textContent = content ?? "";
    }

    return cell;
  }

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

  function createBadge(text) {
    const badge = document.createElement("span");
    badge.className = "badge badge-info";
    badge.textContent = text;
    return badge;
  }

  function createActions(employee) {
    const wrapper = document.createElement("div");
    wrapper.className = "row-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn btn-secondary btn-sm";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => startEdit(employee));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-danger btn-sm";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteEmployee(employee));

    wrapper.append(editButton, deleteButton);
    return wrapper;
  }

  function renderEmployees() {
    const searchText = searchInput.value.trim().toLowerCase();
    const selectedDepartment = filterInput.value;

    const filtered = employees.filter((employee) => {
      const matchesSearch =
        employee.name.toLowerCase().includes(searchText) ||
        employee.email.toLowerCase().includes(searchText);

      const matchesDepartment =
        !selectedDepartment || employee.department === selectedDepartment;

      return matchesSearch && matchesDepartment;
    });

    resultCount.textContent = `${filtered.length} of ${employees.length} employee${
      employees.length === 1 ? "" : "s"
    }`;

    tableBody.innerHTML = "";

    if (filtered.length === 0) {
      const row = document.createElement("tr");
      row.className = "empty-row";

      const cell = createCell(
        employees.length === 0
          ? "No employees yet. Add your first employee above."
          : "No employees match your search.",
      );
      cell.colSpan = 5;

      row.appendChild(cell);
      tableBody.appendChild(row);
      return;
    }

    filtered.forEach((employee) => {
      const row = document.createElement("tr");

      row.append(
        createCell(createEmployeeCell(employee)),
        createCell(createBadge(employee.department)),
        createCell(formatCurrency(employee.salary)),
        createCell(
          employee.createdAt
            ? formatDate(employee.createdAt.slice(0, 10))
            : "-",
        ),
        createCell(createActions(employee)),
      );

      tableBody.appendChild(row);
    });
  }

  function refresh() {
    renderStats();
    renderEmployees();
  }

  /* ---------- Edit mode ---------- */

  function startEdit(employee) {
    idInput.value = employee.id;
    nameInput.value = employee.name;
    emailInput.value = employee.email;
    departmentInput.value = employee.department;
    salaryInput.value = employee.salary;

    // Purana password dikhana nahi, khali chhodo to wahi rahega
    passwordInput.value = "";
    passwordInput.placeholder = "Leave blank to keep the current password";

    formTitle.textContent = "Edit Employee";
    saveBtn.textContent = "Update Employee";
    cancelBtn.hidden = false;

    showError("");
    formCard.scrollIntoView({ behavior: "smooth", block: "start" });
    nameInput.focus();
  }

  function stopEdit() {
    form.reset();
    idInput.value = "";
    passwordInput.placeholder = "At least 6 characters";

    formTitle.textContent = "Add New Employee";
    saveBtn.textContent = "Add Employee";
    cancelBtn.hidden = true;

    showError("");
  }

  /* ---------- Delete ---------- */

  function deleteEmployee(employee) {
    const confirmed = confirm(
      `Delete ${employee.name}?\n\nTheir attendance and leave records will also be removed.`,
    );

    if (!confirmed) return;

    const id = String(employee.id);

    employees = employees.filter((item) => String(item.id) !== id);

    saveData(STORAGE_KEYS.employees, employees);
    saveData(
      STORAGE_KEYS.attendance,
      getAttendance().filter((record) => String(record.employeeId) !== id),
    );
    saveData(
      STORAGE_KEYS.leaves,
      getLeaves().filter((leave) => String(leave.employeeId) !== id),
    );

    // Agar isi employee ko edit kar rahe the to form band karo
    if (idInput.value === id) stopEdit();

    refresh();
    showToast("Employee deleted", "success");
  }

  /* ---------- Add / Update ---------- */

  // Naam badle to attendance aur leave records mein bhi naam update karo
  function syncEmployeeName(id, name) {
    const attendance = getAttendance();
    const leaves = getLeaves();

    attendance.forEach((record) => {
      if (String(record.employeeId) === String(id)) record.employeeName = name;
    });

    leaves.forEach((leave) => {
      if (String(leave.employeeId) === String(id)) leave.employeeName = name;
    });

    saveData(STORAGE_KEYS.attendance, attendance);
    saveData(STORAGE_KEYS.leaves, leaves);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showError("");

    const editingId = idInput.value;
    const name = nameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const department = departmentInput.value;
    const salary = Number(salaryInput.value);

    if (!name || !email || !department || salaryInput.value === "") {
      showError("Please fill in all required fields.");
      return;
    }

    if (!isValidEmail(email)) {
      showError("Please enter a valid email address.");
      return;
    }

    if (!editingId && !password.trim()) {
      showError("Please enter a login password for the employee.");
      return;
    }

    if (password && password.length < 6) {
      showError("Password must be at least 6 characters.");
      return;
    }

    if (!Number.isFinite(salary) || salary <= 0) {
      showError("Please enter a valid salary greater than 0.");
      return;
    }

    const adminEmail = getData(STORAGE_KEYS.admin, null)?.email;
    const duplicate =
      email === adminEmail ||
      employees.some(
        (item) =>
          item.email.toLowerCase() === email &&
          String(item.id) !== String(editingId),
      );

    if (duplicate) {
      showError("This email is already registered.");
      return;
    }

    let updatedList;

    if (editingId) {
      updatedList = employees.map((item) =>
        String(item.id) === String(editingId)
          ? {
              ...item,
              name,
              email,
              department,
              salary,
              password: password || item.password,
            }
          : item,
      );
    } else {
      updatedList = [
        ...employees,
        {
          id: generateId(),
          name,
          email,
          password,
          department,
          salary,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    if (!saveData(STORAGE_KEYS.employees, updatedList)) {
      showError("Could not save employee data. Check browser storage.");
      return;
    }

    employees = updatedList;

    if (editingId) syncEmployeeName(editingId, name);

    showToast(editingId ? "Employee updated" : "Employee added", "success");

    stopEdit();
    refresh();
  });

  cancelBtn.addEventListener("click", stopEdit);
  form.addEventListener("input", () => showError(""));
  searchInput.addEventListener("input", renderEmployees);
  filterInput.addEventListener("change", renderEmployees);

  refresh();
});
