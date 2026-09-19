import React, { useEffect, useMemo, useState } from 'react';
import { useMachine } from '../context/MachineContext';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api';

const getToken = () =>
  localStorage.getItem('token') ||
  localStorage.getItem('accessToken') ||
  localStorage.getItem('jwt') ||
  '';

const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

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

  return [];
};

const pad = (value) =>
  String(value).padStart(2, '0');

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

  if (!year || !month || !day) {
    return null;
  }

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

const normalizeStatus = (value) => {
  const status = String(value || '')
    .trim()
    .toLowerCase();

  if (
    ['absent', 'a', 'leave', 'on_leave'].includes(status)
  ) {
    return 'absent';
  }

  if (
    ['present', 'p', 'working'].includes(status)
  ) {
    return 'present';
  }

  return status;
};

const normalizeAttendanceRecord = (record) => ({
  ...record,
  status: normalizeStatus(record?.status),
});

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

const formatMoney = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

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

  if (
    !requestedStart ||
    !requestedEnd ||
    requestedEnd < requestedStart
  ) {
    return {
      totalDays: 0,
      presentDays: 0,
      absentDays: 0,
      grossSalary: 0,
      absentDeduction: 0,
      workedSalary: 0,
      totalAdvance: 0,
      finalSalary: 0,
    };
  }

  const joiningKey = employee?.date
    ? toDateKey(new Date(employee.date))
    : requestedStart;

  const employeeEndKey =
    getEmployeeEndDateKey(employee);

  const effectiveStart =
    joiningKey && joiningKey > requestedStart
      ? joiningKey
      : requestedStart;

  let effectiveEnd =
    requestedEnd > todayKey
      ? todayKey
      : requestedEnd;

  if (
    employeeEndKey &&
    employeeEndKey < effectiveEnd
  ) {
    effectiveEnd = employeeEndKey;
  }

  if (effectiveEnd < effectiveStart) {
    return {
      totalDays: 0,
      presentDays: 0,
      absentDays: 0,
      grossSalary: 0,
      absentDeduction: 0,
      workedSalary: 0,
      totalAdvance: 0,
      finalSalary: 0,
      startDate: effectiveStart,
      endDate: effectiveEnd,
    };
  }

  const rangeDates = getDateRange(
    effectiveStart,
    effectiveEnd
  );

  const rangeSet = new Set(rangeDates);
  const absentKeys = new Set();

  for (const record of attendanceRecords) {
    if (
      normalizeStatus(record?.status) ===
      'absent'
    ) {
      const rawDate =
        record?.date ||
        record?.attendanceDate ||
        record?.absenceDate;

      const key = rawDate
        ? toDateKey(rawDate)
        : '';

      if (key && rangeSet.has(key)) {
        absentKeys.add(key);
      }
    }

    if (Array.isArray(record?.absentDates)) {
      for (const item of record.absentDates) {
        const key = toDateKey(
          item?.date || item
        );

        if (key && rangeSet.has(key)) {
          absentKeys.add(key);
        }
      }
    }
  }

  const totalDays = rangeDates.length;
  const absentDays = absentKeys.size;
  const presentDays = Math.max(
    totalDays - absentDays,
    0
  );

  const monthlySalary =
    Number(employee?.salary) || 0;

  const dailySalary =
    monthlySalary / 30;

  const grossSalary =
    dailySalary * totalDays;

  const absentDeduction =
    dailySalary * absentDays;

  const totalAdvance = advances.reduce(
    (sum, item) => {
      const rawDate =
        getAdvanceDateValue(item);

      const advanceKey = rawDate
        ? toDateKey(new Date(rawDate))
        : item?.month
          ? `${item.month}-01`
          : '';

      if (
        advanceKey &&
        advanceKey >= effectiveStart &&
        advanceKey <= effectiveEnd
      ) {
        return (
          sum +
          (Number(item?.advanceAmount) || 0)
        );
      }

      return sum;
    },
    0
  );

  const salaryBeforeAdvance =
    Math.max(
      grossSalary - absentDeduction,
      0
    );

  // Salary actually earned for worked/present days,
  // before deducting salary advances.
  const workedSalary = salaryBeforeAdvance;

  const finalSalary =
    salaryBeforeAdvance - totalAdvance;

  return {
    totalDays,
    presentDays,
    absentDays,
    grossSalary,
    absentDeduction,
    workedSalary,
    totalAdvance,
    finalSalary,
    startDate: effectiveStart,
    endDate: effectiveEnd,
  };
};

const SalaryReport = () => {
  const {
    currentMachine = 'big',
  } = useMachine();

  const [employees, setEmployees] =
    useState([]);

  const [allEmployeeSalaryRows, setAllEmployeeSalaryRows] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [reportStartDate, setReportStartDate] =
    useState(() => {
      const now = new Date();

      return toDateKey(
        new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        )
      );
    });

  const [reportEndDate, setReportEndDate] =
    useState(() =>
      toDateKey(new Date())
    );

  const machineLabel =
    currentMachine === 'big'
      ? 'Big Machine'
      : 'Small Machine';

  useEffect(() => {
    let cancelled = false;

    const loadEmployees = async () => {
      try {
        setLoading(true);
        setError('');

        const data = await apiRequest(
          `/users?machineType=${currentMachine}&limit=500`
        );

        const allUsers = extractList(
          data,
          [
            'users',
            'records',
            'personalUsers',
            'employees',
            'data',
          ]
        );

        const list = allUsers.filter(
          (item) => {
            const type = String(
              item?.type ||
                item?.userType ||
                item?.role ||
                ''
            )
              .trim()
              .toLowerCase();

            return (
              type !== 'broker' &&
              type !== 'partner'
            );
          }
        );

        if (!cancelled) {
          setEmployees(list);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.message ||
              'Unable to load employees.'
          );
          setEmployees([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadEmployees();

    return () => {
      cancelled = true;
    };
  }, [currentMachine]);

  useEffect(() => {
    let cancelled = false;

    const loadSalaryData = async () => {
      if (!employees.length) {
        setAllEmployeeSalaryRows([]);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const rows =
          await Promise.all(
            employees.map(
              async (employee) => {
                const employeeId =
                  employee?._id;

                try {
                  const [
                    attendanceData,
                    advanceData,
                  ] = await Promise.all([
                    apiRequest(
                      `/attendance?employeeId=${employeeId}&machineType=${currentMachine}&limit=500`
                    ),
                    apiRequest(
                      `/salary-advances?employeeId=${employeeId}&machineType=${currentMachine}&limit=500`
                    ),
                  ]);

                  const attendance =
                    extractList(
                      attendanceData,
                      [
                        'records',
                        'attendance',
                        'data',
                        'items',
                      ]
                    ).map(
                      normalizeAttendanceRecord
                    );

                  const advances =
                    extractList(
                      advanceData,
                      [
                        'records',
                        'advances',
                        'data',
                        'items',
                      ]
                    );

                  return {
                    employee,
                    attendance,
                    advances,
                    failed: false,
                  };
                } catch (err) {
                  console.warn(
                    `Unable to load salary data for ${
                      employee?.name ||
                      'employee'
                    }:`,
                    err?.message || err
                  );

                  return {
                    employee,
                    attendance: [],
                    advances: [],
                    failed: true,
                  };
                }
              }
            )
          );

        if (!cancelled) {
          setAllEmployeeSalaryRows(rows);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.message ||
              'Unable to load salary report.'
          );
          setAllEmployeeSalaryRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSalaryData();

    return () => {
      cancelled = true;
    };
  }, [
    employees,
    currentMachine,
    reportStartDate,
    reportEndDate,
  ]);

  const reportRows = useMemo(() => {
    return allEmployeeSalaryRows.map(
      (row) => ({
        ...row,
        reportSalary:
          calculateEmployeeRangeSalary(
            row.employee,
            row.attendance || [],
            row.advances || [],
            reportStartDate,
            reportEndDate
          ),
      })
    );
  }, [
    allEmployeeSalaryRows,
    reportStartDate,
    reportEndDate,
  ]);

  const reportTotals = useMemo(
    () =>
      reportRows.reduce(
        (totals, row) => {
          const salary =
            row.reportSalary || {};

          totals.totalDays +=
            Number(salary.totalDays) || 0;

          totals.presentDays +=
            Number(salary.presentDays) || 0;

          totals.absentDays +=
            Number(salary.absentDays) || 0;

          totals.grossSalary +=
            Number(salary.grossSalary) || 0;

          totals.monthlySalary +=
            Number(row?.employee?.salary) ||
            0;

          totals.absentDeduction +=
            Number(
              salary.absentDeduction
            ) || 0;

          totals.workedSalary +=
            Number(
              salary.workedSalary
            ) || 0;

          totals.totalAdvance +=
            Number(
              salary.totalAdvance
            ) || 0;

          totals.finalSalary +=
            Number(salary.finalSalary) || 0;

          return totals;
        },
        {
          totalDays: 0,
          presentDays: 0,
          absentDays: 0,
          grossSalary: 0,
          monthlySalary: 0,
          absentDeduction: 0,
          workedSalary: 0,
          totalAdvance: 0,
          finalSalary: 0,
        }
      ),
    [reportRows]
  );

  const reportPeriodValid =
    Boolean(reportStartDate) &&
    Boolean(reportEndDate) &&
    reportEndDate >= reportStartDate;

  const getReportPeriodLabel = () => {
    const start = formatDate(
      parseDateKey(reportStartDate)
    );

    const end = formatDate(
      parseDateKey(reportEndDate)
    );

    return reportStartDate === reportEndDate
      ? start
      : `${start} to ${end}`;
  };

  const setQuickReportRange = (type) => {
    const now = new Date();
    const today = toDateKey(now);

    const monthsBack = {
      month: 0,
      '2months': 1,
      '6months': 5,
      year: 11,
    };

    if (
      monthsBack[type] !== undefined
    ) {
      setReportStartDate(
        toDateKey(
          new Date(
            now.getFullYear(),
            now.getMonth() -
              monthsBack[type],
            1
          )
        )
      );

      setReportEndDate(today);
    }
  };

  const printSalaryReport = () => {
    if (
      !reportPeriodValid ||
      !reportRows.length
    ) {
      setError(
        'Please select a valid period and wait for employee data to load.'
      );
      return;
    }

    window.setTimeout(
      () => window.print(),
      50
    );
  };

  return (
    <div className="salary-report-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .salary-report-page {
          min-height: 100%;
          padding: 32px;
          background: #eef2f7;
          color: #16283c;
          font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            sans-serif;
        }

        .salary-report-container {
          max-width: 1400px;
          margin: 0 auto;
        }

        .salary-report-card {
          background: #ffffff;
          border: 1px solid #dfe7ef;
          border-radius: 16px;
          padding: 28px 30px;
          box-shadow:
            0 8px 24px rgba(20, 43, 66, 0.05);
        }

        .salary-report-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          flex-wrap: wrap;
        }

        .salary-report-title {
          margin: 0;
          font-size: 24px;
          line-height: 1.2;
          font-weight: 850;
          color: #102f4c;
        }

        .salary-report-subtitle {
          margin-top: 8px;
          color: #6b8197;
          font-size: 14px;
        }

        .machine-badge {
          padding: 8px 14px;
          border-radius: 999px;
          background: #ecfdf8;
          border: 1px solid #b9eee2;
          color: #087d73;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .report-controls {
          display: grid;
          grid-template-columns:
            minmax(220px, 1fr)
            minmax(220px, 1fr);
          gap: 18px;
          margin-top: 28px;
        }

        .report-field {
          min-width: 0;
        }

        .text-label {
          display: block;
          margin-bottom: 8px;
          color: #344f68;
          font-size: 13px;
          font-weight: 750;
        }

        .date-input {
          width: 100%;
          height: 58px;
          border: 1px solid #ccd9e5;
          border-radius: 12px;
          padding: 0 16px;
          color: #102f4c;
          background: #fff;
          font-size: 16px;
          outline: none;
        }

        .date-input:focus {
          border-color: #14b8a6;
          box-shadow:
            0 0 0 3px rgba(20, 184, 166, .12);
        }

        .quick-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 18px;
        }

        .quick-button {
          min-height: 40px;
          padding: 0 16px;
          border: 1px solid #d3dee8;
          border-radius: 10px;
          background: #fff;
          color: #23435f;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
        }

        .quick-button:hover {
          background: #f5f9fb;
          border-color: #9fb4c7;
        }

        .report-preview {
          margin-top: 26px;
          border: 1px solid #dce6ef;
          border-radius: 14px;
          overflow: hidden;
          background: #fff;
        }

        .report-preview-header {
          padding: 24px;
          border-bottom: 1px solid #e5edf4;
        }

        .report-preview-header h2 {
          margin: 0;
          font-size: 28px;
          font-weight: 850;
          color: #10324f;
        }

        .report-period {
          margin-top: 8px;
          color: #64809a;
          font-size: 14px;
        }

        .summary-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 12px;
          padding: 20px 24px 8px;
        }

        .summary-box {
          min-width: 0;
          border: 1px solid #d5dee7;
          padding: 18px 16px;
          background: #fff;
        }

        .summary-label {
          color: #71859a;
          font-size: 12px;
          font-weight: 750;
        }

        .summary-value {
          margin-top: 10px;
          color: #102f4c;
          font-size: 24px;
          font-weight: 850;
          overflow-wrap: anywhere;
        }

        .report-table-wrap {
          width: 100%;
          overflow-x: auto;
          padding: 16px 24px 0;
        }

        .report-table {
          width: 100%;
          min-width: 920px;
          border-collapse: collapse;
          font-size: 14px;
        }

        .report-table th,
        .report-table td {
          border: 1px solid #cbd5df;
          padding: 14px 12px;
          text-align: left;
          white-space: nowrap;
        }

        .report-table th {
          background: #f6f8fa;
          color: #0f2943;
          font-size: 13px;
          font-weight: 850;
        }

        .report-table td {
          color: #24435f;
        }

        .report-table tbody tr:hover {
          background: #fafcfd;
        }

        .report-total-row td {
          background: #fbfbfb;
          color: #102f4c;
          font-weight: 850;
        }

        .report-actions {
          display: flex;
          justify-content: flex-start;
          padding: 14px 24px 24px;
        }

        .print-button {
          min-height: 48px;
          padding: 0 22px;
          border: 1px solid #d3dee8;
          border-radius: 10px;
          background: #fff;
          color: #111;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
        }

        .print-button:hover {
          background: #f4f7fa;
        }

        .loading-box,
        .error-box,
        .empty-box {
          margin-top: 18px;
          padding: 16px;
          border-radius: 10px;
          font-size: 14px;
        }

        .loading-box {
          background: #f8fafc;
          color: #64748b;
        }

        .error-box {
          background: #fff1f1;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        .empty-box {
          background: #f8fafc;
          color: #64748b;
        }

        .print-report {
          display: none;
        }

        @media (max-width: 900px) {
          .salary-report-page {
            padding: 16px;
          }

          .salary-report-card {
            padding: 22px 18px;
          }

          .report-controls {
            grid-template-columns: 1fr;
          }

          .summary-grid {
            grid-template-columns: repeat(2, 1fr);
            padding-left: 18px;
            padding-right: 18px;
          }

          .report-table-wrap {
            padding-left: 18px;
            padding-right: 18px;
          }

          .report-actions {
            padding-left: 18px;
            padding-right: 18px;
          }
        }

        @media (max-width: 520px) {
          .salary-report-title {
            font-size: 21px;
          }

          .report-preview-header h2 {
            font-size: 23px;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .quick-button {
            flex: 1 1 calc(50% - 10px);
          }
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          body {
            background: #fff !important;
          }

          .salary-report-page {
            padding: 0 !important;
            background: #fff !important;
          }

          .salary-report-container {
            max-width: none !important;
          }

          .salary-report-card {
            display: none !important;
          }

          .print-report {
            display: block !important;
            color: #111 !important;
          }

          .print-report-title {
            margin: 0 0 6px;
            text-align: center;
            font-size: 22px;
          }

          .print-report-period {
            margin-bottom: 14px;
            text-align: center;
            font-size: 12px;
          }

          .print-summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 14px;
          }

          .print-summary-box {
            border: 1px solid #aaa;
            padding: 9px;
          }

          .print-summary-label {
            font-size: 10px;
            font-weight: 700;
          }

          .print-summary-value {
            margin-top: 4px;
            font-size: 14px;
            font-weight: 800;
          }

          .print-report table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
          }

          .print-report th,
          .print-report td {
            border: 1px solid #888;
            padding: 5px;
            text-align: left;
          }

          .print-report th {
            background: #f2f2f2 !important;
            font-weight: 800;
          }

          .print-total td {
            font-weight: 800;
            background: #f7f7f7 !important;
          }
        }
      `}</style>

      <div className="salary-report-container">
        <div className="salary-report-card">
          <div className="salary-report-top">
            <div>
              <h1 className="salary-report-title">
                Employee Salary Report
              </h1>

              <div className="salary-report-subtitle">
                Select a date range to view the complete salary report.
              </div>
            </div>

            <div className="machine-badge">
              {machineLabel}
            </div>
          </div>

          <div className="report-controls">
            <div className="report-field">
              <label className="text-label">
                From Date
              </label>

              <input
                type="date"
                className="date-input"
                value={reportStartDate}
                max={
                  reportEndDate ||
                  toDateKey(new Date())
                }
                onChange={(event) =>
                  setReportStartDate(
                    event.target.value
                  )
                }
              />
            </div>

            <div className="report-field">
              <label className="text-label">
                To Date
              </label>

              <input
                type="date"
                className="date-input"
                value={reportEndDate}
                min={
                  reportStartDate ||
                  undefined
                }
                max={toDateKey(new Date())}
                onChange={(event) =>
                  setReportEndDate(
                    event.target.value
                  )
                }
              />
            </div>
          </div>

          <div className="quick-buttons">
            <button
              type="button"
              className="quick-button"
              onClick={() =>
                setQuickReportRange('month')
              }
            >
              This Month
            </button>

            <button
              type="button"
              className="quick-button"
              onClick={() =>
                setQuickReportRange('2months')
              }
            >
              Last 2 Months
            </button>

            <button
              type="button"
              className="quick-button"
              onClick={() =>
                setQuickReportRange('6months')
              }
            >
              Last 6 Months
            </button>

            <button
              type="button"
              className="quick-button"
              onClick={() =>
                setQuickReportRange('year')
              }
            >
              Last 12 Months
            </button>
          </div>

          {!reportPeriodValid && (
            <div className="error-box">
              To Date cannot be before From Date.
            </div>
          )}

          {loading && (
            <div className="loading-box">
              Loading employee salary details...
            </div>
          )}

          {error && (
            <div className="error-box">
              {error}
            </div>
          )}

          {reportPeriodValid &&
            !loading &&
            reportRows.length === 0 && (
              <div className="empty-box">
                No employee salary data available.
              </div>
            )}

          {reportPeriodValid &&
            reportRows.length > 0 && (
              <div className="report-preview">
                <div className="report-preview-header">
                  <h2>
                    Employee Salary Report
                  </h2>

                  <div className="report-period">
                    Period: {getReportPeriodLabel()}
                    {' • '}
                    {machineLabel}
                  </div>
                </div>

                <div className="summary-grid">
                  <div className="summary-box">
                    <div className="summary-label">
                      Employees
                    </div>

                    <div className="summary-value">
                      {reportRows.length}
                    </div>
                  </div>

                  <div className="summary-box">
                    <div className="summary-label">
                      Present Days
                    </div>

                    <div className="summary-value">
                      {reportTotals.presentDays}
                    </div>
                  </div>

                  <div className="summary-box">
                    <div className="summary-label">
                      Absent Days
                    </div>

                    <div className="summary-value">
                      {reportTotals.absentDays}
                    </div>
                  </div>

                  <div className="summary-box">
                    <div className="summary-label">
                      Final Payable
                    </div>

                    <div className="summary-value">
                      {formatMoney(
                        reportTotals.finalSalary
                      )}
                    </div>
                  </div>
                </div>

                <div className="report-table-wrap">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Name</th>
                        <th>Joining Date</th>
                        <th>Total Days</th>
                        <th>Present</th>
                        <th>Absent</th>
                        <th>Monthly Salary</th>
                        <th>Worked Salary</th>
                        <th>Total Advance</th>
                        <th>Final Salary</th>
                      </tr>
                    </thead>

                    <tbody>
                      {reportRows.map(
                        (row, index) => {
                          const item =
                            row.employee;

                          const salary =
                            row.reportSalary ||
                            {};

                          return (
                            <tr
                              key={
                                item?._id ||
                                index
                              }
                            >
                              <td>
                                {index + 1}
                              </td>

                              <td>
                                {item?.name ||
                                  'Unnamed Employee'}
                              </td>

                              <td>
                                {item?.date
                                  ? formatDate(
                                      new Date(
                                        item.date
                                      )
                                    )
                                  : '-'}
                              </td>

                              <td>
                                {salary.totalDays}
                              </td>

                              <td>
                                {salary.presentDays}
                              </td>

                              <td>
                                {salary.absentDays}
                              </td>

                              <td>
                                {formatMoney(
                                  Number(
                                    item?.salary
                                  ) || 0
                                )}
                              </td>

                              <td>
                                {formatMoney(
                                  salary.workedSalary
                                )}
                              </td>

                              <td>
                                {formatMoney(
                                  salary.totalAdvance
                                )}
                              </td>

                              <td>
                                {formatMoney(
                                  salary.finalSalary
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}

                      <tr className="report-total-row">
                        <td colSpan={3}>
                          TOTAL
                        </td>

                        <td>
                          {reportTotals.totalDays}
                        </td>

                        <td>
                          {reportTotals.presentDays}
                        </td>

                        <td>
                          {reportTotals.absentDays}
                        </td>

                        <td>
                          {formatMoney(
                            reportTotals.monthlySalary
                          )}
                        </td>

                        <td>
                          {formatMoney(
                            reportTotals.workedSalary
                          )}
                        </td>

                        <td>
                          {formatMoney(
                            reportTotals.totalAdvance
                          )}
                        </td>

                        <td>
                          {formatMoney(
                            reportTotals.finalSalary
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="report-actions">
                  <button
                    type="button"
                    className="print-button"
                    onClick={
                      printSalaryReport
                    }
                    disabled={loading}
                  >
                    Print / Save as PDF
                  </button>
                </div>
              </div>
            )}
        </div>

        {reportPeriodValid &&
          reportRows.length > 0 && (
            <div className="print-report">
              <div
                style={{
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: 700,
                  marginBottom: '8px',
                }}
              >
                Thalacauvery Borewell
              </div>

              <h1 className="print-report-title">
                Employee Salary Report
              </h1>

              <div className="print-report-period">
                Period: {getReportPeriodLabel()}
                {' • '}
                {machineLabel}
              </div>

              <div className="print-summary">
                <div className="print-summary-box">
                  <div className="print-summary-label">
                    Employees
                  </div>
                  <div className="print-summary-value">
                    {reportRows.length}
                  </div>
                </div>

                <div className="print-summary-box">
                  <div className="print-summary-label">
                    Present Days
                  </div>
                  <div className="print-summary-value">
                    {reportTotals.presentDays}
                  </div>
                </div>

                <div className="print-summary-box">
                  <div className="print-summary-label">
                    Absent Days
                  </div>
                  <div className="print-summary-value">
                    {reportTotals.absentDays}
                  </div>
                </div>

                <div className="print-summary-box">
                  <div className="print-summary-label">
                    Final Payable
                  </div>
                  <div className="print-summary-value">
                    {formatMoney(
                      reportTotals.finalSalary
                    )}
                  </div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Name</th>
                    <th>Joining Date</th>
                    <th>Total Days</th>
                    <th>Present</th>
                    <th>Absent</th>
                    <th>Monthly Salary</th>
                    <th>Worked Salary</th>
                        <th>Total Advance</th>
                    <th>Final Salary</th>
                  </tr>
                </thead>

                <tbody>
                  {reportRows.map(
                    (row, index) => {
                      const item =
                        row.employee;

                      const salary =
                        row.reportSalary ||
                        {};

                      return (
                        <tr
                          key={
                            item?._id ||
                            index
                          }
                        >
                          <td>{index + 1}</td>
                          <td>
                            {item?.name ||
                              'Unnamed Employee'}
                          </td>
                          <td>
                            {item?.date
                              ? formatDate(
                                  new Date(
                                    item.date
                                  )
                                )
                              : '-'}
                          </td>
                          <td>
                            {salary.totalDays}
                          </td>
                          <td>
                            {salary.presentDays}
                          </td>
                          <td>
                            {salary.absentDays}
                          </td>
                          <td>
                            {formatMoney(
                              Number(
                                item?.salary
                              ) || 0
                            )}
                          </td>
                          <td>
                            {formatMoney(
                              salary.workedSalary
                            )}
                          </td>

                          <td>
                            {formatMoney(
                              salary.totalAdvance
                            )}
                          </td>
                          <td>
                            {formatMoney(
                              salary.finalSalary
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}

                  <tr className="print-total">
                    <td colSpan={3}>
                      TOTAL
                    </td>
                    <td>
                      {reportTotals.totalDays}
                    </td>
                    <td>
                      {reportTotals.presentDays}
                    </td>
                    <td>
                      {reportTotals.absentDays}
                    </td>
                    <td>
                      {formatMoney(
                        reportTotals.monthlySalary
                      )}
                    </td>
                    <td>
                      {formatMoney(
                        reportTotals.workedSalary
                      )}
                    </td>
                    <td>
                      {formatMoney(
                        reportTotals.totalAdvance
                      )}
                    </td>
                    <td>
                      {formatMoney(
                        reportTotals.finalSalary
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
};

export default SalaryReport;
