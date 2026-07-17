# C.A.O.S. VTT portatil para Windows

Este pacote roda sem instalar Python, Node.js ou o projeto no computador de destino. Ele nao exige
permissao de administrador, nao instala servicos e nao grava configuracao no Registro do Windows.
O executavel inicia o FastAPI apenas em `127.0.0.1`, serve o frontend ja compilado e abre o
laboratorio VTT no navegador padrao.

## Como usar no computador de destino

1. Extraia todo o ZIP para uma pasta comum. Nao execute o programa de dentro do ZIP.
2. Abra `Iniciar C.A.O.S. VTT.cmd`.
3. Aguarde o navegador abrir em `http://127.0.0.1:8765/vtt-lab`.
4. Copie da janela preta o **Host token temporario** e cole no campo correspondente para criar a
   sala.
5. Mantenha a janela preta aberta durante a sessao. Feche-a para encerrar o servidor.

O token de host e gerado novamente a cada abertura e nunca e salvo em disco. As salas e posicoes
ainda ficam apenas em memoria; fechar o programa apaga a sessao atual. O prototipo nao faz rolagens
automaticas de dados.

Neste estagio, o servidor aceita conexoes apenas do proprio computador. Acesso de jogadores por
outros dispositivos dependera da camada de tunel/rede que sera definida na proxima etapa do VTT.

### Uso com um tunel localhost

O servidor continua preso a `127.0.0.1`; e o processo do tunel que publica a conexao. Depois de
obter a URL HTTPS exata do tunel, inicie o VTT informando essa origem sem caminho, query ou
fragmento:

```powershell
.\CAOS-VTT.exe --public-origin https://sua-mesa.exemplo-tunnel.com
```

Repita `--public-origin URL` somente se houver mais de uma origem legitima. Wildcard (`*`) nao e
aceito. Na interface aberta pela URL publica, altere o campo **URL do servidor** para a propria URL
HTTPS do tunel; `127.0.0.1` no navegador de um jogador apontaria para o computador dele.

## Porta alternativa

Se a porta 8765 ja estiver ocupada, abra o PowerShell dentro da pasta extraida e execute:

```powershell
.\CAOS-VTT.exe --port 8766
```

Depois abra `http://127.0.0.1:8766/vtt-lab` e altere o campo **URL do servidor** para
`http://127.0.0.1:8766`. Use `--no-browser` para impedir a abertura automatica do navegador.

## Como gerar o pacote (computador de desenvolvimento)

O empacotamento precisa ser feito no Windows e herda a arquitetura do Python usado para compilar.
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

O build usa PyInstaller no formato `onedir`, console habilitado e `--noupx`. O formato em pasta evita
a extracao temporaria e os falsos ganhos de portabilidade do modo `onefile`.
