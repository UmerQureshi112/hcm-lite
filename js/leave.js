/**
 * HCM Lite - Leave Management Module (js/leave.js)
 * Implements leave applications, overlap detection, quota deduction on approval,
 * decision commenting, and balance recalculation.
 */

const LeaveModule = {
  currentDecisionLeaveId: null,

  calculateDays(startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) return 0;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) return 0;

    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  },

  getLeaveBalance(employeeId) {
    if (!employeeId) return { quota: 20, usedDays: 0, remaining: 20 };
    const employee = StorageService.getEmployeeByEmpId(employeeId);
    const company = StorageService.getCompany() || {};
    const quota = employee ? employee.leaveQuota : (company.defaultLeaveQuota || 20);

    const allLeaves = StorageService.getEmployeeLeaves(employeeId);
    const approvedLeaves = allLeaves.filter(l => l && l.status === 'Approved' && l.leaveType !== 'Unpaid');
    const usedDays = approvedLeaves.reduce((sum, l) => sum + (parseInt(l.daysCount, 10) || 0), 0);

    const remaining = Math.max(0, quota - usedDays);

    return {
      quota,
      usedDays,
      remaining
    };
  },

  hasOverlappingLeave(employeeId, newStartStr, newEndStr, excludeLeaveId = null) {
    if (!employeeId || !newStartStr || !newEndStr) return false;
    const leaves = StorageService.getEmployeeLeaves(employeeId);
    const nStart = new Date(newStartStr).getTime();
    const nEnd = new Date(newEndStr).getTime();

    return leaves.some(l => {
      if (!l) return false;
      if (excludeLeaveId && l.id === excludeLeaveId) return false;
      if (l.status === 'Rejected') return false;

      const exStart = new Date(l.startDate).getTime();
      const exEnd = new Date(l.endDate).getTime();

      return nStart <= exEnd && nEnd >= exStart;
    });
  },

  applyLeave(formData) {
    const { employeeId, leaveType, startDate, endDate, reason } = formData;

    if (!employeeId || !leaveType || !startDate || !endDate || !reason) {
      return { success: false, message: 'Please fill out all required fields.' };
    }

    if (startDate > endDate) {
      return { success: false, message: 'Leave start date cannot be after end date.' };
    }

    const todayStr = StorageService.getLocalDate();
    if (startDate < todayStr) {
      return { success: false, message: 'Leave applications cannot be submitted for past dates. Please select today or a future date.' };
    }

    if (this.hasOverlappingLeave(employeeId, startDate, endDate)) {
      return {
        success: false,
        message: 'You already have an existing pending or approved leave request covering these dates.'
      };
    }

    const daysCount = this.calculateDays(startDate, endDate);
    if (daysCount <= 0) {
      return { success: false, message: 'Invalid leave duration.' };
    }

    if (leaveType !== 'Unpaid') {
      const balance = this.getLeaveBalance(employeeId);
      if (daysCount > balance.remaining) {
        return {
          success: false,
          message: `Insufficient leave balance. You requested ${daysCount} day(s), but only have ${balance.remaining} day(s) remaining.`
        };
      }
    }

    const newLeave = StorageService.addLeave({
      employeeId,
      leaveType,
      startDate,
      endDate,
      daysCount,
      reason: reason.trim()
    });

    return {
      success: true,
      message: 'Leave application submitted successfully for review.',
      leave: newLeave
    };
  },

  approveLeave(leaveId, comment = '') {
    const leave = StorageService.getLeaveById(leaveId);
    if (!leave) return { success: false, message: 'Leave request not found.' };

    if (leave.status === 'Approved') {
      return { success: false, message: 'This leave request has already been approved.' };
    }

    if (leave.leaveType !== 'Unpaid') {
      const balance = this.getLeaveBalance(leave.employeeId);
      if (leave.daysCount > balance.remaining) {
        return {
          success: false,
          message: `Cannot approve: Employee only has ${balance.remaining} remaining day(s), but request is for ${leave.daysCount} day(s).`
        };
      }
    }

    const updated = StorageService.updateLeave(leaveId, {
      status: 'Approved',
      adminComment: comment ? comment.trim() : 'Approved by Administrator',
      reviewedAt: new Date().toISOString()
    });

    return {
      success: true,
      message: `Leave request approved successfully. ${leave.daysCount} day(s) deducted.`,
      leave: updated
    };
  },

  rejectLeave(leaveId, comment = '') {
    const leave = StorageService.getLeaveById(leaveId);
    if (!leave) return { success: false, message: 'Leave request not found.' };

    if (leave.status === 'Rejected') {
      return { success: false, message: 'This leave request has already been rejected.' };
    }

    const updated = StorageService.updateLeave(leaveId, {
      status: 'Rejected',
      adminComment: comment ? comment.trim() : 'Rejected by Administrator',
      reviewedAt: new Date().toISOString()
    });

    return {
      success: true,
      message: 'Leave request rejected. No leave quota deducted.',
      leave: updated
    };
  },

  renderAdminLeavesTable() {
    const tableBody = document.getElementById('adminLeavesTableBody');
    const emptyState = document.getElementById('leavesEmptyState');
    const tableContainer = document.getElementById('leavesTableContainer');

    if (!tableBody) return;

    const allLeaves = StorageService.getLeaves();
    const statusFilter = document.getElementById('filterLeaveStatus')?.value || 'all';
    const typeFilter = document.getElementById('filterLeaveType')?.value || 'all';
    const searchQuery = (document.getElementById('searchLeave')?.value || '').toLowerCase().trim();

    const employees = StorageService.getEmployees();

    const filtered = allLeaves.filter(leave => {
      if (!leave) return false;
      const emp = employees.find(e => e && e.employeeId === leave.employeeId);
      const empName = emp ? emp.fullName.toLowerCase() : '';
      const empId = (leave.employeeId || '').toLowerCase();
      const reason = (leave.reason || '').toLowerCase();

      const matchSearch = empName.includes(searchQuery) || empId.includes(searchQuery) || reason.includes(searchQuery);
      const matchStatus = statusFilter === 'all' || leave.status === statusFilter;
      const matchType = typeFilter === 'all' || leave.leaveType === typeFilter;

      return matchSearch && matchStatus && matchType;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      if (tableContainer) tableContainer.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';

    tableBody.innerHTML = filtered.map(leave => {
      const emp = employees.find(e => e && e.employeeId === leave.employeeId);
      const empName = emp ? emp.fullName : 'Unknown Employee';
      const empDept = emp ? emp.department : '-';

      const statusBadge =
        leave.status === 'Approved' ? 'badge-approved' :
        leave.status === 'Rejected' ? 'badge-rejected' : 'badge-pending';

      const actions = leave.status === 'Pending' ? `
        <button type="button" class="btn btn-success btn-sm" onclick="LeaveModule.openDecisionModal('${leave.id}', 'approve')">
          ✓ Approve
        </button>
        <button type="button" class="btn btn-danger btn-sm" onclick="LeaveModule.openDecisionModal('${leave.id}', 'reject')">
          ✕ Reject
        </button>
      ` : `
        <span style="font-size: 0.8rem; color: var(--text-muted);">${leave.adminComment || 'Decided'}</span>
      `;

      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--text-primary);">${this.escapeHtml(empName)}</div>
            <div style="font-size: 0.775rem; color: var(--text-muted);">${leave.employeeId} &bull; ${this.escapeHtml(empDept)}</div>
          </td>
          <td><strong>${leave.leaveType}</strong></td>
          <td>${leave.startDate} to ${leave.endDate}</td>
          <td><strong>${leave.daysCount} day(s)</strong></td>
          <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${this.escapeHtml(leave.reason)}">
            ${this.escapeHtml(leave.reason)}
          </td>
          <td>
            <span class="badge ${statusBadge}">
              <span class="badge-dot"></span>
              ${leave.status}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 0.35rem; align-items: center;">
              ${actions}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  openDecisionModal(leaveId, action) {
    this.currentDecisionLeaveId = leaveId;
    const leave = StorageService.getLeaveById(leaveId);
    if (!leave) return;

    const modal = document.getElementById('leaveDecisionModal');
    const title = document.getElementById('decisionModalTitle');
    const commentInput = document.getElementById('decisionComment');
    const submitBtn = document.getElementById('submitDecisionBtn');

    if (commentInput) commentInput.value = '';

    if (action === 'approve') {
      if (title) title.textContent = 'Approve Leave Request';
      if (submitBtn) {
        submitBtn.textContent = 'Confirm Approval';
        submitBtn.className = 'btn btn-success';
        submitBtn.onclick = () => this.handleDecisionSubmit(leaveId, 'approve');
      }
    } else {
      if (title) title.textContent = 'Reject Leave Request';
      if (submitBtn) {
        submitBtn.textContent = 'Confirm Rejection';
        submitBtn.className = 'btn btn-danger';
        submitBtn.onclick = () => this.handleDecisionSubmit(leaveId, 'reject');
      }
    }

    modal?.classList.add('active');
  },

  closeDecisionModal() {
    const modal = document.getElementById('leaveDecisionModal');
    modal?.classList.remove('active');
    this.currentDecisionLeaveId = null;
  },

  handleDecisionSubmit(leaveId, action) {
    const comment = document.getElementById('decisionComment')?.value || '';
    let result;

    if (action === 'approve') {
      result = this.approveLeave(leaveId, comment);
    } else {
      result = this.rejectLeave(leaveId, comment);
    }

    if (result.success) {
      this.closeDecisionModal();
      this.renderAdminLeavesTable();
      if (window.showToast) {
        window.showToast(result.message, action === 'approve' ? 'success' : 'info');
      } else {
        alert(result.message);
      }
    } else {
      if (window.showToast) {
        window.showToast(result.message, 'error');
      } else {
        alert(result.message);
      }
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

window.LeaveModule = LeaveModule;
