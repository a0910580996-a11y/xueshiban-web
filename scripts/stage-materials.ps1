param([string]$Audit, [string]$Output)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $Output) { throw '不覆盖已有公开候选输出。' }
New-Item -ItemType Directory -Path (Join-Path $Output 'files') -Force | Out-Null
$rows = Get-Content -LiteralPath $Audit -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($row in $rows) {
  if ($row.decision -ne 'candidate') { continue }
  $text = Get-Content -LiteralPath (Join-Path (Split-Path $Audit) ($row.sha256 + '.txt')) -Raw -Encoding UTF8
  if (($row.path + ' ' + $text) -match '配套题库|考研真题|笔记和课后习题.*详解|实验报告|教学质量|总评成绩|考试安排|出版|圣才|未经授权|[姓学]\s+[名号]\s*[:：]?\s*[\u4e00-\u9fff\d]{2,}') {
    $row.decision='hold'; $row.reason='人工复核：商业出版、实验报告、个人信息疑点或过时考试安排'; continue
  }
  $publicFile = Join-Path $Output ('files/' + $row.sha256 + $row.extension)
  if ($row.extension -eq '.docx') {
    $doc = [IO.Compression.ZipFile]::OpenRead($row.localPath)
    try {
      $uncertain = @($doc.Entries | Where-Object { $_.FullName -match '^word/(media|embeddings)/|^word/comments|vbaProject|^customXml/' }).Count -gt 0
      foreach ($part in $doc.Entries | Where-Object FullName -like '*.rels') {
        $reader=New-Object IO.StreamReader($part.Open())
        try { if ($reader.ReadToEnd() -match 'TargetMode="External"') { $uncertain=$true } } finally {$reader.Dispose()}
      }
    } finally { $doc.Dispose() }
    if ($uncertain) { $row.decision='hold';$row.reason='Word 含图片、批注、嵌入对象或外部引用，需单独复核';continue }
  }
  Copy-Item -LiteralPath $row.localPath -Destination $publicFile
  if ($row.extension -eq '.docx') {
    $doc = [IO.Compression.ZipFile]::Open($publicFile,[IO.Compression.ZipArchiveMode]::Update)
    try {
      $part = $doc.GetEntry('docProps/core.xml')
      if ($part) {
        $reader=New-Object IO.StreamReader($part.Open())
        try { [xml]$core=$reader.ReadToEnd() } finally {$reader.Dispose()}
        foreach ($node in $core.SelectNodes('//*[local-name()="creator" or local-name()="lastModifiedBy"]')) { $node.InnerText='' }
        $part.Delete()
        $replacement=$doc.CreateEntry('docProps/core.xml')
        $writer=New-Object IO.StreamWriter($replacement.Open(),(New-Object Text.UTF8Encoding($false)))
        try { $writer.Write($core.OuterXml) } finally {$writer.Dispose()}
      }
    } finally {$doc.Dispose()}
  }
  $row.decision='approved'
  $row.reason='全文疑点筛查及人工类型复核通过；Word 作者元数据已清空'
}
$rows | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Output 'decisions.json') -Encoding UTF8
$rows | Group-Object decision | Select-Object Count,Name | ConvertTo-Json
