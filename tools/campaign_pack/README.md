# Campaign runtime pack

Execute os comandos na raiz do repositório C.A.O.S. A pasta fonte da campanha é tratada como somente leitura e nunca é modificada.

O gerador cria uma cópia autocontida e leve para o VTT. O pack mantém os IDs e caminhos relativos, mas inclui somente:

- versões ativas dos mapas de jogador e dos guias privados do Mestre;
- overlays referenciados pelas cenas;
- tokens listados em `collections.tokenAssetIds`.

Versões antigas sem seletor no runtime, documentos, grupos de estado e assets sem referência não entram no pack. As listas estruturais `documents` e `stateGroups` permanecem vazias no JSON para compatibilidade com `CampaignCatalog`. Alertas referentes aos assets e cenas selecionados são preservados.

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

Handouts e documentos são catalogados no manifesto principal, mas permanecem fora deste pack até existir um fluxo de revelação por papel. Isso evita entregar pistas do Mestre antes da hora sem impedir que a campanha continue crescendo.
