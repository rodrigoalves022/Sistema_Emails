import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Users,
  Mail,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Calendar,
  Send,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Star,
  Check,
  X,
  Phone,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

export default function ClienteDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [client, setClient] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modais
  const [isFalhaModalOpen, setIsFalhaModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSoloSendModalOpen, setIsSoloSendModalOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState(null); // null | { id, endereco, tipo, contato_nome }

  // Falha payload
  const [falhaData, setFalhaData] = useState({
    motivo: 'Não troca do disco',
    tipo_backup: 'Semanal',
    descricao: '',
  });

  // Novo E-mail payload
  const [newEmail, setNewEmail] = useState({
    endereco: '',
    tipo: 'secundario',
    contato_nome: '',
  });

  // Edição rápida de cadastro
  const [editForm, setEditForm] = useState({
    nome: '',
    responsavel_principal: '',
    telefone: '',
    status: 'ativo',
    observacoes: '',
    tipos_backup: [],
  });

  // Envio Imediato Solo
  const [soloSendForm, setSoloSendForm] = useState({
    template_id: '',
    tipo_backup: 'Semanal',
    tipo_email: 'solicitacao_disco',
    to_email: '',
    bcc_emails: [],
    newBccInput: '',
    isSending: false,
  });

  const fetchClient = async () => {
    try {
      setLoading(true);
      const [data, tplData] = await Promise.all([
        api.getClient(id),
        api.getTemplates(),
      ]);
      setClient(data);
      setTemplates(tplData);

      const toEmail = data.emails?.find((em) => em.tipo === 'principal')?.endereco || data.email_principal || '';
      const bccs = data.emails?.filter((em) => em.tipo === 'secundario').map((em) => em.endereco) || [];
      const defaultBackup = data.tipos_backup && data.tipos_backup.length > 0 ? data.tipos_backup[0] : 'Semanal';

      setSoloSendForm((prev) => ({
        ...prev,
        template_id: tplData.length > 0 ? tplData[0].id : '',
        tipo_backup: defaultBackup,
        to_email: toEmail,
        bcc_emails: bccs,
      }));

      // Pega telefone do primeiro contato
      const fTel = data.contatos && data.contatos.length > 0 ? data.contatos[0].telefone : '';
      setEditForm({
        nome: data.nome,
        responsavel_principal: data.responsavel_principal || '',
        telefone: fTel || '',
        status: data.status || 'ativo',
        observacoes: data.observacoes || '',
        tipos_backup: data.tipos_backup || [],
      });
    } catch (err) {
      addToast(err.message || 'Erro ao carregar detalhes da empresa', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClient();
  }, [id]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    addToast(`E-mail ${text} copiado!`, 'success');
  };

  const handleToggleFalha = async () => {
    if (client.backup_em_falha) {
      try {
        await api.toggleFalha(id, { em_falha: false });
        addToast('Status de backup normalizado com sucesso!', 'success');
        fetchClient();
      } catch (err) {
        addToast(err.message || 'Erro ao normalizar status', 'error');
      }
    } else {
      setIsFalhaModalOpen(true);
    }
  };

  const handleConfirmFalha = async () => {
    try {
      await api.toggleFalha(id, {
        em_falha: true,
        motivo: falhaData.motivo,
        tipo_backup: falhaData.tipo_backup,
        descricao: falhaData.descricao,
      });
      addToast('Backup marcado em falha. Alerta registrado no painel.', 'warning');
      setIsFalhaModalOpen(false);
      fetchClient();
    } catch (err) {
      addToast(err.message || 'Erro ao registrar falha', 'error');
    }
  };

  const handleToggleBackupType = async (tipo, currentActive) => {
    try {
      await api.toggleBackupType(id, tipo, !currentActive);
      addToast(`Tipo ${tipo.toUpperCase()} ${!currentActive ? 'ativado' : 'desativado'}.`, 'info');
      fetchClient();
    } catch (err) {
      addToast(err.message || 'Erro ao alternar tipo de backup', 'error');
    }
  };

  // Adicionar E-mail
  const handleAddEmail = async (e) => {
    e.preventDefault();
    if (!newEmail.endereco.trim()) return;

    try {
      await api.addClientEmail(id, {
        endereco: newEmail.endereco.trim().toLowerCase(),
        tipo: newEmail.tipo,
        ativo: 1,
      });
      addToast('E-mail cadastrado com sucesso!', 'success');
      setIsEmailModalOpen(false);
      setNewEmail({ endereco: '', tipo: 'secundario', contato_nome: '' });
      fetchClient();
    } catch (err) {
      addToast(err.message || 'Erro ao adicionar e-mail', 'error');
    }
  };

  // Salvar Edição de E-mail
  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    if (!editingEmail || !editingEmail.endereco.trim()) return;

    try {
      await api.updateClientEmail(id, editingEmail.id, {
        endereco: editingEmail.endereco.trim().toLowerCase(),
        tipo: editingEmail.tipo,
        ativo: 1,
      });
      addToast('E-mail atualizado com sucesso!', 'success');
      setEditingEmail(null);
      fetchClient();
    } catch (err) {
      addToast(err.message || 'Erro ao atualizar e-mail', 'error');
    }
  };

  // Excluir E-mail
  const handleDeleteEmail = async (emailId, endereco) => {
    if (!window.confirm(`Tem certeza que deseja remover o e-mail "${endereco}"?`)) return;
    try {
      await api.deleteClientEmail(id, emailId);
      addToast('E-mail removido.', 'info');
      fetchClient();
    } catch (err) {
      addToast(err.message || 'Erro ao excluir e-mail', 'error');
    }
  };

  // Tornar Principal
  const handleSetPrincipal = async (emailId) => {
    try {
      await api.setClientEmailPrincipal(id, emailId);
      addToast('E-mail definido como principal (To:)', 'success');
      fetchClient();
    } catch (err) {
      addToast(err.message || 'Erro ao alterar e-mail principal', 'error');
    }
  };

  // Atualizar Cadastro da Empresa
  const handleUpdateEmpresa = async (e) => {
    e.preventDefault();
    try {
      await api.updateClient(id, {
        nome: editForm.nome.trim().toUpperCase(),
        responsavel_principal: editForm.responsavel_principal.trim(),
        status: editForm.status,
        observacoes: editForm.observacoes,
        backup_em_falha: client.backup_em_falha,
        tipos_backup: editForm.tipos_backup,
        contatos: editForm.responsavel_principal
          ? [{ nome: editForm.responsavel_principal, telefone: editForm.telefone.trim(), is_principal: 1 }]
          : [],
      });
      addToast('Dados da empresa atualizados com sucesso!', 'success');
      setIsEditModalOpen(false);
      fetchClient();
    } catch (err) {
      addToast(err.message || 'Erro ao salvar alterações', 'error');
    }
  };

  // Executar Disparo Solo Imediato
  const handleExecuteSoloSend = async (enviarAgora = true) => {
    if (!soloSendForm.to_email.trim()) {
      addToast('Informe o e-mail destinatário principal (To:).', 'warning');
      return;
    }

    try {
      setSoloSendForm((prev) => ({ ...prev, isSending: true }));
      const payload = {
        empresa_id: parseInt(id, 10),
        tipo_backup: soloSendForm.tipo_backup,
        tipo_email: soloSendForm.tipo_email,
        template_id: parseInt(soloSendForm.template_id, 10),
        destinatario_principal: soloSendForm.to_email.trim(),
        bcc_emails: soloSendForm.bcc_emails,
        enviar_agora: enviarAgora,
      };

      const res = await api.createAgendamento(payload);
      if (enviarAgora) {
        if (res.total_sucesso > 0) {
          addToast(`E-mail disparado com sucesso via SMTP para ${client.nome}!`, 'success');
        } else {
          addToast(`Erro no envio: ${res.detalhes_erros?.join(', ') || 'Falha no servidor SMTP'}`, 'error');
        }
      } else {
        addToast('E-mail agendado com sucesso!', 'success');
      }

      setIsSoloSendModalOpen(false);
      fetchClient();
    } catch (err) {
      addToast(err.message || 'Erro ao processar envio', 'error');
    } finally {
      setSoloSendForm((prev) => ({ ...prev, isSending: false }));
    }
  };

  if (loading && !client) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '60px' }}>
        <RefreshCw className="spin" size={32} />
        <p style={{ marginTop: '12px' }}>Carregando dados da empresa...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '60px' }}>
        <h3>Empresa não encontrada</h3>
        <button className="btn btn-secondary" style={{ marginTop: '16px' }} onClick={() => navigate('/clientes')}>
          Voltar para Lista
        </button>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Top Breadcrumb & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/clientes')}>
          <ArrowLeft size={14} />
          <span>Voltar para Clientes</span>
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => setIsSoloSendModalOpen(true)}>
            <Send size={15} />
            <span>Disparar E-mail Agora</span>
          </button>

          <button
            className={`btn ${client.backup_em_falha ? 'btn-danger' : 'btn-secondary'}`}
            onClick={handleToggleFalha}
          >
            <AlertTriangle size={15} />
            <span>{client.backup_em_falha ? 'Resolver / Normalizar Falha' : 'Marcar Backup em Falha'}</span>
          </button>
        </div>
      </div>

      {/* Main Company Card Header */}
      <div className="card-panel" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 800 }}>{client.nome}</h1>
              {client.backup_em_falha ? (
                <span className="badge badge-falha">🔴 Backup em Falha</span>
              ) : (
                <span className="badge badge-normal">🟢 Status Normal</span>
              )}
              {client.status === 'ativo' ? (
                <span className="badge badge-ativo">Ativo</span>
              ) : (
                <span className="badge badge-inativo">Inativo</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
              <div>
                Responsável: <strong style={{ color: 'var(--text-primary)' }}>{client.responsavel_principal || 'Não informado'}</strong>
              </div>
              {client.contatos && client.contatos.length > 0 && client.contatos[0].telefone && (
                <div>
                  Telefone / Contato: <strong style={{ color: '#38BDF8' }}>{client.contatos[0].telefone}</strong>
                </div>
              )}
            </div>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={() => setIsEditModalOpen(true)}>
            <Edit2 size={13} />
            <span>Editar Cadastro</span>
          </button>
        </div>

        {client.observacoes && (
          <div style={{ marginTop: '16px', padding: '10px 14px', background: 'var(--bg-app)', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            <strong>Observações:</strong> {client.observacoes}
          </div>
        )}
      </div>

      {/* Grid: Tipos de Backup + E-mails/Contatos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '24px', marginBottom: '24px' }}>
        {/* Tipos de Backup */}
        <div className="card-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <HardDrive size={18} color="var(--brand-teal)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Tipos de Backup Contratados</h3>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Ative ou desative as rotinas para inclusão nos agendamentos e envios em lote:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {client.tipos_backup_detalhes?.map((tb) => (
              <div
                key={tb.tipo}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: tb.ativo ? 'rgba(0, 179, 155, 0.08)' : 'var(--bg-app)',
                  border: `1px solid ${tb.ativo ? 'rgba(0, 179, 155, 0.3)' : 'var(--border-subtle)'}`,
                  borderRadius: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, textTransform: 'uppercase' }}>
                    {tb.tipo}
                  </span>
                  {tb.ativo && <span style={{ fontSize: '11px', color: 'var(--brand-teal)' }}>✓ Ativo</span>}
                </div>
                <button
                  className={`btn btn-sm ${tb.ativo ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleToggleBackupType(tb.tipo, tb.ativo)}
                >
                  {tb.ativo ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* E-mails Cadastrados com CRUD completo */}
        <div className="card-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={18} color="var(--brand-teal)" />
              <h3 style={{ fontSize: '15px', fontWeight: 700 }}>E-mails e Destinatários</h3>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setIsEmailModalOpen(true)}>
              <Plus size={14} />
              <span>Adicionar E-mail</span>
            </button>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            O <strong>E-mail Principal</strong> recebe no campo <code>To:</code>. Os <strong>Secundários</strong> são enviados em cópia oculta (<code>BCC:</code>) automaticamente.
          </p>

          <div className="table-wrapper">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Endereço de E-mail</th>
                  <th>Tipo de Envio</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {client.emails?.map((em) => (
                  <tr key={em.id || em.endereco}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: '#38BDF8' }}>
                      {em.endereco}
                    </td>
                    <td>
                      {em.tipo === 'principal' ? (
                        <span className="badge badge-normal" style={{ fontSize: '11px' }}>
                          ★ Principal (To:)
                        </span>
                      ) : (
                        <span className="badge badge-processando" style={{ fontSize: '11px' }}>
                          Cópia Oculta (BCC:)
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {em.tipo !== 'principal' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleSetPrincipal(em.id)}
                            title="Tornar este o e-mail Principal (To:)"
                          >
                            <Star size={12} color="#FBBF24" />
                            <span>Tornar Principal</span>
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-icon btn-sm"
                          onClick={() => setEditingEmail(em)}
                          title="Editar e-mail"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          className="btn btn-secondary btn-icon btn-sm"
                          onClick={() => copyToClipboard(em.endereco)}
                          title="Copiar e-mail"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          className="btn btn-secondary btn-icon btn-sm"
                          onClick={() => handleDeleteEmail(em.id, em.endereco)}
                          title="Excluir este e-mail"
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
        </div>
      </div>

      {/* Histórico Recente e Agendamentos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Agendamentos Pendentes */}
        <div className="card-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Calendar size={18} color="#F59E0B" />
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Agendamentos Programados</h3>
          </div>

          {client.agendamentos?.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '16px 0' }}>
              Nenhum e-mail agendado para este cliente.
            </p>
          ) : (
            <div className="table-wrapper">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Data / Hora</th>
                    <th>Backup</th>
                    <th>Template</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {client.agendamentos?.map((ag) => (
                    <tr key={ag.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                        {new Date(ag.datetime_previsto).toLocaleString('pt-BR')}
                      </td>
                      <td>
                        <span className="backup-tag active">{ag.tipo_backup}</span>
                      </td>
                      <td>{ag.template_nome}</td>
                      <td>
                        <span className="badge badge-agendado">🟡 Agendado</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Histórico de Envios */}
        <div className="card-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Send size={18} color="var(--brand-teal)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Últimas Comunicações Enviadas</h3>
          </div>

          {client.historico_envios?.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '16px 0' }}>
              Nenhum e-mail enviado recentemente para este cliente.
            </p>
          ) : (
            <div className="table-wrapper">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Data / Hora</th>
                    <th>Assunto</th>
                    <th>Destinatário</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {client.historico_envios?.map((env) => (
                    <tr key={env.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                        {new Date(env.data_envio).toLocaleString('pt-BR')}
                      </td>
                      <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {env.assunto}
                      </td>
                      <td style={{ fontSize: '12px', color: '#38BDF8' }}>{env.destinatario_principal}</td>
                      <td>
                        {env.status === 'sucesso' ? (
                          <span className="badge badge-normal" style={{ fontSize: '11px' }}>✓ Enviado</span>
                        ) : (
                          <span className="badge badge-falha" style={{ fontSize: '11px' }}>✕ Erro</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Disparo Solo Imediato */}
      {isSoloSendModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsSoloSendModalOpen(false)}
          title={`Disparar E-mail para ${client.nome}`}
          maxWidth="580px"
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setIsSoloSendModalOpen(false)}
                disabled={soloSendForm.isSending}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleExecuteSoloSend(true)}
                disabled={soloSendForm.isSending}
              >
                {soloSendForm.isSending ? (
                  <RefreshCw className="spin" size={14} />
                ) : (
                  <Send size={14} />
                )}
                <span>{soloSendForm.isSending ? 'Disparando via SMTP...' : 'Enviar Agora via SMTP'}</span>
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Template de E-mail *</label>
              <select
                className="form-control"
                value={soloSendForm.template_id}
                onChange={(e) => setSoloSendForm({ ...soloSendForm, template_id: e.target.value })}
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
                  value={soloSendForm.tipo_backup}
                  onChange={(e) => setSoloSendForm({ ...soloSendForm, tipo_backup: e.target.value })}
                >
                  <option value="Diário">Diário</option>
                  <option value="Semanal">Semanal</option>
                  <option value="Mensal">Mensal</option>
                  <option value="Anual">Anual</option>
                  <option value="Cloud">Cloud</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Tipo / Finalidade</label>
                <select
                  className="form-control"
                  value={soloSendForm.tipo_email}
                  onChange={(e) => setSoloSendForm({ ...soloSendForm, tipo_email: e.target.value })}
                >
                  <option value="solicitacao_disco">Solicitação de Disco</option>
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
                value={soloSendForm.to_email}
                onChange={(e) => setSoloSendForm({ ...soloSendForm, to_email: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Cópias Ocultas (BCC / Secundários)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {soloSendForm.bcc_emails.map((b) => (
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
                        setSoloSendForm((prev) => ({
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
                  placeholder="Adicionar e-mail em cópia..."
                  value={soloSendForm.newBccInput}
                  onChange={(e) => setSoloSendForm({ ...soloSendForm, newBccInput: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = soloSendForm.newBccInput.trim().toLowerCase();
                      if (val && !soloSendForm.bcc_emails.includes(val)) {
                        setSoloSendForm((prev) => ({
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
                    const val = soloSendForm.newBccInput.trim().toLowerCase();
                    if (val && !soloSendForm.bcc_emails.includes(val)) {
                      setSoloSendForm((prev) => ({
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

      {/* Modal Adicionar E-mail */}
      <Modal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        title="Adicionar Novo E-mail"
        maxWidth="500px"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsEmailModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleAddEmail}>
              Salvar E-mail
            </button>
          </>
        }
      >
        <form onSubmit={handleAddEmail}>
          <div className="form-group">
            <label className="form-label">Endereço de E-mail *</label>
            <input
              type="email"
              className="form-control"
              placeholder="exemplo@empresa.com.br"
              value={newEmail.endereco}
              onChange={(e) => setNewEmail({ ...newEmail, endereco: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tipo de Destinatário</label>
            <select
              className="form-control"
              value={newEmail.tipo}
              onChange={(e) => setNewEmail({ ...newEmail, tipo: e.target.value })}
            >
              <option value="secundario">Secundário (Cópia Oculta - BCC)</option>
              <option value="principal">Principal (To: Destinatário Direto)</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* Modal Editar E-mail */}
      {editingEmail && (
        <Modal
          isOpen={true}
          onClose={() => setEditingEmail(null)}
          title="Editar E-mail"
          maxWidth="500px"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditingEmail(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleUpdateEmail}>
                Salvar Alterações
              </button>
            </>
          }
        >
          <form onSubmit={handleUpdateEmail}>
            <div className="form-group">
              <label className="form-label">Endereço de E-mail *</label>
              <input
                type="email"
                className="form-control"
                value={editingEmail.endereco}
                onChange={(e) => setEditingEmail({ ...editingEmail, endereco: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de Destinatário</label>
              <select
                className="form-control"
                value={editingEmail.tipo}
                onChange={(e) => setEditingEmail({ ...editingEmail, tipo: e.target.value })}
              >
                <option value="secundario">Secundário (Cópia Oculta - BCC)</option>
                <option value="principal">Principal (To: Destinatário Direto)</option>
              </select>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Editar Empresa Completo */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Editar Cadastro da Empresa"
        maxWidth="560px"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleUpdateEmpresa}>
              Salvar Alterações
            </button>
          </>
        }
      >
        <form onSubmit={handleUpdateEmpresa}>
          <div className="form-group">
            <label className="form-label">Nome da Empresa / Razão Social *</label>
            <input
              type="text"
              className="form-control"
              value={editForm.nome}
              onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Responsável Principal</label>
              <input
                type="text"
                className="form-control"
                value={editForm.responsavel_principal}
                onChange={(e) => setEditForm({ ...editForm, responsavel_principal: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Telefone / Contato</label>
              <input
                type="text"
                className="form-control"
                value={editForm.telefone}
                onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Situação</label>
            <select
              className="form-control"
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea
              className="form-control"
              rows="3"
              value={editForm.observacoes}
              onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Modal Marcar Falha */}
      <Modal
        isOpen={isFalhaModalOpen}
        onClose={() => setIsFalhaModalOpen(false)}
        title="Registrar Falha de Backup"
        maxWidth="500px"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsFalhaModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-danger" onClick={handleConfirmFalha}>
              Confirmar Falha
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Motivo da Falha *</label>
          <select
            className="form-control"
            value={falhaData.motivo}
            onChange={(e) => setFalhaData({ ...falhaData, motivo: e.target.value })}
          >
            <option value="Não troca do disco">Não troca do disco</option>
            <option value="Disco não disponível">Disco não disponível</option>
            <option value="Falha na rotina">Falha na rotina</option>
            <option value="Falha no armazenamento">Falha no armazenamento</option>
            <option value="Outro">Outro (especificar)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Tipo de Backup Afetado</label>
          <select
            className="form-control"
            value={falhaData.tipo_backup}
            onChange={(e) => setFalhaData({ ...falhaData, tipo_backup: e.target.value })}
          >
            <option value="Diário">Diário</option>
            <option value="Semanal">Semanal</option>
            <option value="Mensal">Mensal</option>
            <option value="Anual">Anual</option>
            <option value="Cloud">Cloud</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Detalhes Adicionais</label>
          <textarea
            className="form-control"
            rows="3"
            placeholder="Descreva a ocorrência técnica..."
            value={falhaData.descricao}
            onChange={(e) => setFalhaData({ ...falhaData, descricao: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}
