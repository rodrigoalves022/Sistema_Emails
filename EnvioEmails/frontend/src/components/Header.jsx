import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Clock, Server, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../api';

const routeTitles = {
  '/dashboard': 'Dashboard de Monitoramento',
  '/clientes': 'Gerenciamento de Clientes',
  '/falhas': 'Central de Falhas de Backup',
  '/agendamentos': 'Agenda e Programação de E-mails',
  '/templates': 'Catálogo de Templates HTML',
  '/emails': 'Histórico de Comunicações Enviadas',
  '/estatisticas': 'Estatísticas e Relatórios de Backup',
  '/configuracoes': 'Configurações SMTP e Auditoria',
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [time, setTime] = useState('');
  const [smtpOk, setSmtpOk] = useState(true);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(
        now.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const getTitle = () => {
    if (location.pathname.startsWith('/clientes/')) return 'Detalhes do Cliente';
    if (location.pathname.startsWith('/templates/')) return 'Editor de Template HTML';
    return routeTitles[location.pathname] || 'Painel de Operações';
  };

  return (
    <header className="top-header">
      <div className="header-left">
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {getTitle()}
        </h2>
      </div>

      <div className="header-right">
        {/* Live Clock */}
        <div className="live-time">
          <Clock size={13} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          {time}
        </div>

        {/* Action Button */}
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/agendamentos?novo=1')}
        >
          <Plus size={15} />
          <span>Novo Agendamento</span>
        </button>
      </div>
    </header>
  );
}
