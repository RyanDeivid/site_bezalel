# Automação do Blender

Como o Blender entra na produção do Bezalel: por scripts Python reproduzíveis, rodados em segundo plano.
As convenções de modelagem e o fluxo de ativos estão em `BLENDER-PIPELINE.md`; aqui ficam o ambiente,
os comandos validados, a avaliação do MCP e a recuperação de problemas.

## Ambiente (conferido em 23/10/2026)

| Item | Versão |
|---|---|
| Blender | 5.2.3 LTS (`C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`) |
| Python do sistema | 3.14.6 (o Blender usa o Python embutido dele) |
| Node.js / npm | 26.11.1 / 11.20.0 |
| Claude Code | 2.1.282 |
| Servidores MCP configurados | nenhum |

## Comandos validados

Todos com `--background --factory-startup`: sem janela e sem preferências nem complementos do usuário
(o mesmo resultado em qualquer máquina).

| Passo | Comando | Resultado verificado |
|---|---|---|
| Prova do ambiente | `blender --background --factory-startup --python art/blender/smoke_test.py -- <pasta>` | Ver abaixo |
| Cidade de referência | `node scripts/export-city-layout.ts` e depois `blender --background --python art/blender/import_city_layout.py` | 484 objetos de referência (teste de 23/10/2026, ver BLENDER-PIPELINE.md) |
| Exportar modelos | `blender --background <arquivo>.blend --python art/blender/export_universe.py` (com `BZ_REPO`) | 2 GLBs, registro e posição (teste de 23/10/2026) |
| Conferir modelos | `node scripts/check-models.ts` | triângulos, bytes, compressão, KTX2, licença |

### Prova do ambiente (`smoke_test.py`)

O script cobre todo o necessário, numa pasta temporária, sem tocar nos ativos do site:

1. Roda o Blender em segundo plano.
2. Executa um script Python.
3. Cria geometria: uma placa com chanfro e um piso.
4. Aplica material PBR nas cores Bezalel.
5. Configura luz de área e câmera.
6. Renderiza em Eevee (480 × 300).
7. Exporta o GLB.
8. Relê o arquivo: cabeçalho, versão, tamanho, malhas e materiais.

Resultado da execução de 23/10/2026, com 42 s no total (a maior parte é a inicialização do render):

```
BZ-SMOKE {"blender": "5.2.3 LTS", "engine": "BLENDER_EEVEE", "png": 99053, "glb_bytes": 9792,
          "glb_magic": "glTF", "glb_version": 2, "length_matches": true, "meshes": ["bz_totem"],
          "materials": ["bz-navy", "bz-gold"], "nodes": ["bz_totem_LOD0"]}
BZ-SMOKE OK
```

O script termina com código 1 quando algo falha, então pode entrar numa verificação automática.

## MCP do Blender: avaliação

Hoje existem dois servidores MCP relevantes. **Nenhum foi instalado.**

| | Oficial, do Blender Lab | Comunitário (ex-`blender-mcp`, hoje "MCP for Blender") |
|---|---|---|
| Origem | Blender Lab (projects.blender.org/lab/blender_mcp). v1.0.0 em 27/04/2026, v1.0.3 em setembro de 2026 | Projeto de terceiros, muito popular |
| Requisitos | Blender 5.1 ou mais novo (temos o 5.2.3) | Blender 3.0+ |
| Como funciona | Complemento no Blender + servidor por stdio + soquete TCP local | Igual (stdio + soquete local) |
| Execução de código | Executa o Python gerado pelo modelo **sem nenhuma proteção** | Executa Python; tem um "modo seguro" opcional |
| Segurança | A própria documentação recomenda máquina virtual ou sistema sem dados sensíveis | CVEs em 2026, entre eles injeção de código em `execute_blender_code` (CVE-2026-10688). O soquete não tem autenticação nem criptografia |

**O que o MCP acrescenta aos scripts:** inspecionar e editar a cena aberta conversando, e tentar e
corrigir no mesmo instante, com a cena na tela do artista. **O que os scripts já fazem melhor:** são
reproduzíveis, revisáveis em diff, rodam sem interface (inclusive no CI) e não abrem porta nenhuma.

**Recomendação:**
- Para produção, manter os scripts. Eles cobrem montar a cidade, exportar, validar e registrar a licença.
- O MCP vale como ferramenta interativa de modelagem, se o proprietário quiser. Nesse caso:
  - só o servidor oficial do Blender Lab, com versão fixada;
  - instalado pelo proprietário, numa sessão do Blender sem arquivos sensíveis abertos (de preferência
    num perfil de usuário separado ou numa máquina virtual);
  - o soquete só em `localhost`, nunca exposto na rede;
  - sem segredos nas variáveis de ambiente dessa sessão.

  Tudo o que sair dele passa pelo mesmo `export_universe.py` e pelo `check-models` antes de entrar no
  site.
- O servidor comunitário não deve ser usado enquanto houver CVE aberto sem resposta.

A instalação e a configuração do MCP são decisão do proprietário. Nada disso foi feito automaticamente.

## Recuperação

| Sintoma | O que fazer |
|---|---|
| O Blender não abre em segundo plano | Rode `blender --version`; confira o caminho; use `--factory-startup` para ignorar complementos quebrados |
| O render falha por falta de GPU | O `smoke_test.py` usa Eevee; numa máquina sem GPU, troque para `CYCLES` com `scene.cycles.device = 'CPU'` |
| O GLB sai sem materiais ou com escala errada | Use `export_apply=True` e `export_yup=True` (como no pipeline); aplique a escala antes (`transform_apply`) |
| `check-models` acusa tamanho maior que o declarado | Recomprima (`gltf-transform optimize ... --compress meshopt --texture-compress ktx2`) e atualize `bytes` no registro |
| Exportação sobrescreveu algo por engano | Os arquivos de `public/models/` e os registros estão no git: `git diff` mostra a mudança e `git restore <arquivo>` volta |
