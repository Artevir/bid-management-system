#Requires -Version 5.1
<#
.SYNOPSIS
  下载 Pandoc Windows x86_64 ZIP 便携版到仓库 tools/pandoc/（不写入系统 PATH）。

.DESCRIPTION
  默认版本与 winget 包 JohnMacFarlane.Pandoc 对齐，可按需传 -Version。
  安装后 `python scripts/docx-hub-to-markdown.py` 会默认优先使用 tools/pandoc/pandoc.exe（除非 USE_PANDOC_FOR_DOCX=0）。
#>
param(
  [string]$Version = "3.9.0.2"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Dest = Join-Path $RepoRoot "tools\pandoc"
$Url = "https://github.com/jgm/pandoc/releases/download/$Version/pandoc-$Version-windows-x86_64.zip"
$Zip = Join-Path $env:TEMP "pandoc-$Version-windows-x86_64.zip"
$Stage = Join-Path $env:TEMP "pandoc-$Version-win-extract"

if (Test-Path (Join-Path $Dest "pandoc.exe")) {
  Write-Host "Already present: $Dest\pandoc.exe"
  & (Join-Path $Dest "pandoc.exe") --version
  exit 0
}

Write-Host "Downloading $Url"
New-Item -ItemType Directory -Force -Path (Split-Path $Dest) | Out-Null
Invoke-WebRequest -Uri $Url -OutFile $Zip -UseBasicParsing

if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
Expand-Archive -Path $Zip -DestinationPath $Stage -Force

$Inner = Get-ChildItem $Stage -Directory | Select-Object -First 1
if (-not $Inner) { throw "Unexpected zip layout: no top-level folder" }

if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Copy-Item -Path (Join-Path $Inner.FullName "*") -Destination $Dest -Recurse -Force

Write-Host "Pandoc installed to: $Dest"
& (Join-Path $Dest "pandoc.exe") --version
