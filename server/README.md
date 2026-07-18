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

Variáveis equivalentes: `CAOS_VTT_HOST_TOKEN`, `CAOS_VTT_ALLOWED_ORIGINS`, `CAOS_VTT_PORT`, `CAOS_VTT_CAMPAIGN_MANIFEST`, `CAOS_VTT_CAMPAIGN_ROOT` e `CAOS_VTT_STATE_DB`. Sem `CAOS_VTT_STATE_DB`, o desenvolvimento usa `.artifacts/caos-vtt-state.sqlite3` relativo ao diretório de execução. Origens com wildcard, caminho, query ou fragmento são recusadas. O handshake WebSocket valida `Origin` separadamente do CORS.

## Contrato de acesso

- `GET /api/vtt/health`
- `POST /api/vtt/rooms`, com Bearer do host token e corpo `{"name":"Minha mesa","externalMesaId":"id-da-mesa"}`
- `POST /api/vtt/rooms/{roomId}/tickets`, com Bearer do convite de Mestre ou jogador
- `GET /api/vtt/rooms/{roomId}/assets?assetId=...&access=...`, com grant de mídia efêmero emitido junto do ticket
- `GET /api/vtt/rooms/{roomId}/fog-map`, mapa composto para o jogador com grant de mídia
- `WS /ws/vtt/rooms/{roomId}?ticket=...`, com ticket de uso único e curta duração

O convite define o papel. O snapshot do Mestre contém o catálogo de cenas, assets de token e de objetos de cenário (`propAssets`) e o guia privado da cena. O snapshot do jogador contém somente o estado autorizado da cena ativa. Enquanto o fog está habilitado, o servidor bloqueia o mapa e as camadas brutas para o jogador e entrega uma única imagem composta com mapa, objetos visíveis, overlays revelados e máscara. Tokens só aparecem no snapshot do jogador quando a área correspondente foi revelada; guias do Mestre continuam sempre privados.

## Comandos sincronizados

O protocolo atual é a versão 1. A conexão começa por `room.snapshot`. O Mestre pode usar `scene.select`, `overlay.set`, `token.spawn`, `token.move`, `token.remove`, `prop.spawn`, `prop.update`, `prop.remove`, `fog.set_enabled`, `fog.stroke`, `fog.reset` e `fog.reveal_all`. O jogador só move tokens cujo `controlledBy` permita seu papel. `commandId` torna repetições idempotentes dentro da sala; `ping` recebe `pong`.

Coordenadas de token são normalizadas entre 0 e 1. Mensagens maiores que 16 KiB, payloads inválidos, IDs conflitantes e ações incompatíveis com o papel são recusados com códigos estáveis.

## Persistência e segurança da sessão

O SQLite guarda a sala, cena ativa, tokens, objetos de cenário, overlays e máscaras de fog. O fog nasce habilitado e totalmente fechado em cada cena; se o mapa associado mudar, a máscara antiga é descartada e a cena volta a ficar fechada. Tickets e grants de mídia continuam efêmeros.

Quando `POST /api/vtt/rooms` recebe um `externalMesaId` já salvo, o servidor recupera a mesma sala e preserva seu estado, mas gera novos convites de Mestre e jogador. Os convites anteriores deixam de funcionar. O host token também é temporário e nunca é salvo. Não compartilhe host token nem convite de Mestre; envie aos jogadores somente o link completo produzido pela interface.

O banco é local e não transforma o VTT em hospedagem multiusuário permanente. Em caso de conteúdo persistido inválido, a sala afetada é isolada na tabela de quarentena; se o arquivo SQLite estiver corrompido, ele é renomeado com o sufixo `.corrupt-<data>` e um banco limpo é criado.

## Verificação

```powershell
.\.venv-vtt\Scripts\python.exe -m pytest server\tests tools\campaign_pack\tests
npm run lint
npm test
```

Consulte [`README-PORTABLE.md`](README-PORTABLE.md) para geração, transporte e uso sem instalação.
