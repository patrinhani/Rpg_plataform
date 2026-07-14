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

Requisitos: Node.js e npm.

```bash
npm install
npm run dev
```

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
