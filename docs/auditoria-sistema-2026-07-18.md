# Auditoria técnica do C.A.O.S.

Data: 18/07/2026

Projeto auditado: `F:\Projetos\Rpg_plataform`

Branch: `codex/vtt-mvp`
Commit da integração de evidências: `c816dd3`

Atualização de segurança: 19/07/2026 — o achado P0 do ID token foi corrigido na
branch `codex/vtt-mvp`. A sessão Firebase continua definindo a identidade, mas o
servidor VTT recebe somente um grant aleatório, curto e vinculado à Mesa.

## Resumo executivo

O projeto tem uma base técnica melhor do que a média para um sistema pessoal/portátil: mantém o backend em loopback, restringe origens, usa credenciais efêmeras, limita mensagens e entidades, protege mídia, valida caminhos e hashes da campanha, persiste o VTT de forma atômica e possui boa cobertura de regras determinísticas e do backend.

O bloqueador original de segurança foi removido: o navegador não envia mais o ID token Firebase ao endereço VTT controlado pelo Mestre. As regras do Firestore transformam a sessão autenticada em uma capacidade curta e restrita à Mesa; o VTT consome essa capacidade uma única vez e deriva dela seus próprios tickets efêmeros.

Também há lacunas relevantes em funcionamento offline, testes reais das regras Firestore, conflitos de edição simultânea, proteção operacional e recuperação de falhas do frontend.

## Evidências de validação

- `npm run lint`: aprovado.
- `npm test`: 85 aprovados, 0 falhas.
- suíte Python completa, incluindo backend, manifesto e pack: 176 aprovados e 3 pulados.
- `npm run build`: aprovado.
- `npm run build:vtt`: aprovado.
- `npm audit --omit=dev`: 0 vulnerabilidades conhecidas.
- `npm audit`: 0 vulnerabilidades conhecidas nas 293 dependências contabilizadas.
- `pip check`: nenhuma dependência Python quebrada.
- busca em arquivos versionados: nenhum segredo evidente, chave privada, `.env`, banco SQLite ou binário `cloudflared.exe` versionado.
- validação visual automatizada: não executada porque o controlador interno do navegador não inicializou neste ambiente. Esta pendência impede considerar a aprovação visual/mobile concluída.

## Achados priorizados

### P0 corrigido — ID token Firebase não é mais enviado ao servidor do Mestre

Implementação de 19/07/2026:

1. O VTT emite um desafio aleatório de uso único, válido por dois minutos.
2. A sessão Firebase grava `vttAccessGrants/{challenge}` pelo SDK confiável do navegador.
3. `firestore.rules` confirma `uid`, participação e Mesa; `mesa.mestre` produz `master` e qualquer outro membro válido produz `player`.
4. O backend lê anonimamente apenas o documento de capacidade imprevisível, sem cabeçalho Firebase, e o vincula ao desafio pendente.
5. O grant e toda a sessão derivada expiram em cinco minutos; o navegador renova aos quatro. Quem saiu da Mesa não consegue criar a próxima autorização.
6. Desafios, tickets, grants de mídia e sessões continuam apenas em memória e não entram no SQLite.

Cobertura adicionada para falsificação de papel, replay, Mesa divergente, expiração, relógio futuro, falhas do Firestore, fechamento do WebSocket e ausência de ID token no fluxo integrado.

O trecho abaixo registra o risco histórico que motivou a correção.

Fluxo atual:

1. O Mestre grava `mesa.vtt.serverOrigin` no Firestore.
2. O jogador lê essa origem da Mesa.
3. `VttLabIntegrated` e `useMesaHandouts` obtêm `usuario.getIdToken(true)`.
4. O token é enviado no cabeçalho `Authorization` para `${serverOrigin}/api/vtt/mesa-access`.

Arquivos envolvidos:

- `src/features/vtt-lab/VttLabIntegrated.jsx`
- `src/features/vtt-handouts/useMesaHandouts.js`
- `src/lib/vtt-mesa-link.js`
- `src/lib/vtt-link.js`
- `server/caos_vtt/firestore_auth.py`

HTTPS, CORS, Quick Tunnel e validação do Firebase no backend oficial não eliminam o risco: o Mestre controla o computador/servidor final e pode executar um backend modificado que registre o bearer token. Esse token é válido para o projeto Firebase, não somente para a Mesa, e pode permitir acesso às fichas pessoais e a outras Mesas do jogador conforme as regras Firestore.

Recomendação estrutural:

- criar um endpoint first-party confiável no domínio do sistema (por exemplo, função serverless do Vercel/Cloudflare Worker);
- o navegador envia o ID token Firebase apenas a esse endpoint confiável;
- o endpoint verifica identidade e participação e emite uma credencial assinada com `mesaId`, `uid`, `role`, `audience/serverId`, nonce e expiração de 60–120 segundos;
- o VTT recebe somente essa credencial restrita e valida a assinatura pública offline;
- o VTT nunca recebe nem armazena o ID token Firebase;
- tickets WebSocket e grants de mídia continuam derivados em memória como hoje.

A troca foi concluída. A implantação precisa publicar `firestore.rules` junto com o frontend/backend; sem isso o novo grant será negado. O merge na `main` ainda deve aguardar a validação funcional/manual combinada com o responsável pelo projeto.

### P1 — “Offline” não sobrevive a fechar ou recarregar a página

`src/lib/firebase.js` usa `getFirestore(app)` sem cache persistente. O estado React e a fila em memória permitem continuar durante uma queda com a página já aberta, mas as anotações não ficam garantidamente disponíveis após fechar/reabrir o navegador sem rede. O carregamento inicial do perfil também depende de `getDoc`, podendo bloquear a entrada offline.

Recomendação:

- inicializar Firestore com cache persistente e coordenação entre abas compatível com o SDK atual;
- tratar explicitamente o caso de cache indisponível/privado;
- guardar o mínimo de perfil necessário para liberar a UI offline;
- mostrar estado “local pendente”, “sincronizando” e “sincronizado”;
- testar fechar, reabrir e editar ficha/Diário sem rede.

### P1 — Regras Firestore não têm testes comportamentais

`tests/firestore-rules-security.test.js` confirma trechos por expressão regular, mas não executa as regras. Isso não prova que consultas, updates concorrentes e negações funcionem como esperado.

Recomendação:

- adicionar Firebase Emulator Suite e `@firebase/rules-unit-testing`;
- testar matriz Mestre/jogador/não membro/não autenticado;
- testar criação, adesão cega, remoção, leitura/listagem e fichas da Mesa;
- testar documentos legados e estruturas malformadas;
- incluir os testes no CI.

### P1 — Usuário não verificado continua autorizado pelas regras

A interface bloqueia e-mail não verificado, mas `firestore.rules` considera suficiente `request.auth != null`. Um cliente fora da interface pode criar/entrar em Mesas e acessar documentos permitidos antes da verificação do e-mail.

Recomendação: decidir formalmente se a verificação é requisito de segurança. Se for, exigir o claim correspondente nas regras e cobrir provedores que não usam e-mail.

### P1 — Sem cabeçalhos de segurança no deploy web

`vercel.json` define apenas o rewrite SPA. Não há política explícita para CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` ou proteção de framing.

Recomendação: adicionar cabeçalhos de forma incremental e testada. A CSP precisa considerar Firebase, Google Auth e os endpoints/túneis VTT; `Cross-Origin-Opener-Policy` deve ser validado com login por popup antes de ser ativado.

### P1 — Sem limitação de taxa no endpoint público de autenticação

O backend limita desafios pendentes, tickets e grants por sala, mas `/api/vtt/mesa-challenges` e `/api/vtt/mesa-access` ainda podem receber tentativas repetidas. Cada grant válido provoca trabalho de rede no Firestore. Em Quick Tunnel público isso permite consumo de CPU/rede e indisponibilidade local.

Recomendação: limite por IP/origem/mesa com janela curta, limite global de concorrência e respostas uniformes; manter os limites internos já existentes.

### P2 — Edição simultânea pode sobrescrever alterações

`Ficha/index.jsx` salva o objeto completo com debounce e `setDoc(..., { merge: true })`. Mestre e jogador com a mesma ficha aberta, ou duas abas, podem produzir last-write-wins e perder campos alterados remotamente. Várias operações de iniciativa em `src/lib/mesas.js` também fazem read-modify-write fora de transações.

Recomendação:

- salvar patches por seção/campo ou usar transações com versão do documento;
- detectar conflito e informar o usuário;
- transformar todas as mutações de iniciativa em transações;
- criar teste de duas abas/clientes concorrentes.

### P2 — Exclusões podem ficar parciais

`excluirMesaCompleta` apaga personagens em paralelo e depois o documento pai. Uma falha intermediária pode deixar remoção parcial; futuras subcoleções também não seriam removidas automaticamente.

Recomendação: usar backend/Cloud Function para exclusão recursiva idempotente, registrar progresso e permitir repetição segura.

### P2 — Frontend não possui Error Boundary global

Não foi encontrado Error Boundary nem tratamento global de rejeições. Uma exceção de renderização pode deixar a aplicação em branco sem ação de recuperação.

Recomendação: adicionar limite de erro por rota, tela de recuperação, recarregamento seguro e diagnóstico sem dados sensíveis.

### P2 — Falta CI e cobertura de integração visual

Não há workflow versionado de CI. Os testes atuais cobrem bem funções puras e backend, mas não montam os componentes React nem exercitam o fluxo real Firebase → Mesa → Ficha → Diário → VTT.

Recomendação:

- CI com lint, testes JS, testes Python, regras no emulador e builds web/VTT;
- testes de componentes para modais, Diário e evidências;
- E2E com Mestre e jogador em contextos isolados;
- matriz desktop/mobile e cinco temas;
- regressão visual para transições elementais e tabuleiro.

### P2 — Bundle e monólitos aumentam custo de manutenção

O build é válido, mas há chunks grandes (Firebase com 565,71 kB bruto/168,60 kB gzip) e arquivos monolíticos: `database.js`, `convergence.css`, `VttLab.jsx`, `VttBoard.jsx`, `Mesa/index.jsx`, `Ficha/index.jsx` e `service.py`.

Recomendação:

- medir carregamento em aparelho móvel real antes de otimizar;
- dividir dados/regras por domínio e carregar bestiário/conteúdo sob demanda;
- separar sessão, comandos, renderização de fog, persistência e projeção de snapshots no backend;
- separar containers de dados e componentes de apresentação no frontend.

### P3 — Consistência e documentação

- `README.md` ainda descreve handouts como recurso do VTT sem deixar tão claro que a gestão ocorre na Mesa e a consulta no Diário.
- Há comentários antigos de correção/placeholder em `src/lib/mesas.js` que reduzem a clareza.
- O painel novo usa `window.confirm`, enquanto o restante do sistema possui diálogo próprio.
- O comando Python documentado a partir da raiz falha sem ajustar o diretório/import path; a execução a partir de `server` funciona.

Recomendação: limpar comentários, alinhar documentação, padronizar diálogos e fornecer um script único de verificação completa.

## Pontos fortes confirmados

- Nenhuma rolagem automática foi introduzida; o sistema preserva dados físicos.
- Requisitos flexíveis da mesa continuam orientativos.
- Trava de tema/afinidade e assets originais foram preservados.
- Backend preso a loopback e Quick Tunnel somente de saída.
- CORS usa origens explícitas e WebSocket valida `Origin`.
- Tickets são de uso único; tokens/grants ficam em memória e têm capacidade limitada.
- Tokens são comparados por digest/tempo constante e não entram em logs de acesso.
- ID token Firebase não é recebido pelo VTT; os grants curtos e desafios também não são serializados no SQLite.
- Mensagens WebSocket, tokens, props, caches de fog e mídia têm limites.
- Fog do jogador é composto no servidor e não expõe camadas brutas.
- Mídia usa `no-store`, `nosniff`, CSP restritiva e tipos permitidos.
- Catálogo valida paths, audiência, tamanho e SHA-256.
- Cloudflared é fixado por versão e SHA-256 no empacotamento.
- SQLite usa WAL, gravações atômicas e quarentena recuperável de corrupção.
- O pack portátil possui teto configurável e instalação transacional.
- O projeto passou em lint, build, auditoria npm e 293 testes Python/JavaScript principais somados.

## Ordem sugerida de execução

1. Implantar e testar no Firebase Emulator a nova regra de grants e decidir a política de e-mail verificado.
2. Implementar cache offline persistente e estratégia de conflitos.
3. Adicionar rate limit, headers de deploy e Error Boundary.
4. Criar CI e E2E Mestre/jogador com mobile e cinco temas.
5. Corrigir concorrência/exclusões e só depois modularizar por manutenção/performance.

## Estado da entrega de evidências

- UI antiga de Handouts removida do tabuleiro sem remover backend, persistência ou proteção de mídia.
- Mestre gerencia evidências na Mesa.
- Jogador consulta em Ficha → Diário.
- Evidências ficam separadas de anotações editáveis.
- Ficha pessoal fora de Mesa não recebe a sessão de evidências.
- Commit local: `c816dd3`.
- Branch de trabalho: `codex/vtt-mvp`.
- Merge em `main`: aguarda validação funcional/manual e decisão explícita do responsável; o P0 técnico foi corrigido.
