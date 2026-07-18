# Sistema C.A.O.S.

**Controle de Agentes e Ocorrências Sobrenaturais** é uma plataforma para gerenciar fichas e mesas de Ordem Paranormal RPG.

O projeto auxilia nos cálculos e no acompanhamento da ficha, mas as rolagens são feitas com dados físicos.

## Funcionalidades

- Fichas de agentes com PV, PE, SAN, Defesa, perícias e carga.
- Inventário, modificações, rituais, poderes e progressão.
- Diário e ações de interlúdio.
- Mesas com participantes, criaturas e iniciativa compartilhada.
- VTT visual sincronizado com cenas, mapas, overlays e tokens.
- Bestiário integrado.
- Exportação da ficha em JSON e PDF.
- Sincronização e autenticação das fichas pelo Firebase.

## Desenvolvimento

Requisitos: Node.js 20.19+ (ou 22.12+) com npm e Python 3.10+.

No Windows, o bootstrap instala as dependências do frontend, cria `.venv-vtt` e instala as dependências do backend sem exigir privilégios de administrador:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap-dev.ps1
```

Se o frontend já estiver instalado e em execução, use `-SkipFrontend` para preparar somente o ambiente Python sem interromper o Vite.

Depois, abra dois terminais na raiz do projeto:

```powershell
# Terminal 1 — frontend em http://localhost:5173
npm run dev

# Terminal 2 — backend na porta 8765 com a campanha
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-backend.ps1 `
  -CampaignManifest .\tools\campaign_manifest\generated\mnemosyne.manifest.json `
  -CampaignRoot "F:\RPG\mnemosyne\projeto-mnemosyne-rpg"
```

O backend gera um host token temporário, mostra o valor no terminal e não grava o segredo em disco. Use `-Port 9000` para trocar a porta ou `-AllowedOrigins "https://seu-app.vercel.app"` para autorizar outro frontend. `CampaignManifest` e `CampaignRoot` sempre são informados juntos; sem ambos o VTT inicia no modo de demonstração.

Abra `http://localhost:5173/vtt-lab`. A mesa nunca faz rolagens automáticas. O link do jogador é gerado dentro da sala e contém apenas o convite de jogador.

## Pacote portátil

Para o computador da mesa, use o ZIP gerado em vez do ambiente de desenvolvimento. Depois de extraído, ele roda no Windows x64 sem instalar Python, Node.js ou dependências e oferece launchers local e online. As instruções completas estão em [`server/README-PORTABLE.md`](server/README-PORTABLE.md).

## Verificação

```powershell
npm run lint
npm test
npm run build
.\.venv-vtt\Scripts\python.exe -m pytest server\tests tools\campaign_pack\tests
```

`npm run check` executa lint, testes JavaScript e a build completa do sistema.

## Tecnologias

- React e Vite
- Firebase Authentication e Firestore para fichas
- FastAPI e WebSocket para o VTT
- GSAP e Three.js
- CSS responsivo com temas visuais

## Estado

Projeto em desenvolvimento. As regras oficiais e opcionais serão organizadas em etapas futuras, preservando a liberdade para regras da mesa.
