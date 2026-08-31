import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Zap,
  Users,
  Search,
  CheckSquare,
  Square,
  RefreshCw,
  Mail,
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Eye,
  Check,
  X,
  Sparkles,
  Layers,
  Filter,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

export default function DisparoEmails() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [clientes, setClientes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Multi-Seleção de Rotinas de Backup
  // Array de strings: ['semanal', 'diario', 'mensal', 'cloud', 'anual']
  const [selectedBackupRoutines, setSelectedBackupRoutines] = useState(['semanal']);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('todas'); // 'todas' | 'solicitacao_disco' | 'inicio_rotina' | 'finalizacao' | 'falha'
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [busca, setBusca] = useState('');

  // Seleção de Empresas (IDs)
  const [selectedIds, setSelectedIds] = useState([]);

  // Modal de Execução / Progresso
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Modal Pré-visualização do Modelo
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [clientData, tplData] = await Promise.all([
        api.getClients(),
        api.getTemplates(),
      ]);
      setClientes(clientData);
      setTemplates(tplData);

      if (tplData.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(tplData[0].id);
      }
    } catch (err) {
      addToast(err.message || 'Erro ao carregar clientes e templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Contagem de clientes por tipo de backup
  const counts = useMemo(() => {
    const ativas = clientes.filter((c) => c.status === 'ativo');
    return {
      semanal: ativas.filter((c) => (c.tipos_backup || []).includes('semanal')).length,
      diario: ativas.filter((c) => (c.tipos_backup || []).includes('diario')).length,
      mensal: ativas.filter((c) => (c.tipos_backup || []).includes('mensal')).length,
      cloud: ativas.filter((c) => (c.tipos_backup || []).includes('cloud')).length,
      anual: ativas.filter((c) => (c.tipos_backup || []).includes('anual')).length,
      todos: ativas.length,
    };
  }, [clientes]);

  // Alterna rotina no multi-select de rotinas
  const toggleRoutine = (routineKey) => {
    if (routineKey === 'todos') {
      if (selectedBackupRoutines.length === 5) {
        setSelectedBackupRoutines(['semanal']); // fallback para semanal
      } else {
        setSelectedBackupRoutines(['semanal', 'diario', 'mensal', 'cloud', 'anual']);
      }
      return;
    }

    setSelectedBackupRoutines((prev) => {
      const exists = prev.includes(routineKey);
      if (exists) {
        // Não deixa lista vazia
        const filtered = prev.filter((k) => k !== routineKey);
        return filtered.length > 0 ? filtered : [routineKey];
      } else {
        return [...prev, routineKey];
      }
    });

    // Auto-seleciona template relacionado caso exista
    const matchingTpl = templates.find(
      (t) => t.tipo_backup_relacionado?.toLowerCase() === routineKey.toLowerCase()
    );
    if (matchingTpl) {
      setSelectedTemplateId(matchingTpl.id);
    }
  };

  // Templates filtrados pela categoria selecionada
  const templatesFiltrados = useMemo(() => {
    if (selectedCategoryFilter === 'todas') return templates;
    return templates.filter((t) => {
      const cat = (t.categoria || '').toLowerCase();
      return cat.includes(selectedCategoryFilter.toLowerCase()) || (t.tipo_email || '').toLowerCase().includes(selectedCategoryFilter.toLowerCase());
    });
  }, [templates, selectedCategoryFilter]);

  // Lista de empresas filtradas conforme as rotinas ativas selecionadas e busca
  const empresasFiltradas = useMemo(() => {
    return clientes.filter((c) => {
      if (c.status !== 'ativo') return false;

      // Filtro de Backup: cliente precisa ter pelo menos UMA das rotinas selecionadas
      const clientTypes = (c.tipos_backup || []).map((t) => t.toLowerCase());
      const hasAnySelectedRoutine = selectedBackupRoutines.some((r) =>
        clientTypes.includes(r.toLowerCase())
      );

      if (!hasAnySelectedRoutine && selectedBackupRoutines.length < 5) {
        return false;
      }

      // Busca textual
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const matchNome = c.nome?.toLowerCase().includes(q);
        const matchResp = c.responsavel_principal?.toLowerCase().includes(q);
        const matchEmail = c.email_principal?.toLowerCase().includes(q);
        if (!matchNome && !matchResp && !matchEmail) return false;
      }

      return true;
    });
  }, [clientes, selectedBackupRoutines, busca]);

  // Sincroniza a seleção padrão quando as rotinas ou clientes mudam
  useEffect(() => {
    setSelectedIds(empresasFiltradas.map((e) => e.id));
  }, [selectedBackupRoutines, clientes]);

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(empresasFiltradas.map((e) => e.id));
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const handleInvertSelection = () => {
    const allFilteredIds = empresasFiltradas.map((e) => e.id);
    setSelectedIds((prev) => allFilteredIds.filter((id) => !prev.includes(id)));
  };

  // Template atualmente selecionado
  const currentTemplate = useMemo(() => {
    return templates.find((t) => t.id === parseInt(selectedTemplateId, 10)) || null;
  }, [templates, selectedTemplateId]);

  // Disparo em Lote Imediato
  const handleExecuteBulkSend = async () => {
    if (selectedIds.length === 0) {
      addToast('Selecione ao menos um cliente para disparar o e-mail.', 'warning');
      return;
    }
    if (!selectedTemplateId) {
      addToast('Selecione um template de e-mail.', 'warning');
      return;
    }

    const tplName = currentTemplate?.nome || 'Template Selecionado';
    const rotinasStr = selectedBackupRoutines.map((r) => r.toUpperCase()).join(', ');

    const confirmMsg = `Confirmar o disparo imediato via SMTP para ${selectedIds.length} clientes selecionados?\n\n- Rotinas filtradas: ${rotinasStr}\n- Template: ${tplName}\n- Envio: 1 e-mail individual por empresa`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsSending(true);
      setSendResult(null);

      const primaryRoutine = selectedBackupRoutines[0] || 'semanal';
      const payload = {
        empresa_ids: selectedIds,
        tipo_backup: primaryRoutine.charAt(0).toUpperCase() + primaryRoutine.slice(1),
        tipo_email: currentTemplate?.categoria || 'solicitacao_disco',
        template_id: parseInt(selectedTemplateId, 10),
        enviar_agora: true,
      };

      const res = await api.createAgendamento(payload);
      setSendResult(res);

      if (res.total_sucesso > 0) {
        addToast(
          `Disparo concluído com sucesso! ${res.total_sucesso} e-mail(s) entregues via SMTP (${res.total_erros} erros).`,
          res.total_erros > 0 ? 'warning' : 'success'
        );
      } else {
        addToast('Falha no disparo de e-mails. Verifique as configurações SMTP.', 'error');
      }
    } catch (err) {
      addToast(err.message || 'Erro ao realizar disparo em lote', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const backupOptions = [
    { key: 'semanal', label: 'Semanal', icon: '⚡', count: counts.semanal },
    { key: 'diario', label: 'Diário', icon: '📅', count: counts.diario },
    { key: 'mensal', label: 'Mensal', icon: '📆', count: counts.mensal },
    { key: 'cloud', label: 'Cloud', icon: '☁️', count: counts.cloud },
    { key: 'anual', label: 'Anual', icon: '🗓️', count: counts.anual },
  ];

  const allSelected = selectedBackupRoutines.length === 5;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Send size={22} color="var(--brand-teal)" />
            <span>Disparo Direto de E-mails</span>
          </h1>
          <p className="page-subtitle">
            Selecione uma ou mais rotinas de backup, escolha o modelo e dispare instantaneamente para todos os clientes selecionados via SMTP.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleExecuteBulkSend}
          disabled={isSending || selectedIds.length === 0}
          style={{ padding: '12px 28px', fontSize: '14px', fontWeight: 700 }}
        >
          {isSending ? <RefreshCw className="spin" size={16} /> : <Zap size={16} />}
          <span>
            {isSending
              ? 'Disparando E-mails...'
              : `Disparar Agora (${selectedIds.length} Clientes)`}
          </span>
        </button>
      </div>

      {/* 1. SELEÇÃO DE ROTINAS DE BACKUP (MULTI-SELECT INTUITIVO) */}
      <div className="card-panel" style={{ marginBottom: '20px', padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
              1. Filtrar por Rotinas de Backup Contratadas (Multi-Seleção):
            </span>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Você pode selecionar uma ou várias rotinas simultaneamente para abranger múltiplos perfis de clientes.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={`btn btn-sm ${allSelected ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => toggleRoutine('todos')}
            >
              <Users size={14} />
              <span>Todos os Clientes ({counts.todos})</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {backupOptions.map((opt) => {
            const isSelected = selectedBackupRoutines.includes(opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggleRoutine(opt.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--brand-teal)' : '1px solid var(--border-card)',
                  background: isSelected ? 'rgba(0, 179, 155, 0.16)' : 'var(--bg-app)',
                  color: isSelected ? 'var(--brand-teal)' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 0 10px rgba(0, 179, 155, 0.2)' : 'none',
                }}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
                <span
                  style={{
                    background: isSelected ? 'var(--brand-teal)' : 'var(--bg-card)',
                    color: isSelected ? '#000' : 'var(--text-muted)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 800,
                  }}
                >
                  {opt.count}
                </span>
                {isSelected && <Check size={14} color="var(--brand-teal)" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. SELEÇÃO FLEXÍVEL DE TEMPLATE E CATEGORIA */}
      <div className="card-panel" style={{ marginBottom: '20px', padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
              2. Escolha o Modelo / Template do E-mail:
            </span>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Filtre por finalidade ou selecione diretamente na lista categorizada.
            </p>
          </div>

          {/* Filtro Rápido de Categoria */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { key: 'todas', label: 'Todos os Modelos' },
              { key: 'solicitacao', label: 'Troca de Disco' },
              { key: 'inicio', label: 'Início de Rotina' },
              { key: 'finalizacao', label: 'Conclusão' },
              { key: 'falha', label: 'Falha / Incidentes' },
            ].map((cat) => (
              <button
                key={cat.key}
                type="button"
                className={`btn btn-sm ${selectedCategoryFilter === cat.key ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '11.5px', padding: '4px 10px' }}
                onClick={() => setSelectedCategoryFilter(cat.key)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdown com Assunto & Preview */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', alignItems: 'center' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <select
              className="form-control"
              style={{ fontSize: '13.5px', padding: '10px 14px' }}
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              required
            >
              {templatesFiltrados.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  [{tpl.categoria?.toUpperCase() || 'GERAL'}] {tpl.nome}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => {
                if (currentTemplate) setPreviewTemplate(currentTemplate);
              }}
              disabled={!currentTemplate}
            >
              <Eye size={15} />
              <span>Pré-visualizar E-mail</span>
            </button>

            {currentTemplate && (
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => navigate(`/templates/${currentTemplate.id}`)}
                title="Editar este template no editor"
              >
                <FileCode2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Preview do Assunto */}
        {currentTemplate && (
          <div style={{ marginTop: '10px', fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <strong>Assunto do E-mail:</strong>
            <span style={{ color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>
              {currentTemplate.assunto || 'Não configurado'}
            </span>
          </div>
        )}
      </div>

      {/* 3. TOOLBAR DE SELEÇÃO E BUSCA */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'var(--bg-app)',
          border: '1px solid var(--border-subtle)',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {selectedIds.length} de {empresasFiltradas.length} empresas selecionadas
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>|</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleSelectAll}
          >
            Marcar Todas ({empresasFiltradas.length})
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleDeselectAll}
          >
            Desmarcar Todas
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleInvertSelection}
          >
            Inverter
          </button>
        </div>

        {/* Busca textual rápida */}
        <div className="search-input-wrapper" style={{ width: '320px' }}>
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Buscar por empresa ou e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {/* 4. TABELA DE EMPRESAS */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <RefreshCw className="spin" size={28} />
          <p style={{ marginTop: '12px' }}>Carregando empresas...</p>
        </div>
      ) : empresasFiltradas.length === 0 ? (
        <div className="card-panel" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <Users size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Nenhuma empresa encontrada com os filtros selecionados
          </h3>
          <p style={{ fontSize: '13px', marginBottom: '16px' }}>
            Experimente clicar em "Todos os Clientes" no topo.
          </p>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => toggleRoutine('todos')}
          >
            Ver Todos os Clientes ({counts.todos})
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="enterprise-table">
            <thead>
              <tr>
                <th style={{ width: '44px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.length === empresasFiltradas.length &&
                      empresasFiltradas.length > 0
                    }
                    onChange={(e) => (e.target.checked ? handleSelectAll() : handleDeselectAll())}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>Empresa</th>
                <th>Responsável</th>
                <th>E-mail Destinatário (To:)</th>
                <th>Cópias (BCC:)</th>
                <th>Rotinas de Backup Ativas</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {empresasFiltradas.map((c) => {
                const isSelected = selectedIds.includes(c.id);
                return (
                  <tr
                    key={c.id}
                    onClick={() => toggleSelectOne(c.id)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(0, 179, 155, 0.06)' : 'transparent',
                    }}
                  >
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(c.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {c.nome}
                    </td>
                    <td>{c.responsavel_principal || '—'}</td>
                    <td>
                      {c.email_principal ? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', color: '#38BDF8' }}>
                          {c.email_principal}
                        </span>
                      ) : (
                        <span style={{ color: '#F87171', fontSize: '12px' }}>⚠️ Sem e-mail cadastrado</span>
                      )}
                    </td>
                    <td>
                      {c.total_emails > 1 ? (
                        <span className="badge badge-processando" style={{ fontSize: '11px' }}>
                          +{c.total_emails - 1} em cópia
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>0</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {c.tipos_backup?.map((tb) => {
                          const isMatch = selectedBackupRoutines.includes(tb.toLowerCase());
                          return (
                            <span
                              key={tb}
                              className={`backup-tag ${isMatch ? 'active' : ''}`}
                              style={{ fontSize: '10.5px' }}
                            >
                              {tb}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/clientes/${c.id}`)}
                        title="Ver cadastro do cliente"
                      >
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL PRÉ-VISUALIZAÇÃO DO MODELO */}
      {previewTemplate && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewTemplate(null)}
          title={`Visualização: ${previewTemplate.nome}`}
          maxWidth="700px"
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const tId = previewTemplate.id;
                  setPreviewTemplate(null);
                  navigate(`/templates/${tId}`);
                }}
              >
                Abrir no Editor
              </button>
              <button className="btn btn-primary" onClick={() => setPreviewTemplate(null)}>
                Fechar
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: 'var(--bg-app)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
              <strong>Assunto:</strong> <span style={{ color: '#38BDF8' }}>{previewTemplate.assunto}</span>
            </div>
            <div
              style={{
                background: '#FFFFFF',
                color: '#1F2937',
                padding: '20px',
                borderRadius: '8px',
                minHeight: '260px',
                border: '1px solid #E5E7EB',
                fontFamily: 'Inter, sans-serif',
              }}
              dangerouslySetInnerHTML={{
                __html: previewTemplate.corpo_html
                  ?.replace(/\{\{empresa\}\}/g, 'EXEMPLO EMPRESA LTDA')
                  ?.replace(/\{\{responsavel\}\}/g, 'João da Silva')
                  ?.replace(/\{\{tipo_backup\}\}/g, selectedBackupRoutines[0]?.toUpperCase() || 'SEMANAL')
                  ?.replace(/\{\{data_limite\}\}/g, new Date().toLocaleDateString('pt-BR'))
                  ?.replace(/\{\{observacoes\}\}/g, 'Rotina programada de backup'),
              }}
            />
          </div>
        </Modal>
      )}

      {/* MODAL RESULTADO DO DISPARO */}
      {sendResult && (
        <Modal
          isOpen={true}
          onClose={() => setSendResult(null)}
          title="Relatório do Disparo de E-mails"
          maxWidth="560px"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => navigate('/emails')}>
                Ver Histórico de E-mails
              </button>
              <button className="btn btn-primary" onClick={() => setSendResult(null)}>
                Fechar
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center', padding: '10px 0' }}>
            <div style={{ display: 'inline-flex', alignSelf: 'center', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', padding: '16px', borderRadius: '50%' }}>
              <CheckCircle2 size={40} />
            </div>

            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Disparo em Massa Concluído</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                O servidor SMTP processou os envios para as empresas selecionadas.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', textAlign: 'left' }}>
              <div style={{ background: 'var(--bg-app)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sucessos de Entrega</span>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#10B981', marginTop: '2px' }}>
                  {sendResult.total_sucesso}
                </div>
              </div>

              <div style={{ background: 'var(--bg-app)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Falhas</span>
                <div style={{ fontSize: '22px', fontWeight: 800, color: sendResult.total_erros > 0 ? '#EF4444' : 'var(--text-secondary)', marginTop: '2px' }}>
                  {sendResult.total_erros}
                </div>
              </div>
            </div>

            {sendResult.detalhes_erros && sendResult.detalhes_erros.length > 0 && (
              <div style={{ textAlign: 'left', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '6px', fontSize: '12px', color: '#F87171' }}>
                <strong>Erros identificados:</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {sendResult.detalhes_erros.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
