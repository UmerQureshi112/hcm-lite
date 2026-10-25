
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("employeeForm");
  const tableBody = document.getElementById("employeesTableBody");

  // Sirf Employees page par chalao
  if (!form || !tableBody) return;

  const idInput = document.getElementById("employeeId");
  const nameInput = document.getElementById("employeeFullName");
  const emailInput = document.getElementById("employeeEmail");
  const departmentInput = document.getElementById("employeeDepartment");
  const designationInput = document.getElementById("employeeDesignation");
  const salaryInput = document.getElementById("employeeSalary");
  const joinDateInput = document.getElementById("employeeJoinDate");
  const statusInput = document.getElementById("employeeStatus");
  const passwordInput = document.getElementById("employeePassword");

  const errorEl = document.getElementById("employeeFormError");
  const saveBtn = form.querySelector('[type="submit"]');
  const addBtn = document.getElementById("addEmployeeBtn");
  const cancelBtn = document.getElementById("cancelEmployeeBtn");
  const formTitle = document.getElementById("employeeFormTitle");
  const formContainer = document.getElementById("employeeFormContainer");
  const searchInput = document.getElementById("employeeSearch");

  let employees = getEmployees();

  function showError(message = "") {
    if (errorEl) errorEl.textContent = message;
  }

  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function escapeText(value) {
    return String(value ?? "");
  }

  // DOM element ko text mein convert karne ke bajaye append karo
  function createCell(value) {
    const cell = document.createElement("td");

    if (value instanceof Node) {
      cell.appendChild(value);
    } else {
      cell.textContent = escapeText(value);
    }

    return cell;
  }

  function createBadge(value) {
    const badge = document.createElement("span");
    const status = value || "Active";

    badge.className =
      status === "Active"
        ? "badge badge-success"
        : status === "Inactive"
          ? "badge badge-danger"
          : "badge badge-info";

    badge.textContent = status;
    return badge;
  }

  function createEmployeeCell(employee) {
    const wrapper = document.createElement("div");
    wrapper.className = "emp-cell";

    const avatar = document.createElement("span");
    avatar.className = "avatar avatar-sm";
    avatar.textContent = getInitials(employee.name || "");

    const info = document.createElement("div");

    const name = document.createElement("strong");
    name.textContent = employee.name || "Unnamed Employee";

    const email = document.createElement("small");
    email.textContent = employee.email || "";

    info.append(name, email);
    wrapper.append(avatar, info);

    return wrapper;
  }

  function createActions(employee) {
    const wrapper = document.createElement("div");
    wrapper.className = "row-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-secondary btn-sm";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => startEdit(employee));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-danger btn-sm";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteEmployee(employee));

    wrapper.append(editBtn, deleteBtn);
    return wrapper;
  }

  function renderEmployees() {
    employees = getEmployees();

    const searchText = searchInput
      ? searchInput.value.trim().toLowerCase()
      : "";

    const filtered = employees.filter((employee) => {
      const name = String(employee.name || "").toLowerCase();
      const email = String(employee.email || "").toLowerCase();
      const department = String(employee.department || "").toLowerCase();
      const designation = String(employee.designation || "").toLowerCase();

      return (
        name.includes(searchText) ||
        email.includes(searchText) ||
        department.includes(searchText) ||
        designation.includes(searchText)
      );
    });

    tableBody.innerHTML = "";

    if (filtered.length === 0) {
      const row = document.createElement("tr");
      row.className = "empty-row";

      const cell = createCell(
        employees.length === 0
          ? "No employees yet. Add your first employee."
          : "No employees match your search."
      );

      // HTML table mein total 8 columns hain
      cell.colSpan = 8;

      row.appendChild(cell);
      tableBody.appendChild(row);
      return;
    }

    filtered.forEach((employee) => {
      const row = document.createElement("tr");

      const joined = employee.joinDate || employee.createdAt;
      let joinedText = "-";

      if (joined) {
        joinedText = formatDate(String(joined).slice(0, 10));
      }

      // HTML ke mutabiq 8 separate columns
      row.append(
        createCell(createEmployeeCell(employee)),
        createCell(employee.email || "-"),
        createCell(employee.department || "-"),
        createCell(employee.designation || "-"),
        createCell(formatCurrency(Number(employee.salary || 0))),
        createCell(joinedText),
        createCell(createBadge(employee.status || "Active")),
        createCell(createActions(employee))
      );

      tableBody.appendChild(row);
    });
  }

  function openForm() {
    if (formContainer) formContainer.hidden = false;
    if (nameInput) nameInput.focus();
  }

  function stopEdit() {
    form.reset();

    if (idInput) idInput.value = "";

    if (passwordInput) {
      passwordInput.value = "";
      passwordInput.placeholder = "At least 6 characters";
    }

    if (formTitle) formTitle.textContent = "Add New Employee";
    if (saveBtn) saveBtn.textContent = "Add Employee";
    if (cancelBtn) cancelBtn.hidden = true;
    if (formContainer) formContainer.hidden = true;

    showError("");
  }

  function startEdit(employee) {
    openForm();

    idInput.value = employee.id;
    nameInput.value = employee.name || "";
    emailInput.value = employee.email || "";
    departmentInput.value = employee.department || "";
    designationInput.value = employee.designation || "";
    salaryInput.value = employee.salary ?? "";
    joinDateInput.value = employee.joinDate || "";
    statusInput.value = employee.status || "Active";

    if (passwordInput) {
      passwordInput.value = "";
      passwordInput.placeholder = "Leave blank to keep current password";
    }

    if (formTitle) formTitle.textContent = "Edit Employee";
    if (saveBtn) saveBtn.textContent = "Update Employee";
    if (cancelBtn) cancelBtn.hidden = false;

    showError("");
  }

  function syncEmployeeName(id, name) {
    const attendance = getAttendance();
    const leaves = getLeaves();

    attendance.forEach((record) => {
      if (String(record.employeeId) === String(id)) {
        record.employeeName = name;
      }
    });

    leaves.forEach((leave) => {
      if (String(leave.employeeId) === String(id)) {
        leave.employeeName = name;
      }
    });

    saveData(STORAGE_KEYS.attendance, attendance);
    saveData(STORAGE_KEYS.leaves, leaves);
  }

  function deleteEmployee(employee) {
    const confirmed = confirm(
      `Delete ${employee.name}?\n\nTheir attendance and leave records will also be removed.`
    );

    if (!confirmed) return;

    const id = String(employee.id);

    const updatedEmployees = employees.filter(
      (item) => String(item.id) !== id
    );

    const updatedAttendance = getAttendance().filter(
      (record) => String(record.employeeId) !== id
    );

    const updatedLeaves = getLeaves().filter(
      (leave) => String(leave.employeeId) !== id
    );

    if (!saveData(STORAGE_KEYS.employees, updatedEmployees)) {
      showError("Could not delete employee. Please try again.");
      return;
    }

    saveData(STORAGE_KEYS.attendance, updatedAttendance);
    saveData(STORAGE_KEYS.leaves, updatedLeaves);

    employees = updatedEmployees;

    if (idInput && String(idInput.value) === id) {
      stopEdit();
    }

    renderEmployees();

    if (typeof showToast === "function") {
      showToast("Employee deleted", "success");
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showError("");

    const editingId = idInput.value;
    const name = nameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const department = departmentInput.value.trim();
    const designation = designationInput.value.trim();
    const salary = Number(salaryInput.value);
    const joinDate = joinDateInput.value;
    const status = statusInput.value;
    const password = passwordInput ? passwordInput.value : "";

    if (!name || !email || !department || !designation) {
      showError("Please fill in all required fields.");
      return;
    }

    if (!validEmail(email)) {
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

    const admin = getData(STORAGE_KEYS.admin, null);
    const adminEmail = String(admin?.email || "").toLowerCase();

    const duplicate =
      email === adminEmail ||
      employees.some(
        (item) =>
          String(item.email || "").toLowerCase() === email &&
          String(item.id) !== String(editingId)
      );

    if (duplicate) {
      showError("This email is already registered.");
      return;
    }

    let updatedEmployees;

    if (editingId) {
      updatedEmployees = employees.map((employee) => {
        if (String(employee.id) !== String(editingId)) {
          return employee;
        }

        return {
          ...employee,
          name,
          email,
          department,
          designation,
          salary,
          joinDate,
          status,
          password: password || employee.password
        };
      });
    } else {
      updatedEmployees = [
        ...employees,
        {
          id: generateId(),
          name,
          email,
          department,
          designation,
          salary,
          joinDate: joinDate || new Date().toISOString().slice(0, 10),
          status: status || "Active",
          password,
          createdAt: new Date().toISOString()
        }
      ];
    }

    const saved = saveData(STORAGE_KEYS.employees, updatedEmployees);

    if (saved === false) {
      showError("Could not save employee data. Please try again.");
      return;
    }

    employees = updatedEmployees;

    if (editingId) {
      syncEmployeeName(editingId, name);
    }

    stopEdit();
    renderEmployees();

    if (typeof showToast === "function") {
      showToast(
        editingId ? "Employee updated" : "Employee added",
        "success"
      );
    }
  });

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      stopEdit();
      openForm();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", stopEdit);
  }

  if (searchInput) {
    searchInput.addEventListener("input", renderEmployees);
  }

  form.addEventListener("input", () => showError(""));

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEYS.employees) {
      employees = getEmployees();
      renderEmployees();
    }
  });

  stopEdit();
  renderEmployees();
});
