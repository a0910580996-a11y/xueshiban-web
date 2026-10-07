param([string]$Archive, [string]$Output)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$destination = [IO.Path]::GetFullPath($Output)
if (Test-Path -LiteralPath $destination) { throw '输出目录已存在，不覆盖。' }
$zip = [IO.Compression.ZipFile]::OpenRead($Archive)
try {
  foreach ($entry in $zip.Entries) {
    $target = [IO.Path]::GetFullPath((Join-Path $destination $entry.FullName))
    if (!$target.StartsWith($destination + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw '发现不安全的压缩路径。' }
  }
  [IO.Compression.ZipFile]::ExtractToDirectory($Archive, $destination)
  $inventory = foreach ($entry in $zip.Entries) {
    if (!$entry.Name) { continue }
    $path = Join-Path $destination $entry.FullName
    [pscustomobject]@{ path=$entry.FullName; bytes=$entry.Length; sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLower(); localPath=$path }
  }
  $inventory | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $destination 'inventory.json') -Encoding UTF8
  [pscustomobject]@{ files=@($inventory).Count; unique=@($inventory | Group-Object sha256).Count; extractedTo=$destination } | ConvertTo-Json
} finally { $zip.Dispose() }
