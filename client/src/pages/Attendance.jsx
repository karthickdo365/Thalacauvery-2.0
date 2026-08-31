import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useMachine } from '../context/MachineContext';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api';

/*
|--------------------------------------------------------------------------
| API helper
|--------------------------------------------------------------------------
*/

const getToken = () => {
  return (
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('jwt') ||
    ''
  );
};

const apiRequest = async (
  endpoint,
  options = {}
) => {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers,
    }
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Request failed (${response.status})`
    );
  }

  return data;
};

/*
 * Different backends shape list responses
 * differently — raw array, { users: [...] },
 * { records: [...] }, { data: [...] }, etc.
 * This tries the common key names first, then
 * falls back to the first array field found so
 * a mismatched key name doesn't silently render
 * an empty dropdown/calendar.
 */
const extractList = (data, keys = []) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (!data || typeof data !== 'object') {
    return [];
  }

  for (const key of keys) {
    if (Array.isArray(data[key])) {
      return data[key];
    }
  }

  for (const key of Object.keys(data)) {
    if (Array.isArray(data[key])) {
      return data[key];
    }
  }

  if (Object.keys(data).length) {
    console.warn(
      'Attendance: expected an array in the API response but found none. Raw response:',
      data
    );
  }

  return [];
};

/*
|--------------------------------------------------------------------------
| Date helpers
|--------------------------------------------------------------------------
*/

const pad = (value) =>
  String(value).padStart(2, '0');

const normalizeStatus = (value) => {
  const status = String(value || '').trim().toLowerCase();
  if (['absent', 'a', 'leave', 'on_leave'].includes(status)) return 'absent';
  if (['present', 'p', 'working'].includes(status)) return 'present';
  return status;
};

const normalizeAttendanceRecord = (record) => ({
  ...record,
  status: normalizeStatus(record?.status),
});

const toDateKey = (date) => {
  if (!date) return '';

  const d =
    date instanceof Date
      ? date
      : new Date(date);

  if (Number.isNaN(d.getTime())) {
    return '';
  }

  return `${d.getFullYear()}-${pad(
    d.getMonth() + 1
  )}-${pad(d.getDate())}`;
};

const parseDateKey = (key) => {
  if (!key) return null;

  const [year, month, day] =
    key.split('-').map(Number);

  return new Date(
    year,
    month - 1,
    day
  );
};

const getDateRange = (startKey, endKey) => {
  if (!startKey) return [];

  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey || startKey);

  if (!start || !end || end < start) {
    return [];
  }

  const dates = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const monthKey = (date) => {
  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}`;
};

const formatDate = (date) => {
  if (!date) return '';

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }
  ).format(date);
};

const formatDateShort = (date) => {
  if (!date) return '';

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }
  ).format(date);
};

const formatMoney = (value) => {
  return new Intl.NumberFormat(
    'en-IN',
    {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }
  ).format(
    Number(value) || 0
  );
};

/*
|--------------------------------------------------------------------------
| WhatsApp share helpers
|--------------------------------------------------------------------------
*/

const buildAbsenceShareText = ({
  employeeName,
  unitLabel,
  dateLabel,
  reason,
}) => {
  const lines = [
    '*Attendance Update*',
    '',
    `Employee: ${employeeName || '-'}`,
  ];

  if (unitLabel) {
    lines.push(`Unit: ${unitLabel}`);
  }

  lines.push(`Date: ${dateLabel}`);
  lines.push('Status: Absent');
  lines.push(
    `Reason: ${
      reason && reason.trim()
        ? reason.trim()
        : 'Not specified'
    }`
  );

  return lines.join('\n');
};

/*
 * Looks for a phone number under any of the
 * common field names your employee records
 * might use. Falls back to '' (which opens
 * WhatsApp's contact picker instead of a
 * specific chat) if none is found.
 */
const getEmployeePhone = (emp) => {
  if (!emp) return '';

  const raw =
    emp.phone ||
    emp.phoneNumber ||
    emp.mobile ||
    emp.mobileNumber ||
    emp.contact ||
    emp.contactNumber ||
    '';

  return String(raw).replace(
    /[^\d]/g,
    ''
  );
};

const shareOnWhatsApp = (
  text,
  phone
) => {
  const encoded =
    encodeURIComponent(text);

  const base = phone
    ? `https://wa.me/${phone}`
    : 'https://wa.me/';

  window.open(
    `${base}?text=${encoded}`,
    '_blank',
    'noopener,noreferrer'
  );
};

const daysInMonth = (
  year,
  month
) => {
  return new Date(
    year,
    month + 1,
    0
  ).getDate();
};

const firstDayOfMonth = (
  year,
  month
) => {
  return new Date(
    year,
    month,
    1
  ).getDay();
};

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

export default function Attendance() {
  const {
    currentMachine = 'big',
  } = useMachine();

  /*
   * Employees
   */
  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    selectedEmployee,
    setSelectedEmployee,
  ] = useState('');

  /*
   * Current calendar month
   */
  const [
    currentMonth,
    setCurrentMonth,
  ] = useState(
    new Date()
  );

  /*
   * All absence records
   */
  const [
    attendanceRecords,
    setAttendanceRecords,
  ] = useState([]);

  /*
   * Salary advances
   */
  const [
    advances,
    setAdvances,
  ] = useState([]);

  /*
   * Loading
   */
  const [
    loading,
    setLoading,
  ] = useState(false);

  /*
   * Error / success
   */
  const [
    error,
    setError,
  ] = useState('');

  const [
    success,
    setSuccess,
  ] = useState('');

  /*
   * Mark-absent modal (present day -> absent)
   */
  const [
    absentModal,
    setAbsentModal,
  ] = useState(false);

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(null);

  const [
    absentReason,
    setAbsentReason,
  ] = useState('');

  // Optional continuous-leave end date.
  const [
    absentEndDate,
    setAbsentEndDate,
  ] = useState('');

  const [
    showAbsentEndDate,
    setShowAbsentEndDate,
  ] = useState(false);

  const [
    savingAbsent,
    setSavingAbsent,
  ] = useState(false);

  const [
    confirmAbsentModal,
    setConfirmAbsentModal,
  ] = useState(false);

  /*
   * Holds the WhatsApp-ready message for
   * the absence that was just saved, so a
   * "Share via WhatsApp" card can appear
   * without blocking on the save request.
   */
  const [
    shareCard,
    setShareCard,
  ] = useState(null);

  /*
   * Absent-day details popup (absent day -> view / revert)
   */
  const [
    detailsModal,
    setDetailsModal,
  ] = useState(false);

  const [
    detailsDate,
    setDetailsDate,
  ] = useState(null);

  const [
    detailsInfo,
    setDetailsInfo,
  ] = useState(null);

  const [
    revertingAbsent,
    setRevertingAbsent,
  ] = useState(false);

  /*
   * Optimistic overlay applied on top of absentMap so the calendar
   * reflects a save/revert instantly, without needing to fabricate
   * fake flat "attendance records" (the real backend shape is a
   * per-month document with a nested absentDates array, not a flat
   * per-date record — mixing the two caused other real records to
   * be dropped for the brief window before the refetch completed).
   * Cleared once loadAttendance() brings back authoritative data.
   */
  const [
    optimisticAbsent,
    setOptimisticAbsent,
  ] = useState({});

  const [
    optimisticRemoved,
    setOptimisticRemoved,
  ] = useState({});

  /*
   * Advance modal
   */
  const [
    advanceModal,
    setAdvanceModal,
  ] = useState(false);

  const [
    advanceAmount,
    setAdvanceAmount,
  ] = useState('');

  const [
    advanceDate,
    setAdvanceDate,
  ] = useState(
    toDateKey(new Date())
  );

  const [
    advancePaymentMode,
    setAdvancePaymentMode,
  ] = useState('cash');

  const [
    advanceNotes,
    setAdvanceNotes,
  ] = useState('');

  const [
    savingAdvance,
    setSavingAdvance,
  ] = useState(false);

  /*
   * Current employee
   */
  const employee = useMemo(() => {
    return employees.find(
      (item) =>
        String(item._id) ===
        String(selectedEmployee)
    );
  }, [
    employees,
    selectedEmployee,
  ]);

  /*
   |--------------------------------------------------------------------------
   | Load employees
   |--------------------------------------------------------------------------
   */

  const loadEmployees = async () => {
    try {
      /*
       * Adjust this endpoint only if your
       * Personal Information route uses
       * another path.
       */
      const data =
        await apiRequest(
          `/users?machineType=${currentMachine}`
        );

      const allUsers = extractList(data, [
        'users',
        'records',
        'personalUsers',
        'employees',
        'data',
      ]);

      // Attendance & Salary is only for employees.
      // Brokers must not appear in this dropdown.
      // Keep the broker records in the database; only filter them here.
      const list = allUsers.filter((item) => {
        const type = String(
          item?.type ||
          item?.userType ||
          item?.role ||
          ''
        )
          .trim()
          .toLowerCase();

        return type !== 'broker';
      });

      setEmployees(list);

      /*
       * Keep currently selected employee
       */
      if (
        selectedEmployee &&
        list.some(
          (item) =>
            String(item._id) ===
            String(selectedEmployee)
        )
      ) {
        return;
      }

      setSelectedEmployee('');
    } catch (err) {
      console.error(
        'Employee loading error:',
        err
      );

      setError(
        err.message ||
          'Unable to load employees'
      );
    }
  };

  /*
   |--------------------------------------------------------------------------
   | Load attendance
   |--------------------------------------------------------------------------
   */

  const loadAttendance = async () => {
    if (!selectedEmployee) {
      setAttendanceRecords([]);
      return;
    }

    try {
      setLoading(true);

      const data =
        await apiRequest(
          `/attendance?employeeId=${selectedEmployee}&machineType=${currentMachine}&limit=500`
        );

      const records = extractList(data, [
        'records',
        'attendance',
        'data',
        'items',
      ]).map(normalizeAttendanceRecord);

      setAttendanceRecords(records);
    } catch (err) {
      console.error(
        'Attendance loading error:',
        err
      );

      setError(
        err.message ||
          'Unable to load attendance'
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   |--------------------------------------------------------------------------
   | Load salary advances
   |--------------------------------------------------------------------------
   */

  const loadAdvances = async () => {
    if (!selectedEmployee) {
      setAdvances([]);
      return;
    }

    try {
      const data =
        await apiRequest(
          `/salary-advances?employeeId=${selectedEmployee}&machineType=${currentMachine}&limit=500`
        );

      setAdvances(
        extractList(data, [
          'records',
          'advances',
          'data',
        ])
      );
    } catch (err) {
      /*
       * If salary advance endpoint does not
       * exist yet, don't break attendance.
       */
      console.warn(
        'Advance loading:',
        err.message
      );

      setAdvances([]);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [currentMachine]);

  useEffect(() => {
    loadAttendance();
    loadAdvances();
  }, [
    selectedEmployee,
    currentMachine,
  ]);

  useEffect(() => {
    setShareCard(null);
    setOptimisticAbsent({});
    setOptimisticRemoved({});
  }, [selectedEmployee]);

  /*
   |--------------------------------------------------------------------------
   | Build absent date map
   |--------------------------------------------------------------------------
   */

  const absentMap = useMemo(() => {
    const map = {};

    for (const record of attendanceRecords) {
      if (
        normalizeStatus(record?.status) === 'absent' &&
        record?.date
      ) {
        const key =
          toDateKey(record.date);

        if (key) {
          map[key] = {
            id: record._id || null,
            reason:
              record.notes ||
              record.reason ||
              '',
            recordId:
              record._id || null,
          };
        }
      }

      const dates =
        Array.isArray(record?.absentDates)
          ? record.absentDates
          : [];

      for (const item of dates) {
        const key =
          toDateKey(
            item?.date || item
          );

        if (!key) continue;

        map[key] = {
          id: item?._id || null,
          reason:
            item?.reason ||
            item?.notes ||
            '',
          recordId:
            record._id || null,
        };
      }
    }

    /*
     * Apply the optimistic overlay: dates just saved as absent (not
     * yet confirmed by a fresh loadAttendance()) get added, and dates
     * just reverted to present get removed — even if they still show
     * up as absent in the last-fetched attendanceRecords.
     */
    for (const [key, info] of Object.entries(optimisticAbsent)) {
      if (!optimisticRemoved[key]) {
        map[key] = info;
      }
    }

    for (const key of Object.keys(optimisticRemoved)) {
      delete map[key];
    }

    return map;
  }, [attendanceRecords, optimisticAbsent, optimisticRemoved]);

  /*
   |--------------------------------------------------------------------------
   | Salary calculations
   |--------------------------------------------------------------------------
   */

  const salarySummary = useMemo(() => {
    if (!employee) {
      return {
        monthsWorked: 0,
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        grossSalary: 0,
        absentDeduction: 0,
        advance: 0,
        finalSalary: 0,
      };
    }

    const joiningDate =
      employee.date
        ? new Date(employee.date)
        : new Date();

    const today =
      new Date();

    /*
     * If joining date is future,
     * don't calculate negative days.
     */
    const start =
      joiningDate > today
        ? today
        : joiningDate;

    /*
     * Total calendar days from
     * joining date through today.
     */
    const millisecondsPerDay =
      24 *
      60 *
      60 *
      1000;

    const totalDays =
      Math.floor(
        (
          new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
          ) -
          new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate()
          )
        ) /
          millisecondsPerDay
      ) + 1;

    const safeTotalDays =
      Math.max(totalDays, 0);

    /*
     * Months worked.
     */
    const monthsWorked =
      Math.max(
        1,
        (
          (
            today.getFullYear() -
            start.getFullYear()
          ) *
            12
        ) +
          (
            today.getMonth() -
            start.getMonth()
          ) +
          1
      );

    /*
     * Count all unique absent dates
     * between joining date and today.
     */
    const absentDates =
      Object.keys(absentMap)
        .filter((key) => {
          const date =
            parseDateKey(key);

          return (
            date >=
              new Date(
                start.getFullYear(),
                start.getMonth(),
                start.getDate()
              ) &&
            date <= today
          );
        });

    const absentDays =
      absentDates.length;

    const presentDays =
      Math.max(
        safeTotalDays -
          absentDays,
        0
      );

    const monthlySalary =
      Number(
        employee.salary
      ) || 0;

    /*
     * Daily salary uses 30 days.
     *
     * Change 30 to 26 if your business
     * specifically pays based on 26 working
     * days.
     */
    const dailySalary =
      monthlySalary / 30;

    const grossSalary =
      dailySalary *
      safeTotalDays;

    const absentDeduction =
      dailySalary *
      absentDays;

    const totalAdvance =
      advances.reduce(
        (sum, item) =>
          sum +
          (
            Number(
              item.advanceAmount
            ) || 0
          ),
        0
      );

    const finalSalary =
      Math.max(
        grossSalary -
          absentDeduction -
          totalAdvance,
        0
      );

    return {
      monthsWorked,
      totalDays:
        safeTotalDays,
      presentDays,
      absentDays,
      grossSalary,
      absentDeduction,
      advance:
        totalAdvance,
      finalSalary,
    };
  }, [
    employee,
    absentMap,
    advances,
  ]);

  /*
   |--------------------------------------------------------------------------
   | Calendar
   |--------------------------------------------------------------------------
   */

  const calendarDays = useMemo(() => {
    const year =
      currentMonth.getFullYear();

    const month =
      currentMonth.getMonth();

    const total =
      daysInMonth(
        year,
        month
      );

    const first =
      firstDayOfMonth(
        year,
        month
      );

    const cells = [];

    for (
      let i = 0;
      i < first;
      i++
    ) {
      cells.push(null);
    }

    for (
      let day = 1;
      day <= total;
      day++
    ) {
      cells.push(
        new Date(
          year,
          month,
          day
        )
      );
    }

    return cells;
  }, [currentMonth]);

  /*
   |--------------------------------------------------------------------------
   | Calendar navigation
   |--------------------------------------------------------------------------
   */

  const previousMonth = () => {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() - 1,
        1
      )
    );
  };

  const nextMonth = () => {
    const next =
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        1
      );

    setCurrentMonth(next);
  };

  /*
   |--------------------------------------------------------------------------
   | Click calendar date
   |--------------------------------------------------------------------------
   */

  const handleDateClick = (date) => {
    if (!employee || !date) return;

    const key = toDateKey(date);
    const todayKey = toDateKey(new Date());
    const joiningKey = employee.date ? toDateKey(new Date(employee.date)) : null;

    if (joiningKey && key < joiningKey) {
      setError('This date is before the employee joining date.');
      return;
    }

    if (key > todayKey) {
      setError('Future dates cannot be marked absent.');
      return;
    }

    if (absentMap[key]) {
      setDetailsDate(date);
      setDetailsInfo(absentMap[key]);
      setDetailsModal(true);
      return;
    }

    setSelectedDate(date);
    setAbsentReason('');
    setAbsentEndDate('');
    setShowAbsentEndDate(false);
    setAbsentModal(true);
  };

  const saveAbsent = async () => {
    if (!selectedEmployee) {
      setError('Please select an employee.');
      return;
    }

    if (!selectedDate) {
      setError('Valid absence date is required.');
      return;
    }

    const startDateKey = toDateKey(selectedDate);
    const endDateKey = showAbsentEndDate && absentEndDate ? absentEndDate : startDateKey;
    const todayKey = toDateKey(new Date());
    const joiningKey = employee?.date ? toDateKey(new Date(employee.date)) : null;

    if (joiningKey && startDateKey < joiningKey) {
      setError('Absence cannot be before the employee joining date.');
      return;
    }
    if (endDateKey > todayKey) {
      setError('Absence end date cannot be in the future.');
      return;
    }
    if (endDateKey < startDateKey) {
      setError('End date cannot be before the start date.');
      return;
    }

    const dateKeys = getDateRange(startDateKey, endDateKey);
    if (!dateKeys.length) {
      setError('Please select a valid date range.');
      return;
    }

    const candidateDates = dateKeys.filter((dateKey) => !absentMap[dateKey]);
    if (!candidateDates.length) {
      setError('All dates in this range are already marked absent.');
      return;
    }

    try {
      setSavingAbsent(true);
      setError('');

      let savedCount = 0;
      let skippedCount = dateKeys.length - candidateDates.length;
      const newlyAbsent = {};

      for (const dateKey of candidateDates) {
        try {
          /*
           * IMPORTANT: this must hit POST /attendance/absent, which
           * appends a single date to the employee's existing absence
           * list for that month/machine (and 409s if it's a duplicate).
           *
           * The previous version called POST /attendance (the bulk
           * create/replace route) with a { date, status } body that
           * route doesn't read. That route's absentDates defaults to
           * [] whenever it's omitted, so every "mark absent" click was
           * silently overwriting and wiping the whole month's absence
           * history instead of adding to it — and the new date was
           * never actually saved either.
           */
          await apiRequest('/attendance/absent', {
            method: 'POST',
            body: JSON.stringify({
              employeeId: selectedEmployee,
              absenceDate: dateKey,
              machineType: currentMachine,
              reason: absentReason.trim(),
            }),
          });

          newlyAbsent[dateKey] = {
            id: null,
            reason: absentReason.trim(),
            recordId: null,
          };
          savedCount += 1;
        } catch (err) {
          const message = String(err?.message || '');
          if (/duplicate|already exists|attendance already exists|already marked|already absent|conflict/i.test(message)) {
            skippedCount += 1;
            continue;
          }
          throw err;
        }
      }

      if (Object.keys(newlyAbsent).length) {
        setOptimisticAbsent((current) => ({
          ...current,
          ...newlyAbsent,
        }));
      }

      const startDate = parseDateKey(startDateKey);
      const endDate = parseDateKey(endDateKey);
      const rangeMessage = dateKeys.length === 1
        ? `${formatDate(selectedDate)} marked absent.`
        : `${savedCount} day(s) marked absent from ${formatDate(startDate)} to ${formatDate(endDate)}.`;

      setSuccess(skippedCount > 0 ? `${rangeMessage} ${skippedCount} existing day(s) skipped.` : rangeMessage);

      const shareDateLabel = dateKeys.length === 1
        ? formatDate(selectedDate)
        : `${formatDate(startDate)} to ${formatDate(endDate)}`;

      if (savedCount > 0) {
        setShareCard({
          label: shareDateLabel,
          text: buildAbsenceShareText({
            employeeName: employee?.name,
            unitLabel: currentMachine === 'big' ? 'Big Machine' : 'Small Machine',
            dateLabel: shareDateLabel,
            reason: absentReason,
          }),
          phone: getEmployeePhone(employee),
        });
      }

      await loadAttendance();

      // Real data now includes these dates — safe to drop the overlay.
      setOptimisticAbsent((current) => {
        const next = { ...current };
        Object.keys(newlyAbsent).forEach((key) => delete next[key]);
        return next;
      });

      setConfirmAbsentModal(false);
      setAbsentModal(false);
      setSelectedDate(null);
      setAbsentReason('');
      setAbsentEndDate('');
      setShowAbsentEndDate(false);
    } catch (err) {
      console.error('Save absent error:', err);
      setError(err?.message || 'Unable to mark absent.');
    } finally {
      setSavingAbsent(false);
    }
  };

  const removeAbsent = async (key) => {
    if (!selectedEmployee || !key) return;

    const date = parseDateKey(key);
    try {
      setRevertingAbsent(true);
      setError('');

      // Instant feedback: hide the red marker right away, before the
      // request even resolves.
      setOptimisticRemoved((current) => ({
        ...current,
        [key]: true,
      }));

      await apiRequest('/attendance/present', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: selectedEmployee,
          absenceDate: key,
          machineType: currentMachine,
        }),
      });

      setSuccess(`${formatDate(date)} changed to present.`);
      setDetailsModal(false);
      setDetailsDate(null);
      setDetailsInfo(null);
      await loadAttendance();

      // Real data no longer has this date — safe to drop the overlay.
      setOptimisticRemoved((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    } catch (err) {
      // Request failed — undo the optimistic hide so the date goes
      // back to showing as absent.
      setOptimisticRemoved((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      console.error('Remove absent error:', err);
      setError(err?.message || 'Unable to change date to present.');
    } finally {
      setRevertingAbsent(false);
    }
  };

  const saveAdvance = async () => {
    if (!selectedEmployee) {
      setError(
        'Please select an employee.'
      );
      return;
    }

    const amount =
      Number(advanceAmount);

    if (
      !amount ||
      amount <= 0
    ) {
      setError(
        'Enter a valid advance amount.'
      );
      return;
    }

    try {
      setSavingAdvance(true);
      setError('');

      await apiRequest(
        '/salary-advances',
        {
          method: 'POST',
          body: JSON.stringify({
            employeeId:
              selectedEmployee,

            month:
              advanceDate.slice(
                0,
                7
              ),

            machineType:
              currentMachine,

            advanceAmount:
              amount,

            paymentMode:
              advancePaymentMode,

            notes:
              advanceNotes.trim(),

            date:
              advanceDate,
          }),
        }
      );

      setAdvanceModal(false);

      setAdvanceAmount('');
      setAdvancePaymentMode(
        'cash'
      );
      setAdvanceNotes('');
      setAdvanceDate(
        toDateKey(
          new Date()
        )
      );

      setSuccess(
        'Salary advance added successfully.'
      );

      await loadAdvances();
    } catch (err) {
      console.error(
        'Advance error:',
        err
      );

      setError(
        err.message ||
          'Unable to save advance.'
      );
    } finally {
      setSavingAdvance(false);
    }
  };

  /*
   |--------------------------------------------------------------------------
   | Clear notifications
   |--------------------------------------------------------------------------
   */

  useEffect(() => {
    if (
      !error &&
      !success
    ) {
      return;
    }

    const timer =
      setTimeout(() => {
        setError('');
        setSuccess('');
      }, 4000);

    return () =>
      clearTimeout(timer);
  }, [
    error,
    success,
  ]);

  /*
   |--------------------------------------------------------------------------
   | Month absent count / list
   |--------------------------------------------------------------------------
   */

  const monthAbsentDates =
    useMemo(() => {
      const prefix =
        monthKey(
          currentMonth
        );

      return Object.keys(
        absentMap
      )
        .filter(
          (key) =>
            key.startsWith(prefix)
        )
        .sort();
    }, [
      currentMonth,
      absentMap,
    ]);

  /*
   |--------------------------------------------------------------------------
   | UI
   |--------------------------------------------------------------------------
   */

  return (
    <div className="attendance-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .attendance-page {
          min-height: 100%;
          padding: 32px;
          background: #eef2f7;
          color: #16283c;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .attendance-container {
          max-width: 1360px;
          margin: 0 auto;
        }

        /* ---------------- Header ---------------- */

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          gap: 16px;
          flex-wrap: wrap;
        }

        .page-title {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .page-subtitle {
          margin: 6px 0 0;
          color: #64758a;
          font-size: 14px;
        }

        .machine-badge {
          background: #d9f7ef;
          color: #067a63;
          padding: 8px 16px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }

        /* ---------------- Shared card ---------------- */

        .card {
          background: white;
          border: 1px solid #e1e8f0;
          border-radius: 16px;
          box-shadow: 0 1px 2px rgba(16, 35, 56, .04);
        }

        /* ---------------- Employee picker ---------------- */

        .employee-card {
          padding: 20px 24px;
          margin-bottom: 20px;
        }

        .field-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #40536a;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .select-input {
          width: 100%;
          max-width: 480px;
          height: 46px;
          padding: 0 14px;
          border: 1px solid #d3dce6;
          border-radius: 10px;
          background: white;
          font-size: 15px;
          color: #17324d;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }

        .select-input:focus,
        .text-input:focus,
        .textarea:focus {
          border-color: #14b8a6;
          box-shadow: 0 0 0 3px rgba(20, 184, 166, .14);
        }

        .employee-info {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr;
          gap: 20px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #eef2f6;
        }

        .employee-name {
          font-size: 19px;
          font-weight: 800;
        }

        .employee-type {
          margin-top: 3px;
          color: #6c7d92;
          font-size: 13px;
        }

        .info-label {
          color: #8393a5;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .info-value {
          margin-top: 6px;
          font-size: 17px;
          font-weight: 750;
        }

        /* ---------------- Empty state ---------------- */

        .empty-state {
          padding: 64px 32px;
          text-align: center;
        }

        .empty-state-icon {
          font-size: 40px;
          margin-bottom: 12px;
        }

        .empty-state h2 {
          margin: 0 0 6px;
          font-size: 19px;
        }

        .empty-state p {
          margin: 0;
          color: #7a8d9f;
          font-size: 14px;
        }

        /* ---------------- Main layout ---------------- */

        .main-grid {
          display: grid;
          grid-template-columns: 420px 1fr;
          gap: 20px;
          align-items: start;
        }

        .summary-card {
          padding: 22px 24px;
        }

        .section-title {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
        }

        .section-subtitle {
          color: #7b8d9e;
          margin-top: 3px;
          font-size: 13px;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 18px;
        }

        .summary-box {
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid #e6ecf2;
          background: #f8fafc;
        }

        .summary-box.green {
          background: #f1fdf8;
          border-color: #bfeeda;
        }

        .summary-box.red {
          background: #fef4f4;
          border-color: #f6c9c9;
        }

        .summary-label {
          font-size: 12px;
          font-weight: 700;
          color: #6c7e90;
        }

        .summary-value {
          margin-top: 6px;
          font-size: 22px;
          font-weight: 850;
        }

        .summary-box.green .summary-value {
          color: #0a9b68;
        }

        .summary-box.red .summary-value {
          color: #d63b3b;
        }

        .salary-lines {
          margin-top: 20px;
          border-top: 1px solid #eef2f6;
          border-bottom: 1px solid #eef2f6;
          padding: 14px 0;
        }

        .salary-line {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 6px 0;
          font-size: 14px;
          color: #536a7f;
        }

        .salary-line strong {
          color: #152e46;
          font-weight: 750;
        }

        .salary-line.deduction strong {
          color: #d72d2d;
        }

        .salary-final {
          margin-top: 16px;
          padding: 18px 20px;
          border: 1px solid #a3ece0;
          background: #eefdf8;
          border-radius: 14px;
        }

        .salary-final-label {
          color: #10796e;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .salary-final-value {
          margin-top: 6px;
          color: #087d73;
          font-size: 28px;
          font-weight: 900;
        }

        .advance-button {
          width: 100%;
          height: 44px;
          margin-top: 14px;
          border: 0;
          border-radius: 10px;
          background: #16324c;
          color: white;
          font-weight: 750;
          font-size: 14px;
          cursor: pointer;
          transition: background .15s;
        }

        .advance-button:hover {
          background: #1f4463;
        }

        /* ---------------- Advances list ---------------- */

        .advance-section {
          margin-top: 22px;
        }

        .advance-title-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }

        .advance-count {
          color: #75899b;
          font-size: 12px;
          font-weight: 600;
        }

        .advance-list {
          margin-top: 10px;
        }

        .advance-item {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 12px 0;
          border-bottom: 1px solid #eef2f6;
          font-size: 14px;
        }

        .advance-item:last-child {
          border-bottom: 0;
        }

        .advance-date {
          color: #75889a;
          font-size: 12px;
          margin-top: 2px;
        }

        .advance-amount {
          color: #b96a0f;
          font-weight: 800;
          white-space: nowrap;
        }

        .empty-advance {
          padding: 12px 0;
          color: #8495a5;
          font-size: 13px;
        }

        /* ---------------- Calendar ---------------- */

        .calendar-card {
          padding: 22px 24px;
        }

        .calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .calendar-info {
          margin-top: 8px;
          padding: 10px 14px;
          background: #f3f8fb;
          border: 1px solid #e2edf3;
          border-radius: 10px;
          color: #4b6478;
          font-size: 13px;
        }

        .calendar-info strong {
          color: #16283c;
        }

        .month-controls {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .month-name {
          min-width: 140px;
          text-align: center;
          font-size: 16px;
          font-weight: 800;
        }

        .month-button {
          width: 34px;
          height: 34px;
          border: 1px solid #dce5ed;
          background: white;
          border-radius: 9px;
          cursor: pointer;
          font-size: 17px;
          color: #34536d;
          line-height: 1;
        }

        .month-button:hover {
          background: #f1f7fa;
        }

        .calendar-weekdays,
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
        }

        .calendar-weekdays {
          margin-top: 20px;
        }

        .calendar-grid {
          margin-top: 6px;
        }

        .weekday {
          text-align: center;
          color: #8192a2;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          padding-bottom: 4px;
        }

        .calendar-day {
          aspect-ratio: 1;
          border: 1px solid #dceee7;
          background: #f4fbf8;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-weight: 700;
          font-size: 14px;
          color: #12805f;
          transition: transform .12s, box-shadow .12s;
          padding: 0;
        }

        .calendar-day:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(16, 35, 56, .1);
        }

        .calendar-day.empty {
          border: 0;
          background: transparent;
          cursor: default;
        }

        .calendar-day.absent {
          background: #fdeaea;
          border-color: #f3a9a9;
          color: #c62828;
        }

        .calendar-day.today {
          box-shadow: inset 0 0 0 2px #0bb5a5;
        }

        .calendar-day.absent.today {
          box-shadow: inset 0 0 0 2px #c62828;
        }

        .calendar-day.before-joining,
        .calendar-day.future {
          background: #f5f7f9;
          border-color: #edf0f3;
          color: #b6c0ca;
          cursor: not-allowed;
        }

        .calendar-legend {
          display: flex;
          justify-content: center;
          gap: 26px;
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #eef2f6;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 600;
          color: #63788b;
        }

        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 3px;
        }

        .legend-dot.present {
          background: #1abb8f;
        }

        .legend-dot.absent {
          background: #e04747;
        }

        .month-absent {
          margin-top: 14px;
          text-align: center;
          color: #b23a3a;
          font-size: 12px;
          font-weight: 700;
        }

        /* ---------------- Alerts ---------------- */

        .alert {
          position: fixed;
          top: 22px;
          right: 22px;
          z-index: 1000;
          padding: 14px 18px;
          border-radius: 12px;
          color: white;
          font-weight: 650;
          font-size: 14px;
          box-shadow: 0 10px 30px rgba(0,0,0,.18);
          max-width: 380px;
        }

        .alert.error {
          background: #d92f2f;
        }

        .alert.success {
          background: #0f9d75;
        }

        /* ---------------- Share card ---------------- */

        .share-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 14px 18px;
          margin-bottom: 20px;
          background: #e8fbf1;
          border-color: #a8e6cc;
          flex-wrap: wrap;
        }

        .share-card-text {
          font-size: 14px;
          color: #0f3d2c;
        }

        .share-card-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .whatsapp-button {
          height: 38px;
          padding: 0 16px;
          border: 0;
          border-radius: 9px;
          background: #1fb15a;
          color: white;
          font-weight: 750;
          font-size: 13px;
          cursor: pointer;
        }

        .whatsapp-button:hover {
          background: #189a4d;
        }

        /* ---------------- Modals ---------------- */

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(9, 22, 36, .55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 900;
          padding: 20px;
        }

        .modal {
          width: 100%;
          max-width: 480px;
          background: white;
          border-radius: 16px;
          padding: 26px;
          box-shadow: 0 25px 70px rgba(0,0,0,.28);
        }

        .modal.wide {
          max-width: 600px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 18px;
          gap: 12px;
        }

        .modal-title {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
        }

        .modal-date {
          margin-top: 5px;
          color: #657a8e;
          font-size: 13px;
        }

        .close-button {
          width: 32px;
          height: 32px;
          flex-shrink: 0;
          border: 0;
          border-radius: 50%;
          background: #f1f4f7;
          cursor: pointer;
          font-size: 18px;
          color: #52697d;
          line-height: 1;
        }

        .close-button:hover {
          background: #e7ecf1;
        }

        .text-label {
          display: block;
          margin-bottom: 7px;
          font-weight: 700;
          font-size: 13px;
          color: #40536a;
        }

        .textarea,
        .text-input {
          width: 100%;
          border: 1px solid #d3dce6;
          border-radius: 10px;
          padding: 12px 13px;
          font-size: 14px;
          outline: none;
          font-family: inherit;
        }

        .textarea {
          min-height: 110px;
          resize: vertical;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }

        .button {
          height: 42px;
          padding: 0 16px;
          border-radius: 10px;
          border: 1px solid #d7e0e8;
          background: white;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: background .15s;
        }

        .button:hover:not(:disabled) {
          background: #f4f7fa;
        }

        .button.primary {
          border: 0;
          background: #d92f2f;
          color: white;
        }

        .button.primary:hover:not(:disabled) {
          background: #c22626;
        }

        .button.green {
          border: 0;
          background: #0ba784;
          color: white;
        }

        .button.green:hover:not(:disabled) {
          background: #099270;
        }

        .button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .advance-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        /* Absent details popup */

        .details-reason-box {
          padding: 16px;
          border-radius: 12px;
          background: #fdf5f5;
          border: 1px solid #f3caca;
          margin-bottom: 4px;
        }

        .details-reason-label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #b23a3a;
          margin-bottom: 6px;
        }

        .details-reason-text {
          font-size: 14px;
          color: #3c2222;
          line-height: 1.5;
          white-space: pre-wrap;
        }

        .details-reason-empty {
          font-size: 14px;
          color: #9aa7b3;
          font-style: italic;
        }

        .details-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 999px;
          background: #fdeaea;
          color: #c62828;
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 16px;
        }

        /* ---------------- Responsive ---------------- */

        @media (max-width: 1100px) {
          .main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .attendance-page {
            padding: 16px;
          }

          .employee-info {
            grid-template-columns: 1fr;
          }

          .summary-grid {
            grid-template-columns: 1fr 1fr;
          }

          .advance-form-grid {
            grid-template-columns: 1fr;
          }

          .alert {
            left: 16px;
            right: 16px;
            max-width: none;
          }
        }
      `}</style>

      <div className="attendance-container">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">
              Attendance & Salary
            </h1>

            <p className="page-subtitle">
              Mark only absent days —
              every other date is
              automatically present.
            </p>
          </div>

          <div className="machine-badge">
            {currentMachine === 'big'
              ? 'BIG MACHINE'
              : 'SMALL MACHINE'}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="alert error">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="alert success">
            {success}
          </div>
        )}

        {/* Share via WhatsApp */}
        {shareCard && (
          <div className="card share-card">
            <div className="share-card-text">
              <strong>
                {shareCard.label}
              </strong>{' '}
              is ready to share.
            </div>

            <div className="share-card-actions">
              <button
                type="button"
                className="whatsapp-button"
                onClick={() =>
                  shareOnWhatsApp(
                    shareCard.text,
                    shareCard.phone
                  )
                }
              >
                Share via WhatsApp
              </button>

              <button
                type="button"
                className="close-button"
                onClick={() =>
                  setShareCard(null)
                }
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Employee */}
        <div className="card employee-card">

          <label className="field-label">
            Employee
          </label>

          <select
            className="select-input"
            value={
              selectedEmployee
            }
            onChange={(event) => {
              setSelectedEmployee(
                event.target.value
              );
            }}
          >
            <option value="">
              Select Employee
            </option>

            {employees.map(
              (item) => (
                <option
                  key={item._id}
                  value={item._id}
                >
                  {item.name}
                </option>
              )
            )}
          </select>

          {employee && (
            <div className="employee-info">

              <div>
                <div className="employee-name">
                  {employee.name}
                </div>

                <div className="employee-type">
                  {employee.type ||
                    'Employee'}
                </div>
              </div>

              <div>
                <div className="info-label">
                  Joining Date
                </div>

                <div className="info-value">
                  {employee.date
                    ? formatDate(
                        new Date(
                          employee.date
                        )
                      )
                    : '-'}
                </div>
              </div>

              <div>
                <div className="info-label">
                  Monthly Salary
                </div>

                <div className="info-value">
                  {formatMoney(
                    employee.salary
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

        {!employee ? (
          <div className="card empty-state">
            <div className="empty-state-icon">
              📅
            </div>

            <h2>
              Select an employee
            </h2>

            <p>
              Choose an employee above
              to manage attendance,
              salary and advances.
            </p>
          </div>
        ) : (

          <div className="main-grid">

            {/* LEFT */}
            <div>

              <div className="card summary-card">

                <h2 className="section-title">
                  Salary Summary
                </h2>

                <div className="section-subtitle">
                  {employee.name}
                </div>

                <div className="summary-grid">

                  <div className="summary-box">
                    <div className="summary-label">
                      Months Worked
                    </div>

                    <div className="summary-value">
                      {
                        salarySummary.monthsWorked
                      }
                    </div>
                  </div>

                  <div className="summary-box">
                    <div className="summary-label">
                      Total Days
                    </div>

                    <div className="summary-value">
                      {
                        salarySummary.totalDays
                      }
                    </div>
                  </div>

                  <div className="summary-box green">
                    <div className="summary-label">
                      Present
                    </div>

                    <div className="summary-value">
                      {
                        salarySummary.presentDays
                      }
                    </div>
                  </div>

                  <div className="summary-box red">
                    <div className="summary-label">
                      Absent
                    </div>

                    <div className="summary-value">
                      {
                        salarySummary.absentDays
                      }
                    </div>
                  </div>

                </div>

                <div className="salary-lines">

                  <div className="salary-line">
                    <span>
                      Gross Salary
                    </span>

                    <strong>
                      {formatMoney(
                        salarySummary.grossSalary
                      )}
                    </strong>
                  </div>

                  <div className="salary-line deduction">
                    <span>
                      Absent Deduction
                    </span>

                    <strong>
                      -{' '}
                      {formatMoney(
                        salarySummary.absentDeduction
                      )}
                    </strong>
                  </div>

                  <div className="salary-line deduction">
                    <span>
                      Total Advance
                    </span>

                    <strong>
                      -{' '}
                      {formatMoney(
                        salarySummary.advance
                      )}
                    </strong>
                  </div>

                </div>

                <div className="salary-final">

                  <div className="salary-final-label">
                    Final Salary
                  </div>

                  <div className="salary-final-value">
                    {formatMoney(
                      salarySummary.finalSalary
                    )}
                  </div>

                </div>

                <button
                  className="advance-button"
                  onClick={() =>
                    setAdvanceModal(
                      true
                    )
                  }
                >
                  + Add Salary Advance
                </button>

                {/* Advances */}
                <div className="advance-section">

                  <div className="advance-title-row">
                    <h3 className="section-title">
                      Salary Advances
                    </h3>

                    <span className="advance-count">
                      {advances.length}{' '}
                      records
                    </span>
                  </div>

                  <div className="advance-list">

                    {advances.length === 0 ? (
                      <div className="empty-advance">
                        No salary advances
                        recorded.
                      </div>
                    ) : (
                      advances.map(
                        (item) => (
                          <div
                            className="advance-item"
                            key={
                              item._id
                            }
                          >
                            <div>
                              <div>
                                {item.notes ||
                                  item.paymentMode ||
                                  'Salary Advance'}
                              </div>

                              <div className="advance-date">
                                {item.date
                                  ? formatDate(
                                      new Date(
                                        item.date
                                      )
                                    )
                                  : item.month}
                              </div>
                            </div>

                            <div className="advance-amount">
                              -{' '}
                              {formatMoney(
                                item.advanceAmount
                              )}
                            </div>
                          </div>
                        )
                      )
                    )}

                  </div>

                </div>

              </div>

            </div>

            {/* RIGHT */}
            <div>

              <div className="card calendar-card">

                <div className="calendar-header">

                  <div>
                    <h2 className="section-title">
                      Attendance Calendar
                    </h2>

                    <div className="section-subtitle">
                      Click a date to mark or
                      review absence.
                    </div>
                  </div>

                  <div className="month-controls">

                    <button
                      className="month-button"
                      onClick={
                        previousMonth
                      }
                      aria-label="Previous month"
                    >
                      ‹
                    </button>

                    <div className="month-name">
                      {currentMonth.toLocaleDateString(
                        'en-IN',
                        {
                          month:
                            'long',
                          year:
                            'numeric',
                        }
                      )}
                    </div>

                    <button
                      className="month-button"
                      onClick={
                        nextMonth
                      }
                      aria-label="Next month"
                    >
                      ›
                    </button>

                  </div>

                </div>

                <div className="calendar-info">
                  Every date is automatically{' '}
                  <strong>Present</strong>.
                  Click an open date to mark it
                  absent, or click a red date to
                  see why and revert it.
                </div>

                <div className="calendar-weekdays">
                  {[
                    'Sun',
                    'Mon',
                    'Tue',
                    'Wed',
                    'Thu',
                    'Fri',
                    'Sat',
                  ].map(
                    (day) => (
                      <div
                        className="weekday"
                        key={day}
                      >
                        {day}
                      </div>
                    )
                  )}
                </div>

                <div className="calendar-grid">

                  {calendarDays.map(
                    (
                      date,
                      index
                    ) => {

                      if (!date) {
                        return (
                          <div
                            className="calendar-day empty"
                            key={
                              `empty-${index}`
                            }
                          />
                        );
                      }

                      const key =
                        toDateKey(
                          date
                        );

                      const isAbsent =
                        Boolean(
                          absentMap[
                            key
                          ]
                        );

                      const today =
                        toDateKey(
                          new Date()
                        ) === key;

                      const future =
                        key >
                        toDateKey(
                          new Date()
                        );

                      const joining =
                        employee.date
                          ? toDateKey(
                              new Date(
                                employee.date
                              )
                            )
                          : null;

                      const beforeJoining =
                        joining &&
                        key <
                          joining;

                      return (
                        <button
                          key={key}
                          type="button"
                          className={[
                            'calendar-day',
                            isAbsent
                              ? 'absent'
                              : '',
                            today
                              ? 'today'
                              : '',
                            future
                              ? 'future'
                              : '',
                            beforeJoining
                              ? 'before-joining'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(
                              ' '
                            )}
                          disabled={
                            future ||
                            beforeJoining
                          }
                          title={
                            isAbsent
                              ? 'Absent — click for details'
                              : 'Present — click to mark absent'
                          }
                          onClick={() =>
                            handleDateClick(
                              date
                            )
                          }
                        >
                          {date.getDate()}
                        </button>
                      );
                    }
                  )}

                </div>

                <div className="calendar-legend">

                  <div className="legend-item">
                    <span className="legend-dot present" />
                    Present
                  </div>

                  <div className="legend-item">
                    <span className="legend-dot absent" />
                    Absent
                  </div>

                </div>

                <div className="month-absent">
                  {monthAbsentDates.length}{' '}
                  absent day
                  {monthAbsentDates.length !==
                  1
                    ? 's'
                    : ''}{' '}
                  in{' '}
                  {currentMonth.toLocaleDateString(
                    'en-IN',
                    {
                      month:
                        'long',
                    }
                  )}
                </div>

              </div>

            </div>

          </div>
        )}

      </div>

      {/* ============================================================
          MARK ABSENT MODAL (present day -> absent)
          ============================================================ */}

      {absentModal &&
        selectedDate && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setAbsentModal(
                  false
                );
              }
            }}
          >

            <div className="modal">

              <div className="modal-header">

                <div>
                  <h2 className="modal-title">
                    Mark Absent
                  </h2>

                  <div className="modal-date">
                    {showAbsentEndDate && absentEndDate
                      ? `${formatDate(selectedDate)} → ${formatDate(parseDateKey(absentEndDate))}`
                      : formatDate(selectedDate)}
                  </div>
                </div>

                <button
                  className="close-button"
                  onClick={() =>
                    setAbsentModal(
                      false
                    )
                  }
                >
                  ×
                </button>

              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  marginBottom: '12px',
                }}
              >
                <label
                  className="text-label"
                  style={{ marginBottom: 0 }}
                >
                  Leave Period
                </label>

                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    if (showAbsentEndDate) {
                      setShowAbsentEndDate(false);
                      setAbsentEndDate('');
                    } else {
                      setShowAbsentEndDate(true);
                      setAbsentEndDate(
                        toDateKey(selectedDate)
                      );
                    }
                  }}
                  disabled={savingAbsent}
                  style={{
                    padding: '7px 12px',
                    fontSize: '13px',
                  }}
                >
                  {showAbsentEndDate
                    ? 'Remove End Date'
                    : '+ Add End Date'}
                </button>
              </div>

              {showAbsentEndDate && (
                <div style={{ marginBottom: '16px' }}>
                  <label className="text-label">
                    End Date
                  </label>

                  <input
                    type="date"
                    className="text-input"
                    value={absentEndDate}
                    min={toDateKey(selectedDate)}
                    onChange={(event) =>
                      setAbsentEndDate(
                        event.target.value
                      )
                    }
                    disabled={savingAbsent}
                  />

                  <div
                    style={{
                      marginTop: '7px',
                      fontSize: '12px',
                      color: '#64748b',
                    }}
                  >
                    Every date from the start date through the end date will be marked absent.
                  </div>
                </div>
              )}

              <label className="text-label">
                Reason / Description
              </label>

              <textarea
                className="textarea"
                placeholder="Example: Fever, going to native, personal work..."
                value={
                  absentReason
                }
                onChange={(event) =>
                  setAbsentReason(
                    event.target.value
                  )
                }
                autoFocus
              />

              <div className="modal-actions">

                <button
                  className="button"
                  onClick={() => {
                    setConfirmAbsentModal(
                      false
                    );
                    setAbsentModal(
                      false
                    );
                    setSelectedDate(
                      null
                    );
                    setAbsentReason(
                      ''
                    );
                    setAbsentEndDate('');
                    setShowAbsentEndDate(false);
                  }}
                  disabled={
                    savingAbsent
                  }
                >
                  Cancel
                </button>

                <button
                  className="button primary"
                  onClick={() => {
                    if (!selectedDate) return;
                    const startKey = toDateKey(selectedDate);
                    const endKey = showAbsentEndDate && absentEndDate ? absentEndDate : startKey;
                    if (endKey < startKey) {
                      setError('End date cannot be before the start date.');
                      return;
                    }
                    if (endKey > toDateKey(new Date())) {
                      setError('Absence end date cannot be in the future.');
                      return;
                    }
                    setAbsentModal(false);
                    setConfirmAbsentModal(true);
                  }}
                  disabled={
                    savingAbsent
                  }
                >
                  Continue
                </button>

              </div>

            </div>

          </div>
        )}

      {/* ============================================================
          CONFIRM ABSENCE MODAL
          ============================================================ */}

      {confirmAbsentModal &&
        selectedDate && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setConfirmAbsentModal(false);
                setAbsentModal(false);
                setSelectedDate(null);
                setAbsentReason('');
                setAbsentEndDate('');
                setShowAbsentEndDate(false);
              }
            }}
          >
            <div className="modal">
              <div className="modal-header">
                <div>
                  <h2 className="modal-title">
                    Confirm Absent
                  </h2>

                  <div className="modal-date">
                    {showAbsentEndDate &&
                    absentEndDate
                      ? `${formatDate(
                          selectedDate
                        )} → ${formatDate(
                          parseDateKey(
                            absentEndDate
                          )
                        )}`
                      : formatDate(
                          selectedDate
                        )}
                  </div>
                </div>

                <button
                  className="close-button"
                  onClick={() => {
                    setConfirmAbsentModal(false);
                    setAbsentModal(false);
                    setSelectedDate(null);
                    setAbsentReason('');
                    setAbsentEndDate('');
                    setShowAbsentEndDate(false);
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '18px',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    color: '#64748b',
                    fontWeight: 700,
                    marginBottom: '6px',
                  }}
                >
                  ABSENCE DATE
                </div>

                <div
                  style={{
                    fontSize: '16px',
                    color: '#0f2742',
                    fontWeight: 800,
                  }}
                >
                  {showAbsentEndDate &&
                  absentEndDate
                    ? `${formatDate(
                        selectedDate
                      )} to ${formatDate(
                        parseDateKey(
                          absentEndDate
                        )
                      )}`
                    : formatDate(
                        selectedDate
                      )}
                </div>

                <div
                  style={{
                    marginTop: '16px',
                    fontSize: '12px',
                    color: '#64748b',
                    fontWeight: 700,
                    marginBottom: '6px',
                  }}
                >
                  REASON
                </div>

                <div
                  style={{
                    fontSize: '14px',
                    color: absentReason.trim()
                      ? '#1e293b'
                      : '#94a3b8',
                    lineHeight: 1.5,
                  }}
                >
                  {absentReason.trim() ||
                    'No reason provided'}
                </div>
              </div>

              <div
                style={{
                  fontSize: '13px',
                  color: '#64748b',
                  marginBottom: '18px',
                }}
              >
                Confirm these details to mark
                the employee absent.
              </div>

              <div className="modal-actions">
                <button
                  className="button"
                  onClick={() => {
                    setConfirmAbsentModal(false);
                    setAbsentModal(true);
                  }}
                  disabled={savingAbsent}
                >
                  Back
                </button>

                <button
                  className="button primary"
                  onClick={saveAbsent}
                  disabled={savingAbsent}
                >
                  {savingAbsent
                    ? 'Saving...'
                    : 'Confirm & Mark Absent'}
                </button>
              </div>
            </div>
          </div>
        )}

      {detailsModal &&
        detailsDate && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setDetailsModal(
                  false
                );
              }
            }}
          >

            <div className="modal">

              <div className="modal-header">

                <div>
                  <h2 className="modal-title">
                    Absence Details
                  </h2>

                  <div className="modal-date">
                    {formatDateShort(
                      detailsDate
                    )}{' '}
                    · {formatDate(
                      detailsDate
                    )}
                  </div>
                </div>

                <button
                  className="close-button"
                  onClick={() =>
                    setDetailsModal(
                      false
                    )
                  }
                >
                  ×
                </button>

              </div>

              <div className="details-status-pill">
                ● Marked Absent
              </div>

              <div className="details-reason-box">
                <div className="details-reason-label">
                  Reason
                </div>

                {detailsInfo?.reason ? (
                  <div className="details-reason-text">
                    {detailsInfo.reason}
                  </div>
                ) : (
                  <div className="details-reason-empty">
                    No reason was recorded
                    for this date.
                  </div>
                )}
              </div>

              <div className="modal-actions">

                <button
                  className="button"
                  onClick={() => {
                    setDetailsModal(
                      false
                    );
                    setDetailsDate(
                      null
                    );
                    setDetailsInfo(
                      null
                    );
                  }}
                  disabled={
                    revertingAbsent
                  }
                >
                  Close
                </button>

                <button
                  type="button"
                  className="button"
                  onClick={() =>
                    shareOnWhatsApp(
                      buildAbsenceShareText({
                        employeeName:
                          employee?.name,
                        unitLabel:
                          currentMachine ===
                          'big'
                            ? 'Big Machine'
                            : 'Small Machine',
                        dateLabel: formatDate(
                          detailsDate
                        ),
                        reason:
                          detailsInfo?.reason,
                      }),
                      getEmployeePhone(
                        employee
                      )
                    )
                  }
                >
                  Share via WhatsApp
                </button>

                <button
                  className="button green"
                  onClick={() =>
                    removeAbsent(
                      toDateKey(
                        detailsDate
                      )
                    )
                  }
                  disabled={
                    revertingAbsent
                  }
                >
                  {revertingAbsent
                    ? 'Updating...'
                    : 'Mark as Present'}
                </button>

              </div>

            </div>

          </div>
        )}

      {/* ============================================================
          ADVANCE MODAL
          ============================================================ */}

      {advanceModal && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setAdvanceModal(
                false
              );
            }
          }}
        >

          <div className="modal wide">

            <div className="modal-header">

              <div>
                <h2 className="modal-title">
                  Add Salary Advance
                </h2>

                <div className="modal-date">
                  {employee?.name}
                </div>
              </div>

              <button
                className="close-button"
                onClick={() =>
                  setAdvanceModal(
                    false
                  )
                }
              >
                ×
              </button>

            </div>

            <div className="advance-form-grid">

              <div>
                <label className="text-label">
                  Date
                </label>

                <input
                  type="date"
                  className="text-input"
                  value={
                    advanceDate
                  }
                  onChange={(
                    event
                  ) =>
                    setAdvanceDate(
                      event.target
                        .value
                    )
                  }
                />
              </div>

              <div>
                <label className="text-label">
                  Advance Amount
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="text-input"
                  placeholder="₹0.00"
                  value={
                    advanceAmount
                  }
                  onChange={(
                    event
                  ) =>
                    setAdvanceAmount(
                      event.target
                        .value
                    )
                  }
                />
              </div>

              <div>
                <label className="text-label">
                  Payment Mode
                </label>

                <select
                  className="select-input"
                  style={{
                    maxWidth:
                      'none',
                  }}
                  value={
                    advancePaymentMode
                  }
                  onChange={(
                    event
                  ) =>
                    setAdvancePaymentMode(
                      event.target
                        .value
                    )
                  }
                >
                  <option value="cash">
                    Cash
                  </option>

                  <option value="gpay">
                    GPay
                  </option>

                  <option value="net_banking">
                    Net Banking
                  </option>

                  <option value="cheque">
                    Cheque
                  </option>
                </select>
              </div>

              <div>
                <label className="text-label">
                  Notes
                </label>

                <input
                  className="text-input"
                  placeholder="Optional"
                  value={
                    advanceNotes
                  }
                  onChange={(
                    event
                  ) =>
                    setAdvanceNotes(
                      event.target
                        .value
                    )
                  }
                />
              </div>

            </div>

            <div className="modal-actions">

              <button
                className="button"
                onClick={() =>
                  setAdvanceModal(
                    false
                  )
                }
              >
                Cancel
              </button>

              <button
                className="button green"
                onClick={
                  saveAdvance
                }
                disabled={
                  savingAdvance
                }
              >
                {savingAdvance
                  ? 'Saving...'
                  : 'Save Advance'}
              </button>

            </div>

          </div>

        </div>
      )}
    </div>
  );
}