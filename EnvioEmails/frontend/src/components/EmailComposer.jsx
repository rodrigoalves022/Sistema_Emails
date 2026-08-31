const CATEGORIA_LABEL = {
  cobranca: 'Cobrança',
  falha: 'Falha',
  info: 'Informativo',
  sucesso: 'Concluído',
};

function EmailComposer({ emailTypes, tipo, onChangeTipo, selectedCount, onEnviar, isSending }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tipo de E-mail</label>
        <select className="form-select" value={tipo} onChange={(e) => onChangeTipo(e.target.value)}>
          <option value="">Selecione...</option>
          {emailTypes.map((t) => (
            <option key={t.chave} value={t.chave}>
              [{CATEGORIA_LABEL[t.categoria] || t.categoria}] {t.titulo}
            </option>
          ))}
        </select>
      </div>

      <button
        className="btn-primary"
        onClick={onEnviar}
        disabled={isSending || !tipo || selectedCount === 0}
        style={{ opacity: isSending || !tipo || selectedCount === 0 ? 0.6 : 1 }}
      >
        {isSending ? 'Enviando...' : `Enviar para ${selectedCount} cliente(s)`}
      </button>
    </div>
  );
}

export default EmailComposer;
