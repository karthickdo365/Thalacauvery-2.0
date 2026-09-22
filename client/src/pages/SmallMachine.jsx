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
  CircularProgress,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  TextField,
  Typography,
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


// Your api.js returns response.data directly.
// This also supports normal Axios response format.
const unwrapResponse = (response) => {
  return response?.data ?? response;
};


// ============================================================
// EMPTY AGENT
// ============================================================

const EMPTY_AGENT = {
  id: '',
  name: '',
  outer: '',
  inner: '',
  smallInner: '',
  jiInner: '',
  depth: '',
  trans: '',
  total: '',
};


// ============================================================
// EMPTY ITEMS
// ============================================================

const EMPTY_ITEMS = {
  diesel: {
    quantity: '',
    rate: '',
  },

  inner: {
    quantity: '',
    rate: '',
  },

  outer: {
    quantity: '',
    rate: '',
  },

  smallInner: {
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
// SMALL MACHINE MATERIAL TYPES
// ============================================================

const MATERIAL_MAP = {
  diesel: 'Diesel',
  inner: 'Pipe Inner',
  outer: 'Pipe Outer',
  smallInner: 'Pipe Small',
  bit: 'Bit',
  hammer: 'Hammer',
  other: 'Others',
};


// ============================================================
// COMPONENT
// ============================================================

const SmallMachine = () => {

  // ==========================================================
  // AGENTS
  // ==========================================================

  const [agents, setAgents] = useState([]);

  const [agentsLoading, setAgentsLoading] =
    useState(false);

  const [selectedAgentId, setSelectedAgentId] =
    useState('');


  // ==========================================================
  // SELECTED AGENT INFORMATION
  // ==========================================================

  const [agent, setAgent] =
    useState(EMPTY_AGENT);


  // ==========================================================
  // ITEM DETAILS
  // ==========================================================

  const [items, setItems] =
    useState(EMPTY_ITEMS);


  // ==========================================================
  // SMALL MACHINE EMPLOYEES
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
  // LOAD SMALL MACHINE AGENT INFORMATION
  // ==========================================================

  const loadAgents = useCallback(
    async () => {

      try {

        setAgentsLoading(true);

        /*
         * IMPORTANT:
         *
         * This page is SMALL MACHINE.
         *
         * Therefore the Agent Information API MUST use:
         *
         * machineType: 'small'
         *
         * The old version was using 'big', which is why the
         * Small Machine agents were not appearing.
         */

        const response = await api.get(
          '/points',
          {
            params: {
              machineType: 'small',
              page: 1,
              limit: 500,
            },
          }
        );


        const data =
          unwrapResponse(response);


        /*
         * Support all common response structures.
         *
         * Example:
         *
         * {
         *   points: [...]
         * }
         *
         * OR
         *
         * [...]
         */

        let points = [];

        if (Array.isArray(data)) {

          points = data;

        } else if (
          Array.isArray(data?.points)
        ) {

          points = data.points;

        } else if (
          Array.isArray(data?.data)
        ) {

          points = data.data;

        } else if (
          Array.isArray(data?.items)
        ) {

          points = data.items;

        }


        console.log(
          'SMALL MACHINE AGENT INFORMATION:',
          points
        );


        /*
         * Keep only Small Machine records.
         */

        const smallMachinePoints =
          points.filter(
            (point) => {

              const machineType =
                String(
                  point?.machineType ||
                  ''
                )
                  .trim()
                  .toLowerCase();

              return (
                machineType === 'small'
              );
            }
          );


        /*
         * One agent can have multiple
         * Agent Information records.
         *
         * We only want one dropdown entry
         * for each agent.
         */

        const uniqueAgents =
          new Map();


        smallMachinePoints.forEach(
          (point) => {

            if (!point) {
              return;
            }


            const broker =
              point?.brokerId;


            /*
             * Agent ID
             */

            const id =
              typeof broker === 'string'
                ? broker
                : broker?._id ||
                  broker?.id ||
                  point?.broker?._id ||
                  point?._id;


            /*
             * Agent Name
             */

            const name =
              typeof broker === 'object'
                ? (
                    broker?.name ||
                    broker?.fullName ||
                    broker?.username ||
                    ''
                  )
                : (
                    point?.brokerName ||
                    point?.broker?.name ||
                    point?.agentName ||
                    point?.name ||
                    ''
                  );


            if (!id || !name) {
              return;
            }


            /*
             * Keep the entire point record.
             *
             * This is important because when the
             * user selects the Agent, we need all
             * of the saved Agent Information.
             */

            uniqueAgents.set(
              String(id),
              {
                ...point,

                _agentId:
                  String(id),

                _agentName:
                  String(name),
              }
            );

          }
        );


        const list =
          Array.from(
            uniqueAgents.values()
          ).sort(
            (a, b) =>
              String(
                a?._agentName || ''
              ).localeCompare(
                String(
                  b?._agentName || ''
                )
              )
          );


        console.log(
          'SMALL MACHINE AGENTS:',
          list
        );


        setAgents(list);

      } catch (error) {

        console.error(
          'Load Small Machine Agent Information error:',
          error
        );

        setAgents([]);

        toast.error(
          error?.response?.data?.message ||
          error?.message ||
          'Failed to load Small Machine Agent Information'
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
         * Existing project employee data is under
         * /users.
         *
         * This page needs Small Machine employees.
         */

        const response =
          await api.get(
            '/users',
            {
              params: {
                machineType: 'small',
              },
            }
          );


        const data =
          unwrapResponse(response);


        let employeeList = [];


        if (Array.isArray(data)) {

          employeeList = data;

        } else if (
          Array.isArray(data?.users)
        ) {

          employeeList = data.users;

        } else if (
          Array.isArray(data?.employees)
        ) {

          employeeList = data.employees;

        } else if (
          Array.isArray(data?.data)
        ) {

          employeeList = data.data;

        } else if (
          Array.isArray(data?.records)
        ) {

          employeeList = data.records;

        }


        /*
         * Remove broker / partner records.
         */

        employeeList =
          employeeList.filter(
            (employee) => {

              const role =
                String(
                  employee?.role ||
                  employee?.type ||
                  employee?.userType ||
                  ''
                )
                  .trim()
                  .toLowerCase();

              return (
                role !== 'broker' &&
                role !== 'partner'
              );

            }
          );


        console.log(
          'SMALL MACHINE EMPLOYEES:',
          employeeList
        );


        setEmployees(
          employeeList
        );


        /*
         * Everyone is PRESENT by default.
         */

        const initialAttendance = {};


        employeeList.forEach(
          (employee) => {

            const id =
              employee?._id ||
              employee?.id;


            if (id) {

              initialAttendance[
                String(id)
              ] = true;

            }

          }
        );


        setAttendance(
          initialAttendance
        );

      } catch (error) {

        console.error(
          'Load Small Machine employees error:',
          error
        );

        setEmployees([]);

        setAttendance({});

        toast.error(
          error?.response?.data?.message ||
          error?.message ||
          'Failed to load Small Machine employees'
        );

      } finally {

        setAttendanceLoading(false);

      }

    },
    []
  );


  // ==========================================================
  // LOAD TODAY ATTENDANCE
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


          let records = [];


          if (Array.isArray(data)) {

            records = data;

          } else if (
            Array.isArray(data?.records)
          ) {

            records = data.records;

          } else if (
            Array.isArray(data?.attendance)
          ) {

            records = data.attendance;

          } else if (
            Array.isArray(data?.data)
          ) {

            records = data.data;

          }


          setAttendanceRecords(
            records
          );


          /*
           * Existing attendance overrides
           * the default Present state.
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
                      record?.employeeId?._id ||
                      record?.employeeId ||
                      record?.userId?._id ||
                      record?.userId;


                    if (!employeeId) {
                      return;
                    }


                    const status =
                      String(
                        record?.status ||
                        record?.attendanceStatus ||
                        ''
                      )
                        .trim()
                        .toLowerCase();


                    next[
                      String(employeeId)
                    ] =
                      status !== 'absent';

                  }
                );


                return next;

              }
            );

          }

        } catch (error) {

          console.error(
            'Load Small Machine attendance error:',
            error
          );

          /*
           * Attendance loading should not
           * stop Agent Information from working.
           */

        }

      },
      []
    );


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(
    () => {

      loadAgents();

      loadEmployees();

    },
    [
      loadAgents,
      loadEmployees,
    ]
  );


  // ==========================================================
  // LOAD ATTENDANCE AFTER EMPLOYEES
  // ==========================================================

  useEffect(
    () => {

      if (
        employees.length > 0
      ) {

        loadTodayAttendance();

      }

    },
    [
      employees.length,
      loadTodayAttendance,
    ]
  );


  // ==========================================================
  // AGENT SELECTION
  // ==========================================================

  const handleAgentSelect =
    (event) => {

      const id =
        event.target.value;


      setSelectedAgentId(
        id
      );


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
              item?._agentId
            ) === String(id)
        );


      if (!selected) {
        return;
      }


      /*
       * --------------------------------------------------------
       * SMALL MACHINE AGENT INFORMATION
       * --------------------------------------------------------
       *
       * Existing Agent Information uses:
       *
       * outerPipe
       * innerPipe
       * smallInnerPipe
       * jiInner
       * depthDetails
       *
       * We support those structures here.
       */


      const outer =
        selected?.outer ??
        selected?.outerPipe?.rate ??
        selected?.outerPipe ??
        '';


      const inner =
        selected?.inner ??
        selected?.innerPipe?.rate ??
        selected?.innerPipe ??
        '';


      const smallInner =
        selected?.smallInner ??
        selected?.smallInnerPipe?.rate ??
        selected?.smallInnerPipe ??
        '';


      const jiInner =
        selected?.jiInner ??
        selected?.jiInnerPipe?.rate ??
        selected?.jiInnerPipe ??
        '';


      /*
       * Depth can either be stored directly
       * or inside depthDetails.
       */

      let depth =
        selected?.depth ??
        selected?.depthFeet ??
        '';


      /*
       * Do NOT blindly add all depth rates if
       * there is no direct depth value.
       *
       * Agent Information stores depth rate-card
       * details. We only use the direct depth
       * when it exists.
       */

      if (
        depth === null ||
        depth === undefined
      ) {

        depth = '';

      }


      const trans =
        selected?.trans ??
        selected?.transport ??
        selected?.transportAmount ??
        '';


      /*
       * Stored total.
       */

      const savedTotal =
        selected?.agentTotal ??
        selected?.totalAmount ??
        selected?.total ??
        '';


      /*
       * Fallback total.
       */

      const calculatedTotal =
        toNumber(outer) +
        toNumber(inner) +
        toNumber(smallInner) +
        toNumber(jiInner) +
        toNumber(depth) +
        toNumber(trans);


      const total =
        savedTotal !== '' &&
        savedTotal !== null &&
        savedTotal !== undefined
          ? savedTotal
          : calculatedTotal;


      setAgent(
        {
          id:
            selected?._agentId || '',

          name:
            selected?._agentName || '',

          outer,

          inner,

          smallInner,

          jiInner,

          depth,

          trans,

          total,
        }
      );

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
    useMemo(
      () => {

        const calculated =
          toNumber(agent.outer) +
          toNumber(agent.inner) +
          toNumber(agent.smallInner) +
          toNumber(agent.jiInner) +
          toNumber(agent.depth) +
          toNumber(agent.trans);


        /*
         * If the selected Agent Information
         * contains a saved total, preserve it
         * until the user changes values.
         */

        if (
          agent.total !== '' &&
          agent.total !== null &&
          agent.total !== undefined
        ) {

          const originalTotal =
            toNumber(
              agent.total
            );


          if (
            calculated !==
            originalTotal
          ) {

            return calculated;

          }


          return originalTotal;

        }


        return calculated;

      },
      [
        agent.outer,
        agent.inner,
        agent.smallInner,
        agent.jiInner,
        agent.depth,
        agent.trans,
        agent.total,
      ]
    );


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

      if (
        item === 'other'
      ) {

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
    useMemo(
      () => {

        return (
          getItemAmount('diesel') +
          getItemAmount('inner') +
          getItemAmount('outer') +
          getItemAmount('smallInner') +
          getItemAmount('bit') +
          getItemAmount('hammer') +
          getItemAmount('other')
        );

      },
      [items]
    );


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
       * OTHER MATERIAL
       */

      if (
        itemKey === 'other'
      ) {

        const amount =
          toNumber(
            item?.amount
          );


        const description =
          String(
            item?.value || ''
          ).trim();


        /*
         * Nothing entered.
         */

        if (
          !description &&
          amount <= 0
        ) {

          return;

        }


        if (!description) {

          throw new Error(
            'Other material description is required'
          );

        }


        if (amount <= 0) {

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


        /*
         * SMALL MACHINE
         */

        form.append(
          'machineType',
          'small'
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
          item?.quantity
        );


      const rate =
        toNumber(
          item?.rate
        );


      /*
       * If nothing entered, do not
       * create an empty material.
       */

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


      /*
       * SMALL MACHINE
       */

      form.append(
        'machineType',
        'small'
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
       * Existing records indexed by employee.
       */

      const existingByEmployee =
        new Map();


      attendanceRecords.forEach(
        (record) => {

          const employeeId =
            record?.employeeId?._id ||
            record?.employeeId ||
            record?.userId?._id ||
            record?.userId;


          if (employeeId) {

            existingByEmployee.set(
              String(employeeId),
              record
            );

          }

        }
      );


      const requests =
        employees.map(
          async (
            employee
          ) => {

            const employeeId =
              String(
                employee?._id ||
                employee?.id
              );


            if (
              !employeeId ||
              employeeId === 'undefined'
            ) {

              return;

            }


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
         * ------------------------------------------------------
         * 1. SAVE MATERIALS
         * ------------------------------------------------------
         */

        const materialKeys = [
          'diesel',
          'inner',
          'outer',
          'smallInner',
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
         * ------------------------------------------------------
         * 2. SAVE ATTENDANCE
         * ------------------------------------------------------
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
         * ------------------------------------------------------
         * 3. DATA OBJECT
         * ------------------------------------------------------
         */

        const saveData = {

          machineType:
            'small',

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
              (employee) => {

                const employeeId =
                  employee?._id ||
                  employee?.id;


                return {

                  employeeId,

                  employeeName:
                    employee?.name ||
                    employee?.fullName ||
                    employee?.username ||
                    'Employee',

                  status:
                    attendance[
                      String(employeeId)
                    ]
                      ? 'present'
                      : 'absent',

                };

              }
            ),

        };


        console.log(
          'SMALL MACHINE DATA:',
          saveData
        );


        toast.success(
          'Small Machine data saved successfully'
        );


      } catch (error) {

        console.error(
          'Small Machine save error:',
          error
        );


        toast.error(
          error?.response?.data?.message ||
          error?.message ||
          'Failed to save Small Machine data'
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

      setSelectedAgentId(
        ''
      );


      setAgent(
        EMPTY_AGENT
      );


      setItems(
        {
          ...EMPTY_ITEMS,
          diesel: {
            ...EMPTY_ITEMS.diesel,
          },
          inner: {
            ...EMPTY_ITEMS.inner,
          },
          outer: {
            ...EMPTY_ITEMS.outer,
          },
          smallInner: {
            ...EMPTY_ITEMS.smallInner,
          },
          bit: {
            ...EMPTY_ITEMS.bit,
          },
          hammer: {
            ...EMPTY_ITEMS.hammer,
          },
          other: {
            ...EMPTY_ITEMS.other,
          },
        }
      );


      /*
       * Everyone checked again.
       */

      const resetAttendance =
        {};


      employees.forEach(
        (employee) => {

          const id =
            employee?._id ||
            employee?.id;


          if (id) {

            resetAttendance[
              String(id)
            ] = true;

          }

        }
      );


      setAttendance(
        resetAttendance
      );

    };


  // ==========================================================
  // COLORS
  // ==========================================================

  const colors = {

    primary:
      '#1769e0',

    primaryDark:
      '#12366b',

    border:
      '#c9def7',

    inputBg:
      '#ffffff',

    amountBg:
      '#f0f6ff',

    text:
      '#102f5f',

    secondaryText:
      '#45658f',

  };


  // ==========================================================
  // SECTION STYLE
  // ==========================================================

  const sectionStyle = {

    border:
      `1px solid ${colors.border}`,

    borderRadius:
      '8px',

    overflow:
      'hidden',

    background:
      '#fff',

    marginBottom:
      '20px',

    boxShadow:
      'none',

  };


  const sectionHeaderStyle = {

    minHeight:
      {
        xs: '58px',
        sm: '66px',
      },

    display:
      'flex',

    alignItems:
      'center',

    gap:
      {
        xs: '10px',
        sm: '16px',
      },

    padding:
      {
        xs: '0 14px',
        sm: '0 24px',
      },

    background:
      'linear-gradient(90deg, #f2f8ff 0%, #f8fbff 100%)',

    borderBottom:
      `1px solid ${colors.border}`,

  };


  const sectionIconStyle = {

    width:
      {
        xs: '30px',
        sm: '36px',
      },

    height:
      {
        xs: '30px',
        sm: '36px',
      },

    color:
      colors.primary,

  };


  const labelStyle = {

    color:
      colors.text,

    fontSize:
      {
        xs: '15px',
        sm: '18px',
      },

    fontWeight:
      600,

    marginBottom:
      '7px',

  };


  const inputStyle = {

    width:
      '100%',

    '& .MuiOutlinedInput-root': {

      minHeight:
        {
          xs: '46px',
          sm: '50px',
        },

      borderRadius:
        '6px',

      backgroundColor:
        colors.inputBg,

      fontSize:
        {
          xs: '16px',
          sm: '18px',
        },

      color:
        colors.text,

      '& fieldset': {

        borderColor:
          '#bfd4ee',

        borderWidth:
          '1px',

      },

      '&:hover fieldset': {

        borderColor:
          colors.primary,

      },

      '&.Mui-focused fieldset': {

        borderColor:
          colors.primary,

        borderWidth:
          '2px',

      },

    },

    '& .MuiInputBase-input': {

      padding:
        {
          xs: '10px 12px',
          sm: '12px 16px',
        },

      color:
        colors.text,

    },

  };


  const amountStyle = {

    width:
      '100%',

    '& .MuiOutlinedInput-root': {

      minHeight:
        {
          xs: '46px',
          sm: '50px',
        },

      borderRadius:
        '6px',

      backgroundColor:
        colors.amountBg,

      '& fieldset': {

        borderColor:
          '#cfe2f8',

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
        {
          xs: '10px 12px',
          sm: '12px 16px',
        },

      color:
        colors.primary,

      fontSize:
        {
          xs: '17px',
          sm: '19px',
        },

      fontWeight:
        700,

    },

  };


  // ==========================================================
  // ITEM ROW
  // ==========================================================

  const itemRowStyle = {

    display:
      'grid',

    gridTemplateColumns:
      {
        xs: '1fr',
        sm: '1.1fr 1fr 1fr 1fr',
      },

    gap:
      {
        xs: 1.5,
        sm: 1,
      },

    alignItems:
      'center',

    minHeight:
      {
        xs: 'auto',
        sm: '82px',
      },

    px:
      {
        xs: 1.5,
        sm: 2,
      },

    py:
      {
        xs: 1.5,
        sm: 0,
      },

    borderLeft:
      '1px solid #d8e7f7',

    borderRight:
      '1px solid #d8e7f7',

    borderBottom:
      '1px solid #d8e7f7',

    background:
      '#fff',

  };


  // ==========================================================
  // ITEM COMPONENT
  // ==========================================================

  const renderNormalItem = (
    itemKey,
    label
  ) => {

    return (

      <Box
        sx={itemRowStyle}
        key={itemKey}
      >

        <Typography
          sx={{
            fontSize:
              {
                xs: '17px',
                sm: '19px',
              },

            fontWeight:
              700,

            color:
              colors.text,

            py:
              {
                xs: 0,
                sm: 1,
              },
          }}
        >
          {label}
        </Typography>


        <TextField
          label="Quantity"
          type="number"
          fullWidth
          value={
            items[itemKey]?.quantity || ''
          }
          onChange={
            (e) =>
              handleItemChange(
                itemKey,
                'quantity',
                e.target.value
              )
          }
          sx={
            inputStyle
          }
        />


        <TextField
          label="Rate"
          type="number"
          fullWidth
          value={
            items[itemKey]?.rate || ''
          }
          onChange={
            (e) =>
              handleItemChange(
                itemKey,
                'rate',
                e.target.value
              )
          }
          sx={
            inputStyle
          }
        />


        <TextField
          label="Amount"
          fullWidth
          value={
            formatNumber(
              getItemAmount(
                itemKey
              )
            )
          }
          InputProps={{
            readOnly:
              true,
          }}
          sx={
            amountStyle
          }
        />

      </Box>

    );

  };


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <Box
      sx={{

        minHeight:
          '100vh',

        width:
          '100%',

        background:
          '#ffffff',

        color:
          colors.text,

        overflowX:
          'hidden',

      }}
    >

      {/* ======================================================
          TOP HEADER
      ====================================================== */}

      <Box
        sx={{

          minHeight:
            {
              xs: '64px',
              sm: '82px',
            },

          borderBottom:
            '1px solid #dce9f7',

          display:
            'flex',

          alignItems:
            'center',

          px:
            {
              xs: 1.5,
              sm: 4,
            },

          gap:
            {
              xs: 1,
              sm: 2,
            },

          background:
            '#ffffff',

        }}
      >

        <Box
          sx={{

            width:
              {
                xs: '38px',
                sm: '42px',
              },

            height:
              {
                xs: '38px',
                sm: '42px',
              },

            flexShrink:
              0,

            borderRadius:
              '7px',

            background:
              'linear-gradient(135deg, #2d86ee, #1769e0)',

            display:
              'flex',

            alignItems:
              'center',

            justifyContent:
              'center',

            color:
              '#fff',

          }}
        >

          <MenuIcon />

        </Box>


        <Typography
          sx={{

            fontSize:
              {
                xs: '19px',
                sm: '28px',
              },

            fontWeight:
              700,

            color:
              colors.primaryDark,

            whiteSpace:
              'nowrap',

          }}
        >
          Agent Details
        </Typography>


        <Box
          sx={{

            width:
              '1px',

            height:
              '28px',

            background:
              '#a9c4e5',

            mx:
              {
                xs: 0.5,
                sm: 1,
              },

          }}
        />


        <Typography
          sx={{

            fontSize:
              {
                xs: '14px',
                sm: '22px',
              },

            color:
              colors.secondaryText,

            fontWeight:
              500,

            whiteSpace:
              'nowrap',

          }}
        >
          Small Machine
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

            display:
              {
                xs: 'none',
                sm: 'block',
              },
          }}
        />


        <Typography
          sx={{

            color:
              colors.text,

            fontSize:
              '16px',

            display:
              {
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

            width:
              {
                xs: '36px',
                sm: '40px',
              },

            height:
              {
                xs: '36px',
                sm: '40px',
              },

            borderRadius:
              '50%',

            background:
              '#e8f1fc',

            display:
              'flex',

            alignItems:
              'center',

            justifyContent:
              'center',

            color:
              '#55779e',

            flexShrink:
              0,

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

          width:
            '100%',

          maxWidth:
            '1100px',

          margin:
            '0 auto',

          px:
            {
              xs: 1.25,
              sm: 2,
              md: 0,
            },

          py:
            {
              xs: 1.5,
              sm: 3.5,
            },

        }}
      >


        {/* ====================================================
            AGENT INFORMATION
        ==================================================== */}

        <Paper
          sx={
            sectionStyle
          }
        >

          <Box
            sx={
              sectionHeaderStyle
            }
          >

            <PersonIcon
              sx={
                sectionIconStyle
              }
            />


            <Typography
              sx={{

                fontSize:
                  {
                    xs: '19px',
                    sm: '26px',
                  },

                fontWeight:
                  700,

                color:
                  colors.text,

              }}
            >
              Agent Information
            </Typography>

          </Box>


          <Box
            sx={{
              p:
                {
                  xs: 1.5,
                  sm: 3,
                },
            }}
          >

            {/* AGENT DROPDOWN */}

            <Typography
              sx={
                labelStyle
              }
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
              sx={
                inputStyle
              }
            >

              <MenuItem value="">
                {agentsLoading
                  ? 'Loading Small Machine agents...'
                  : agents.length === 0
                    ? 'No Small Machine agents found'
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


            {/* AGENT VALUES */}

            <Grid
              container
              spacing={
                {
                  xs: 1.5,
                  sm: 3,
                }
              }
              sx={{
                mt:
                  0.5,
              }}
            >

              {/* OUTER */}

              <Grid
                item
                xs={12}
                sm={6}
                md={3}
              >

                <Typography
                  sx={
                    labelStyle
                  }
                >
                  Outer
                </Typography>


                <TextField
                  fullWidth
                  type="number"
                  value={
                    agent.outer
                  }
                  onChange={
                    (e) =>
                      handleAgentChange(
                        'outer',
                        e.target.value
                      )
                  }
                  sx={
                    inputStyle
                  }
                />

              </Grid>


              {/* INNER */}

              <Grid
                item
                xs={12}
                sm={6}
                md={3}
              >

                <Typography
                  sx={
                    labelStyle
                  }
                >
                  Inner
                </Typography>


                <TextField
                  fullWidth
                  type="number"
                  value={
                    agent.inner
                  }
                  onChange={
                    (e) =>
                      handleAgentChange(
                        'inner',
                        e.target.value
                      )
                  }
                  sx={
                    inputStyle
                  }
                />

              </Grid>


              {/* SMALL INNER */}

              <Grid
                item
                xs={12}
                sm={6}
                md={3}
              >

                <Typography
                  sx={
                    labelStyle
                  }
                >
                  Small Inner
                </Typography>


                <TextField
                  fullWidth
                  type="number"
                  value={
                    agent.smallInner
                  }
                  onChange={
                    (e) =>
                      handleAgentChange(
                        'smallInner',
                        e.target.value
                      )
                  }
                  sx={
                    inputStyle
                  }
                />

              </Grid>


              {/* JI INNER */}

              <Grid
                item
                xs={12}
                sm={6}
                md={3}
              >

                <Typography
                  sx={
                    labelStyle
                  }
                >
                  JI Inner
                </Typography>


                <TextField
                  fullWidth
                  type="number"
                  value={
                    agent.jiInner
                  }
                  onChange={
                    (e) =>
                      handleAgentChange(
                        'jiInner',
                        e.target.value
                      )
                  }
                  sx={
                    inputStyle
                  }
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
                  sx={
                    labelStyle
                  }
                >
                  Depth
                </Typography>


                <TextField
                  fullWidth
                  type="number"
                  value={
                    agent.depth
                  }
                  onChange={
                    (e) =>
                      handleAgentChange(
                        'depth',
                        e.target.value
                      )
                  }
                  sx={
                    inputStyle
                  }
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
                  sx={
                    labelStyle
                  }
                >
                  Trans
                </Typography>


                <TextField
                  fullWidth
                  type="number"
                  value={
                    agent.trans
                  }
                  onChange={
                    (e) =>
                      handleAgentChange(
                        'trans',
                        e.target.value
                      )
                  }
                  sx={
                    inputStyle
                  }
                />

              </Grid>

            </Grid>


            {/* TOTAL */}

            <Box
              sx={{

                mt:
                  2,

                minHeight:
                  {
                    xs: '54px',
                    sm: '58px',
                  },

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

                px:
                  {
                    xs: 1.5,
                    sm: 2,
                  },

              }}
            >

              <Typography
                sx={{

                  fontSize:
                    {
                      xs: '17px',
                      sm: '20px',
                    },

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
                    {
                      xs: '21px',
                      sm: '28px',
                    },

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
          sx={
            sectionStyle
          }
        >

          <Box
            sx={
              sectionHeaderStyle
            }
          >

            <Inventory2Icon
              sx={
                sectionIconStyle
              }
            />


            <Typography
              sx={{

                fontSize:
                  {
                    xs: '19px',
                    sm: '26px',
                  },

                fontWeight:
                  700,

                color:
                  colors.text,

              }}
            >
              Item Details
            </Typography>

          </Box>


          <Box
            sx={{
              p:
                {
                  xs: 1,
                  sm: 2,
                },
            }}
          >

            {/* TABLE HEADER */}

            <Box
              sx={{

                display:
                  {
                    xs: 'none',
                    sm: 'grid',
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

                px:
                  2,

              }}
            >

              <Typography
                sx={{
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
                  fontWeight:
                    700,
                  color:
                    '#49688f',
                }}
              >
                Amount
              </Typography>

            </Box>


            {/* DIESEL */}

            {renderNormalItem(
              'diesel',
              'Diesel'
            )}


            {/* INNER */}

            {renderNormalItem(
              'inner',
              'Inner'
            )}


            {/* OUTER */}

            {renderNormalItem(
              'outer',
              'Outer'
            )}


            {/* SMALL INNER */}

            {renderNormalItem(
              'smallInner',
              'Small Inner'
            )}


            {/* BIT */}

            {renderNormalItem(
              'bit',
              'Bit'
            )}


            {/* HAMMER */}

            {renderNormalItem(
              'hammer',
              'Hammer'
            )}


            {/* OTHER */}

            <Box
              sx={{

                display:
                  'grid',

                gridTemplateColumns:
                  {
                    xs: '1fr',
                    sm: '1.1fr 1fr 1fr 1fr',
                  },

                gap:
                  {
                    xs: 1.5,
                    sm: 1,
                  },

                alignItems:
                  'center',

                minHeight:
                  {
                    xs: 'auto',
                    sm: '82px',
                  },

                px:
                  {
                    xs: 1.5,
                    sm: 2,
                  },

                py:
                  {
                    xs: 1.5,
                    sm: 1,
                  },

                border:
                  '1px solid #d8e7f7',

                borderTop:
                  'none',

                borderRadius:
                  {
                    xs: '0 0 6px 6px',
                    sm: '0 0 6px 6px',
                  },

              }}
            >

              <Typography
                sx={{

                  fontSize:
                    {
                      xs: '17px',
                      sm: '19px',
                    },

                  fontWeight:
                    700,

                  color:
                    colors.text,

                }}
              >
                Other
              </Typography>


              <TextField
                label="Description"
                placeholder="Balance"
                fullWidth
                value={
                  items.other.value
                }
                onChange={
                  (e) =>
                    handleItemChange(
                      'other',
                      'value',
                      e.target.value
                    )
                }
                sx={{
                  ...inputStyle,

                  gridColumn:
                    {
                      xs: 'auto',
                      sm: 'span 2',
                    },
                }}
              />


              <TextField
                label="Amount"
                type="number"
                fullWidth
                value={
                  items.other.amount
                }
                onChange={
                  (e) =>
                    handleItemChange(
                      'other',
                      'amount',
                      e.target.value
                    )
                }
                sx={
                  amountStyle
                }
              />

            </Box>


            {/* TOTAL AMOUNT */}

            <Box
              sx={{

                display:
                  'grid',

                gridTemplateColumns:
                  {
                    xs: '1fr',
                    sm: '1.1fr 1fr 1fr 1fr',
                  },

                gap:
                  {
                    xs: 1,
                    sm: 0,
                  },

                alignItems:
                  'center',

                minHeight:
                  {
                    xs: '80px',
                    sm: '74px',
                  },

                px:
                  {
                    xs: 1.5,
                    sm: 2,
                  },

                border:
                  '1px solid #d8e7f7',

                borderTop:
                  'none',

                borderRadius:
                  '0 0 6px 6px',

              }}
            >

              <Typography
                sx={{

                  fontSize:
                    {
                      xs: '18px',
                      sm: '19px',
                    },

                  fontWeight:
                    700,

                  color:
                    colors.text,

                  gridColumn:
                    {
                      xs: 'auto',
                      sm: 'span 3',
                    },

                }}
              >
                AMT
              </Typography>


              <TextField
                fullWidth
                value={
                  formatNumber(
                    totalItemAmount
                  )
                }
                InputProps={{
                  readOnly:
                    true,
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
          sx={
            sectionStyle
          }
        >

          <Box
            sx={
              sectionHeaderStyle
            }
          >

            <EventAvailableIcon
              sx={
                sectionIconStyle
              }
            />


            <Typography
              sx={{

                fontSize:
                  {
                    xs: '19px',
                    sm: '26px',
                  },

                fontWeight:
                  700,

                color:
                  colors.text,

              }}
            >
              Attendance
            </Typography>

          </Box>


          <Box
            sx={{
              p:
                {
                  xs: 1.25,
                  sm: 2,
                },
            }}
          >

            {/* ATTENDANCE INFO */}

            <Box
              sx={{

                mb:
                  2,

                p:
                  {
                    xs: 1.25,
                    sm: 1.5,
                  },

                borderRadius:
                  '6px',

                background:
                  '#f0f6fd',

                border:
                  '1px solid #d7e7f8',

              }}
            >

              <Typography
                sx={{
                  fontWeight:
                    600,

                  color:
                    colors.text,

                  fontSize:
                    {
                      xs: '15px',
                      sm: '16px',
                    },
                }}
              >
                Small Machine Employees
              </Typography>


              <Typography
                variant="body2"
                sx={{

                  mt:
                    0.5,

                  color:
                    colors.secondaryText,

                  fontSize:
                    {
                      xs: '13px',
                      sm: '14px',
                    },

                }}
              >
                Checked = Present&nbsp;&nbsp;|&nbsp;&nbsp;
                Unchecked = Absent
              </Typography>

            </Box>


            {/* LOADING */}

            {attendanceLoading ? (

              <Box
                sx={{

                  display:
                    'flex',

                  justifyContent:
                    'center',

                  py:
                    3,

                }}
              >

                <CircularProgress
                  size={28}
                />

              </Box>

            ) : employees.length === 0 ? (

              <Typography
                sx={{
                  py:
                    2,

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

                  gridTemplateColumns:
                    {
                      xs: '1fr',
                      sm: 'repeat(2, 1fr)',
                      md: 'repeat(4, 1fr)',
                    },

                  gap:
                    {
                      xs: 1,
                      sm: 1.5,
                    },

                }}
              >

                {employees.map(
                  (employee) => {

                    const employeeId =
                      String(
                        employee?._id ||
                        employee?.id
                      );


                    const employeeName =
                      employee?.name ||
                      employee?.fullName ||
                      employee?.username ||
                      'Employee';


                    const present =
                      Boolean(
                        attendance[
                          employeeId
                        ]
                      );


                    return (

                      <Paper
                        key={
                          employeeId
                        }
                        variant="outlined"
                        sx={{

                          p:
                            {
                              xs: 0.75,
                              sm: 1,
                            },

                          borderRadius:
                            '8px',

                          borderColor:
                            present
                              ? '#b7e4c7'
                              : '#f3b4b4',

                          backgroundColor:
                            present
                              ? '#f0fdf4'
                              : '#fff5f5',

                          minWidth:
                            0,

                        }}
                      >

                        <FormControlLabel
                          sx={{
                            width:
                              '100%',

                            m:
                              0,

                            '& .MuiFormControlLabel-label':
                              {
                                minWidth:
                                  0,
                              },
                          }}
                          control={

                            <Checkbox
                              checked={
                                present
                              }
                              onChange={
                                () =>
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
                                  {
                                    xs: '14px',
                                    sm: '15px',
                                  },

                                fontWeight:
                                  600,

                                color:
                                  colors.text,

                                overflow:
                                  'hidden',

                                textOverflow:
                                  'ellipsis',

                                whiteSpace:
                                  'nowrap',

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
            SAVE BUTTON
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
              {
                xs: '54px',
                sm: '62px',
              },

            borderRadius:
              '7px',

            background:
              'linear-gradient(90deg, #287ee7 0%, #1976e8 100%)',

            fontSize:
              {
                xs: '18px',
                sm: '21px',
              },

            fontWeight:
              700,

            textTransform:
              'none',

            boxShadow:
              'none',

            '&:hover':
              {
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


        {/* ====================================================
            RESET
        ==================================================== */}

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

            mt:
              1.5,

            height:
              {
                xs: '48px',
                sm: '50px',
              },

            borderRadius:
              '7px',

            textTransform:
              'none',

            fontWeight:
              600,

          }}
        >
          Reset
        </Button>


        {/* BOTTOM SPACE ON MOBILE */}

        <Box
          sx={{
            height:
              {
                xs: '20px',
                sm: '30px',
              },
          }}
        />

      </Box>

    </Box>

  );

};


export default SmallMachine;
