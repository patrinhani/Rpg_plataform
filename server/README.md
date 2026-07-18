# Servidor C.A.O.S. VTT

Backend FastAPI leve para a mesa visual do C.A.O.S. Ele persiste as salas em SQLite, sincroniza cenas, tokens, objetos de cenário e fog of war por WebSocket e serve somente os assets autorizados para cada papel. Não existe rolagem automática: as rolagens continuam nos dados físicos.

## Desenvolvimento

Na raiz do repositório:

```powershell
.\scripts\bootstrap-dev.ps1
.\scripts\start-backend.ps1 `
  -CampaignManifest .\tools\campaign_manifest\generated\mnemosyne.manifest.json `
  -CampaignRoot "F:\RPG\mnemosyne\projeto-mnemosyne-rpg"
```

O servidor escuta apenas `127.0.0.1:8765`. O script gera um host token temporário e autoriza `http://localhost:5173` e `http://127.0.0.1:5173`. Use `-Port`, `-HostToken` e `-AllowedOrigins` para substituir esses valores. `CampaignManifest` e `CampaignRoot` precisam ser informados juntos; sem eles o servidor entra no modo de demonstração.

O script lê de forma passiva **somente** `VITE_APP_PROJECT_ID` de `.env.local` e o repassa ao backend como `CAOS_VTT_FIREBASE_PROJECT_ID`; nenhuma outra variável do arquivo é copiada ou exibida. Também é possível informar `-FirebaseProjectId projeto-id` explicitamente. Com essa configuração, o acesso iniciado por uma Mesa autenticada não pede host token nem convite: o backend valida o ID token do Firebase e deriva o papel pela autoria/membership da Mesa. Sem a configuração, o fluxo manual isolado continua disponível.

Antes de iniciar, o script verifica a porta sem encerrar processos. Se a 8765 já estiver ocupada, feche o servidor anterior ou execute, por exemplo, `.\scripts\start-backend.ps1 -Port 8766`; isso evita o antigo erro genérico `WinError 10048`.

Variáveis equivalentes: `CAOS_VTT_HOST_TOKEN`, `CAOS_VTT_ALLOWED_ORIGINS`, `CAOS_VTT_PORT`, `CAOS_VTT_CAMPAIGN_MANIFEST`, `CAOS_VTT_CAMPAIGN_ROOT`, `CAOS_VTT_STATE_DB` e `CAOS_VTT_FIREBASE_PROJECT_ID`. Os tetos efêmeros por sala podem ser ajustados conscientemente com `CAOS_VTT_MAX_PENDING_TICKETS_PER_ROOM` (padrão 32) e `CAOS_VTT_MAX_MEDIA_GRANTS_PER_ROOM` (padrão 64). Sem `CAOS_VTT_STATE_DB`, o desenvolvimento usa `.artifacts/caos-vtt-state.sqlite3` relativo ao diretório de execução. Origens com wildcard, caminho, query ou fragmento são recusadas. O handshake WebSocket valida `Origin` separadamente do CORS.

## Contrato de acesso

- `GET /api/vtt/health`
- `POST /api/vtt/mesa-access`, com Bearer do ID token Firebase e corpo `{"mesaId":"id-da-mesa"}`; cria/recupera a sala para o autor e conecta membros convidados como jogadores
- `POST /api/vtt/rooms`, com Bearer do host token e corpo `{"name":"Minha mesa","campaignId":"mnemosyne"}`; cria somente salas isoladas de fallback
- `POST /api/vtt/rooms/{roomId}/tickets`, com Bearer do convite de Mestre ou jogador
- `GET /api/vtt/rooms/{roomId}/assets?assetId=...&access=...`, com grant de mídia efêmero emitido junto do ticket
- `GET /api/vtt/rooms/{roomId}/fog-map`, mapa composto para o jogador com grant de mídia
- `WS /ws/vtt/rooms/{roomId}?ticket=...`, com ticket de uso único e curta duração

No fluxo integrado, o papel vem da Mesa validada: o autor é Mestre e os membros convidados são jogadores. O cliente não pode escolher ou elevar o próprio papel. Host token e convites permanecem apenas como fallback do VTT isolado e são recusados em salas integradas. A associação e o papel das sessões abertas são revistos periodicamente; remoção ou mudança de papel revoga WebSocket, tickets e mídia. O ID token usado nessa verificação permanece somente na memória, é renovado pelo cliente antes de expirar e nunca entra no SQLite ou nos logs de acesso. O snapshot do Mestre contém o catálogo de cenas, assets de token, objetos de cenário (`propAssets`), seus grupos de estados (`propStateGroups`) e o guia privado da cena. O snapshot do jogador contém somente o estado autorizado da cena ativa. Enquanto o fog está habilitado, o servidor bloqueia o mapa e as camadas brutas para o jogador e entrega uma única imagem composta com mapa, objetos visíveis, overlays revelados e máscara. Tokens só aparecem no snapshot do jogador quando a área correspondente foi revelada; guias do Mestre continuam sempre privados.

## Comandos sincronizados

O protocolo atual é a versão 1. A conexão começa por `room.snapshot`. O Mestre pode usar `scene.select`, `overlay.set`, `token.spawn`, `token.move`, `token.remove`, `prop.spawn`, `prop.update`, `prop.remove`, `fog.set_enabled`, `fog.stroke`, `fog.reset` e `fog.reveal_all`. O jogador só move tokens cujo `controlledBy` permita seu papel. `commandId` torna repetições idempotentes dentro da sala; `ping` recebe `pong`.

Coordenadas de token são normalizadas entre 0 e 1. Mensagens maiores que 16 KiB, payloads inválidos, IDs conflitantes e ações incompatíveis com o papel são recusados com códigos estáveis.

## Persistência e segurança da sessão

O SQLite guarda a sala, cena ativa, tokens, objetos de cenário, overlays e máscaras de fog. O fog nasce habilitado e totalmente fechado em cada cena; se o mapa associado ou seu conteúdo mudar, a máscara antiga é descartada e a cena volta a ficar fechada. Tickets e grants de mídia continuam efêmeros, limitados por sala e são liberados quando expiram ou quando a conexão correspondente termina.

`POST /api/vtt/mesa-access` recupera pelo ID da Mesa a mesma sala integrada e preserva seu estado. Convites legados eventualmente salvos para ela são girados, invalidados e não podem ser usados no endpoint manual. `POST /api/vtt/rooms` cria uma sala isolada sem vínculo Firebase; nesse fallback, o host token também é temporário e nunca é salvo. Não compartilhe host token nem convite de Mestre; envie aos jogadores somente o link completo produzido pela interface isolada.

O banco é local e não transforma o VTT em hospedagem multiusuário permanente. Em caso de conteúdo persistido inválido, a sala afetada é isolada na tabela de quarentena; se o arquivo SQLite estiver corrompido, ele é renomeado com o sufixo `.corrupt-<data>` e um banco limpo é criado.

## Verificação

```powershell
.\.venv-vtt\Scripts\python.exe -m pytest server\tests tools\campaign_pack\tests
npm run lint
npm test
```

Consulte [`README-PORTABLE.md`](README-PORTABLE.md) para geração, transporte e uso sem instalação.
