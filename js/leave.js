
/* =========================================================
   HCM Lite - Leave Management
   Works with employee.html, leaves.html and admin.html
   ========================================================= */

const LEAVE_TYPES = {
  casual: "Casual Leave",
  sick: "Sick Leave",
  annual: "Annual Leave",
};

const LEAVE_BADGES = {
  Pending: "badge-warning",
  Approved: "badge-success",
  Rejected: "badge-danger",
};

function formatLeaveType(type) {
  return LEAVE_TYPES[type] || type || "Leave";
}

function createLeaveBadge(status) {
  const badge = document.createElement("span");
  badge.className = `badge ${LEAVE_BADGES[status] || "badge-muted"}`;
  badge.textContent = status || "Pending";
  return badge;
}

function getLeaveDays(leave) {
  const savedDays = Number(leave.days);

  if (Number.isFinite(savedDays) && savedDays > 0) {
    return savedDays;
  }

  return countWorkingDays(leave.from, leave.to);
}

function formatLeavePeriod(leave) {
  if (!leave.from || !leave.to) return "—";

  return leave.from === leave.to
    ? formatDate(leave.from)
    : `${formatDate(leave.from)} → ${formatDate(leave.to)}`;
}

function getLeaveBalance(employeeId, year = new Date().getFullYear()) {
  const settings = getSettings() || {};
  const quota = Math.max(0, Number(settings.leaveQuota) || 0);

  const mine = getLeaves().filter((leave) => {
    return (
      String(leave.employeeId) === String(employeeId) &&
      leave.from &&
      leave.from.startsWith(String(year))
    );
  });

  const sumDays = (status) =>
    mine
      .filter((leave) => leave.status === status)
      .reduce((total, leave) => total + getLeaveDays(leave), 0);

  const used = sumDays("Approved");
  const pending = sumDays("Pending");

  return {
    quota,
    used,
    pending,
    remaining: Math.max(quota - used, 0),
    available: Math.max(quota - used - pending, 0),
  };
}

/* =========================================================
   Page setup
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();

  // Employee leave form (if present on the page)
  const leaveForm = document.getElementById("leaveForm");
  const leaveType = document.getElementById("leaveType");
  const leaveFrom = document.getElementById("leaveFrom");
  const leaveTo = document.getElementById("leaveTo");
  const leaveReason = document.getElementById("leaveReason");
  const leaveError = document.getElementById("leaveError");
  const leaveDaysPreview = document.getElementById("leaveDaysPreview");

  // Employee dashboard
  const myLeavesBody =
    document.getElementById("myLeaveTable") ||
    document.getElementById("myLeavesBody");

  const leaveBalanceEl = document.getElementById("leaveBalance");
  const leaveQuotaEl = document.getElementById("leaveQuota");
  const leaveUsedEl = document.getElementById("leaveUsed");
  const leavePendingEl = document.getElementById("leavePendingDays");
  const leaveBalanceBar = document.getElementById("leaveBalanceBar");

  // Admin leave management
  const leavesTableBody = document.getElementById("leavesTableBody");
  const pendingCount = document.getElementById("pendingCount");
  const approvedCount = document.getElementById("approvedCount");
  const rejectedCount = document.getElementById("rejectedCount");
  const statusFilter = document.getElementById("leaveStatusFilter");

  const reviewCard = document.getElementById("reviewCard");
  const reviewForm = document.getElementById("leaveReviewForm");
  const reviewLeaveId = document.getElementById("reviewLeaveId");
  const reviewSummary = document.getElementById("reviewSummary");
  const reviewError = document.getElementById("reviewError");
  const leaveComment = document.getElementById("leaveComment");
  const cancelReviewBtn = document.getElementById("cancelReviewBtn");

  // Admin dashboard: support both IDs
  const pendingLeavesBox =
    document.getElementById("pendingLeavesList") ||
    document.getElementById("pendingLeaves");

  function createCell(content) {
    const cell = document.createElement("td");

    if (content instanceof Node) {
      cell.appendChild(content);
    } else {
      cell.textContent = content ?? "";
    }

    return cell;
  }

  function createEmptyRow(message, columns) {
    const row = document.createElement("tr");
    row.className = "empty-row";

    const cell = createCell(message);
    cell.colSpan = columns;
    row.appendChild(cell);

    return row;
  }

  function showLeaveError(message = "") {
    if (leaveError) leaveError.textContent = message;
  }

  function showReviewError(message = "") {
    if (reviewError) reviewError.textContent = message;
  }

  /* =========================================================
     Employee: date preview and leave application
     ========================================================= */

  function updateDatePreview() {
    if (!leaveDaysPreview || !leaveFrom || !leaveTo) return;

    if (
      !leaveFrom.value ||
      !leaveTo.value ||
      leaveTo.value < leaveFrom.value
    ) {
      leaveDaysPreview.textContent = "";
      return;
    }

    const days = countWorkingDays(leaveFrom.value, leaveTo.value);

    leaveDaysPreview.textContent =
      `${days} working day${days === 1 ? "" : "s"} selected`;
  }

  function setupDateInputs() {
    if (!leaveFrom || !leaveTo) return;

    const today = getToday();

    leaveFrom.min = today;
    leaveTo.min = today;

    leaveFrom.addEventListener("change", () => {
      leaveTo.min = leaveFrom.value || today;

      if (leaveTo.value && leaveTo.value < leaveFrom.value) {
        leaveTo.value = leaveFrom.value;
      }

      updateDatePreview();
    });

    leaveTo.addEventListener("change", updateDatePreview);
  }

  function submitLeave(event) {
    event.preventDefault();
    showLeaveError("");

    if (!user || user.role !== "employee") {
      showLeaveError("Please log in as an employee.");
      return;
    }

    if (!leaveType || !leaveFrom || !leaveTo || !leaveReason) {
      showLeaveError("The leave form is missing required fields.");
      return;
    }

    const type = leaveType.value;
    const from = leaveFrom.value;
    const to = leaveTo.value;
    const reason = leaveReason.value.trim();

    if (!type || !from || !to || !reason) {
      showLeaveError("Please fill in all fields.");
      return;
    }

    if (from < getToday()) {
      showLeaveError("Leave cannot start in the past.");
      return;
    }

    if (to < from) {
      showLeaveError("The end date cannot be before the start date.");
      return;
    }

    const days = countWorkingDays(from, to);

    if (days < 1) {
      showLeaveError("The selected dates have no working days.");
      return;
    }

    const leaves = getLeaves();

    const overlapping = leaves.some((leave) => {
      return (
        String(leave.employeeId) === String(user.id) &&
        leave.status !== "Rejected" &&
        from <= leave.to &&
        to >= leave.from
      );
    });

    if (overlapping) {
      showLeaveError(
        "You already have a pending or approved leave on these dates."
      );
      return;
    }

    const balance = getLeaveBalance(
      user.id,
      Number(from.slice(0, 4))
    );

    if (days > balance.available) {
      showLeaveError(
        `You can request only ${balance.available} more day(s).`
      );
      return;
    }

    leaves.push({
      id: generateId(),
      employeeId: user.id,
      employeeName: user.name || user.fullName || "Employee",
      type,
      from,
      to,
      days,
      reason,
      status: "Pending",
      comment: "",
      createdAt: new Date().toISOString(),
    });

    if (!saveData(STORAGE_KEYS.leaves, leaves)) {
      showLeaveError("Could not save your leave request.");
      return;
    }

    leaveForm.reset();
    updateDatePreview();

    showToast("Leave request submitted", "success");
    renderAll();
  }

  function cancelLeave(leave) {
    if (!leave || leave.status !== "Pending") return;

    if (!confirm("Cancel this leave request?")) return;

    const remaining = getLeaves().filter((item) => {
      return !(
        String(item.id) === String(leave.id) &&
        item.status === "Pending"
      );
    });

    if (!saveData(STORAGE_KEYS.leaves, remaining)) {
      showToast("Could not cancel the leave request", "error");
      return;
    }

    showToast("Leave request cancelled", "success");
    renderAll();
  }

  function renderBalance() {
    if (!leaveBalanceEl || !user || user.role !== "employee") return;

    const balance = getLeaveBalance(user.id);

    leaveBalanceEl.textContent = balance.remaining;

    if (leaveQuotaEl) leaveQuotaEl.textContent = balance.quota;
    if (leaveUsedEl) leaveUsedEl.textContent = balance.used;
    if (leavePendingEl) leavePendingEl.textContent = balance.pending;

    if (leaveBalanceBar) {
      const percent =
        balance.quota > 0
          ? (balance.remaining / balance.quota) * 100
          : 0;

      leaveBalanceBar.style.width = `${percent}%`;
      leaveBalanceBar.setAttribute("aria-valuenow", String(percent));
    }
  }

  function renderMyLeaves() {
    if (!myLeavesBody || !user || user.role !== "employee") return;

    const mine = getLeaves()
      .filter(
        (leave) => String(leave.employeeId) === String(user.id)
      )
      .sort((a, b) => (b.from || "").localeCompare(a.from || ""));

    myLeavesBody.innerHTML = "";

    if (mine.length === 0) {
      // Employee dashboard table has five columns
      myLeavesBody.appendChild(
        createEmptyRow("You have not requested any leave yet.", 5)
      );
      return;
    }

    mine.forEach((leave) => {
      const row = document.createElement("tr");

      row.append(
        createCell(formatLeaveType(leave.type)),
        createCell(leave.from ? formatDate(leave.from) : "—"),
        createCell(leave.to ? formatDate(leave.to) : "—"),
        createCell(getLeaveDays(leave)),
        createCell(createLeaveBadge(leave.status))
      );

      myLeavesBody.appendChild(row);
    });
  }

  /* =========================================================
     Admin: leave table and review form
     ========================================================= */

  function openReview(leave) {
    if (!reviewCard || !reviewForm) return;

    const balance = getLeaveBalance(
      leave.employeeId,
      Number((leave.from || "").slice(0, 4)) ||
        new Date().getFullYear()
    );

    if (reviewLeaveId) reviewLeaveId.value = leave.id;

    if (reviewSummary) {
      reviewSummary.textContent =
        `${leave.employeeName || "Employee"} · ` +
        `${formatLeaveType(leave.type)} · ` +
        `${formatLeavePeriod(leave)} · ` +
        `${getLeaveDays(leave)} day(s). ` +
        `Reason: ${leave.reason || "Not provided"}. ` +
        `Balance left: ${balance.remaining} of ${balance.quota} days.`;
    }

    if (leaveComment) leaveComment.value = "";
    showReviewError("");

    reviewCard.hidden = false;
    reviewCard.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    if (leaveComment) leaveComment.focus();
  }

  function closeReview() {
    if (!reviewCard) return;

    if (reviewForm) reviewForm.reset();
    if (reviewLeaveId) reviewLeaveId.value = "";

    showReviewError("");
    reviewCard.hidden = true;
  }

  function renderLeaveTable() {
    if (!leavesTableBody) return;

    const leaves = getLeaves();

    if (pendingCount) {
      pendingCount.textContent = leaves.filter(
        (leave) => leave.status === "Pending"
      ).length;
    }

    if (approvedCount) {
      approvedCount.textContent = leaves.filter(
        (leave) => leave.status === "Approved"
      ).length;
    }

    if (rejectedCount) {
      rejectedCount.textContent = leaves.filter(
        (leave) => leave.status === "Rejected"
      ).length;
    }

    const selected = statusFilter?.value || "all";

    const filtered = leaves
      .filter(
        (leave) => selected === "all" || leave.status === selected
      )
      .sort((a, b) => {
        if (a.status === "Pending" && b.status !== "Pending") return -1;
        if (b.status === "Pending" && a.status !== "Pending") return 1;

        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });

    leavesTableBody.innerHTML = "";

    if (filtered.length === 0) {
      leavesTableBody.appendChild(
        createEmptyRow("No leave requests found.", 8)
      );
      return;
    }

    filtered.forEach((leave) => {
      const row = document.createElement("tr");

      let action = "-";

      if (leave.status === "Pending") {
        action = document.createElement("button");
        action.type = "button";
        action.className = "btn btn-primary btn-sm";
        action.textContent = "Review";
        action.addEventListener("click", () => openReview(leave));
      }

      row.append(
        createCell(leave.employeeName || "Employee"),
        createCell(formatLeaveType(leave.type)),
        createCell(formatLeavePeriod(leave)),
        createCell(getLeaveDays(leave)),
        createCell(leave.reason || "—"),
        createCell(createLeaveBadge(leave.status)),
        createCell(leave.comment || "—"),
        createCell(action)
      );

      leavesTableBody.appendChild(row);
    });
  }

  function submitReview(event) {
    event.preventDefault();
    showReviewError("");

    if (!user || user.role !== "admin") {
      showReviewError("Only an admin can review leave requests.");
      return;
    }

    const decision = event.submitter?.value;

    if (decision !== "approved" && decision !== "rejected") {
      showReviewError("Please choose Approve or Reject.");
      return;
    }

    const comment = leaveComment?.value.trim() || "";

    if (decision === "rejected" && !comment) {
      showReviewError(
        "Please add a comment explaining the rejection."
      );
      return;
    }

    const leaves = getLeaves();

    const leave = leaves.find(
      (item) =>
        String(item.id) === String(reviewLeaveId?.value || "")
    );

    if (!leave) {
      showReviewError("Leave request not found.");
      return;
    }

    if (leave.status !== "Pending") {
      showReviewError("This request has already been reviewed.");
      return;
    }

    if (decision === "approved") {
      const balance = getLeaveBalance(
        leave.employeeId,
        Number((leave.from || "").slice(0, 4)) ||
          new Date().getFullYear()
      );

      if (getLeaveDays(leave) > balance.remaining) {
        showReviewError(
          `${leave.employeeName || "Employee"} has only ` +
          `${balance.remaining} leave day(s) left, but this request ` +
          `needs ${getLeaveDays(leave)}.`
        );
        return;
      }
    }

    leave.status =
      decision === "approved" ? "Approved" : "Rejected";

    leave.comment = comment;
    leave.reviewedAt = new Date().toISOString();

    if (!saveData(STORAGE_KEYS.leaves, leaves)) {
      showReviewError("Could not save the review.");
      return;
    }

    showToast(
      `Leave request ${leave.status.toLowerCase()}`,
      "success"
    );

    closeReview();
    renderAll();
  }

  /* =========================================================
     Admin dashboard: pending leave list
     ========================================================= */

  function renderPendingList() {
    if (!pendingLeavesBox) return;

    const pending = getLeaves()
      .filter((leave) => leave.status === "Pending")
      .sort((a, b) =>
        (b.createdAt || "").localeCompare(a.createdAt || "")
      );

    pendingLeavesBox.innerHTML = "";

    if (pending.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No pending leave requests.";
      pendingLeavesBox.appendChild(empty);
      return;
    }

    pending.slice(0, 5).forEach((leave) => {
      const item = document.createElement("div");
      item.className = "pending-item";

      const info = document.createElement("div");
      info.className = "pending-info";

      const name = document.createElement("strong");
      name.textContent = leave.employeeName || "Employee";

      const details = document.createElement("small");
      details.textContent =
        `${formatLeaveType(leave.type)} · ` +
        `${formatLeavePeriod(leave)} · ` +
        `${getLeaveDays(leave)} day(s)`;

      info.append(name, details);

      const link = document.createElement("a");
      link.className = "btn btn-secondary btn-sm";
      link.href = `leaves.html?review=${encodeURIComponent(leave.id)}`;
      link.textContent = "Review";

      item.append(info, link);
      pendingLeavesBox.appendChild(item);
    });

    if (pending.length > 5) {
      const more = document.createElement("p");
      more.className = "muted pending-more";
      more.textContent = `+ ${pending.length - 5} more pending`;
      pendingLeavesBox.appendChild(more);
    }
  }

  /* =========================================================
     Render and events
     ========================================================= */

  function renderAll() {
    renderBalance();
    renderMyLeaves();
    renderLeaveTable();
    renderPendingList();
  }

  leaveForm?.addEventListener("submit", submitLeave);

  leaveForm?.addEventListener("input", () => {
    showLeaveError("");
  });

  reviewForm?.addEventListener("submit", submitReview);
  cancelReviewBtn?.addEventListener("click", closeReview);
  statusFilter?.addEventListener("change", renderLeaveTable);

  window.addEventListener("storage", (event) => {
    if (
      event.key === STORAGE_KEYS.leaves ||
      event.key === STORAGE_KEYS.settings
    ) {
      renderAll();
    }
  });

  setupDateInputs();
  renderAll();

  // Open the selected pending request from the dashboard link
  const reviewId = new URLSearchParams(location.search).get("review");

  if (reviewId && reviewCard) {
    const target = getLeaves().find(
      (leave) =>
        String(leave.id) === reviewId &&
        leave.status === "Pending"
    );

    if (target) openReview(target);
  }
});
