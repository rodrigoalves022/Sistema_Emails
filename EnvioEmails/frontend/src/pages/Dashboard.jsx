import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  AlertTriangle,
  Mail,
  Calendar,
  Disc,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export default function Dashboard() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardStats();
      setData(res);
    } catch (err) {
      addToast(err.message || 'Erro ao carregar dados do dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleExecuteNow = async (id) => {
    try {
      setActionLoading((prev) => ({ ...prev, [id]: true }));
      await api.executeAgendamentoNow(id);
      addToast('E-mail agendado disparado com sucesso via SMTP!', 'success');
      fetchStats();
    } catch (err) {
      addToast(err.message || 'Erro ao disparar e-mail', 'error');
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  if (loading && !data) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '60px' }}>
        <RefreshCw className="spin" size={32} color="var(--brand-teal)" />
        <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Carregando dados operacionais...</p>
      </div>
    );
  }

  const ind = data?.indicadores || {};
  const proximos = data?.proximos_agendamentos || [];
  const alertasFalhas = data?.alertas_falhas || [];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <span>Visão Operacional</span>
          </h1>
          <p className="page-subtitle">
            Monitoramento de rotinas de backup, solicitações de troca de disco e comunicações SMTP
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchStats}>
          <RefreshCw size={14} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="stat-grid">
        <div className="stat-card" onClick={() => navigate('/clientes')} style={{ cursor: 'pointer' }}>
          <div className="stat-info">
            <span className="stat-label">Total de Clientes</span>
            <span className="stat-value">{ind.total_clientes || 0}</span>
            <span style={{ fontSize: '11px', color: '#10B981', marginTop: '2px' }}>
              {ind.clientes_ativos || 0} ativos na base
            </span>
          </div>
          <div className="stat-icon-wrapper" style={{ borderColor: 'rgba(56, 189, 248, 0.4)' }}>
            <Users size={22} color="#38BDF8" />
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/falhas')} style={{ cursor: 'pointer', borderColor: ind.clientes_em_falha > 0 ? 'rgba(239, 68, 68, 0.4)' : undefined }}>
          <div className="stat-info">
            <span className="stat-label">Backup em Falha</span>
            <span className="stat-value" style={{ color: ind.clientes_em_falha > 0 ? '#F87171' : 'var(--text-primary)' }}>
              {ind.clientes_em_falha || 0}
            </span>
            <span style={{ fontSize: '11px', color: '#F87171', marginTop: '2px' }}>
              {ind.falhas_troca_disco || 0} por não troca de disco
            </span>
          </div>
          <div className="stat-icon-wrapper" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.1)' }}>
            <AlertTriangle size={22} color="#EF4444" />
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/agendamentos')} style={{ cursor: 'pointer' }}>
          <div className="stat-info">
            <span className="stat-label">E-mails Agendados</span>
            <span className="stat-value" style={{ color: '#FBBF24' }}>
              {ind.emails_agendados || 0}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Na fila de envio
            </span>
          </div>
          <div className="stat-icon-wrapper" style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}>
            <Calendar size={22} color="#F59E0B" />
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/emails')} style={{ cursor: 'pointer' }}>
          <div className="stat-info">
            <span className="stat-label">Enviados Hoje</span>
            <span className="stat-value" style={{ color: 'var(--brand-teal)' }}>
              {ind.emails_hoje || 0}
            </span>
            <span style={{ fontSize: '11px', color: '#10B981', marginTop: '2px' }}>
              ✓ {ind.emails_sucesso || 0} entregues com sucesso
            </span>
          </div>
          <div className="stat-icon-wrapper" style={{ borderColor: 'rgba(0, 179, 155, 0.4)' }}>
            <Mail size={22} color="var(--brand-teal)" />
          </div>
        </div>
      </div>

      {/* ÁREA DE ATENÇÃO: Clientes em Falha */}
      {alertasFalhas.length > 0 && (
        <div className="card-panel" style={{ marginBottom: '24px', borderColor: 'rgba(239, 68, 68, 0.35)', background: '#17111D' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} color="#EF4444" />
              <h3 style={{ fontSize: '15px', color: '#FEF2F2', fontWeight: 700 }}>
                Atenção Operacional — {alertasFalhas.length} Cliente(s) com Backup em Falha
              </h3>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => navigate('/falhas')}>
              <span>Ver Central de Falhas</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="table-wrapper">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Tipo Backup</th>
                  <th>Motivo da Falha</th>
                  <th>Responsável</th>
                  <th>Registrado em</th>
                  <th>Ações Rápidas</th>
                </tr>
              </thead>
              <tbody>
                {alertasFalhas.map((falha) => (
                  <tr key={falha.id}>
                    <td style={{ fontWeight: 700, color: '#F87171' }}>{falha.empresa_nome}</td>
                    <td>
                      <span className="backup-tag active">{falha.tipo_backup}</span>
                    </td>
                    <td>
                      <span className="badge badge-falha">{falha.motivo}</span>
                    </td>
                    <td>{falha.responsavel_principal || '—'}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(falha.data_registro).toLocaleString('pt-BR')}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/clientes/${falha.empresa_id}`)}
                      >
                        Ver Cliente
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Próximos Agendamentos */}
      <div className="card-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="#FBBF24" />
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>
              Próximos Envios Programados
            </h3>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/agendamentos')}>
            <span>Ver Toda a Agenda</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {proximos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            <Clock size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p>Nenhum e-mail agendado no momento.</p>
            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: '12px' }}
              onClick={() => navigate('/agendamentos?novo=1')}
            >
              Criar Novo Agendamento
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Data / Hora Prevista</th>
                  <th>Empresa</th>
                  <th>Tipo Backup</th>
                  <th>Template / Comunicado</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {proximos.map((ag) => (
                  <tr key={ag.id}>
                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {new Date(ag.datetime_previsto).toLocaleString('pt-BR')}
                    </td>
                    <td style={{ fontWeight: 600 }}>{ag.empresa_nome}</td>
                    <td>
                      <span className="backup-tag active">{ag.tipo_backup}</span>
                    </td>
                    <td>{ag.template_nome}</td>
                    <td>
                      <span className="badge badge-agendado">🟡 Agendado</span>
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleExecuteNow(ag.id)}
                        disabled={actionLoading[ag.id]}
                      >
                        <Send size={12} />
                        <span>{actionLoading[ag.id] ? 'Enviando...' : 'Enviar Agora'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
