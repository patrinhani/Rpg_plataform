# Derivados de imagem do VTT

Esta ferramenta cria uma nova versao de um asset sem sobrescrever o original. Ela usa `sharp`, instalado junto das dependencias de desenvolvimento do projeto.

Ela preserva a geometria e prepara a resolucao/formato de um asset que ja tenha sido restaurado ou aprimorado. Redimensionar sozinho nao inventa detalhes perdidos; por isso os mapas ativos foram primeiro regenerados a partir das referencias visuais e so depois passaram por este pipeline deterministico.

Exemplo:

```powershell
node .\tools\image_derivatives\build.mjs `
  --source "F:\RPG\mnemosyne\projeto-mnemosyne-rpg\assets\mapas\mapa-v1.png" `
  --output "F:\RPG\mnemosyne\projeto-mnemosyne-rpg\assets\mapas\mapa-v2.webp" `
  --width 3136 `
  --quality 94
```

- Mapas: WebP, 3136 px, qualidade 94.
- Guias do mestre: WebP, 3136 px, qualidade 96.
- Overlays transparentes: PNG, 3136 px.

O destino precisa ser novo. A ferramenta recusa argumentos desconhecidos ou repetidos, dimensoes inseguras e qualquer tentativa de substituir o arquivo de origem ou um derivado ja existente. Se a origem mudar enquanto o processamento estiver em andamento, o derivado temporario e descartado.
