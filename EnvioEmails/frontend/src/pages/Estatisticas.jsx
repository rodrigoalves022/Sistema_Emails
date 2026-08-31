import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  AlertTriangle,
  Disc,
  Mail,
  CheckCircle2,
  TrendingUp,
  HardDrive,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export default function Estatisticas() {
  const { addToast } = useToast();
  const [falhasEmpresa, setFalhasEmpresa] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [tipoBackupStats, setTipoBackupStats] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [feData, motData, tbData, resData] = await Promise.all([
        api.getFalhasPorEmpresa(),
        api.getEstatisticasMotivos(),
        api.getEstatisticasTipoBackup(),
        api.getResumoGeral(),
      ]);
      setFalhasEmpresa(feData);
      setMotivos(motData);
      setTipoBackupStats(tbData);
      setResumo(resData);
    } catch (err) {
      addToast(err.message || 'Erro ao carregar estatísticas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !resumo) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '60px' }}>
        <RefreshCw className="spin" size={32} />
        <p style={{ marginTop: '12px' }}>Carregando dados estatísticos...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <BarChart3 size={22} color="var(--brand-teal)" />
            <span>Estatísticas e Relatórios de Backup</span>
          </h1>
          <p className="page-subtitle">
            Análise de recorrência de falhas, métricas de não troca de disco e volume de comunicações
          </p>
        </div>

        <button className="btn btn-secondary" onClick={fetchStats}>
          <RefreshCw size={14} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Total de Falhas Registradas</span>
            <span className="stat-value" style={{ color: '#F87171' }}>
              {resumo?.total_falhas || 0}
            </span>
            <span style={{ fontSize: '11px', color: '#10B981', marginTop: '2px' }}>
              {resumo?.falhas_resolvidas || 0} resolvidas
            </span>
          </div>
          <div className="stat-icon-wrapper" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
            <AlertTriangle size={22} color="#EF4444" />
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}>
          <div className="stat-info">
            <span className="stat-label">Falhas por Não Troca de Disco</span>
            <span className="stat-value" style={{ color: '#FBBF24' }}>
              {resumo?.falhas_troca_disco || 0}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Maior causa de incidentes
            </span>
          </div>
          <div className="stat-icon-wrapper" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.1)' }}>
            <Disc size={22} color="#F59E0B" />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Total de E-mails Disparados</span>
            <span className="stat-value" style={{ color: 'var(--brand-teal)' }}>
              {resumo?.total_envios || 0}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Via SMTP dedicado
            </span>
          </div>
          <div className="stat-icon-wrapper" style={{ borderColor: 'rgba(0, 179, 155, 0.4)' }}>
            <Mail size={22} color="var(--brand-teal)" />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Taxa de Sucesso de Envio</span>
            <span className="stat-value" style={{ color: '#10B981' }}>
              {resumo?.taxa_sucesso || 100}%
            </span>
            <span style={{ fontSize: '11px', color: '#10B981', marginTop: '2px' }}>
              {resumo?.envios_sucesso || 0} entregas bem-sucedidas
            </span>
          </div>
          <div className="stat-icon-wrapper" style={{ borderColor: 'rgba(16, 185, 129, 0.4)' }}>
            <TrendingUp size={22} color="#10B981" />
          </div>
        </div>
      </div>

      {/* Grid: Motivos de Falha + Estatísticas por Tipo de Backup */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Motivos de Falha */}
        <div className="card-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Disc size={18} color="#F59E0B" />
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Distribuição dos Motivos de Falha</h3>
          </div>

          {motivos.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '16px 0' }}>
              Nenhuma ocorrência de falha registrada.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {motivos.map((m) => (
                <div
                  key={m.motivo}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--bg-app)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{m.motivo}</span>
                  <span className="badge badge-falha" style={{ fontSize: '12px' }}>
                    {m.total} ocorrência(s)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Por Tipo de Backup */}
        <div className="card-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <HardDrive size={18} color="var(--brand-teal)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Volume de Envios por Tipo de Backup</h3>
          </div>

          {tipoBackupStats.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '16px 0' }}>
              Nenhum envio registrado ainda.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tipoBackupStats.map((tb) => (
                <div
                  key={tb.tipo_backup}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--bg-app)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ fontSize: '13.5px', fontWeight: 600, textTransform: 'uppercase' }}>
                    {tb.tipo_backup}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span className="badge badge-normal" style={{ fontSize: '11px' }}>
                      {tb.total_sucesso} sucesso
                    </span>
                    {tb.total_erro > 0 && (
                      <span className="badge badge-falha" style={{ fontSize: '11px' }}>
                        {tb.total_erro} erro
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabela Ranking de Falhas por Empresa */}
      <div className="card-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} color="#EF4444" />
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>
              Ranking de Recorrência de Falhas por Empresa
            </h3>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Destaque para empresas com falhas frequentes de troca de disco
          </span>
        </div>

        {falhasEmpresa.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '16px 0' }}>
            Nenhum histórico de falhas registrado nas empresas da base.
          </p>
        ) : (
          <div className="table-wrapper">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Responsável</th>
                  <th>Falhas Totais</th>
                  <th>Não Troca de Disco</th>
                  <th>E-mails Enviados</th>
                  <th>Último Envio</th>
                  <th>Próximo Agendamento</th>
                </tr>
              </thead>
              <tbody>
                {falhasEmpresa.map((item) => (
                  <tr key={item.empresa_id}>
                    <td style={{ fontWeight: 700 }}>{item.empresa_nome}</td>
                    <td>{item.responsavel_principal || '—'}</td>
                    <td>
                      <span className="badge badge-falha" style={{ fontSize: '12px' }}>
                        {item.total_falhas} falha(s)
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${item.falhas_troca_disco > 0 ? 'badge-agendado' : 'badge-cancelado'}`}
                        style={{ fontSize: '12px' }}
                      >
                        {item.falhas_troca_disco} disco(s)
                      </span>
                    </td>
                    <td>{item.emails_enviados}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {item.ultimo_envio ? new Date(item.ultimo_envio).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td style={{ fontSize: '12px', color: item.proximo_agendamento ? '#FBBF24' : 'var(--text-muted)' }}>
                      {item.proximo_agendamento ? new Date(item.proximo_agendamento).toLocaleDateString('pt-BR') : '—'}
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
