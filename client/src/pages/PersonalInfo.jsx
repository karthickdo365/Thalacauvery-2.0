import { useState, useEffect, useCallback } from 'react';
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
  Divider,
  Stack,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PeopleIcon from '@mui/icons-material/People';

import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { toast } from 'react-toastify';

import api from '../utils/api';
import ExportButton from '../components/ExportButton';
import PageHeader from '../components/PageHeader';
import ConfirmDialog from '../components/ConfirmDialog';
import usePermissions from '../hooks/usePermissions';

import {
  fmtINR,
  TEAL,
  TEAL_DARK,
} from '../utils/constants';

import { useMachine } from '../context/MachineContext';


// ============================================================
// EXPORT COLUMNS
// ============================================================

const exportColumns = [
  {
    header: 'Date',
    accessor: (u) =>
      dayjs(u.date).format('DD/MM/YYYY'),
  },
  {
    header: 'Type',
    accessor: 'type',
  },
  {
    header: 'Name',
    accessor: 'name',
  },
  {
    header: 'Phone',
    accessor: 'phone',
  },
  {
    header: 'Salary',
    accessor: (u) =>
      u.salary || 0,
  },
];


// ============================================================
// TYPE CHIP STYLES
// ============================================================

const TYPE_CHIP = {
  Partner: {
    bgcolor: `${TEAL}20`,
    color: TEAL_DARK,
  },

  Employee: {
    bgcolor: '#e0e7ff',
    color: '#3730a3',
  },

  Broker: {
    bgcolor: '#fef3c7',
    color: '#92400e',
  },
};


// ============================================================
// DEFAULT FORM
// ============================================================

const defaultValues = {
  date: dayjs(),
  type: 'Employee',
  name: '',
  username: '',
  password: '',
  salary: '',
  phone: '',
};


// ============================================================
// COMPONENT
// ============================================================

const PersonalInfo = () => {

  const { canWrite } =
    usePermissions();


  // ==========================================================
  // MACHINE
  // ==========================================================

  const {
    currentMachine,
  } = useMachine();


  const machineLabel =
    currentMachine === 'big'
      ? 'Big Machine'
      : currentMachine === 'small'
        ? 'Small Machine'
        : 'No Machine Selected';


  // ==========================================================
  // STATE
  // ==========================================================

  const [users, setUsers] =
    useState([]);

  const [total, setTotal] =
    useState(0);

  const [page, setPage] =
    useState(0);

  const [rowsPerPage, setRowsPerPage] =
    useState(10);

  const [search, setSearch] =
    useState('');

  const [typeFilter, setTypeFilter] =
    useState('');

  const [editId, setEditId] =
    useState(null);

  const [deleteDialog, setDeleteDialog] =
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
    formState: {
      errors,
    },
  } = useForm({
    defaultValues,
  });


  const selectedType =
    watch('type');


  // ==========================================================
  // FETCH USERS
  // ==========================================================

  const fetchUsers =
    useCallback(
      async () => {

        if (
          currentMachine !== 'big' &&
          currentMachine !== 'small'
        ) {

          setUsers([]);
          setTotal(0);

          return;
        }


        try {

          const { data } =
            await api.get(
              '/users',
              {
                params: {

                  search,

                  type:
                    typeFilter,

                  // IMPORTANT:
                  // Only current machine
                  machineType:
                    currentMachine,

                  page:
                    page + 1,

                  limit:
                    rowsPerPage,

                },
              }
            );


          setUsers(
            data.users || []
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
            'Failed to fetch users'
          );

        }

      },
      [
        search,
        typeFilter,
        page,
        rowsPerPage,
        currentMachine,
      ]
    );


  // ==========================================================
  // LOAD USERS
  // ==========================================================

  useEffect(() => {

    fetchUsers();

  }, [
    fetchUsers,
  ]);


  // ==========================================================
  // RESET WHEN MACHINE CHANGES
  // ==========================================================

  useEffect(() => {

    reset(
      defaultValues
    );

    setEditId(null);
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

      // --------------------------------------------------------
      // MACHINE REQUIRED
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


      try {

        // ------------------------------------------------------
        // MACHINE IS AUTOMATIC
        // ------------------------------------------------------

        const payload = {

          ...formData,

          machineType:
            currentMachine,

          date:
            formData.date?.toISOString?.() ||
            formData.date,

          salary:
            Number(formData.salary) || 0,

          // Keep the current machine explicit on update.
          // The backend should use this to scope the record.
          ...(editId
            ? {
                _id: editId,
              }
            : {}),

        };


        // ------------------------------------------------------
        // UPDATE
        // ------------------------------------------------------

        if (editId) {

          await api.put(
            `/users/${editId}`,
            payload
          );


          toast.success(
            `${machineLabel} user updated successfully`
          );

        }

        // ------------------------------------------------------
        // CREATE
        // ------------------------------------------------------

        else {

          await api.post(
            '/users',
            payload
          );


          toast.success(
            `${machineLabel} user created successfully`
          );

        }


        // ------------------------------------------------------
        // RESET
        // ------------------------------------------------------

        reset(
          defaultValues
        );

        setEditId(null);
        setPage(0);

        fetchUsers();

      } catch (error) {

        console.error(
          error
        );

        toast.error(
          error.response?.data?.message ||
          'Operation failed'
        );

      }

    };


  // ==========================================================
  // EDIT USER
  // ==========================================================

  const handleEdit =
    (user) => {

      // The list is already filtered by the current machine
      // in fetchUsers(). Do NOT reject the record here when
      // machineType is missing from an older API response.
      if (!user || !user._id) {
        toast.error(
          'Invalid user record'
        );

        return;
      }

      if (
        user.machineType &&
        currentMachine &&
        user.machineType !== currentMachine
      ) {

        toast.error(
          'This user belongs to another machine'
        );

        return;
      }

      // Set edit mode first so the button changes to Update.
      setEditId(
        user._id
      );

      // Populate every form field.
      // Password is intentionally blank because passwords
      // should never be loaded back into the edit form.
      reset({

        date:
          user.date
            ? dayjs(user.date)
            : dayjs(),

        type:
          user.type ||
          'Employee',

        name:
          user.name ||
          '',

        username:
          user.username ||
          '',

        password:
          '',

        salary:
          user.salary !== null &&
          user.salary !== undefined
            ? user.salary
            : '',

        phone:
          user.phone ||
          '',

      });

      // Scroll to the form after React has switched to edit mode.
      setTimeout(() => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      }, 50);

    };


  // ==========================================================
  // DELETE USER
  // ==========================================================

  const handleDelete =
    async () => {

      if (!deleteDialog) {
        return;
      }


      // --------------------------------------------------------
      // MACHINE REQUIRED
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


      try {

        // ======================================================
        // THIS IS THE IMPORTANT PART
        // ======================================================

        await api.delete(
          `/users/${deleteDialog}`,
          {
            params: {
              machineType:
                currentMachine,
            },
          }
        );


        toast.success(
          `${machineLabel} user deleted successfully`
        );


        setDeleteDialog(
          null
        );


        fetchUsers();

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
  // RESET FORM
  // ==========================================================

  const handleReset =
    () => {

      reset(
        defaultValues
      );

      setEditId(null);

    };


  // ==========================================================
  // CONDITIONAL FIELDS
  // ==========================================================

  const showCredentials =
    selectedType === 'Partner';


  const showSalary =
    selectedType !== 'Broker';


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <Box
      sx={{
        minHeight: '100%',
        pb: 4,
      }}
    >

      {/* ======================================================
          HEADER
      ====================================================== */}

      {/* <PageHeader
        title="Personal Information"
        subtitle={
          `${machineLabel} - Partners, employees and brokers`
        }
        icon={
          <PeopleIcon />
        }
        actions={

          <Chip
            label={
              machineLabel
            }
            size="small"
            sx={{

              fontWeight: 700,

              bgcolor:
                currentMachine === 'big'
                  ? 'rgba(30,190,165,0.15)'
                  : 'rgba(59,130,246,0.12)',

              color:
                currentMachine === 'big'
                  ? TEAL_DARK
                  : '#2563eb',

            }}
          />

        }
      /> */}


      {/* ======================================================
          NO MACHINE
      ====================================================== */}

      {!currentMachine && (

        <Card
          sx={{
            mb: 2.5,
          }}
        >

          <CardContent>

            <Typography
              color="error"
              fontWeight={600}
            >

              No machine selected.
              Please select Big Machine
              or Small Machine first.

            </Typography>

          </CardContent>

        </Card>

      )}


      {/* ======================================================
          FORM
      ====================================================== */}

      {canWrite &&
        currentMachine && (

          <Card
            elevation={0}
            sx={{
              mb: 2.5,
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              overflow: 'hidden',
              bgcolor: '#fff',
              boxShadow: '0 4px 18px rgba(15,23,42,0.04)',
            }}
          >
            {/* <Box
              sx={{
                px: { xs: 2, md: 3 },
                py: 2,
                bgcolor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: '#0b2942' }}>
                {editId ? 'Update Personal Information' : 'Add Personal Information'}
              </Typography>
              <Typography sx={{ mt: 0.35, fontSize: '0.78rem', color: '#64748b' }}>
                Enter the details below to manage {machineLabel.toLowerCase()} records.
              </Typography>
            </Box> */}

            <CardContent
              sx={{
                p: { xs: 2, md: 3 },
                '& .MuiTextField-root': {
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    minHeight: 44,
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: '0.85rem',
                    backgroundColor: '#fff',
                    px: '4px',
                  },
                  '& .MuiInputLabel-shrink': {
                    transform: 'translate(14px, -9px) scale(0.75)',
                  },
                },
              }}
            >

              <form
                onSubmit={
                  handleSubmit(
                    onSubmit
                  )
                }
              >

                <Grid
                  container
                  spacing={{ xs: 1.5, md: 2 }}
                  alignItems="flex-start"
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
                              InputLabelProps: { shrink: true },
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

                    <TextField
                      fullWidth
                      select
                      label="Type"
                      size="small"
                      {...register(
                        'type'
                      )}
                    >

                      <MenuItem value="Partner">
                        Partner
                      </MenuItem>

                      <MenuItem value="Employee">
                        Employee
                      </MenuItem>

                      <MenuItem value="Broker">
                        Broker
                      </MenuItem>

                    </TextField>

                  </Grid>


                  {/* NAME */}

                  <Grid
                    item
                    xs={12}
                    sm={6}
                    md={3}
                  >

                    <TextField
                      fullWidth
                      label="Name"
                      size="small"
                      {...register(
                        'name',
                        {
                          required:
                            'Name is required',
                        }
                      )}
                      error={
                        !!errors.name
                      }
                      helperText={
                        errors.name?.message
                      }
                    />

                  </Grid>


                  {/* PHONE */}

                  <Grid
                    item
                    xs={12}
                    sm={6}
                    md={3}
                  >

                    <TextField
                      fullWidth
                      label="Phone Number"
                      size="small"
                      {...register(
                        'phone',
                        {
                          required:
                            'Phone number is required',
                        }
                      )}
                      error={
                        !!errors.phone
                      }
                      helperText={
                        errors.phone?.message
                      }
                    />

                  </Grid>


                  {/* USERNAME */}

                  {showCredentials && (

                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={3}
                    >

                      <TextField
                        fullWidth
                        label="Username"
                        size="small"
                        autoComplete="off"
                        {...register(
                          'username'
                        )}
                      />

                    </Grid>

                  )}


                  {/* PASSWORD */}

                  {showCredentials && (

                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={3}
                    >

                      <TextField
                        fullWidth
                        label="Password"
                        type="password"
                        size="small"
                        autoComplete="new-password"
                        {...register(
                          'password'
                        )}
                      />

                    </Grid>

                  )}


                  {/* SALARY */}

                  {showSalary && (

                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={3}
                    >

                      <TextField
                        fullWidth
                        label="Salary"
                        type="number"
                        size="small"
                        {...register(
                          'salary'
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

                  )}


                  {/* BUTTONS */}

                  <Grid item xs={12}>
                    <Divider sx={{ mb: 2 }} />

                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.25}
                      alignItems={{ xs: 'stretch', sm: 'center' }}
                    >
                      <Button
                        type="submit"
                        variant="contained"
                        color="secondary"
                        sx={{
                          minWidth: 120,
                          borderRadius: '9px',
                          textTransform: 'none',
                          fontWeight: 700,
                          boxShadow: 'none',
                        }}
                      >
                        {editId ? 'Update' : 'Submit'}
                      </Button>

                      <Button
                        variant="outlined"
                        color="inherit"
                        onClick={handleReset}
                        sx={{
                          minWidth: 100,
                          borderRadius: '9px',
                          textTransform: 'none',
                          fontWeight: 700,
                          borderColor: '#cbd5e1',
                          color: '#475569',
                        }}
                      >
                        Reset
                      </Button>
                    </Stack>
                  </Grid>

                </Grid>

              </form>

            </CardContent>

          </Card>

        )}


      {/* ======================================================
          LIST
      ====================================================== */}

      {currentMachine && (

        <Card
          elevation={0}
          sx={{
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            overflow: 'hidden',
            bgcolor: '#fff',
            boxShadow: '0 4px 18px rgba(15,23,42,0.04)',
          }}
        >
          <Box
            sx={{
              px: { xs: 2, md: 3 },
              py: 2,
              bgcolor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <Box>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: '#0b2942' }}>
                {machineLabel} Records
              </Typography>
              <Typography sx={{ mt: 0.35, fontSize: '0.78rem', color: '#64748b' }}>
                Search, filter and manage personal information.
              </Typography>
            </Box>
            <Chip
              label={`${total} records`}
              size="small"
              sx={{
                bgcolor: `${TEAL}12`,
                color: TEAL_DARK,
                fontWeight: 700,
                border: `1px solid ${TEAL}25`,
              }}
            />
          </Box>

          <CardContent sx={{ p: { xs: 2, md: 3 } }}>

            {/* FILTERS */}

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
                sm={5}
              >

                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search by name, phone..."
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


              {/* TYPE FILTER */}

              <Grid
                item
                xs={12}
                sm={3}
              >

                <TextField
                  fullWidth
                  select
                  size="small"
                  label="Type Filter"
                  value={
                    typeFilter
                  }
                  onChange={(e) => {

                    setTypeFilter(
                      e.target.value
                    );

                    setPage(0);

                  }}
                >

                  <MenuItem value="">
                    All
                  </MenuItem>

                  <MenuItem value="Partner">
                    Partner
                  </MenuItem>

                  <MenuItem value="Employee">
                    Employee
                  </MenuItem>

                  <MenuItem value="Broker">
                    Broker
                  </MenuItem>

                </TextField>

              </Grid>


              {/* EXPORT */}

              <Grid item>

                <ExportButton
                  data={
                    users
                  }
                  columns={
                    exportColumns
                  }
                  filename={
                    currentMachine === 'big'
                      ? 'big_machine_personal_info'
                      : 'small_machine_personal_info'
                  }
                />

              </Grid>

            </Grid>


            {/* TABLE */}

            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{
                borderRadius: '12px',
                borderColor: '#e2e8f0',
                overflow: 'hidden',
              }}
            >

              <Table
                size="small"
              InputLabelProps={{ shrink: true }}
              >

                <TableHead>

                  <TableRow>

                    {[
                      'Date',
                      'Type',
                      'Name',
                      'Phone',
                      'Salary',
                      ...(canWrite
                        ? ['Actions']
                        : []),
                    ].map(
                      (header) => (

                        <TableCell
                          key={header}
                          sx={{
                            bgcolor: '#0b2942',
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            whiteSpace: 'nowrap',
                            borderBottom: 'none',
                          }}
                        >
                          {header}
                        </TableCell>

                      )
                    )}

                  </TableRow>

                </TableHead>


                <TableBody>

                  {/* EMPTY */}

                  {users.length ===
                    0 && (

                    <TableRow>

                      <TableCell
                        colSpan={
                          canWrite
                            ? 6
                            : 5
                        }
                        align="center"
                        sx={{
                          color:
                            'text.secondary',
                          py: 3,
                        }}
                      >

                        No records found
                        for {machineLabel}

                      </TableCell>

                    </TableRow>

                  )}


                  {/* USERS */}

                  {users.map(
                    (user) => (

                      <TableRow
                        key={
                          user._id
                        }
                        hover
                        sx={{
                          '&:last-child td': { borderBottom: 0 },
                          '&:hover': { bgcolor: '#f8fafc' },
                        }}
                      >

                        {/* DATE */}

                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {dayjs(
                            user.date
                          ).format(
                            'DD/MM/YYYY'
                          )}

                        </TableCell>


                        {/* TYPE */}

                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Chip
                            label={
                              user.type
                            }
                            size="small"
                            sx={{
                              ...TYPE_CHIP[
                                user.type
                              ],
                              height: 22,
                              fontSize:
                                '0.72rem',
                            }}
                          />

                        </TableCell>


                        {/* NAME */}

                        <TableCell
                          sx={{
                            fontWeight: 600,
                          }}
                        >

                          {user.name}

                        </TableCell>


                        {/* PHONE */}

                        <TableCell sx={{ color: '#475569', fontSize: '0.84rem' }}>
                          {user.phone}
                        </TableCell>


                        {/* SALARY */}

                        <TableCell>

                          {user.type !==
                          'Broker'

                            ? fmtINR(
                                user.salary
                              )

                            : '—'}

                        </TableCell>


                        {/* ACTIONS */}

                        {canWrite && (

                          <TableCell>

                            <IconButton
                              size="small"
                              color="primary"
                              sx={{
                                mr: 0.5,
                                bgcolor: 'rgba(15,41,66,0.06)',
                              }}
                              onClick={() =>
                                handleEdit(
                                  user
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
                              sx={{ bgcolor: 'rgba(211,47,47,0.05)' }}
                              onClick={() =>
                                setDeleteDialog(
                                  user._id
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

      )}


      {/* ======================================================
          DELETE DIALOG
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
        message={
          `Are you sure you want to delete this ${machineLabel} record?`
        }
      />

    </Box>

  );
};


export default PersonalInfo;