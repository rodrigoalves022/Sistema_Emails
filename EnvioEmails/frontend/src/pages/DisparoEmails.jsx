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
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

// Mapeamento direto de (Rotina + Finalidade) para a Chave de Template
const TEMPLATE_MAP = {
  // Troca de Disco / Solicitação
  'semanal_troca': 'DISCO_SEMANAL',
  'diario_troca': 'DISCO_DIARIO',
  'mensal_troca': 'DISCO_MENSAL',
  'anual_troca': 'DISCO_ANUAL',
  'cloud_troca': 'INICIO_CLOUD',

  // Início de Rotina
  'semanal_inicio': 'INICIO_SEMANAL',
  'diario_inicio': 'INICIO_DIARIO',
  'mensal_inicio': 'INICIO_MENSAL',
  'anual_inicio': 'INICIO_ANUAL',
  'cloud_inicio': 'INICIO_CLOUD',

  // Conclusão / Finalização
  'semanal_conclusao': 'FINALIZADO_SEMANAL',
  'diario_conclusao': 'FINALIZADO_DIARIO',
  'mensal_conclusao': 'FINALIZADO_MENSAL',
  'anual_conclusao': 'FINALIZADO_ANUAL',
  'cloud_conclusao': 'INICIO_CLOUD',

  // Avisos de Falha
  'semanal_falha': 'FALHA_SEMANAL',
  'diario_falha': 'FALHA_DIARIO',
  'mensal_falha': 'FALHA_MENSAL',
  'anual_falha': 'FALHA_ANUAL',
  'cloud_falha': 'FALHA_DIARIO',
};

const ROTINAS = [
  { id: 'semanal', label: 'Semanal', icon: '⚡' },
  { id: 'diario', label: 'Diário', icon: '📅' },
  { id: 'mensal', label: 'Mensal', icon: '📆' },
  { id: 'anual', label: 'Anual', icon: '🗓️' },
  { id: 'cloud', label: 'Cloud', icon: '☁️' },
];

const FINALIDADES = [
  { id: 'troca', label: 'Troca de Disco' },
  { id: 'inicio', label: 'Início de Rotina' },
  { id: 'conclusao', label: 'Conclusão' },
  { id: 'falha', label: 'Aviso de Falha' },
];

export default function DisparoEmails() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [clientes, setClientes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros Compactos: 1. Rotina de Backup + 2. Finalidade da Mensagem
  const [selectedRoutine, setSelectedRoutine] = useState('semanal');
  const [selectedFinalidade, setSelectedFinalidade] = useState('troca');
  const [busca, setBusca] = useState('');

  // Seleção de Empresas (IDs)
  const [selectedIds, setSelectedIds] = useState([]);

  // Modal de Execução / Progresso
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Modal Pré-visualização do Modelo
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [clientData, tplData] = await Promise.all([
        api.getClients(),
        api.getTemplates(),
      ]);
      setClientes(clientData);
      setTemplates(tplData);
    } catch (err) {
      addToast(err.message || 'Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Determina a chave do template atual a partir da combinação (Rotina + Finalidade)
  const currentTemplateKey = useMemo(() => {
    const key = `${selectedRoutine}_${selectedFinalidade}`;
    return TEMPLATE_MAP[key] || 'DISCO_SEMANAL';
  }, [selectedRoutine, selectedFinalidade]);

  // Carrega o objeto do template correspondente do banco
  const currentTemplate = useMemo(() => {
    return (
      templates.find((t) => t.chave === currentTemplateKey) ||
      templates.find((t) => t.tipo_backup_relacionado?.toLowerCase() === selectedRoutine) ||
      templates[0] ||
      null
    );
  }, [templates, currentTemplateKey, selectedRoutine]);

  // FILTRO ESTRITO DE CLIENTES: Apenas clientes com a rotina selecionada ATIVA
  const empresasFiltradas = useMemo(() => {
    return clientes.filter((c) => {
      if (c.status !== 'ativo') return false;

      // Verifica se o cliente tem essa rotina contratada
      const bTypes = (c.tipos_backup || []).map((t) => t.toLowerCase());
      if (!bTypes.includes(selectedRoutine)) {
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
  }, [clientes, selectedRoutine, busca]);

  // Auto-seleciona todas as empresas filtradas quando a rotina muda
  useEffect(() => {
    setSelectedIds(empresasFiltradas.map((e) => e.id));
  }, [selectedRoutine, clientes]);

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

  // Disparo em Lote Imediato
  const handleExecuteBulkSend = async () => {
    if (selectedIds.length === 0) {
      addToast('Selecione ao menos um cliente para disparar o e-mail.', 'warning');
      return;
    }
    if (!currentTemplate) {
      addToast('Template de e-mail não encontrado.', 'warning');
      return;
    }

    const rotinaNome = selectedRoutine.toUpperCase();
    const finalidadeNome = FINALIDADES.find((f) => f.id === selectedFinalidade)?.label || '';

    const confirmMsg = `Disparar agora via SMTP para ${selectedIds.length} clientes?\n\n- Rotina: Backup ${rotinaNome}\n- Tipo: ${finalidadeNome}\n- Modelo: ${currentTemplate.nome}\n- Envio: 1 e-mail individual por empresa`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsSending(true);
      setSendResult(null);

      const payload = {
        empresa_ids: selectedIds,
        tipo_backup: selectedRoutine.charAt(0).toUpperCase() + selectedRoutine.slice(1),
        tipo_email: currentTemplate.categoria || 'solicitacao_disco',
        template_id: currentTemplate.id,
        enviar_agora: true,
      };

      const res = await api.createAgendamento(payload);
      setSendResult(res);

      if (res.total_sucesso > 0) {
        addToast(
          `Disparo concluído! ${res.total_sucesso} e-mail(s) entregues via SMTP (${res.total_erros} erros).`,
          res.total_erros > 0 ? 'warning' : 'success'
        );
      } else {
        addToast('Falha no disparo. Verifique as configurações de SMTP.', 'error');
      }
    } catch (err) {
      addToast(err.message || 'Erro ao processar disparo', 'error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div>
          <h1 className="page-title">
            <Send size={22} color="var(--brand-teal)" />
            <span>Disparo Direto de E-mails</span>
          </h1>
          <p className="page-subtitle">
            Selecione a rotina e o tipo de mensagem para envio imediato via SMTP aos clientes com rotina ativa.
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

      {/* FILTROS COMPACTOS: ROTINA + TIPO DE MENSAGEM */}
      <div
        className="card-panel"
        style={{
          marginBottom: '16px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {/* Linha 1: Rotina de Backup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', minWidth: '130px' }}>
            Rotina de Backup:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {ROTINAS.map((r) => {
              const isActive = selectedRoutine === r.id;
              const count = clientes.filter(
                (c) => c.status === 'ativo' && (c.tipos_backup || []).includes(r.id)
              ).length;

              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRoutine(r.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    border: isActive ? '1px solid var(--brand-teal)' : '1px solid var(--border-card)',
                    background: isActive ? 'rgba(0, 179, 155, 0.15)' : 'var(--bg-app)',
                    color: isActive ? 'var(--brand-teal)' : 'var(--text-primary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{r.icon}</span>
                  <span>{r.label}</span>
                  <span
                    style={{
                      background: isActive ? 'var(--brand-teal)' : 'var(--bg-card)',
                      color: isActive ? '#000' : 'var(--text-muted)',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 800,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Linha 2: Tipo de Mensagem / Finalidade */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', minWidth: '130px' }}>
            Tipo de Mensagem:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {FINALIDADES.map((f) => {
              const isActive = selectedFinalidade === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFinalidade(f.id)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    border: isActive ? '1px solid #38BDF8' : '1px solid var(--border-card)',
                    background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-app)',
                    color: isActive ? '#38BDF8' : 'var(--text-primary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Linha 3: Resumo Compacto do Template & Assunto */}
        {currentTemplate && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '8px 14px',
              fontSize: '12.5px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="badge badge-normal" style={{ fontSize: '10.5px', textTransform: 'uppercase' }}>
                {selectedRoutine}
              </span>
              <strong style={{ color: 'var(--text-primary)' }}>{currentTemplate.nome}</strong>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>
                {currentTemplate.assunto?.replace(/\{\{empresa\}\}/g, 'NOME DA EMPRESA')}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '11.5px', padding: '3px 10px' }}
              onClick={() => setIsPreviewOpen(true)}
            >
              <Eye size={13} />
              <span>Ver Modelo</span>
            </button>
          </div>
        )}
      </div>

      {/* TOOLBAR DE SELEÇÃO E BUSCA */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'var(--bg-app)',
          border: '1px solid var(--border-subtle)',
          padding: '10px 16px',
          borderRadius: '8px',
          marginBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {selectedIds.length} de {empresasFiltradas.length} empresas com Backup {selectedRoutine.toUpperCase()} selecionadas
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
        <div className="search-input-wrapper" style={{ width: '300px' }}>
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Buscar empresa ou e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {/* TABELA DE DESTINATÁRIOS */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <RefreshCw className="spin" size={28} />
          <p style={{ marginTop: '12px' }}>Carregando empresas...</p>
        </div>
      ) : empresasFiltradas.length === 0 ? (
        <div className="card-panel" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <Users size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Nenhuma empresa encontrada com rotina {selectedRoutine.toUpperCase()} ativa
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Selecione outra rotina de backup no topo.
          </p>
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
                <th>Destinatário Principal (To:)</th>
                <th>Cópias (BCC:)</th>
                <th>Rotina Ativa</th>
                <th style={{ textAlign: 'right' }}>Cadastro</th>
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
                        <span style={{ color: '#F87171', fontSize: '12px' }}>⚠️ Sem e-mail</span>
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
                      <span className="backup-tag active" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                        ✓ {selectedRoutine}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/clientes/${c.id}`)}
                        title="Ver detalhes da empresa"
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
      {isPreviewOpen && currentTemplate && (
        <Modal
          isOpen={true}
          onClose={() => setIsPreviewOpen(false)}
          title={`Visualização: ${currentTemplate.nome}`}
          maxWidth="700px"
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const tId = currentTemplate.id;
                  setIsPreviewOpen(false);
                  navigate(`/templates/${tId}`);
                }}
              >
                Abrir no Editor
              </button>
              <button className="btn btn-primary" onClick={() => setIsPreviewOpen(false)}>
                Fechar
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: 'var(--bg-app)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
              <strong>Assunto:</strong> <span style={{ color: '#38BDF8' }}>{currentTemplate.assunto?.replace(/\{\{empresa\}\}/g, 'EXEMPLO EMPRESA LTDA')}</span>
            </div>
            <div
              style={{
                background: '#FFFFFF',
                color: '#1F2937',
                padding: '24px',
                borderRadius: '8px',
                minHeight: '260px',
                border: '1px solid #E5E7EB',
                fontFamily: 'Inter, sans-serif',
              }}
              dangerouslySetInnerHTML={{
                __html: currentTemplate.corpo_html
                  ?.replace(/\{\{empresa\}\}/g, 'EXEMPLO EMPRESA LTDA')
                  ?.replace(/\{\{responsavel\}\}/g, 'João da Silva')
                  ?.replace(/\{\{tipo_backup\}\}/g, selectedRoutine.toUpperCase())
                  ?.replace(/\{\{data_limite\}\}/g, new Date().toLocaleDateString('pt-BR'))
                  ?.replace(/\{\{observacoes\}\}/g, 'Rotina operacional agendada'),
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
