// js/settings.js
// Company settings: load, validate, save and preview.

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("settingsForm");
  if (!form) return;

  const companyInput = document.getElementById("settingsCompanyName");
  const startInput = document.getElementById("officeStartTime");
  const graceInput = document.getElementById("graceMinutes");
  const halfDayInput = document.getElementById("halfDayMinutes");
  const quotaInput = document.getElementById("leaveQuota");
  const dayBoxes = form.querySelectorAll('input[name="workingDays"]');

  const errorEl = document.getElementById("settingsError");
  const messageEl = document.getElementById("settingsMessage");

  const rulePresent = document.getElementById("rulePresent");
  const ruleLate = document.getElementById("ruleLate");
  const ruleHalf = document.getElementById("ruleHalf");
  const ruleDays = document.getElementById("ruleDays");

  const DEFAULT_SETTINGS = {
    officeStartTime: "09:00",
    graceMinutes: 15,
    halfDayAfterMinutes: 120,
    leaveQuota: 12,
    workingDays: [1, 2, 3, 4, 5]
  };

  function minutesToTime(total) {
    const safe = ((total % 1440) + 1440) % 1440;
    const hours = String(Math.floor(safe / 60)).padStart(2, "0");
    const minutes = String(safe % 60).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  function getSelectedDays() {
    return [...dayBoxes]
      .filter((box) => box.checked)
      .map((box) => Number(box.value));
  }

  function getSafeSettings() {
    const saved = getSettings() || {};

    return {
      officeStartTime:
        saved.officeStartTime || DEFAULT_SETTINGS.officeStartTime,
      graceMinutes:
        Number.isFinite(Number(saved.graceMinutes))
          ? Number(saved.graceMinutes)
          : DEFAULT_SETTINGS.graceMinutes,
      halfDayAfterMinutes:
        Number.isFinite(Number(saved.halfDayAfterMinutes))
          ? Number(saved.halfDayAfterMinutes)
          : DEFAULT_SETTINGS.halfDayAfterMinutes,
      leaveQuota:
        Number.isFinite(Number(saved.leaveQuota))
          ? Number(saved.leaveQuota)
          : DEFAULT_SETTINGS.leaveQuota,
      workingDays:
        Array.isArray(saved.workingDays) && saved.workingDays.length
          ? saved.workingDays.map(Number)
          : DEFAULT_SETTINGS.workingDays
    };
  }

  function fillForm() {
    const settings = getSafeSettings();

    if (companyInput) {
      companyInput.value = getCompanyName() || "";
    }

    if (startInput) startInput.value = settings.officeStartTime;
    if (graceInput) graceInput.value = settings.graceMinutes;
    if (halfDayInput) halfDayInput.value = settings.halfDayAfterMinutes;
    if (quotaInput) quotaInput.value = settings.leaveQuota;

    dayBoxes.forEach((box) => {
      box.checked = settings.workingDays.includes(Number(box.value));
    });
  }

  function updatePreview() {
    const selectedDays = getSelectedDays();

    if (ruleDays) {
      ruleDays.textContent = selectedDays.length;
    }

    if (!startInput?.value) return;

    const start = timeToMinutes(startInput.value);
    const grace = Number(graceInput?.value) || 0;
    const halfDay = Number(halfDayInput?.value) || 0;

    if (rulePresent) {
      rulePresent.textContent = minutesToTime(start + grace);
    }

    if (ruleLate) {
      ruleLate.textContent = minutesToTime(start + grace);
    }

    if (ruleHalf) {
      ruleHalf.textContent = minutesToTime(start + halfDay);
    }
  }

  function clearMessages() {
    if (errorEl) errorEl.textContent = "";
    if (messageEl) {
      messageEl.textContent = "";
      messageEl.classList.remove("success");
    }
  }

  form.addEventListener("input", () => {
    clearMessages();
    updatePreview();
  });

  form.addEventListener("change", updatePreview);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearMessages();

    const companyName = companyInput?.value.trim() || "";
    const officeStartTime = startInput?.value || "";
    const graceMinutes = Number(graceInput?.value);
    const halfDayAfterMinutes = Number(halfDayInput?.value);
    const leaveQuota = Number(quotaInput?.value);
    const workingDays = getSelectedDays();

    function fail(message) {
      if (errorEl) errorEl.textContent = message;
      else alert(message);
    }

    if (!companyName) {
      fail("Please enter the company name.");
      return;
    }

    if (!officeStartTime) {
      fail("Please choose the office start time.");
      return;
    }

    if (
      graceInput?.value === "" ||
      !Number.isInteger(graceMinutes) ||
      graceMinutes < 0
    ) {
      fail("Grace minutes must be a whole number of 0 or more.");
      return;
    }

    if (
      halfDayInput?.value === "" ||
      !Number.isInteger(halfDayAfterMinutes) ||
      halfDayAfterMinutes <= graceMinutes
    ) {
      fail("Half-day minutes must be greater than grace minutes.");
      return;
    }

    if (
      quotaInput?.value === "" ||
      !Number.isInteger(leaveQuota) ||
      leaveQuota < 0
    ) {
      fail("Leave quota must be a whole number of 0 or more.");
      return;
    }

    if (workingDays.length === 0) {
      fail("Select at least one working day.");
      return;
    }

    try {
      const settingsSaved = saveData(STORAGE_KEYS.settings, {
        officeStartTime,
        graceMinutes,
        halfDayAfterMinutes,
        leaveQuota,
        workingDays
      });

      const existingCompany = getData(STORAGE_KEYS.company, {}) || {};

      const companySaved = saveData(STORAGE_KEYS.company, {
        ...existingCompany,
        name: companyName
      });

      if (!settingsSaved || !companySaved) {
        fail("Could not save settings. Check browser storage.");
        return;
      }
    } catch (error) {
      console.error("Settings save failed:", error);
      fail("Could not save settings. Check browser storage.");
      return;
    }

    document.querySelectorAll("[data-company-name]").forEach((element) => {
      element.textContent = companyName;
    });

    if (messageEl) {
      messageEl.textContent = "Settings saved successfully.";
      messageEl.classList.add("success");
    }

    if (typeof showToast === "function") {
      showToast("Settings saved", "success");
    }

    updatePreview();
  });

  fillForm();
  updatePreview();
});
