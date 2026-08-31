const API_URL = `http://${window.location.hostname}:8000`;

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Erro na requisição (${response.status})`);
  }
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response;
}

export const api = {
  // Dashboard
  getDashboardStats: () => request('/api/dashboard/stats'),

  // Clientes / Empresas
  getClients: (busca, status, tipoBackup, emFalha) => {
    const params = new URLSearchParams();
    if (busca) params.append('busca', busca);
    if (status && status !== 'todos') params.append('status', status);
    if (tipoBackup && tipoBackup !== 'todos') params.append('tipo_backup', tipoBackup);
    if (emFalha !== undefined && emFalha !== null && emFalha !== '') params.append('em_falha', emFalha);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/clients${qs}`);
  },
  getClient: (id) => request(`/api/clients/${id}`),
  createClient: (data) =>
    request('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateClient: (id, data) =>
    request(`/api/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteClient: (id) => request(`/api/clients/${id}`, { method: 'DELETE' }),
  addClientEmail: (id, data) =>
    request(`/api/clients/${id}/emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateClientEmail: (id, emailId, data) =>
    request(`/api/clients/${id}/emails/${emailId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteClientEmail: (id, emailId) =>
    request(`/api/clients/${id}/emails/${emailId}`, {
      method: 'DELETE',
    }),
  setClientEmailPrincipal: (id, emailId) =>
    request(`/api/clients/${id}/emails/${emailId}/set-principal`, {
      method: 'POST',
    }),
  toggleFalha: (id, payload) =>
    request(`/api/clients/${id}/toggle-falha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  toggleBackupType: (id, tipo, ativo) =>
    request(`/api/clients/${id}/toggle-backup-type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, ativo }),
    }),
  previewImportExcel: (file = null) => {
    const formData = new FormData();
    if (file) formData.append('arquivo', file);
    return request('/api/clients/import/preview', { method: 'POST', body: formData });
  },
  confirmImportExcel: (file = null, overwrite = false) => {
    const formData = new FormData();
    if (file) formData.append('arquivo', file);
    formData.append('overwrite', overwrite);
    return request('/api/clients/import/confirm', { method: 'POST', body: formData });
  },

  // Falhas
  getFalhas: (status = 'em_falha') => request(`/api/falhas?status=${status}`),
  registerFalha: (data) =>
    request('/api/falhas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  resolveFalha: (id) => request(`/api/falhas/${id}/resolver`, { method: 'POST' }),
  dispararComunicadoFalha: (payload) =>
    request('/api/falhas/disparar-comunicado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  // Agendamentos
  getAgendamentos: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.empresa_id) qs.append('empresa_id', params.empresa_id);
    if (params.tipo_backup) qs.append('tipo_backup', params.tipo_backup);
    if (params.tipo_email) qs.append('tipo_email', params.tipo_email);
    if (params.status) qs.append('status', params.status);
    if (params.mes) qs.append('mes', params.mes);
    const queryString = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/api/agendamentos${queryString}`);
  },
  getAgendamento: (id) => request(`/api/agendamentos/${id}`),
  createAgendamento: (payload) =>
    request('/api/agendamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateAgendamento: (id, payload) =>
    request(`/api/agendamentos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  cancelAgendamento: (id) => request(`/api/agendamentos/${id}/cancelar`, { method: 'POST' }),
  deleteAgendamento: (id) => request(`/api/agendamentos/${id}`, { method: 'DELETE' }),
  executeAgendamentoNow: (id) => request(`/api/agendamentos/${id}/executar`, { method: 'POST' }),
  retryAgendamento: (id) => request(`/api/agendamentos/${id}/reintentar`, { method: 'POST' }),

  // Templates
  getTemplates: () => request('/api/templates'),
  getTemplate: (id) => request(`/api/templates/${id}`),
  getTemplateVariables: () => request('/api/templates/variaveis'),
  createTemplate: (data) =>
    request('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateTemplate: (id, data) =>
    request(`/api/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteTemplate: (id) => request(`/api/templates/${id}`, { method: 'DELETE' }),
  previewTemplate: (payload) =>
    request('/api/templates/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  testSendTemplate: (payload) =>
    request('/api/templates/test-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  // E-mails Enviados / Histórico
  getHistorico: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.busca) qs.append('busca', params.busca);
    if (params.status) qs.append('status', params.status);
    if (params.tipo_backup) qs.append('tipo_backup', params.tipo_backup);
    if (params.data_inicio) qs.append('data_inicio', params.data_inicio);
    if (params.data_fim) qs.append('data_fim', params.data_fim);
    if (params.limit) qs.append('limit', params.limit);
    const queryString = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/api/emails/historico${queryString}`);
  },
  getHistoricoItem: (id) => request(`/api/emails/historico/${id}`),
  reenviarEmail: (id) => request(`/api/emails/reenviar/${id}`, { method: 'POST' }),
  deleteHistoricoItem: (id) => request(`/api/emails/historico/${id}`, { method: 'DELETE' }),
  clearHistorico: () => request('/api/emails/historico', { method: 'DELETE' }),

  // Estatísticas
  getFalhasPorEmpresa: () => request('/api/estatisticas/falhas-por-empresa'),
  getEstatisticasMotivos: () => request('/api/estatisticas/motivos'),
  getEstatisticasTipoBackup: () => request('/api/estatisticas/por-tipo-backup'),
  getResumoGeral: () => request('/api/estatisticas/resumo-geral'),

  // Configurações
  getSettings: () => request('/api/settings'),
  saveSettings: (data) =>
    request('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  testSmtpConnection: () => request('/api/settings/test-connection', { method: 'POST' }),
  testSmtpSend: (destinatarioTeste = null) =>
    request('/api/settings/test-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinatario_teste: destinatarioTeste }),
    }),

  // Auditoria
  getAuditoria: (entidade = null, limit = 100) => {
    const qs = new URLSearchParams();
    if (entidade) qs.append('entidade', entidade);
    if (limit) qs.append('limit', limit);
    return request(`/api/auditoria?${qs.toString()}`);
  },
};
