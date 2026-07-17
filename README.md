# Sistema C.A.O.S.

**Controle de Agentes e Ocorrências Sobrenaturais** é uma plataforma para gerenciar fichas e mesas de Ordem Paranormal RPG.

O projeto auxilia nos cálculos e no acompanhamento da ficha, mas as rolagens são feitas com dados físicos.

## Funcionalidades

- Fichas de agentes com PV, PE, SAN, Defesa, perícias e carga.
- Inventário, modificações, rituais, poderes e progressão.
- Diário e ações de interlúdio.
- Mesas com participantes, criaturas e iniciativa compartilhada.
- Bestiário integrado.
- Exportação da ficha em JSON e PDF.
- Sincronização e autenticação pelo Firebase.

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

# Terminal 2 — backend na porta 8765
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-backend.ps1
```

O script do backend executa `python -m caos_vtt` a partir de `server/`. Ele gera um host token temporário, mostra o valor no terminal e não grava o segredo em disco. Use `-Port 9000` para trocar a porta ou `-AllowedOrigins "https://seu-app.vercel.app"` para autorizar outro frontend.

Comandos de verificação:

```bash
npm run lint
npm test
npm run build
npm run check
```

O comando `npm run check` executa lint, testes e build em sequência.

## Tecnologias

- React
- Vite
- Firebase Authentication e Firestore
- GSAP e Three.js
- CSS responsivo com temas visuais

## Estado

Projeto em desenvolvimento. As regras oficiais e opcionais serão organizadas em etapas futuras, preservando a liberdade para regras da mesa.
