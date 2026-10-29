/**
 * HCM Lite - Employee Management Module (js/employees.js)
 * Handles CRUD operations, search, filters, validation, and auto-provisioning employee login accounts.
 */

const EmployeeModule = {
  editingEmployeeId: null,

  init() {
    this.updateDepartmentFilterOptions();
    this.renderEmployeeList();
    this.setupForm();
    this.setupFiltersAndSearch();
  },

  renderEmployeeList() {
    const tableBody = document.getElementById('employeeTableBody');
    const emptyState = document.getElementById('employeeEmptyState');
    const tableContainer = document.getElementById('employeeTableContainer');

    if (!tableBody) return;

    const employees = StorageService.getEmployees();
    const searchQuery = (document.getElementById('searchEmployee')?.value || '').toLowerCase().trim();
    const deptFilter = document.getElementById('filterDepartment')?.value || 'all';
    const statusFilter = document.getElementById('filterStatus')?.value || 'all';

    const filtered = employees.filter(emp => {
      if (!emp) return false;
      const matchSearch =
        (emp.fullName || '').toLowerCase().includes(searchQuery) ||
        (emp.email || '').toLowerCase().includes(searchQuery) ||
        (emp.employeeId || '').toLowerCase().includes(searchQuery) ||
        (emp.jobTitle || '').toLowerCase().includes(searchQuery);

      const matchDept = deptFilter === 'all' || emp.department === deptFilter;
      const matchStatus = statusFilter === 'all' || emp.status === statusFilter;

      return matchSearch && matchDept && matchStatus;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      if (tableContainer) tableContainer.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';

    const company = StorageService.getCompany() || {};
    const currency = company.currency || '$';

    tableBody.innerHTML = filtered.map(emp => {
      const statusBadgeClass =
        emp.status === 'Active' ? 'badge-active' :
        emp.status === 'On Leave' ? 'badge-on-leave' : 'badge-inactive';

      return `
        <tr>
          <td><strong class="font-mono">${this.escapeHtml(emp.employeeId)}</strong></td>
          <td>
            <div style="font-weight: 600; color: var(--text-primary);">${this.escapeHtml(emp.fullName)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${this.escapeHtml(emp.email)}</div>
          </td>
          <td>${this.escapeHtml(emp.department)}</td>
          <td>${this.escapeHtml(emp.jobTitle)}</td>
          <td>${emp.joiningDate || '-'}</td>
          <td><strong>${currency}${parseFloat(emp.monthlySalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
          <td>${emp.leaveQuota} days</td>
          <td>
            <span class="badge ${statusBadgeClass}">
              <span class="badge-dot"></span>
              ${this.escapeHtml(emp.status)}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 0.4rem;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="EmployeeModule.openEditModal('${emp.id}')" title="Edit Employee">
                ✏️ Edit
              </button>
              <button type="button" class="btn btn-danger btn-sm" onclick="EmployeeModule.confirmDelete('${emp.id}')" title="Delete Employee">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  updateDepartmentFilterOptions() {
    const filterSelect = document.getElementById('filterDepartment');
    if (!filterSelect) return;

    const currentSelection = filterSelect.value;
    const employees = StorageService.getEmployees();
    const departments = [...new Set(employees.map(e => e.department).filter(Boolean))].sort();

    let optionsHtml = '<option value="all">All Departments</option>';
    departments.forEach(dept => {
      optionsHtml += `<option value="${this.escapeHtml(dept)}">${this.escapeHtml(dept)}</option>`;
    });

    filterSelect.innerHTML = optionsHtml;
    if (departments.includes(currentSelection)) {
      filterSelect.value = currentSelection;
    } else {
      filterSelect.value = 'all';
    }
  },

  setupFiltersAndSearch() {
    const searchInput = document.getElementById('searchEmployee');
    const deptFilter = document.getElementById('filterDepartment');
    const statusFilter = document.getElementById('filterStatus');

    searchInput?.addEventListener('input', () => this.renderEmployeeList());
    deptFilter?.addEventListener('change', () => this.renderEmployeeList());
    statusFilter?.addEventListener('change', () => this.renderEmployeeList());
  },

  setupForm() {
    const form = document.getElementById('employeeModalForm');
    const addBtn = document.getElementById('openAddEmployeeModalBtn');
    const closeBtn = document.getElementById('closeEmployeeModalBtn');
    const cancelBtn = document.getElementById('cancelEmployeeModalBtn');

    addBtn?.addEventListener('click', () => this.openAddModal());
    closeBtn?.addEventListener('click', () => this.closeModal());
    cancelBtn?.addEventListener('click', () => this.closeModal());

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });
  },

  openAddModal() {
    this.editingEmployeeId = null;
    const modal = document.getElementById('employeeModal');
    const title = document.getElementById('employeeModalTitle');
    const form = document.getElementById('employeeModalForm');
    const passwordHelp = document.getElementById('employeePasswordHelp');
    const idInput = document.getElementById('empCustomId');

    if (form) form.reset();
    if (title) title.textContent = 'Add New Employee';
    if (passwordHelp) passwordHelp.textContent = 'This will be the employee’s initial login password.';

    if (idInput) {
      idInput.value = StorageService.generateEmployeeId();
    }

    const company = StorageService.getCompany() || {};
    const quotaInput = document.getElementById('empLeaveQuota');
    if (quotaInput) {
      quotaInput.value = company.defaultLeaveQuota || 20;
    }

    const joinDateInput = document.getElementById('empJoiningDate');
    if (joinDateInput) {
      joinDateInput.value = StorageService.getLocalDate();
    }

    const passwordInput = document.getElementById('empPassword');
    if (passwordInput) {
      passwordInput.required = true;
    }

    modal?.classList.add('active');
  },

  openEditModal(id) {
    const employee = StorageService.getEmployeeById(id);
    if (!employee) {
      window.showToast('Employee not found.', 'error');
      return;
    }

    this.editingEmployeeId = id;
    const modal = document.getElementById('employeeModal');
    const title = document.getElementById('employeeModalTitle');
    const passwordHelp = document.getElementById('employeePasswordHelp');

    if (title) title.textContent = `Edit Employee: ${employee.fullName}`;
    if (passwordHelp) passwordHelp.textContent = 'Leave password blank to keep current login password.';

    document.getElementById('empCustomId').value = employee.employeeId;
    document.getElementById('empFullName').value = employee.fullName;
    document.getElementById('empEmail').value = employee.email;
    document.getElementById('empDepartment').value = employee.department;
    document.getElementById('empJobTitle').value = employee.jobTitle;
    document.getElementById('empJoiningDate').value = employee.joiningDate;
    document.getElementById('empSalary').value = employee.monthlySalary;
    document.getElementById('empLeaveQuota').value = employee.leaveQuota;
    document.getElementById('empStatus').value = employee.status;

    const passwordInput = document.getElementById('empPassword');
    if (passwordInput) {
      passwordInput.value = '';
      passwordInput.required = false;
    }

    modal?.classList.add('active');
  },

  closeModal() {
    const modal = document.getElementById('employeeModal');
    modal?.classList.remove('active');
    this.editingEmployeeId = null;
  },

  handleFormSubmit() {
    const employeeId = document.getElementById('empCustomId').value.trim().toUpperCase();
    const fullName = document.getElementById('empFullName').value.trim();
    const email = document.getElementById('empEmail').value.trim().toLowerCase();
    const password = document.getElementById('empPassword').value;
    const department = document.getElementById('empDepartment').value.trim();
    const jobTitle = document.getElementById('empJobTitle').value.trim();
    const joiningDate = document.getElementById('empJoiningDate').value;
    const monthlySalary = parseFloat(document.getElementById('empSalary').value);
    const leaveQuota = parseInt(document.getElementById('empLeaveQuota').value, 10);
    const status = document.getElementById('empStatus').value;

    if (!employeeId || !fullName || !email || !department || !jobTitle || !joiningDate) {
      window.showToast('Please fill out all required fields.', 'error');
      return;
    }

    if (isNaN(monthlySalary) || monthlySalary < 0) {
      window.showToast('Please enter a valid monthly salary.', 'error');
      return;
    }

    if (isNaN(leaveQuota) || leaveQuota < 0) {
      window.showToast('Please enter a valid leave quota.', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      window.showToast('Please enter a valid email address.', 'error');
      return;
    }

    const allEmployees = StorageService.getEmployees();
    const allUsers = StorageService.getUsers();

    if (this.editingEmployeeId) {
      const existing = StorageService.getEmployeeById(this.editingEmployeeId);
      if (!existing) return;

      if (employeeId !== existing.employeeId) {
        if (allEmployees.some(e => e && e.employeeId === employeeId && e.id !== existing.id)) {
          window.showToast(`Employee ID ${employeeId} is already in use.`, 'error');
          return;
        }
      }

      if (email !== existing.email) {
        if (allEmployees.some(e => e && e.email === email && e.id !== existing.id) ||
            allUsers.some(u => u && u.email === email && u.employeeId !== existing.employeeId)) {
          window.showToast(`Email ${email} is already in use by another account.`, 'error');
          return;
        }
      }

      StorageService.updateEmployee(existing.id, {
        employeeId,
        fullName,
        email,
        department,
        jobTitle,
        joiningDate,
        monthlySalary,
        leaveQuota,
        status
      });

      const user = StorageService.getUserByEmployeeId(existing.employeeId);
      if (user) {
        const userUpdates = {
          fullName,
          email,
          employeeId
        };
        if (password && password.trim() !== '') {
          userUpdates.password = password;
        }
        StorageService.updateUser(user.id, userUpdates);
      }

      window.showToast(`Employee ${fullName} updated successfully.`, 'success');
    } else {
      if (!password || password.length < 4) {
        window.showToast('Password must be at least 4 characters long.', 'error');
        return;
      }

      if (allEmployees.some(e => e && e.employeeId === employeeId)) {
        window.showToast(`Employee ID ${employeeId} already exists.`, 'error');
        return;
      }

      if (allEmployees.some(e => e && e.email === email) || allUsers.some(u => u && u.email === email)) {
        window.showToast(`Email ${email} is already registered.`, 'error');
        return;
      }

      const newEmp = StorageService.addEmployee({
        employeeId,
        fullName,
        email,
        department,
        jobTitle,
        joiningDate,
        monthlySalary,
        leaveQuota,
        status
      });

      StorageService.addUser({
        fullName,
        email,
        password,
        role: 'employee',
        employeeId: newEmp.employeeId
      });

      window.showToast(`Employee ${fullName} registered with login credentials.`, 'success');
    }

    this.closeModal();
    this.updateDepartmentFilterOptions();
    this.renderEmployeeList();
  },

  confirmDelete(id) {
    const employee = StorageService.getEmployeeById(id);
    if (!employee) return;

    const confirmed = confirm(
      `Are you sure you want to delete ${employee.fullName} (${employee.employeeId})?\n\nThis will permanently delete their login account, attendance logs, and leave requests.`
    );

    if (confirmed) {
      StorageService.deleteEmployee(id);
      window.showToast(`Employee ${employee.fullName} deleted.`, 'info');
      this.updateDepartmentFilterOptions();
      this.renderEmployeeList();
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

window.EmployeeModule = EmployeeModule;
