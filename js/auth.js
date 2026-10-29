/**
 * HCM Lite - Authentication & Authorization Module (js/auth.js)
 * Handles first-run setup, credentials validation, session persistence, role protection, and theme toggling.
 */

// Universal Toast Notification System
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';

  const cleanMessage = String(message)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <div class="toast-title">${type.toUpperCase()}</div>
      <div class="toast-message">${cleanMessage}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}
window.showToast = showToast;

const AuthService = {
  needsFirstRun() {
    return !StorageService.isSetupCompleted();
  },

  getSession() {
    return StorageService.getSession();
  },

  isLoggedIn() {
    const session = this.getSession();
    return !!(session && session.userId && session.role);
  },

  isAdmin() {
    const session = this.getSession();
    return session && session.role === 'admin';
  },

  isEmployee() {
    const session = this.getSession();
    return session && session.role === 'employee';
  },

  setupFirstRun(data) {
    const { companyName, adminName, adminEmail, adminPassword, confirmPassword } = data;

    if (!companyName || !adminName || !adminEmail || !adminPassword) {
      return { success: false, message: 'All fields are required.' };
    }

    if (adminPassword !== confirmPassword) {
      return { success: false, message: 'Passwords do not match.' };
    }

    if (adminPassword.length < 4) {
      return { success: false, message: 'Password must be at least 4 characters long.' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail.trim())) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    StorageService.saveCompany({
      companyName: companyName.trim(),
      setupCompleted: true,
      setupDate: new Date().toISOString()
    });

    const adminUser = StorageService.addUser({
      fullName: adminName.trim(),
      email: adminEmail.trim(),
      password: adminPassword,
      role: 'admin',
      employeeId: null
    });

    const session = {
      userId: adminUser.id,
      fullName: adminUser.fullName,
      email: adminUser.email,
      role: adminUser.role,
      employeeId: null,
      loginTime: new Date().toISOString()
    };
    StorageService.setSession(session);

    return { success: true, user: adminUser };
  },

  login(email, password) {
    if (!email || !password) {
      return { success: false, message: 'Please enter both email and password.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = StorageService.getUserByEmail(cleanEmail);

    if (!user) {
      return { success: false, message: 'No account found with this email address.' };
    }

    if (user.password !== password) {
      return { success: false, message: 'Incorrect password. Please try again.' };
    }

    const session = {
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId || null,
      loginTime: new Date().toISOString()
    };
    StorageService.setSession(session);

    return { success: true, user };
  },

  logout() {
    StorageService.clearSession();
    const isInPagesDir = window.location.pathname.includes('/pages/');
    window.location.href = isInPagesDir ? '../index.html' : 'index.html';
  },

  requireAuth(requiredRole = 'any') {
    const isInPagesDir = window.location.pathname.includes('/pages/');
    const loginPath = isInPagesDir ? '../index.html' : 'index.html';
    const adminDashboard = isInPagesDir ? 'admin.html' : 'pages/admin.html';
    const employeeDashboard = isInPagesDir ? 'employee.html' : 'pages/employee.html';

    if (this.needsFirstRun()) {
      if (isInPagesDir) {
        window.location.href = loginPath;
        return false;
      }
      return true;
    }

    const session = this.getSession();

    if (!session || !session.userId) {
      if (isInPagesDir) {
        window.location.href = loginPath;
        return false;
      }
      return true;
    }

    if (requiredRole === 'admin' && session.role !== 'admin') {
      window.location.href = employeeDashboard;
      return false;
    }

    if (requiredRole === 'employee' && session.role !== 'employee') {
      window.location.href = adminDashboard;
      return false;
    }

    return true;
  },

  initTheme() {
    const currentTheme = StorageService.getTheme();
    if (currentTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body && document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body && document.body.classList.remove('dark');
    }
    this.updateThemeToggleIcons(currentTheme);
  },

  toggleTheme() {
    const currentTheme = StorageService.getTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    StorageService.setTheme(newTheme);
    this.initTheme();
    return newTheme;
  },

  updateThemeToggleIcons(theme) {
    const buttons = document.querySelectorAll('.theme-toggle-btn');
    buttons.forEach(btn => {
      if (theme === 'dark') {
        btn.innerHTML = '<span class="icon">☀️</span> <span class="theme-text">Light Mode</span>';
        btn.setAttribute('aria-label', 'Switch to light mode');
      } else {
        btn.innerHTML = '<span class="icon">🌙</span> <span class="theme-text">Dark Mode</span>';
        btn.setAttribute('aria-label', 'Switch to dark mode');
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AuthService.initTheme();

  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      AuthService.toggleTheme();
    });
  });

  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to log out?')) {
        AuthService.logout();
      }
    });
  });
});

window.AuthService = AuthService;
