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
  Chip,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import InventoryIcon from '@mui/icons-material/Inventory';
import UploadFileIcon from '@mui/icons-material/UploadFile';

import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { toast } from 'react-toastify';

import api from '../utils/api';

import ExportButton from '../components/ExportButton';
import PageHeader from '../components/PageHeader';
import ConfirmDialog from '../components/ConfirmDialog';

import usePermissions from '../hooks/usePermissions';
import { fmtINR } from '../utils/constants';


// ============================================================
// EXPORT COLUMNS
// ============================================================

const exportColumns = [
  {
    header: 'Date',
    accessor: (m) =>
      dayjs(m.date).format('DD/MM/YYYY'),
  },
  {
    header: 'Type',
    accessor: 'type',
  },
  {
    header: 'Description',
    accessor: (m) =>
      m.description || '',
  },
  {
    header: 'Quantity',
    accessor: 'quantity',
  },
  {
    header: 'Cost/L',
    accessor: 'costPerLiter',
  },
  {
    header: 'Total',
    accessor: 'totalPrice',
  },
  {
    header: 'Amount',
    accessor: 'amount',
  },
];


// ============================================================
// DEFAULT FORM
// ============================================================

const getDefaultValues = () => ({
  date: dayjs(),
  type: 'Diesel',
  quantity: '',
  costPerLiter: '',
  amount: '',
  description: '',
});


// ============================================================
// MATERIAL TYPES
// ============================================================

const MATERIAL_TYPES = [
  'Diesel',
  'Petrol',
  'Pipe',
  'Bit',
  'Hammer',
  'Others',
];


// ============================================================
// COMPONENT
// ============================================================

const Materials = () => {

  // ==========================================================
  // PERMISSIONS
  // ==========================================================

  const { canWrite } = usePermissions();


  // ==========================================================
  // CURRENT MACHINE
  // ==========================================================

  const { currentMachine } = useMachine();


  const machineLabel =
    currentMachine === 'big'
      ? 'Big Machine'
      : 'Small Machine';


  // ==========================================================
  // STATE
  // ==========================================================

  const [materials, setMaterials] =
    useState([]);

  const [total, setTotal] =
    useState(0);

  const [page, setPage] =
    useState(0);

  const [rowsPerPage, setRowsPerPage] =
    useState(10);

  const [search, setSearch] =
    useState('');

  const [startDate, setStartDate] =
    useState(null);

  const [endDate, setEndDate] =
    useState(null);

  const [editId, setEditId] =
    useState(null);

  const [deleteDialog, setDeleteDialog] =
    useState(null);

  const [billFile, setBillFile] =
    useState(null);


  // ==========================================================
  // FORM
  // ==========================================================

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
  } = useForm({
    defaultValues:
      getDefaultValues(),
  });


  // ==========================================================
  // WATCH VALUES
  // ==========================================================

  const quantity =
    watch('quantity');

  const costPerLiter =
    watch('costPerLiter');

  const amount =
    watch('amount');

  const selectedType =
    watch('type');


  const isOthers =
    selectedType === 'Others';


  // ==========================================================
  // CALCULATE TOTAL
  // ==========================================================

  const normalTotal =
    (Number(quantity) || 0) *
    (Number(costPerLiter) || 0);


  const othersTotal =
    Number(amount) || 0;


  const totalPrice =
    isOthers
      ? othersTotal
      : normalTotal;


  // ==========================================================
  // FETCH MATERIALS
  // ==========================================================

  const fetchMaterials =
    useCallback(
      async () => {

        if (
          currentMachine !== 'big' &&
          currentMachine !== 'small'
        ) {

          setMaterials([]);
          setTotal(0);

          return;
        }


        try {

          const params = {
            search,
            page: page + 1,
            limit: rowsPerPage,

            // IMPORTANT:
            // Only current machine.
            machineType:
              currentMachine,
          };


          if (startDate) {

            params.startDate =
              startDate
                .startOf('day')
                .toISOString();

          }


          if (endDate) {

            params.endDate =
              endDate
                .endOf('day')
                .toISOString();

          }


          const { data } =
            await api.get(
              '/materials',
              {
                params,
              }
            );


          setMaterials(
            data.materials || []
          );

          setTotal(
            data.total || 0
          );

        } catch (error) {

          console.error(
            'Fetch materials error:',
            error
          );

          toast.error(
            error.response?.data?.message ||
            'Failed to fetch materials'
          );

        }

      },
      [
        currentMachine,
        search,
        page,
        rowsPerPage,
        startDate,
        endDate,
      ]
    );


  // ==========================================================
  // LOAD DATA
  // ==========================================================

  useEffect(() => {

    fetchMaterials();

  }, [
    fetchMaterials,
  ]);


  // ==========================================================
  // RESET FORM WHEN MACHINE CHANGES
  // ==========================================================

  useEffect(() => {

    reset(
      getDefaultValues()
    );

    setEditId(null);
    setBillFile(null);
    setPage(0);

  }, [
    currentMachine,
    reset,
  ]);


  // ==========================================================
  // SUBMIT
  // ==========================================================

  const onSubmit =
    async (formData) => {

      if (
        currentMachine !== 'big' &&
        currentMachine !== 'small'
      ) {

        toast.error(
          'Please select a machine first'
        );

        return;
      }


      try {

        const form =
          new FormData();


        // ------------------------------------------------------
        // DATE
        // ------------------------------------------------------

        form.append(
          'date',
          formData.date
            ?.toISOString?.() ||
          formData.date
        );


        // ------------------------------------------------------
        // TYPE
        // ------------------------------------------------------

        form.append(
          'type',
          formData.type
        );


        // ------------------------------------------------------
        // MACHINE
        // NOT SHOWN IN UI.
        // Automatically saved.
        // ------------------------------------------------------

        form.append(
          'machineType',
          currentMachine
        );


        // ------------------------------------------------------
        // OTHERS
        // ------------------------------------------------------

        if (
          formData.type === 'Others'
        ) {

          if (
            !formData.description?.trim()
          ) {

            toast.error(
              'Description is required'
            );

            return;
          }


          if (
            formData.amount === '' ||
            formData.amount === null ||
            formData.amount === undefined
          ) {

            toast.error(
              'Amount is required'
            );

            return;
          }


          form.append(
            'description',
            formData.description.trim()
          );


          form.append(
            'amount',
            String(
              Number(formData.amount) || 0
            )
          );


          form.append(
            'totalPrice',
            String(
              Number(formData.amount) || 0
            )
          );

        }


        // ------------------------------------------------------
        // NORMAL TYPES
        // ------------------------------------------------------

        else {

          form.append(
            'quantity',
            String(
              Number(formData.quantity) || 0
            )
          );


          form.append(
            'costPerLiter',
            String(
              Number(formData.costPerLiter) || 0
            )
          );


          form.append(
            'totalPrice',
            String(
              (
                Number(formData.quantity) || 0
              ) *
              (
                Number(formData.costPerLiter) || 0
              )
            )
          );


          // Clear Others fields
          form.append(
            'description',
            ''
          );

          form.append(
            'amount',
            '0'
          );

        }


        // ------------------------------------------------------
        // BILL
        // ------------------------------------------------------

        if (billFile) {

          form.append(
            'billFile',
            billFile
          );

        }


        // ------------------------------------------------------
        // UPDATE
        // ------------------------------------------------------

        if (editId) {

          await api.put(
            `/materials/${editId}`,
            form
          );


          toast.success(
            `${machineLabel} material updated`
          );

        }


        // ------------------------------------------------------
        // CREATE
        // ------------------------------------------------------

        else {

          await api.post(
            '/materials',
            form
          );


          toast.success(
            `${machineLabel} material added`
          );

        }


        // ------------------------------------------------------
        // RESET
        // ------------------------------------------------------

        reset(
          getDefaultValues()
        );

        setEditId(null);
        setBillFile(null);


        // ------------------------------------------------------
        // REFRESH
        // ------------------------------------------------------

        fetchMaterials();

      } catch (error) {

        console.error(
          'Save material error:',
          error
        );

        toast.error(
          error.response?.data?.message ||
          'Operation failed'
        );

      }

    };


  // ==========================================================
  // VIEW BILL
  // ==========================================================

  const handleViewBill =
    async (material) => {

      if (!material?.billFile) {

        toast.error(
          'Bill is not available'
        );

        return;

      }


      // IMPORTANT:
      // Open the tab immediately from the
      // user's click event.
      //
      // This prevents Chrome from blocking
      // it as a popup.
      const billWindow =
        window.open(
          'about:blank',
          '_blank'
        );


      if (!billWindow) {

        toast.error(
          'Please allow pop-ups to view the bill'
        );

        return;

      }


      // --------------------------------------------------------
      // LOADING PAGE
      // --------------------------------------------------------

      billWindow.document.write(`
        <html>
          <head>
            <title>Loading Bill...</title>

            <style>
              body {
                margin: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                font-family: Arial, sans-serif;
                background: #f5f5f5;
              }

              .loading {
                text-align: center;
                color: #333;
              }

              .spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #ddd;
                border-top-color: #14b8a6;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 15px;
              }

              @keyframes spin {
                to {
                  transform: rotate(360deg);
                }
              }
            </style>
          </head>

          <body>
            <div class="loading">
              <div class="spinner"></div>
              <div>Loading bill...</div>
            </div>
          </body>
        </html>
      `);

      billWindow.document.close();


      try {

        // ------------------------------------------------------
        // GET FILE NAME
        // ------------------------------------------------------

        // Backend stores something like:
        //
        // /uploads/materials/123456-bill.jpg
        //
        // We only need:
        //
        // 123456-bill.jpg

        const filename =
          material.billFile
            .split('/')
            .pop();


        if (!filename) {

          throw new Error(
            'Invalid bill filename'
          );

        }


        // ------------------------------------------------------
        // FETCH BILL
        // ------------------------------------------------------

        // This uses the existing Axios instance.
        //
        // The backend endpoint is:
        //
        // GET /materials/bill/:filename
        //
        // responseType blob is important because
        // the response is an image/PDF file.

        const response =
          await api.get(
            `/materials/bill/${encodeURIComponent(filename)}`,
            {
              responseType: 'blob',
            }
          );


        // ------------------------------------------------------
        // CONTENT TYPE
        // ------------------------------------------------------

        const contentType =
          response.headers?.[
            'content-type'
          ] ||
          'application/octet-stream';


        // ------------------------------------------------------
        // CREATE BLOB
        // ------------------------------------------------------

        const blob =
          new Blob(
            [response.data],
            {
              type: contentType,
            }
          );


        // ------------------------------------------------------
        // CREATE TEMPORARY URL
        // ------------------------------------------------------

        const blobUrl =
          URL.createObjectURL(
            blob
          );


        // ------------------------------------------------------
        // OPEN BILL IN ALREADY OPENED TAB
        // ------------------------------------------------------

        billWindow.location.href =
          blobUrl;


        // ------------------------------------------------------
        // CLEANUP
        // ------------------------------------------------------

        setTimeout(
          () => {

            URL.revokeObjectURL(
              blobUrl
            );

          },
          10 * 60 * 1000
        );

      } catch (error) {

        console.error(
          'View bill error:',
          error
        );


        // ------------------------------------------------------
        // ERROR MESSAGE
        // ------------------------------------------------------

        let message =
          'The bill file could not be loaded.';


        // Sometimes the backend returns JSON
        // even though responseType is blob.
        //
        // Try to read that JSON error.

        if (
          error.response?.data instanceof Blob
        ) {

          try {

            const text =
              await error.response.data.text();

            if (text) {

              const parsed =
                JSON.parse(text);

              message =
                parsed.message ||
                message;

            }

          } catch (
            parseError
          ) {

            console.error(
              'Could not parse bill error:',
              parseError
            );

          }

        }
        else {

          message =
            error.response?.data?.message ||
            error.message ||
            message;

        }


        // ------------------------------------------------------
        // SHOW ERROR IN TAB
        // ------------------------------------------------------

        try {

          billWindow.document.open();

          billWindow.document.write(`
            <html>

              <head>
                <title>Bill Error</title>
              </head>

              <body
                style="
                  font-family: Arial, sans-serif;
                  padding: 40px;
                  text-align: center;
                "
              >

                <h2>
                  Unable to open bill
                </h2>

                <p>
                  ${message}
                </p>

                <p>
                  Please close this tab and try again.
                </p>

              </body>

            </html>
          `);

          billWindow.document.close();

        } catch (
          windowError
        ) {

          console.error(
            'Bill window error:',
            windowError
          );

        }


        toast.error(
          message
        );

      }

    };


  // ==========================================================
  // EDIT
  // ==========================================================

  const handleEdit =
    (material) => {

      // Do not allow another machine's data.
      if (
        material.machineType &&
        material.machineType !==
          currentMachine
      ) {

        toast.error(
          'This material belongs to another machine'
        );

        return;
      }


      setEditId(
        material._id
      );


      reset({

        date:
          dayjs(material.date),

        type:
          material.type,

        quantity:
          material.quantity ??
          '',

        costPerLiter:
          material.costPerLiter ??
          '',

        amount:
          material.amount ??
          '',

        description:
          material.description ||
          '',

      });


      setBillFile(null);


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

      if (!deleteDialog) {
        return;
      }


      try {

        await api.delete(
          `/materials/${deleteDialog}`,
          {
            params: {
              machineType:
                currentMachine,
            },
          }
        );


        toast.success(
          `${machineLabel} material deleted`
        );


        setDeleteDialog(
          null
        );


        fetchMaterials();

      } catch (error) {

        console.error(
          'Delete material error:',
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

  const handleReset =
    () => {

      reset(
        getDefaultValues()
      );

      setEditId(null);
      setBillFile(null);

    };


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <Box>

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      {/* <PageHeader
        title="Materials"
        subtitle={
          `${machineLabel} - Diesel, petrol, pipes, bit ,hammer and other expenses`
        }
        icon={
          <InventoryIcon />
        }
        actions={

          <Chip
            label={
              machineLabel
            }
            size="small"
            color="secondary"
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
                    TYPE
                ================================================== */}

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                >

                  <Controller
                    name="type"
                    control={control}
                    render={({
                      field,
                    }) => (

                      <TextField
                        {...field}
                        fullWidth
                        select
                        label="Type"
                        size="small"
                      >

                        {MATERIAL_TYPES.map(
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
                    NORMAL MATERIAL FIELDS
                ================================================== */}

                {!isOthers && (

                  <>

                    {/* QUANTITY */}

                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={3}
                    >

                      <TextField
                        fullWidth
                        label="Quantity / Liter"
                        type="number"
                        size="small"
                        {...register(
                          'quantity',
                          {
                            required: true,
                          }
                        )}
                        inputProps={{
                          min: 0,
                          step: '0.01',
                        }}
                        onWheel={(e) =>
                          e.target.blur()
                        }
                      />

                    </Grid>


                    {/* RATE */}

                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={3}
                    >

                      <TextField
                        fullWidth
                        label="Cost Per Liter / Unit"
                        type="number"
                        size="small"
                        {...register(
                          'costPerLiter',
                          {
                            required: true,
                          }
                        )}
                        inputProps={{
                          min: 0,
                          step: '0.01',
                        }}
                        onWheel={(e) =>
                          e.target.blur()
                        }
                      />

                    </Grid>


                    {/* TOTAL */}

                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={3}
                    >

                      <TextField
                        fullWidth
                        label="Total Price"
                        size="small"
                        value={
                          fmtINR(
                            totalPrice
                          )
                        }
                        InputProps={{
                          readOnly: true,
                        }}
                      />

                    </Grid>

                  </>

                )}


                {/* ==================================================
                    OTHERS FIELDS
                ================================================== */}

                {isOthers && (

                  <>

                    {/* DESCRIPTION */}

                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={4}
                    >

                      <TextField
                        fullWidth
                        label="Description"
                        placeholder="Enter expense description"
                        size="small"
                        {...register(
                          'description',
                          {
                            required:
                              'Description is required',
                          }
                        )}
                      />

                    </Grid>


                    {/* AMOUNT */}

                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={3}
                    >

                      <TextField
                        fullWidth
                        label="Amount"
                        type="number"
                        size="small"
                        {...register(
                          'amount',
                          {
                            required: true,
                          }
                        )}
                        inputProps={{
                          min: 0,
                          step: '0.01',
                        }}
                        onWheel={(e) =>
                          e.target.blur()
                        }
                      />

                    </Grid>


                    {/* TOTAL */}

                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={3}
                    >

                      <TextField
                        fullWidth
                        label="Total Amount"
                        size="small"
                        value={
                          fmtINR(
                            totalPrice
                          )
                        }
                        InputProps={{
                          readOnly: true,
                        }}
                      />

                    </Grid>

                  </>

                )}


                {/* ==================================================
                    UPLOAD BILL
                ================================================== */}

                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={3}
                >

                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    size="small"
                    color="secondary"
                    startIcon={
                      <UploadFileIcon />
                    }
                    sx={{
                      height: 40,
                    }}
                  >

                    Upload Bill

                    <input
                      type="file"
                      hidden
                      accept="image/*,.pdf"
                      onChange={(e) => {

                        setBillFile(
                          e.target.files?.[0] ||
                          null
                        );

                      }}
                    />

                  </Button>


                  {billFile && (

                    <Typography
                      variant="caption"
                      display="block"
                      noWrap
                      sx={{
                        mt: 0.5,
                      }}
                    >
                      {billFile.name}
                    </Typography>

                  )}

                </Grid>


                {/* ==================================================
                    BUTTONS
                ================================================== */}

                <Grid
                  item
                  xs={12}
                >

                  <Button
                    type="submit"
                    variant="contained"
                    color="secondary"
                    sx={{
                      mr: 1,
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

                </Grid>

              </Grid>

            </Box>

          </CardContent>

        </Card>

      )}


      {/* ======================================================
          MATERIAL LIST
      ====================================================== */}

      <Card>

        <CardContent>

          {/* ==================================================
              FILTERS
          ================================================== */}

          <Grid
            container
            spacing={2}
            sx={{
              mb: 2,
            }}
            alignItems="center"
          >

            {/* SEARCH */}

            <Grid
              item
              xs={12}
              sm={4}
            >

              <TextField
                fullWidth
                size="small"
                placeholder={
                  `Search ${machineLabel.toLowerCase()} materials...`
                }
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


            {/* FROM DATE */}

            <Grid
              item
              xs={6}
              sm={3}
            >

              <DatePicker
                label="From Date"
                value={
                  startDate
                }
                onChange={(
                  value
                ) => {

                  setStartDate(
                    value
                  );

                  setPage(0);

                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small',
                  },
                }}
              />

            </Grid>


            {/* TO DATE */}

            <Grid
              item
              xs={6}
              sm={3}
            >

              <DatePicker
                label="To Date"
                value={
                  endDate
                }
                onChange={(
                  value
                ) => {

                  setEndDate(
                    value
                  );

                  setPage(0);

                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small',
                  },
                }}
              />

            </Grid>


            {/* EXPORT */}

            <Grid
              item
              xs={12}
              sm={2}
            >

              <ExportButton
                data={
                  materials
                }
                columns={
                  exportColumns
                }
                filename={
                  `${currentMachine}-materials`
                }
              />

            </Grid>

          </Grid>


          {/* ==================================================
              TABLE
          ================================================== */}

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
                    'Type',
                    'Description',
                    'Quantity',
                    'Cost/L',
                    'Total / Amount',
                    'Bill',
                    ...(canWrite
                      ? ['Actions']
                      : []),
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

                {materials.length ===
                  0 && (

                  <TableRow>

                    <TableCell
                      colSpan={
                        canWrite
                          ? 8
                          : 7
                      }
                      align="center"
                      sx={{
                        color:
                          'text.secondary',
                        py: 3,
                      }}
                    >

                      No {machineLabel.toLowerCase()}
                      material records found.

                    </TableCell>

                  </TableRow>

                )}


                {/* DATA */}

                {materials.map(
                  (material) => (

                    <TableRow
                      key={
                        material._id
                      }
                      hover
                    >

                      {/* DATE */}

                      <TableCell>

                        {dayjs(
                          material.date
                        ).format(
                          'DD/MM/YYYY'
                        )}

                      </TableCell>


                      {/* TYPE */}

                      <TableCell>

                        {material.type}

                      </TableCell>


                      {/* DESCRIPTION */}

                      <TableCell>

                        {material.type ===
                        'Others'
                          ? (
                            material.description ||
                            '—'
                          )
                          : '—'}

                      </TableCell>


                      {/* QUANTITY */}

                      <TableCell>

                        {material.type ===
                        'Others'
                          ? '—'
                          : material.quantity}

                      </TableCell>


                      {/* RATE */}

                      <TableCell>

                        {material.type ===
                        'Others'
                          ? '—'
                          : fmtINR(
                              material.costPerLiter
                            )}

                      </TableCell>


                      {/* TOTAL */}

                      <TableCell
                        sx={{
                          fontWeight:
                            600,
                        }}
                      >

                        {fmtINR(
                          material.type ===
                            'Others'
                            ? material.amount
                            : material.totalPrice
                        )}

                      </TableCell>


                      {/* BILL */}

                      <TableCell>

                        {material.billFile ? (

                          <IconButton
                            size="small"
                            color="secondary"
                            title="View Bill"
                            onClick={() =>
                              handleViewBill(
                                material
                              )
                            }
                          >

                            <VisibilityIcon
                              fontSize="small"
                            />

                          </IconButton>

                        ) : (

                          '—'

                        )}

                      </TableCell>


                      {/* ACTIONS */}

                      {canWrite && (

                        <TableCell>

                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() =>
                              handleEdit(
                                material
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
                                material._id
                              )
                            }
                          >

                            <DeleteIcon
                              fontSize="small"
                            />

                          </IconButton>

                        </TableCell>

                      )}

                    </TableRow>

                  )
                )}

              </TableBody>

            </Table>

          </TableContainer>


          {/* ==================================================
              PAGINATION
          ================================================== */}

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
            ) => {

              setPage(
                newPage
              );

            }}
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
          DELETE CONFIRMATION
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
        message="Delete this material record?"
      />

    </Box>

  );
};


export default Materials;