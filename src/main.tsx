import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SnackbarProvider } from 'notistack';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SnackbarProvider
      maxSnack={3}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      iconVariant={{
        success: <span style={{ color: '#fff' }}>✓</span>,
        error: <span style={{ color: '#fff' }}>✕</span>,
        warning: <span style={{ color: '#fff' }}>!</span>,
        info: <span style={{ color: '#fff' }}>i</span>,
      }}
    >
      <App />
    </SnackbarProvider>
  </StrictMode>
);
