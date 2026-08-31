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
  PlayCircle,
  AlertCircle,
  Disc,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

// Catálogo organizado de disparos com suas respectivas chaves de template e rotinas associadas
const DISPATCH_PRESETS = [
  {
    group: 'Solicitações de Troca de Disco',
    icon: Disc,
    color: '#00B39B',
    items: [
      { id: 'DISCO_SEMANAL', routine: 'semanal', label: 'Troca de Disco — Semanal', badge: 'Semanal' },
      { id: 'DISCO_DIARIO', routine: 'diario', label: 'Troca de Disco — Diário', badge: 'Diário' },
      { id: 'DISCO_MENSAL', routine: 'mensal', label: 'Troca de Disco — Mensal', badge: 'Mensal' },
      { id: 'DISCO_ANUAL', routine: 'anual', label: 'Troca de Disco — Anual', badge: 'Anual' },
    ],
  },
  {
    group: 'Início de Rotinas de Backup',
    icon: PlayCircle,
    color: '#38BDF8',
    items: [
      { id: 'INICIO_SEMANAL', routine: 'semanal', label: 'Início de Rotina — Semanal', badge: 'Semanal' },
      { id: 'INICIO_MENSAL', routine: 'mensal', label: 'Início de Rotina — Mensal', badge: 'Mensal' },
      { id: 'INICIO_ANUAL', routine: 'anual', label: 'Início de Rotina — Anual', badge: 'Anual' },
      { id: 'INICIO_DIARIO', routine: 'diario', label: 'Início de Rotina — Diário', badge: 'Diário' },
      { id: 'INICIO_CLOUD', routine: 'cloud', label: 'Início de Rotina — Cloud', badge: 'Cloud' },
    ],
  },
  {
    group: 'Conclusão de Rotinas',
    icon: CheckCircle2,
    color: '#10B981',
    items: [
      { id: 'FINALIZADO_SEMANAL', routine: 'semanal', label: 'Conclusão — Semanal', badge: 'Semanal' },
      { id: 'FINALIZADO_MENSAL', routine: 'mensal', label: 'Conclusão — Mensal', badge: 'Mensal' },
      { id: 'FINALIZADO_ANUAL', routine: 'anual', label: 'Conclusão — Anual', badge: 'Anual' },
      { id: 'FINALIZADO_DIARIO', routine: 'diario', label: 'Conclusão — Diário', badge: 'Diário' },
    ],
  },
  {
    group: 'Avisos de Falha de Backup',
    icon: AlertTriangle,
    color: '#EF4444',
    items: [
      { id: 'FALHA_SEMANAL', routine: 'semanal', label: 'Falha de Backup — Semanal', badge: 'Semanal' },
      { id: 'FALHA_MENSAL', routine: 'mensal', label: 'Falha de Backup — Mensal', badge: 'Mensal' },
      { id: 'FALHA_DIARIO', routine: 'diario', label: 'Falha de Backup — Diário', badge: 'Diário' },
      { id: 'FALHA_ANUAL', routine: 'anual', label: 'Falha de Backup — Anual', badge: 'Anual' },
    ],
  },
];

export default function DisparoEmails() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [clientes, setClientes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Ação de disparo atualmente selecionada
  const [selectedActionKey, setSelectedActionKey] = useState('DISCO_SEMANAL');
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
      addToast(err.message || 'Erro ao carregar clientes e templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Encontra a configuração da ação selecionada
  const currentAction = useMemo(() => {
    for (const group of DISPATCH_PRESETS) {
      const item = group.items.find((i) => i.id === selectedActionKey);
      if (item) return { ...item, groupName: group.group, groupColor: group.color };
    }
    return DISPATCH_PRESETS[0].items[0];
  }, [selectedActionKey]);

  // Encontra o template correspondente no banco de dados
  const currentTemplate = useMemo(() => {
    return (
      templates.find((t) => t.chave === selectedActionKey) ||
      templates.find((t) => t.tipo_backup_relacionado?.toLowerCase() === currentAction.routine.toLowerCase()) ||
      templates[0] ||
      null
    );
  }, [templates, selectedActionKey, currentAction]);

  // FILTRAGEM ESTRITA DE CLIENTES: Apenas clientes com a rotina da ação ATIVA no cadastro
  const empresasFiltradas = useMemo(() => {
    const targetRoutine = currentAction.routine.toLowerCase();
    return clientes.filter((c) => {
      if (c.status !== 'ativo') return false;

      // Verifica se o cliente possui essa rotina de backup ativa
      const bTypes = (c.tipos_backup || []).map((t) => t.toLowerCase());
      if (!bTypes.includes(targetRoutine)) {
        return false;
      }

      // Busca textual por nome, responsável ou email
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const matchNome = c.nome?.toLowerCase().includes(q);
        const matchResp = c.responsavel_principal?.toLowerCase().includes(q);
        const matchEmail = c.email_principal?.toLowerCase().includes(q);
        if (!matchNome && !matchResp && !matchEmail) return false;
      }

      return true;
    });
  }, [clientes, currentAction, busca]);

  // Ao mudar de ação, auto-seleciona todas as empresas que têm essa rotina
  useEffect(() => {
    setSelectedIds(empresasFiltradas.map((e) => e.id));
  }, [selectedActionKey, clientes]);

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

  // Disparo em Lote
  const handleExecuteBulkSend = async () => {
    if (selectedIds.length === 0) {
      addToast('Selecione ao menos um cliente para disparar o e-mail.', 'warning');
      return;
    }
    if (!currentTemplate) {
      addToast('Template de e-mail não encontrado.', 'warning');
      return;
    }

    const confirmMsg = `Confirma o disparo imediato via SMTP?\n\n- Ação: ${currentAction.label}\n- Rotina: Backup ${currentAction.routine.toUpperCase()}\n- Destinatários: ${selectedIds.length} clientes (1 e-mail individual por empresa)`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsSending(true);
      setSendResult(null);

      const payload = {
        empresa_ids: selectedIds,
        tipo_backup: currentAction.routine.charAt(0).toUpperCase() + currentAction.routine.slice(1),
        tipo_email: currentTemplate.categoria || 'solicitacao_disco',
        template_id: currentTemplate.id,
        enviar_agora: true,
      };

      const res = await api.createAgendamento(payload);
      setSendResult(res);

      if (res.total_sucesso > 0) {
        addToast(
          `Disparo concluído com sucesso! ${res.total_sucesso} e-mails entregues via SMTP (${res.total_erros} falhas).`,
          res.total_erros > 0 ? 'warning' : 'success'
        );
      } else {
        addToast('Falha no disparo. Verifique as configurações de SMTP.', 'error');
      }
    } catch (err) {
      addToast(err.message || 'Erro ao realizar disparo', 'error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header Principal */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Send size={22} color="var(--brand-teal)" />
            <span>Disparo Direto de E-mails</span>
          </h1>
          <p className="page-subtitle">
            Selecione o tipo de comunicado e envie instantaneamente via SMTP. O sistema filtra automaticamente apenas os clientes que possuem essa rotina ativa.
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

      {/* 1. SELEÇÃO DIRETA DO TIPO DE COMUNICADO (AGRUPADO E INTUITIVO) */}
      <div className="card-panel" style={{ marginBottom: '20px', padding: '20px' }}>
        <div style={{ marginBottom: '14px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            1. Selecione o E-mail que deseja disparar:
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', marginBottom: 0 }}>
            Clique na ação desejada. O sistema seleciona o modelo e filtra estritamente as empresas corretas.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {DISPATCH_PRESETS.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.group}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <GroupIcon size={14} color={group.color} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {group.group}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {group.items.map((item) => {
                    const isSelected = selectedActionKey === item.id;
                    const routineCount = clientes.filter(
                      (c) => c.status === 'ativo' && (c.tipos_backup || []).includes(item.routine)
                    ).length;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedActionKey(item.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '9px 14px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          border: isSelected ? `1.5px solid ${group.color}` : '1px solid var(--border-card)',
                          background: isSelected ? `${group.color}1F` : 'var(--bg-app)',
                          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? `0 0 10px ${group.color}33` : 'none',
                        }}
                      >
                        <span>{item.label}</span>
                        <span
                          style={{
                            background: isSelected ? group.color : 'var(--bg-card)',
                            color: isSelected ? '#000' : 'var(--text-muted)',
                            padding: '2px 7px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 800,
                          }}
                        >
                          {routineCount}
                        </span>
                        {isSelected && <Check size={14} color={group.color} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. CARD DO MODELO CARREGADO COM PRÉ-VISUALIZAÇÃO */}
      {currentTemplate && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            borderRadius: '8px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="badge badge-normal" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                Rotina: {currentAction.routine}
              </span>
              <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                {currentTemplate.nome}
              </strong>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              <strong>Assunto do E-mail:</strong>{' '}
              <span style={{ color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>
                {currentTemplate.assunto}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsPreviewOpen(true)}
            >
              <Eye size={14} />
              <span>Ver Modelo Renderizado</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-icon"
              onClick={() => navigate(`/templates/${currentTemplate.id}`)}
              title="Abrir no editor de HTML"
            >
              <FileCode2 size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 3. TOOLBAR DE SELEÇÃO E BUSCA DOS DESTINATÁRIOS */}
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
            {selectedIds.length} de {empresasFiltradas.length} empresas com Backup {currentAction.routine.toUpperCase()} selecionadas
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
            placeholder="Buscar empresa ou e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {/* 4. TABELA DE DESTINATÁRIOS ELEGÍVEIS */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <RefreshCw className="spin" size={28} />
          <p style={{ marginTop: '12px' }}>Carregando empresas...</p>
        </div>
      ) : empresasFiltradas.length === 0 ? (
        <div className="card-panel" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <Users size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Nenhuma empresa encontrada com rotina {currentAction.routine.toUpperCase()} ativa
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Selecione outro tipo de comunicado acima.
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
                <th>Rotina Exigida</th>
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
                        ✓ {currentAction.routine}
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
                  ?.replace(/\{\{tipo_backup\}\}/g, currentAction.routine.toUpperCase())
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
