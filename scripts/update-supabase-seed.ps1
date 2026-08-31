param(
  [switch]$Yes,
  [switch]$ForgetConnection
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$secretPath = Join-Path $projectRoot '.supabase-database-url.secret'
$originalDatabaseUrl = $env:DATABASE_URL

function ConvertTo-PlainText([Security.SecureString]$SecureValue) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

if ($ForgetConnection) {
  if (Test-Path -LiteralPath $secretPath) {
    Remove-Item -LiteralPath $secretPath
    Write-Host '已清除本机保存的 Supabase 连接。'
  }
  else {
    Write-Host '本机没有保存 Supabase 连接。'
  }
  exit 0
}

Push-Location $projectRoot
try {
  Write-Host '1/3 校验种子数据.xlsx'
  & npm.cmd run data:check
  if ($LASTEXITCODE -ne 0) { throw 'Excel 校验失败，未连接数据库。' }

  $databaseUrl = $env:DATABASE_URL
  if (-not $databaseUrl -and (Test-Path -LiteralPath $secretPath)) {
    try {
      $encrypted = Get-Content -Raw -LiteralPath $secretPath
      $databaseUrl = ConvertTo-PlainText (ConvertTo-SecureString $encrypted)
    }
    catch {
      throw '已保存的数据库连接无法解密。请运行 npm run data:forget 后重新保存。'
    }
  }

  if (-not $databaseUrl) {
    Write-Host ''
    Write-Host '首次使用：请粘贴 Supabase 的 Session Pooler URL。输入内容不会显示。'
    $secureUrl = Read-Host 'DATABASE_URL' -AsSecureString
    $databaseUrl = ConvertTo-PlainText $secureUrl
    if (-not $databaseUrl) { throw '没有输入数据库连接。' }
    $secureUrl | ConvertFrom-SecureString | Set-Content -Encoding UTF8 -LiteralPath $secretPath
    Write-Host '连接已由 Windows 当前账户加密保存；不会上传到 Git。'
  }

  if ($databaseUrl -notmatch '^postgres(?:ql)?://') {
    throw 'DATABASE_URL 必须是 postgresql:// 或 postgres:// 连接串。'
  }

  try {
    $databaseUri = [Uri]$databaseUrl
    $targetHost = $databaseUri.Host
  }
  catch {
    throw 'DATABASE_URL 格式不正确。运行 npm run data:forget 后重新输入。'
  }
  if (-not $targetHost) { throw 'DATABASE_URL 中缺少数据库主机。' }

  Write-Host ''
  Write-Host "2/3 目标数据库：$targetHost"
  if (-not $Yes) {
    $confirmation = Read-Host '确认把 Excel 数据更新到该数据库？输入 y 继续'
    if ($confirmation -notin @('y', 'Y')) {
      Write-Host '已取消，数据库没有更新。'
      exit 0
    }
  }

  $env:DATABASE_URL = $databaseUrl
  Write-Host '3/3 导入并核对数据'
  & npm.cmd run seed:import
  if ($LASTEXITCODE -ne 0) { throw '数据库导入失败。' }

  Write-Host ''
  Write-Host '更新完成。网站直接读取 Supabase，不需要重新部署 Vercel。'
}
finally {
  if ($null -ne $originalDatabaseUrl) {
    $env:DATABASE_URL = $originalDatabaseUrl
  }
  else {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  }
  Pop-Location
}
