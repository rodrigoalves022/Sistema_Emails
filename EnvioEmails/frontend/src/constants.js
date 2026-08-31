// Tipos de backup suportados pelo sistema (usados em Clientes.tipos_backup e Templates.aplicavel_a)
export const TIPOS_BACKUP = [
  { id: 'diario', label: 'Diário' },
  { id: 'semanal', label: 'Semanal' },
  { id: 'mensal', label: 'Mensal' },
  { id: 'anual', label: 'Anual' },
  { id: 'cloud', label: 'Cloud' },
];

// Uma classe de badge distinta por tipo de backup (mapeada sobre as 5 variações de badge já existentes no design system)
export const BADGE_CLASS_POR_TIPO_BACKUP = {
  diario: 'badge-info',
  semanal: 'badge-marca',
  mensal: 'badge-success',
  anual: 'badge-warning',
  cloud: 'badge-error',
};

export function labelTipoBackup(id) {
  return TIPOS_BACKUP.find((t) => t.id === id)?.label || id;
}

/**
 * Replica no frontend a regra de CCO automático já aplicada pelo backend ao disparar via
 * POST /api/emails/enviar. Usada apenas para exibir a prévia "Para/CCO" antes do envio.
 */
export function calcularDestinatarios(cliente, template) {
  const secundarios = (cliente?.emails_secundarios || []).filter(Boolean);
  const aplicavelA = template?.aplicavel_a || [];
  const dispararCCO =
    template?.categoria === 'info' &&
    !aplicavelA.includes('diario') &&
    aplicavelA.some((t) => ['semanal', 'mensal', 'anual'].includes(t));
  if (dispararCCO) {
    return { to: [cliente?.email].filter(Boolean), cco: secundarios };
  }
  return { to: [cliente?.email, ...secundarios].filter(Boolean), cco: [] };
}
