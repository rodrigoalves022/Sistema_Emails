import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Send,
  Copy,
  Eye,
  RefreshCw,
  FileCode2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { EditorView } from '@codemirror/view';
import { api } from '../api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';

export default function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [template, setTemplate] = useState(null);
  const [variables, setVariables] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editor fields
  const [htmlContent, setHtmlContent] = useState('');
  const [assunto, setAssunto] = useState('');
  const [nome, setNome] = useState('');
  const [estilo, setEstilo] = useState('marca');

  // Preview Rendered HTML
  const [previewHtml, setPreviewHtml] = useState('');

  // Test Send Modal
  const [isTestSendOpen, setIsTestSendOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tplData, varsData, empData] = await Promise.all([
        api.getTemplate(id),
        api.getTemplateVariables(),
        api.getClients(),
      ]);

      setTemplate(tplData);
      setHtmlContent(tplData.html_content || '');
      setAssunto(tplData.assunto || '');
      setNome(tplData.nome || '');
      setEstilo(tplData.estilo || 'marca');
      setVariables(varsData);
      setEmpresas(empData);

      const initialEmpId = empData.length > 0 ? empData[0].id : undefined;
      if (initialEmpId) {
        setSelectedEmpresaId(initialEmpId);
      }

      // Initial instant preview
      try {
        const previewRes = await api.previewTemplate({
          template_id: parseInt(id, 10),
          html_content: tplData.html_content || '',
          assunto: tplData.assunto || '',
          estilo: tplData.estilo || 'marca',
          empresa_id: initialEmpId,
        });
        setPreviewHtml(previewRes.html);
      } catch (e) {
        // silent
      }
    } catch (err) {
      addToast(err.message || 'Erro ao carregar template', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Atualiza preview dinâmico ao alterar o HTML ou empresa selecionada
  useEffect(() => {
    if (!template) return;
    const updatePreview = async () => {
      try {
        const res = await api.previewTemplate({
          template_id: parseInt(id, 10),
          html_content: htmlContent,
          assunto: assunto,
          estilo: estilo,
          empresa_id: selectedEmpresaId ? parseInt(selectedEmpresaId, 10) : undefined,
        });
        setPreviewHtml(res.html);
      } catch (err) {
        // silent
      }
    };
    const timer = setTimeout(updatePreview, 250);
    return () => clearTimeout(timer);
  }, [htmlContent, assunto, estilo, selectedEmpresaId, template]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateTemplate(id, {
        ...template,
        nome,
        assunto,
        estilo,
        html_content: htmlContent,
      });
      addToast('Template salvo com sucesso!', 'success');
      fetchData();
    } catch (err) {
      addToast(err.message || 'Erro ao salvar template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyVariable = (varName) => {
    navigator.clipboard.writeText(varName);
    addToast(`Variável ${varName} copiada para a área de transferência!`, 'info');
  };

  const handleTestSend = async () => {
    if (!testEmail.trim()) {
      addToast('Informe um e-mail de destino.', 'warning');
      return;
    }

    setTestSending(true);
    try {
      await api.testSendTemplate({
        destinatario: testEmail.trim(),
        assunto: assunto,
        html_content: previewHtml || htmlContent,
        template_id: parseInt(id, 10),
      });
      addToast(`E-mail de teste disparado com sucesso para ${testEmail}!`, 'success');
      setIsTestSendOpen(false);
    } catch (err) {
      addToast(err.message || 'Erro ao disparar teste', 'error');
    } finally {
      setTestSending(false);
    }
  };

  if (loading && !template) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '60px' }}>
        <RefreshCw className="spin" size={32} />
        <p style={{ marginTop: '12px' }}>Carregando editor...</p>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '1800px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/templates')}>
          <ArrowLeft size={14} />
          <span>Voltar para Catálogo</span>
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setIsTestSendOpen(true)}>
            <Send size={14} />
            <span>Testar Envio via SMTP</span>
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <RefreshCw className="spin" size={14} /> : <Save size={14} />}
            <span>Salvar Template</span>
          </button>
        </div>
      </div>

      {/* Meta Properties Bar */}
      <div className="card-panel" style={{ marginBottom: '18px', padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: '16px', alignItems: 'center' }}>
          <div>
            <label className="form-label">Nome do Template</label>
            <input
              type="text"
              className="form-control"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Assunto Padrão (Suporta variáveis)</label>
            <input
              type="text"
              className="form-control"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Estilo do Cabeçalho</label>
            <select className="form-control" value={estilo} onChange={(e) => setEstilo(e.target.value)}>
              <option value="marca">Marca (Core TI)</option>
              <option value="alerta">Alerta (Falha)</option>
              <option value="sucesso">Sucesso</option>
              <option value="info">Informativo</option>
            </select>
          </div>
          <div>
            <label className="form-label">Simular Cliente</label>
            <select
              className="form-control"
              value={selectedEmpresaId}
              onChange={(e) => setSelectedEmpresaId(e.target.value)}
            >
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Split View Editor: Editor à Esquerda e Visualizador à Direita */}
      <div
        className="template-editor-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: '20px',
          alignItems: 'stretch',
          width: '100%',
        }}
      >
        {/* Painel Esquerdo: Código HTML + Variáveis */}
        <div className="card-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
          <div className="editor-pane-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileCode2 size={16} color="var(--brand-teal)" />
              <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Editor HTML</h3>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                navigator.clipboard.writeText(htmlContent);
                addToast('Código HTML copiado!', 'success');
              }}
            >
              <Copy size={12} />
              <span>Copiar Código</span>
            </button>
          </div>

          <div style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-card)' }}>
            <CodeMirror
              value={htmlContent}
              height="480px"
              extensions={[html(), EditorView.lineWrapping]}
              theme="dark"
              onChange={(val) => setHtmlContent(val)}
            />
          </div>

          {/* Barra de Variáveis Rápidas com 1-Click Copy */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Sparkles size={14} color="#38BDF8" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Variáveis Disponíveis (Clique para copiar):
              </span>
            </div>

            <div className="variable-pill-list">
              {variables.map((v) => (
                <div
                  key={v.variavel}
                  className="variable-pill"
                  onClick={() => handleCopyVariable(v.variavel)}
                  title={`${v.descricao} (Ex: ${v.exemplo})`}
                >
                  <span>{v.variavel}</span>
                  <Copy size={11} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Painel Direito: Visualizador de Template em Tempo Real */}
        <div className="card-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
          <div className="editor-pane-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={16} color="#38BDF8" />
              <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Visualização ao Vivo</h3>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Renderização idêntica ao e-mail final enviado
            </span>
          </div>

          <div
            className="preview-frame-container"
            style={{
              background: '#eef1f4',
              borderRadius: '8px',
              border: '1px solid var(--border-card)',
              flex: 1,
              minHeight: '540px',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            <iframe
              srcDoc={previewHtml}
              title="Visualização ao Vivo do E-mail"
              style={{
                width: '100%',
                height: '100%',
                minHeight: '540px',
                border: 'none',
                background: '#eef1f4',
              }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>

      {/* Modal Testar Envio */}
      <Modal
        isOpen={isTestSendOpen}
        onClose={() => setIsTestSendOpen(false)}
        title="Enviar E-mail de Teste via SMTP"
        maxWidth="480px"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsTestSendOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleTestSend} disabled={testSending}>
              {testSending ? <RefreshCw className="spin" size={14} /> : <Send size={14} />}
              <span>Disparar Teste</span>
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">E-mail Destinatário de Teste *</label>
          <input
            type="email"
            className="form-control"
            placeholder="seu-email@coretiexpert.com.br"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            required
          />
          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
            O template será enviado via servidor SMTP configurado com as variáveis substituídas pela empresa simulada.
          </p>
        </div>
      </Modal>
    </div>
  );
}
