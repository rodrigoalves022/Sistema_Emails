import React, { useState, useEffect } from 'react';
import {
  Mail,
  Search,
  Filter,
  RefreshCw,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Trash2,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

export default function Emails() {
  const { addToast } = useToast();
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  // Filtros
  const [busca, setBusca] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [tipoBackupFilter, setTipoBackupFilter] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Modal Detalhes
  const [selectedItem, setSelectedItem] = useState(null);

  const fetchHistorico = async () => {
    try {
      setLoading(true);
      const data = await api.getHistorico({
        busca,
        status: statusFilter !== 'todos' ? statusFilter : undefined,
        tipo_backup: tipoBackupFilter || undefined,
        data_inicio: dataInicio || undefined,
        data_fim: dataFim || undefined,
      });
      setHistorico(data);
    } catch (err) {
      addToast(err.message || 'Erro ao carregar histórico de envios', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistorico();
  }, [busca, statusFilter, tipoBackupFilter, dataInicio, dataFim]);

  const handleResend = async (id) => {
    try {
      setActionLoading((prev) => ({ ...prev, [id]: true }));
      await api.reenviarEmail(id);
      addToast('E-mail reenviado com sucesso via SMTP!', 'success');
      fetchHistorico();
    } catch (err) {
      addToast(err.message || 'Erro ao reenviar e-mail', 'error');
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Tem certeza que deseja limpar todo o histórico de envios?')) return;
    try {
      await api.clearHistorico();
      addToast('Histórico limpo.', 'info');
      fetchHistorico();
    } catch (err) {
      addToast(err.message || 'Erro ao limpar histórico', 'error');
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Mail size={22} color="var(--brand-teal)" />
            <span>Histórico de Comunicações Enviadas</span>
          </h1>
          <p className="page-subtitle">
            Registro de todos os e-mails disparados via SMTP, destinatários, cópias ocultas e status de entrega
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={fetchHistorico}>
            <RefreshCw size={14} />
            <span>Atualizar</span>
          </button>
          {historico.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={handleClearAll}>
              <Trash2 size={14} />
              <span>Limpar Histórico</span>
            </button>
          )}
        </div>
      </div>

      {/* Toolbar / Filtros */}
      <div className="filter-toolbar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="form-control"
            placeholder="Buscar por assunto, empresa ou e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <select
          className="form-control"
          style={{ width: '160px' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="todos">Status: Todos</option>
          <option value="sucesso">✓ Sucesso</option>
          <option value="erro">✕ Erro</option>
        </select>

        <select
          className="form-control"
          style={{ width: '170px' }}
          value={tipoBackupFilter}
          onChange={(e) => setTipoBackupFilter(e.target.value)}
        >
          <option value="">Tipo Backup: Todos</option>
          <option value="Diário">Diário</option>
          <option value="Semanal">Semanal</option>
          <option value="Mensal">Mensal</option>
          <option value="Anual">Anual</option>
          <option value="Cloud">Cloud</option>
        </select>

        <input
          type="date"
          className="form-control"
          style={{ width: '150px' }}
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          placeholder="De"
        />

        <input
          type="date"
          className="form-control"
          style={{ width: '150px' }}
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          placeholder="Até"
        />
      </div>

      {/* Tabela de Histórico */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <RefreshCw className="spin" size={28} />
          <p style={{ marginTop: '12px' }}>Carregando histórico de envios...</p>
        </div>
      ) : historico.length === 0 ? (
        <div className="card-panel" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <Mail size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Nenhum e-mail registrado
          </h3>
          <p style={{ fontSize: '13px' }}>
            Os e-mails disparados via SMTP ou agendados aparecerão automaticamente aqui.
          </p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Data / Hora do Envio</th>
                <th>Empresa</th>
                <th>Tipo Backup</th>
                <th>Assunto do E-mail</th>
                <th>Destinatário Principal (To:)</th>
                <th>BCC (Cópia Oculta)</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px' }}>
                    {new Date(item.data_envio).toLocaleString('pt-BR')}
                  </td>
                  <td style={{ fontWeight: 700 }}>{item.empresa_nome || '—'}</td>
                  <td>
                    <span className="backup-tag active">{item.tipo_backup || 'Geral'}</span>
                  </td>
                  <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.assunto}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', color: '#38BDF8' }}>
                    {item.destinatario_principal}
                  </td>
                  <td>
                    {item.bcc_count > 0 ? (
                      <span className="badge badge-processando" style={{ fontSize: '11px' }}>
                        {item.bcc_count} em cópia
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>0</span>
                    )}
                  </td>
                  <td>
                    {item.status === 'sucesso' ? (
                      <span className="badge badge-normal">🟢 Sucesso</span>
                    ) : (
                      <span className="badge badge-falha" title={item.erro}>
                        🔴 Erro
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedItem(item)}
                        title="Ver detalhes"
                      >
                        <Eye size={12} />
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleResend(item.id)}
                        disabled={actionLoading[item.id]}
                        title="Reenviar este e-mail via SMTP"
                      >
                        <Send size={12} />
                        <span>{actionLoading[item.id] ? 'Reenviando...' : 'Reenviar'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Detalhes do E-mail */}
      {selectedItem && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedItem(null)}
          title="Detalhes da Comunicação Enviada"
          maxWidth="560px"
          footer={
            <>
              <button
                className="btn btn-primary"
                onClick={() => {
                  handleResend(selectedItem.id);
                  setSelectedItem(null);
                }}
              >
                <Send size={14} />
                <span>Reenviar Agora</span>
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedItem(null)}>
                Fechar
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px' }}>
            <div>
              <strong>Empresa:</strong> {selectedItem.empresa_nome}
            </div>
            <div>
              <strong>Data / Hora:</strong> {new Date(selectedItem.data_envio).toLocaleString('pt-BR')}
            </div>
            <div>
              <strong>Assunto:</strong> {selectedItem.assunto}
            </div>
            <div>
              <strong>Destinatário Principal (To:):</strong> <code>{selectedItem.destinatario_principal}</code>
            </div>
            <div>
              <strong>Cópia Oculta (BCC:):</strong> {selectedItem.bcc_emails || 'Nenhum'}
            </div>
            <div>
              <strong>Status:</strong>{' '}
              {selectedItem.status === 'sucesso' ? (
                <span className="badge badge-normal">🟢 Sucesso</span>
              ) : (
                <span className="badge badge-falha">🔴 Erro</span>
              )}
            </div>
            {selectedItem.erro && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#F87171', padding: '10px', borderRadius: '6px' }}>
                <strong>Detalhes do Erro:</strong> {selectedItem.erro}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
