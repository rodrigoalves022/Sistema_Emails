import { useState } from 'react';

function ClientForm({ onSubmit, initialData, onCancel }) {
  const [formData, setFormData] = useState(initialData || { name: '', email: '' });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit(formData);
    setFormData({ name: '', email: '' });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nome do Cliente</label>
        <input required type="text" name="name" value={formData.name} onChange={handleChange} className="form-input" placeholder="Ex: Empresa XYZ" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>E-mail</label>
        <input required type="email" name="email" value={formData.email} onChange={handleChange} className="form-input" placeholder="contato@xyz.com" />
      </div>
      <button type="submit" className="btn-primary" style={{ padding: '0.75rem 2rem' }}>
        {initialData ? 'Salvar' : 'Cadastrar'}
      </button>
      {onCancel && (
        <button type="button" className="btn-secondary" onClick={onCancel} style={{ padding: '0.75rem 1.5rem' }}>
          Cancelar
        </button>
      )}
    </form>
  );
}

export default ClientForm;
