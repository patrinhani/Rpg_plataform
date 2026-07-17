# C.A.O.S. VTT Server — prova inicial

Servidor FastAPI mínimo para validar criação de sala e sincronização WebSocket. O estado ainda é
mantido em memória: encerrar o processo remove salas, tickets e posições. Não há rolagem de dados.

## Preparação

No PowerShell, a partir de `server/`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
$env:CAOS_VTT_HOST_TOKEN = "troque-por-um-segredo-com-16-ou-mais-caracteres"
$env:CAOS_VTT_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,https://seu-frontend.vercel.app"
python -m caos_vtt
```

O servidor escuta `127.0.0.1:8765` por padrão. `CAOS_VTT_HOST`, `CAOS_VTT_PORT` e
`CAOS_VTT_TICKET_TTL`
podem sobrescrever host, porta e validade do ticket. A lista de origens é explícita; curingas são
rejeitados, assim como origens com query ou fragmento. Por padrão, `localhost:5173` e
`127.0.0.1:5173` são aceitos. O handshake WebSocket também valida `Origin`, porque CORS não protege
WebSockets.

Por segurança, `CAOS_VTT_HOST` aceita somente endereços de loopback. O acesso de outros dispositivos
será feito pelo túnel, sem expor uma porta de entrada na rede local.

## Contrato HTTP

- `GET /api/vtt/health`
- `POST /api/vtt/rooms`, Bearer `CAOS_VTT_HOST_TOKEN`, corpo `{"name":"Minha mesa"}`
- `POST /api/vtt/rooms/{roomId}/tickets`, Bearer `masterInviteToken` ou `playerInviteToken`

Os invites identificam o papel e não expiram nesta prova. O ticket WebSocket expira em 60 segundos
por padrão e é de uso único.

## WebSocket

Conecte em `/ws/vtt/rooms/{roomId}?ticket=...`. A primeira mensagem é `room.snapshot`, protocolo
1, contendo o papel, a revisão e `state.tokens`. O token inicial usa ID `demo-token` e coordenadas
normalizadas entre 0 e 1.

Movimento enviado pelo cliente:

```json
{"type":"token.move","commandId":"move-1","payload":{"tokenId":"demo-token","x":0.2,"y":0.8}}
```

Broadcast aceito:

```json
{"type":"token.moved","revision":1,"payload":{"tokenId":"demo-token","x":0.2,"y":0.8}}
```

`commandId` torna uma repetição idempotente dentro da sala. `{"type":"ping","commandId":"p1"}`
recebe `pong`. Mensagens inválidas recebem `{"type":"error", ...}` com código estável.
Mensagens WebSocket acima de 16 KiB são rejeitadas antes do parsing.

## Testes

```powershell
pytest
```

Os testes cobrem saúde, autenticação, emissão de tickets, snapshot, ping/pong, validação e
broadcast de movimento entre Mestre e jogador.
