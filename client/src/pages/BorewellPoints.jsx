import { useState, useEffect, useCallback } from 'react';
import { useMachine } from '../context/MachineContext';
import { useForm, Controller, useFieldArray } from 'react-hook-form';

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
  Divider,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ReceiptIcon from '@mui/icons-material/Receipt';

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
  machineChipSx,
  SMALL_PIPES,
  BIG_PIPES,
  SMALL_DEPTH_RANGES,
  BIG_DEPTH_RANGES,
} from '../utils/constants';


// ============================================================
// HELPERS
// ============================================================

const normalizePipe = (pipe) => {
  if (!pipe || typeof pipe === 'string') {
    return { rate: 0 };
  }

  return {
    rate: toNum(pipe.rate),
  };
};


// Small Machine: remove ALL depth slabs starting from 700 feet.
// Example: 700-800, 800-900, 900-1000 ... 1400-1500 are hidden.
// Big Machine keeps all of its existing depth ranges.
const getDepthRanges = (machineType) =>
  machineType === 'big'
    ? BIG_DEPTH_RANGES
    : SMALL_DEPTH_RANGES.filter((range) => {
        const start = Number(
          String(range)
            .trim()
            .split('-')[0]
            .replace(/[^0-9.]/g, '')
        );

        return Number.isNaN(start) || start < 700;
      });


// ============================================================
// DEFAULT FORM
// ============================================================

const buildDefaultValues = (machineType = 'small') => ({
  date: dayjs(),

  // This is controlled by MachineContext.
  machineType,

  brokerId: '',

  outerPipe: {
    rate: 0,
  },

  innerPipe: {
    rate: 0,
  },

  smallInnerPipe: {
    rate: 0,
  },

  plasticOuter: {
    rate: 0,
  },

  plasticInner: {
    rate: 0,
  },

  jiInner: {
    rate: 0,
  },

  depthDetails: getDepthRanges(machineType).map((range) => ({
    range,
    rate: 0,
  })),
});


// ============================================================
// VIEW DIALOG
// ============================================================

const ViewDialog = ({ point, onClose }) => {
  if (!point) {
    return null;
  }

  const isBig =
    point.machineType === 'big';

  const pipeRows =
    isBig
      ? BIG_PIPES.filter(
          ({ rateKey }) => rateKey !== 'jiOuter'
        )
      : SMALL_PIPES;

  const pipeItems =
    pipeRows
      .map(({ rateKey, label }) => ({
        description: label,
        rate: toNum(
          point[rateKey]?.rate
        ),
      }))
      .filter(
        (item) => item.rate > 0
      );

  const depthItems =
    (point.depthDetails || [])
      .filter(
        (item) => toNum(item.rate) > 0
      )
      .map((item) => ({
        description: item.range,
        rate: toNum(item.rate),
      }));

  const allItems = [
    ...pipeItems,
    ...depthItems,
  ];

  const brokerName =
    point.brokerId?.name || '—';

  return (
    <Dialog
      open={!!point}
      onClose={onClose}
      PaperProps={{
        sx: {
          minWidth: 420,
          maxWidth: 560,
        },
      }}
    >

      <DialogTitle
        sx={{
          bgcolor: NAVY,
          color: '#fff',
          fontWeight: 700,
          py: 1.5,
          px: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >

        <span>
          {brokerName}
        </span>

        <Chip
          label={
            isBig
              ? 'Big Machine'
              : 'Small Machine'
          }
          size="small"
          sx={{
            bgcolor: isBig
              ? 'rgba(30,190,165,0.25)'
              : 'rgba(255,255,255,0.15)',

            color: isBig
              ? TEAL
              : '#fff',

            fontSize: '0.72rem',
          }}
        />

      </DialogTitle>


      <DialogContent
        sx={{
          px: 2.5,
          pt: 2.5,
          pb: 1,
        }}
      >

        <Grid
          container
          spacing={1.5}
          sx={{ mb: 2 }}
        >

          <Grid item xs={6}>

            <Typography
              variant="caption"
              color="text.secondary"
            >
              Date
            </Typography>

            <Typography
              variant="body2"
              fontWeight={600}
            >
              {dayjs(
                point.date
              ).format('DD/MM/YYYY')}
            </Typography>

          </Grid>


          <Grid item xs={6}>

            <Typography
              variant="caption"
              color="text.secondary"
            >
              Broker
            </Typography>

            <Typography
              variant="body2"
              fontWeight={600}
            >
              {brokerName}
            </Typography>

          </Grid>

        </Grid>


        <Divider
          sx={{ mb: 2 }}
        />


        {allItems.length === 0 ? (

          <Typography
            variant="body2"
            color="text.secondary"
            textAlign="center"
            py={2}
          >
            No rates configured
          </Typography>

        ) : (

          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              borderRadius: '8px',
            }}
          >

            <Table size="small">

              <TableHead>

                <TableRow>

                  <TableCell>
                    Description
                  </TableCell>

                  <TableCell align="right">
                    Rate (₹)
                  </TableCell>

                </TableRow>

              </TableHead>


              <TableBody>

                {allItems.map(
                  (item, index) => (

                    <TableRow
                      key={index}
                    >

                      <TableCell
                        sx={{
                          fontSize: '0.82rem',
                        }}
                      >
                        {item.description}
                      </TableCell>

                      <TableCell
                        align="right"
                        sx={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: TEAL_DARK,
                        }}
                      >
                        ₹
                        {item.rate.toLocaleString(
                          'en-IN'
                        )}
                      </TableCell>

                    </TableRow>

                  )
                )}

              </TableBody>

            </Table>

          </TableContainer>

        )}

      </DialogContent>


      <DialogActions
        sx={{
          px: 2.5,
          pb: 2,
        }}
      >

        <Button
          onClick={onClose}
          variant="outlined"
          color="inherit"
        >
          Close
        </Button>

      </DialogActions>

    </Dialog>
  );
};


// ============================================================
// MAIN COMPONENT
// ============================================================

const AgentInformation = () => {

  const {
    canWrite,
  } = usePermissions();


  // ==========================================================
  // MACHINE CONTEXT
  // ==========================================================

  const {
    currentMachine,
  } = useMachine();


  // ==========================================================
  // MACHINE
  // ==========================================================

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

  const [viewPoint, setViewPoint] =
    useState(null);


  // ==========================================================
  // FORM
  // ==========================================================

  const {
    register,
    handleSubmit,
    reset,
    control,
  } = useForm({
    defaultValues:
      buildDefaultValues(
        currentMachine || 'small'
      ),
  });


  // ==========================================================
  // DEPTH FIELDS
  // ==========================================================

  const {
    fields,
  } = useFieldArray({
    control,
    name: 'depthDetails',
  });


  // ==========================================================
  // PIPE LIST
  // ==========================================================

  const pipeRows =
    isBig
      ? BIG_PIPES.filter(
          ({ rateKey }) =>
            rateKey !== 'jiOuter'
        )
      : SMALL_PIPES;


  // ==========================================================
  // WHEN MACHINE CHANGES
  //
  // Reset everything for the newly selected machine.
  // ==========================================================

  useEffect(() => {

    if (
      currentMachine !== 'big' &&
      currentMachine !== 'small'
    ) {
      return;
    }


    setEditId(null);

    reset(
      buildDefaultValues(
        currentMachine
      )
    );

    setPage(0);

  }, [
    currentMachine,
    reset,
  ]);


  // ==========================================================
  // FETCH POINTS
  //
  // ONLY current machine.
  // ==========================================================

  const fetchPoints = useCallback(
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
          '/points',
          {
            params: {
              search,
              page: page + 1,
              limit: rowsPerPage,

              // IMPORTANT
              // Exact selected machine.
              machineType:
                currentMachine,
            },
          }
        );


        setPoints(
          data.points || []
        );

        setTotal(
          data.total || 0
        );

      } catch (error) {

        console.error(
          'Fetch points error:',
          error
        );

        toast.error(
          error.response?.data?.message ||
          'Failed to fetch agent information'
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
  // FETCH BROKERS
  //
  // ONLY current machine brokers.
  // ==========================================================

  const fetchBrokers = useCallback(async () => {

    if (
      currentMachine !== 'big' &&
      currentMachine !== 'small'
    ) {
      setBrokers([]);
      return;
    }

    try {
      const { data } = await api.get(
        '/users/brokers',
        {
          params: {
            machineType: currentMachine,
          },
        }
      );

      setBrokers(data || []);
    } catch (error) {
      console.error(
        'Fetch brokers error:',
        error
      );
      setBrokers([]);
      toast.error('Failed to load brokers');
    }
  }, [currentMachine]);


  // ==========================================================
  // LOAD POINTS
  // ==========================================================

  useEffect(() => {
    fetchPoints();
    fetchBrokers();
  }, [
    fetchPoints,
    fetchBrokers,
  ]);


  // ==========================================================
  // SUBMIT
  // ==========================================================

  const onSubmit = async (
    formData
  ) => {

    // --------------------------------------------------------
    // MACHINE CHECK
    // --------------------------------------------------------

    if (
      currentMachine !== 'big' &&
      currentMachine !== 'small'
    ) {

      toast.error(
        'Please select a machine first'
      );

      return;
    }


    // --------------------------------------------------------
    // BROKER CHECK
    // --------------------------------------------------------

    if (!formData.brokerId) {

      toast.error(
        'Please select a broker'
      );

      return;
    }


    try {

      const payload = {

        ...formData,

        // IMPORTANT:
        // Never use machineType from
        // the form.
        //
        // Always use MachineContext.
        machineType:
          currentMachine,

        date:
          formData.date?.toISOString?.() ||
          formData.date,
      };


      // ======================================================
      // UPDATE
      // ======================================================

      if (editId) {

        await api.put(
          `/points/${editId}`,
          payload
        );

        toast.success(
          `${machineLabel} entry updated`
        );

      }


      // ======================================================
      // CREATE
      // ======================================================

      else {

        await api.post(
          '/points',
          payload
        );

        toast.success(
          `${machineLabel} entry created`
        );

      }


      // --------------------------------------------------------
      // RESET
      // --------------------------------------------------------

      reset(
        buildDefaultValues(
          currentMachine
        )
      );

      setEditId(null);

      fetchPoints();

    } catch (error) {

      console.error(
        'Save point error:',
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

  const handleEdit = (
    point
  ) => {

    // --------------------------------------------------------
    // SECURITY CHECK
    //
    // Do not edit another machine's record.
    // --------------------------------------------------------

    if (
      point.machineType !==
      currentMachine
    ) {

      toast.error(
        'This entry belongs to another machine'
      );

      return;
    }


    const machineType =
      currentMachine;


    const depthRanges =
      getDepthRanges(machineType);


    const details =
      depthRanges.map(
        (range) => {

          const existing =
            point.depthDetails?.find(
              (item) =>
                item.range === range
            );


          return {
            range,
            rate:
              existing?.rate || 0,
          };

        }
      );


    setEditId(
      point._id
    );


    reset({

      date:
        point.date
          ? dayjs(point.date)
          : dayjs(),

      // Always selected machine.
      machineType:
        currentMachine,

      brokerId:
        point.brokerId?._id ||
        '',

      outerPipe:
        normalizePipe(
          point.outerPipe
        ),

      innerPipe:
        normalizePipe(
          point.innerPipe
        ),

      smallInnerPipe:
        normalizePipe(
          point.smallInnerPipe
        ),

      plasticOuter:
        normalizePipe(
          point.plasticOuter
        ),

      plasticInner:
        normalizePipe(
          point.plasticInner
        ),

      jiInner:
        normalizePipe(
          point.jiInner
        ),

      depthDetails:
        details,

    });


    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });

  };


  // ==========================================================
  // DELETE
  // ==========================================================

  const handleDelete = async () => {

    if (!deleteDialog) {
      return;
    }


    if (
      currentMachine !== 'big' &&
      currentMachine !== 'small'
    ) {

      toast.error(
        'Please select a machine'
      );

      return;
    }


    try {

      // IMPORTANT:
      // Backend requires machineType.
      await api.delete(
        `/points/${deleteDialog}`,
        {
          params: {
            machineType:
              currentMachine,
          },
        }
      );


      toast.success(
        `${machineLabel} entry deleted`
      );


      setDeleteDialog(
        null
      );


      fetchPoints();

    } catch (error) {

      console.error(
        'Delete point error:',
        error
      );

      toast.error(
        error.response?.data?.message ||
        'Delete failed'
      );

    }

  };


  // ==========================================================
  // RESET
  // ==========================================================

  const handleReset = () => {

    reset(
      buildDefaultValues(
        currentMachine || 'small'
      )
    );

    setEditId(null);

  };


  // ==========================================================
  // NO MACHINE
  // ==========================================================

  if (
    currentMachine !== 'big' &&
    currentMachine !== 'small'
  ) {

    return (

      <Box>

        <PageHeader
          title="Agent Information"
          subtitle="Select a machine first"
          icon={<ReceiptIcon />}
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
  // RENDER
  // ==========================================================

  return (

    <Box>

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      {/* <PageHeader
        title="Agent Information"
        subtitle={
          `Per-broker rate cards for ${machineLabel}`
        }
        icon={<ReceiptIcon />}
        actions={

          <Chip
            label={machineLabel}
            size="small"
            sx={{
              ...machineChipSx(isBig),
              fontSize: '0.75rem',
            }}
          />

        }
      /> */}


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
                handleSubmit(onSubmit)
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


                        {brokers.map(
                          (broker) => (

                            <MenuItem
                              key={
                                broker._id
                              }
                              value={
                                broker._id
                              }
                            >
                              {broker.name}
                            </MenuItem>

                          )
                        )}

                      </TextField>

                    )}
                  />

                </Grid>


                {/* ==================================================
                    PIPE TITLE
                ================================================== */}

                <Grid
                  item
                  xs={12}
                >

                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.secondary"
                    sx={{
                      textTransform:
                        'uppercase',
                      letterSpacing:
                        '0.06em',
                    }}
                  >
                    {isBig
                      ? 'Big Machine — Pipe Rates'
                      : 'Small Machine — Pipe Rates'}
                  </Typography>


                  <Divider
                    sx={{
                      mt: 0.5,
                    }}
                  />

                </Grid>


                {/* ==================================================
                    PIPE RATES
                ================================================== */}

                {pipeRows.map(
                  ({
                    rateKey,
                    label,
                  }) => (

                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={3}
                      key={rateKey}
                    >

                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label={
                          `${label} Rate (₹/ft)`
                        }
                        {...register(
                          `${rateKey}.rate`,
                          {
                            valueAsNumber:
                              true,
                          }
                        )}
                        inputProps={{
                          min: 0,
                        }}
                        onWheel={(event) =>
                          event.target.blur()
                        }
                      />

                    </Grid>

                  )
                )}


                {/* ==================================================
                    DEPTH TITLE
                ================================================== */}

                <Grid
                  item
                  xs={12}
                >

                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.secondary"
                    sx={{
                      textTransform:
                        'uppercase',
                      letterSpacing:
                        '0.06em',
                    }}
                  >
                    Depth Rates —{' '}
                    {machineLabel}{' '}
                    ({fields.length} slabs)
                  </Typography>


                  <Divider
                    sx={{
                      mt: 0.5,
                    }}
                  />

                </Grid>


                {/* ==================================================
                    DEPTH RATES
                ================================================== */}

                {fields.map(
                  (
                    field,
                    index
                  ) => (

                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={3}
                      key={field.id}
                    >

                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label={
                          field.range
                        }
                        {...register(
                          `depthDetails.${index}.rate`,
                          {
                            valueAsNumber:
                              true,
                          }
                        )}
                        inputProps={{
                          min: 0,
                        }}
                        onWheel={(event) =>
                          event.target.blur()
                        }
                      />

                    </Grid>

                  )
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
                      onClick={
                        handleReset
                      }
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

          {/* ====================================================
              SEARCH
          ==================================================== */}

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
                placeholder="Search broker..."
                value={search}
                onChange={(event) => {

                  setSearch(
                    event.target.value
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


          {/* ====================================================
              TABLE
          ==================================================== */}

          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              borderRadius: '10px',
            }}
          >

            <Table size="small">

              <TableHead>

                <TableRow>

                  {[
                    'Date',
                    'Machine Type',
                    'Broker',
                    'Rate Descriptions',
                    'Actions',
                  ].map(
                    (header) => (

                      <TableCell
                        key={header}
                      >
                        {header}
                      </TableCell>

                    )
                  )}

                </TableRow>

              </TableHead>


              <TableBody>

                {points.length === 0 && (

                  <TableRow>

                    <TableCell
                      colSpan={5}
                      align="center"
                      sx={{
                        color:
                          'text.secondary',
                        py: 3,
                      }}
                    >
                      No entries found for{' '}
                      {machineLabel}
                    </TableCell>

                  </TableRow>

                )}


                {points.map(
                  (point) => {

                    const isBigRow =
                      point.machineType ===
                      'big';


                    // IMPORTANT:
                    // JI Outer is removed from
                    // Big Machine table also.
                    const pipeDefs =
                      isBigRow
                        ? BIG_PIPES.filter(
                            ({ rateKey }) =>
                              rateKey !== 'jiOuter'
                          )
                        : SMALL_PIPES;


                    const pipeItems =
                      pipeDefs
                        .filter(
                          ({
                            rateKey,
                          }) =>
                            toNum(
                              point[
                                rateKey
                              ]?.rate
                            ) > 0
                        )
                        .map(
                          ({
                            label,
                          }) =>
                            label
                        );


                    const depthItems =
                      (
                        point.depthDetails ||
                        []
                      )
                        .filter(
                          (item) =>
                            toNum(
                              item.rate
                            ) > 0
                        )
                        .map(
                          (item) =>
                            item.range
                        );


                    const allDesc = [
                      ...pipeItems,
                      ...depthItems,
                    ];


                    return (

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
                              isBigRow
                                ? 'Big'
                                : 'Small'
                            }
                            size="small"
                            sx={{
                              ...machineChipSx(
                                isBigRow
                              ),
                              fontSize:
                                '0.72rem',
                              height: 22,
                            }}
                          />

                        </TableCell>


                        {/* BROKER */}

                        <TableCell
                          sx={{
                            fontSize:
                              '0.82rem',
                            fontWeight:
                              600,
                          }}
                        >
                          {
                            point.brokerId
                              ?.name ||
                            '—'
                          }
                        </TableCell>


                        {/* DESCRIPTION */}

                        <TableCell
                          sx={{
                            fontSize:
                              '0.8rem',
                            maxWidth: 280,
                          }}
                        >

                          {allDesc.length ===
                          0 ? (

                            '—'

                          ) : (

                            <Box
                              sx={{
                                display:
                                  'flex',
                                flexWrap:
                                  'wrap',
                                gap: 0.4,
                              }}
                            >

                              {allDesc
                                .slice(0, 3)
                                .map(
                                  (
                                    description,
                                    index
                                  ) => (

                                    <Chip
                                      key={
                                        index
                                      }
                                      label={
                                        description
                                      }
                                      size="small"
                                      variant="outlined"
                                      sx={{
                                        fontSize:
                                          '0.68rem',
                                        height:
                                          20,
                                      }}
                                    />

                                  )
                                )}


                              {allDesc.length >
                                3 && (

                                <Chip
                                  label={
                                    `+${
                                      allDesc.length -
                                      3
                                    } more`
                                  }
                                  size="small"
                                  onClick={() =>
                                    setViewPoint(
                                      point
                                    )
                                  }
                                  sx={{
                                    fontSize:
                                      '0.68rem',
                                    height:
                                      20,
                                    bgcolor:
                                      `${TEAL}18`,
                                    color:
                                      TEAL_DARK,
                                    cursor:
                                      'pointer',
                                  }}
                                />

                              )}

                            </Box>

                          )}

                        </TableCell>


                        {/* ACTIONS */}

                        <TableCell>

                          <Box
                            sx={{
                              display:
                                'flex',
                              gap: 0.5,
                            }}
                          >

                            {/* VIEW */}

                            <IconButton
                              size="small"
                              sx={{
                                color:
                                  TEAL_DARK,
                              }}
                              onClick={() =>
                                setViewPoint(
                                  point
                                )
                              }
                              title="View"
                            >

                              <VisibilityIcon
                                fontSize="small"
                              />

                            </IconButton>


                            {/* EDIT */}

                            {canWrite && (

                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() =>
                                  handleEdit(
                                    point
                                  )
                                }
                                title="Edit"
                              >

                                <EditIcon
                                  fontSize="small"
                                />

                              </IconButton>

                            )}


                            {/* DELETE */}

                            {canWrite && (

                              <IconButton
                                size="small"
                                color="error"
                                onClick={() =>
                                  setDeleteDialog(
                                    point._id
                                  )
                                }
                                title="Delete"
                              >

                                <DeleteIcon
                                  fontSize="small"
                                />

                              </IconButton>

                            )}

                          </Box>

                        </TableCell>

                      </TableRow>

                    );

                  }
                )}

              </TableBody>

            </Table>

          </TableContainer>


          {/* ====================================================
              PAGINATION
          ==================================================== */}

          <TablePagination
            component="div"
            count={total}
            page={page}
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
          VIEW DIALOG
      ====================================================== */}

      <ViewDialog
        point={viewPoint}
        onClose={() =>
          setViewPoint(null)
        }
      />


      {/* ======================================================
          DELETE CONFIRMATION
      ====================================================== */}

      <ConfirmDialog
        open={
          !!deleteDialog
        }
        onClose={() =>
          setDeleteDialog(null)
        }
        onConfirm={
          handleDelete
        }
      />

    </Box>
  );
};


export default AgentInformation;