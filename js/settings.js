/**
 * HCM Lite - Company Settings Module (js/settings.js)
 * Manages configuration for office hours, grace periods, half-day cutoffs,
 * leave quotas, and system resets. Admin role restricted.
 */

const SettingsModule = {
  init() {
    this.loadSettings();
    this.bindEvents();
  },

  loadSettings() {
    const company = StorageService.getCompany() || {};

    const nameInput = document.getElementById('settingCompanyName');
    const startTimeInput = document.getElementById('settingStartTime');
    const endTimeInput = document.getElementById('settingEndTime');
    const graceInput = document.getElementById('settingGracePeriod');
    const cutoffInput = document.getElementById('settingHalfDayCutoff');
    const quotaInput = document.getElementById('settingDefaultQuota');
    const workDaysInput = document.getElementById('settingWorkDays');
    const currencyInput = document.getElementById('settingCurrency');

    if (nameInput) nameInput.value = company.companyName || 'HCM Lite Demo Corp';
    if (startTimeInput) startTimeInput.value = company.officeStartTime || '09:00';
    if (endTimeInput) endTimeInput.value = company.officeEndTime || '18:00';
    if (graceInput) graceInput.value = company.gracePeriodMinutes !== undefined ? company.gracePeriodMinutes : 15;
    if (cutoffInput) cutoffInput.value = company.halfDayCutoff || '12:00';
    if (quotaInput) quotaInput.value = company.defaultLeaveQuota || 20;
    if (workDaysInput) workDaysInput.value = company.workDaysPerMonth || 22;
    if (currencyInput) currencyInput.value = company.currency || '$';
  },

  bindEvents() {
    const form = document.getElementById('settingsForm');
    const resetBtn = document.getElementById('resetAllDataBtn');

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSaveSettings();
    });

    resetBtn?.addEventListener('click', () => {
      this.handleResetData();
    });
  },

  handleSaveSettings() {
    const companyName = document.getElementById('settingCompanyName')?.value.trim();
    const officeStartTime = document.getElementById('settingStartTime')?.value;
    const officeEndTime = document.getElementById('settingEndTime')?.value;
    const gracePeriodMinutes = parseInt(document.getElementById('settingGracePeriod')?.value, 10);
    const halfDayCutoff = document.getElementById('settingHalfDayCutoff')?.value;
    const defaultLeaveQuota = parseInt(document.getElementById('settingDefaultQuota')?.value, 10);
    const workDaysPerMonth = parseInt(document.getElementById('settingWorkDays')?.value, 10);
    const currency = document.getElementById('settingCurrency')?.value.trim() || '$';

    if (!companyName) {
      window.showToast('Company name is required.', 'error');
      return;
    }

    if (!officeStartTime || !officeEndTime || !halfDayCutoff) {
      window.showToast('Office hours and cutoff times must be specified.', 'error');
      return;
    }

    if (officeStartTime >= officeEndTime) {
      window.showToast('Office start time must be before office end time.', 'error');
      return;
    }

    if (halfDayCutoff <= officeStartTime) {
      window.showToast('Half-day cutoff time must be after the office start time.', 'error');
      return;
    }

    if (isNaN(gracePeriodMinutes) || gracePeriodMinutes < 0) {
      window.showToast('Grace period must be a non-negative number.', 'error');
      return;
    }

    if (isNaN(defaultLeaveQuota) || defaultLeaveQuota <= 0) {
      window.showToast('Default leave quota must be greater than 0.', 'error');
      return;
    }

    if (isNaN(workDaysPerMonth) || workDaysPerMonth <= 0 || workDaysPerMonth > 31) {
      window.showToast('Standard working days per month must be between 1 and 31.', 'error');
      return;
    }

    StorageService.saveCompany({
      companyName,
      officeStartTime,
      officeEndTime,
      gracePeriodMinutes,
      halfDayCutoff,
      defaultLeaveQuota,
      workDaysPerMonth,
      currency
    });

    const brandText = document.querySelectorAll('.company-name-display');
    brandText.forEach(el => el.textContent = companyName);

    window.showToast('Company settings saved successfully!', 'success');
  },

  handleResetData() {
    const confirmation = prompt(
      'DANGER ZONE:\nThis action will erase ALL company data, employees, attendance records, leaves, and user accounts.\n\nType RESET to confirm:'
    );

    if (confirmation === 'RESET') {
      StorageService.resetAllData();
      alert('All application data has been wiped. Redirecting to first-run setup.');
      window.location.href = '../index.html';
    } else if (confirmation !== null) {
      alert('Reset cancelled. You must type RESET exactly to confirm.');
    }
  }
};

window.SettingsModule = SettingsModule;
