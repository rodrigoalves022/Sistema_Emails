"""Vocabulário canônico de tipos de backup usado em toda a API.

Os slugs minúsculos abaixo são a fonte única de verdade gravada em
`tipos_backup.tipo`, `agendamentos.tipo_backup`, `falhas.tipo_backup` e
`emails_enviados.tipo_backup`, para que filtros cruzados entre essas
tabelas funcionem de forma consistente.
"""

TIPOS_BACKUP_VALIDOS = {"diario", "semanal", "mensal", "anual", "cloud"}

# Tipos de backup para os quais a cópia automática (Cc visível) de "início de
# rotina" se aplica. Nome da constante mantido por compatibilidade histórica
# (regra de negócio ainda referida como "CCO automático" no plano/spec original),
# mas o mecanismo de envio hoje usa Cc visível, não BCC oculto — ver
# services/smtp_service.py::send_smtp_email.
TIPOS_BACKUP_CCO_AUTOMATICO = {"semanal", "mensal", "anual"}


def normalizar_tipo_backup(valor: str | None) -> str:
    """Normaliza um valor de tipo de backup para o slug minúsculo canônico.

    Não rejeita valores fora do vocabulário conhecido (para não quebrar
    chamadas existentes do frontend) — apenas aplica strip + lower.
    """
    if not valor:
        return ""
    return str(valor).strip().lower()
