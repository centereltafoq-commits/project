param(
  [string]$DownloadUrl = "https://get.enterprisedb.com/postgresql/postgresql-16.8-1-windows-x64-binaries.zip",
  [string]$TargetDir = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopDir = Resolve-Path (Join-Path $ScriptDir "..")
if ([string]::IsNullOrWhiteSpace($TargetDir)) {
  $TargetDir = Join-Path $DesktopDir "resources\pgsql"
}

$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("educenter-pgsql-" + [System.Guid]::NewGuid().ToString("N"))
$ZipPath = Join-Path $TempDir "pgsql.zip"
$ExtractDir = Join-Path $TempDir "extract"

Write-Host "[Portable-PG] Preparing Portable PostgreSQL 16 (Windows x64)..."
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
New-Item -ItemType Directory -Path $ExtractDir -Force | Out-Null

try {
  Write-Host "[Portable-PG] Downloading: $DownloadUrl"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath -UseBasicParsing

  Write-Host "[Portable-PG] Extracting archive..."
  Expand-Archive -Path $ZipPath -DestinationPath $ExtractDir -Force

  $ExtractedPgRoot = Join-Path $ExtractDir "pgsql"
  if (-not (Test-Path (Join-Path $ExtractedPgRoot "bin\pg_ctl.exe"))) {
    throw "Extracted archive does not contain pgsql\bin\pg_ctl.exe"
  }

  if (Test-Path $TargetDir) {
    Remove-Item -Path $TargetDir -Recurse -Force
  }
  New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null

  # Copy only essential runtime directories (omit pgAdmin, doc, include, symbols to keep setup size small)
  foreach ($SubDir in @("bin", "lib", "share")) {
    $Src = Join-Path $ExtractedPgRoot $SubDir
    $Dst = Join-Path $TargetDir $SubDir
    if (Test-Path $Src) {
      Write-Host "[Portable-PG] Copying $SubDir..."
      Copy-Item -Path $Src -Destination $Dst -Recurse -Force
    }
  }

  # Strip debug/PDB bloat if any exists inside bin/lib
  Get-ChildItem -Path $TargetDir -Include "*.pdb" -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

  Write-Host "[Portable-PG] Ready at: $TargetDir"
}
finally {
  if (Test-Path $TempDir) {
    Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}
