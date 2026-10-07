param([string]$Inventory, [string]$Output)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$rows = Get-Content -LiteralPath $Inventory -Raw -Encoding UTF8 | ConvertFrom-Json
New-Item -ItemType Directory -Path $Output -Force | Out-Null
$groups = $rows | Group-Object sha256
$result = foreach ($group in $groups) {
  $row = $group.Group[0]
  $extension = [IO.Path]::GetExtension($row.path).ToLower()
  $reason = ''
  $text = ''
  $creator = ''
  if ($group.Group.path -match '(Python作业|\d{9,12}|__pycache__)') { $reason = '个人作业或学号，留待确认' }
  elseif ($row.bytes -gt 20MB) { $reason = '大文件或整本教材，留待确认' }
  elseif ($row.path -match '(茆诗松|王高雄|2023版毛概|《习近平新时代中国特色社会主义思想概论》|版权|教材)') { $reason = '教材或版权范围不明，留待确认' }
  elseif ($extension -notin @('.pdf','.docx')) { $reason = '旧格式、图片、数据、代码或嵌套压缩包，需要单独检查' }
  else {
    try {
      if ($extension -eq '.pdf') {
        $textFile = Join-Path $Output ($row.sha256 + '.txt')
        & pdftotext -enc UTF-8 -nopgbrk $row.localPath $textFile 2>$null
        if ($LASTEXITCODE -ne 0) { throw 'PDF 无法解析' }
        $text = Get-Content -LiteralPath $textFile -Raw -Encoding UTF8
      } else {
        $doc = [IO.Compression.ZipFile]::OpenRead($row.localPath)
        try {
          foreach ($part in $doc.Entries | Where-Object { $_.FullName -match '^word/(document|header\d+|footer\d+|comments|footnotes|endnotes)\.xml$|^docProps/core\.xml$' }) {
            $reader = New-Object IO.StreamReader($part.Open())
            try { [xml]$xml = $reader.ReadToEnd() } finally { $reader.Dispose() }
            if ($part.FullName -eq 'docProps/core.xml') { $creator = $xml.InnerText; continue }
            $text += ($xml.SelectNodes('//*[local-name()="t"]') | ForEach-Object { $_.InnerText }) -join ' '
          }
        } finally { $doc.Dispose() }
        $text | Set-Content -LiteralPath (Join-Path $Output ($row.sha256 + '.txt')) -Encoding UTF8
      }
      if (!$text -or $text.Length -lt 100) { $reason = '扫描件或可提取文本不足，需人工复核' }
      elseif (($text + ' ' + $creator) -match '(?<!\d)1[3-9]\d{9}(?!\d)|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(学号|姓名|身份证|手机号码|联系电话)\s*[:：]?\s*[A-Za-z\d\u4e00-\u9fff]{2,}|版权|版权所有|未经许可|ISBN') { $reason = '个人信息或版权标记疑点，需人工复核' }
    } catch { $reason = '读取失败，需人工复核' }
  }
  [pscustomobject]@{path=$row.path;localPath=$row.localPath;sha256=$row.sha256;bytes=$row.bytes;extension=$extension;sourcePaths=@($group.Group.path);decision= $(if($reason){'hold'}else{'candidate'});reason=$reason;characters=$text.Length;excerpt= $(if($text){$text.Substring(0,[math]::Min(160,$text.Length))}else{''})}
}
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Output 'audit.json') -Encoding UTF8
$result | Group-Object decision,reason | Select-Object Count,Name | ConvertTo-Json
