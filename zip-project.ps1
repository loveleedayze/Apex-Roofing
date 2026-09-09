# zip-project.ps1
# Packages the Apex Roofing / Maggie Mae demo site into a zip for sharing.
# Excludes heavy build/dependency dirs and secrets (.env.local).

$src          = "C:\Users\New User\apex-roofing"
$dst          = "C:\Users\New User\apex-roofing-demo.zip"
$exclude      = @('node_modules', '.next', '.git')                 # skip whole top-level dirs
$excludeFiles = @('.env.local', 'tsconfig.tsbuildinfo', 'zip-project.ps1')  # skip these files by name

# Remove any previous archive
if (Test-Path $dst) { [System.IO.File]::Delete($dst) }

# Gather files, filtering out excluded dirs and files
$files = Get-ChildItem -Path $src -Recurse -File | Where-Object {
    $rel = $_.FullName.Substring($src.Length + 1)
    $top = $rel.Split('\')[0]
    ($exclude -notcontains $top) -and ($excludeFiles -notcontains $_.Name)
}

# Build the zip, preserving relative folder structure
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($dst, [System.IO.Compression.ZipArchiveMode]::Create)
foreach ($f in $files) {
    $rel = $f.FullName.Substring($src.Length + 1)
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zip, $f.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
}
$zip.Dispose()

Write-Host "Zipped $($files.Count) files -> $dst ($("{0:N2} MB" -f ((Get-Item $dst).Length / 1MB)))"
Write-Host "--- contents ---"
$z = [System.IO.Compression.ZipFile]::OpenRead($dst)
$z.Entries | Select-Object -ExpandProperty FullName | Sort-Object
$z.Dispose()
