[CmdletBinding()]
param(
    [switch]$SkipFrontendBuild,
    [switch]$SkipArchive
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$FailureMessage
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage (codigo de saida: $LASTEXITCODE)."
    }
}

function Remove-SafeTreeItem {
    param([Parameter(Mandatory = $true)][System.IO.FileSystemInfo]$Item)

    if (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        # Remove somente o link/junction; nunca percorra seu destino.
        Remove-Item -LiteralPath $Item.FullName -Force
        return
    }

    if ($Item.PSIsContainer) {
        foreach ($child in @(Get-ChildItem -LiteralPath $Item.FullName -Force)) {
            Remove-SafeTreeItem -Item $child
        }
    }
    Remove-Item -LiteralPath $Item.FullName -Force
}

function Remove-SafeDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$ExpectedParent
    )

    $resolvedPath = [IO.Path]::GetFullPath($Path)
    $resolvedParent = [IO.Path]::GetFullPath($ExpectedParent).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if (-not $resolvedPath.StartsWith($resolvedParent, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Remocao recusada fora da pasta de build: '$resolvedPath'."
    }
    if (Test-Path -LiteralPath $resolvedPath) {
        Remove-SafeTreeItem -Item (Get-Item -LiteralPath $resolvedPath -Force)
    }
}

function Assert-FrontendBuildIsFresh {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$FrontendDist
    )

    $sourceDirectory = Join-Path $RepoRoot 'src'
    $distIndex = Join-Path $FrontendDist 'index.html'
    if (-not (Test-Path -LiteralPath $sourceDirectory -PathType Container)) {
        throw "A pasta de fontes do frontend nao foi encontrada em '$sourceDirectory'."
    }
    if (-not (Test-Path -LiteralPath $distIndex -PathType Leaf)) {
        throw "O frontend compilado nao contem '$distIndex'."
    }

    $sourceFiles = @(Get-ChildItem -LiteralPath $sourceDirectory -Recurse -File)
    foreach ($requiredName in @('package.json', 'package-lock.json', 'index.html')) {
        $requiredPath = Join-Path $RepoRoot $requiredName
        if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
            throw "Arquivo necessario para validar o frontend nao encontrado: '$requiredPath'."
        }
        $sourceFiles += Get-Item -LiteralPath $requiredPath
    }

    $viteConfigs = @(
        Get-ChildItem -LiteralPath $RepoRoot -File |
            Where-Object { $_.Name -like 'vite.config.*' }
    )
    if ($viteConfigs.Count -eq 0) {
        throw "Nenhum arquivo vite.config.* foi encontrado em '$RepoRoot'."
    }
    $sourceFiles += $viteConfigs

    $publicDirectory = Join-Path $RepoRoot 'public'
    if (Test-Path -LiteralPath $publicDirectory -PathType Container) {
        $sourceFiles += @(Get-ChildItem -LiteralPath $publicDirectory -Recurse -File)
    }

    $latestSource = $sourceFiles | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    if (-not $latestSource) {
        throw 'Nenhum arquivo-fonte foi encontrado para validar a atualidade do frontend.'
    }

    $distHtml = Get-Content -LiteralPath $distIndex -Raw
    $bundlePattern = '(?i)(?:src|href)=["'']/?(assets/[^"''?#]+\.(?:js|css))(?:[?#][^"'']*)?["'']'
    $bundleReferences = @(
        [regex]::Matches($distHtml, $bundlePattern) |
            ForEach-Object { $_.Groups[1].Value } |
            Sort-Object -Unique
    )
    if ($bundleReferences.Count -eq 0) {
        throw "O arquivo '$distIndex' nao referencia bundles JavaScript ou CSS do Vite. Recompile o frontend."
    }

    $distOutputs = @(Get-Item -LiteralPath $distIndex)
    foreach ($bundleReference in $bundleReferences) {
        $relativeBundlePath = $bundleReference.Replace('/', [IO.Path]::DirectorySeparatorChar)
        $bundlePath = Join-Path $FrontendDist $relativeBundlePath
        if (-not (Test-Path -LiteralPath $bundlePath -PathType Leaf)) {
            throw "Bundle referenciado por dist\index.html nao encontrado: '$bundlePath'. Recompile o frontend."
        }
        $distOutputs += Get-Item -LiteralPath $bundlePath
    }

    $oldestOutput = $distOutputs | Sort-Object LastWriteTimeUtc | Select-Object -First 1
    if ($oldestOutput.LastWriteTimeUtc -lt $latestSource.LastWriteTimeUtc) {
        $sourceTimestamp = $latestSource.LastWriteTimeUtc.ToString('yyyy-MM-dd HH:mm:ssZ')
        $outputTimestamp = $oldestOutput.LastWriteTimeUtc.ToString('yyyy-MM-dd HH:mm:ssZ')
        throw (
            "O dist esta obsoleto e nao pode ser reutilizado com -SkipFrontendBuild. " +
            "Fonte mais recente: '$($latestSource.FullName)' ($sourceTimestamp). " +
            "Artefato mais antigo: '$($oldestOutput.FullName)' ($outputTimestamp). " +
            "Execute novamente sem -SkipFrontendBuild para recompilar o frontend."
        )
    }
}

try {
    $repoRoot = Split-Path -Parent $PSScriptRoot
    $serverDirectory = Join-Path $repoRoot 'server'
    $venvPython = Join-Path $repoRoot '.venv-vtt\Scripts\python.exe'
    $entrypoint = Join-Path $serverDirectory 'portable_entry.py'
    $frontendDist = Join-Path $repoRoot 'dist'
    $frontendIndex = Join-Path $frontendDist 'index.html'
    $launcherSource = Join-Path $serverDirectory 'packaging\Iniciar C.A.O.S. VTT.cmd'
    $readmeSource = Join-Path $serverDirectory 'README-PORTABLE.md'
    $buildRoot = Join-Path $serverDirectory '.build'
    $artifactRoot = Join-Path $serverDirectory '.artifacts'
    $portableDist = Join-Path $artifactRoot 'portable'
    $portableDirectory = Join-Path $portableDist 'CAOS-VTT'
    $zipPath = Join-Path $artifactRoot 'CAOS-VTT-portable-win.zip'
    $hashPath = "$zipPath.sha256"

    Write-Step 'Validando ambiente de build'
    if (-not (Test-Path -LiteralPath $venvPython -PathType Leaf)) {
        throw 'O ambiente .venv-vtt nao existe. Execute .\scripts\bootstrap-dev.ps1 primeiro.'
    }
    if (-not (Test-Path -LiteralPath $entrypoint -PathType Leaf)) {
        throw "Entrypoint portatil nao encontrado: '$entrypoint'."
    }
    if (-not (Test-Path -LiteralPath $launcherSource -PathType Leaf)) {
        throw "Launcher portatil nao encontrado: '$launcherSource'."
    }
    if (-not (Test-Path -LiteralPath $readmeSource -PathType Leaf)) {
        throw "Documentacao portatil nao encontrada: '$readmeSource'."
    }

    & $venvPython -c 'import PyInstaller' 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw 'PyInstaller nao esta instalado. Execute .\.venv-vtt\Scripts\python.exe -m pip install -r .\server\requirements-build.txt.'
    }

    if ($SkipFrontendBuild) {
        Write-Step 'Reutilizando o frontend existente em dist'
        if (-not (Test-Path -LiteralPath $frontendIndex -PathType Leaf)) {
            throw 'O parametro -SkipFrontendBuild exige um dist\index.html ja compilado.'
        }
    }
    else {
        Write-Step 'Compilando o frontend Vite'
        $npm = Get-Command 'npm' -ErrorAction SilentlyContinue
        if (-not $npm) {
            throw 'npm nao foi encontrado. Instale Node.js no computador de desenvolvimento ou use -SkipFrontendBuild com um dist atualizado.'
        }
        Push-Location $repoRoot
        try {
            Invoke-Checked -FilePath $npm.Source -Arguments @('run', 'build') -FailureMessage 'A compilacao do frontend falhou'
        }
        finally {
            Pop-Location
        }
    }

    Write-Step 'Validando se o frontend compilado corresponde as fontes atuais'
    Assert-FrontendBuildIsFresh -RepoRoot $repoRoot -FrontendDist $frontendDist

    Write-Step 'Limpando apenas os artefatos portateis anteriores'
    Remove-SafeDirectory -Path $buildRoot -ExpectedParent $serverDirectory
    Remove-SafeDirectory -Path $portableDist -ExpectedParent $artifactRoot
    New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $portableDist -Force | Out-Null
    New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
    Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $hashPath -Force -ErrorAction SilentlyContinue

    Write-Step 'Gerando executavel Windows onedir sem UPX'
    $addData = "$frontendDist;frontend_dist"
    $pyInstallerArguments = @(
        '-m', 'PyInstaller',
        '--noconfirm',
        '--clean',
        '--onedir',
        '--noupx',
        '--console',
        '--name', 'CAOS-VTT',
        '--paths', $serverDirectory,
        '--distpath', $portableDist,
        '--workpath', (Join-Path $buildRoot 'work'),
        '--specpath', (Join-Path $buildRoot 'spec'),
        '--add-data', $addData,
        '--collect-submodules', 'uvicorn',
        '--collect-submodules', 'websockets',
        $entrypoint
    )
    Invoke-Checked -FilePath $venvPython -Arguments $pyInstallerArguments -FailureMessage 'PyInstaller falhou'

    $executable = Join-Path $portableDirectory 'CAOS-VTT.exe'
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
        throw "PyInstaller concluiu sem gerar '$executable'."
    }
    Copy-Item -LiteralPath $launcherSource -Destination $portableDirectory -Force
    Copy-Item -LiteralPath $readmeSource -Destination $portableDirectory -Force

    if (-not $SkipArchive) {
        Write-Step 'Criando ZIP e hash SHA-256'
        Compress-Archive -Path (Join-Path $portableDirectory '*') -DestinationPath $zipPath -CompressionLevel Optimal -Force
        $hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
        "$hash  $([IO.Path]::GetFileName($zipPath))" | Set-Content -LiteralPath $hashPath -Encoding ascii
        Write-Host "ZIP:  $zipPath" -ForegroundColor Green
        Write-Host "Hash: $hashPath" -ForegroundColor Green
    }

    Write-Host "`nPacote portatil pronto: $portableDirectory" -ForegroundColor Green
    Write-Host 'No computador de destino, extraia o ZIP e abra Iniciar C.A.O.S. VTT.cmd.'
}
catch {
    Write-Host "`nBuild portatil interrompido: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
