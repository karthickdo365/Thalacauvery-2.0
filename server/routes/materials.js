import { useState, useEffect, useCallback } from 'react';
import { useMachine } from '../context/MachineContext';
import { useForm, Controller } from 'react-hook-form' ;

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

const BIG_MATERIAL_TYPES = [
  'Diesel',
  'Pipe Outer',
  'Pipe J1',
  'Bit',
  'Petrol',
  'Hammer',
  'Others',
];

const SMALL_MATERIAL_TYPES = [
  'Diesel',
  'Pipe Outer',
  'Pipe Inner',
  'Pipe Small',
  'Bit',
  'Hammer',
  'Others',
];


// ============================================================
// COMPONENT
// ============================================================

const Materials = () => {

  const { canWrite } = usePermissions();

  const { currentMachine } = useMachine();

  const machineLabel =
    currentMachine === 'big'
      ? 'Big Machine'
      : 'Small Machine';

  const materialTypes =
    currentMachine === 'big'
      ? BIG_MATERIAL_TYPES
      : SMALL_MATERIAL_TYPES;


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

          const data =
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
            error?.message ||
            error?.response?.data?.message ||
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
  // RESET WHEN MACHINE CHANGES
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
  // CLEAN PREVIEW URL
  // ==========================================================

  useEffect(() => {

    return () => {

      if (
        billPreview.url
      ) {

        try {

          URL.revokeObjectURL(
            billPreview.url
          );

        } catch {
          // Ignore cleanup errors.
        }

      }

    };

  }, [
    billPreview.url,
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


        // DATE

        form.append(
          'date',
          formData.date
            ?.toISOString?.() ||
          formData.date
        );


        // TYPE

        form.append(
          'type',
          formData.type
        );


        // MACHINE

        form.append(
          'machineType',
          currentMachine
        );


        // OTHERS

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


        // NORMAL TYPES

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

          form.append(
            'description',
            ''
          );

          form.append(
            'amount',
            '0'
          );

        }


        // BILL

        if (billFile) {

          form.append(
            'billFile',
            billFile
          );

        }


        // UPDATE

        if (editId) {

          await api.put(
            `/materials/${editId}`,
            form
          );

          toast.success(
            `${machineLabel} material updated`
          );

        }


        // CREATE

        else {

          await api.post(
            '/materials',
            form
          );

          toast.success(
            `${machineLabel} material added`
          );

        }


        // RESET

        reset(
          getDefaultValues()
        );

        setEditId(null);
        setBillFile(null);


        // REFRESH

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
        String(
          material.billFile
        )
          .split('/')
          .filter(Boolean)
          .pop();

      if (!filename) {

        toast.error(
          'Invalid bill filename'
        );

        return;
      }


      if (billPreview.url) {

        try {

          URL.revokeObjectURL(
            billPreview.url
          );

        } catch {
          // Ignore cleanup errors.
        }

      }


      setBillPreview({
        open: true,
        url: '',
        type: '',
        name: filename,
        loading: true,
        error: '',
      });


      try {

        const response =
          await api.get(
            `/materials/bill/${encodeURIComponent(filename)}`,
            {
              responseType: 'blob',
            }
          );


        let blob;


        if (
          response instanceof Blob
        ) {

          blob = response;

        }

        else if (
          response?.data instanceof Blob
        ) {

          blob = response.data;

        }

        else {

          blob =
            new Blob(
              [response],
              {
                type:
                  response?.type ||
                  'application/octet-stream',
              }
            );

        }


        let contentType =
          blob.type ||
          '';


        if (
          !contentType ||
          contentType ===
            'application/octet-stream'
        ) {

          const lowerName =
            filename.toLowerCase();


          if (
            lowerName.endsWith('.pdf')
          ) {

            contentType =
              'application/pdf';

          }

          else if (
            lowerName.endsWith('.jpg') ||
            lowerName.endsWith('.jpeg')
          ) {

            contentType =
              'image/jpeg';

          }

          else if (
            lowerName.endsWith('.png')
          ) {

            contentType =
              'image/png';

          }

          else if (
            lowerName.endsWith('.gif')
          ) {

            contentType =
              'image/gif';

          }

          else if (
            lowerName.endsWith('.webp')
          ) {

            contentType =
              'image/webp';

          }

        }


        if (
          contentType &&
          blob.type !== contentType
        ) {

          blob =
            new Blob(
              [blob],
              {
                type: contentType,
              }
            );

        }


        const blobUrl =
          URL.createObjectURL(
            blob
          );


        setBillPreview({
          open: true,
          url: blobUrl,
          type:
            contentType ||
            'application/octet-stream',
          name: filename,
          loading: false,
          error: '',
        });


      } catch (error) {

        console.error(
          'View bill error:',
          error
        );


        let message =
          'The bill file could not be loaded.';


        if (
          error?.data instanceof Blob
        ) {

          try {

            const text =
              await error.data.text();

            if (text) {

              try {

                const parsed =
                  JSON.parse(text);

                message =
                  parsed.message ||
                  message;

              } catch {

                if (
                  text.length < 300
                ) {

                  message = text;

                }

              }

            }

          } catch {
            // Keep default message.
          }

        }

        else {

          message =
            error?.message ||
            error?.response?.data?.message ||
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
  // CLOSE BILL
  // ==========================================================

  const handleCloseBill =
    () => {

      if (
        billPreview.url
      ) {

        try {

          URL.revokeObjectURL(
            billPreview.url
          );

        } catch {
          // Ignore cleanup errors.
        }

      }

      setBillPreview({
        open: false,
        url: '',
        type: '',
        name: '',
        loading: false,
        error: '',
      });

    };


  // ==========================================================
  // EDIT
  // ==========================================================

  const handleEdit =
    (material) => {

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

                {/* DATE */}

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


                {/* TYPE */}

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

                        {materialTypes.map(
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


                {/* NORMAL MATERIAL FIELDS */}

                {!isOthers && (

                  <>

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


                {/* OTHERS FIELDS */}

                {isOthers && (

                  <>

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


                {/* UPLOAD BILL */}

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


                {/* BUTTONS */}

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
            (
              billPreview.type ===
                'application/pdf' ||
              billPreview.type.startsWith(
                'application/pdf;'
              )
            ) && (

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
            !billPreview.type.startsWith(
              'application/pdf'
            ) && (

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
