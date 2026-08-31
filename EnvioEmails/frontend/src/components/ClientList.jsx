import { useState } from 'react';
import ClientForm from './ClientForm';

function ClientList({ clients, selectedIds, onToggleSelect, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);

  if (clients.length === 0) {
    return <p style={{ color: 'var(--text-muted)' }}>Nenhum cliente cadastrado no momento.</p>;
  }

  return (
    <div className="email-list">
      {clients.map((client) => (
        <div key={client.id} className="email-item">
          {editingId === client.id ? (
            <div style={{ flex: 1 }}>
              <ClientForm
                initialData={{ name: client.name, email: client.email }}
                onCancel={() => setEditingId(null)}
                onSubmit={async (data) => {
                  await onUpdate(client.id, data);
                  setEditingId(null);
                }}
              />
            </div>
          ) : (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(client.id)}
                  onChange={() => onToggleSelect(client.id)}
                />
                <div className="email-info">
                  <span className="email-subject">{client.name}</span>
                  <span className="email-recipient">{client.email}</span>
                </div>
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setEditingId(client.id)}>
                  Editar
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    if (window.confirm(`Excluir o cliente "${client.name}"?`)) {
                      onDelete(client.id);
                    }
                  }}
                >
                  Excluir
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default ClientList;
