import React, { useState, useEffect } from 'react';
import {
  Settings,
  Server,
  Shield,
  Send,
  CheckCircle2,
  AlertTriangle,
  History,
  RefreshCw,
  Lock,
  Save,
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

export default function Configuracoes() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('smtp'); // 'smtp' | 'auditoria'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // SMTP Settings
  const [settings, setSettings] = useState({
    smtp_host: '',
    smtp_port: 465,
    smtp_use_ssl: true,
    smtp_user: '',
    smtp_password: '',
    smtp_from_email: 'clientes.backup@coretiexpert.com.br',
    smtp_from_name: 'Core TI Expert - Departamento de Backup',
    signature_company: 'Core TI Expert',
    signature_dept: 'Departamento de Backup',
    signature_phone: '(62) 3242-5830',
    signature_email: 'clientes.backup@coretiexpert.com.br',
  });

  // Modal Teste Envio
  const [isTestSendOpen, setIsTestSendOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Auditoria
  const [auditoriaLogs, setAuditoriaLogs] = useState([]);
  const [auditoriaLoading, setAuditoriaLoading] = useState(false);
  const [filtroEntidade, setFiltroEntidade] = useState('todas');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getSettings();
      setSettings(data);
      if (!testRecipient && data.smtp_from_email) {
        setTestRecipient(data.smtp_from_email);
      }
    } catch (err) {
      addToast(err.message || 'Erro ao carregar configurações', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditoria = async () => {
    try {
      setAuditoriaLoading(true);
      const data = await api.getAuditoria(filtroEntidade);
      setAuditoriaLogs(data);
    } catch (err) {
      addToast(err.message || 'Erro ao carregar logs de auditoria', 'error');
    } finally {
      setAuditoriaLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'auditoria') {
      fetchAuditoria();
    }
  }, [activeTab, filtroEntidade]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveSettings(settings);
      addToast('Configurações salvas com sucesso!', 'success');
      fetchSettings();
    } catch (err) {
      addToast(err.message || 'Erro ao salvar configurações', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await api.testSmtpConnection();
      addToast(res.mensagem || 'Conexão e autenticação SMTP validadas com sucesso!', 'success');
    } catch (err) {
      addToast(err.message || 'Falha ao conectar ao servidor SMTP', 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testRecipient.trim()) {
      addToast('Informe um e-mail de destino.', 'warning');
      return;
    }

    setSendingTest(true);
    try {
      await api.testSmtpSend(testRecipient.trim());
      addToast(`E-mail de teste enviado com sucesso para ${testRecipient}!`, 'success');
      setIsTestSendOpen(false);
    } catch (err) {
      addToast(err.message || 'Erro no envio do e-mail de teste', 'error');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Settings size={22} color="var(--brand-teal)" />
            <span>Configurações do Sistema e Auditoria</span>
          </h1>
          <p className="page-subtitle">
            Gerenciamento de credenciais do servidor SMTP, assinatura padrão e histórico de auditoria
          </p>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-card)' }}>
          <button
            className={`btn btn-sm ${activeTab === 'smtp' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
            onClick={() => setActiveTab('smtp')}
          >
            <Server size={14} />
            <span>Servidor SMTP</span>
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'auditoria' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none' }}
            onClick={() => setActiveTab('auditoria')}
          >
            <History size={14} />
            <span>Logs de Auditoria</span>
          </button>
        </div>
      </div>

      {activeTab === 'smtp' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          {/* Formulário Principal */}
          <div className="card-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <Server size={18} color="var(--brand-teal)" />
              <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Parâmetros de Conexão SMTP</h3>
            </div>

            <form onSubmit={handleSaveSettings}>
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Servidor SMTP (Host) *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="smtp.coretiexpert.com.br"
                    value={settings.smtp_host}
                    onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Porta *</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="465"
                    value={settings.smtp_port}
                    onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value, 10) || 465 })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Segurança</label>
                  <select
                    className="form-control"
                    value={settings.smtp_use_ssl ? 'ssl' : 'tls'}
                    onChange={(e) => setSettings({ ...settings, smtp_use_ssl: e.target.value === 'ssl' })}
                  >
                    <option value="ssl">SSL / TLS</option>
                    <option value="tls">STARTTLS</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Usuário de Autenticação SMTP *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="clientes.backup@coretiexpert.com.br"
                    value={settings.smtp_user}
                    onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Senha SMTP *</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="••••••••••••"
                    value={settings.smtp_password}
                    onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">E-mail Remetente Padrão *</label>
                  <input
                    type="email"
                    className="form-control"
                    value={settings.smtp_from_email}
                    onChange={(e) => setSettings({ ...settings, smtp_from_email: e.target.value })}
                    required
                  />
                  <p style={{ fontSize: '11px', color: 'var(--brand-teal)', marginTop: '4px' }}>
                    Remetente oficial das rotinas de backup
                  </p>
                </div>
                <div className="form-group">
                  <label className="form-label">Nome de Exibição do Remetente</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.smtp_from_name}
                    onChange={(e) => setSettings({ ...settings, smtp_from_name: e.target.value })}
                  />
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '20px 0' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Shield size={18} color="var(--brand-teal)" />
                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Informações da Assinatura Corporativa</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Empresa</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.signature_company}
                    onChange={(e) => setSettings({ ...settings, signature_company: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Departamento</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.signature_dept}
                    onChange={(e) => setSettings({ ...settings, signature_dept: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Telefone de Suporte</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.signature_phone}
                    onChange={(e) => setSettings({ ...settings, signature_phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">E-mail de Contato da Assinatura</label>
                  <input
                    type="email"
                    className="form-control"
                    value={settings.signature_email}
                    onChange={(e) => setSettings({ ...settings, signature_email: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? <RefreshCw className="spin" size={14} /> : <Save size={14} />}
                  <span>Salvar Configurações</span>
                </button>
              </div>
            </form>
          </div>

          {/* Painel Lateral: Testes e Diagnóstico */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div className="card-panel">
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>
                Diagnóstico do Servidor SMTP
              </h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Verifique se os dados de host, porta e credenciais foram autenticados com sucesso pelo servidor de e-mail.
              </p>

              <button
                className="btn btn-secondary"
                style={{ width: '100%', marginBottom: '10px' }}
                onClick={handleTestConnection}
                disabled={testingConnection}
              >
                {testingConnection ? <RefreshCw className="spin" size={14} /> : <Server size={14} />}
                <span>Testar Conexão SMTP</span>
              </button>

              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => setIsTestSendOpen(true)}
              >
                <Send size={14} />
                <span>Enviar E-mail de Teste</span>
              </button>
            </div>

            <div className="card-panel" style={{ background: 'var(--bg-app)' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand-teal)', marginBottom: '8px' }}>
                Regras Estritas de Envio
              </h4>
              <ul style={{ fontSize: '12px', color: 'var(--text-secondary)', paddingLeft: '16px', lineHeight: '1.6' }}>
                <li>Envio exclusivo via protocolo SMTP direto do backend.</li>
                <li>Sem integração Outlook / Graph API.</li>
                <li>E-mails de clientes secundários sempre em BCC seguro.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'auditoria' && (
        <div className="card-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={18} color="var(--brand-teal)" />
              <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Trilha de Auditoria do Sistema</h3>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                className="form-control"
                style={{ width: '180px' }}
                value={filtroEntidade}
                onChange={(e) => setFiltroEntidade(e.target.value)}
              >
                <option value="todas">Todas as Ações</option>
                <option value="EMPRESAS">Empresas</option>
                <option value="AGENDAMENTOS">Agendamentos</option>
                <option value="FALHAS">Falhas</option>
                <option value="TEMPLATES">Templates</option>
                <option value="EMAILS">E-mails</option>
                <option value="CONFIGURACOES">Configurações</option>
                <option value="IMPORTACAO">Importação</option>
              </select>

              <button className="btn btn-secondary btn-icon" onClick={fetchAuditoria} title="Recarregar">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {auditoriaLoading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              <RefreshCw className="spin" size={28} />
              <p style={{ marginTop: '12px' }}>Carregando registros de auditoria...</p>
            </div>
          ) : auditoriaLogs.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
              Nenhum log registrado para este filtro.
            </p>
          ) : (
            <div className="table-wrapper">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Data / Hora</th>
                    <th>Entidade</th>
                    <th>Ação Executada</th>
                    <th>Detalhes da Operação</th>
                    <th>Operador</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoriaLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                        {new Date(log.data_hora).toLocaleString('pt-BR')}
                      </td>
                      <td>
                        <span className="badge badge-normal" style={{ fontSize: '11px' }}>
                          {log.entidade}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{log.acao}</td>
                      <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                        {log.detalhes}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {log.usuario || 'sistema'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal E-mail de Teste */}
      <Modal
        isOpen={isTestSendOpen}
        onClose={() => setIsTestSendOpen(false)}
        title="Enviar E-mail de Teste SMTP"
        maxWidth="480px"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsTestSendOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSendTestEmail} disabled={sendingTest}>
              {sendingTest ? <RefreshCw className="spin" size={14} /> : <Send size={14} />}
              <span>Disparar E-mail</span>
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Endereço de Destino *</label>
          <input
            type="email"
            className="form-control"
            placeholder="destinatario@coretiexpert.com.br"
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            required
          />
          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Uma mensagem de validação de entrega será enviada via SMTP para este endereço.
          </p>
        </div>
      </Modal>
    </div>
  );
}
