import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  List,
  Plus,
  Send,
  XCircle,
  RefreshCw,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  CheckSquare,
  Square,
  Users,
  Mail,
  Zap,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

export default function Agendamentos() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [viewMode, setViewMode] = useState('lista'); // 'lista' | 'calendario'
  const [agendamentos, setAgendamentos] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  // Calendário State
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

  // Filtros da Tabela
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [filtroTipoBackup, setFiltroTipoBackup] = useState('');
  const [filtroTipoEmail, setFiltroTipoEmail] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Modal Novo Agendamento Programado
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isLoteMode, setIsLoteMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [newAgendamento, setNewAgendamento] = useState({
    empresa_id: '',
    selected_lote_ids: [],
    tipo_backup: 'Semanal',
    tipo_email: 'solicitacao_disco',
    template_id: '',
    data_agendamento: new Date().toISOString().split('T')[0],
    horario_agendamento: '08:00',
    destinatario_principal: '',
    bcc_emails: [],
  });

  // Modal Detalhes
  const [selectedAg, setSelectedAg] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [agData, tplData, empData] = await Promise.all([
        api.getAgendamentos({
          empresa_id: filtroEmpresa || undefined,
          tipo_backup: filtroTipoBackup || undefined,
          tipo_email: filtroTipoEmail || undefined,
          status: filtroStatus !== 'todos' ? filtroStatus : undefined,
        }),
        api.getTemplates(),
        api.getClients(),
      ]);
      setAgendamentos(agData);
      setTemplates(tplData);
      setEmpresas(empData);

      if (tplData.length > 0 && !newAgendamento.template_id) {
        setNewAgendamento((prev) => ({ ...prev, template_id: tplData[0].id }));
      }
    } catch (err) {
      addToast(err.message || 'Erro ao carregar agendamentos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filtroEmpresa, filtroTipoBackup, filtroTipoEmail, filtroStatus]);

  useEffect(() => {
    if (searchParams.get('novo')) {
      const empId = searchParams.get('empresa_id');
      if (empId) {
        setNewAgendamento((prev) => ({ ...prev, empresa_id: empId }));
        handleSelectSoloCompany(empId);
      }
      setIsNewModalOpen(true);
    }
  }, [searchParams, empresas]);

  // Ao selecionar empresa no modo individual, carrega seu email principal
  const handleSelectSoloCompany = (companyId) => {
    if (!companyId) {
      setNewAgendamento((prev) => ({ ...prev, empresa_id: '', destinatario_principal: '' }));
      return;
    }
    const emp = empresas.find((e) => String(e.id) === String(companyId));
    if (emp) {
      const defBackup = emp.tipos_backup && emp.tipos_backup.length > 0 ? emp.tipos_backup[0] : 'Semanal';
      setNewAgendamento((prev) => ({
        ...prev,
        empresa_id: companyId,
        tipo_backup: defBackup,
        destinatario_principal: emp.email_principal || '',
      }));
    }
  };

  // Filtragem estrita de empresas por tipo de backup ativo para modo em lote
  const getEmpresasComBackupAtivo = (tipoBackup) => {
    const tipoLower = (tipoBackup || '').toLowerCase();
    return empresas.filter((emp) => {
      if (emp.status !== 'ativo') return false;
      const bTypes = (emp.tipos_backup || []).map((t) => t.toLowerCase());
      return bTypes.includes(tipoLower);
    });
  };

  // Ao alternar tipo de backup no modo em lote, pré-seleciona todas as empresas que têm esse backup
  useEffect(() => {
    if (isLoteMode) {
      const elegiveis = getEmpresasComBackupAtivo(newAgendamento.tipo_backup);
      setNewAgendamento((prev) => ({
        ...prev,
        selected_lote_ids: elegiveis.map((e) => e.id),
      }));
    }
  }, [isLoteMode, newAgendamento.tipo_backup, empresas]);

  // Toggle seleção de empresa individual no lote
  const toggleCompanyInLote = (companyId) => {
    setNewAgendamento((prev) => {
      const exists = prev.selected_lote_ids.includes(companyId);
      return {
        ...prev,
        selected_lote_ids: exists
          ? prev.selected_lote_ids.filter((id) => id !== companyId)
          : [...prev.selected_lote_ids, companyId],
      };
    });
  };

  const handleSelectAllLote = () => {
    const elegiveis = getEmpresasComBackupAtivo(newAgendamento.tipo_backup);
    setNewAgendamento((prev) => ({
      ...prev,
      selected_lote_ids: elegiveis.map((e) => e.id),
    }));
  };

  const handleDeselectAllLote = () => {
    setNewAgendamento((prev) => ({
      ...prev,
      selected_lote_ids: [],
    }));
  };

  // Salvar Agendamento Programado
  const handleSaveAgendamento = async (e) => {
    e?.preventDefault();
    if (!newAgendamento.data_agendamento || !newAgendamento.horario_agendamento) {
      addToast('Defina a data e o horário do agendamento.', 'warning');
      return;
    }

    try {
      setIsSaving(true);

      if (isLoteMode) {
        if (!newAgendamento.selected_lote_ids || newAgendamento.selected_lote_ids.length === 0) {
          addToast('Selecione ao menos uma empresa para agendamento.', 'warning');
          return;
        }

        const payload = {
          empresa_ids: newAgendamento.selected_lote_ids,
          tipo_backup: newAgendamento.tipo_backup,
          tipo_email: newAgendamento.tipo_email,
          template_id: parseInt(newAgendamento.template_id, 10),
          data_agendamento: newAgendamento.data_agendamento,
          horario_agendamento: newAgendamento.horario_agendamento,
          enviar_agora: false,
        };

        const res = await api.createAgendamento(payload);
        addToast(`Agendamento programado com sucesso para ${res.total_criados} empresa(s)!`, 'success');
      } else {
        if (!newAgendamento.empresa_id) {
          addToast('Selecione uma empresa.', 'warning');
          return;
        }

        const payload = {
          empresa_id: parseInt(newAgendamento.empresa_id, 10),
          tipo_backup: newAgendamento.tipo_backup,
          tipo_email: newAgendamento.tipo_email,
          template_id: parseInt(newAgendamento.template_id, 10),
          data_agendamento: newAgendamento.data_agendamento,
          horario_agendamento: newAgendamento.horario_agendamento,
          destinatario_principal: newAgendamento.destinatario_principal.trim() || undefined,
          enviar_agora: false,
        };

        await api.createAgendamento(payload);
        addToast('Agendamento programado com sucesso!', 'success');
      }

      setIsNewModalOpen(false);
      fetchData();
    } catch (err) {
      addToast(err.message || 'Erro ao criar agendamento', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Ações de agendamento na tabela
  const handleExecuteNow = async (id) => {
    try {
      setActionLoading((prev) => ({ ...prev, [id]: true }));
      await api.executeAgendamentoNow(id);
      addToast('E-mail disparado com sucesso via SMTP!', 'success');
      fetchData();
    } catch (err) {
      addToast(err.message || 'Erro ao disparar agendamento', 'error');
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleCancel = async (id) => {
    try {
      await api.cancelAgendamento(id);
      addToast('Agendamento cancelado.', 'info');
      fetchData();
    } catch (err) {
      addToast(err.message || 'Erro ao cancelar agendamento', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este agendamento?')) return;
    try {
      await api.deleteAgendamento(id);
      addToast('Agendamento excluído com sucesso.', 'info');
      fetchData();
    } catch (err) {
      addToast(err.message || 'Erro ao excluir agendamento', 'error');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'agendado':
        return <span className="badge badge-agendado">🟡 Agendado</span>;
      case 'processando':
        return <span className="badge badge-processando">🔵 Processando</span>;
      case 'enviado':
        return <span className="badge badge-normal">🟢 Enviado</span>;
      case 'falhou':
        return <span className="badge badge-falha">🔴 Falhou</span>;
      case 'cancelado':
        return <span className="badge badge-inativo">⚫ Cancelado</span>;
      default:
        return <span className="badge badge-inativo">{status}</span>;
    }
  };

  // Calendário Helper
  const nextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  };

  const currentYear = currentMonthDate.getFullYear();
  const currentMonth = currentMonthDate.getMonth();
  const monthName = currentMonthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  const getAgendamentosForDay = (day) => {
    if (!day) return [];
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return agendamentos.filter((ag) => {
      const agDate = ag.datetime_previsto ? ag.datetime_previsto.split(' ')[0] : '';
      return agDate === dateStr;
    });
  };

  const empresasElegiveisLote = getEmpresasComBackupAtivo(newAgendamento.tipo_backup);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <CalendarIcon size={22} color="var(--brand-teal)" />
            <span>Agendamentos Programados</span>
          </h1>
          <p className="page-subtitle">
            Calendário e fila de e-mails programados para envio automático em datas e horários futuros.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Alternador Lista / Calendário */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-card)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'lista' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none' }}
              onClick={() => setViewMode('lista')}
            >
              <List size={14} />
              <span>Lista</span>
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'calendario' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none' }}
              onClick={() => setViewMode('calendario')}
            >
              <CalendarIcon size={14} />
              <span>Calendário</span>
            </button>
          </div>

          <button className="btn btn-primary" onClick={() => setIsNewModalOpen(true)}>
            <Plus size={16} />
            <span>Novo Agendamento</span>
          </button>
        </div>
      </div>

      {/* Banner de atalho para Envio Direto */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '12px 18px',
          marginBottom: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap size={18} color="var(--brand-teal)" />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Precisa disparar e-mails para os clientes <strong>imediatamente na hora</strong>?
          </span>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/disparo')}>
          <Send size={13} />
          <span>Ir para Disparo Direto</span>
        </button>
      </div>

      {/* Toolbar / Filtros */}
      <div className="filter-toolbar" style={{ marginBottom: '20px' }}>
        <select
          className="form-control"
          style={{ width: '220px' }}
          value={filtroEmpresa}
          onChange={(e) => setFiltroEmpresa(e.target.value)}
        >
          <option value="">Empresa: Todas</option>
          {empresas.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.nome}
            </option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: '170px' }}
          value={filtroTipoBackup}
          onChange={(e) => setFiltroTipoBackup(e.target.value)}
        >
          <option value="">Tipo Backup: Todos</option>
          <option value="Diário">Diário</option>
          <option value="Semanal">Semanal</option>
          <option value="Mensal">Mensal</option>
          <option value="Anual">Anual</option>
          <option value="Cloud">Cloud</option>
        </select>

        <select
          className="form-control"
          style={{ width: '170px' }}
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
        >
          <option value="todos">Status: Todos</option>
          <option value="agendado">🟡 Agendado</option>
          <option value="processando">🔵 Processando</option>
          <option value="enviado">🟢 Enviado</option>
          <option value="falhou">🔴 Falhou</option>
          <option value="cancelado">⚫ Cancelado</option>
        </select>

        <button className="btn btn-secondary btn-icon" onClick={fetchData} title="Recarregar">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Visualização em Lista */}
      {viewMode === 'lista' && (
        <>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <RefreshCw className="spin" size={28} />
              <p style={{ marginTop: '12px' }}>Carregando agendamentos...</p>
            </div>
          ) : agendamentos.length === 0 ? (
            <div className="card-panel" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              <CalendarIcon size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
              <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                Nenhum agendamento futuro programado
              </h3>
              <p style={{ fontSize: '13px', marginBottom: '16px' }}>
                Clique em "Novo Agendamento" para programar uma rotina futura.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Data / Horário Previsto</th>
                    <th>Empresa</th>
                    <th>Tipo de Backup</th>
                    <th>Template</th>
                    <th>Destinatário Principal (To:)</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {agendamentos.map((ag) => (
                    <tr key={ag.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px' }}>
                        {new Date(ag.datetime_previsto).toLocaleString('pt-BR')}
                      </td>
                      <td style={{ fontWeight: 700 }}>{ag.empresa_nome}</td>
                      <td>
                        <span className="backup-tag active">{ag.tipo_backup}</span>
                      </td>
                      <td>{ag.template_nome}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', color: '#38BDF8' }}>
                        {ag.destinatario_principal}
                      </td>
                      <td>{getStatusBadge(ag.status)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {ag.status === 'agendado' && (
                            <>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleExecuteNow(ag.id)}
                                disabled={actionLoading[ag.id]}
                                title="Executar agora manualmente"
                              >
                                <Send size={12} />
                                <span>{actionLoading[ag.id] ? 'Disparando...' : 'Executar Agora'}</span>
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleCancel(ag.id)}
                                title="Cancelar agendamento"
                              >
                                <XCircle size={12} color="#F87171" />
                                <span>Cancelar</span>
                              </button>
                            </>
                          )}
                          <button
                            className="btn btn-secondary btn-icon btn-sm"
                            onClick={() => setSelectedAg(ag)}
                            title="Ver detalhes"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            className="btn btn-secondary btn-icon btn-sm"
                            onClick={() => handleDelete(ag.id)}
                            title="Excluir"
                          >
                            <Trash2 size={12} color="#EF4444" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Visualização em Calendário */}
      {viewMode === 'calendario' && (
        <div className="card-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
              {monthName}
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary btn-icon" onClick={prevMonth} title="Mês Anterior">
                <ChevronLeft size={16} />
              </button>
              <button className="btn btn-secondary btn-icon" onClick={nextMonth} title="Próximo Mês">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '8px' }}>
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => (
              <div
                key={dia}
                style={{
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  padding: '6px 0',
                  textTransform: 'uppercase',
                }}
              >
                {dia}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
            {calendarDays.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} style={{ minHeight: '90px', background: 'transparent' }} />;
              }

              const dayAgs = getAgendamentosForDay(day);
              const isToday =
                new Date().getDate() === day &&
                new Date().getMonth() === currentMonth &&
                new Date().getFullYear() === currentYear;

              return (
                <div
                  key={`day-${day}`}
                  style={{
                    minHeight: '100px',
                    background: isToday ? 'rgba(0, 179, 155, 0.08)' : 'var(--bg-app)',
                    border: isToday ? '1px solid var(--brand-teal)' : '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: isToday ? 800 : 600,
                        color: isToday ? 'var(--brand-teal)' : 'var(--text-primary)',
                      }}
                    >
                      {day}
                    </span>
                    {dayAgs.length > 0 && (
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          background: 'rgba(56, 189, 248, 0.2)',
                          color: '#38BDF8',
                          padding: '1px 5px',
                          borderRadius: '10px',
                        }}
                      >
                        {dayAgs.length}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                    {dayAgs.slice(0, 2).map((ag) => (
                      <div
                        key={ag.id}
                        onClick={() => setSelectedAg(ag)}
                        style={{
                          fontSize: '11px',
                          padding: '3px 6px',
                          borderRadius: '4px',
                          background: 'var(--bg-card)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          border: '1px solid var(--border-card)',
                        }}
                        title={`${ag.empresa_nome} (${ag.tipo_backup})`}
                      >
                        <strong>{ag.empresa_nome}</strong>
                      </div>
                    ))}
                    {dayAgs.length > 2 && (
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        +{dayAgs.length - 2} mais
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Novo Agendamento Programado */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title={isLoteMode ? 'Programar Agendamento em Lote' : 'Programar Agendamento Individual'}
        maxWidth="680px"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsNewModalOpen(false)} disabled={isSaving}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSaveAgendamento} disabled={isSaving}>
              {isSaving ? <RefreshCw className="spin" size={14} /> : <Clock size={14} />}
              <span>{isSaving ? 'Salvando...' : 'Salvar Agendamento'}</span>
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveAgendamento}>
          {/* Alternar Individual / Lote */}
          <div className="form-group">
            <div style={{ display: 'flex', gap: '10px', background: 'var(--bg-app)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
              <button
                type="button"
                className={`btn btn-sm ${!isLoteMode ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, border: 'none' }}
                onClick={() => setIsLoteMode(false)}
              >
                Cliente Individual
              </button>
              <button
                type="button"
                className={`btn btn-sm ${isLoteMode ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, border: 'none' }}
                onClick={() => setIsLoteMode(true)}
              >
                Lote (Filtrado por Backup)
              </button>
            </div>
          </div>

          {/* Configuração de Backup e Finalidade */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Tipo de Backup *</label>
              <select
                className="form-control"
                value={newAgendamento.tipo_backup}
                onChange={(e) => setNewAgendamento({ ...newAgendamento, tipo_backup: e.target.value })}
              >
                <option value="Diário">Diário</option>
                <option value="Semanal">Semanal</option>
                <option value="Mensal">Mensal</option>
                <option value="Anual">Anual</option>
                <option value="Cloud">Cloud</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Finalidade do E-mail</label>
              <select
                className="form-control"
                value={newAgendamento.tipo_email}
                onChange={(e) => setNewAgendamento({ ...newAgendamento, tipo_email: e.target.value })}
              >
                <option value="solicitacao_disco">Solicitação de Disco</option>
                <option value="inicio_rotina">Início de Rotina</option>
                <option value="finalizacao">Finalização de Rotina</option>
                <option value="falha">Aviso de Falha</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Template de E-mail *</label>
            <select
              className="form-control"
              value={newAgendamento.template_id}
              onChange={(e) => setNewAgendamento({ ...newAgendamento, template_id: e.target.value })}
              required
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.nome} ({tpl.categoria})
                </option>
              ))}
            </select>
          </div>

          {/* MODO SOLO */}
          {!isLoteMode && (
            <>
              <div className="form-group">
                <label className="form-label">Selecionar Empresa *</label>
                <select
                  className="form-control"
                  value={newAgendamento.empresa_id}
                  onChange={(e) => handleSelectSoloCompany(e.target.value)}
                  required
                >
                  <option value="">Selecione a empresa...</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nome} ({emp.tipos_backup?.join(', ') || 'Nenhum backup'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Destinatário Principal (To:)</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="Destinatário carregado da empresa..."
                  value={newAgendamento.destinatario_principal}
                  onChange={(e) => setNewAgendamento({ ...newAgendamento, destinatario_principal: e.target.value })}
                />
              </div>
            </>
          )}

          {/* MODO EM LOTE SEGMENTADO */}
          {isLoteMode && (
            <div className="form-group">
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: '#BAE6FD', fontSize: '13.5px' }}>
                      Filtrado por Backup {newAgendamento.tipo_backup}:
                    </strong>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {empresasElegiveisLote.length} empresa(s) ativa(s) têm esse tipo de backup contratado.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleSelectAllLote}
                    >
                      Marcar Todas
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleDeselectAllLote}
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>
              </div>

              {/* Lista de Empresas Elegíveis com Checkboxes */}
              <div
                style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-card)',
                  borderRadius: '6px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {empresasElegiveisLote.length === 0 ? (
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', padding: '12px', textAlign: 'center' }}>
                    Nenhuma empresa ativa possui o backup {newAgendamento.tipo_backup} ativado.
                  </p>
                ) : (
                  empresasElegiveisLote.map((emp) => {
                    const isChecked = newAgendamento.selected_lote_ids.includes(emp.id);
                    return (
                      <div
                        key={emp.id}
                        onClick={() => toggleCompanyInLote(emp.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: isChecked ? 'rgba(0, 179, 155, 0.1)' : 'var(--bg-card)',
                          border: `1px solid ${isChecked ? 'var(--brand-teal)' : 'var(--border-subtle)'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {isChecked ? (
                            <CheckSquare size={16} color="var(--brand-teal)" />
                          ) : (
                            <Square size={16} color="var(--text-muted)" />
                          )}
                          <div>
                            <strong style={{ fontSize: '13px' }}>{emp.nome}</strong>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                              ({emp.email_principal || 'Sem e-mail'})
                            </span>
                          </div>
                        </div>
                        <span className="backup-tag active" style={{ fontSize: '10.5px' }}>
                          {newAgendamento.tipo_backup}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Data e Horário Previsto */}
          <div style={{ marginTop: '14px', padding: '12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <label className="form-label" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Data e Horário de Execução Automática *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <input
                type="date"
                className="form-control"
                value={newAgendamento.data_agendamento}
                onChange={(e) => setNewAgendamento({ ...newAgendamento, data_agendamento: e.target.value })}
                required
              />
              <input
                type="time"
                className="form-control"
                value={newAgendamento.horario_agendamento}
                onChange={(e) => setNewAgendamento({ ...newAgendamento, horario_agendamento: e.target.value })}
                required
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal Ver Detalhes do Agendamento */}
      {selectedAg && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedAg(null)}
          title={`Detalhes do Agendamento #${selectedAg.id}`}
          maxWidth="560px"
          footer={
            <>
              {selectedAg.status === 'agendado' && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    handleExecuteNow(selectedAg.id);
                    setSelectedAg(null);
                  }}
                >
                  <Send size={14} />
                  <span>Executar Agora</span>
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setSelectedAg(null)}>
                Fechar
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px' }}>
            <div>
              <strong>Empresa:</strong> {selectedAg.empresa_nome}
            </div>
            <div>
              <strong>Data e Hora:</strong> {new Date(selectedAg.datetime_previsto).toLocaleString('pt-BR')}
            </div>
            <div>
              <strong>Tipo de Backup:</strong> {selectedAg.tipo_backup}
            </div>
            <div>
              <strong>Template:</strong> {selectedAg.template_nome}
            </div>
            <div>
              <strong>Destinatário Principal (To:):</strong> <code>{selectedAg.destinatario_principal}</code>
            </div>
            <div>
              <strong>Cópia Oculta (BCC:):</strong> {selectedAg.bcc_emails || 'Nenhum'}
            </div>
            <div>
              <strong>Status:</strong> {getStatusBadge(selectedAg.status)}
            </div>
            {selectedAg.erro && (
              <div style={{ color: '#F87171', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '4px' }}>
                <strong>Erro:</strong> {selectedAg.erro}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
