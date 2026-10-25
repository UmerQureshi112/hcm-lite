// js/leave.js
// Leave requests: employee apply/cancel, balance, aur admin ka approve/reject.
// Ye script employee.html, leaves.html aur admin.html par load hoti hai.

/* =========================================================
   Shared functions (helper.js bhi inhe use kar sakti hai)
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
  return LEAVE_TYPES[type] || type;
}

function createLeaveBadge(status) {
  const badge = document.createElement("span");
  badge.className = `badge ${LEAVE_BADGES[status] || "badge-muted"}`;
  badge.textContent = status;
  return badge;
}

// Request ke working days. Request banate waqt save ho jate hain,
// taake baad mein settings badlne se purane records na badlein.
function getLeaveDays(leave) {
  return Number(leave.days ?? countWorkingDays(leave.from, leave.to));
}

function formatLeavePeriod(leave) {
  return leave.from === leave.to
    ? formatDate(leave.from)
    : `${formatDate(leave.from)} → ${formatDate(leave.to)}`;
}

// Employee ka saal bhar ka balance
function getLeaveBalance(employeeId, year = new Date().getFullYear()) {
  const quota = Number(getSettings().leaveQuota);

  const mine = getLeaves().filter(
    (leave) =>
      String(leave.employeeId) === String(employeeId) &&
      leave.from.startsWith(String(year)),
  );

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
    available: Math.max(quota - used - pending, 0), // pending ke baad jitne din request ho sakte hain
  };
}

/* =========================================================
   Page ka kaam
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();

  // Employee dashboard
  const leaveForm = document.getElementById("leaveForm");
  const leaveType = document.getElementById("leaveType");
  const leaveFrom = document.getElementById("leaveFrom");
  const leaveTo = document.getElementById("leaveTo");
  const leaveReason = document.getElementById("leaveReason");
  const leaveError = document.getElementById("leaveError");
  const leaveDaysPreview = document.getElementById("leaveDaysPreview");
  const myLeavesBody = document.getElementById("myLeavesBody");

  const leaveBalanceEl = document.getElementById("leaveBalance");
  const leaveQuotaEl = document.getElementById("leaveQuota");
  const leaveUsedEl = document.getElementById("leaveUsed");
  const leavePendingEl = document.getElementById("leavePendingDays");
  const leaveBalanceBar = document.getElementById("leaveBalanceBar");

  // Admin leaves page
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

  // Admin dashboard
  const pendingLeavesBox = document.getElementById("pendingLeaves");

  function createCell(content) {
    const cell = document.createElement("td");

    if (content instanceof Node) {
      cell.appendChild(content);
    } else {
      cell.textContent = content ?? "";
    }

    return cell;
  }

  function createEmptyRow(text, columns) {
    const row = document.createElement("tr");
    row.className = "empty-row";

    const cell = createCell(text);
    cell.colSpan = columns;

    row.appendChild(cell);
    return row;
  }

  function showLeaveError(message = "") {
    if (leaveError) leaveError.textContent = message;
  }

  /* =======================================================
     EMPLOYEE: apply, cancel aur history
     ======================================================= */

  function updateDatePreview() {
    if (!leaveDaysPreview) return;

    if (!leaveFrom.value || !leaveTo.value || leaveTo.value < leaveFrom.value) {
      leaveDaysPreview.textContent = "";
      return;
    }

    const days = countWorkingDays(leaveFrom.value, leaveTo.value);
    leaveDaysPreview.textContent = `${days} working day${days === 1 ? "" : "s"} selected`;
  }

  function setupDateInputs() {
    if (!leaveFrom || !leaveTo) return;

    const today = getToday();
    leaveFrom.min = today;
    leaveTo.min = today;

    leaveFrom.addEventListener("change", () => {
      leaveTo.min = leaveFrom.value || today;

      // "To" date "From" se pehle ho to usse barabar kar do
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

    if (days === 0) {
      showLeaveError("The selected dates have no working days.");
      return;
    }

    const leaves = getLeaves();

    const overlapping = leaves.some(
      (leave) =>
        String(leave.employeeId) === String(user.id) &&
        leave.status !== "Rejected" &&
        from <= leave.to &&
        to >= leave.from,
    );

    if (overlapping) {
      showLeaveError(
        "You already have a pending or approved leave on these dates.",
      );
      return;
    }

    const balance = getLeaveBalance(user.id, Number(from.slice(0, 4)));

    if (days > balance.available) {
      showLeaveError(
        balance.pending > 0
          ? `You can request only ${balance.available} more day(s). ${balance.pending} day(s) are already waiting for approval.`
          : `You only have ${balance.available} leave day(s) left.`,
      );
      return;
    }

    leaves.push({
      id: generateId(),
      employeeId: user.id,
      employeeName: user.name,
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
    if (!confirm("Cancel this leave request?")) return;

    const remaining = getLeaves().filter(
      (item) =>
        !(String(item.id) === String(leave.id) && item.status === "Pending"),
    );

    saveData(STORAGE_KEYS.leaves, remaining);
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
        balance.quota > 0 ? (balance.remaining / balance.quota) * 100 : 0;
      leaveBalanceBar.style.width = `${percent}%`;
    }
  }

  function renderMyLeaves() {
    if (!myLeavesBody || !user || user.role !== "employee") return;

    const mine = getLeaves()
      .filter((leave) => String(leave.employeeId) === String(user.id))
      .sort((a, b) => b.from.localeCompare(a.from));

    myLeavesBody.innerHTML = "";

    if (mine.length === 0) {
      myLeavesBody.appendChild(
        createEmptyRow("You have not requested any leave yet.", 6),
      );
      return;
    }

    mine.forEach((leave) => {
      const row = document.createElement("tr");

      let action = "-";

      if (leave.status === "Pending") {
        action = document.createElement("button");
        action.type = "button";
        action.className = "btn btn-secondary btn-sm";
        action.textContent = "Cancel";
        action.addEventListener("click", () => cancelLeave(leave));
      }

      row.append(
        createCell(formatLeaveType(leave.type)),
        createCell(formatLeavePeriod(leave)),
        createCell(getLeaveDays(leave)),
        createCell(createLeaveBadge(leave.status)),
        createCell(leave.comment || "-"),
        createCell(action),
      );

      myLeavesBody.appendChild(row);
    });
  }

  /* =======================================================
     ADMIN: table, review aur dashboard list
     ======================================================= */

  function openReview(leave) {
    if (!reviewCard || !reviewForm) return;

    const balance = getLeaveBalance(
      leave.employeeId,
      Number(leave.from.slice(0, 4)),
    );

    reviewLeaveId.value = leave.id;
    reviewSummary.textContent =
      `${leave.employeeName} · ${formatLeaveType(leave.type)} · ${formatLeavePeriod(leave)} ` +
      `(${getLeaveDays(leave)} day${getLeaveDays(leave) === 1 ? "" : "s"}). ` +
      `Reason: ${leave.reason}. Balance left: ${balance.remaining} of ${balance.quota} days.`;

    leaveComment.value = "";
    reviewError.textContent = "";
    reviewCard.hidden = false;
    reviewCard.scrollIntoView({ behavior: "smooth", block: "center" });
    leaveComment.focus();
  }

  function closeReview() {
    if (!reviewCard) return;

    reviewForm.reset();
    reviewLeaveId.value = "";
    reviewError.textContent = "";
    reviewCard.hidden = true;
  }

  function renderLeaveTable() {
    if (!leavesTableBody) return;

    const leaves = getLeaves();

    if (pendingCount)
      pendingCount.textContent = leaves.filter(
        (l) => l.status === "Pending",
      ).length;
    if (approvedCount)
      approvedCount.textContent = leaves.filter(
        (l) => l.status === "Approved",
      ).length;
    if (rejectedCount)
      rejectedCount.textContent = leaves.filter(
        (l) => l.status === "Rejected",
      ).length;

    const selected = statusFilter?.value || "all";

    // Pending sab se upar, phir nayi requests pehle
    const filtered = leaves
      .filter((leave) => selected === "all" || leave.status === selected)
      .sort((a, b) => {
        if (a.status === "Pending" && b.status !== "Pending") return -1;
        if (b.status === "Pending" && a.status !== "Pending") return 1;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });

    leavesTableBody.innerHTML = "";

    if (filtered.length === 0) {
      leavesTableBody.appendChild(
        createEmptyRow("No leave requests found.", 8),
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
        createCell(leave.employeeName),
        createCell(formatLeaveType(leave.type)),
        createCell(formatLeavePeriod(leave)),
        createCell(getLeaveDays(leave)),
        createCell(leave.reason),
        createCell(createLeaveBadge(leave.status)),
        createCell(leave.comment || "-"),
        createCell(action),
      );

      leavesTableBody.appendChild(row);
    });
  }

  function submitReview(event) {
    event.preventDefault();
    reviewError.textContent = "";

    if (!user || user.role !== "admin") {
      reviewError.textContent = "Only an admin can review leave requests.";
      return;
    }

    const decision = event.submitter?.value;

    if (decision !== "approved" && decision !== "rejected") {
      reviewError.textContent = "Please choose Approve or Reject.";
      return;
    }

    const comment = leaveComment.value.trim();

    if (decision === "rejected" && !comment) {
      reviewError.textContent =
        "Please add a comment explaining the rejection.";
      return;
    }

    const leaves = getLeaves();
    const leave = leaves.find(
      (item) => String(item.id) === String(reviewLeaveId.value),
    );

    if (!leave) {
      reviewError.textContent = "Leave request not found.";
      return;
    }

    if (leave.status !== "Pending") {
      reviewError.textContent = "This request has already been reviewed.";
      return;
    }

    if (decision === "approved") {
      const balance = getLeaveBalance(
        leave.employeeId,
        Number(leave.from.slice(0, 4)),
      );

      if (getLeaveDays(leave) > balance.remaining) {
        reviewError.textContent =
          `${leave.employeeName} has only ${balance.remaining} leave day(s) left, ` +
          `but this request needs ${getLeaveDays(leave)}.`;
        return;
      }
    }

    leave.status = decision === "approved" ? "Approved" : "Rejected";
    leave.comment = comment;
    leave.reviewedAt = new Date().toISOString();

    if (!saveData(STORAGE_KEYS.leaves, leaves)) {
      reviewError.textContent = "Could not save the review.";
      return;
    }

    showToast(`Leave request ${leave.status.toLowerCase()}`, "success");
    closeReview();
    renderAll();
  }

  // Admin dashboard par pending requests ki chhoti list
  function renderPendingList() {
    if (!pendingLeavesBox) return;

    const pending = getLeaves()
      .filter((leave) => leave.status === "Pending")
      .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

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
      name.textContent = leave.employeeName;

      const details = document.createElement("small");
      details.textContent = `${formatLeaveType(leave.type)} · ${formatLeavePeriod(leave)} · ${getLeaveDays(leave)} day(s)`;

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

  /* =======================================================
     Start
     ======================================================= */

  function renderAll() {
    renderBalance();
    renderMyLeaves();
    renderLeaveTable();
    renderPendingList();
  }

  leaveForm?.addEventListener("submit", submitLeave);
  leaveForm?.addEventListener("input", () => showLeaveError(""));
  reviewForm?.addEventListener("submit", submitReview);
  cancelReviewBtn?.addEventListener("click", closeReview);
  statusFilter?.addEventListener("change", renderLeaveTable);

  // Doosre tab mein leaves ya settings badlein to ye page bhi update ho jaye
  window.addEventListener("storage", (event) => {
    if ([STORAGE_KEYS.leaves, STORAGE_KEYS.settings].includes(event.key))
      renderAll();
  });

  setupDateInputs();
  renderAll();

  // Dashboard se "Review" dabane par wahi request khul jaye
  const reviewId = new URLSearchParams(location.search).get("review");

  if (reviewId && reviewCard) {
    const target = getLeaves().find(
      (leave) => String(leave.id) === reviewId && leave.status === "Pending",
    );

    if (target) openReview(target);
  }
});
