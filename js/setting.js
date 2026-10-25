// js/settings.js
// Company settings: load, validate aur save. Sirf settings page par chalti hai.

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

  // 570 ko "09:30" banata hai
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

  // Saved settings form mein bharo
  function fillForm() {
    const settings = getSettings();

    companyInput.value = getCompanyName();
    startInput.value = settings.officeStartTime;
    graceInput.value = settings.graceMinutes;
    halfDayInput.value = settings.halfDayAfterMinutes;
    quotaInput.value = settings.leaveQuota;

    dayBoxes.forEach((box) => {
      box.checked = settings.workingDays.includes(Number(box.value));
    });
  }

  // Right side ka live preview
  function updatePreview() {
    ruleDays.textContent = getSelectedDays().length;

    if (!startInput.value) return;

    const start = timeToMinutes(startInput.value);
    const grace = Number(graceInput.value) || 0;
    const halfDay = Number(halfDayInput.value) || 0;

    rulePresent.textContent = minutesToTime(start + grace);
    ruleLate.textContent = minutesToTime(start + halfDay);
    ruleHalf.textContent = minutesToTime(start + halfDay);
  }

  function clearMessages() {
    errorEl.textContent = "";
    messageEl.textContent = "";
    messageEl.classList.remove("success");
  }

  form.addEventListener("input", () => {
    clearMessages();
    updatePreview();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearMessages();

    const companyName = companyInput.value.trim();
    const officeStartTime = startInput.value;
    const graceMinutes = Number(graceInput.value);
    const halfDayAfterMinutes = Number(halfDayInput.value);
    const leaveQuota = Number(quotaInput.value);
    const workingDays = getSelectedDays();

    if (!companyName) {
      errorEl.textContent = "Please enter the company name.";
      return;
    }

    if (!officeStartTime) {
      errorEl.textContent = "Please choose the office start time.";
      return;
    }

    if (
      graceInput.value === "" ||
      !Number.isInteger(graceMinutes) ||
      graceMinutes < 0
    ) {
      errorEl.textContent = "Grace minutes must be 0 or more.";
      return;
    }

    if (
      !Number.isInteger(halfDayAfterMinutes) ||
      halfDayAfterMinutes <= graceMinutes
    ) {
      errorEl.textContent =
        "Half day minutes must be a whole number greater than the grace minutes.";
      return;
    }

    if (
      quotaInput.value === "" ||
      !Number.isInteger(leaveQuota) ||
      leaveQuota < 0
    ) {
      errorEl.textContent = "Leave quota must be 0 or more.";
      return;
    }

    if (workingDays.length === 0) {
      errorEl.textContent = "Select at least one working day.";
      return;
    }

    const saved =
      saveData(STORAGE_KEYS.settings, {
        officeStartTime,
        graceMinutes,
        halfDayAfterMinutes,
        leaveQuota,
        workingDays,
      }) &&
      saveData(STORAGE_KEYS.company, {
        ...getData(STORAGE_KEYS.company, {}),
        name: companyName,
      });

    if (!saved) {
      errorEl.textContent = "Could not save settings. Check browser storage.";
      return;
    }

    // Sidebar mein company ka naam foran badal do
    document.querySelectorAll("[data-company-name]").forEach((el) => {
      el.textContent = companyName;
    });

    messageEl.textContent = "Settings saved successfully.";
    messageEl.classList.add("success");
    showToast("Settings saved", "success");
  });

  fillForm();
  updatePreview();
});
