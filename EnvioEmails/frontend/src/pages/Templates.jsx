import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCode2,
  Plus,
  Edit3,
  Trash2,
  Copy,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

export default function Templates() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const [newTemplate, setNewTemplate] = useState({
    chave: '',
    nome: '',
    categoria: 'cobranca',
    finalidade: '',
    tipo_backup_relacionado: 'semanal',
    assunto: '{{empresa}} - Solicitação de Troca de Disco',
    html_content: '<p>Esperamos que esteja tudo bem. Solicitamos a troca da mídia de backup {{tipo_backup}} até às 16:30 de hoje.</p>',
    estilo: 'marca',
    status: 'ativo',
  });

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (err) {
      addToast(err.message || 'Erro ao carregar templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!newTemplate.chave.trim() || !newTemplate.nome.trim()) {
      addToast('Chave e nome são obrigatórios.', 'warning');
      return;
    }

    try {
      const payload = {
        ...newTemplate,
        chave: newTemplate.chave.trim().toUpperCase().replace(/\s+/g, '_'),
      };
      const res = await api.createTemplate(payload);
      addToast('Template criado com sucesso!', 'success');
      setIsNewModalOpen(false);
      navigate(`/templates/${res.id}`);
    } catch (err) {
      addToast(err.message || 'Erro ao criar template', 'error');
    }
  };

  const handleDelete = async (id, nome) => {
    if (!window.confirm(`Tem certeza que deseja excluir o template "${nome}"?`)) return;
    try {
      await api.deleteTemplate(id);
      addToast('Template excluído com sucesso.', 'info');
      fetchTemplates();
    } catch (err) {
      addToast(err.message || 'Erro ao excluir template', 'error');
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <FileCode2 size={22} color="var(--brand-teal)" />
            <span>Catálogo de Templates HTML</span>
          </h1>
          <p className="page-subtitle">
            Modelos de e-mails corporativos, solicitações de troca de mídia, avisos de início e alertas de falha
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsNewModalOpen(true)}>
          <Plus size={16} />
          <span>Novo Template</span>
        </button>
      </div>

      {/* Grid / Tabela de Templates */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <RefreshCw className="spin" size={28} />
          <p style={{ marginTop: '12px' }}>Carregando templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="card-panel" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <FileCode2 size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Nenhum template cadastrado
          </h3>
          <p style={{ fontSize: '13px', marginBottom: '16px' }}>
            Crie seu primeiro modelo de e-mail com editor HTML split-view.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => setIsNewModalOpen(true)}>
            Criar Template
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th>Nome do Template</th>
                <th>Chave / Código</th>
                <th>Categoria</th>
                <th>Finalidade / Rotina</th>
                <th>Backup Relacionado</th>
                <th>Status</th>
                <th>Última Alteração</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((tpl) => (
                <tr
                  key={tpl.id}
                  onClick={() => navigate(`/templates/${tpl.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{tpl.nome}</td>
                  <td>
                    <code style={{ fontSize: '11px', color: '#38BDF8', background: 'var(--bg-app)', padding: '2px 6px', borderRadius: '4px' }}>
                      {tpl.chave}
                    </code>
                  </td>
                  <td>
                    <span className="badge badge-normal" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                      {tpl.categoria}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {tpl.finalidade || '—'}
                  </td>
                  <td>
                    <span className="backup-tag active">{tpl.tipo_backup_relacionado || 'Geral'}</span>
                  </td>
                  <td>
                    {tpl.status === 'ativo' ? (
                      <span className="badge badge-ativo">Ativo</span>
                    ) : (
                      <span className="badge badge-inativo">Inativo</span>
                    )}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {tpl.updated_at ? new Date(tpl.updated_at).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/templates/${tpl.id}`);
                        }}
                      >
                        <Edit3 size={12} />
                        <span>Editar</span>
                      </button>
                      <button
                        className="btn btn-secondary btn-icon btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(tpl.id, tpl.nome);
                        }}
                        title="Excluir"
                      >
                        <Trash2 size={13} color="#EF4444" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Novo Template */}
      <Modal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Criar Novo Template de E-mail"
        maxWidth="560px"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsNewModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleCreateTemplate}>
              Criar e Abrir Editor
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateTemplate}>
          <div className="form-group">
            <label className="form-label">Nome Amigável do Template *</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex: Backup Semanal — Solicitação de Disco"
              value={newTemplate.nome}
              onChange={(e) => setNewTemplate({ ...newTemplate, nome: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Chave Única (Identificador) *</label>
              <input
                type="text"
                className="form-control"
                placeholder="DISCO_SEMANAL_AVISO"
                value={newTemplate.chave}
                onChange={(e) => setNewTemplate({ ...newTemplate, chave: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select
                className="form-control"
                value={newTemplate.categoria}
                onChange={(e) => setNewTemplate({ ...newTemplate, categoria: e.target.value })}
              >
                <option value="cobranca">Solicitação / Troca de Disco</option>
                <option value="info">Início de Rotina</option>
                <option value="falha">Alerta de Falha</option>
                <option value="sucesso">Finalização</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Backup Relacionado</label>
              <select
                className="form-control"
                value={newTemplate.tipo_backup_relacionado}
                onChange={(e) => setNewTemplate({ ...newTemplate, tipo_backup_relacionado: e.target.value })}
              >
                <option value="diario">Diário</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
                <option value="cloud">Cloud</option>
                <option value="geral">Geral / Todos</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Estilo Visual</label>
              <select
                className="form-control"
                value={newTemplate.estilo}
                onChange={(e) => setNewTemplate({ ...newTemplate, estilo: e.target.value })}
              >
                <option value="marca">Marca (Verde/Azul Core TI)</option>
                <option value="alerta">Alerta (Vermelho/Laranja)</option>
                <option value="sucesso">Sucesso (Verde)</option>
                <option value="info">Informativo (Ciano)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Assunto Padrão</label>
            <input
              type="text"
              className="form-control"
              value={newTemplate.assunto}
              onChange={(e) => setNewTemplate({ ...newTemplate, assunto: e.target.value })}
              required
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
