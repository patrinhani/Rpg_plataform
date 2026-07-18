# Manifesto externo de campanha

A ferramenta `tools/campaign_manifest` inventaria o Projeto Mnemosyne sem alterar a pasta da campanha e sem copiar seus PNG/SVG/WebP para este repositório. O manifesto contém somente uma referência lógica da origem, caminhos relativos, hashes SHA-256, dimensões, transparência e agrupamentos úteis ao futuro VTT. O caminho absoluto local nunca integra o JSON versionado.

## Gerar

Execute na raiz do C.A.O.S.:

```powershell
python -m tools.campaign_manifest.generate `
  --source "D:\Campanhas\projeto-mnemosyne-rpg"
```

Por padrão, a saída é `tools/campaign_manifest/generated/mnemosyne.manifest.json`. Um destino alternativo pode ser informado com `--output`:

```powershell
python -m tools.campaign_manifest.generate `
  --source "D:\Campanhas\projeto-mnemosyne-rpg" `
  --output ".\tools\campaign_manifest\generated\mnemosyne.manifest.json"
```

O caminho de saída deve ficar fora da campanha de origem. Essa proteção impede que a ferramenta suje ou modifique acidentalmente o repositório Mnemosyne.

A curadoria semântica fica versionada no aplicativo em
`tools/campaign_manifest/config/mnemosyne.asset-overrides.json`. Ela aceita caminhos
relativos exatos e famílias versionadas estruturadas, sem expressões regulares
configuráveis. Uma família casa apenas `<familia>-vN.ext`, com `N` inteiro positivo
sem zero à esquerda e extensão em allowlist. Assim, todas as versões do corpo
conectado e de Helena na cadeira neural são `prop`, embora os arquivos legados ainda
estejam na pasta `assets/tokens`; nomes parecidos ou backups não entram por prefixo.
Os demais tokens continuam tokens. Entradas que não existem mais ou possuem campos
inválidos geram avisos explícitos. `controlledBy` aceita somente `gm` ou `players`.
O manifesto registra a
versão e o SHA-256 dessa configuração, portanto a mesma campanha e a mesma
configuração sempre produzem a mesma classificação.

Para auditar uma configuração alternativa sem alterar o padrão versionado:

```powershell
python -m tools.campaign_manifest.generate `
  --source "D:\Campanhas\projeto-mnemosyne-rpg" `
  --classification-config ".\minha-curadoria.json"
```

## Validar sem gravar

```powershell
python -m tools.campaign_manifest.generate `
  --source "D:\Campanhas\projeto-mnemosyne-rpg" `
  --check
```

`--check` recalcula tudo em memória e retorna erro se o JSON estiver ausente ou desatualizado. O conteúdo é determinístico: cópias idênticas da campanha produzem os mesmos bytes mesmo quando ficam em raízes locais diferentes.

Use `--strict` para retornar código 2 quando houver avisos de calibração ou arquivos não associados automaticamente.

## O que o JSON representa

- `schemaVersion: 2`: contrato que remove caminhos absolutos e representa variantes com versão numérica;
- `campaign.sourceRef`: identificador lógico que o servidor associa a uma raiz externa por configuração local;
- `classification`: referência portátil, versão e fingerprint SHA-256 da curadoria semântica;
- `assets`: inventário de mapas, guias do mestre, overlays, tokens, objetos, handouts, símbolos e concepts; qualquer arquivo sob `assets/handouts/` recebe `kind: handout` e `audience: gm` por padrão;
- `documents`: metadados dos Markdown em UTF-8, sem copiar seu conteúdo integral;
- `collections.scenes`: mapas de jogadores, guias e overlays agrupados por cena, com versão numérica; `activePlayerMap` aponta para a maior versão quando ela é única. Para cada nome de overlay, apenas a maior versão integra a cena; versões anteriores permanecem no inventário de assets e um empate na versão mais alta deixa o overlay de fora com aviso explícito;
- `collections.stateGroups`: pares como âncora ativa/desativada e Fragmento ritual/recuperado; versões repetidas geram aviso e a maior versão numérica é selecionada de forma determinística. No VTT esses grupos também são a política de transição: o Mestre só pode trocar um objeto por outro estado do mesmo grupo, e assets sem grupo não recebem um fallback para a lista global;
- `collections.tokenAssetIds`, `propAssetIds` e `handoutAssetIds`: índices semânticos separados para que o VTT não trate objetos de cenário ou documentos privados como criaturas;
- `warnings`: lacunas que precisam de decisão humana, como a grade ainda desconhecida dos mapas Helix-9.

Os assets permanecem na campanha. Um futuro importador deverá resolver `campaign.sourceRef` por uma configuração local não versionada, anexar `asset.relativePath`, confirmar que o caminho resolvido continua dentro da raiz configurada e validar o SHA-256 antes de servir o arquivo.

`audience` e `audienceHint` são classificação conservadora, não autorização. Valores `gm` nunca podem ser enviados a jogadores. Valores `unspecified` também são **negados por padrão** e só podem chegar a jogadores após uma decisão explícita em allowlist. Essa regra evita que documentos como bíblia da campanha, arcos futuros, encontros e prompts vazem por ausência de marcador textual.

A escrita usa arquivo temporário exclusivo no mesmo diretório e substituição atômica. Links simbólicos, junctions/reparse points e entradas que resolvem fora da campanha são ignorados; se um arquivo mudar durante hash/leitura de metadados, a geração é abortada para evitar um manifesto internamente inconsistente.

## Testes

```powershell
python -m unittest discover -s tools/campaign_manifest/tests -v
```

Os testes usam diretórios temporários com nomes e conteúdo Unicode. Eles verificam caminhos portáveis, UTF-8, determinismo entre raízes diferentes, audiência conservadora, seleção numérica de versões, temporário exclusivo, recusa de escrita dentro da campanha e detecção de links/arquivos alterados durante a leitura.
