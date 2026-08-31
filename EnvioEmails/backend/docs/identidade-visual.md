# Identidade Visual — Core TI Expert

Este documento registra formalmente a identidade visual oficial da marca Core TI
Expert e como ela é aplicada no sistema (e-mails transacionais e frontend).
Fonte oficial: `Logomarca/CO000125 Guia de Marca Core.pdf` (guia de marca, 65
páginas) e os arquivos de logo em `Logomarca/`.

> **Nota importante**: esta documentação é um *registro formal* do que já está
> implementado corretamente — `base_email.html` e `services/email_types.py` já
> seguem esta paleta desde antes deste documento existir. Não é uma mudança de
> comportamento, é apenas a formalização do que já estava certo, para que não
> seja "redescoberto" como pendência no futuro.

## 1. Paleta de cores — digital (em uso no sistema)

O símbolo da marca (três anéis entrelaçados) usa um gradiente de três cores.
Essas são as cores **digitais**, extraídas por amostragem de pixel dos
arquivos de logo oficiais, e são as que o sistema usa de fato:

| Cor | Hex | Papel na marca | Onde é usada no código |
|---|---|---|---|
| Verde-limão | `#8DC63F` | Início do gradiente do símbolo | `backend/services/email_types.py` (dict `ACCENTS`, gradientes `marca`/`sucesso`); `backend/templates/base_email.html` (destaque "TI" no cabeçalho) |
| Turquesa/teal | `#00B39B` | Meio do gradiente — cor de destaque predominante da marca | `backend/services/email_types.py` (`ACCENTS["marca"]["solid"]`, `ACCENTS["sucesso"]`, `ACCENTS["info"]`); `backend/templates/base_email.html` (cor do wordmark "Core" no cabeçalho); `EnvioEmails/frontend/src/index.css` (`--accent-teal`) |
| Ciano/azul digital | `#00AEEF` | Fim do gradiente do símbolo | `backend/services/email_types.py` (`ACCENTS["marca"]`, `ACCENTS["info"]["solid"]`); `backend/templates/base_email.html` (destaque "Expert" no cabeçalho); `EnvioEmails/frontend/src/index.css` (`--accent-cyan`) |
| Cinza-chumbo | `#231F20` | Cor do texto "core" no wordmark, usada como cor de título/texto institucional | `backend/templates/base_email.html` (títulos `<h1>` e nome da empresa na assinatura) |
| Laranja de alerta | `#E5572D` | Cor de destaque para e-mails de categoria "alerta" (não faz parte do gradiente da marca, é cor funcional do sistema) | `backend/services/email_types.py` (`ACCENTS["alerta"]`) |

Essas quatro primeiras cores (verde, teal, ciano, chumbo) foram conferidas
por amostragem de pixel diretamente nos PNGs oficiais em `Logomarca/`. O
chumbo (`#231F20`) e o verde (`#8DC63F`, cluster dominante `#8CC63F`) batem
com precisão de pixel; teal e ciano se aproximam dos tons observados no
gradiente rasterizado (diferença perceptível mas pequena, esperada em
gradientes com anti-aliasing amostrados por coordenada) — os valores exatos
`#00B39B`/`#00AEEF` já em uso no código são consistentes com a marca e não
foram alterados por este documento.

## 2. Paleta de cores — Pantone institucional (referência para material impresso)

O guia de marca também define uma paleta Pantone institucional, usada
sobretudo para peças impressas e aplicações onde o gradiente digital não é
reproduzível (ex.: impressão em cores sólidas, papelaria, brindes):

| Referência | Hex aproximado | Observação |
|---|---|---|
| Pantone 547 CP | `#002531` | Azul-petróleo bem escuro, para fundos escuros/impressos |
| Pantone 3005 CP | `#007FC8` | Azul mais saturado/escuro que o `#00AEEF` do gradiente digital |
| Pantone 383 CP | `#A4B400` | Verde-oliva mais escuro que o `#8DC63F` do gradiente digital |

**Importante:** esta paleta Pantone é referência para peças impressas e não é
usada pelo sistema. O sistema (e-mails e frontend) usa exclusivamente a
paleta digital da seção 1, que é a que aparece de fato nos arquivos de logo
oficiais fornecidos. As duas paletas estão documentadas aqui lado a lado
apenas para deixar explícito que a diferença é intencional e não um erro de
cor.

## 3. Tipografia

- **Fontes oficiais da marca**: logotipo/display em **LT Aspirer Neue**;
  texto de sistema em **LT Wave**. Ambas são fontes comerciais/proprietárias.
- **Por que não são usadas em e-mail HTML**: fontes customizadas via
  `@font-face` não são confiáveis em e-mail transacional — a maioria dos
  clientes de webmail (Gmail, Outlook Web, etc.) bloqueia o carregamento de
  fontes externas, e teria custo de licenciamento embutir/hospedar as fontes
  proprietárias. A prática recomendada para e-mail é usar uma fonte "web
  safe" com fallback garantido.
- **Fallback usado no sistema**: `backend/templates/base_email.html` usa
  `font-family: Arial, Helvetica, sans-serif;` em todo o corpo do e-mail —
  essa é a escolha correta e já está implementada, não precisa de alteração.
- No frontend (UI web, não e-mail) pode-se considerar usar LT Wave via
  arquivo de fonte auto-hospedado no futuro, mas isso está fora do escopo
  deste documento (fonte não fornecida pelo usuário até o momento).

## 4. Regras de uso do logo

Arquivos oficiais organizados em
`backend/assets/identidade-visual/` (cópia dos arquivos-fonte de
`Logomarca/`, mantidos como referência dentro do projeto):

| Arquivo | Descrição | Quando usar |
|---|---|---|
| `core-ti-expert-horiz.png` | Lockup horizontal positivo (símbolo + "core TI EXPERT") | Padrão para fundo claro/branco. É o logo usado hoje no cabeçalho dos e-mails (`backend/assets/logo.png`, referenciado via `cid:logo`) |
| `core-ti-expert-horiz-full-light.png` | Lockup horizontal negativo (versão branca) | Uso sobre fundos escuros ou coloridos (ex.: banners escuros, rodapés escuros) |
| `core-ti-expert-icon.png` | Símbolo isolado (só os 3 anéis), positivo | Uso como ícone/favicon/avatar sobre fundo claro, quando não há espaço para o wordmark completo |
| `core-ti-expert-icon-light.png` | Símbolo isolado, versão negativa (branca) | Mesma função do anterior, mas sobre fundo escuro |
| `core-ti-expert-vert.png` | Lockup vertical positivo (símbolo acima do texto) | Uso em espaços mais estreitos e altos (ex.: cartões, materiais verticais), fundo claro |
| `core-ti-expert-vert-full-light.png` | Lockup vertical negativo | Mesma função do anterior, sobre fundo escuro |

**Regras gerais de uso (do guia de marca):**

1. **Nunca distorcer** o símbolo (não esticar, não comprimir, sempre manter
   proporção original ao redimensionar).
2. **Manter área de respiro** ao redor do logo — não posicionar outros
   elementos (texto, bordas, outras imagens) colados ao símbolo ou ao
   wordmark.
3. **Usar a versão negativa/"light" apenas sobre fundos escuros ou
   coloridos** — nunca usar a versão positiva sobre fundo escuro (perde
   contraste) nem a versão negativa sobre fundo claro (fica invisível/quase
   invisível).
4. **Nunca recolorir** o símbolo ou o wordmark fora da paleta oficial
   (seção 1) — o gradiente verde → teal → ciano é parte da identidade e não
   deve ser substituído por cores arbitrárias.
5. **Contexto de uso no sistema:**
   - **E-mail** (`backend/templates/base_email.html`): logo horizontal
     positivo (`backend/assets/logo.png`, embutido via CID), sobre fundo
     branco/claro do cabeçalho do e-mail.
   - **UI/Frontend**: cores de destaque (`--accent-teal`, `--accent-cyan`)
     aplicadas em `EnvioEmails/frontend/src/index.css`, já validadas contra a
     paleta oficial — nenhuma alteração necessária.
   - **Ícone/favicon**: `backend/assets/icon.png` (símbolo isolado,
     positivo), usado quando não há espaço para o lockup horizontal completo.

## 5. Arquivos não copiados para o projeto (intencional)

Os seguintes arquivos permanecem apenas em `Logomarca/` (fonte externa) e não
foram copiados para dentro do repositório do backend, por serem grandes e não
usados em runtime:

- `CO000125 Guia de Marca Core.pdf` (guia completo, 65 páginas)
- `CO000125 Guia de Marca Core.zip`
- `core-animation.mp4`
- `Logo Core-TI-Expert-Em curvas.pdf` / `core-ti-expert-curvas.pdf` (versões vetoriais em curvas, uso gráfico/impressão, não runtime)
- `core-ti-expert-horiz-text-light.png` / `core-ti-expert-vert-text-light.png` (variações adicionais de texto isolado, não usadas pelo sistema atualmente)

Se alguma dessas variações vier a ser necessária no futuro, copiar
pontualmente de `Logomarca/` para `backend/assets/identidade-visual/`.
