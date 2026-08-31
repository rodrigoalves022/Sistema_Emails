import React, { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import Modal from './Modal';
import { api } from '../api';
import { useToast } from './Toast';

export default function ImportExcelModal({ isOpen, onClose, onSuccess }) {
  const { addToast } = useToast();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [overwrite, setOverwrite] = useState(false);

  // Carrega preview da base padrão ou do arquivo selecionado
  const loadPreview = async (selectedFile = null) => {
    setLoading(true);
    try {
      const data = await api.previewImportExcel(selectedFile);
      setPreview(data);
    } catch (err) {
      addToast(err.message || 'Erro ao carregar pré-visualização da planilha.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFile(null);
      loadPreview(null);
    }
  }, [isOpen]);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
      loadPreview(f);
    }
  };

  const handleConfirmImport = async () => {
    setLoading(true);
    try {
      const res = await api.confirmImportExcel(file, overwrite);
      if (res.sucesso) {
        addToast(
          `Importação concluída! ${res.total_empresas} empresas e ${res.total_emails} e-mails processados.`,
          'success'
        );
        if (onSuccess) onSuccess();
        onClose();
      } else {
        addToast(res.mensagem || 'Falha na importação.', 'error');
      }
    } catch (err) {
      addToast(err.message || 'Erro ao processar importação.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Importação da Base de Clientes (Excel)"
      maxWidth="720px"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirmImport}
            disabled={loading || !preview || preview.total_empresas === 0}
          >
            {loading ? <RefreshCw className="spin" size={15} /> : <CheckCircle2 size={15} />}
            <span>Confirmar e Importar no Banco</span>
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Upload box */}
        <div
          style={{
            border: '2px dashed var(--border-card)',
            borderRadius: '8px',
            padding: '20px',
            textAlign: 'center',
            background: 'var(--bg-app)',
          }}
        >
          <FileSpreadsheet size={36} color="var(--brand-teal)" style={{ marginBottom: '8px' }} />
          <h4 style={{ fontSize: '14px', marginBottom: '4px' }}>
            {file ? file.name : 'Arquivo Padrão: cadastro_clientes.xlsx'}
          </h4>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Selecione uma nova planilha (.xlsx) ou utilize a base oficial do sistema.
          </p>

          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            <Upload size={14} />
            <span>Escolher Outro Arquivo</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {/* Resumo da Análise */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
            <RefreshCw className="spin" size={24} style={{ marginBottom: '8px' }} />
            <p>Analisando estrutura da planilha...</p>
          </div>
        ) : preview ? (
          <div>
            <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Resumo da Pré-visualização:
            </h4>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px',
                marginBottom: '16px',
              }}
            >
              <div className="card-panel" style={{ padding: '12px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Empresas</span>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {preview.total_empresas}
                </div>
              </div>
              <div className="card-panel" style={{ padding: '12px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Contatos</span>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#38BDF8' }}>
                  {preview.total_contatos}
                </div>
              </div>
              <div className="card-panel" style={{ padding: '12px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>E-mails</span>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--brand-teal)' }}>
                  {preview.total_emails}
                </div>
              </div>
              <div className="card-panel" style={{ padding: '12px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Duplicidades</span>
                <div style={{ fontSize: '20px', fontWeight: 700, color: preview.duplicidades > 0 ? '#F59E0B' : '#10B981' }}>
                  {preview.duplicidades}
                </div>
              </div>
            </div>

            {/* Amostra dos dados */}
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Responsável</th>
                    <th>E-mails Identificados</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.empresas?.slice(0, 15).map((emp, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{emp.nome}</td>
                      <td>{emp.responsavel_principal}</td>
                      <td>
                        <span className="badge badge-normal" style={{ fontSize: '11px' }}>
                          {emp.contatos_emails?.length || 0} e-mail(s)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Opções de Importação */}
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="overwrite_check"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
              />
              <label htmlFor="overwrite_check" style={{ fontSize: '12.5px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Substituir completamente a base existente (limpar empresas e recriar)
              </label>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
