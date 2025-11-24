// src/App.jsx
import React from 'react';
import './App.css'; 
import './styles/style.css';
import './styles/responsive.css';

import { useAuth } from './contexts/AuthContext';

// Importando as novas PÁGINAS (certifique-se de ter movido o Login.jsx também)
import Login from './pages/Login/index.jsx'; 
import Ficha from './pages/Ficha/index.jsx';

function App() {
  const { usuario } = useAuth();

  // Se não tem usuário, mostra LOGIN
  if (!usuario) {
    return <Login />;
  }

  // Se tem usuário, mostra a FICHA
  return <Ficha />;
}

export default App;