import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material';

import MenuIcon from '@mui/icons-material/Menu';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PersonIcon from '@mui/icons-material/Person';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import SaveIcon from '@mui/icons-material/Save';

import dayjs from 'dayjs';
import { toast } from 'react-toastify';

import api from '../utils/api';


// ============================================================
// HELPERS
// ============================================================

const toNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
};


const formatNumber = (value) => {
  return toNumber(value).toLocaleString('en-IN');
};


// The project's api helper may return response.data directly.
// This keeps this page compatible with either shape.
const unwrapResponse = (response) => {
  return response?.data ?? response;
};


// ============================================================
// DEFAULT AGENT
// ============================================================

const EMPTY_AGENT = {
  id: '',
  name: '',
  jInner: '',
  outer: '',
  depth: '',
  trans: '',
  total: '',
};


// ============================================================
// DEFAULT ITEMS
// ============================================================

const EMPTY_ITEMS = {
  diesel: {
    quantity: '',
    rate: '',
  },

  jPipe: {
    quantity: '',
    rate: '',
  },

  outer: {
    quantity: '',
    rate: '',
  },

  bit: {
    quantity: '',
    rate: '',
  },

  hammer: {
    quantity: '',
    rate: '',
  },

  other: {
    value: '',
    amount: '',
  },
};


// ============================================================
// BIG MACHINE MATERIAL TYPES
// ============================================================

const MATERIAL_MAP = {
  diesel: 'Diesel',
  jPipe: 'Pipe J1',
  outer: 'Pipe Outer',
  bit: 'Bit',
  hammer: 'Hammer',
  other: 'Others',
};


// ============================================================
// COMPONENT
// ============================================================

const BigMachine = () => {

  // ==========================================================
  // AGENTS
  // ==========================================================

  const [agents, setAgents] = useState([]);

  const [agentsLoading, setAgentsLoading] =
    useState(false);

  const [selectedAgentId, setSelectedAgentId] =
    useState('');


  // ==========================================================
  // AGENT INFORMATION
  // ==========================================================

  const [agent, setAgent] =
    useState(EMPTY_AGENT);


  // ==========================================================
  // ITEM DETAILS
  // ==========================================================

  const [items, setItems] =
    useState(EMPTY_ITEMS);


  // ==========================================================
  // EMPLOYEES
  // ==========================================================

  const [employees, setEmployees] =
    useState([]);

  const [attendanceLoading, setAttendanceLoading] =
    useState(false);

  const [attendanceSaving, setAttendanceSaving] =
    useState(false);


  // employeeId -> true / false
  //
  // true  = Present
  // false = Absent
  const [attendance, setAttendance] =
    useState({});


  // Existing attendance records for today.
  const [attendanceRecords, setAttendanceRecords] =
    useState([]);


  // ==========================================================
  // SAVE
  // ==========================================================

  const [saving, setSaving] =
    useState(false);


  // ==========================================================
  // LOAD BIG MACHINE AGENTS
  // ==========================================================

  const loadAgents = useCallback(
    async () => {

      try {

        setAgentsLoading(true);

        const response = await api.get(
          '/points',
          {
            params: {
              machineType: 'big',
              page: 1,
              limit: 500,
            },
          }
        );

        const data =
          unwrapResponse(response);

        const points =
          Array.isArray(data?.points)
            ? data.points
            : [];

        /*
         * One broker/agent can have more than one
         * Agent Information rate-card record.
         *
         * Keep only one dropdown entry per agent.
         */
        const uniqueAgents =
          new Map();

        points.forEach((point) => {

          if (
            !point ||
            point.machineType !== 'big'
          ) {
            return;
          }

          const broker =
            point.brokerId;

          const id =
            typeof broker === 'string'
              ? broker
              : broker?._id ||
                broker?.id ||
                point._id;

          const name =
            typeof broker === 'object'
              ? (
                  broker?.name ||
                  broker?.fullName ||
                  broker?.username
                )
              : (
                  point?.brokerName ||
                  point?.broker?.name ||
                  point?.name ||
                  ''
                );

          if (!id || !name) {
            return;
          }

          /*
           * Keep the complete point record.
           * When the user selects the agent we can
           * load all of its saved values.
           */
          uniqueAgents.set(
            String(id),
            {
              ...point,
              _agentId: String(id),
              _agentName: name,
            }
          );
        });

        const list =
          Array.from(
            uniqueAgents.values()
          ).sort((a, b) =>
            String(
              a._agentName
            ).localeCompare(
              String(
                b._agentName
              )
            )
          );

        setAgents(list);

      } catch (error) {

        console.error(
          'Load Big Machine agents error:',
          error
        );

        setAgents([]);

        toast.error(
          error.response?.data?.message ||
          'Failed to load agents'
        );

      } finally {

        setAgentsLoading(false);

      }

    },
    []
  );


  // ==========================================================
  // LOAD SMALL MACHINE EMPLOYEES
  // ==========================================================

  const loadEmployees = useCallback(
    async () => {

      try {

        setAttendanceLoading(true);

        /*
         * You specifically requested
         * Small Machine employees.
         */
        const response =
          await api.get(
            '/attendance/employees',
            {
              params: {
                machineType: 'small',
              },
            }
          );

        const data =
          unwrapResponse(response);

        const employeeList =
          Array.isArray(data?.employees)
            ? data.employees
            : [];

        setEmployees(
          employeeList
        );

        /*
         * All employees are PRESENT
         * by default.
         *
         * User can uncheck anyone who is absent.
         */
        const initialAttendance = {};

        employeeList.forEach(
          (employee) => {

            initialAttendance[
              String(employee._id)
            ] = true;

          }
        );

        setAttendance(
          initialAttendance
        );

      } catch (error) {

        console.error(
          'Load employees error:',
          error
        );

        setEmployees([]);

        setAttendance({});

        toast.error(
          error.response?.data?.message ||
          'Failed to load employees'
        );

      } finally {

        setAttendanceLoading(false);

      }

    },
    []
  );


  // ==========================================================
  // LOAD TODAY'S ATTENDANCE
  // ==========================================================

  const loadTodayAttendance =
    useCallback(
      async () => {

        try {

          const today =
            dayjs().format(
              'YYYY-MM-DD'
            );

          const response =
            await api.get(
              '/attendance',
              {
                params: {
                  machineType: 'small',
                  startDate: today,
                  endDate: today,
                  limit: 500,
                },
              }
            );

          const data =
            unwrapResponse(response);

          const records =
            Array.isArray(
              data?.records
            )
              ? data.records
              : [];

          setAttendanceRecords(
            records
          );

          /*
           * Existing attendance overrides
           * the default "Present" state.
           */
          if (records.length > 0) {

            setAttendance(
              (previous) => {

                const next = {
                  ...previous,
                };

                records.forEach(
                  (record) => {

                    const employeeId =
                      record.employeeId?._id ||
                      record.employeeId;

                    if (!employeeId) {
                      return;
                    }

                    next[
                      String(employeeId)
                    ] =
                      String(
                        record.status || ''
                      ).toLowerCase() ===
                      'present';

                  }
                );

                return next;

              }
            );

          }

        } catch (error) {

          console.error(
            'Load today attendance error:',
            error
          );

          /*
           * Do not stop the Big Machine
           * form if today's attendance
           * cannot be loaded.
           */

        }

      },
      []
    );


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {

    loadAgents();

    loadEmployees();

  }, [
    loadAgents,
    loadEmployees,
  ]);


  // Load today's existing attendance
  // after employees have been loaded.
  useEffect(() => {

    if (employees.length > 0) {
      loadTodayAttendance();
    }

  }, [
    employees.length,
    loadTodayAttendance,
  ]);


  // ==========================================================
  // AGENT SELECTION
  // ==========================================================

  const handleAgentSelect = (
    event
  ) => {

    const id =
      event.target.value;

    setSelectedAgentId(id);

    if (!id) {

      setAgent(
        EMPTY_AGENT
      );

      return;

    }

    const selected =
      agents.find(
        (item) =>
          String(
            item._agentId
          ) === String(id)
      );

    if (!selected) {
      return;
    }

    /*
     * Load values from the selected
     * Agent Information record.
     *
     * Support both the actual Agent Information
     * nested structure and the custom fields
     * used by the Big Machine form.
     */

    const jInner =
      selected?.jInner ??
      selected?.jiInner?.rate ??
      selected?.jiInner ??
      '';

    const outer =
      selected?.outer ??
      selected?.outerPipe?.rate ??
      selected?.outerPipe ??
      '';

    /*
     * Depth:
     *
     * If a direct depth value exists,
     * use it.
     *
     * Otherwise keep the depth rate-card
     * information available as the sum of
     * configured depth rates.
     */
    let depth =
      selected?.depth ??
      '';

    if (
      depth === '' ||
      depth === null ||
      depth === undefined
    ) {

      if (
        Array.isArray(
          selected?.depthDetails
        )
      ) {

        depth =
          selected.depthDetails.reduce(
            (
              sum,
              item
            ) =>
              sum +
              toNumber(
                item?.rate
              ),
            0
          );

      } else {

        depth = '';

      }

    }

    const trans =
      selected?.trans ??
      selected?.transport ??
      selected?.transportAmount ??
      '';

    /*
     * If Agent Information has a saved
     * total, use it.
     *
     * Otherwise calculate from the
     * displayed values.
     */
    const savedTotal =
      selected?.agentTotal ??
      selected?.totalAmount ??
      selected?.total ??
      '';

    const calculatedTotal =
      toNumber(jInner) +
      toNumber(outer) +
      toNumber(depth) +
      toNumber(trans);

    const total =
      savedTotal !== '' &&
      savedTotal !== null &&
      savedTotal !== undefined
        ? savedTotal
        : calculatedTotal;

    setAgent({
      id:
        selected._agentId,

      name:
        selected._agentName,

      jInner,

      outer,

      depth,

      trans,

      total,
    });

  };


  // ==========================================================
  // AGENT FIELD CHANGE
  // ==========================================================

  const handleAgentChange =
    (
      field,
      value
    ) => {

      setAgent(
        (previous) => ({
          ...previous,
          [field]: value,
        })
      );

    };


  // ==========================================================
  // AGENT TOTAL
  // ==========================================================

  const agentTotal =
    useMemo(() => {

      /*
       * If the selected Agent Information
       * contains a saved total, preserve it.
       *
       * Otherwise calculate dynamically.
       */
      const calculated =
        toNumber(agent.jInner) +
        toNumber(agent.outer) +
        toNumber(agent.depth) +
        toNumber(agent.trans);

      if (
        agent.total !== '' &&
        agent.total !== null &&
        agent.total !== undefined
      ) {

        /*
         * When the user changes one of
         * the four fields manually, recalculate.
         */
        const originalTotal =
          toNumber(agent.total);

        const currentSum =
          calculated;

        /*
         * If the stored total differs from
         * the current editable values, use
         * the current calculation.
         */
        if (
          currentSum !==
          originalTotal
        ) {
          return currentSum;
        }

        return originalTotal;
      }

      return calculated;

    }, [
      agent.jInner,
      agent.outer,
      agent.depth,
      agent.trans,
      agent.total,
    ]);


  // ==========================================================
  // ITEM CHANGE
  // ==========================================================

  const handleItemChange =
    (
      item,
      field,
      value
    ) => {

      setItems(
        (previous) => ({
          ...previous,

          [item]: {
            ...previous[item],
            [field]: value,
          },
        })
      );

    };


  // ==========================================================
  // ITEM AMOUNT
  // ==========================================================

  const getItemAmount =
    (item) => {

      /*
       * Other uses direct amount.
       */
      if (item === 'other') {

        return toNumber(
          items.other.amount
        );

      }

      const quantity =
        toNumber(
          items[item]?.quantity
        );

      const rate =
        toNumber(
          items[item]?.rate
        );

      return (
        quantity * rate
      );

    };


  // ==========================================================
  // TOTAL ITEM AMOUNT
  // ==========================================================

  const totalItemAmount =
    useMemo(() => {

      return (
        getItemAmount('diesel') +
        getItemAmount('jPipe') +
        getItemAmount('outer') +
        getItemAmount('bit') +
        getItemAmount('hammer') +
        getItemAmount('other')
      );

    }, [items]);


  // ==========================================================
  // ATTENDANCE CHANGE
  // ==========================================================

  const handleAttendanceChange =
    (
      employeeId
    ) => {

      setAttendance(
        (previous) => ({
          ...previous,

          [String(employeeId)]:
            !previous[
              String(employeeId)
            ],
        })
      );

    };


  // ==========================================================
  // SAVE ONE MATERIAL
  // ==========================================================

  const saveMaterial =
    async (
      itemKey
    ) => {

      const item =
        items[itemKey];

      const materialType =
        MATERIAL_MAP[itemKey];

      if (!materialType) {
        return;
      }

      /*
       * OTHER
       */
      if (
        itemKey === 'other'
      ) {

        const amount =
          toNumber(
            item.amount
          );

        const description =
          String(
            item.value || ''
          ).trim();

        if (
          !description &&
          amount <= 0
        ) {
          return;
        }

        if (
          !description
        ) {

          throw new Error(
            'Other material description is required'
          );

        }

        if (
          amount <= 0
        ) {

          throw new Error(
            'Other material amount is required'
          );

        }

        const form =
          new FormData();

        form.append(
          'date',
          dayjs().toISOString()
        );

        form.append(
          'type',
          materialType
        );

        form.append(
          'machineType',
          'big'
        );

        form.append(
          'description',
          description
        );

        form.append(
          'quantity',
          '0'
        );

        form.append(
          'costPerLiter',
          '0'
        );

        form.append(
          'amount',
          String(amount)
        );

        form.append(
          'totalPrice',
          String(amount)
        );

        await api.post(
          '/materials',
          form
        );

        return;
      }


      /*
       * NORMAL MATERIAL
       */
      const quantity =
        toNumber(
          item.quantity
        );

      const rate =
        toNumber(
          item.rate
        );

      if (
        quantity <= 0
      ) {
        return;
      }

      const amount =
        quantity * rate;

      const form =
        new FormData();

      form.append(
        'date',
        dayjs().toISOString()
      );

      form.append(
        'type',
        materialType
      );

      form.append(
        'machineType',
        'big'
      );

      form.append(
        'quantity',
        String(quantity)
      );

      form.append(
        'costPerLiter',
        String(rate)
      );

      form.append(
        'amount',
        String(amount)
      );

      form.append(
        'totalPrice',
        String(amount)
      );

      form.append(
        'description',
        ''
      );

      await api.post(
        '/materials',
        form
      );

    };


  // ==========================================================
  // SAVE / UPDATE ATTENDANCE
  // ==========================================================

  const saveAttendance =
    async () => {

      const date =
        dayjs().format(
          'YYYY-MM-DD'
        );

      /*
       * Existing record lookup.
       */
      const existingByEmployee =
        new Map();

      attendanceRecords.forEach(
        (record) => {

          const employeeId =
            record.employeeId?._id ||
            record.employeeId;

          if (
            employeeId
          ) {

            existingByEmployee.set(
              String(employeeId),
              record
            );

          }

        }
      );

      const requests =
        employees.map(
          async (employee) => {

            const employeeId =
              String(
                employee._id
              );

            const status =
              attendance[
                employeeId
              ]
                ? 'present'
                : 'absent';

            const existing =
              existingByEmployee.get(
                employeeId
              );

            if (existing) {

              await api.put(
                `/attendance/${existing._id}`,
                {
                  status,
                }
              );

            } else {

              await api.post(
                '/attendance',
                {
                  employeeId,
                  date,
                  status,
                  machineType:
                    'small',
                }
              );

            }

          }
        );

      await Promise.all(
        requests
      );

    };


  // ==========================================================
  // SAVE EVERYTHING
  // ==========================================================

  const handleSave =
    async () => {

      try {

        setSaving(true);

        /*
         * 1. Save materials.
         */
        const materialKeys = [
          'diesel',
          'jPipe',
          'outer',
          'bit',
          'hammer',
          'other',
        ];

        for (
          const itemKey of materialKeys
        ) {

          await saveMaterial(
            itemKey
          );

        }

        /*
         * 2. Save attendance.
         */
        if (
          employees.length > 0
        ) {

          setAttendanceSaving(
            true
          );

          await saveAttendance();

          setAttendanceSaving(
            false
          );

        }

        /*
         * 3. Final data for debugging /
         *    future backend integration.
         */
        const saveData = {
          machineType: 'big',

          date:
            dayjs().format(
              'YYYY-MM-DD'
            ),

          agent,

          agentTotal,

          items,

          totalItemAmount,

          attendance:
            employees.map(
              (employee) => ({
                employeeId:
                  employee._id,

                employeeName:
                  employee.name ||
                  employee.fullName ||
                  employee.username,

                status:
                  attendance[
                    String(
                      employee._id
                    )
                  ]
                    ? 'present'
                    : 'absent',
              })
            ),
        };

        console.log(
          'BIG MACHINE DATA:',
          saveData
        );

        toast.success(
          'Big Machine data saved successfully'
        );

      } catch (error) {

        console.error(
          'Big Machine save error:',
          error
        );

        toast.error(
          error.response?.data?.message ||
          error.message ||
          'Failed to save Big Machine data'
        );

      } finally {

        setSaving(false);

        setAttendanceSaving(
          false
        );

      }

    };


  // ==========================================================
  // RESET
  // ==========================================================

  const handleReset =
    () => {

      setSelectedAgentId('');

      setAgent(
        EMPTY_AGENT
      );

      setItems(
        EMPTY_ITEMS
      );

      /*
       * All employees checked again.
       */
      const resetAttendance = {};

      employees.forEach(
        (employee) => {

          resetAttendance[
            String(
              employee._id
            )
          ] = true;

        }
      );

      setAttendance(
        resetAttendance
      );

    };


  // ==========================================================
  // STYLES
  // ==========================================================

  const colors = {
    primary: '#1769e0',
    primaryDark: '#12366b',
    border: '#c9def7',
    inputBg: '#ffffff',
    amountBg: '#f0f6ff',
    text: '#102f5f',
    secondaryText: '#45658f',
  };


  const sectionStyle = {
    border:
      `1px solid ${colors.border}`,

    borderRadius: '8px',

    overflow: 'hidden',

    background: '#fff',

    marginBottom: '26px',

    boxShadow: 'none',
  };


  const sectionHeaderStyle = {
    minHeight: '66px',

    display: 'flex',

    alignItems: 'center',

    gap: '16px',

    padding: '0 24px',

    background:
      'linear-gradient(90deg, #f2f8ff 0%, #f8fbff 100%)',

    borderBottom:
      `1px solid ${colors.border}`,
  };


  const sectionIconStyle = {
    width: '36px',
    height: '36px',
    color: colors.primary,
    fontSize: '36px',
  };


  const labelStyle = {
    color: colors.text,
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '7px',
  };


  const inputStyle = {
    '& .MuiOutlinedInput-root': {

      minHeight: '50px',

      borderRadius: '6px',

      backgroundColor:
        colors.inputBg,

      fontSize: '18px',

      color: colors.text,

      '& fieldset': {
        borderColor: '#bfd4ee',
        borderWidth: '1px',
      },

      '&:hover fieldset': {
        borderColor:
          colors.primary,
      },

      '&.Mui-focused fieldset': {
        borderColor:
          colors.primary,

        borderWidth: '2px',
      },

    },

    '& .MuiInputBase-input': {
      padding: '12px 16px',
      color: colors.text,
    },
  };


  const amountStyle = {

    '& .MuiOutlinedInput-root': {

      minHeight: '50px',

      borderRadius: '6px',

      backgroundColor:
        colors.amountBg,

      '& fieldset': {
        borderColor: '#cfe2f8',
      },

      '&:hover fieldset': {
        borderColor:
          colors.primary,
      },

      '&.Mui-focused fieldset': {
        borderColor:
          colors.primary,
      },

    },

    '& .MuiInputBase-input': {

      padding:
        '12px 16px',

      color:
        colors.primary,

      fontSize:
        '19px',

      fontWeight:
        700,

    },

  };


  const itemRowStyle = {
    display: 'grid',

    gridTemplateColumns: {
      xs: '1fr',
      md: '1.1fr 1fr 1fr 1fr',
    },

    gap: {
      xs: 1,
      md: 0,
    },

    alignItems: 'center',

    minHeight: '82px',

    px: 2,

    borderLeft:
      '1px solid #d8e7f7',

    borderRight:
      '1px solid #d8e7f7',

    borderBottom:
      '1px solid #d8e7f7',
  };


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <Box
      sx={{
        minHeight: '100vh',
        background: '#ffffff',
        color: colors.text,
      }}
    >

      {/* ======================================================
          TOP HEADER
      ====================================================== */}

      <Box
        sx={{
          height: '82px',

          borderBottom:
            '1px solid #dce9f7',

          display: 'flex',

          alignItems: 'center',

          px: {
            xs: 2,
            md: 4,
          },

          gap: 2,

          background: '#ffffff',
        }}
      >

        <Box
          sx={{
            width: '42px',
            height: '42px',

            borderRadius: '7px',

            background:
              'linear-gradient(135deg, #2d86ee, #1769e0)',

            display: 'flex',

            alignItems: 'center',

            justifyContent: 'center',

            color: '#fff',
          }}
        >
          <MenuIcon />
        </Box>


        <Typography
          sx={{
            fontSize: {
              xs: '22px',
              md: '28px',
            },

            fontWeight: 700,

            color:
              colors.primaryDark,
          }}
        >
          Agent Details
        </Typography>


        <Box
          sx={{
            width: '1px',
            height: '28px',
            background: '#a9c4e5',
            mx: 1,
          }}
        />


        <Typography
          sx={{
            fontSize: {
              xs: '17px',
              md: '22px',
            },

            color:
              colors.secondaryText,

            fontWeight: 500,
          }}
        >
          Data Entry Form
        </Typography>


        <Box
          sx={{
            flex: 1,
          }}
        />


        <CalendarMonthIcon
          sx={{
            color:
              colors.secondaryText,

            display: {
              xs: 'none',
              sm: 'block',
            },
          }}
        />


        <Typography
          sx={{
            color: colors.text,

            fontSize: '16px',

            display: {
              xs: 'none',
              sm: 'block',
            },
          }}
        >
          {dayjs().format(
            'DD/MM/YYYY'
          )}
        </Typography>


        <Box
          sx={{
            width: '40px',
            height: '40px',

            borderRadius: '50%',

            background: '#e8f1fc',

            display: 'flex',

            alignItems: 'center',

            justifyContent: 'center',

            color: '#55779e',
          }}
        >
          <PersonIcon />
        </Box>

      </Box>


      {/* ======================================================
          PAGE CONTENT
      ====================================================== */}

      <Box
        sx={{
          maxWidth: '1100px',

          margin:
            '28px auto',

          px: {
            xs: 2,
            md: 0,
          },
        }}
      >

        {/* ====================================================
            AGENT INFORMATION
        ==================================================== */}

        <Paper
          sx={sectionStyle}
        >

          <Box
            sx={sectionHeaderStyle}
          >

            <PersonIcon
              sx={
                sectionIconStyle
              }
            />

            <Typography
              sx={{
                fontSize: '26px',
                fontWeight: 700,
                color: colors.text,
              }}
            >
              Agent Information
            </Typography>

          </Box>


          <Box sx={{ p: 3 }}>

            {/* Agent Dropdown */}

            <Typography
              sx={labelStyle}
            >
              Agent
            </Typography>

            <TextField
              fullWidth
              select
              value={
                selectedAgentId
              }
              onChange={
                handleAgentSelect
              }
              disabled={
                agentsLoading
              }
              sx={inputStyle}
            >

              <MenuItem value="">
                {agentsLoading
                  ? 'Loading agents...'
                  : 'Select Agent'}
              </MenuItem>

              {agents.map(
                (item) => (

                  <MenuItem
                    key={
                      item._agentId
                    }
                    value={
                      item._agentId
                    }
                  >
                    {
                      item._agentName
                    }
                  </MenuItem>

                )
              )}

            </TextField>


            {/* Agent Values */}

            <Grid
              container
              spacing={3}
              sx={{
                mt: 0.5,
              }}
            >

              {/* J INNER */}

              <Grid
                item
                xs={12}
                sm={6}
                md={3}
              >

                <Typography
                  sx={labelStyle}
                >
                  J Inner
                </Typography>

                <TextField
                  fullWidth
                  type="number"
                  value={
                    agent.jInner
                  }
                  onChange={(e) =>
                    handleAgentChange(
                      'jInner',
                      e.target.value
                    )
                  }
                  sx={inputStyle}
                />

              </Grid>


              {/* OUTER */}

              <Grid
                item
                xs={12}
                sm={6}
                md={3}
              >

                <Typography
                  sx={labelStyle}
                >
                  Outer
                </Typography>

                <TextField
                  fullWidth
                  type="number"
                  value={
                    agent.outer
                  }
                  onChange={(e) =>
                    handleAgentChange(
                      'outer',
                      e.target.value
                    )
                  }
                  sx={inputStyle}
                />

              </Grid>


              {/* DEPTH */}

              <Grid
                item
                xs={12}
                sm={6}
                md={3}
              >

                <Typography
                  sx={labelStyle}
                >
                  Depth
                </Typography>

                <TextField
                  fullWidth
                  type="number"
                  value={
                    agent.depth
                  }
                  onChange={(e) =>
                    handleAgentChange(
                      'depth',
                      e.target.value
                    )
                  }
                  sx={inputStyle}
                />

              </Grid>


              {/* TRANS */}

              <Grid
                item
                xs={12}
                sm={6}
                md={3}
              >

                <Typography
                  sx={labelStyle}
                >
                  Trans
                </Typography>

                <TextField
                  fullWidth
                  type="number"
                  value={
                    agent.trans
                  }
                  onChange={(e) =>
                    handleAgentChange(
                      'trans',
                      e.target.value
                    )
                  }
                  sx={inputStyle}
                />

              </Grid>

            </Grid>


            {/* Total */}

            <Box
              sx={{
                mt: 3,

                minHeight:
                  '58px',

                borderRadius:
                  '6px',

                background:
                  '#f0f6fd',

                border:
                  '1px solid #d7e7f8',

                display:
                  'flex',

                alignItems:
                  'center',

                px: 2,
              }}
            >

              <Typography
                sx={{
                  fontSize:
                    '20px',

                  fontWeight:
                    700,

                  color:
                    colors.text,
                }}
              >
                Total
              </Typography>


              <Box
                sx={{
                  flex: 1,
                }}
              />


              <Typography
                sx={{
                  fontSize:
                    '28px',

                  fontWeight:
                    700,

                  color:
                    colors.primary,
                }}
              >
                ₹
                {formatNumber(
                  agentTotal
                )}
              </Typography>

            </Box>

          </Box>

        </Paper>


        {/* ====================================================
            ITEM DETAILS
        ==================================================== */}

        <Paper
          sx={sectionStyle}
        >

          <Box
            sx={sectionHeaderStyle}
          >

            <Inventory2Icon
              sx={
                sectionIconStyle
              }
            />

            <Typography
              sx={{
                fontSize:
                  '26px',

                fontWeight:
                  700,

                color:
                  colors.text,
              }}
            >
              Item Details
            </Typography>

          </Box>


          <Box sx={{ p: 2 }}>

            {/* Table Header */}

            <Box
              sx={{
                display: {
                  xs: 'none',
                  md: 'grid',
                },

                gridTemplateColumns:
                  '1.1fr 1fr 1fr 1fr',

                minHeight:
                  '48px',

                alignItems:
                  'center',

                background:
                  '#f0f6fd',

                border:
                  '1px solid #d8e7f7',

                borderRadius:
                  '6px 6px 0 0',

                px: 2,
              }}
            >

              <Typography
                sx={{
                  fontSize:
                    '18px',

                  fontWeight:
                    700,

                  color:
                    '#49688f',
                }}
              >
                Item
              </Typography>


              <Typography
                sx={{
                  fontSize:
                    '18px',

                  fontWeight:
                    700,

                  color:
                    '#49688f',
                }}
              >
                Quantity
              </Typography>


              <Typography
                sx={{
                  fontSize:
                    '18px',

                  fontWeight:
                    700,

                  color:
                    '#49688f',
                }}
              >
                Rate
              </Typography>


              <Typography
                sx={{
                  fontSize:
                    '18px',

                  fontWeight:
                    700,

                  color:
                    '#49688f',
                }}
              >
                Amount
              </Typography>

            </Box>


            {/* ==================================================
                DIESEL
            ================================================== */}

            <Box sx={itemRowStyle}>

              <Typography
                sx={{
                  fontSize:
                    '19px',

                  fontWeight:
                    700,

                  color:
                    colors.text,

                  py: 1,
                }}
              >
                Diesel
              </Typography>


              <TextField
                label="Quantity"
                type="number"
                value={
                  items.diesel.quantity
                }
                onChange={(e) =>
                  handleItemChange(
                    'diesel',
                    'quantity',
                    e.target.value
                  )
                }
                sx={inputStyle}
              />


              <TextField
                label="Rate"
                type="number"
                value={
                  items.diesel.rate
                }
                onChange={(e) =>
                  handleItemChange(
                    'diesel',
                    'rate',
                    e.target.value
                  )
                }
                sx={inputStyle}
              />


              <TextField
                label="Amount"
                value={formatNumber(
                  getItemAmount(
                    'diesel'
                  )
                )}
                InputProps={{
                  readOnly: true,
                }}
                sx={
                  amountStyle
                }
              />

            </Box>


            {/* ==================================================
                JPIPE
            ================================================== */}

            <Box sx={itemRowStyle}>

              <Typography
                sx={{
                  fontSize:
                    '19px',

                  fontWeight:
                    700,

                  color:
                    colors.text,

                  py: 1,
                }}
              >
                JPipe
              </Typography>


              <TextField
                label="Quantity"
                type="number"
                value={
                  items.jPipe.quantity
                }
                onChange={(e) =>
                  handleItemChange(
                    'jPipe',
                    'quantity',
                    e.target.value
                  )
                }
                sx={inputStyle}
              />


              <TextField
                label="Rate"
                type="number"
                value={
                  items.jPipe.rate
                }
                onChange={(e) =>
                  handleItemChange(
                    'jPipe',
                    'rate',
                    e.target.value
                  )
                }
                sx={inputStyle}
              />


              <TextField
                label="Amount"
                value={formatNumber(
                  getItemAmount(
                    'jPipe'
                  )
                )}
                InputProps={{
                  readOnly: true,
                }}
                sx={
                  amountStyle
                }
              />

            </Box>


            {/* ==================================================
                OUTER
            ================================================== */}

            <Box sx={itemRowStyle}>

              <Typography
                sx={{
                  fontSize:
                    '19px',

                  fontWeight:
                    700,

                  color:
                    colors.text,

                  py: 1,
                }}
              >
                Outer
              </Typography>


              <TextField
                label="Quantity"
                type="number"
                value={
                  items.outer.quantity
                }
                onChange={(e) =>
                  handleItemChange(
                    'outer',
                    'quantity',
                    e.target.value
                  )
                }
                sx={inputStyle}
              />


              <TextField
                label="Rate"
                type="number"
                value={
                  items.outer.rate
                }
                onChange={(e) =>
                  handleItemChange(
                    'outer',
                    'rate',
                    e.target.value
                  )
                }
                sx={inputStyle}
              />


              <TextField
                label="Amount"
                value={formatNumber(
                  getItemAmount(
                    'outer'
                  )
                )}
                InputProps={{
                  readOnly: true,
                }}
                sx={
                  amountStyle
                }
              />

            </Box>


            {/* ==================================================
                BIT
            ================================================== */}

            <Box sx={itemRowStyle}>

              <Typography
                sx={{
                  fontSize:
                    '19px',

                  fontWeight:
                    700,

                  color:
                    colors.text,

                  py: 1,
                }}
              >
                Bit
              </Typography>


              <TextField
                label="Quantity"
                type="number"
                value={
                  items.bit.quantity
                }
                onChange={(e) =>
                  handleItemChange(
                    'bit',
                    'quantity',
                    e.target.value
                  )
                }
                sx={inputStyle}
              />


              <TextField
                label="Rate"
                type="number"
                value={
                  items.bit.rate
                }
                onChange={(e) =>
                  handleItemChange(
                    'bit',
                    'rate',
                    e.target.value
                  )
                }
                sx={inputStyle}
              />


              <TextField
                label="Amount"
                value={formatNumber(
                  getItemAmount(
                    'bit'
                  )
                )}
                InputProps={{
                  readOnly: true,
                }}
                sx={
                  amountStyle
                }
              />

            </Box>


            {/* ==================================================
                HAMMER
            ================================================== */}

            <Box sx={itemRowStyle}>

              <Typography
                sx={{
                  fontSize:
                    '19px',

                  fontWeight:
                    700,

                  color:
                    colors.text,

                  py: 1,
                }}
              >
                Hammer
              </Typography>


              <TextField
                label="Quantity"
                type="number"
                value={
                  items.hammer.quantity
                }
                onChange={(e) =>
                  handleItemChange(
                    'hammer',
                    'quantity',
                    e.target.value
                  )
                }
                sx={inputStyle}
              />


              <TextField
                label="Rate"
                type="number"
                value={
                  items.hammer.rate
                }
                onChange={(e) =>
                  handleItemChange(
                    'hammer',
                    'rate',
                    e.target.value
                  )
                }
                sx={inputStyle}
              />


              <TextField
                label="Amount"
                value={formatNumber(
                  getItemAmount(
                    'hammer'
                  )
                )}
                InputProps={{
                  readOnly: true,
                }}
                sx={
                  amountStyle
                }
              />

            </Box>


            {/* ==================================================
                OTHER
            ================================================== */}

            <Box sx={itemRowStyle}>

              <Typography
                sx={{
                  fontSize:
                    '19px',

                  fontWeight:
                    700,

                  color:
                    colors.text,

                  py: 1,
                }}
              >
                Other
              </Typography>


              <TextField
                label="Description"
                placeholder="Balance"
                value={
                  items.other.value
                }
                onChange={(e) =>
                  handleItemChange(
                    'other',
                    'value',
                    e.target.value
                  )
                }
                sx={{
                  ...inputStyle,

                  gridColumn: {
                    xs: 'auto',
                    md: 'span 2',
                  },
                }}
              />


              <TextField
                label="Amount"
                type="number"
                value={
                  items.other.amount
                }
                onChange={(e) =>
                  handleItemChange(
                    'other',
                    'amount',
                    e.target.value
                  )
                }
                sx={amountStyle}
              />

            </Box>


            {/* ==================================================
                AMT
            ================================================== */}

            <Box
              sx={{
                display: 'grid',

                gridTemplateColumns: {
                  xs: '1fr',
                  md: '1.1fr 1fr 1fr 1fr',
                },

                alignItems:
                  'center',

                minHeight:
                  '74px',

                px: 2,

                borderLeft:
                  '1px solid #d8e7f7',

                borderRight:
                  '1px solid #d8e7f7',

                borderBottom:
                  '1px solid #d8e7f7',

                borderRadius:
                  '0 0 6px 6px',
              }}
            >

              <Typography
                sx={{
                  fontSize:
                    '19px',

                  fontWeight:
                    700,

                  color:
                    colors.text,

                  gridColumn: {
                    xs: 'auto',
                    md: 'span 3',
                  },
                }}
              >
                AMT
              </Typography>


              <TextField
                value={formatNumber(
                  totalItemAmount
                )}
                InputProps={{
                  readOnly: true,
                }}
                sx={
                  amountStyle
                }
              />

            </Box>

          </Box>

        </Paper>


        {/* ====================================================
            ATTENDANCE
        ==================================================== */}

        <Paper
          sx={sectionStyle}
        >

          <Box
            sx={sectionHeaderStyle}
          >

            <EventAvailableIcon
              sx={
                sectionIconStyle
              }
            />

            <Typography
              sx={{
                fontSize:
                  '26px',

                fontWeight:
                  700,

                color:
                  colors.text,
              }}
            >
              Attendance
            </Typography>

          </Box>


          <Box sx={{ p: 2 }}>

            <Box
              sx={{
                mb: 2,

                p: 1.5,

                borderRadius: '6px',

                background:
                  '#f0f6fd',

                border:
                  '1px solid #d7e7f8',
              }}
            >

              <Typography
                sx={{
                  fontWeight: 600,
                  color:
                    colors.text,
                }}
              >
                Small Machine Employees
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  color:
                    colors.secondaryText,
                }}
              >
                Checked = Present&nbsp;&nbsp;|&nbsp;&nbsp;
                Unchecked = Absent
              </Typography>

            </Box>


            {attendanceLoading ? (

              <Box
                sx={{
                  display: 'flex',
                  justifyContent:
                    'center',
                  py: 3,
                }}
              >
                <CircularProgress
                  size={28}
                />
              </Box>

            ) : employees.length === 0 ? (

              <Typography
                sx={{
                  py: 2,
                  color:
                    'text.secondary',
                }}
              >
                No Small Machine employees found.
              </Typography>

            ) : (

              <Box
                sx={{
                  display:
                    'grid',

                  gridTemplateColumns: {
                    xs:
                      '1fr 1fr',
                    sm:
                      'repeat(3, 1fr)',
                    md:
                      'repeat(4, 1fr)',
                  },

                  gap: 1,
                }}
              >

                {employees.map(
                  (employee) => {

                    const employeeId =
                      String(
                        employee._id
                      );

                    const employeeName =
                      employee.name ||
                      employee.fullName ||
                      employee.username ||
                      'Employee';

                    return (

                      <Paper
                        key={
                          employeeId
                        }
                        variant="outlined"
                        sx={{
                          p: 1,

                          borderRadius:
                            '8px',

                          borderColor:
                            attendance[
                              employeeId
                            ]
                              ? '#b7e4c7'
                              : '#f3b4b4',

                          backgroundColor:
                            attendance[
                              employeeId
                            ]
                              ? '#f0fdf4'
                              : '#fff5f5',
                        }}
                      >

                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={
                                Boolean(
                                  attendance[
                                    employeeId
                                  ]
                                )
                              }
                              onChange={() =>
                                handleAttendanceChange(
                                  employeeId
                                )
                              }
                              sx={{
                                color:
                                  '#7c9bc0',

                                '&.Mui-checked':
                                  {
                                    color:
                                      '#1769e0',
                                  },
                              }}
                            />
                          }

                          label={
                            <Typography
                              sx={{
                                fontSize:
                                  '15px',

                                fontWeight:
                                  600,

                                color:
                                  colors.text,
                              }}
                            >
                              {
                                employeeName
                              }
                            </Typography>
                          }
                        />

                      </Paper>

                    );

                  }
                )}

              </Box>

            )}

          </Box>

        </Paper>


        {/* ====================================================
            SAVE
        ==================================================== */}

        <Button
          fullWidth
          variant="contained"
          onClick={
            handleSave
          }
          disabled={
            saving ||
            attendanceSaving
          }
          startIcon={
            saving ? (
              <CircularProgress
                size={20}
                color="inherit"
              />
            ) : (
              <SaveIcon />
            )
          }
          sx={{
            height:
              '62px',

            borderRadius:
              '7px',

            background:
              'linear-gradient(90deg, #287ee7 0%, #1976e8 100%)',

            fontSize:
              '21px',

            fontWeight:
              700,

            textTransform:
              'none',

            boxShadow:
              'none',

            '&:hover': {
              background:
                'linear-gradient(90deg, #1e70d7 0%, #1267d5 100%)',

              boxShadow:
                'none',
            },
          }}
        >
          {saving
            ? 'Saving...'
            : 'Save'}
        </Button>


        {/* Reset */}

        <Button
          fullWidth
          variant="outlined"
          onClick={
            handleReset
          }
          disabled={
            saving
          }
          sx={{
            mt: 1.5,
            height: '50px',
            borderRadius: '7px',
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          Reset
        </Button>

      </Box>

    </Box>
  );
};


export default BigMachine;
