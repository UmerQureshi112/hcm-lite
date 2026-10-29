/**
 * HCM Lite - Centralized Storage Module (js/storage.js)
 * Manages all data persistence via browser localStorage with defensive JSON handling.
 */

// Storage Keys
const STORAGE_KEYS = {
  COMPANY: "hcm_company",
  USERS: "hcm_users",
  EMPLOYEES: "hcm_employees",
  ATTENDANCE: "hcm_attendance",
  LEAVES: "hcm_leaves",
  SESSION: "hcm_session",
  THEME: "hcm_theme",
};

// Default Company Settings
const DEFAULT_COMPANY_SETTINGS = {
  companyName: "HCM Lite Demo Corp",
  officeStartTime: "09:00",
  officeEndTime: "18:00",
  gracePeriodMinutes: 15,
  halfDayCutoff: "12:00",
  defaultLeaveQuota: 20,
  currency: "$",
  workDaysPerMonth: 22,
  setupCompleted: false,
};

// Safe LocalStorage Wrappers
const StorageService = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null || item === undefined || item === "") {
        return defaultValue;
      }
      return JSON.parse(item);
    } catch (err) {
      console.error(`Error parsing localStorage item for key "${key}":`, err);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`Error saving to localStorage for key "${key}":`, err);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (err) {
      console.error(`Error removing localStorage item for key "${key}":`, err);
      return false;
    }
  },

  generateId(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  },

  getLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },

  getLocalTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  },

  // Company Settings
  getCompany() {
    return this.get(STORAGE_KEYS.COMPANY, null);
  },

  saveCompany(settings) {
    const existing = this.getCompany() || DEFAULT_COMPANY_SETTINGS;
    const merged = { ...existing, ...settings };
    this.set(STORAGE_KEYS.COMPANY, merged);
    return merged;
  },

  isSetupCompleted() {
    const company = this.getCompany();
    return !!(company && company.setupCompleted);
  },

  // Users (Auth accounts)
  getUsers() {
    return this.get(STORAGE_KEYS.USERS, []);
  },

  getUserByEmail(email) {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    const users = this.getUsers();
    return (
      users.find(
        (u) => u && u.email && u.email.trim().toLowerCase() === clean,
      ) || null
    );
  },

  getUserById(id) {
    if (!id) return null;
    const users = this.getUsers();
    return users.find((u) => u && u.id === id) || null;
  },

  getUserByEmployeeId(empId) {
    if (!empId) return null;
    const users = this.getUsers();
    return users.find((u) => u && u.employeeId === empId) || null;
  },

  addUser(userData) {
    const users = this.getUsers();
    const newUser = {
      id: userData.id || this.generateId("usr"),
      fullName: (userData.fullName || "").trim(),
      email: (userData.email || "").trim().toLowerCase(),
      password: userData.password,
      role: userData.role || "employee",
      employeeId: userData.employeeId || null,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    this.set(STORAGE_KEYS.USERS, users);
    return newUser;
  },

  updateUser(id, updates) {
    const users = this.getUsers();
    const index = users.findIndex((u) => u && u.id === id);
    if (index === -1) return null;

    users[index] = { ...users[index], ...updates };
    this.set(STORAGE_KEYS.USERS, users);
    return users[index];
  },

  deleteUserByEmployeeId(empId) {
    if (!empId) return;
    const users = this.getUsers().filter((u) => u && u.employeeId !== empId);
    this.set(STORAGE_KEYS.USERS, users);
  },

  // Employees
  getEmployees() {
    return this.get(STORAGE_KEYS.EMPLOYEES, []);
  },

  getEmployeeById(id) {
    if (!id) return null;
    const employees = this.getEmployees();
    return employees.find((e) => e && e.id === id) || null;
  },

  getEmployeeByEmpId(empId) {
    if (!empId) return null;
    const cleanId = String(empId).trim().toUpperCase();
    const employees = this.getEmployees();
    return (
      employees.find(
        (e) =>
          e && e.employeeId && e.employeeId.trim().toUpperCase() === cleanId,
      ) || null
    );
  },

  getEmployeeByEmail(email) {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    const employees = this.getEmployees();
    return (
      employees.find(
        (e) => e && e.email && e.email.trim().toLowerCase() === clean,
      ) || null
    );
  },

  generateEmployeeId() {
    const employees = this.getEmployees();
    if (employees.length === 0) {
      return "EMP-001";
    }
    let maxNumber = 0;
    employees.forEach((emp) => {
      if (emp && emp.employeeId && emp.employeeId.startsWith("EMP-")) {
        const numPart = parseInt(emp.employeeId.replace("EMP-", ""), 10);
        if (!isNaN(numPart) && numPart > maxNumber) {
          maxNumber = numPart;
        }
      }
    });
    const nextNumber = maxNumber + 1;
    return `EMP-${String(nextNumber).padStart(3, "0")}`;
  },

  addEmployee(employeeData) {
    const employees = this.getEmployees();
    const newEmployee = {
      id: employeeData.id || this.generateId("emp"),
      employeeId: employeeData.employeeId || this.generateEmployeeId(),
      fullName: (employeeData.fullName || "").trim(),
      email: (employeeData.email || "").trim().toLowerCase(),
      department: (employeeData.department || "General").trim(),
      jobTitle: (employeeData.jobTitle || "Staff").trim(),
      joiningDate: employeeData.joiningDate || this.getLocalDate(),
      monthlySalary: parseFloat(employeeData.monthlySalary) || 0,
      leaveQuota: parseInt(employeeData.leaveQuota, 10) || 20,
      status: employeeData.status || "Active",
      createdAt: new Date().toISOString(),
    };

    employees.push(newEmployee);
    this.set(STORAGE_KEYS.EMPLOYEES, employees);
    return newEmployee;
  },

  updateEmployee(id, updates) {
    const employees = this.getEmployees();
    const index = employees.findIndex((e) => e && e.id === id);
    if (index === -1) return null;

    employees[index] = { ...employees[index], ...updates };
    this.set(STORAGE_KEYS.EMPLOYEES, employees);

    if (updates.fullName || updates.email) {
      const user = this.getUserByEmployeeId(employees[index].employeeId);
      if (user) {
        this.updateUser(user.id, {
          fullName: updates.fullName || user.fullName,
          email: updates.email
            ? updates.email.trim().toLowerCase()
            : user.email,
        });
      }
    }

    return employees[index];
  },

  deleteEmployee(id) {
    const emp = this.getEmployeeById(id);
    if (!emp) return false;

    const employees = this.getEmployees().filter((e) => e && e.id !== id);
    this.set(STORAGE_KEYS.EMPLOYEES, employees);

    this.deleteUserByEmployeeId(emp.employeeId);

    const attendance = this.getAttendance().filter(
      (a) => a && a.employeeId !== emp.employeeId,
    );
    this.set(STORAGE_KEYS.ATTENDANCE, attendance);

    const leaves = this.getLeaves().filter(
      (l) => l && l.employeeId !== emp.employeeId,
    );
    this.set(STORAGE_KEYS.LEAVES, leaves);

    return true;
  },

  // Attendance
  getAttendance() {
    return this.get(STORAGE_KEYS.ATTENDANCE, []);
  },

  getTodayAttendance(dateStr = null) {
    const targetDate = dateStr || this.getLocalDate();
    const all = this.getAttendance();
    return all.filter((a) => a && a.date === targetDate);
  },

  getEmployeeAttendance(empId) {
    if (!empId) return [];
    const all = this.getAttendance();
    return all
      .filter((a) => a && a.employeeId === empId)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  },

  getEmployeeAttendanceByDate(empId, dateStr) {
    if (!empId || !dateStr) return null;
    const all = this.getAttendance();
    return (
      all.find((a) => a && a.employeeId === empId && a.date === dateStr) || null
    );
  },

  saveAttendanceRecord(record) {
    const all = this.getAttendance();
    const existingIndex = all.findIndex((a) => a && a.id === record.id);

    if (existingIndex > -1) {
      all[existingIndex] = { ...all[existingIndex], ...record };
    } else {
      const newRec = {
        id: record.id || this.generateId("att"),
        employeeId: record.employeeId,
        date: record.date || this.getLocalDate(),
        checkInTime: record.checkInTime || this.getLocalTime(),
        checkOutTime: record.checkOutTime || null,
        status: record.status || "Present",
        workedMinutes: record.workedMinutes || 0,
        createdAt: new Date().toISOString(),
      };
      all.push(newRec);
    }

    this.set(STORAGE_KEYS.ATTENDANCE, all);
    return true;
  },

  // Leave Requests
  getLeaves() {
    return this.get(STORAGE_KEYS.LEAVES, []);
  },

  getEmployeeLeaves(empId) {
    if (!empId) return [];
    const all = this.getLeaves();
    return all
      .filter((l) => l && l.employeeId === empId)
      .sort((a, b) => (b.appliedAt || "").localeCompare(a.appliedAt || ""));
  },

  getLeaveById(id) {
    if (!id) return null;
    const all = this.getLeaves();
    return all.find((l) => l && l.id === id) || null;
  },

  addLeave(leaveData) {
    const all = this.getLeaves();
    const newLeave = {
      id: leaveData.id || this.generateId("lev"),
      employeeId: leaveData.employeeId,
      leaveType: leaveData.leaveType || "Annual",
      startDate: leaveData.startDate,
      endDate: leaveData.endDate,
      daysCount: parseInt(leaveData.daysCount, 10) || 1,
      reason: (leaveData.reason || "").trim(),
      status: "Pending",
      adminComment: "",
      appliedAt: new Date().toISOString(),
      reviewedAt: null,
    };

    all.push(newLeave);
    this.set(STORAGE_KEYS.LEAVES, all);
    return newLeave;
  },

  updateLeave(id, updates) {
    const all = this.getLeaves();
    const index = all.findIndex((l) => l && l.id === id);
    if (index === -1) return null;

    all[index] = { ...all[index], ...updates };
    this.set(STORAGE_KEYS.LEAVES, all);
    return all[index];
  },

  // Session
  getSession() {
    return this.get(STORAGE_KEYS.SESSION, null);
  },

  setSession(sessionData) {
    this.set(STORAGE_KEYS.SESSION, sessionData);
  },

  clearSession() {
    this.remove(STORAGE_KEYS.SESSION);
  },

  // Theme
  getTheme() {
    return this.get(STORAGE_KEYS.THEME, "light");
  },

  setTheme(theme) {
    this.set(STORAGE_KEYS.THEME, theme);
  },

  resetAllData() {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  },
};

window.StorageService = StorageService;
window.STORAGE_KEYS = STORAGE_KEYS;
