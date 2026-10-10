# Segurança

## Modelo de ameaças da v1.0

Site estático, sem contas, sem formulários que enviam dados, sem backend obrigatório. Os riscos principais são: vazamento de segredos no JavaScript público, execução de conteúdo vindo de fontes externas, links inseguros, dependências vulneráveis e informações apresentadas com confiança indevida.

## Segredos

- **Tudo que começa com `VITE_` vai para o navegador.** Só valores públicos: base URL, origem do site, modo de dados e URL pública da API.
- Chaves de IA, `service_role` do Supabase, tokens administrativos e afins ficam **somente** no servidor (`server/.env`, ignorado pelo Git).
- `.env`, `.env.*` (exceto `.env.example`) estão no `.gitignore`.
- O assistente nunca chama um provedor de LLM a partir do navegador; a integração futura é `POST /v1/assistant` no servidor.

## Dados externos são não confiáveis

- O pipeline remove marcação HTML e caracteres de controle e **reprova** registros com marcação executável (`<script>`, `javascript:`, `on*=`), mesmo depois de limpos.
- Nenhum texto externo é renderizado como HTML: o React escapa tudo; não há `dangerouslySetInnerHTML` nem `eval`/`new Function` (regras do ESLint `no-eval`, `no-implied-eval`, `no-new-func`).
- JSON-LD é serializado com `<` escapado (`<`) para não fechar a tag `<script>`.
- Respostas da API são validadas por *guards* antes de chegar à interface; URLs de fonte precisam ser HTTPS.
- Parâmetros de URL desconhecidos são descartados (`queryFromParams`); buscas têm tamanho máximo.

## Links externos

`ExternalLink` aceita apenas `http(s)`, abre em nova aba com `rel="noopener noreferrer"` (sem `window.opener` e sem vazar a página de origem) e avisa leitores de tela.

## Content-Security-Policy

O pós-build injeta, em todas as páginas:

```
default-src 'self'; script-src 'self' 'sha256-<hash do script de tema>'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' [origem da API]; worker-src 'self' blob:;
object-src 'none'; base-uri 'self'; form-action 'self'
```

`'unsafe-inline'` em estilos é necessário para atributos `style` gerados pelo React (posições, cores dinâmicas). Fontes são auto-hospedadas — nenhuma origem de terceiros. Limitação: `frame-ancestors` não funciona via `<meta>`; exigiria cabeçalho HTTP (domínio próprio/CDN).

## Dependências

- Versões fixadas no `package.json`; `npm ci` no CI.
- `npm audit` na instalação: **0 vulnerabilidades** (10/10/2026).
- Bibliotecas pesadas só onde necessárias e carregadas sob demanda (three.js, Recharts).

## Backend de referência

- Somente leitura; CORS restrito a `ALLOWED_ORIGINS`, sem credenciais.
- Escuta em `127.0.0.1`, atrás de reverse proxy com TLS (Caddy); container como usuário não-root; systemd com `NoNewPrivileges` e `ProtectSystem=strict`.
- Rate limit no assistente (em memória → 1 worker).
- Sem provedor de LLM configurado, responde 501 — nunca simula um modelo.

## Antes de ativar escrita, autenticação ou Supabase

- Não criar "login" de fachada: autenticação só com provedor real (Supabase Auth, OAuth) validado no servidor.
- Supabase: RLS **habilitado em todas as tabelas**; `anon` apenas com `SELECT` em visões públicas; escrita somente por funções no servidor com `service_role`; nunca expor `service_role` no cliente.
- Logs de agentes sem dados pessoais; definir retenção.
- Atualizar `docs/` e a política de privacidade antes de coletar qualquer dado pessoal.

## Dados pessoais

Nenhum dado pessoal real é coletado nem existe nos fixtures (instituições e cursos de demonstração são fictícios, em `example.org`). As preferências (tema, idioma, animações) ficam apenas no `localStorage` do visitante.

## Relatar um problema

Enquanto não houver canal oficial definido, abra uma issue no repositório **sem** detalhes exploráveis e peça um contato privado ao mantenedor.
