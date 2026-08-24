import { createSlice } from '@reduxjs/toolkit';

const storedMode = localStorage.getItem('themeMode') || 'light';

const themeSlice = createSlice({
  name: 'theme',
  initialState: { mode: storedMode },
  reducers: {
    toggleTheme: (state) => {
      state.mode = state.mode === 'light' ? 'dark' : 'light';
      localStorage.setItem('themeMode', state.mode);
    },
    setTheme: (state, action) => {
      state.mode = action.payload;
      localStorage.setItem('themeMode', action.payload);
    },
  },
});

export const { toggleTheme, setTheme } = themeSlice.actions;
export const selectThemeMode = (state) => state.theme.mode;
export default themeSlice.reducer;
