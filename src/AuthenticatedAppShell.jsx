import React from 'react';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { DialogProvider } from './contexts/DialogContext.jsx';
import SystemDialog from './components/SystemDialog.jsx';
import './styles/style.css';
import './styles/responsive.css';
import './styles/convergence.css';
import './styles/theme-transitions.css';

export default function AuthenticatedAppShell() {
  return (
    <AuthProvider>
      <DialogProvider>
        <SystemDialog />
        <App />
      </DialogProvider>
    </AuthProvider>
  );
}
