# Prompt de Implementação — Sistema de Gestão & Disparo de E-mails (Core TI Expert)

## Contexto para a IA/Dev que for implementar

Você vai evoluir um sistema já existente (Backend: **FastAPI/Python**, Frontend: **React/Vite**) de gestão e disparo de e-mails de rotina de backup para clientes. Já existe um diagnóstico técnico e um plano de arquitetura anteriores (RF01–RF06, RNF01–RNF04, 6 abas: Clientes, Disparador, Templates, Histórico, Rotina Diária, Configurações). Este prompt **adiciona e detalha requisitos novos** que precisam ser incorporados ao mesmo plano, sem quebrar o que já foi especificado.

> ⚠️ **Pré-requisito antes de começar**: este prompt referencia dois insumos que ainda precisam ser fornecidos pelo usuário:
> 1. Planilha Excel com a base consolidada de clientes (para importação).
> 2. Pasta de identidade visual com **Logomarca**, **wallpaper** e material de **LinkedIn**, para uso nos templates de e-mail.
>
> Assim que esses arquivos forem enviados, mapeie os caminhos reais e ajuste os nomes de arquivo/colunas abaixo (estão como placeholders).

---

## 1. Novo Requisito: Tipo de Backup por Cliente

Cada cliente, além de múltiplos e-mails, telefone, status e observações (já previsto no RF01), precisa de um campo adicional:

- **`tipo_backup`**: enum de valores possíveis:
  - `diario`
  - `semanal`
  - `mensal`
  - `anual`
  - `cloud` (backup em nuvem)

Esse campo é **multi-seleção** (um cliente pode ter mais de um tipo de backup simultaneamente, ex.: diário + mensal).

### Alteração no modelo de dados (Backend)
```python
class Cliente(BaseModel):
    id: str
    razao_social: str
    email_principal: EmailStr
    emails_secundarios: list[EmailStr] = []
    telefone: str | None = None
    status: Literal["ativo", "inativo"] = "ativo"
    observacoes: str | None = None
    tipos_backup: list[Literal["diario", "semanal", "mensal", "anual", "cloud"]] = []
```

### Alteração no Frontend (`Clientes.jsx`)
- No modal de cadastro/edição, adicionar um grupo de **checkboxes** (não radio) para `tipos_backup`.
- Na tabela de listagem, exibir badges coloridos por tipo de backup associado a cada cliente.
- Adicionar **filtro** na busca por tipo de backup (ex.: "mostrar só clientes com backup mensal").

---

## 2. Novo Requisito: Regras de Vínculo entre Tipo de E-mail e Tipo de Backup

Os templates de e-mail existentes precisam ser reclassificados/vinculados ao `tipo_backup` correspondente, com duas categorias de disparo:

| Categoria de E-mail | Aplica-se a quais tipos de backup? |
|---|---|
| **Solicitar disco** | Diário, Semanal, Mensal, Anual |
| **Informar finalização do backup** | Normalmente só Semanal, Mensal, Anual (não Diário) |

### Regra de negócio a implementar
- No cadastro/edição de **template** (aba Templates), adicionar campo `aplicavel_a: list[tipo_backup]` — define para quais tipos de backup aquele template é elegível.
- Na tela **Disparador**, ao selecionar um template, o sistema deve **filtrar automaticamente** a lista de clientes sugeridos, mostrando só os que têm `tipo_backup` compatível com o template escolhido (o operador ainda pode adicionar manualmente outros, mas o filtro poupa trabalho e evita erro).

---

## 3. Novo Requisito: Regra de Cópia Oculta (CCO/BCC) Obrigatória

Regra de negócio crítica:

> **Ao disparar o e-mail informativo de início do backup Semanal, Mensal ou Anual, TODOS os e-mails do cliente (principal + secundários) devem ser adicionados como Cópia Oculta (CCO/BCC) — exceto o destinatário principal, que permanece como "Para" normalmente.**

Ou seja:
- **Destinatário principal (To)**: o e-mail principal já cadastrado no cliente (comportamento atual, mantém).
- **CCO (BCC)**: automaticamente populado com os `emails_secundarios` do cliente **quando** o e-mail disparado for do tipo "informativo de início" de backup Semanal/Mensal/Anual.
- Para os demais tipos de e-mail (ex.: solicitação de disco), o comportamento de CC/CCO permanece manual/opcional, como já previsto no RF04 original (campos CC e CCO opcionais).

### Implementação sugerida (Backend — `routers/emails.py`)
```python
def montar_destinatarios(cliente: Cliente, template: TemplateEmail) -> DestinatariosEmail:
    to = [cliente.email_principal]
    cco = []
    if template.categoria == "informativo_inicio" and "semanal" in template.aplicavel_a + "mensal" in template.aplicavel_a + "anual" in template.aplicavel_a:
        cco = cliente.emails_secundarios
    return DestinatariosEmail(to=to, cco=cco)
```
*(pseudo-código — ajustar para a lógica real de matching entre `template.aplicavel_a` e o `tipo_backup` do disparo em questão)*

### Implementação no Frontend (`Disparador.jsx`)
- Quando o operador selecionar um template de "informativo de início" para backup semanal/mensal/anual, exibir visualmente na prévia: **"Para: [email principal] · CCO: [lista de e-mails secundários] (automático)"** — deixando claro e auditável antes do envio, mesmo sendo automático.

---

## 4. Novo Requisito: Importação da Base Consolidada via Excel

A planilha enviada pelo usuário já é a base "oficial" de clientes e deve popular o sistema (não é só um exemplo — é a fonte de verdade inicial).

### Passos de implementação
1. **Endpoint de importação** (`POST /api/clients/import`): recebe arquivo `.xlsx`, faz parsing (via `openpyxl` ou `pandas`), valida linha a linha (e-mail válido, campos obrigatórios) e faz **upsert** (atualiza se já existir por e-mail principal, cria se não existir).
2. **Mapeamento de colunas**: como o layout exato da planilha ainda não foi enviado, implementar o import com **mapeamento configurável** (tela simples: "qual coluna da planilha corresponde a qual campo do sistema?") em vez de assumir nomes fixos de coluna — isso evita retrabalho quando a planilha real chegar.
3. **Relatório pós-importação**: quantos clientes criados, quantos atualizados, quantas linhas com erro (e o motivo de cada erro), disponível para download/consulta na tela.
4. **Frontend**: na aba Clientes, botão "Importar Excel" abre modal com upload → preview das primeiras linhas → mapeamento de colunas → confirmação → relatório de resultado.

---

## 5. Novo Requisito: Aba de Templates com Código HTML Consolidado (Editor + Preview)

Complementando o RF02 já definido, o requisito específico agora é:

- O editor de templates precisa oferecer **duas visões**:
  1. **Visão de campos editáveis** (assunto, título, categoria, cor de destaque, parágrafos) — já previsto.
  2. **Visão de código HTML consolidado** — o HTML final, já renderizado com header, rodapé, logo e assinatura institucional, editável diretamente como código (não só como preview).
- Cada campo editável (assunto, título, parágrafos, cor) deve estar **sincronizado bidirecionalmente** com o código HTML: editar no campo estruturado atualiza o HTML, e (se permitido) editar o HTML atualiza os campos, ou pelo menos o preview reflete imediatamente.
- Usar um editor de código com syntax highlighting para HTML (ex.: `@monaco-editor/react` ou `CodeMirror`) em vez de `<textarea>` simples.
- Botão **"Copiar HTML"** e **"Baixar .html"** para cada template, útil para auditoria/backup manual dos modelos.

### Estrutura sugerida de tela (`Templates.jsx`)
```
┌─────────────────────────────┬─────────────────────────────┐
│ Campos editáveis             │ [Aba: Preview] [Aba: Código] │
│ - Assunto                    │                               │
│ - Categoria                  │  (preview renderizado         │
│ - Cor de destaque             │   OU código HTML editável)   │
│ - Parágrafos (lista)         │                               │
│ - Aplicável a (tipos backup) │                               │
└─────────────────────────────┴─────────────────────────────┘
```

---

## 6. Novo Requisito: Identidade Visual nos E-mails

A pasta de identidade visual (Logomarca, wallpaper, material de LinkedIn) deve ser usada como base para manter consistência visual nos e-mails e, se aplicável, também na interface do sistema.

### Ação a implementar
1. Criar diretório `assets/identidade-visual/` no backend (ou pasta estática servida pelo frontend) para armazenar os arquivos definitivos assim que enviados.
2. No template HTML base (`templates/base_email.html`), garantir que:
   - O **logotipo** apareça no cabeçalho do e-mail (via URL pública/hospedada, já que a maioria dos clientes de e-mail bloqueia imagens embutidas em base64 de forma inconsistente).
   - As **cores** usadas no template (gradientes, faixas de destaque) sigam a paleta oficial extraída da identidade visual.
   - O rodapé/assinatura reflita o mesmo padrão visual usado no LinkedIn da empresa (mesma tipografia/tom, quando aplicável a HTML de e-mail).
3. Adicionar um pequeno **guia de estilo** (arquivo `docs/identidade-visual.md`) documentando: cores oficiais (hex), fonte usada, regras de uso do logo (tamanho mínimo, espaçamento), para que futuras edições de template sigam o padrão sem precisar redescobrir isso.

> Assim que a pasta for enviada, os arquivos reais devem ser copiados para o diretório de assets do projeto e referenciados nos templates — hoje isso está pendente por falta do material.

---

## 7. Resumo Consolidado — O que muda no plano original

| Módulo já previsto | O que foi adicionado/detalhado agora |
|---|---|
| RF01 - Clientes | + campo `tipos_backup` (multi-seleção), + filtro por tipo de backup |
| RF02 - Templates | + campo `aplicavel_a` (vínculo com tipo de backup), + editor de código HTML consolidado com sync bidirecional |
| RF04 - Disparador | + filtro automático de clientes por template compatível, + regra de CCO automático para informativos semanal/mensal/anual |
| Importação de dados | **novo**: endpoint e tela de importação de Excel com mapeamento de colunas |
| Identidade visual | **novo**: uso formal de logo/wallpaper/LinkedIn nos templates, com guia de estilo documentado |

---

## 8. Próximos Passos Imediatos

1. **Usuário envia**: planilha Excel de clientes + pasta com logomarca/wallpaper/material de LinkedIn.
2. Dev/IA mapeia colunas reais da planilha → confirma com o usuário o `mapeamento coluna → campo`.
3. Implementa alterações de modelo (`Cliente`, `TemplateEmail`) no backend.
4. Implementa lógica de CCO automático e filtro de compatibilidade template↔backup.
5. Implementa endpoint e tela de importação Excel.
6. Implementa editor de código HTML consolidado na aba Templates.
7. Aplica identidade visual real nos templates e documenta no guia de estilo.
8. Roda verificação manual completa (igual ao checklist do plano original, aba por aba) + testes automatizados de backend.
