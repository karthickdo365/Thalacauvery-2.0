import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

export const fetchDashboardStats = createAsyncThunk(
  'dashboard/fetchStats',
  async (machineType, { rejectWithValue }) => {
    try {
      const params = machineType ? { machineType } : {};
      const [statsRes, chartsRes] = await Promise.all([
        api.get('/dashboard/stats', { params }),
        api.get('/dashboard/charts', { params }),
      ]);
      return { stats: statsRes.data.stats, charts: chartsRes.data.charts };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard');
    }
  }
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    stats: null,
    charts: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearDashboard: (state) => {
      state.stats = null;
      state.charts = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardStats.pending, (state) => { state.loading = true; })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload.stats;
        state.charts = action.payload.charts;
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearDashboard } = dashboardSlice.actions;
export default dashboardSlice.reducer;
