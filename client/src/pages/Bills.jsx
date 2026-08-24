import { useState, useEffect, useCallback } from 'react';
import { useMachine } from '../context/MachineContext';
import { useForm, Controller } from 'react-hook-form';

import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  MenuItem,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TablePagination,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tooltip,
  Popover,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ReceiptIcon from '@mui/icons-material/Receipt';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

import { DatePicker } from '@mui/x-date-pickers';

import dayjs from 'dayjs';
import { toast } from 'react-toastify';

import api from '../utils/api';

import PageHeader from '../components/PageHeader';
import ConfirmDialog from '../components/ConfirmDialog';

import usePermissions from '../hooks/usePermissions';

import {
  NAVY,
  TEAL,
  TEAL_DARK,
  toNum,
  fmtINR,
  statusColor,
  machineChipSx,
  SMALL_PIPES,
  BIG_PIPES,
  SMALL_DEPTH_SLABS,
  BIG_DEPTH_SLABS,
} from '../utils/constants';


// ============================================================
// SERVICE TYPES
// ============================================================

const SERVICE_TYPES = [
  'Point',
  'Flushing',
  'Rod Flushing',
];

// Big Machine does NOT use JI Outer.
const BIG_PIPES_NO_JI_OUTER = BIG_PIPES.filter(
  ({ rateKey }) => rateKey !== 'jiOuter'
);


// ============================================================
// DEPTH CALCULATION
// ============================================================

const calcDepthSlab = (
  totalFeet,
  depthDetails = [],
  slabDefs
) => {
  const f = toNum(totalFeet);

  if (!f || f <= 0) {
    return {
      slabBreakdown: [],
      depthAmt: 0,
    };
  }

  let depthAmt = 0;

  const slabBreakdown = [];

  for (const slab of slabDefs) {
    if (slab.from >= f) {
      break;
    }

    const slabEnd = Math.min(
      slab.to,
      f
    );

    const feetInSlab =
      slabEnd - slab.from;

    const rate = toNum(
      depthDetails.find(
        (d) =>
          d.range === slab.range
      )?.rate
    );

    const amt =
      feetInSlab * rate;

    depthAmt += amt;

    slabBreakdown.push({
      range: slab.range,
      feet: feetInSlab,
      rate,
      amt,
    });
  }

  return {
    slabBreakdown,
    depthAmt,
  };
};


// ============================================================
// BILL CALCULATION
// ============================================================

const computeBreakdown = (
  values,
  agentRates
) => {
  if (!agentRates) {
    return null;
  }

  const isBig =
    values.machineType === 'big';

  const pipes = isBig
    ? BIG_PIPES_NO_JI_OUTER
    : SMALL_PIPES;

  const slabs = isBig
    ? BIG_DEPTH_SLABS
    : SMALL_DEPTH_SLABS;

  let pipeAmt = 0;

  for (
    const {
      rateKey,
      feetKey,
    } of pipes
  ) {
    pipeAmt +=
      toNum(values[feetKey]) *
      toNum(
        agentRates[
          rateKey
        ]?.rate
      );
  }

  const {
    slabBreakdown,
    depthAmt,
  } =
    calcDepthSlab(
      values.depthFeet,
      agentRates.depthDetails || [],
      slabs
    );

  const flushingAmt =
    values.serviceType ===
    'Flushing'
      ? toNum(
          values.flushingAmount
        )
      : 0;

  const rodFlushingAmt =
    values.serviceType ===
    'Rod Flushing'
      ? toNum(
          values.rodFlushingAmount
        )
      : 0;

  const serviceAmt =
    flushingAmt +
    rodFlushingAmt;

  const subtotal =
    pipeAmt +
    depthAmt +
    serviceAmt;

  // Discount is deducted; other amount is added.
  const discountAmount = Math.max(
    0,
    toNum(values.discountAmount)
  );

  const otherAmount = Math.max(
    0,
    toNum(values.otherAmount)
  );

  const grandTotal = Math.max(
    0,
    subtotal +
    otherAmount -
    discountAmount
  );

  return {
    pipeAmt,
    depthAmt,
    slabBreakdown,
    flushingAmt,
    rodFlushingAmt,
    serviceAmt,
    subtotal,
    discountAmount,
    otherAmount,
    grandTotal,
    machineType:
      values.machineType,
  };
};


// ============================================================
// FORM DEFAULTS
// ============================================================

const getDefaultValues = (
  machineType
) => ({
  date: dayjs(),

  // IMPORTANT:
  // Machine comes from MachineContext.
  machineType,

  brokerId: '',

  partyName: '',

  outerPipeFeet: '',

  innerPipeFeet: '',

  smallPipeFeet: '',

  plasticOuterFeet: '',

  plasticInnerFeet: '',

  jiInnerFeet: '',

  depthFeet: '',

  // Point is the normal service.
  // Flushing and Rod Flushing can still be selected manually when needed.
  serviceType: 'Point',

  flushingAmount: '',

  rodFlushingAmount: '',

  discountAmount: '',
  otherAmount: '',

  paymentStatus: 'Unpaid',

  amountPaid: '',
});


// ============================================================
// COMPONENT
// ============================================================

const BorewellBills = () => {

  // ==========================================================
  // PERMISSIONS
  // ==========================================================

  const {
    canWrite,
  } = usePermissions();


  // ==========================================================
  // CURRENT MACHINE
  // ==========================================================

  const {
    currentMachine,
  } = useMachine();


  const isBig =
    currentMachine === 'big';

  const isSmall =
    currentMachine === 'small';


  const machineLabel =
    isBig
      ? 'Big Machine'
      : 'Small Machine';


  // ==========================================================
  // STATE
  // ==========================================================

  const [points, setPoints] =
    useState([]);

  const [brokers, setBrokers] =
    useState([]);

  const [total, setTotal] =
    useState(0);

  const [page, setPage] =
    useState(0);

  const [rowsPerPage, setRowsPerPage] =
    useState(10);

  const [search, setSearch] =
    useState('');

  const [editId, setEditId] =
    useState(null);

  const [deleteDialog, setDeleteDialog] =
    useState(null);

  const [billDialog, setBillDialog] =
    useState(null);

  const [customerEmail, setCustomerEmail] =
    useState('');

  const [payAnchor, setPayAnchor] =
    useState(null);

  const [popoverMode, setPopoverMode] =
    useState('choose');

  const [popoverPartialAmt, setPopoverPartialAmt] =
    useState('');

  const [agentRates, setAgentRates] =
    useState(null);


  // ==========================================================
  // FORM
  // ==========================================================

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
  } = useForm({
    defaultValues:
      getDefaultValues(
        currentMachine
      ),
  });


  // ==========================================================
  // WATCH
  // ==========================================================

  const values = watch();


  // IMPORTANT:
  // Do NOT use values.machineType to decide
  // which machine the user is in.
  //
  // MachineContext is the source of truth.

  const pipeFields =
    isBig
      ? BIG_PIPES_NO_JI_OUTER
      : SMALL_PIPES;


  // ==========================================================
  // BILL BREAKDOWN
  // ==========================================================

  const breakdown =
    computeBreakdown(
      {
        ...values,

        machineType:
          currentMachine,
      },
      agentRates
    );


  // ==========================================================
  // LOAD BROKERS
  // ==========================================================

  useEffect(() => {

    if (
      currentMachine !== 'big' &&
      currentMachine !== 'small'
    ) {
      setBrokers([]);
      return;
    }

    const loadBrokers = async () => {
      try {
        // Same API contract used by Personal Information.
        const { data } = await api.get('/users', {
          params: {
            type: 'Broker',
            machineType: currentMachine,
            page: 1,
            limit: 500,
          },
        });

        console.log('[BorewellBills] broker API response:', data);

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.users)
            ? data.users
            : [];

        setBrokers(list);
      } catch (error) {
        console.error(
          '[BorewellBills] broker fetch failed:',
          error.response?.data || error
        );
        setBrokers([]);
        toast.error(
          error.response?.data?.message ||
          'Failed to load brokers'
        );
      }
    };

    loadBrokers();
  }, [currentMachine]);


  // ==========================================================
  // RESET WHEN MACHINE CHANGES
  // ==========================================================

  useEffect(() => {

    if (
      currentMachine !== 'big' &&
      currentMachine !== 'small'
    ) {
      return;
    }

    setEditId(null);

    setAgentRates(null);

    reset(
      getDefaultValues(
        currentMachine
      )
    );

    setPage(0);

  }, [
    currentMachine,
    reset,
  ]);


  // ==========================================================
  // LOAD AGENT RATE
  // ==========================================================

  useEffect(() => {

    if (
      !values.brokerId ||
      !currentMachine
    ) {

      setAgentRates(null);

      return;
    }


    api
      .get(
        '/points',
        {
          params: {
            brokerId:
              values.brokerId,

            machineType:
              currentMachine,

            limit: 100,
          },
        }
      )
      .then(({ data }) => {

        const match =
          data.points?.find(
            (p) =>
              p.machineType ===
              currentMachine
          );

        setAgentRates(
          match || null
        );

      })
      .catch(() => {

        setAgentRates(null);

      });

  }, [
    values.brokerId,
    currentMachine,
  ]);


  // ==========================================================
  // FETCH BILLS
  // ==========================================================

  const fetchPoints =
    useCallback(
      async () => {

        if (
          currentMachine !== 'big' &&
          currentMachine !== 'small'
        ) {

          setPoints([]);

          setTotal(0);

          return;
        }


        try {

          const {
            data,
          } = await api.get(
            '/borewell-points',
            {
              params: {

                search,

                page:
                  page + 1,

                limit:
                  rowsPerPage,

                // IMPORTANT
                // Exact machine only.
                machineType:
                  currentMachine,
              },
            }
          );


          setPoints(
            data.points ||
            data.bills ||
            []
          );

          setTotal(
            data.total || 0
          );

        } catch (error) {

          console.error(
            error
          );

          toast.error(
            error.response?.data?.message ||
            'Failed to fetch bills'
          );

        }

      },

      [
        search,
        page,
        rowsPerPage,
        currentMachine,
      ]
    );


  // ==========================================================
  // FETCH ON LOAD / MACHINE CHANGE
  // ==========================================================

  useEffect(() => {

    fetchPoints();

  }, [
    fetchPoints,
  ]);


  // ==========================================================
  // TOTAL
  // ==========================================================

  const computedTotal =
    breakdown?.grandTotal ||
    0;


  const amountPaidVal =
    toNum(
      values.amountPaid
    );


  const amountPaidExceeds =
    computedTotal > 0 &&
    amountPaidVal >
      computedTotal;


  // ==========================================================
  // PAYMENT STATUS
  // ==========================================================

  const smartStatus = (() => {

    if (
      computedTotal <= 0 ||
      values.amountPaid === '' ||
      values.amountPaid === null
    ) {
      return 'Unpaid';
    }

    if (
      amountPaidVal >=
      computedTotal
    ) {
      return 'Paid';
    }

    return 'Partial';

  })();


  // ==========================================================
  // SUBMIT
  // ==========================================================

  const onSubmit =
    async (formData) => {

      // ------------------------------------------------------
      // MACHINE CHECK
      // ------------------------------------------------------

      if (
        currentMachine !== 'big' &&
        currentMachine !== 'small'
      ) {

        toast.error(
          'Please select a machine first'
        );

        return;
      }


      // ------------------------------------------------------
      // PAID AMOUNT CHECK
      // ------------------------------------------------------

      if (
        amountPaidExceeds
      ) {

        toast.error(
          'Paid amount cannot exceed total'
        );

        return;
      }


      try {

        // ----------------------------------------------------
        // FORCE MACHINE FROM CONTEXT
        // ----------------------------------------------------

        const finalValues = {
          ...formData,

          machineType:
            currentMachine,
        };


        // ----------------------------------------------------
        // CALCULATE
        // ----------------------------------------------------

        const finalBreakdown =
          computeBreakdown(
            finalValues,
            agentRates
          );


        const finalTotal =
          finalBreakdown?.grandTotal ||
          0;


        const amtPaid =
          toNum(
            formData.amountPaid
          );


        let autoStatus =
          'Unpaid';


        if (
          finalTotal > 0 &&
          amtPaid > 0
        ) {

          autoStatus =
            amtPaid >=
            finalTotal
              ? 'Paid'
              : 'Partial';

        }


        // ----------------------------------------------------
        // PAYLOAD
        // ----------------------------------------------------

        const payload = {

          ...finalValues,

          date:
            formData.date
              ?.toISOString?.() ||
            formData.date,

          // ALWAYS current machine
          machineType:
            currentMachine,

          totalAmount:
            finalTotal,

          discountAmount:
            toNum(formData.discountAmount),

          otherAmount:
            toNum(formData.otherAmount),

          paidAmount:
            amtPaid,

          paymentStatus:
            autoStatus,

          breakdown:
            finalBreakdown,

        };


        // ----------------------------------------------------
        // UPDATE
        // ----------------------------------------------------

        if (editId) {

          await api.put(
            `/borewell-points/${editId}`,
            payload
          );


          toast.success(
            `${machineLabel} bill updated`
          );

        }


        // ----------------------------------------------------
        // CREATE
        // ----------------------------------------------------

        else {

          await api.post(
            '/borewell-points',
            payload
          );


          toast.success(
            `${machineLabel} bill created`
          );

        }


        // ----------------------------------------------------
        // RESET
        // ----------------------------------------------------

        reset(
          getDefaultValues(
            currentMachine
          )
        );

        setEditId(null);

        setAgentRates(null);


        // ----------------------------------------------------
        // REFRESH
        // ----------------------------------------------------

        fetchPoints();

      } catch (error) {

        console.error(
          'Bill save error:',
          error
        );

        toast.error(
          error.response?.data?.message ||
          'Operation failed'
        );

      }

    };


  // ==========================================================
  // EDIT
  // ==========================================================

  const handleEdit =
    (point) => {

      // ------------------------------------------------------
      // SECURITY CHECK
      // ------------------------------------------------------

      if (
        point.machineType !==
        currentMachine
      ) {

        toast.error(
          'This bill belongs to another machine'
        );

        return;
      }


      setEditId(
        point._id
      );


      reset({

        date:
          dayjs(
            point.date
          ),

        // ALWAYS current machine
        machineType:
          currentMachine,

        brokerId:
          point.brokerId?._id ||
          point.brokerId ||
          '',

        partyName:
          point.partyName ||
          '',

        outerPipeFeet:
          point.outerPipeFeet ||
          '',

        innerPipeFeet:
          point.innerPipeFeet ||
          '',

        smallPipeFeet:
          point.smallPipeFeet ||
          '',

        plasticOuterFeet:
          point.plasticOuterFeet ||
          '',

        plasticInnerFeet:
          point.plasticInnerFeet ||
          '',

        jiInnerFeet:
          point.jiInnerFeet ||
          '',

        depthFeet:
          point.depthFeet ||
          '',

        serviceType:
          point.serviceType ||
          '',

        flushingAmount:
          point.flushingAmount ||
          '',

        rodFlushingAmount:
          point.rodFlushingAmount ||
          '',

        discountAmount:
          point.discountAmount ||
          '',

        otherAmount:
          point.otherAmount ||
          '',

        paymentStatus:
          point.paymentStatus ||
          'Unpaid',

        amountPaid:
          point.paidAmount ||
          '',

      });


      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });

    };


  // ==========================================================
  // DELETE
  // ==========================================================

  const handleDelete =
    async () => {

      if (
        !deleteDialog
      ) {
        return;
      }


      try {

        await api.delete(
          `/borewell-points/${deleteDialog}`,
          {
            params: {
              machineType:
                currentMachine,
            },
          }
        );


        toast.success(
          `${machineLabel} bill deleted`
        );


        setDeleteDialog(
          null
        );


        fetchPoints();

      } catch (error) {

        console.error(
          error
        );

        toast.error(
          error.response?.data?.message ||
          'Delete failed'
        );

      }

    };


  // ==========================================================
  // GENERATE BILL
  // ==========================================================

  const handleGenerateBill =
    async (email) => {

      if (!billDialog) {
        return;
      }


      try {

        await api.post(
          `/borewell-points/${billDialog}/generate-bill`,
          {
            email,
          }
        );


        toast.success(
          email
            ? 'Customer bill generated & emailed!'
            : 'Customer bill generated!'
        );


        setBillDialog(
          null
        );

        setCustomerEmail('');

        fetchPoints();

      } catch (error) {

        toast.error(
          error.response?.data?.message ||
          'Bill generation failed'
        );

      }

    };


  // ==========================================================
  // CLOSE PAYMENT
  // ==========================================================

  const closePayPopover =
    () => {

      setPayAnchor(null);

      setPopoverMode(
        'choose'
      );

      setPopoverPartialAmt(
        ''
      );

    };


  // ==========================================================
  // UPDATE PAYMENT
  // ==========================================================

  const handleUpdateStatus =
    async (status) => {

      if (!payAnchor) {
        return;
      }


      // ------------------------------------------------------
      // PARTIAL
      // ------------------------------------------------------

      if (
        status === 'Partial'
      ) {

        const amt =
          parseFloat(
            popoverPartialAmt
          );


        if (
          !amt ||
          amt <= 0
        ) {

          toast.error(
            'Enter a valid partial amount'
          );

          return;
        }


        if (
          amt >
          toNum(
            payAnchor.totalAmount
          )
        ) {

          toast.error(
            'Amount exceeds total'
          );

          return;
        }

      }


      try {

        const body = {
          paymentStatus:
            status,
        };


        if (
          status === 'Partial'
        ) {

          body.paidAmount =
            parseFloat(
              popoverPartialAmt
            );

        }


        await api.patch(
          `/borewell-points/${payAnchor.pointId}/payment`,
          body
        );


        toast.success(
          status === 'Paid'
            ? 'Marked as Paid'
            : 'Marked as Partial'
        );


        closePayPopover();

        fetchPoints();

      } catch (error) {

        toast.error(
          error.response?.data?.message ||
          'Failed to update status'
        );

      }

    };


  // ==========================================================
  // NO MACHINE SELECTED
  // ==========================================================

  if (
    !isBig &&
    !isSmall
  ) {

    return (

      <Box>

        <PageHeader
          title="Borewell Points"
          subtitle="Select a machine first"
          icon={
            <WaterDropIcon />
          }
        />


        <Card>

          <CardContent>

            <Typography
              color="error"
              fontWeight={600}
            >
              Please select Big Machine
              or Small Machine first.
            </Typography>

          </CardContent>

        </Card>

      </Box>

    );

  }


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <Box>

      {/* ======================================================
          HEADER
      ====================================================== */}

      <PageHeader
        title="Borewell Points"
        subtitle={
          `${machineLabel} - Work entries, billing and payment tracking`
        }
        icon={
          <WaterDropIcon />
        }
        actions={

          <Chip
            label={
              machineLabel
            }
            size="small"
            sx={{
              ...machineChipSx(
                isBig
              ),
            }}
          />

        }
      />


      {/* ======================================================
          FORM
      ====================================================== */}

      {canWrite && (

        <Card
          sx={{
            mb: 2.5,
          }}
        >

          <CardContent>

            <Box
              component="form"
              onSubmit={
                handleSubmit(
                  onSubmit
                )
              }
              noValidate
            >

              <Grid
                container
                spacing={2}
              >

                {/* ==================================================
                    DATE
                ================================================== */}

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                >

                  <Controller
                    name="date"
                    control={control}
                    render={({
                      field,
                    }) => (

                      <DatePicker
                        label="Date"
                        value={
                          field.value
                        }
                        onChange={
                          field.onChange
                        }
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: 'small',
                          },
                        }}
                      />

                    )}
                  />

                </Grid>


                {/* ==================================================
                    BROKER
                ================================================== */}

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                >

                  <Controller
                    name="brokerId"
                    control={control}
                    render={({
                      field,
                    }) => (

                      <TextField
                        {...field}
                        fullWidth
                        select
                        label="Broker Name"
                        size="small"
                      >

                        <MenuItem value="">
                          Select broker
                        </MenuItem>

                        {brokers.length === 0 ? (
                          <MenuItem disabled>
                            No brokers found
                          </MenuItem>
                        ) : (
                          brokers.map((broker) => {
                            const brokerId =
                              broker._id || broker.id;

                            return (
                              <MenuItem
                                key={brokerId}
                                value={brokerId}
                              >
                                {broker.name ||
                                  broker.fullName ||
                                  broker.username ||
                                  'Unnamed broker'}
                              </MenuItem>
                            );
                          })
                        )}

                      </TextField>

                    )}
                  />

                </Grid>


                {/* ==================================================
                    PARTY
                ================================================== */}

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                >

                  <TextField
                    fullWidth
                    size="small"
                    label="Party Name"
                    InputLabelProps={{
                      shrink: true,
                    }}
                    {...register(
                      'partyName'
                    )}
                  />

                </Grid>


                {/* ==================================================
                    SERVICE
                ================================================== */}

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                >

                  <Controller
                    name="serviceType"
                    control={control}
                    render={({
                      field,
                    }) => (

                      <TextField
                        {...field}
                        fullWidth
                        select
                        label="Service Type"
                        size="small"
                      >

                        <MenuItem value="">
                          — None —
                        </MenuItem>

                        {SERVICE_TYPES.map(
                          (type) => (

                            <MenuItem
                              key={type}
                              value={type}
                            >
                              {type}
                            </MenuItem>

                          )
                        )}

                      </TextField>

                    )}
                  />

                </Grid>


                {/* ==================================================
                    RATE MESSAGE
                ================================================== */}

                {values.brokerId && (

                  <Grid
                    item
                    xs={12}
                  >

                    <Chip
                      label={
                        agentRates
                          ? `Rates loaded — ${machineLabel}`
                          : `No ${machineLabel.toLowerCase()} rates for this broker`
                      }
                      size="small"
                      sx={{
                        bgcolor:
                          agentRates
                            ? `${TEAL}20`
                            : '#fee2e2',

                        color:
                          agentRates
                            ? TEAL_DARK
                            : '#991b1b',

                        fontSize:
                          '0.72rem',
                      }}
                    />

                  </Grid>

                )}


                {/* ==================================================
                    PIPE FIELDS
                ================================================== */}

                {pipeFields.map(
                  ({
                    feetKey,
                    rateKey,
                    label,
                  }) => (

                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={3}
                      key={feetKey}
                    >

                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label={`${label} (Feet)`}
                        InputLabelProps={{
                          shrink: true,
                        }}
                        {...register(
                          feetKey
                        )}
                        inputProps={{
                          min: 0,
                        }}
                        onWheel={(e) =>
                          e.target.blur()
                        }
                        helperText={
                          agentRates
                            ? `Rate: ₹${toNum(
                                agentRates[
                                  rateKey
                                ]?.rate
                              )}/ft`
                            : ' '
                        }
                      />

                    </Grid>

                  )
                )}


                {/* ==================================================
                    DEPTH
                ================================================== */}

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                >

                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Depth (Feet)"
                    InputLabelProps={{
                      shrink: true,
                    }}
                    {...register(
                      'depthFeet'
                    )}
                    inputProps={{
                      min: 0,
                    }}
                    onWheel={(e) =>
                      e.target.blur()
                    }
                    helperText={
                      agentRates
                        ? (
                          breakdown
                            ?.slabBreakdown
                            ?.length
                            ? `${breakdown.slabBreakdown.length} slab(s)`
                            : 'Enter depth'
                        )
                        : ' '
                    }
                  />

                </Grid>


                {/* ==================================================
                    FLUSHING
                ================================================== */}

                {values.serviceType ===
                  'Flushing' && (

                  <Grid
                    item
                    xs={12}
                    sm={6}
                    md={3}
                  >

                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Flushing Amount (₹)"
                      InputLabelProps={{
                        shrink: true,
                      }}
                      {...register(
                        'flushingAmount'
                      )}
                      inputProps={{
                        min: 0,
                      }}
                      onWheel={(e) =>
                        e.target.blur()
                      }
                    />

                  </Grid>

                )}


                {/* ==================================================
                    ROD FLUSHING
                ================================================== */}

                {values.serviceType ===
                  'Rod Flushing' && (

                  <Grid
                    item
                    xs={12}
                    sm={6}
                    md={3}
                  >

                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Rod Flushing Amount (₹)"
                      InputLabelProps={{
                        shrink: true,
                      }}
                      {...register(
                        'rodFlushingAmount'
                      )}
                      inputProps={{
                        min: 0,
                      }}
                      onWheel={(e) =>
                        e.target.blur()
                      }
                    />

                  </Grid>

                )}


                {/* ==================================================
                    BILL ADJUSTMENTS
                ================================================== */}

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                >
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Discount (₹)"
                    placeholder="0"
                    InputLabelProps={{
                      shrink: true,
                    }}
                    {...register('discountAmount')}
                    inputProps={{ min: 0 }}
                    onWheel={(e) => e.target.blur()}
                    helperText="Amount deducted from bill"
                  />
                </Grid>

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                >
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Other Amount (₹)"
                    placeholder="0"
                    InputLabelProps={{
                      shrink: true,
                    }}
                    {...register('otherAmount')}
                    inputProps={{ min: 0 }}
                    onWheel={(e) => e.target.blur()}
                    helperText="Amount added to bill"
                  />
                </Grid>

                {/* ==================================================
                    AMOUNT PAID
                ================================================== */}

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                >

                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Amount Paid (₹)"
                    placeholder="Leave blank if unpaid"
                    InputLabelProps={{
                      shrink: true,
                    }}
                    error={
                      amountPaidExceeds
                    }
                    helperText={
                      amountPaidExceeds
                        ? `Exceeds total ${fmtINR(
                            computedTotal
                          )}`
                        : undefined
                    }
                    {...register(
                      'amountPaid'
                    )}
                    inputProps={{
                      min: 0,
                    }}
                    onWheel={(e) =>
                      e.target.blur()
                    }
                  />

                </Grid>


                {/* ==================================================
                    TOTAL
                ================================================== */}

                {breakdown &&
                  breakdown.grandTotal >
                    0 && (

                  <Grid
                    item
                    xs={12}
                  >

                    <Box
                      sx={{
                        display:
                          'flex',

                        alignItems:
                          'center',

                        gap: 2,

                        bgcolor:
                          NAVY,

                        borderRadius:
                          '8px',

                        px: 2,

                        py: 1.2,
                      }}
                    >

                      <Typography
                        sx={{
                          color:
                            'rgba(255,255,255,0.6)',

                          fontSize:
                            '0.82rem',
                        }}
                      >
                        Total Amount
                      </Typography>


                      <Box
                        sx={{
                          ml: 'auto',
                          textAlign: 'right',
                        }}
                      >
                        <Typography
                          sx={{
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: '0.72rem',
                          }}
                        >
                          Subtotal: {fmtINR(breakdown.subtotal)}
                          {breakdown.discountAmount > 0
                            ? ` • Discount: -${fmtINR(breakdown.discountAmount)}`
                            : ''}
                          {breakdown.otherAmount > 0
                            ? ` • Other: +${fmtINR(breakdown.otherAmount)}`
                            : ''}
                        </Typography>
                        <Typography
                          sx={{
                            color: TEAL,
                            fontWeight: 700,
                            fontSize: '1.1rem',
                          }}
                        >
                          {fmtINR(breakdown.grandTotal)}
                        </Typography>
                      </Box>


                      {values.amountPaid !==
                        '' && (

                        <Chip
                          label={
                            smartStatus
                          }
                          size="small"
                          sx={{
                            ...statusColor(
                              smartStatus
                            ),

                            fontSize:
                              '0.72rem',
                          }}
                        />

                      )}

                    </Box>

                  </Grid>

                )}


                {/* ==================================================
                    BUTTONS
                ================================================== */}

                <Grid
                  item
                  xs={12}
                >

                  <Box
                    sx={{
                      display:
                        'flex',

                      gap: 1.5,

                      mt: 0.5,
                    }}
                  >

                    <Button
                      type="submit"
                      variant="contained"
                      color="secondary"
                      disabled={
                        amountPaidExceeds
                      }
                      startIcon={
                        <AddCircleOutlineIcon />
                      }
                      sx={{
                        px: 3,
                      }}
                    >
                      {editId
                        ? 'Update'
                        : 'Submit'}
                    </Button>


                    <Button
                      variant="outlined"
                      color="inherit"
                      onClick={() => {

                        reset(
                          getDefaultValues(
                            currentMachine
                          )
                        );

                        setEditId(
                          null
                        );

                        setAgentRates(
                          null
                        );

                      }}
                    >
                      Reset
                    </Button>

                  </Box>

                </Grid>

              </Grid>

            </Box>

          </CardContent>

        </Card>

      )}


      {/* ======================================================
          TABLE
      ====================================================== */}

      <Card>

        <CardContent>

          {/* SEARCH */}

          <Grid
            container
            spacing={1.5}
            sx={{
              mb: 2,
            }}
            alignItems="center"
          >

            <Grid
              item
              xs={12}
              sm={6}
            >

              <TextField
                fullWidth
                size="small"
                placeholder={`Search ${machineLabel.toLowerCase()} party...`}
                value={
                  search
                }
                onChange={(e) => {

                  setSearch(
                    e.target.value
                  );

                  setPage(0);

                }}
                InputProps={{
                  startAdornment: (

                    <InputAdornment
                      position="start"
                    >

                      <SearchIcon
                        fontSize="small"
                      />

                    </InputAdornment>

                  ),
                }}
              />

            </Grid>

          </Grid>


          {/* TABLE */}

          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              borderRadius:
                '10px',
            }}
          >

            <Table
              size="small"
            >

              <TableHead>

                <TableRow>

                  {[
                    'Date',
                    'Machine',
                    'Broker',
                    'Party',
                    'Depth',
                    'Type',
                    'Total (₹)',
                    'Status',
                    'Actions',
                  ].map(
                    (header) => (

                      <TableCell
                        key={
                          header
                        }
                      >
                        {header}
                      </TableCell>

                    )
                  )}

                </TableRow>

              </TableHead>


              <TableBody>

                {/* EMPTY */}

                {points.length ===
                  0 && (

                  <TableRow>

                    <TableCell
                      colSpan={9}
                      align="center"
                      sx={{
                        color:
                          'text.secondary',

                        py: 3,
                      }}
                    >

                      No {machineLabel.toLowerCase()}
                      entries found.

                    </TableCell>

                  </TableRow>

                )}


                {/* ROWS */}

                {points.map(
                  (point) => (

                    <TableRow
                      key={
                        point._id
                      }
                      hover
                    >

                      {/* DATE */}

                      <TableCell
                        sx={{
                          fontSize:
                            '0.82rem',
                        }}
                      >

                        {dayjs(
                          point.date
                        ).format(
                          'DD/MM/YYYY'
                        )}

                      </TableCell>


                      {/* MACHINE */}

                      <TableCell>

                        <Chip
                          label={
                            point.machineType ===
                            'big'
                              ? 'Big'
                              : 'Small'
                          }
                          size="small"
                          sx={{
                            ...machineChipSx(
                              point.machineType ===
                                'big'
                            ),

                            fontSize:
                              '0.68rem',

                            height:
                              20,
                          }}
                        />

                      </TableCell>


                      {/* BROKER */}

                      <TableCell
                        sx={{
                          fontSize:
                            '0.82rem',

                          fontWeight:
                            500,
                        }}
                      >

                        {
                          point
                            .brokerId
                            ?.name ||
                          '—'
                        }

                      </TableCell>


                      {/* PARTY */}

                      <TableCell
                        sx={{
                          fontSize:
                            '0.82rem',
                        }}
                      >

                        {
                          point.partyName ||
                          '—'
                        }

                      </TableCell>


                      {/* DEPTH */}

                      <TableCell
                        sx={{
                          fontSize:
                            '0.82rem',
                        }}
                      >

                        {
                          point.depthFeet ||
                          '—'
                        }

                      </TableCell>


                      {/* TYPE */}

                      <TableCell
                        sx={{
                          fontSize:
                            '0.82rem',
                        }}
                      >

                        {
                          point.serviceType ||
                          '—'
                        }

                      </TableCell>


                      {/* TOTAL */}

                      <TableCell
                        sx={{
                          fontSize:
                            '0.82rem',

                          fontWeight:
                            600,

                          color:
                            TEAL_DARK,
                        }}
                      >

                        {fmtINR(
                          point.totalAmount
                        )}

                      </TableCell>


                      {/* STATUS */}

                      <TableCell>

                        {canWrite &&
                        [
                          'Unpaid',
                          'Partial',
                        ].includes(
                          point.paymentStatus
                        ) ? (

                          <Tooltip
                            title="Click to update payment"
                            placement="top"
                            arrow
                          >

                            <Chip
                              label={
                                point.paymentStatus
                              }
                              size="small"
                              onClick={(e) => {

                                setPayAnchor({
                                  el:
                                    e.currentTarget,

                                  pointId:
                                    point._id,

                                  totalAmount:
                                    point.totalAmount,
                                });


                                setPopoverMode(
                                  'choose'
                                );


                                setPopoverPartialAmt(
                                  point.paymentStatus ===
                                    'Partial'
                                    ? String(
                                        point.paidAmount ||
                                          ''
                                      )
                                    : ''
                                );

                              }}
                              sx={{
                                ...statusColor(
                                  point.paymentStatus
                                ),

                                fontSize:
                                  '0.72rem',

                                height:
                                  22,

                                cursor:
                                  'pointer',
                              }}
                            />

                          </Tooltip>

                        ) : (

                          <Chip
                            label={
                              point.paymentStatus ||
                              'Unpaid'
                            }
                            size="small"
                            sx={{
                              ...statusColor(
                                point.paymentStatus
                              ),

                              fontSize:
                                '0.72rem',

                              height:
                                22,
                            }}
                          />

                        )}

                      </TableCell>


                      {/* ACTIONS */}

                      <TableCell>

                        <Box
                          sx={{
                            display:
                              'flex',

                            gap:
                              0.5,
                          }}
                        >

                          {canWrite && (

                            <>

                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() =>
                                  handleEdit(
                                    point
                                  )
                                }
                              >

                                <EditIcon
                                  fontSize="small"
                                />

                              </IconButton>


                              <IconButton
                                size="small"
                                color="error"
                                onClick={() =>
                                  setDeleteDialog(
                                    point._id
                                  )
                                }
                              >

                                <DeleteIcon
                                  fontSize="small"
                                />

                              </IconButton>

                            </>

                          )}


                          <IconButton
                            size="small"
                            sx={{
                              color:
                                TEAL_DARK,
                            }}
                            title="Generate Bill"
                            onClick={() => {

                              setBillDialog(
                                point._id
                              );

                              setCustomerEmail(
                                point
                                  .brokerId
                                  ?.email ||
                                ''
                              );

                            }}
                          >

                            <ReceiptIcon
                              fontSize="small"
                            />

                          </IconButton>

                        </Box>

                      </TableCell>

                    </TableRow>

                  )
                )}

              </TableBody>

            </Table>

          </TableContainer>


          {/* PAGINATION */}

          <TablePagination
            component="div"
            count={
              total
            }
            page={
              page
            }
            onPageChange={(
              _event,
              newPage
            ) =>
              setPage(
                newPage
              )
            }
            rowsPerPage={
              rowsPerPage
            }
            onRowsPerPageChange={(
              event
            ) => {

              setRowsPerPage(
                parseInt(
                  event.target.value,
                  10
                )
              );

              setPage(0);

            }}
          />

        </CardContent>

      </Card>


      {/* ======================================================
          PAYMENT POPOVER
      ====================================================== */}

      <Popover
        open={
          !!payAnchor
        }
        anchorEl={
          payAnchor?.el
        }
        onClose={
          closePayPopover
        }
        anchorOrigin={{
          vertical:
            'bottom',
          horizontal:
            'center',
        }}
        transformOrigin={{
          vertical:
            'top',
          horizontal:
            'center',
        }}
        PaperProps={{
          sx: {
            borderRadius:
              '12px',

            p: 2,

            minWidth:
              220,

            boxShadow:
              '0 4px 24px rgba(0,0,0,0.13)',
          },
        }}
      >

        {popoverMode ===
        'choose' ? (

          <>

            <Typography
              variant="body2"
              fontWeight={700}
              sx={{
                mb: 0.5,
              }}
            >
              Update Payment
            </Typography>


            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display:
                  'block',

                mb: 1.5,
              }}
            >

              Total:
              {' '}
              {fmtINR(
                payAnchor?.totalAmount
              )}

            </Typography>


            <Box
              sx={{
                display:
                  'flex',

                flexDirection:
                  'column',

                gap: 1,
              }}
            >

              <Button
                fullWidth
                size="small"
                variant="outlined"
                color="warning"
                onClick={() =>
                  setPopoverMode(
                    'partial'
                  )
                }
              >
                Partial - Enter Amount
              </Button>


              <Button
                fullWidth
                size="small"
                variant="contained"
                color="success"
                onClick={() =>
                  handleUpdateStatus(
                    'Paid'
                  )
                }
                sx={{
                  boxShadow:
                    'none',
                }}
              >
                Mark as Fully Paid
              </Button>


              <Button
                size="small"
                color="inherit"
                onClick={
                  closePayPopover
                }
              >
                Cancel
              </Button>

            </Box>

          </>

        ) : (

          <>

            <Typography
              variant="body2"
              fontWeight={700}
              sx={{
                mb: 0.5,
              }}
            >
              Enter Partial Amount
            </Typography>


            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display:
                  'block',

                mb: 1.5,
              }}
            >

              Total:
              {' '}
              {fmtINR(
                payAnchor?.totalAmount
              )}

            </Typography>


            <TextField
              fullWidth
              autoFocus
              size="small"
              type="number"
              label="Amount Paid (₹)"
              value={
                popoverPartialAmt
              }
              onChange={(e) =>
                setPopoverPartialAmt(
                  e.target.value
                )
              }
              onWheel={(e) =>
                e.target.blur()
              }
              inputProps={{
                min: 0,
              }}
              error={
                popoverPartialAmt !==
                  '' &&
                toNum(
                  popoverPartialAmt
                ) >
                  toNum(
                    payAnchor?.totalAmount
                  )
              }
              helperText={
                popoverPartialAmt !==
                  '' &&
                toNum(
                  popoverPartialAmt
                ) >
                  toNum(
                    payAnchor?.totalAmount
                  )
                  ? 'Exceeds total'
                  : ' '
              }
              sx={{
                mb: 1.5,
              }}
            />


            <Box
              sx={{
                display:
                  'flex',

                gap: 1,
              }}
            >

              <Button
                size="small"
                color="inherit"
                onClick={() =>
                  setPopoverMode(
                    'choose'
                  )
                }
                sx={{
                  flex: 1,
                }}
              >
                Back
              </Button>


              <Button
                size="small"
                variant="contained"
                color="warning"
                onClick={() =>
                  handleUpdateStatus(
                    'Partial'
                  )
                }
                sx={{
                  flex: 1,

                  boxShadow:
                    'none',
                }}
              >
                Save
              </Button>

            </Box>

          </>

        )}

      </Popover>


      {/* ======================================================
          DELETE CONFIRM
      ====================================================== */}

      <ConfirmDialog
        open={
          !!deleteDialog
        }
        onClose={() =>
          setDeleteDialog(
            null
          )
        }
        onConfirm={
          handleDelete
        }
      />


      {/* ======================================================
          GENERATE BILL DIALOG
      ====================================================== */}

      <Dialog
        open={
          !!billDialog
        }
        onClose={() =>
          setBillDialog(
            null
          )
        }
        PaperProps={{
          sx: {
            minWidth:
              360,
          },
        }}
      >

        <DialogTitle
          sx={{
            fontWeight:
              700,

            borderBottom:
              `3px solid ${TEAL}`,
          }}
        >
          Generate Customer Bill
        </DialogTitle>


        <DialogContent
          sx={{
            pt: 2,
          }}
        >

          <TextField
            fullWidth
            label="Customer Email (optional)"
            margin="normal"
            size="small"
            value={
              customerEmail
            }
            onChange={(e) =>
              setCustomerEmail(
                e.target.value
              )
            }
          />

        </DialogContent>


        <DialogActions
          sx={{
            px: 3,
            pb: 2,
            gap: 1,
          }}
        >

          <Button
            onClick={() =>
              setBillDialog(
                null
              )
            }
            color="inherit"
          >
            Cancel
          </Button>


          <Button
            variant="outlined"
            color="secondary"
            onClick={() =>
              handleGenerateBill()
            }
          >
            Generate Bill
          </Button>


          <Button
            variant="contained"
            color="secondary"
            onClick={() =>
              handleGenerateBill(
                customerEmail
              )
            }
          >
            Generate & Email Customer
          </Button>

        </DialogActions>

      </Dialog>

    </Box>

  );
};


export default BorewellBills;