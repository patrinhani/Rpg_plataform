# Campaign runtime pack

Execute os comandos na raiz do repositório C.A.O.S. A pasta fonte da campanha é tratada como somente leitura e nunca é modificada.

O gerador cria uma cópia autocontida e leve para o VTT. O pack mantém os IDs e caminhos relativos, mas inclui somente:

- versões ativas dos mapas de jogador e dos guias privados do Mestre;
- overlays referenciados pelas cenas;
- camadas semânticas de cena e todos os assets de seus estados/posicionamentos;
- tokens listados em `collections.tokenAssetIds`;
- objetos de mapa listados em `collections.propAssetIds`;
- handouts listados em `collections.handoutAssetIds`;
- referências exclusivas do Mestre listadas em `collections.masterReferenceAssetIds`.

Versões antigas sem seletor no runtime, documentos sem handout correspondente, grupos de estado e assets sem referência não entram no pack. Manifests anteriores sem `layers` continuam válidos. Assets assumidos por uma camada deixam de ser props, tokens ou overlays globais, evitando que o mesmo elemento apareça duas vezes. As listas estruturais `documents` e grupos de estado ainda aplicáveis permanecem no JSON para compatibilidade com `CampaignCatalog`. Alertas referentes aos assets e cenas selecionados são preservados.

## Criar

```powershell
python -m tools.campaign_pack `
  --manifest tools/campaign_manifest/generated/mnemosyne.manifest.json `
  --source-root F:\RPG\mnemosyne\projeto-mnemosyne-rpg `
  --output server/.artifacts/campaigns/mnemosyne
```

## Validar sem escrever

```powershell
python -m tools.campaign_pack `
  --manifest tools/campaign_manifest/generated/mnemosyne.manifest.json `
  --source-root F:\RPG\mnemosyne\projeto-mnemosyne-rpg `
  --check
```

Antes, durante e depois da cópia, a ferramenta confere confinamento, tipo do arquivo, tamanho e SHA-256. Links simbólicos e junctions são recusados. A saída é montada em uma pasta temporária irmã e instalada por renomeação transacional; um diretório existente só é substituído quando está vazio ou contém um pack gerenciado pela própria ferramenta.

O pack isolado usa 128 MiB como teto padrão. `--max-bytes N` altera o limite em bytes. O builder portátil fornece sua própria margem configurável por `-MaxCampaignBytes`, atualmente 512 MiB, e sempre informa o peso verificado.

Os handouts entram no pack para permitir a entrega durante a mesa, mas não são expostos automaticamente. O backend só serve um handout ao jogador depois que o Mestre o entrega para aquela sala; antes disso, a requisição recebe a mesma resposta de um asset inexistente. Recolher bloqueia acessos futuros, mas não pode apagar uma cópia ou captura já feita pelo jogador.

Referências do Mestre entram em uma coleção separada e nunca se tornam handouts. O gerador só aceita `masterReference: true` em `assetOverrides` exatos, e tanto o manifesto quanto o pack exigem que o asset resultante seja `kind: concept` com `audience: gm`.
