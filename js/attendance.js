/**
 * HCM Lite - Attendance Management Module (js/attendance.js)
 * Implements strict rules-based attendance checking, grace period evaluation,
 * half-day threshold detection, and actual worked hours computation.
 */

const AttendanceModule = {
  evaluateStatus(checkInTimeString, companySettings = null) {
    const company = companySettings || StorageService.getCompany() || {};
    const startTimeStr = company.officeStartTime || '09:00';
    const graceMinutes = (company.gracePeriodMinutes !== undefined && company.gracePeriodMinutes !== '')
      ? parseInt(company.gracePeriodMinutes, 10)
      : 15;
    const halfDayCutoffStr = company.halfDayCutoff || '12:00';

    const checkInMins = this.timeStringToMinutes(checkInTimeString);
    const startMins = this.timeStringToMinutes(startTimeStr);
    const graceCutoffMins = startMins + graceMinutes;
    const halfDayMins = this.timeStringToMinutes(halfDayCutoffStr);

    if (checkInMins <= graceCutoffMins) {
      return 'Present';
    } else if (checkInMins <= halfDayMins) {
      return 'Late';
    } else {
      return 'Half Day';
    }
  },

  timeStringToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return (h * 60) + m;
  },

  getCurrentLocalDate() {
    return StorageService.getLocalDate();
  },

  getCurrentLocalTime() {
    return StorageService.getLocalTime();
  },

  calculateMinutesWorked(startTimeStr, endTimeStr) {
    if (!startTimeStr || !endTimeStr) return 0;
    const startMins = this.timeStringToMinutes(startTimeStr);
    const endMins = this.timeStringToMinutes(endTimeStr);
    const diff = endMins - startMins;
    return diff > 0 ? diff : 0;
  },

  formatMinutesToHours(minutes) {
    if (!minutes || minutes <= 0) return '0h 0m';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  },

  checkIn(employeeId) {
    if (!employeeId) return { success: false, message: 'Invalid employee ID.' };

    const todayDate = this.getCurrentLocalDate();
    const existing = StorageService.getEmployeeAttendanceByDate(employeeId, todayDate);

    if (existing) {
      return {
        success: false,
        message: `You have already checked in today at ${existing.checkInTime}. Duplicate check-ins are not permitted.`
      };
    }

    const checkInTime = this.getCurrentLocalTime();
    const company = StorageService.getCompany();
    const status = this.evaluateStatus(checkInTime, company);

    const record = {
      employeeId,
      date: todayDate,
      checkInTime,
      checkOutTime: null,
      status,
      workedMinutes: 0
    };

    StorageService.saveAttendanceRecord(record);
    return {
      success: true,
      message: `Checked in successfully at ${checkInTime}. Status: ${status}`,
      record
    };
  },

  checkOut(employeeId) {
    if (!employeeId) return { success: false, message: 'Invalid employee ID.' };

    const todayDate = this.getCurrentLocalDate();
    const existing = StorageService.getEmployeeAttendanceByDate(employeeId, todayDate);

    if (!existing) {
      return {
        success: false,
        message: 'No check-in record found for today. You must check in before checking out.'
      };
    }

    if (existing.checkOutTime) {
      return {
        success: false,
        message: `You have already checked out today at ${existing.checkOutTime}. Multiple check-outs are not permitted.`
      };
    }

    const checkOutTime = this.getCurrentLocalTime();
    const workedMinutes = this.calculateMinutesWorked(existing.checkInTime, checkOutTime);

    let finalStatus = existing.status;
    if (workedMinutes < 240 && finalStatus === 'Present') {
      finalStatus = 'Half Day';
    }

    const updated = {
      ...existing,
      checkOutTime,
      workedMinutes,
      status: finalStatus
    };

    StorageService.saveAttendanceRecord(updated);
    return {
      success: true,
      message: `Checked out successfully at ${checkOutTime}. Total worked: ${this.formatMinutesToHours(workedMinutes)}`,
      record: updated
    };
  },

  getSummaryForDate(dateStr = null) {
    const targetDate = dateStr || this.getCurrentLocalDate();
    const logs = StorageService.getTodayAttendance(targetDate);

    const present = logs.filter(l => l.status === 'Present').length;
    const late = logs.filter(l => l.status === 'Late').length;
    const halfDay = logs.filter(l => l.status === 'Half Day').length;

    return {
      totalLogs: logs.length,
      present,
      late,
      halfDay,
      records: logs
    };
  }
};

window.AttendanceModule = AttendanceModule;
