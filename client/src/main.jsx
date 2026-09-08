import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import App from './App';
import { store } from './redux/store';
import ThemeWrapper from './components/ThemeWrapper';
import { MachineProvider } from './context/MachineContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ThemeWrapper>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <MachineProvider>
              <App />
              <ToastContainer position="top-right" autoClose={3000} />
            </MachineProvider>
          </LocalizationProvider>
        </ThemeWrapper>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
