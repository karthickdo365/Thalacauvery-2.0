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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
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

  // Bill preview popup state.
  // The bill is loaded as a Blob through the authenticated API,
  // then displayed inside this page instead of opening another tab.
  const [billPreview, setBillPreview] =
    useState({
      open: false,
      url: '',
      type: '',
      name: '',
      loading: false,
    });


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

      const filename =
        material.billFile
          .split('/')
          .pop();

      if (!filename) {

        toast.error(
          'Invalid bill filename'
        );

        return;
      }

      // Open the popup immediately inside the page.
      // No window.open(), no new tab, no browser popup blocker.
      setBillPreview({
        open: true,
        url: '',
        type: '',
        name: filename,
        loading: true,
      });

      try {

        const response =
          await api.get(
            `/materials/bill/${encodeURIComponent(filename)}`,
            {
              responseType: 'blob',
            }
          );

        const contentType =
          response.headers?.[
            'content-type'
          ] ||
          'application/octet-stream';

        const blob =
          new Blob(
            [response.data],
            {
              type: contentType,
            }
          );

        const blobUrl =
          URL.createObjectURL(blob);

        setBillPreview({
          open: true,
          url: blobUrl,
          type: contentType,
          name: filename,
          loading: false,
        });

      } catch (error) {

        console.error(
          'View bill error:',
          error
        );

        let message =
          'The bill file could not be loaded.';

        if (
          error.response?.data instanceof Blob
        ) {

          try {

            const text =
              await error.response.data.text();

            if (text) {

              try {

                const parsed =
                  JSON.parse(text);

                message =
                  parsed.message ||
                  message;

              } catch {

                if (text.length < 300) {
                  message = text;
                }

              }

            }

          } catch (parseError) {

            console.error(
              'Could not parse bill error:',
              parseError
            );

          }

        } else {

          message =
            error.response?.data?.message ||
            error.message ||
            message;

        }

        setBillPreview({
          open: true,
          url: '',
          type: 'error',
          name: filename,
          loading: false,
          error: message,
        });

        toast.error(
          message
        );
      }
    };


  // ==========================================================
  // CLOSE BILL POPUP
  // ==========================================================

  const handleCloseBill =
    () => {

      if (
        billPreview.url
      ) {

        URL.revokeObjectURL(
          billPreview.url
        );
      }

      setBillPreview({
        open: false,
        url: '',
        type: '',
        name: '',
        loading: false,
      });
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
          BILL PREVIEW POPUP
      ====================================================== */}

      <Dialog
        open={billPreview.open}
        onClose={handleCloseBill}
        fullWidth
        maxWidth="lg"
        scroll="paper"
        PaperProps={{
          sx: {
            borderRadius: 2,
            minHeight: {
              xs: '70vh',
              md: '80vh',
            },
          },
        }}
      >

        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pr: 1,
          }}
        >

          <Typography
            component="span"
            sx={{
              fontWeight: 700,
              fontSize: '1.05rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              pr: 2,
            }}
          >
            Bill Preview
          </Typography>

          <IconButton
            onClick={handleCloseBill}
            size="small"
            aria-label="Close bill"
          >
            <CloseIcon />
          </IconButton>

        </DialogTitle>


        <DialogContent
          dividers
          sx={{
            p: {
              xs: 1,
              md: 2,
            },
            backgroundColor: '#f5f7fa',
            minHeight: {
              xs: '60vh',
              md: '70vh',
            },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >

          {billPreview.loading && (

            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '50vh',
                gap: 2,
              }}
            >

              <Box
                sx={{
                  width: 42,
                  height: 42,
                  border: '4px solid #ddd',
                  borderTopColor: '#14b8a6',
                  borderRadius: '50%',
                  animation:
                    'materialsBillSpin 1s linear infinite',
                  '@keyframes materialsBillSpin': {
                    from: {
                      transform: 'rotate(0deg)',
                    },
                    to: {
                      transform: 'rotate(360deg)',
                    },
                  },
                }}
              />

              <Typography
                color="text.secondary"
              >
                Loading bill...
              </Typography>

            </Box>

          )}


          {!billPreview.loading &&
            billPreview.type === 'error' && (

            <Box
              sx={{
                textAlign: 'center',
                py: 8,
                px: 3,
              }}
            >

              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  mb: 1,
                }}
              >
                Unable to open bill
              </Typography>

              <Typography
                color="text.secondary"
              >
                {billPreview.error ||
                  'The bill file could not be loaded.'}
              </Typography>

            </Box>

          )}


          {!billPreview.loading &&
            billPreview.url &&
            billPreview.type.startsWith('image/') && (

            <Box
              component="img"
              src={billPreview.url}
              alt="Bill"
              sx={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '68vh',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: 1,
                boxShadow:
                  '0 2px 12px rgba(0,0,0,0.12)',
                backgroundColor: '#fff',
              }}
            />

          )}


          {!billPreview.loading &&
            billPreview.url &&
            billPreview.type === 'application/pdf' && (

            <Box
              component="iframe"
              src={billPreview.url}
              title="Bill PDF Preview"
              sx={{
                width: '100%',
                height: '68vh',
                border: 0,
                borderRadius: 1,
                backgroundColor: '#fff',
              }}
            />

          )}


          {!billPreview.loading &&
            billPreview.url &&
            !billPreview.type.startsWith('image/') &&
            billPreview.type !== 'application/pdf' && (

            <Box
              sx={{
                width: '100%',
                height: '60vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                backgroundColor: '#fff',
                borderRadius: 1,
              }}
            >

              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                }}
              >
                Bill loaded
              </Typography>

              <Typography
                color="text.secondary"
                align="center"
              >
                This file type cannot be previewed directly.
              </Typography>

              <Button
                variant="contained"
                color="secondary"
                href={billPreview.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open File
              </Button>

            </Box>

          )}

        </DialogContent>


        <DialogActions
          sx={{
            px: 2,
            py: 1.5,
          }}
        >

          <Button
            variant="outlined"
            onClick={handleCloseBill}
          >
            Close
          </Button>

        </DialogActions>

      </Dialog>


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