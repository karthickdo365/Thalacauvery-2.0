import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useMachine } from '../context/MachineContext';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

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

const getEmployeeEndDateKey = (employee) => {
  if (!employee) return '';

  const raw =
    employee.endDate ||
    employee.terminationDate ||
    employee.lastWorkingDate ||
    employee.exitDate ||
    employee.terminatedOn ||
    '';

  return raw ? toDateKey(new Date(raw)) : '';
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

// Salary-advance APIs can return the transaction date under different
// field names depending on the backend/model version. Normalize them in
// one place so the UI does not randomly fall back to the month.
const getAdvanceDateValue = (item) => {
  if (!item) return null;

  return (
    item.date ||
    item.advanceDate ||
    item.paymentDate ||
    item.transactionDate ||
    item.createdAt ||
    null
  );
};

const formatAdvanceDate = (item) => {
  const rawDate = getAdvanceDateValue(item);

  if (rawDate) {
    const parsed = new Date(rawDate);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDate(parsed);
    }
  }

  // Older records may only have a month. Keep the fallback readable.
  if (item?.month) {
    const parsedMonth = new Date(`${item.month}-01T00:00:00`);
    if (!Number.isNaN(parsedMonth.getTime())) {
      return formatDate(parsedMonth);
    }
    return item.month;
  }

  return 'Date not available';
};


/*
|--------------------------------------------------------------------------
| All-employee salary summary helper
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Date-range salary report helper
|--------------------------------------------------------------------------
*/
const calculateEmployeeRangeSalary = (
  employee,
  attendanceRecords = [],
  advances = [],
  startKey,
  endKey
) => {
  const todayKey = toDateKey(new Date());
  const requestedStart = startKey || todayKey;
  const requestedEnd = endKey || todayKey;

  if (!requestedStart || !requestedEnd || requestedEnd < requestedStart) {
    return { totalDays: 0, presentDays: 0, absentDays: 0, grossSalary: 0, absentDeduction: 0, totalAdvance: 0, finalSalary: 0 };
  }

  const joiningKey = employee?.date ? toDateKey(new Date(employee.date)) : requestedStart;
  const employeeEndKey = getEmployeeEndDateKey(employee);
  const effectiveStart = joiningKey && joiningKey > requestedStart ? joiningKey : requestedStart;

  let effectiveEnd = requestedEnd > todayKey ? todayKey : requestedEnd;
  if (employeeEndKey && employeeEndKey < effectiveEnd) {
    effectiveEnd = employeeEndKey;
  }

  if (effectiveEnd < effectiveStart) {
    return { totalDays: 0, presentDays: 0, absentDays: 0, grossSalary: 0, absentDeduction: 0, totalAdvance: 0, finalSalary: 0 };
  }

  const rangeDates = getDateRange(effectiveStart, effectiveEnd);
  const rangeSet = new Set(rangeDates);
  const absentKeys = new Set();

  for (const record of attendanceRecords) {
    if (normalizeStatus(record?.status) === 'absent') {
      const rawDate = record?.date || record?.attendanceDate || record?.absenceDate;
      const key = rawDate ? toDateKey(rawDate) : '';
      if (key && rangeSet.has(key)) absentKeys.add(key);
    }

    if (Array.isArray(record?.absentDates)) {
      for (const item of record.absentDates) {
        const key = toDateKey(item?.date || item);
        if (key && rangeSet.has(key)) absentKeys.add(key);
      }
    }
  }

  const totalDays = rangeDates.length;
  const absentDays = absentKeys.size;
  const presentDays = Math.max(totalDays - absentDays, 0);
  const monthlySalary = Number(employee?.salary) || 0;
  const dailySalary = monthlySalary / 30;
  const grossSalary = dailySalary * totalDays;
  const absentDeduction = dailySalary * absentDays;

  const totalAdvance = advances.reduce((sum, item) => {
    const rawDate = getAdvanceDateValue(item);
    const advanceKey = rawDate
      ? toDateKey(new Date(rawDate))
      : item?.month ? `${item.month}-01` : '';

    if (advanceKey && advanceKey >= effectiveStart && advanceKey <= effectiveEnd) {
      return sum + (Number(item?.advanceAmount) || 0);
    }
    return sum;
  }, 0);

  const salaryBeforeAdvance = Math.max(grossSalary - absentDeduction, 0);
  const finalSalary = salaryBeforeAdvance - totalAdvance;

  return {
    totalDays,
    presentDays,
    absentDays,
    grossSalary,
    absentDeduction,
    totalAdvance,
    finalSalary,
    startDate: effectiveStart,
    endDate: effectiveEnd,
  };
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

  // Personal Information may store the employee's number under
  // any of these common field names. No separate number entry is
  // needed on the Salary Bill.
  const raw =
    emp.phone ||
    emp.phoneNumber ||
    emp.mobile ||
    emp.mobileNumber ||
    emp.whatsapp ||
    emp.whatsappNumber ||
    emp.contact ||
    emp.contactNumber ||
    '';

  return String(raw).replace(/[^\d]/g, '');
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

  const [employeeEndDate, setEmployeeEndDate] = useState('');
  const [savingEmployeeEndDate, setSavingEmployeeEndDate] = useState(false);

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

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    confirmAbsentModal,
    setConfirmAbsentModal,
  ] = useState(false);

  const [advances, setAdvances] = useState([]);
  const [advanceModal, setAdvanceModal] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState(toDateKey(new Date()));
  const [advancePaymentMode, setAdvancePaymentMode] = useState('cash');
  const [advanceNotes, setAdvanceNotes] = useState('');
  const [savingAdvance, setSavingAdvance] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState(null);
  const [deleteAdvanceDialog, setDeleteAdvanceDialog] = useState(null);
  const [deletingAdvance, setDeletingAdvance] = useState(false);

  const [reportStartDate, setReportStartDate] = useState(() => {
    const now = new Date();
    return toDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [reportEndDate, setReportEndDate] = useState(() => toDateKey(new Date()));

  const [
    error,
    setError,
  ] = useState('');

  const [
    success,
    setSuccess,
  ] = useState('');

  const [
    optimisticAbsent,
    setOptimisticAbsent,
  ] = useState({});

  const [
    optimisticRemoved,
    setOptimisticRemoved,
  ] = useState({});

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(null);

  const [
    absentReason,
    setAbsentReason,
  ] = useState('');

  const [
    absentEndDate,
    setAbsentEndDate,
  ] = useState('');

  const [
    showAbsentEndDate,
    setShowAbsentEndDate,
  ] = useState(false);

  const [
    absentModal,
    setAbsentModal,
  ] = useState(false);

  const [
    savingAbsent,
    setSavingAbsent,
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
    detailsModal,
    setDetailsModal,
  ] = useState(false);

  const [
    revertingAbsent,
    setRevertingAbsent,
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

        return type !== 'broker' && type !== 'partner';
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


  const loadAdvances = async () => {
    if (!selectedEmployee) {
      setAdvances([]);
      return;
    }
    try {
      const data = await apiRequest(
        `/salary-advances?employeeId=${selectedEmployee}&machineType=${currentMachine}&limit=500`
      );
      setAdvances(extractList(data, ['records', 'advances', 'data', 'items']));
    } catch (err) {
      console.warn('Advance loading:', err?.message || err);
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
    setOptimisticAbsent({});
    setOptimisticRemoved({});
  }, [selectedEmployee]);

  useEffect(() => {
    setEmployeeEndDate(getEmployeeEndDateKey(employee));
  }, [employee]);

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
        endDate: '',
      };
    }

    const todayKey = toDateKey(new Date());
    const joiningKey = employee.date
      ? toDateKey(new Date(employee.date))
      : todayKey;

    const employeeEndKey = getEmployeeEndDateKey(employee);

    let endKey = todayKey;
    if (employeeEndKey && employeeEndKey < endKey) {
      endKey = employeeEndKey;
    }

    const startKey =
      joiningKey && joiningKey > todayKey
        ? todayKey
        : joiningKey || todayKey;

    if (endKey < startKey) {
      return {
        monthsWorked: 0,
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        grossSalary: 0,
        absentDeduction: 0,
        advance: 0,
        finalSalary: 0,
        endDate: employeeEndKey || '',
      };
    }

    const rangeDates = getDateRange(startKey, endKey);
    const rangeSet = new Set(rangeDates);

    const absentDates = Object.keys(absentMap).filter((key) =>
      rangeSet.has(key)
    );

    const totalDays = rangeDates.length;
    const absentDays = absentDates.length;
    const presentDays = Math.max(totalDays - absentDays, 0);

    const monthlySalary = Number(employee.salary) || 0;
    const dailySalary = monthlySalary / 30;
    const grossSalary = dailySalary * totalDays;
    const absentDeduction = dailySalary * absentDays;

    const totalAdvance = advances.reduce(
      (sum, item) => {
        const rawDate = getAdvanceDateValue(item);
        const advanceKey = rawDate
          ? toDateKey(new Date(rawDate))
          : item?.month
            ? `${item.month}-01`
            : '';

        if (
          advanceKey &&
          advanceKey >= startKey &&
          advanceKey <= endKey
        ) {
          return sum + (Number(item?.advanceAmount) || 0);
        }

        return sum;
      },
      0
    );

    const salaryBeforeAdvance = Math.max(
      grossSalary - absentDeduction,
      0
    );

    const finalSalary =
      salaryBeforeAdvance - totalAdvance;

    const startDate = parseDateKey(startKey);
    const endDate = parseDateKey(endKey);

    const monthsWorked = Math.max(
      1,
      (
        (endDate.getFullYear() - startDate.getFullYear()) * 12
      ) +
        (endDate.getMonth() - startDate.getMonth()) +
        1
    );

    return {
      monthsWorked,
      totalDays,
      presentDays,
      absentDays,
      grossSalary,
      absentDeduction,
      advance: totalAdvance,
      finalSalary,
      endDate: employeeEndKey || '',
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



  const saveEmployeeEndDate = async () => {
    if (!employee?._id) {
      setError('Please select an employee.');
      return;
    }

    const joiningKey = employee.date
      ? toDateKey(new Date(employee.date))
      : '';

    if (employeeEndDate && joiningKey && employeeEndDate < joiningKey) {
      setError('End date cannot be before the employee joining date.');
      return;
    }

    const todayKey = toDateKey(new Date());

    if (employeeEndDate && employeeEndDate > todayKey) {
      setError('End date cannot be in the future.');
      return;
    }

    try {
      setSavingEmployeeEndDate(true);
      setError('');

      await apiRequest(`/users/${employee._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          // The users API uses machine separation on updates.
          // Send the current machine together with the end date.
          machineType: currentMachine,
          endDate: employeeEndDate || null,
        }),
      });

      setEmployees((current) =>
        current.map((item) =>
          String(item?._id) === String(employee._id)
            ? {
                ...item,
                endDate: employeeEndDate || null,
              }
            : item
        )
      );

      setSuccess(
        employeeEndDate
          ? `End date saved for ${employee.name}. Employee is treated as terminated from ${formatDate(parseDateKey(employeeEndDate))}.`
          : `End date removed for ${employee.name}.`
      );
    } catch (err) {
      console.error('Employee end date save error:', err);
      setError(
        err?.message ||
          'Unable to save employee end date. Make sure the Users update API accepts endDate.'
      );
    } finally {
      setSavingEmployeeEndDate(false);
    }
  };

  const openAddAdvance = () => {
    setEditingAdvance(null);
    setAdvanceAmount('');
    setAdvancePaymentMode('cash');
    setAdvanceNotes('');
    setAdvanceDate(toDateKey(new Date()));
    setError('');
    setAdvanceModal(true);
  };

  const openEditAdvance = (item) => {
    setEditingAdvance(item);
    setAdvanceAmount(String(item?.advanceAmount ?? ''));
    const rawAdvanceDate = getAdvanceDateValue(item);
    setAdvanceDate(
      rawAdvanceDate && !Number.isNaN(new Date(rawAdvanceDate).getTime())
        ? toDateKey(new Date(rawAdvanceDate))
        : item?.month
          ? `${item.month}-01`
          : toDateKey(new Date())
    );
    setAdvancePaymentMode(item?.paymentMode || 'cash');
    setAdvanceNotes(item?.notes || '');
    setError('');
    setAdvanceModal(true);
  };

  const closeAdvanceModal = () => {
    if (savingAdvance) return;
    setAdvanceModal(false);
    setEditingAdvance(null);
    setAdvanceAmount('');
    setAdvancePaymentMode('cash');
    setAdvanceNotes('');
    setAdvanceDate(toDateKey(new Date()));
  };

  const saveAdvance = async () => {
    if (!selectedEmployee) {
      setError('Please select an employee.');
      return;
    }

    const amount = Number(advanceAmount);
    if (!amount || amount <= 0) {
      setError('Enter a valid advance amount.');
      return;
    }

    if (!advanceDate) {
      setError('Select an advance date.');
      return;
    }

    try {
      setSavingAdvance(true);
      setError('');

      const payload = {
        employeeId: selectedEmployee,
        month: advanceDate.slice(0, 7),
        machineType: currentMachine,
        advanceAmount: amount,
        paymentMode: advancePaymentMode,
        notes: advanceNotes.trim(),
        date: advanceDate,
      };

      if (editingAdvance?._id) {
        await apiRequest(
          `/salary-advances/${editingAdvance._id}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        setSuccess('Salary advance updated successfully.');
      } else {
        await apiRequest('/salary-advances', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccess('Salary advance added successfully.');
      }

      closeAdvanceModal();
      await loadAdvances();
    } catch (err) {
      console.error('Advance save error:', err);
      setError(
        err?.message ||
          (editingAdvance
            ? 'Unable to update salary advance.'
            : 'Unable to save salary advance.')
      );
    } finally {
      setSavingAdvance(false);
    }
  };

  const confirmDeleteAdvance = async () => {
    if (!deleteAdvanceDialog?._id) return;

    try {
      setDeletingAdvance(true);
      setError('');

      await apiRequest(
        `/salary-advances/${deleteAdvanceDialog._id}`,
        {
          method: 'DELETE',
        }
      );

      setDeleteAdvanceDialog(null);
      setSuccess('Salary advance deleted successfully.');
      await loadAdvances();
    } catch (err) {
      console.error('Advance delete error:', err);
      setError(
        err?.message ||
          'Unable to delete salary advance.'
      );
    } finally {
      setDeletingAdvance(false);
    }
  };

  
  /*
   |--------------------------------------------------------------------------
   | Individual salary WhatsApp bill
   |--------------------------------------------------------------------------
   */
  const individualSalary = useMemo(() => {
    if (!employee) return null;

    return calculateEmployeeRangeSalary(
      employee,
      attendanceRecords,
      advances,
      reportStartDate,
      reportEndDate
    );
  }, [
    employee,
    attendanceRecords,
    advances,
    reportStartDate,
    reportEndDate,
  ]);

  const reportPeriodValid =
    Boolean(reportStartDate) &&
    Boolean(reportEndDate) &&
    reportEndDate >= reportStartDate;

  const setQuickReportRange = (type) => {
    const now = new Date();
    const today = toDateKey(now);
    const monthsBack = {
      month: 0,
      '2months': 1,
      '6months': 5,
      year: 11,
    };

    if (monthsBack[type] !== undefined) {
      setReportStartDate(
        toDateKey(
          new Date(
            now.getFullYear(),
            now.getMonth() - monthsBack[type],
            1
          )
        )
      );
      setReportEndDate(today);
    }
  };

  const shareSalaryBillOnWhatsApp = () => {
    if (!employee) {
      setError('Please select an employee first.');
      return;
    }

    if (!reportPeriodValid) {
      setError('Please select a valid From Date and To Date.');
      return;
    }

    if (!individualSalary) {
      setError('Salary details are not available.');
      return;
    }

    const phone = getEmployeePhone(employee);

    if (!phone) {
      setError(
        'WhatsApp/mobile number is not available in Personal Information for this employee.'
      );
      return;
    }

    let whatsappNumber = phone;

    // Indian numbers: automatically add country code when the
    // Personal Information record contains only the 10-digit number.
    if (phone.length === 10) {
      whatsappNumber = `91${phone}`;
    } else if (phone.length === 12 && phone.startsWith('91')) {
      whatsappNumber = phone;
    } else {
      setError('The employee WhatsApp/mobile number is not a valid Indian number.');
      return;
    }

    const startDate = parseDateKey(
      individualSalary.startDate || reportStartDate
    );
    const endDate = parseDateKey(
      individualSalary.endDate || reportEndDate
    );

    const periodLabel =
      reportStartDate === reportEndDate
        ? formatDate(startDate)
        : `${formatDate(startDate)} to ${formatDate(endDate)}`;

    const message = [
      '*Salary Bill*',
      '',
      `Name : ${employee?.name || '-'}`,
      `Joining Date: ${
        employee?.date
          ? formatDate(new Date(employee.date))
          : '-'
      }`,
      `Date : ${periodLabel}`,
      `Total Days: ${individualSalary.totalDays || 0}`,
      `Present Days: ${individualSalary.presentDays || 0}`,
      `Absent Days: ${individualSalary.absentDays || 0}`,
      `Monthly Salary: ${formatMoney(Number(employee?.salary) || 0)}`,
      `Advance: ${formatMoney(individualSalary.totalAdvance || 0)}`,
      `Remaining: ${formatMoney(individualSalary.finalSalary || 0)}`,
    ].join('\n');

    shareOnWhatsApp(message, whatsappNumber);

    setSuccess(
      `Salary bill opened in WhatsApp for ${employee?.name || 'employee'}.`
    );
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

        .salary-final-value.negative {
          color: #d72d2d;
        }

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

        .button.danger {
          border: 0;
          background: #d92f2f;
          color: white;
        }

        .button.danger:hover:not(:disabled) {
          background: #c22626;
        }

        .button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }



        .advance-button {
          width: 100%; height: 44px; margin-top: 14px; border: 0;
          border-radius: 10px; background: #16324c; color: white;
          font-weight: 750; font-size: 14px; cursor: pointer;
        }
        .advance-button:hover { background: #1f4463; }
        .advance-section { margin-top: 22px; }
        .advance-title-row { display: flex; justify-content: space-between; align-items: center; min-height: 32px; }
        .advance-count { min-width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: #f1f5f9; color: #64748b; font-size: 12px; font-weight: 800; }
        .advance-list { margin-top: 8px; }
        .advance-item { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; column-gap: 18px; min-height: 68px; padding: 10px 0; border-bottom: 1px solid #eef2f6; font-size: 14px; }
        .advance-item:last-child { border-bottom: 0; }
        .advance-item-main { min-width: 0; }
        .advance-note { color: #243b53; font-size: 14px; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .advance-date { color: #8798a8; font-size: 12px; margin-top: 4px; line-height: 1.2; }
        .advance-item-right { display: contents; }
        .advance-amount { color: #b96a0f; font-weight: 850; white-space: nowrap; text-align: right; min-width: 108px; }
        .advance-actions { display: flex; align-items: center; justify-content: center; gap: 7px; min-width: 76px; }
        .advance-action-button { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; border-radius: 8px; padding: 0; transition: background .15s ease, border-color .15s ease, transform .15s ease; }
        .advance-action-button:hover:not(:disabled) { transform: translateY(-1px); }
        .advance-action-button svg { width: 16px; height: 16px; }
        .advance-edit-button { color: #2563eb; }
        .advance-edit-button:hover:not(:disabled) { background: #eff6ff; border-color: #bfdbfe; }
        .advance-delete-button { color: #dc2626; }
        .advance-delete-button:hover:not(:disabled) { background: #fef2f2; border-color: #fecaca; }
        .advance-action-button:disabled { opacity: .5; cursor: not-allowed; }
        .delete-advance-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 14px; }
        .delete-advance-label { color: #64748b; font-size: 11px; font-weight: 800; letter-spacing: .05em; margin-bottom: 5px; }
        .delete-advance-amount { color: #b91c1c; font-size: 25px; font-weight: 900; }
        .delete-advance-meta { color: #64748b; font-size: 12px; margin-top: 4px; }
        .delete-advance-notes { color: #334155; font-size: 13px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
        .modal-warning { background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; border-radius: 10px; padding: 12px 14px; font-size: 13px; line-height: 1.5; margin-bottom: 18px; }
        .empty-advance { padding: 12px 0; color: #8495a5; font-size: 13px; }
        .advance-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

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

        /* ---------------- Individual WhatsApp salary bill ---------------- */

        .report-card {
          margin-bottom: 20px;
          padding: 22px 24px;
        }

        .report-under-title {
  margin-top: 4px;
  margin-bottom: 3px;
  font-size: 15px;
  line-height: 1.3;
  font-weight: 700;
  color: #0f766e;
}

.report-header {
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:16px;
          flex-wrap:wrap;
        }

        .report-controls {
          display:grid;
          grid-template-columns:1.3fr 1fr 1fr;
          gap:14px;
          margin-top:18px;
        }

        .report-field {
          min-width:0;
        }

        .report-quick-buttons {
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin-top:14px;
        }

        .report-quick-button {
          border:1px solid #d7e0e8;
          background:#fff;
          color:#35536d;
          border-radius:9px;
          padding:8px 12px;
          font-size:12px;
          font-weight:750;
          cursor:pointer;
        }

        .report-quick-button:hover {
          background:#f4f8fa;
        }

        .individual-bill-preview {
          margin-top:20px;
          padding:20px;
          border:1px solid #e4ebf1;
          border-radius:14px;
          background:#fbfdfd;
        }

        .individual-bill-heading {
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:14px;
          padding-bottom:16px;
          border-bottom:1px solid #e8eef2;
        }

        .individual-bill-heading h3 {
          margin:0;
          color:#17324d;
          font-size:20px;
          font-weight:850;
        }

        .individual-bill-heading div {
          margin-top:5px;
          color:#718397;
          font-size:13px;
        }

        .individual-bill-machine {
          margin-top:0 !important;
          padding:7px 11px;
          border-radius:999px;
          background:#eef8f5;
          color:#087d73 !important;
          font-size:11px !important;
          font-weight:800;
          white-space:nowrap;
        }

        .individual-summary-grid {
          display:grid;
          grid-template-columns:repeat(4, 1fr);
          gap:10px;
          margin-top:16px;
        }

        .individual-summary-box {
          padding:13px 14px;
          background:#f7fafc;
          border:1px solid #e5ebf1;
          border-radius:11px;
        }

        .individual-summary-box span {
          display:block;
          color:#718397;
          font-size:11px;
          font-weight:800;
          text-transform:uppercase;
        }

        .individual-summary-box strong {
          display:block;
          margin-top:5px;
          color:#17324d;
          font-size:19px;
          font-weight:850;
        }

        .individual-summary-box.absent strong {
          color:#d63b3b;
        }

        .individual-summary-box.final {
          background:#eefdf8;
          border-color:#b9e9df;
        }

        .individual-summary-box.final strong {
          color:#087d73;
        }

        .individual-salary-lines {
          margin-top:16px;
          padding:14px 0;
          border-top:1px solid #e8eef2;
          border-bottom:1px solid #e8eef2;
        }

        .individual-salary-lines > div {
          display:flex;
          justify-content:space-between;
          gap:20px;
          padding:7px 0;
          color:#536a7f;
          font-size:14px;
        }

        .individual-salary-lines strong {
          color:#17324d;
        }

        .negative-value {
          color:#d63b3b !important;
        }

        .salary-whatsapp-number-field {
          grid-column: 1 / -1;
        }

        .saved-whatsapp-number {
          min-height: 46px;
          display: flex;
          align-items: center;
          padding: 0 14px;
          border: 1px solid #d3dce6;
          border-radius: 10px;
          background: #f8fafc;
          color: #17324d;
          font-size: 15px;
          font-weight: 700;
        }

        .salary-whatsapp-action {
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid #e8eef2;
        }

        .salary-whatsapp-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 16px;
          font-weight: 800;
        }

        .salary-whatsapp-button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .whatsapp-button {
          background:#18a957 !important;
          color:white !important;
          border-color:#18a957 !important;
        }

        .whatsapp-button:hover {
          background:#128c47 !important;
        }

        .whatsapp-note {
          margin-top:10px;
          color:#7a8d9f;
          font-size:12px;
        }

        .individual-bill-empty {
          margin-top:18px;
          padding:18px;
          border:1px dashed #d8e2ea;
          border-radius:12px;
          text-align:center;
          color:#7b8d9e;
          font-size:13px;
        }

        /* ---------------- Whole employee report ---------------- */
        .partner-report-preview { margin-top:20px; padding:20px; border:1px solid #e4ebf1; border-radius:14px; background:#fbfdfd; }
        .partner-report-title-row { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; padding-bottom:16px; border-bottom:1px solid #e8eef2; }
        .partner-report-title-row h3 { margin:0; font-size:24px; font-weight:850; color:#17324d; }
        .partner-report-title-row div { margin-top:5px; color:#718397; font-size:13px; }
        .report-summary-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:16px; }
        .report-summary-box { padding:13px 14px; border:1px solid #dce4ea; background:#fff; }
        .report-summary-label { color:#718397; font-size:11px; font-weight:700; }
        .report-summary-value { margin-top:5px; color:#17324d; font-size:19px; font-weight:850; }
        .report-table-wrap { margin-top:18px; overflow-x:auto; }
        .report-table { width:100%; border-collapse:collapse; min-width:980px; background:#fff; }
        .report-table th,.report-table td { border:1px solid #bfc5ca; padding:9px 10px; text-align:left; font-size:12px; white-space:nowrap; }
        .report-table th { background:#f7f8f9; color:#17202a; font-weight:800; }
        .report-total-row td { font-weight:800; background:#fafafa; }
        .print-report { display:none; }
        @media print {
          body * { visibility:hidden !important; }
          .print-report,.print-report * { visibility:visible !important; }
          .print-report { display:block !important; position:absolute; left:0; top:0; width:100%; padding:22px 30px; background:#fff; color:#111; font-family:Arial,Helvetica,sans-serif; }
          .print-report-title { margin:0 0 8px; font-size:28px; font-weight:800; }
          .report-print-period { margin-bottom:20px; font-size:14px; }
          .print-summary { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:20px; }
          .print-summary-box { border:1px solid #bfc5ca; padding:10px; }
          .print-summary-label { font-size:11px; }
          .print-summary-value { margin-top:4px; font-size:17px; font-weight:800; }
          .print-report table { width:100%; border-collapse:collapse; font-size:10px; }
          .print-report th,.print-report td { border:1px solid #aaa; padding:7px 6px; text-align:left; white-space:nowrap; }
          .print-report th,.print-total td { font-weight:800; }
          @page { size:landscape; margin:10mm; }
        }

        .selected-report-person {
          min-height:46px;
          display:flex;
          align-items:center;
          padding:0 14px;
          border:1px solid #d3dce6;
          border-radius:10px;
          background:#f8fafc;
          color:#17324d;
          font-size:15px;
          font-weight:700;
        }


        .salary-action-row {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 16px;
        }

        .compact-attendance {
          display: flex;
          gap: 8px;
          flex: 1 1 180px;
        }

        .compact-attendance-item {
          min-width: 72px;
          padding: 8px 11px;
          border: 1px solid #e6edf2;
          border-radius: 10px;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .compact-attendance-item span {
          font-size: 11px;
          font-weight: 700;
          color: #718397;
        }

        .compact-attendance-item strong {
          font-size: 15px;
        }

        .compact-attendance-item.present strong {
          color: #0a9b68;
        }

        .compact-attendance-item.absent strong {
          color: #d63b3b;
        }

        .end-date-control {
          display: flex;
          align-items: flex-end;
          gap: 6px;
        }

        .end-date-control label {
          position: absolute;
          margin-bottom: 34px;
          font-size: 10px;
          font-weight: 800;
          color: #718397;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .compact-date-input {
          width: 145px;
          min-width: 145px;
          height: 40px;
        }

        .end-date-save-button,
        .advance-icon-button {
          width: 40px;
          height: 40px;
          border: 0;
          border-radius: 10px;
          cursor: pointer;
          font-size: 20px;
          font-weight: 800;
        }

        .end-date-save-button {
          background: #e8f8f3;
          color: #087d73;
        }

        .end-date-save-button:disabled,
        .advance-icon-button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .advance-icon-button {
          background: #17344f;
          color: #fff;
          font-size: 24px;
          line-height: 1;
        }

        .advance-icon-button:hover:not(:disabled) {
          background: #0f2940;
        }

        .after-end-date {
          background: #f1f3f5 !important;
          border-color: #e1e5e8 !important;
          color: #aab4bd !important;
          cursor: not-allowed !important;
        }

        /* ---------------- Responsive ---------------- */

        @media (max-width: 1100px) {
          .main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .report-controls { grid-template-columns:1fr; }
          .individual-summary-grid { grid-template-columns:1fr 1fr; }
          .individual-bill-heading { flex-direction:column; }
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
          .advance-item {
            grid-template-columns: minmax(0, 1fr) auto;
            row-gap: 7px;
            min-height: 64px;
          }
          .advance-item-right {
            display: contents;
          }
          .advance-amount {
            grid-column: 2;
            grid-row: 1;
            min-width: auto;
          }
          .advance-actions {
            grid-column: 2;
            grid-row: 2;
            justify-content: flex-end;
            min-width: auto;
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

        {/* Employee selection */}
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
              const nextId = event.target.value;
              setSelectedEmployee(nextId);

              const nextEmployee = employees.find(
                (item) => String(item?._id) === String(nextId)
              );
              const nextEndDate = getEmployeeEndDateKey(nextEmployee);

              setReportEndDate(
                nextEndDate || toDateKey(new Date())
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

              <div>
                <div className="info-label">
                  End Date
                </div>

                <div className="info-value">
                  {getEmployeeEndDateKey(employee)
                    ? formatDate(
                        parseDateKey(
                          getEmployeeEndDateKey(employee)
                        )
                      )
                    : 'Active'}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* ==========================================================
            EMPLOYEE SALARY BILL
            ========================================================== */}
        <div className="card report-card">
          <div className="report-header">
            <div>
              <h2 className="section-title">Salary Bill</h2>
              <div className="section-subtitle">
                Salary bill for the selected employee and period.
              </div>
            </div>
          </div>

          <div className="report-controls individual-report-controls">
            <div className="report-field">
              <label className="text-label">Employee</label>
              <div className="selected-report-person">
                {employee?.name || 'Select an employee above'}
              </div>
            </div>

            <div className="report-field">
              <label className="text-label">From Date</label>
              <input
                type="date"
                className="text-input"
                value={reportStartDate}
                max={reportEndDate || toDateKey(new Date())}
                onChange={(event) => setReportStartDate(event.target.value)}
              />
            </div>

            <div className="report-field">
              <label className="text-label">To Date</label>
              <input
                type="date"
                className="text-input"
                value={reportEndDate}
                min={reportStartDate || undefined}
                max={getEmployeeEndDateKey(employee) || toDateKey(new Date())}
                onChange={(event) => setReportEndDate(event.target.value)}
              />
            </div>

            <div className="report-field salary-whatsapp-number-field">
              <label className="text-label">WhatsApp Number</label>
              <div className="saved-whatsapp-number">
                {employee
                  ? getEmployeePhone(employee) || 'Not available in Personal Information'
                  : 'Select an employee above'}
              </div>
            </div>
          </div>

          <div className="report-quick-buttons">
            <button type="button" className="report-quick-button" onClick={() => setQuickReportRange('month')}>
              This Month
            </button>
            <button type="button" className="report-quick-button" onClick={() => setQuickReportRange('2months')}>
              Last 2 Months
            </button>
            <button type="button" className="report-quick-button" onClick={() => setQuickReportRange('6months')}>
              Last 6 Months
            </button>
            <button type="button" className="report-quick-button" onClick={() => setQuickReportRange('year')}>
              Last 12 Months
            </button>
          </div>

          {employee && individualSalary && reportPeriodValid && (
            <div className="individual-bill-preview">
              <div className="individual-bill-heading">
                <div>
                  <h3>Salary Bill</h3>
                  <div>
                    Period: {formatDate(parseDateKey(individualSalary.startDate || reportStartDate))} to{' '}
                    {formatDate(parseDateKey(individualSalary.endDate || reportEndDate))}
                  </div>
                  <div>
                    Joining Date: {employee?.date
                      ? formatDate(new Date(employee.date))
                      : '-'}
                  </div>
                  {getEmployeeEndDateKey(employee) && (
                    <div>
                      End Date: {formatDate(parseDateKey(getEmployeeEndDateKey(employee)))}
                    </div>
                  )}
                </div>

                <div className="individual-bill-machine">
                  {currentMachine === 'big' ? 'Big Machine' : 'Small Machine'}
                </div>
              </div>

              <div className="individual-summary-grid">
                <div className="individual-summary-box">
                  <span>Total Days</span>
                  <strong>{individualSalary.totalDays}</strong>
                </div>
                <div className="individual-summary-box">
                  <span>Present</span>
                  <strong>{individualSalary.presentDays}</strong>
                </div>
                <div className="individual-summary-box absent">
                  <span>Absent</span>
                  <strong>{individualSalary.absentDays}</strong>
                </div>
                <div className="individual-summary-box final">
                  <span>Final Salary</span>
                  <strong>{formatMoney(individualSalary.finalSalary)}</strong>
                </div>
              </div>

              <div className="individual-salary-lines">
                <div>
                  <span>Monthly Salary</span>
                  <strong>{formatMoney(Number(employee?.salary) || 0)}</strong>
                </div>
                <div>
                  <span>Salary Advance</span>
                  <strong className="negative-value">
                    {formatMoney(individualSalary.totalAdvance)}
                  </strong>
                </div>
              </div>

              <div className="salary-whatsapp-action">
                <button
                  type="button"
                  className="button whatsapp-button salary-whatsapp-button"
                  onClick={shareSalaryBillOnWhatsApp}
                  disabled={!getEmployeePhone(employee)}
                >
                  <WhatsAppIcon sx={{ fontSize: 20 }} />
                  Share Salary Bill on WhatsApp
                </button>

                <div className="whatsapp-note">
                  The employee number is taken automatically from Personal Information.
                </div>
              </div>

            </div>
          )}

          {!employee && (
            <div className="individual-bill-empty">
              Select one employee to prepare the salary bill.
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
              to manage attendance and salary.
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

                </div>

                <div className="salary-lines">

                  <div className="salary-line">
                    <span>Monthly Salary</span>
                    <strong>
                      {formatMoney(Number(employee?.salary) || 0)}
                    </strong>
                  </div>

                  <div className="salary-line deduction">
                    <span>Absent Deduction</span>
                    <strong>
                      -{' '}
                      {formatMoney(salarySummary.absentDeduction)}
                    </strong>
                  </div>

                  <div className="salary-line deduction">
                    <span>Total Advance</span>
                    <strong>
                      -{' '}
                      {formatMoney(salarySummary.advance)}
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


                <div className="salary-action-row">
                  <div className="compact-attendance">
                    <div className="compact-attendance-item present">
                      <span>Present</span>
                      <strong>{salarySummary.presentDays}</strong>
                    </div>
                    <div className="compact-attendance-item absent">
                      <span>Absent</span>
                      <strong>{salarySummary.absentDays}</strong>
                    </div>
                  </div>

                  <div className="end-date-control">
                    <label htmlFor="employee-end-date">End Date</label>
                    <input
                      id="employee-end-date"
                      type="date"
                      className="text-input compact-date-input"
                      value={employeeEndDate}
                      min={
                        employee?.date
                          ? toDateKey(new Date(employee.date))
                          : undefined
                      }
                      max={toDateKey(new Date())}
                      onChange={(event) =>
                        setEmployeeEndDate(event.target.value)
                      }
                      disabled={savingEmployeeEndDate}
                    />
                    <button
                      type="button"
                      className="end-date-save-button"
                      onClick={saveEmployeeEndDate}
                      disabled={savingEmployeeEndDate}
                      title="Save employee end date"
                      aria-label="Save employee end date"
                    >
                      {savingEmployeeEndDate ? '…' : '✓'}
                    </button>
                  </div>

                  <button
                    type="button"
                    className="advance-icon-button"
                    onClick={openAddAdvance}
                    disabled={savingAdvance}
                    title="Add Salary Advance"
                    aria-label="Add Salary Advance"
                  >
                    ＋
                  </button>
                </div>

                <div className="advance-section">
                  <div className="advance-title-row">
                    <h3 className="section-title">Advances</h3>
                    <span className="advance-count">{advances.length}</span>
                  </div>
                  <div className="advance-list">
                    {advances.length === 0 ? (
                      <div className="empty-advance">No salary advances recorded.</div>
                    ) : advances.map((item) => (
                      <div className="advance-item" key={item._id || `${item.date}-${item.advanceAmount}`}>
                        <div className="advance-item-main">
                          <div className="advance-note">
                            {item.notes || item.paymentMode || 'Salary Advance'}
                          </div>
                          <div className="advance-date">
                            {formatAdvanceDate(item)}
                          </div>
                        </div>

                        <div className="advance-item-right">
                          <div className="advance-amount">
                            - {formatMoney(item.advanceAmount)}
                          </div>

                          <div className="advance-actions">
                            <button
                              type="button"
                              className="advance-action-button advance-edit-button"
                              onClick={() => openEditAdvance(item)}
                              disabled={savingAdvance || deletingAdvance}
                              title="Edit salary advance"
                              aria-label="Edit salary advance"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              className="advance-action-button advance-delete-button"
                              onClick={() => setDeleteAdvanceDialog(item)}
                              disabled={savingAdvance || deletingAdvance}
                              title="Delete salary advance"
                              aria-label="Delete salary advance"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v5" />
                                <path d="M14 11v5" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
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

                      const employeeEndKey =
                        getEmployeeEndDateKey(employee);

                      const afterEmployeeEnd =
                        employeeEndKey &&
                        key > employeeEndKey;

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
                            afterEmployeeEnd
                              ? 'after-end-date'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(
                              ' '
                            )}
                          disabled={
                            future ||
                            beforeJoining ||
                            Boolean(afterEmployeeEnd)
                          }
                          title={
                            afterEmployeeEnd
                              ? 'Employee terminated — no attendance after end date'
                              : isAbsent
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


      {deleteAdvanceDialog && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingAdvance) {
              setDeleteAdvanceDialog(null);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Delete Salary Advance</h2>
                <div className="modal-date">{employee?.name}</div>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setDeleteAdvanceDialog(null)}
                disabled={deletingAdvance}
              >
                ×
              </button>
            </div>

            <div className="delete-advance-box">
              <div className="delete-advance-label">ADVANCE TO DELETE</div>
              <div className="delete-advance-amount">
                {formatMoney(deleteAdvanceDialog.advanceAmount)}
              </div>
              <div className="delete-advance-meta">
                {formatAdvanceDate(deleteAdvanceDialog)}
                {' • '}
                {deleteAdvanceDialog.paymentMode || 'Cash'}
              </div>
              {deleteAdvanceDialog.notes && (
                <div className="delete-advance-notes">
                  {deleteAdvanceDialog.notes}
                </div>
              )}
            </div>

            <div className="modal-warning">
              This advance will be removed from the employee's salary calculation.
              This action cannot be undone from this screen.
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="button"
                onClick={() => setDeleteAdvanceDialog(null)}
                disabled={deletingAdvance}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button danger"
                onClick={confirmDeleteAdvance}
                disabled={deletingAdvance}
              >
                {deletingAdvance ? 'Deleting...' : 'Delete Advance'}
              </button>
            </div>
          </div>
        </div>
      )}


      {advanceModal && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAdvanceModal(false);
          }}
        >
          <div className="modal wide">
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{editingAdvance ? 'Edit Salary Advance' : 'Add Salary Advance'}</h2>
                <div className="modal-date">{employee?.name}</div>
              </div>
              <button type="button" className="close-button" onClick={closeAdvanceModal} disabled={savingAdvance}>×</button>
            </div>

            <div className="advance-form-grid">
              <div>
                <label className="text-label">Date</label>
                <input type="date" className="text-input" value={advanceDate} max={toDateKey(new Date())} onChange={(event) => setAdvanceDate(event.target.value)} disabled={savingAdvance} />
              </div>
              <div>
                <label className="text-label">Advance Amount</label>
                <input type="number" min="0" step="0.01" className="text-input" placeholder="₹0.00" value={advanceAmount} onChange={(event) => setAdvanceAmount(event.target.value)} disabled={savingAdvance} autoFocus />
              </div>
              <div>
                <label className="text-label">Payment Mode</label>
                <select className="select-input" style={{ maxWidth: 'none' }} value={advancePaymentMode} onChange={(event) => setAdvancePaymentMode(event.target.value)} disabled={savingAdvance}>
                  <option value="cash">Cash</option>
                  <option value="gpay">GPay</option>
                  <option value="net_banking">Net Banking</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="text-label">Notes</label>
                <input className="text-input" placeholder="Optional" value={advanceNotes} onChange={(event) => setAdvanceNotes(event.target.value)} disabled={savingAdvance} />
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="button" onClick={closeAdvanceModal} disabled={savingAdvance}>Cancel</button>
              <button type="button" className="button green" onClick={saveAdvance} disabled={savingAdvance}>
                {savingAdvance ? (editingAdvance ? 'Updating...' : 'Saving...') : (editingAdvance ? 'Update Advance' : 'Save Advance')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
