# Servidor C.A.O.S. VTT

Backend FastAPI leve para a mesa visual do C.A.O.S. Ele sincroniza salas, tokens, objetos de cenário e fog of war por WebSocket e serve somente os assets autorizados para cada papel. O desenvolvimento local persiste em SQLite; hospedagens efêmeras usam Firestore. Não existe rolagem automática: as rolagens continuam nos dados físicos.

Campanhas são pacotes opcionais de conteúdo, nunca parte fixa do site. Sem um pacote carregado, o servidor usa o workspace reservado `caos-empty`, suficiente para validar conexão, papéis e quadro básico. Mnemosyne permanece apenas como exemplo de desenvolvimento e pacote portátil; qualquer outro manifesto válido pode ser usado sem alterar o runtime.

## Render

Configuração do Web Service:

```text
Root Directory: server
Build Command: pip install -r requirements.txt
Start Command: python -m caos_vtt
Health Check Path: /api/vtt/health
```

Variáveis obrigatórias:

```text
CAOS_VTT_HOST_TOKEN=<segredo aleatório com pelo menos 16 caracteres>
CAOS_VTT_ALLOWED_ORIGINS=https://seu-projeto.vercel.app
CAOS_VTT_FIREBASE_PROJECT_ID=sistemarpg-14d7d
CAOS_VTT_STATE_BACKEND=firestore
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/firebase-service-account.json
```

Adicione no Render um Secret File chamado `firebase-service-account.json` com o JSON de uma conta de serviço do projeto Firebase. Nunca versione esse arquivo. O Render fornece `RENDER=true` e `PORT`; o processo usa automaticamente `0.0.0.0:$PORT`. A coleção administrativa `vttRoomStates` permanece inacessível aos clientes pelas regras do Firestore e guarda snapshots comprimidos das salas.

O arquivo `render.yaml` na raiz registra os mesmos valores sem incluir segredos. Um pacote de campanha continua opcional por meio do par `CAOS_VTT_CAMPAIGN_MANIFEST` e `CAOS_VTT_CAMPAIGN_ROOT`. No Render, quando essas variáveis não são definidas e existe exatamente um pacote sob `server/campaigns`, ele é descoberto automaticamente. O conteúdo desse pacote só é exposto a salas cujo `campaignId` corresponda ao manifesto; mesas `caos-empty` continuam no workspace genérico e não conseguem abrir seus assets.

## Desenvolvimento

Na raiz do repositório:

```powershell
.\scripts\bootstrap-dev.ps1
.\scripts\start-backend.ps1 `
  -CampaignManifest .\tools\campaign_manifest\generated\mnemosyne.manifest.json `
  -CampaignRoot "F:\RPG\mnemosyne\projeto-mnemosyne-rpg"
```

O servidor escuta apenas `127.0.0.1:8765`. O script gera um host token temporário e autoriza `http://localhost:5173` e `http://127.0.0.1:5173`. Use `-Port`, `-HostToken` e `-AllowedOrigins` para substituir esses valores. `CampaignManifest` e `CampaignRoot` precisam ser informados juntos; sem eles o servidor entra no modo de demonstração.

O script lê de forma passiva **somente** `VITE_APP_PROJECT_ID` de `.env.local` e o repassa ao backend como `CAOS_VTT_FIREBASE_PROJECT_ID`; nenhuma outra variável do arquivo é copiada ou exibida. Também é possível informar `-FirebaseProjectId projeto-id` explicitamente. Com essa configuração, o acesso iniciado por uma Mesa autenticada não pede host token nem convite: o navegador cria um grant curto validado pelas regras do Firestore, e o backend deriva o papel sem receber o token Firebase. Sem a configuração, o fluxo manual isolado continua disponível.

Antes de iniciar, o script verifica a porta sem encerrar processos. Se a 8765 já estiver ocupada, feche o servidor anterior ou execute, por exemplo, `.\scripts\start-backend.ps1 -Port 8766`; isso evita o antigo erro genérico `WinError 10048`.

Variáveis equivalentes: `CAOS_VTT_HOST_TOKEN`, `CAOS_VTT_ALLOWED_ORIGINS`, `CAOS_VTT_PORT`, `CAOS_VTT_CAMPAIGN_MANIFEST`, `CAOS_VTT_CAMPAIGN_ROOT`, `CAOS_VTT_STATE_BACKEND`, `CAOS_VTT_STATE_DB`, `CAOS_VTT_FIRESTORE_STATE_COLLECTION` e `CAOS_VTT_FIREBASE_PROJECT_ID`. Os tetos efêmeros por sala podem ser ajustados conscientemente com `CAOS_VTT_MAX_PENDING_TICKETS_PER_ROOM` (padrão 32) e `CAOS_VTT_MAX_MEDIA_GRANTS_PER_ROOM` (padrão 64). O ambiente local usa SQLite por padrão; no Render, o padrão seguro é Firestore. Origens com wildcard, caminho, query ou fragmento são recusadas. O handshake WebSocket valida `Origin` separadamente do CORS.

## Contrato de acesso

- `GET /api/vtt/health`
- `POST /api/vtt/mesa-challenges`, inicia o grant curto associado a uma Mesa
- `POST /api/vtt/mesa-access`, com `mesaId` e `challenge`; cria/recupera a sala para o autor e conecta membros convidados como jogadores sem receber token Firebase
- `POST /api/vtt/rooms`, com Bearer do host token e corpo `{"name":"Minha mesa","campaignId":"caos-empty"}`; cria somente salas isoladas de fallback
- `POST /api/vtt/rooms/{roomId}/tickets`, com Bearer do convite de Mestre ou jogador
- `GET /api/vtt/rooms/{roomId}/assets?assetId=...&access=...`, com grant de mídia efêmero emitido junto do ticket
- `GET /api/vtt/rooms/{roomId}/fog-map`, mapa composto para o jogador com grant de mídia
- `WS /ws/vtt/rooms/{roomId}?ticket=...`, com ticket de uso único e curta duração

No fluxo integrado, o papel vem da Mesa validada: o autor é Mestre e os membros convidados são jogadores. O cliente não pode escolher ou elevar o próprio papel. Host token e convites permanecem apenas como fallback do VTT isolado e são recusados em salas integradas. A associação e o papel das sessões abertas são revistos periodicamente; remoção ou mudança de papel revoga WebSocket, tickets e mídia. O token Firebase nunca é enviado ao VTT; somente o grant curto e não enumerável é consultado. O snapshot do Mestre contém o catálogo de cenas, assets de token, objetos de cenário (`propAssets`), seus grupos de estados (`propStateGroups`) e o guia privado da cena. O snapshot do jogador contém somente o estado autorizado da cena ativa. Enquanto o fog está habilitado, o servidor bloqueia o mapa e as camadas brutas para o jogador e entrega uma única imagem composta com mapa, objetos visíveis, overlays revelados e máscara. Tokens só aparecem no snapshot do jogador quando a área correspondente foi revelada; guias do Mestre continuam sempre privados.

## Comandos sincronizados

O protocolo atual é a versão 1. A conexão começa por `room.snapshot`. O Mestre pode usar `scene.select`, `overlay.set`, `token.spawn`, `token.assign`, `token.move`, `token.remove`, `prop.spawn`, `prop.update`, `prop.remove`, `fog.set_enabled`, `fog.stroke`, `fog.reset` e `fog.reveal_all`. Em salas integradas a uma Mesa, `token.assign` vincula a instância ao UID de um jogador e o servidor só aceita `token.move` desse controlador; o UID completo aparece apenas no snapshot do Mestre. Salas legadas sem Mesa preservam o controle coletivo definido por `controlledBy`. `commandId` torna repetições idempotentes dentro da sala; `ping` recebe `pong`.

Coordenadas de token são normalizadas entre 0 e 1. Mensagens maiores que 16 KiB, payloads inválidos, IDs conflitantes e ações incompatíveis com o papel são recusados com códigos estáveis.

## Persistência e segurança da sessão

SQLite no ambiente local e Firestore no Render guardam a sala, cena ativa, tokens, objetos de cenário, overlays e máscaras de fog. O Firestore recebe um snapshot JSON comprimido por sala, mantendo os documentos abaixo do limite seguro configurado. Tickets, challenges, sessões e grants de mídia nunca são persistidos.

`POST /api/vtt/mesa-access` recupera pelo ID da Mesa a mesma sala integrada e preserva seu estado. Convites legados eventualmente salvos para ela são girados, invalidados e não podem ser usados no endpoint manual. `POST /api/vtt/rooms` cria uma sala isolada sem vínculo Firebase; nesse fallback, o host token também é temporário e nunca é salvo. Não compartilhe host token nem convite de Mestre; envie aos jogadores somente o link completo produzido pela interface isolada.

Em caso de conteúdo persistido inválido, a sala afetada é isolada: SQLite usa a tabela local de quarentena e Firestore usa a coleção administrativa com sufixo `Quarantine`.

## Verificação

```powershell
.\.venv-vtt\Scripts\python.exe -m pytest server\tests tools\campaign_pack\tests
npm run lint
npm test
```

Consulte [`README-PORTABLE.md`](README-PORTABLE.md) para geração, transporte e uso sem instalação.
