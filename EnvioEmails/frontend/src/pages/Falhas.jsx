import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Send,
  CheckCircle2,
  Calendar,
  Clock,
  Mail,
  Plus,
  RefreshCw,
  Eye,
  FileCode2,
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { api } from '../api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

export default function Falhas() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [falhas, setFalhas] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isDispararOpen, setIsDispararOpen] = useState(false);
  const [isNovaFalhaOpen, setIsNovaFalhaOpen] = useState(false);
  const [selectedFalha, setSelectedFalha] = useState(null);

  // Disparo payload
  const [disparoPayload, setDisparoPayload] = useState({
    empresa_id: null,
    tipo_backup: 'Semanal',
    motivo: 'Não troca do disco',
    modo: 'template', // 'template' | 'manual'
    template_id: '',
    custom_assunto: '',
    custom_html: '<p>Prezado(a) {{responsavel}},</p>\n<p>Identificamos que o backup {{tipo_backup}} não foi concluído devido a: <strong>{{motivo}}</strong>.</p>\n<p>Solicitamos a troca e conexão imediata da mídia de armazenamento.</p>',
    agendar: false,
    data_agendamento: new Date().toISOString().split('T')[0],
    horario_agendamento: '16:30',
  });

  // Nova Falha payload
  const [novaFalha, setNovaFalha] = useState({
    empresa_id: '',
    tipo_backup: 'Semanal',
    motivo: 'Não troca do disco',
    descricao: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [falhasData, tplData, empData] = await Promise.all([
        api.getFalhas('em_falha'),
        api.getTemplates(),
        api.getClients(),
      ]);
      setFalhas(falhasData);
      setTemplates(tplData);
      setEmpresas(empData);
    } catch (err) {
      addToast(err.message || 'Erro ao carregar falhas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleResolve = async (id, empresaNome) => {
    try {
      await api.resolveFalha(id);
      addToast(`Falha resolvida para ${empresaNome}!`, 'success');
      fetchData();
    } catch (err) {
      addToast(err.message || 'Erro ao resolver falha', 'error');
    }
  };

  const openDisparoModal = (falha) => {
    setSelectedFalha(falha);

    // Tenta encontrar um template de falha padrão
    const defaultTpl = templates.find(
      (t) => t.categoria === 'falha' && (t.chave.includes('FALHA') || t.chave.includes('DISCO'))
    );

    setDisparoPayload({
      empresa_id: falha.empresa_id,
      tipo_backup: falha.tipo_backup || 'Semanal',
      motivo: falha.motivo,
      modo: falha.motivo === 'Outro' ? 'manual' : 'template',
      template_id: defaultTpl ? defaultTpl.id : '',
      custom_assunto: `${falha.empresa_nome} - Falha na Rotina de Backup ${falha.tipo_backup}`,
      custom_html: '<p>Prezado(a) {{responsavel}},</p>\n<p>Identificamos que o backup {{tipo_backup}} não foi concluído devido a: <strong>{{motivo}}</strong>.</p>\n<p>Solicitamos a troca e conexão imediata da mídia de armazenamento.</p>',
      agendar: false,
      data_agendamento: new Date().toISOString().split('T')[0],
      horario_agendamento: '16:30',
    });
    setIsDispararOpen(true);
  };

  const handleSendComunicado = async () => {
    try {
      const payload = {
        empresa_id: disparoPayload.empresa_id,
        tipo_backup: disparoPayload.tipo_backup,
        motivo: disparoPayload.motivo,
        template_id: disparoPayload.modo === 'template' ? disparoPayload.template_id : null,
        custom_assunto: disparoPayload.custom_assunto,
        custom_html: disparoPayload.modo === 'manual' ? disparoPayload.custom_html : null,
        agendar: disparoPayload.agendar,
        datetime_previsto: disparoPayload.agendar
          ? `${disparoPayload.data_agendamento} ${disparoPayload.horario_agendamento}:00`
          : null,
      };

      const res = await api.dispararComunicadoFalha(payload);
      if (res.agendado) {
        addToast('Comunicado de falha agendado com sucesso!', 'success');
      } else {
        addToast(`Comunicado enviado via SMTP para ${res.destinatario} (+${res.bcc_count} BCC)!`, 'success');
      }
      setIsDispararOpen(false);
      fetchData();
    } catch (err) {
      addToast(err.message || 'Erro ao enviar comunicado', 'error');
    }
  };

  const handleCreateNovaFalha = async (e) => {
    e.preventDefault();
    if (!novaFalha.empresa_id) {
      addToast('Selecione uma empresa.', 'warning');
      return;
    }

    try {
      await api.registerFalha({
        empresa_id: parseInt(novaFalha.empresa_id, 10),
        tipo_backup: novaFalha.tipo_backup,
        motivo: novaFalha.motivo,
        descricao: novaFalha.descricao,
      });
      addToast('Falha registrada com sucesso!', 'warning');
      setIsNovaFalhaOpen(false);
      setNovaFalha({ empresa_id: '', tipo_backup: 'Semanal', motivo: 'Não troca do disco', descricao: '' });
      fetchData();
    } catch (err) {
      addToast(err.message || 'Erro ao registrar falha', 'error');
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <AlertTriangle size={22} color="#EF4444" />
            <span>Central de Falhas de Backup</span>
          </h1>
          <p className="page-subtitle">
            Acompanhamento de incidentes de backup, controle de não troca de disco e disparo de avisos
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={fetchData}>
            <RefreshCw size={14} />
            <span>Atualizar</span>
          </button>
          <button className="btn btn-danger" onClick={() => setIsNovaFalhaOpen(true)}>
            <Plus size={16} />
            <span>Registrar Falha</span>
          </button>
        </div>
      </div>

      {/* Tabela de Falhas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <RefreshCw className="spin" size={28} />
          <p style={{ marginTop: '12px' }}>Carregando incidentes de falha...</p>
        </div>
      ) : falhas.length === 0 ? (
        <div className="card-panel" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <CheckCircle2 size={40} color="#10B981" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Nenhum backup em falha no momento!
          </h3>
          <p style={{ fontSize: '13px' }}>
            Todas as rotinas de backup estão normais ou as falhas foram resolvidas.
          </p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Tipo Backup</th>
                <th>Responsável</th>
                <th>Motivo da Falha</th>
                <th>Data do Registro</th>
                <th>Último E-mail Enviado</th>
                <th>Próximo Agendado</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {falhas.map((f) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 700, color: '#F87171' }}>{f.empresa_nome}</td>
                  <td>
                    <span className="backup-tag active">{f.tipo_backup}</span>
                  </td>
                  <td>{f.responsavel_principal || '—'}</td>
                  <td>
                    <span className="badge badge-falha">{f.motivo}</span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    {new Date(f.data_registro).toLocaleString('pt-BR')}
                  </td>
                  <td style={{ fontSize: '12px', color: f.ultimo_email_enviado ? '#38BDF8' : 'var(--text-muted)' }}>
                    {f.ultimo_email_enviado ? new Date(f.ultimo_email_enviado).toLocaleString('pt-BR') : 'Nenhum'}
                  </td>
                  <td style={{ fontSize: '12px', color: f.proximo_email_agendado ? '#FBBF24' : 'var(--text-muted)' }}>
                    {f.proximo_email_agendado ? new Date(f.proximo_email_agendado).toLocaleString('pt-BR') : 'Nenhum'}
                  </td>
                  <td>
                    <span className="badge badge-falha">🔴 Em Falha</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openDisparoModal(f)}
                        title="Enviar ou agendar e-mail de alerta de falha"
                      >
                        <Send size={12} />
                        <span>Comunicar</span>
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleResolve(f.id, f.empresa_nome)}
                        title="Marcar como resolvida"
                      >
                        <CheckCircle2 size={12} color="#10B981" />
                        <span>Resolver</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Disparar Comunicado de Falha */}
      <Modal
        isOpen={isDispararOpen}
        onClose={() => setIsDispararOpen(false)}
        title={`Comunicado de Falha — ${selectedFalha?.empresa_nome}`}
        maxWidth="680px"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsDispararOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSendComunicado}>
              <Send size={14} />
              <span>{disparoPayload.agendar ? 'Confirmar Agendamento' : 'Enviar E-mail Imediatamente'}</span>
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Tipo de Backup</label>
              <input type="text" className="form-control" value={disparoPayload.tipo_backup} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Motivo</label>
              <input type="text" className="form-control" value={disparoPayload.motivo} disabled />
            </div>
          </div>

          {/* Alternador de Modo: Template vs E-mail Manual */}
          <div className="form-group">
            <label className="form-label">Formato da Mensagem</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className={`btn btn-sm ${disparoPayload.modo === 'template' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDisparoPayload({ ...disparoPayload, modo: 'template' })}
              >
                Usar Template Pré-definido
              </button>
              <button
                type="button"
                className={`btn btn-sm ${disparoPayload.modo === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDisparoPayload({ ...disparoPayload, modo: 'manual' })}
              >
                Escrever E-mail Manualmente (HTML)
              </button>
            </div>
          </div>

          {disparoPayload.modo === 'template' ? (
            <div className="form-group">
              <label className="form-label">Selecione o Template</label>
              <select
                className="form-control"
                value={disparoPayload.template_id}
                onChange={(e) => setDisparoPayload({ ...disparoPayload, template_id: e.target.value })}
              >
                <option value="">Selecione...</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.nome} ({tpl.categoria})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Assunto do E-mail</label>
                <input
                  type="text"
                  className="form-control"
                  value={disparoPayload.custom_assunto}
                  onChange={(e) => setDisparoPayload({ ...disparoPayload, custom_assunto: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Código HTML da Mensagem</label>
                <CodeMirror
                  value={disparoPayload.custom_html}
                  height="160px"
                  extensions={[html()]}
                  theme="dark"
                  onChange={(val) => setDisparoPayload({ ...disparoPayload, custom_html: val })}
                />
              </div>
            </>
          )}

          {/* Agendamento Toggle */}
          <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: disparoPayload.agendar ? '12px' : '0' }}>
              <input
                type="checkbox"
                id="agendar_falha"
                checked={disparoPayload.agendar}
                onChange={(e) => setDisparoPayload({ ...disparoPayload, agendar: e.target.checked })}
              />
              <label htmlFor="agendar_falha" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                Programar / Agendar envio para data e horário futuros
              </label>
            </div>

            {disparoPayload.agendar && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Data</label>
                  <input
                    type="date"
                    className="form-control"
                    value={disparoPayload.data_agendamento}
                    onChange={(e) => setDisparoPayload({ ...disparoPayload, data_agendamento: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label">Horário</label>
                  <input
                    type="time"
                    className="form-control"
                    value={disparoPayload.horario_agendamento}
                    onChange={(e) => setDisparoPayload({ ...disparoPayload, horario_agendamento: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal Registrar Nova Falha */}
      <Modal
        isOpen={isNovaFalhaOpen}
        onClose={() => setIsNovaFalhaOpen(false)}
        title="Registrar Ocorrência de Falha"
        maxWidth="500px"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsNovaFalhaOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-danger" onClick={handleCreateNovaFalha}>
              Registrar Falha
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateNovaFalha}>
          <div className="form-group">
            <label className="form-label">Empresa / Cliente *</label>
            <select
              className="form-control"
              value={novaFalha.empresa_id}
              onChange={(e) => setNovaFalha({ ...novaFalha, empresa_id: e.target.value })}
              required
            >
              <option value="">Selecione a empresa...</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Motivo da Falha *</label>
            <select
              className="form-control"
              value={novaFalha.motivo}
              onChange={(e) => setNovaFalha({ ...novaFalha, motivo: e.target.value })}
            >
              <option value="Não troca do disco">Não troca do disco</option>
              <option value="Disco não disponível">Disco não disponível</option>
              <option value="Falha na rotina">Falha na rotina</option>
              <option value="Falha no armazenamento">Falha no armazenamento</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Tipo de Backup Afetado</label>
            <select
              className="form-control"
              value={novaFalha.tipo_backup}
              onChange={(e) => setNovaFalha({ ...novaFalha, tipo_backup: e.target.value })}
            >
              <option value="Diário">Diário</option>
              <option value="Semanal">Semanal</option>
              <option value="Mensal">Mensal</option>
              <option value="Anual">Anual</option>
              <option value="Cloud">Cloud</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Descrição Técnica</label>
            <textarea
              className="form-control"
              rows="3"
              placeholder="Descreva a ocorrência..."
              value={novaFalha.descricao}
              onChange={(e) => setNovaFalha({ ...novaFalha, descricao: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
