# C.A.O.S. VTT portátil para Windows

O pacote portátil funciona no Windows x64 sem instalar Python, Node.js, serviços ou dependências. Ele não exige administrador, não altera o Registro e mantém o servidor em `127.0.0.1`; o acesso online é feito por uma conexão de saída do Cloudflare Quick Tunnel. Redes restritas precisam permitir a saída TCP ou UDP usada pelo túnel na porta 7844.

## Primeira execução

1. Copie o ZIP para o computador da mesa e extraia **todo** o conteúdo para uma pasta comum.
2. Mantenha juntos `CAOS-VTT.exe`, `_internal`, `campaigns`, `FIREBASE-PROJECT.txt` e `cloudflared.exe`.
3. Abra `Iniciar C.A.O.S. VTT Online.cmd` para uma mesa pela internet ou `Iniciar C.A.O.S. Portatil.bat` para uso apenas neste computador.
4. Se abrir pelo botão de uma Mesa no sistema, o autor entra como Mestre e os convidados entram como jogadores automaticamente; não é preciso copiar chaves.
5. Se abrir diretamente a página portátil isolada, use o **Host token de fallback** exibido na janela preta, crie a sala e compartilhe somente o link de jogador gerado por ela.

Não execute o programa dentro do ZIP e não feche a janela preta durante a sessão. As rolagens continuam com dados físicos.

## O que o pacote inclui

- frontend VTT dedicado e leve, sem bestiário ou módulos da ficha; a autorização integrada usa um grant descartável criado pela sessão autenticada e validado pelas regras do Firestore;
- servidor FastAPI e WebSocket compilado em formato PyInstaller `onedir` e sem UPX;
- pack seletivo da campanha Mnemosyne, com mapas ativos, overlays, tokens, objetos de cenário, handouts e guias privados do Mestre;
- `cloudflared.exe` oficial para o launcher online;
- `FIREBASE-PROJECT.txt`, com somente o identificador público necessário ao acesso autenticado da Mesa;
- guia rápido, documentação, licença e aviso de terceiro.

Na abertura, o programa verifica tamanho e SHA-256 de todos os assets da campanha antes de aceitar conexões. O jogador recebe somente o estado autorizado da cena ativa; guias do Mestre e variantes inativas não são expostos.

## Acesso pela Mesa e fallback isolado

`FIREBASE-PROJECT.txt` contém apenas o project ID público do Firebase — nunca uma API key, conta de serviço ou segredo. Quando ele corresponde ao projeto do sistema hospedado, a sessão autenticada cria no Firestore um grant aleatório de cinco minutos. As regras confirmam a participação e derivam o papel: quem criou a Mesa é Mestre e os demais membros são jogadores. O VTT consulta somente esse grant de uso único; ele nunca recebe o ID token Firebase, e o papel não é aceito da URL nem escolhido livremente pelo cliente.

O host token e os convites continuam disponíveis somente como fallback para abrir o frontend portátil isolado. Nesse modo, o host token muda a cada abertura e não é salvo. O link do jogador guarda o convite no fragmento `#` da URL, que não é enviado na requisição e é removido da barra após preencher a tela. O endereço público exibido no console é para o Mestre abrir a interface; compartilhe com jogadores somente o link criado dentro da sala.

O estado fica em `data\caos-vtt-state.sqlite3`, ao lado de `CAOS-VTT.exe`. Sala, cena ativa, posições de tokens, objetos de cenário, overlays, regiões vetoriais de fog e handouts entregues sobrevivem ao fechamento do programa. Tickets e grants de mídia não são recuperados.

Uma sala integrada é recuperada automaticamente pelo ID da Mesa. O servidor mantém o mesmo `roomId` e o estado salvo, mas recusa convites manuais. O grant expira em cinco minutos e o navegador o renova a cada quatro minutos; quem sair da Mesa ou mudar de papel não consegue emitir a próxima autorização. Desafios, grants, tickets e tokens de mídia ficam somente em memória e nunca são gravados no banco local. Salas criadas diretamente no frontend portátil continuam isoladas e usam seus próprios convites de fallback. Para transportar ou fazer backup das sessões, copie também a pasta `data` com o programa fechado.

## Fog of war e objetos de cenário

O fog começa **ligado e totalmente fechado** em todas as cenas. O Mestre desenha salas e setores com polígonos ajustáveis e pode revelá-los ou ocultá-los individualmente, fechar tudo, revelar tudo ou desligar o fog conscientemente. Durante a sessão, o modo de controle permite alternar uma região com um clique. Se o mapa ativo da cena mudar entre versões da campanha, as regiões anteriores são descartadas e a visão volta a ficar fechada para evitar revelações acidentais.

Com o fog ligado, mapa, camadas e overlays são compostos no navegador sob uma máscara SVG. O servidor não cria bitmaps temporários e mantém apenas polígonos e estados booleanos, reduzindo o uso de memória. Tokens e objetos fora das regiões reveladas não entram no snapshot do jogador. Essa proteção é visual: o mapa-base é enviado ao navegador para a composição local. Os objetos de cenário são independentes dos tokens e podem ser posicionados, redimensionados, girados e ocultados. Quando o manifesto define estados, o Mestre pode alternar somente entre visuais do mesmo objeto, como ativo/desativado ou ritual/recuperado; objetos sem estados continuam editáveis, mas não podem virar outro asset por engano.

## Handouts

O Mestre gerencia e entrega as evidências na própria **Mesa**, fora do tabuleiro VTT. Os jogadores consultam o material recebido em **Ficha > Diário**, junto das anotações da investigação. O arquivo não aparece nem pode ser baixado antes da entrega, e a entrega independe da cena atual e do fog. **Recolher** bloqueia novos acessos e remove o documento das fichas dos jogadores; não é possível apagar cópias ou capturas feitas antes do recolhimento. A primeira versão entrega para a sala inteira, inclusive jogadores que entrarem depois; entrega individual e temporária podem ser adicionadas futuramente.

Referências exclusivas do Mestre aparecem apenas no painel privado da Mesa e não oferecem a ação **Entregar**. Seus metadados e bytes nunca são enviados ao jogador; na campanha Mnemosyne isso preserva a referência `10d` usada para alinhar os circuitos sem transformá-la em pista pública.

## Modo online

O fluxo recomendado é abrir o VTT pelo botão da própria Mesa no sistema hospedado. Edite `ORIGEM-WEB.txt` uma vez e substitua o exemplo pela origem HTTPS exata do seu app, sem barra ou caminho, como `https://seu-projeto.vercel.app`. Confirme também que `FIREBASE-PROJECT.txt` contém somente o project ID desse mesmo Firebase. Depois inicie o modo online, abra o VTT pela Mesa e informe o endereço `https://*.trycloudflare.com` mostrado no console como servidor da Mesa quando solicitado. O launcher autoriza apenas a origem configurada; valores malformados continuam sendo recusados pelo executável.

Antes de publicar esta versão do frontend ou do VTT, implante também o arquivo `firestore.rules` do mesmo commit (`firebase deploy --only firestore:rules`). Sem essas regras, o Firestore recusará a criação do grant integrado.

Também é possível usar a página aberta pelo próprio endereço `trycloudflare`; por ser o frontend portátil isolado, ela usa o host token e os convites de fallback. Isso é útil para uma sessão sem integração com o restante do sistema.

`Iniciar C.A.O.S. VTT Online.cmd` executa `CAOS-VTT.exe --tunnel`. O Quick Tunnel é temporário, gratuito, não exige conta e cria um endereço `https://*.trycloudflare.com` diferente a cada execução. Ele é adequado para mesas pessoais, não oferece SLA e pode ser bloqueado por proxy, política corporativa ou antivírus.

O FastAPI continua preso a `127.0.0.1`; nenhuma porta de entrada do firewall é aberta. O launcher valida a origem HTTPS exata antes de aceitar o WebSocket e encerra o servidor se o processo do túnel cair. Use `--tunnel-timeout SEGUNDOS` para uma espera entre 5 e 180 segundos.

## Modo local e porta alternativa

`Iniciar C.A.O.S. VTT.cmd` não inicia nem contata o Quick Tunnel. O navegador abre em `http://127.0.0.1:8765/vtt-lab` e outros dispositivos não conseguem entrar.

Se a porta 8765 estiver ocupada:

```powershell
.\CAOS-VTT.exe --port 8766
```

Abra `http://127.0.0.1:8766/vtt-lab`. Use `--no-browser` para não abrir o navegador automaticamente.

Para guardar as sessões em outro caminho, use:

```powershell
.\CAOS-VTT.exe --state-db "D:\Mesa\caos-vtt-state.sqlite3"
```

O console sempre mostra o caminho efetivo em `Sessoes salvas em:`.

Para um túnel externo já configurado, autorize somente sua origem HTTPS exata:

```powershell
.\CAOS-VTT.exe --public-origin https://sua-mesa.exemplo-tunnel.com
```

Essa opção não inicia o túnel. Wildcards, HTTP, caminhos, query e fragmentos são recusados.

## SmartScreen, antivírus e integridade

O `cloudflared.exe` incluído é o binário oficial, tem assinatura Authenticode válida e é conferido no build pelo SHA-256 fixo. O `CAOS-VTT.exe` é gerado localmente por PyInstaller e ainda não possui assinatura de código; por isso o SmartScreen ou um antivírus com política restritiva pode pedir confirmação.

Não desative a proteção do computador. Obtenha o ZIP e o arquivo `.sha256` juntos e confira no PowerShell:

```powershell
(Get-FileHash .\CAOS-VTT-portable-win.zip -Algorithm SHA256).Hash.ToLower()
Get-Content .\CAOS-VTT-portable-win.zip.sha256
```

Os valores devem ser iguais. Essa comparação detecta corrupção ou troca acidental; para verificar a origem, obtenha o valor esperado também por um canal confiável e independente, como o commit ou release oficial. Se o executável for bloqueado pela política do dispositivo, use o modo de desenvolvimento Python local até que exista uma versão assinada.

## Gerar o pacote em outro computador de desenvolvimento

Pré-requisitos apenas para compilar: Windows x64, Git, Node.js 20.19+ (ou 22.12+) e Python 3.10+. Na raiz do repositório:

```powershell
.\scripts\bootstrap-dev.ps1
.\.venv-vtt\Scripts\python.exe -m pip install -r .\server\requirements-build.txt
.\scripts\build-portable.ps1 -CampaignRoot "F:\RPG\mnemosyne\projeto-mnemosyne-rpg"
```

O build procura somente `VITE_APP_PROJECT_ID` em `.env.local` e grava seu valor público em `FIREBASE-PROJECT.txt`; nenhuma outra variável é copiada para o pacote. Para substituir explicitamente, use `-FirebaseProjectId seu-project-id`. Se nenhum ID for encontrado, o pacote ainda funciona pelo fallback manual isolado.

O computador que executará a mesa não precisa desses programas. O build recompila apenas o frontend dedicado `dist-vtt`, gera e valida o pack da campanha, monta tudo em uma área temporária e só substitui o último artefato válido após concluir.

Resultados:

- `server\.artifacts\portable\CAOS-VTT\`
- `server\.artifacts\CAOS-VTT-portable-win.zip`
- `server\.artifacts\CAOS-VTT-portable-win.zip.sha256`

O ZIP e o hash sempre usam esses nomes estáveis. Se o Explorer, um terminal ou outro processo mantiver a pasta `portable` anterior aberta, o build a preserva e instala a nova pasta como `portable-<id>\CAOS-VTT`; feche o processo que usa a versão antiga antes do build seguinte para recuperar também o caminho estável da pasta.

Opções úteis:

- `-SkipTunnel`: pacote local sem `cloudflared.exe`;
- `-SkipCampaign`: build de demonstração explicitamente marcado, sem Mnemosyne;
- `-SkipArchive`: gera somente a pasta portátil e não preserva o ZIP nem o `.sha256` anteriores da mesma variante; ambos são removidos para não parecer que correspondem à pasta recém-gerada;
- `-SkipFrontendBuild`: reutiliza `dist-vtt` somente se estiver atualizado e isolado.
- `-MaxCampaignBytes N`: altera conscientemente o teto do pack em bytes.
- `-FirebaseProjectId ID`: define explicitamente o projeto Firebase público usado pela integração com a Mesa.

Também é possível definir `CAOS_VTT_CAMPAIGN_ROOT`. O build aceita até 512 MiB por padrão e mostra o peso verificado; `-MaxCampaignBytes` permite acompanhar campanhas maiores sem um teto escondido. A trava existe apenas para detectar crescimento acidental. O build exige que o manifesto versionado corresponda à campanha atual; se o teste de atualização falhar, regenere o manifesto, revise o diff e execute novamente. A fonte original da campanha é apenas lida e não é alterada.

### Atualizar a campanha em crescimento

Quando novos arquivos entrarem na Mnemosyne, regenere o manifesto, valide o pack e revise o diff antes do build:

```powershell
.\scripts\update-campaign-manifest.ps1 -CampaignRoot "F:\RPG\mnemosyne\projeto-mnemosyne-rpg"
git diff -- tools/campaign_manifest/generated/mnemosyne.manifest.json
.\scripts\build-portable.ps1 -CampaignRoot "F:\RPG\mnemosyne\projeto-mnemosyne-rpg"
```

O script de atualização apenas lê a campanha original, grava o manifesto versionado no projeto e executa a validação seletiva imediatamente.

O build online fixa o `cloudflared` Windows AMD64 2026.7.2 e confere o SHA-256 `cdb5d4432f6ae1595654a692a51308b69d2bf7af961f5578d9391837cf072df9`. A licença Apache 2.0 e o aviso de terceiro acompanham o pacote.
