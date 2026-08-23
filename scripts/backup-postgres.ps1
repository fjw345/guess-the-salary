param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\backups')
)

$resolvedRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$target = [System.IO.Path]::GetFullPath($OutputDirectory)
if (-not $target.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw '备份目录必须位于项目目录内。'
}

New-Item -ItemType Directory -Force -Path $target | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$output = Join-Path $target "guess-salary-$stamp.sql"
docker compose exec -T postgres pg_dump -U guess_salary -d guess_salary | Set-Content -Encoding UTF8 -LiteralPath $output
Write-Output $output
