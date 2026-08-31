from typing import Literal

from pydantic import BaseModel, EmailStr, Field

TipoBackup = Literal["diario", "semanal", "mensal", "anual", "cloud"]


class ClientIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    emails_secundarios: list[EmailStr] | list[str] = Field(default_factory=list)
    telefone: str = ""
    responsavel: str = ""
    status: str = "ativo"  # "ativo" ou "inativo"
    observacoes: str = ""
    tipos_backup: list[TipoBackup] = Field(default_factory=list)


class ClientOut(BaseModel):
    id: int
    name: str
    email: str
    emails_secundarios: list[str] = Field(default_factory=list)
    telefone: str = ""
    responsavel: str = ""
    status: str = "ativo"
    observacoes: str = ""
    tipos_backup: list[TipoBackup] = Field(default_factory=list)


class TemplateIn(BaseModel):
    chave: str = Field(min_length=2, max_length=100)
    titulo: str = Field(min_length=1, max_length=200)
    categoria: str = "cobranca"  # cobranca, falha, info, sucesso
    assunto: str = Field(min_length=1, max_length=250)
    estilo: str = "marca"  # marca, alerta, sucesso
    corpo: list[str] = Field(min_length=1)
    aplicavel_a: list[TipoBackup] = Field(default_factory=list)


class TemplateOut(TemplateIn):
    pass


class PreviewRequest(BaseModel):
    tipo: str | None = None
    titulo: str = "Título do E-mail de Exemplo"
    cliente_nome: str = "Empresa Exemplo Ltda"
    paragrafos: list[str] = ["Este é um parágrafo demonstrativo de visualização de e-mail."]
    estilo: str = "marca"


class EnviarEmailRequest(BaseModel):
    client_ids: list[int] = Field(default_factory=list)
    destinatarios_avulsos: list[str] = Field(default_factory=list)
    tipo: str = Field(min_length=1)
    custom_assunto: str | None = None


class SettingsIn(BaseModel):
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_use_ssl: bool = True
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "Core TI Expert - Departamento de Backup"
    signature_company: str = "Core TI Expert"
    signature_dept: str = "Departamento de Backup"
    signature_phone: str = "(62) 3242-5830"
    signature_email: str = "clientes.backup@coretiexpert.com.br"


class SettingsOut(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_use_ssl: bool
    smtp_user: str
    smtp_has_password: bool
    smtp_from_email: str
    smtp_from_name: str
    signature_company: str
    signature_dept: str
    signature_phone: str
    signature_email: str
    smtp_configured: bool


class TestSmtpRequest(BaseModel):
    destinatario_teste: str | None = None


class ImportarRequest(BaseModel):
    pastas: list[str] = Field(min_length=1)


class RelatorioRequest(BaseModel):
    pastas: list[str] = Field(min_length=1)
    mes: str | None = None


class ImportPreviewOut(BaseModel):
    colunas: list[str]
    linhas: list[dict[str, str | None]]
    total_linhas: int


class ImportErro(BaseModel):
    linha: int
    motivo: str


class ImportReportOut(BaseModel):
    criados: int
    atualizados: int
    erros: list[ImportErro] = Field(default_factory=list)
