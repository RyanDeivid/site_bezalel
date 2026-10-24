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
default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'sha256-<hash do script de tema>'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' [origem da API]; worker-src 'self' blob:;
object-src 'none'; base-uri 'self'; form-action 'self'
```

`'wasm-unsafe-eval'` permite **só** compilar WebAssembly (não libera `eval` de JavaScript): os decodificadores dos modelos de artistas do Universe (meshopt e o transcodificador KTX2/Basis, do próprio three.js, servidos pela mesma origem) são WebAssembly. `'unsafe-inline'` em estilos é necessário para atributos `style` gerados pelo React (posições, cores dinâmicas). Fontes são auto-hospedadas — nenhuma origem de terceiros. Limitação: `frame-ancestors` não funciona via `<meta>`; exigiria cabeçalho HTTP (domínio próprio/CDN).

## Dependências

- Versões fixadas no `package.json`; `npm ci` no CI.
- `npm audit` na instalação: **0 vulnerabilidades** (10/10/2026).
- Bibliotecas pesadas só onde necessárias e carregadas sob demanda (three.js, Recharts).

## Backend de referência

- Somente leitura; CORS restrito a `ALLOWED_ORIGINS`, sem credenciais.
- Escuta em `127.0.0.1`, atrás de reverse proxy com TLS (Caddy); container como usuário não-root; systemd com `NoNewPrivileges` e `ProtectSystem=strict`.
- Rate limit no assistente (em memória → 1 worker).
- Sem provedor de LLM configurado, responde 501 — nunca simula um modelo.

## Runtime de agentes (`/v1/runtime`)

O backend ganhou rotas de escrita, no runtime de agentes. As defesas:
- **Fechado por padrão:** sem `BEZALEL_RUNTIME_TOKENS`, o runtime responde 503.
- **Tokens:** de portador, guardados só como SHA-256 e comparados em tempo constante.
- **Papéis por ação:** reader, operator, approver, admin.
- **Escrita só da própria máquina:** a menos que `BEZALEL_RUNTIME_ALLOW_REMOTE_WRITES=1` (só atrás de TLS).
  Há também limite de 30 escritas por minuto por token.
- **Execução só pelo worker,** com ferramentas de uma lista fixa:
  - o único comando de terminal é `npm run <script da lista>`;
  - sem shell, com tempo limite;
  - a árvore de processos é encerrada no tempo limite;
  - o processo filho não recebe os segredos do ambiente.
- **Nenhuma rota executa código, comando ou ferramenta livre.**
- **Conteúdo lido de páginas é dado, nunca instrução** (ver `AGENT-TOOLS.md`).
- **O banco do runtime não entra no git:** ele fica em `server/var/`, que é ignorado.
- **Projeção pública para a Torre** (`/v1/runtime/public/tower`):
  - é a única rota do runtime sem token, porque o navegador não pode guardar segredo;
  - fica desligada por padrão;
  - expõe só contagens, datas e estados, do ambiente `live`;
  - no site, a resposta passa por um guard.
- **CSP:** a origem de `VITE_API_BASE_URL` (HTTPS, ou localhost em desenvolvimento) entra em `connect-src`
  sempre que estiver configurada.

## Antes de ativar escrita, autenticação ou Supabase

- Não criar "login" de fachada: autenticação só com provedor real (Supabase Auth, OAuth) validado no servidor.
- Supabase: RLS **habilitado em todas as tabelas**; `anon` apenas com `SELECT` em visões públicas; escrita somente por funções no servidor com `service_role`; nunca expor `service_role` no cliente.
- Logs de agentes sem dados pessoais; definir retenção.
- Atualizar `docs/` e a política de privacidade antes de coletar qualquer dado pessoal.

## Dados pessoais

Nenhum dado pessoal real é coletado nem existe nos fixtures (instituições e cursos de demonstração são fictícios, em `example.org`). As preferências (tema, idioma, animações) ficam apenas no `localStorage` do visitante.

## Relatar um problema

Enquanto não houver canal oficial definido, abra uma issue no repositório **sem** detalhes exploráveis e peça um contato privado ao mantenedor.
