import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Filter,
  Plus,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ChevronRight,
  RefreshCw,
  Send,
  Mail,
  Phone,
  X,
  Trash2,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import ImportExcelModal from '../components/ImportExcelModal';
import Modal from '../components/Modal';

export default function Clientes() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [clientes, setClientes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [busca, setBusca] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [tipoBackupFilter, setTipoBackupFilter] = useState('todos');
  const [falhaFilter, setFalhaFilter] = useState('');

  // Modals
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Instant Solo Send Modal
  const [sendSoloModal, setSendSoloModal] = useState({
    isOpen: false,
    client: null,
    template_id: '',
    tipo_backup: 'Semanal',
    tipo_email: 'solicitacao_disco',
    to_email: '',
    bcc_emails: [],
    newBccInput: '',
    isSending: false,
  });

  // New Client Form State
  const [newClient, setNewClient] = useState({
    nome: '',
    responsavel_principal: '',
    telefone: '',
    email_principal: '',
    emails_secundarios: [],
    novo_secundario_input: '',
    status: 'ativo',
    observacoes: '',
    tipos_backup: ['diario', 'semanal', 'mensal', 'cloud'],
  });

  const fetchClientes = async () => {
    try {
      setLoading(true);
      const [clientData, tplData] = await Promise.all([
        api.getClients(busca, statusFilter, tipoBackupFilter, falhaFilter),
        api.getTemplates(),
      ]);
      setClientes(clientData);
      setTemplates(tplData);
      if (tplData.length > 0 && !sendSoloModal.template_id) {
        setSendSoloModal((prev) => ({ ...prev, template_id: tplData[0].id }));
      }
    } catch (err) {
      addToast(err.message || 'Erro ao carregar lista de clientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, [busca, statusFilter, tipoBackupFilter, falhaFilter]);

  const handleAddSecondaryEmailToNewClient = () => {
    const val = newClient.novo_secundario_input.trim().toLowerCase();
    if (!val) return;
    if (newClient.emails_secundarios.includes(val)) {
      addToast('Este e-mail já foi adicionado na lista.', 'warning');
      return;
    }
    setNewClient((prev) => ({
      ...prev,
      emails_secundarios: [...prev.emails_secundarios, val],
      novo_secundario_input: '',
    }));
  };

  const handleRemoveSecondaryEmail = (emailToRemove) => {
    setNewClient((prev) => ({
      ...prev,
      emails_secundarios: prev.emails_secundarios.filter((e) => e !== emailToRemove),
    }));
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (!newClient.nome.trim()) {
      addToast('O nome da empresa é obrigatório.', 'warning');
      return;
    }

    try {
      const emailList = [];
      if (newClient.email_principal.trim()) {
        emailList.push({
          endereco: newClient.email_principal.trim().toLowerCase(),
          tipo: 'principal',
          ativo: 1,
        });
      }
      newClient.emails_secundarios.forEach((sec) => {
        emailList.push({
          endereco: sec,
          tipo: 'secundario',
          ativo: 1,
        });
      });

      const payload = {
        nome: newClient.nome.trim().toUpperCase(),
        responsavel_principal: newClient.responsavel_principal.trim(),
        status: newClient.status,
        observacoes: newClient.observacoes,
        backup_em_falha: 0,
        tipos_backup: newClient.tipos_backup,
        contatos: newClient.responsavel_principal
          ? [{ nome: newClient.responsavel_principal, telefone: newClient.telefone.trim(), is_principal: 1 }]
          : [],
        emails: emailList,
      };

      await api.createClient(payload);
      addToast('Empresa cadastrada com sucesso!', 'success');
      setIsNewModalOpen(false);
      setNewClient({
        nome: '',
        responsavel_principal: '',
        telefone: '',
        email_principal: '',
        emails_secundarios: [],
        novo_secundario_input: '',
        status: 'ativo',
        observacoes: '',
        tipos_backup: ['diario', 'semanal', 'mensal', 'cloud'],
      });
      fetchClientes();
    } catch (err) {
      addToast(err.message || 'Erro ao cadastrar empresa', 'error');
    }
  };

  const toggleBackupTypeInForm = (type) => {
    setNewClient((prev) => {
      const exists = prev.tipos_backup.includes(type);
      return {
        ...prev,
        tipos_backup: exists
          ? prev.tipos_backup.filter((t) => t !== type)
          : [...prev.tipos_backup, type],
      };
    });
  };

  // Abrir Modal de Envio Imediato Solo
  const handleOpenSoloSend = async (c, e) => {
    e.stopPropagation();
    try {
      // Carrega detalhes completos do cliente com e-mails
      const full = await api.getClient(c.id);
      const toEmail = full.emails?.find((em) => em.tipo === 'principal')?.endereco || full.email_principal || '';
      const bccList = full.emails?.filter((em) => em.tipo === 'secundario').map((em) => em.endereco) || [];

      // Seleciona um tipo de backup ativo do cliente como default
      const defaultBackup = full.tipos_backup && full.tipos_backup.length > 0 ? full.tipos_backup[0] : 'Semanal';

      setSendSoloModal({
        isOpen: true,
        client: full,
        template_id: templates.length > 0 ? templates[0].id : '',
        tipo_backup: defaultBackup,
        tipo_email: 'solicitacao_disco',
        to_email: toEmail,
        bcc_emails: bccList,
        newBccInput: '',
        isSending: false,
      });
    } catch (err) {
      addToast('Erro ao carregar e-mails do cliente para envio.', 'error');
    }
  };

  const handleExecuteSoloSend = async (enviarAgora = true) => {
    if (!sendSoloModal.to_email.trim()) {
      addToast('Informe o e-mail de destino principal (To:).', 'warning');
      return;
    }

    try {
      setSendSoloModal((prev) => ({ ...prev, isSending: true }));
      const payload = {
        empresa_id: sendSoloModal.client.id,
        tipo_backup: sendSoloModal.tipo_backup,
        tipo_email: sendSoloModal.tipo_email,
        template_id: parseInt(sendSoloModal.template_id, 10),
        destinatario_principal: sendSoloModal.to_email.trim(),
        bcc_emails: sendSoloModal.bcc_emails,
        enviar_agora: enviarAgora,
      };

      const res = await api.createAgendamento(payload);
      if (enviarAgora) {
        if (res.total_sucesso > 0) {
          addToast(`E-mail disparado com sucesso via SMTP para ${sendSoloModal.client.nome}!`, 'success');
        } else {
          addToast(`Erro ao enviar: ${res.detalhes_erros?.join(', ') || 'Falha no envio'}`, 'error');
        }
      } else {
        addToast(`E-mail agendado com sucesso para ${sendSoloModal.client.nome}!`, 'success');
      }

      setSendSoloModal((prev) => ({ ...prev, isOpen: false }));
      fetchClientes();
    } catch (err) {
      addToast(err.message || 'Erro ao processar envio', 'error');
    } finally {
      setSendSoloModal((prev) => ({ ...prev, isSending: false }));
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Users size={22} color="var(--brand-teal)" />
            <span>Gerenciamento de Clientes</span>
          </h1>
          <p className="page-subtitle">
            Base cadastral com e-mails principais, cópias secundárias, contatos e disparo direto
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setIsImportOpen(true)}>
            <FileSpreadsheet size={16} color="var(--brand-teal)" />
            <span>Importar Planilha</span>
          </button>
          <button className="btn btn-primary" onClick={() => setIsNewModalOpen(true)}>
            <Plus size={16} />
            <span>Nova Empresa</span>
          </button>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="filter-toolbar">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="form-control"
            placeholder="Buscar por empresa, responsável ou e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {/* Filter Backup Type */}
        <select
          className="form-control"
          style={{ width: '180px' }}
          value={tipoBackupFilter}
          onChange={(e) => setTipoBackupFilter(e.target.value)}
        >
          <option value="todos">Todos os Backups</option>
          <option value="diario">Diário</option>
          <option value="semanal">Semanal</option>
          <option value="mensal">Mensal</option>
          <option value="anual">Anual</option>
          <option value="cloud">Cloud</option>
        </select>

        {/* Filter Status Backup */}
        <select
          className="form-control"
          style={{ width: '170px' }}
          value={falhaFilter}
          onChange={(e) => setFalhaFilter(e.target.value)}
        >
          <option value="">Status: Todos</option>
          <option value="0">🟢 Normal</option>
          <option value="1">🔴 Em Falha</option>
        </select>

        {/* Filter Situation */}
        <select
          className="form-control"
          style={{ width: '150px' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="todos">Situação: Todas</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>

        <button className="btn btn-secondary btn-icon" onClick={fetchClientes} title="Recarregar">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <RefreshCw className="spin" size={28} />
          <p style={{ marginTop: '12px' }}>Carregando empresas...</p>
        </div>
      ) : clientes.length === 0 ? (
        <div className="card-panel" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <Users size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Nenhum cliente encontrado
          </h3>
          <p style={{ fontSize: '13px', marginBottom: '16px' }}>
            Tente ajustar os filtros ou cadastre/importe os clientes da planilha.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => setIsNewModalOpen(true)}>
            Cadastrar Nova Empresa
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Responsável</th>
                <th>E-mail Principal (To:)</th>
                <th>Tipos de Backup</th>
                <th>Status do Backup</th>
                <th>Situação</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/clientes/${c.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {c.nome}
                  </td>
                  <td>{c.responsavel_principal || '—'}</td>
                  <td>
                    {c.email_principal ? (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', color: '#38BDF8' }}>
                        {c.email_principal}
                        {c.total_emails > 1 && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '6px' }}>
                            (+{c.total_emails - 1} em cópia)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Nenhum</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {c.tipos_backup && c.tipos_backup.length > 0 ? (
                        c.tipos_backup.map((tb) => (
                          <span key={tb} className="backup-tag active">
                            {tb}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {c.backup_em_falha ? (
                      <span className="badge badge-falha">🔴 Em Falha</span>
                    ) : (
                      <span className="badge badge-normal">🟢 Normal</span>
                    )}
                  </td>
                  <td>
                    {c.status === 'ativo' ? (
                      <span className="badge badge-ativo">Ativo</span>
                    ) : (
                      <span className="badge badge-inativo">Inativo</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={(e) => handleOpenSoloSend(c, e)}
                        title="Enviar e-mail para este cliente"
                      >
                        <Send size={12} />
                        <span>Enviar E-mail</span>
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/clientes/${c.id}`);
                        }}
                      >
                        <span>Detalhes</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Importação Excel */}
      <ImportExcelModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={fetchClientes}
      />

      {/* Modal Cadastrar Nova Empresa Completo */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Cadastrar Nova Empresa"
        maxWidth="640px"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsNewModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleCreateClient}>
              Salvar Empresa
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateClient}>
          <div className="form-group">
            <label className="form-label">Nome da Empresa / Razão Social *</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex: AGIL AMBIENTAL LTDA"
              value={newClient.nome}
              onChange={(e) => setNewClient({ ...newClient, nome: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Responsável Principal</label>
              <input
                type="text"
                className="form-control"
                placeholder="Ex: João da Silva"
                value={newClient.responsavel_principal}
                onChange={(e) => setNewClient({ ...newClient, responsavel_principal: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Telefone / WhatsApp / Ramal</label>
              <input
                type="text"
                className="form-control"
                placeholder="(62) 99999-9999"
                value={newClient.telefone}
                onChange={(e) => setNewClient({ ...newClient, telefone: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">E-mail Principal (Recebe no campo To:) *</label>
            <input
              type="email"
              className="form-control"
              placeholder="principal@empresa.com.br"
              value={newClient.email_principal}
              onChange={(e) => setNewClient({ ...newClient, email_principal: e.target.value })}
              required
            />
          </div>

          {/* E-mails Secundários / Cópia */}
          <div className="form-group">
            <label className="form-label">E-mails Secundários (Vão em Cópia / BCC)</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="email"
                className="form-control"
                placeholder="copia@empresa.com.br"
                value={newClient.novo_secundario_input}
                onChange={(e) => setNewClient({ ...newClient, novo_secundario_input: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSecondaryEmailToNewClient();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAddSecondaryEmailToNewClient}
              >
                + Adicionar
              </button>
            </div>

            {newClient.emails_secundarios.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                {newClient.emails_secundarios.map((sec) => (
                  <span
                    key={sec}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'var(--bg-app)',
                      border: '1px solid var(--border-card)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#38BDF8',
                    }}
                  >
                    {sec}
                    <X
                      size={13}
                      style={{ cursor: 'pointer', color: '#EF4444' }}
                      onClick={() => handleRemoveSecondaryEmail(sec)}
                    />
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Tipos de Backup Contratados / Ativos</label>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Selecione as rotinas ativas para que este cliente seja incluído automaticamente nos envios em lote:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['diario', 'semanal', 'mensal', 'anual', 'cloud'].map((t) => {
                const active = newClient.tipos_backup.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => toggleBackupTypeInForm(t)}
                  >
                    {active ? '✓ ' : '+ '}
                    {t.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Situação</label>
              <select
                className="form-control"
                value={newClient.status}
                onChange={(e) => setNewClient({ ...newClient, status: e.target.value })}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Observações</label>
              <input
                type="text"
                className="form-control"
                placeholder="Ex: Servidor Proxmox / Fita LTO..."
                value={newClient.observacoes}
                onChange={(e) => setNewClient({ ...newClient, observacoes: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal Disparo Instantâneo Solo */}
      {sendSoloModal.isOpen && sendSoloModal.client && (
        <Modal
          isOpen={true}
          onClose={() => setSendSoloModal((prev) => ({ ...prev, isOpen: false }))}
          title={`Disparar E-mail para ${sendSoloModal.client.nome}`}
          maxWidth="580px"
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setSendSoloModal((prev) => ({ ...prev, isOpen: false }))}
                disabled={sendSoloModal.isSending}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleExecuteSoloSend(true)}
                disabled={sendSoloModal.isSending}
              >
                {sendSoloModal.isSending ? (
                  <RefreshCw className="spin" size={14} />
                ) : (
                  <Send size={14} />
                )}
                <span>{sendSoloModal.isSending ? 'Enviando via SMTP...' : 'Enviar Agora via SMTP'}</span>
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Template do E-mail *</label>
              <select
                className="form-control"
                value={sendSoloModal.template_id}
                onChange={(e) => setSendSoloModal({ ...sendSoloModal, template_id: e.target.value })}
              >
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.nome} ({tpl.categoria})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Tipo de Backup *</label>
                <select
                  className="form-control"
                  value={sendSoloModal.tipo_backup}
                  onChange={(e) => setSendSoloModal({ ...sendSoloModal, tipo_backup: e.target.value })}
                >
                  <option value="Diário">Diário</option>
                  <option value="Semanal">Semanal</option>
                  <option value="Mensal">Mensal</option>
                  <option value="Anual">Anual</option>
                  <option value="Cloud">Cloud</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Finalidade / Categoria</label>
                <select
                  className="form-control"
                  value={sendSoloModal.tipo_email}
                  onChange={(e) => setSendSoloModal({ ...sendSoloModal, tipo_email: e.target.value })}
                >
                  <option value="solicitacao_disco">Solicitação de Troca de Disco</option>
                  <option value="inicio_rotina">Início de Rotina</option>
                  <option value="finalizacao">Finalização de Rotina</option>
                  <option value="falha">Aviso de Falha</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Destinatário Principal (To:)</label>
              <input
                type="email"
                className="form-control"
                value={sendSoloModal.to_email}
                onChange={(e) => setSendSoloModal({ ...sendSoloModal, to_email: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Destinatários em Cópia Oculta (BCC / Secundários)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {sendSoloModal.bcc_emails.map((b) => (
                  <span
                    key={b}
                    style={{
                      background: 'var(--bg-app)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11.5px',
                      color: '#38BDF8',
                      border: '1px solid var(--border-card)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {b}
                    <X
                      size={12}
                      style={{ cursor: 'pointer', color: '#EF4444' }}
                      onClick={() =>
                        setSendSoloModal((prev) => ({
                          ...prev,
                          bcc_emails: prev.bcc_emails.filter((x) => x !== b),
                        }))
                      }
                    />
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="email"
                  className="form-control"
                  placeholder="Adicionar outro e-mail em cópia..."
                  value={sendSoloModal.newBccInput}
                  onChange={(e) => setSendSoloModal({ ...sendSoloModal, newBccInput: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = sendSoloModal.newBccInput.trim().toLowerCase();
                      if (val && !sendSoloModal.bcc_emails.includes(val)) {
                        setSendSoloModal((prev) => ({
                          ...prev,
                          bcc_emails: [...prev.bcc_emails, val],
                          newBccInput: '',
                        }));
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const val = sendSoloModal.newBccInput.trim().toLowerCase();
                    if (val && !sendSoloModal.bcc_emails.includes(val)) {
                      setSendSoloModal((prev) => ({
                        ...prev,
                        bcc_emails: [...prev.bcc_emails, val],
                        newBccInput: '',
                      }));
                    }
                  }}
                >
                  + Adicionar
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
