# C.A.O.S. VTT portatil para Windows

Este pacote roda sem instalar Python, Node.js ou o projeto no computador de destino. Ele nao exige
permissao de administrador, nao instala servicos e nao grava configuracao no Registro do Windows.
O executavel inicia o FastAPI apenas em `127.0.0.1`, serve o frontend ja compilado e abre o
laboratorio VTT no navegador padrao.

## Modo online de um clique

1. Extraia todo o ZIP para uma pasta comum. Nao execute o programa de dentro do ZIP.
2. Abra `Iniciar C.A.O.S. VTT Online.cmd`.
3. Aguarde o navegador abrir em `http://127.0.0.1:8765/vtt-lab`.
4. Copie da janela preta a **URL PARA COMPARTILHAR** e envie aos jogadores.
5. Copie o **Host token temporario** e cole no campo correspondente para criar a
   sala.
6. Mantenha a janela preta aberta durante a sessao. Feche-a para encerrar servidor e tunel.

O token de host e gerado novamente a cada abertura e nunca e salvo em disco. As salas e posicoes
ainda ficam apenas em memoria; fechar o programa apaga a sessao atual. O prototipo nao faz rolagens
automaticas de dados.

`CAOS-VTT.exe --tunnel` inicia o `cloudflared.exe` incluido, captura apenas uma origem exata
`https://*.trycloudflare.com`, autoriza essa origem antes de iniciar o WebSocket e mantem o FastAPI
preso a `127.0.0.1`. O programa nao exibe os logs de requisicao do cloudflared, portanto tickets e
convites nao sao escritos no console pelo launcher.

O Cloudflare Quick Tunnel e temporario, gratuito, nao exige conta e muda de endereco a cada
execucao. Ele suporta WebSocket, nao possui SLA e tem limite documentado de 200 requisicoes
simultaneas/em voo. E indicado para mesas pessoais e testes, nao para hospedagem permanente.

Ao usar o modo online, voce aceita os termos aplicaveis da Cloudflare, incluindo os
[Website Terms](https://www.cloudflare.com/website-terms/) e os termos especificos do servico.
Firewall corporativo, proxy, antivirus ou politica de rede podem bloquear a conexao de saida do
cloudflared; nesse caso o launcher encerra com timeout e uma mensagem clara. Use
`--tunnel-timeout SEGUNDOS` para ajustar a espera entre 5 e 180 segundos.

O `cloudflared.exe` oficial e validado pelo hash fixo antes do empacotamento. O `CAOS-VTT.exe`
gerado por PyInstaller ainda nao possui assinatura Authenticode e pode receber alerta do
SmartScreen ou de antivirus com politica restritiva. Nao desative a protecao do computador;
confira o SHA-256 do ZIP ou use a variante Python/local ate que o executavel seja assinado.

## Modo somente local

Abra `Iniciar C.A.O.S. VTT.cmd` para nao contatar o Quick Tunnel. O navegador abre localmente em
`http://127.0.0.1:8765/vtt-lab` e nenhum outro computador consegue entrar.

### Tunel externo configurado manualmente

O servidor continua preso a `127.0.0.1`; e o processo do tunel que publica a conexao. Depois de
obter a URL HTTPS exata do tunel, inicie o VTT informando essa origem sem caminho, query ou
fragmento:

```powershell
.\CAOS-VTT.exe --public-origin https://sua-mesa.exemplo-tunnel.com
```

Repita `--public-origin URL` somente se houver mais de uma origem legitima. Wildcard (`*`) nao e
aceito. Essa opcao apenas autoriza uma origem existente; ela nao inicia o processo de tunel.

## Porta alternativa

Se a porta 8765 ja estiver ocupada, abra o PowerShell dentro da pasta extraida e execute:

```powershell
.\CAOS-VTT.exe --port 8766
```

Depois abra `http://127.0.0.1:8766/vtt-lab` e altere o campo **URL do servidor** para
`http://127.0.0.1:8766`. Use `--no-browser` para impedir a abertura automatica do navegador.

## Como gerar o pacote (computador de desenvolvimento)

O empacotamento online precisa ser feito no Windows x64 e herda a arquitetura do Python usado para
compilar.
Na raiz do repositorio:

```powershell
.\scripts\bootstrap-dev.ps1 -SkipFrontend
.\.venv-vtt\Scripts\python.exe -m pip install -r .\server\requirements-build.txt
.\scripts\build-portable.ps1
```

O script sempre recompila o frontend antes de empacotar. Para reutilizar conscientemente um `dist`
ja atualizado, use `-SkipFrontendBuild`. Esse atalho compara os bundles referenciados por
`dist/index.html` com `src`, `public`, `package.json`, `package-lock.json`, `index.html` e
`vite.config.*`; ele interrompe o processo se qualquer fonte estiver mais nova. Os resultados ficam
em:

- `server\.artifacts\portable\CAOS-VTT\` (pasta executavel);
- `server\.artifacts\CAOS-VTT-portable-win.zip` (arquivo para transporte);
- `server\.artifacts\CAOS-VTT-portable-win.zip.sha256` (hash de verificacao).

Por padrao, o build inclui o `cloudflared` oficial Windows AMD64 2026.7.2. Somente no computador de
desenvolvimento, se o binario ainda nao existir no cache, o script baixa o release oficial e exige
o SHA-256 `cdb5d4432f6ae1595654a692a51308b69d2bf7af961f5578d9391837cf072df9` antes de copia-lo. A
licenca Apache 2.0 e o aviso de terceiro acompanham o pacote. O computador da mesa nao baixa nem
instala o cloudflared.

Para gerar uma variante menor estritamente local, use:

```powershell
.\scripts\build-portable.ps1 -SkipTunnel
```

Essa variante gera `CAOS-VTT-portable-local-win.zip`, sem `cloudflared.exe` e sem o launcher online.

O build usa PyInstaller no formato `onedir`, console habilitado e `--noupx`. O formato em pasta evita
a extracao temporaria e os falsos ganhos de portabilidade do modo `onefile`.
