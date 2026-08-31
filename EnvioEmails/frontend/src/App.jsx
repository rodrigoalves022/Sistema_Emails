import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { ToastProvider } from './components/Toast';

import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import ClienteDetalhe from './pages/ClienteDetalhe';
import Falhas from './pages/Falhas';
import Agendamentos from './pages/Agendamentos';
import DisparoEmails from './pages/DisparoEmails';
import Templates from './pages/Templates';
import TemplateEditor from './pages/TemplateEditor';
import Emails from './pages/Emails';
import Estatisticas from './pages/Estatisticas';
import Configuracoes from './pages/Configuracoes';

function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content-wrapper">
        <Header />
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/disparo" element={<DisparoEmails />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/:id" element={<ClienteDetalhe />} />
            <Route path="/falhas" element={<Falhas />} />
            <Route path="/agendamentos" element={<Agendamentos />} />
            <Route path="/agendamentos/:id" element={<Agendamentos />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/templates/:id" element={<TemplateEditor />} />
            <Route path="/emails" element={<Emails />} />
            <Route path="/estatisticas" element={<Estatisticas />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </ToastProvider>
  );
}
