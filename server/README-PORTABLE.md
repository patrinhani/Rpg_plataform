# C.A.O.S. VTT portátil para Windows

O pacote portátil funciona no Windows x64 sem instalar Python, Node.js, serviços ou dependências. Ele não exige administrador, não altera o Registro e mantém o servidor em `127.0.0.1`; o acesso online é feito por uma conexão de saída do Cloudflare Quick Tunnel. Redes restritas precisam permitir a saída TCP ou UDP usada pelo túnel na porta 7844.

## Primeira execução

1. Copie o ZIP para o computador da mesa e extraia **todo** o conteúdo para uma pasta comum.
2. Mantenha juntos `CAOS-VTT.exe`, `_internal`, `campaigns` e `cloudflared.exe`.
3. Abra `Iniciar C.A.O.S. VTT Online.cmd` para uma mesa pela internet ou `Iniciar C.A.O.S. VTT.cmd` para uso apenas neste computador.
4. Aguarde o navegador abrir e copie o **Host token temporário** exibido na janela preta.
5. Na página, informe o nome e o host token, crie a sala e clique em **Conectar como mestre**.
6. Clique em **Copiar link completo para o jogador** e compartilhe somente esse link.

Não execute o programa dentro do ZIP e não feche a janela preta durante a sessão. As rolagens continuam com dados físicos.

## O que o pacote inclui

- frontend VTT dedicado e leve, sem Firebase, bestiário ou módulos da ficha;
- servidor FastAPI e WebSocket compilado em formato PyInstaller `onedir` e sem UPX;
- pack seletivo da campanha Mnemosyne, com mapas ativos, overlays, tokens e guias privados do Mestre;
- `cloudflared.exe` oficial para o launcher online;
- guia rápido, documentação, licença e aviso de terceiro.

Na abertura, o programa verifica tamanho e SHA-256 de todos os assets da campanha antes de aceitar conexões. O jogador recebe somente a cena ativa, os overlays revelados e os tokens visíveis; guias do Mestre e variantes inativas não são expostos.

## Sessão e convites

O host token muda a cada abertura e não é salvo. O link do jogador guarda o convite no fragmento `#` da URL, que não é enviado na requisição e é removido da barra após preencher a tela. O endereço público exibido no console é para o Mestre abrir a interface; compartilhe com jogadores somente o link criado dentro da sala.

Salas, posições, overlays e convites permanecem em memória. Fechar o programa encerra o túnel e apaga o estado da sessão. Guarde o convite de Mestre apenas enquanto a sessão estiver aberta e nunca o envie aos jogadores.

## Modo online

`Iniciar C.A.O.S. VTT Online.cmd` executa `CAOS-VTT.exe --tunnel`. O Quick Tunnel é temporário, gratuito, não exige conta e cria um endereço `https://*.trycloudflare.com` diferente a cada execução. Ele é adequado para mesas pessoais, não oferece SLA e pode ser bloqueado por proxy, política corporativa ou antivírus.

O FastAPI continua preso a `127.0.0.1`; nenhuma porta de entrada do firewall é aberta. O launcher valida a origem HTTPS exata antes de aceitar o WebSocket e encerra o servidor se o processo do túnel cair. Use `--tunnel-timeout SEGUNDOS` para uma espera entre 5 e 180 segundos.

## Modo local e porta alternativa

`Iniciar C.A.O.S. VTT.cmd` não inicia nem contata o Quick Tunnel. O navegador abre em `http://127.0.0.1:8765/vtt-lab` e outros dispositivos não conseguem entrar.

Se a porta 8765 estiver ocupada:

```powershell
.\CAOS-VTT.exe --port 8766
```

Abra `http://127.0.0.1:8766/vtt-lab`. Use `--no-browser` para não abrir o navegador automaticamente.

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

O computador que executará a mesa não precisa desses programas. O build recompila apenas o frontend dedicado `dist-vtt`, gera e valida o pack da campanha, monta tudo em uma área temporária e só substitui o último artefato válido após concluir.

Resultados:

- `server\.artifacts\portable\CAOS-VTT\`
- `server\.artifacts\CAOS-VTT-portable-win.zip`
- `server\.artifacts\CAOS-VTT-portable-win.zip.sha256`

Opções úteis:

- `-SkipTunnel`: pacote local sem `cloudflared.exe`;
- `-SkipCampaign`: build de demonstração explicitamente marcado, sem Mnemosyne;
- `-SkipArchive`: gera somente a pasta portátil;
- `-SkipFrontendBuild`: reutiliza `dist-vtt` somente se estiver atualizado e isolado.
- `-MaxCampaignBytes N`: altera conscientemente o teto do pack em bytes.

Também é possível definir `CAOS_VTT_CAMPAIGN_ROOT`. O build aceita até 512 MiB por padrão e mostra o peso verificado; `-MaxCampaignBytes` permite acompanhar campanhas maiores sem um teto escondido. A trava existe apenas para detectar crescimento acidental. O build exige que o manifesto versionado corresponda à campanha atual; se o teste de atualização falhar, regenere o manifesto, revise o diff e execute novamente. A fonte original da campanha é apenas lida e não é alterada.

O build online fixa o `cloudflared` Windows AMD64 2026.7.2 e confere o SHA-256 `cdb5d4432f6ae1595654a692a51308b69d2bf7af961f5578d9391837cf072df9`. A licença Apache 2.0 e o aviso de terceiro acompanham o pacote.
