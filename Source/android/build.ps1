param(
    [Parameter(Mandatory)][string] $SdkPlatform,
    [Parameter(Mandatory)][string] $BuildTools,
    [Parameter(Mandatory)][string] $JavaBin,
    [Parameter(Mandatory)][string] $BuildDirectory,
    [Parameter(Mandatory)][string] $Apk
)

$ErrorActionPreference = 'Stop'
$env:JAVA_HOME = Split-Path $JavaBin
$androidJar = Join-Path $SdkPlatform 'android.jar'
$buildDirectoryPath = [IO.Directory]::CreateDirectory($BuildDirectory).FullName
$classPath = Join-Path $buildDirectoryPath 'classes'
$dexPath = Join-Path $buildDirectoryPath 'dex'
New-Item -ItemType Directory -Path $classPath, $dexPath -Force | Out-Null

function Invoke-Tool([string] $Tool, [string[]] $ToolArguments) {
    & $Tool @ToolArguments
    if ($LASTEXITCODE -ne 0) { throw "$(Split-Path $Tool -Leaf) exited with $LASTEXITCODE" }
}

$aapt = Join-Path $BuildTools 'aapt2.exe'
$compiled = Join-Path $buildDirectoryPath 'resources.zip'
$unsigned = Join-Path $buildDirectoryPath 'unsigned.apk'
$aligned = Join-Path $buildDirectoryPath 'aligned.apk'
$jar = Join-Path $buildDirectoryPath 'viewer.jar'
$key = Join-Path $buildDirectoryPath 'local-development.jks'
$passwordFile = Join-Path $buildDirectoryPath 'local-development-password.txt'

Invoke-Tool $aapt @('compile', '--dir', (Join-Path $PSScriptRoot 'res'), '-o', $compiled)
Invoke-Tool $aapt @('link', '-I', $androidJar, '--manifest', (Join-Path $PSScriptRoot 'AndroidManifest.xml'),
    '--min-sdk-version', '24', '--target-sdk-version', '35', '--version-code', '3',
    '--version-name', '0.1.2', '-o', $unsigned, $compiled)
Invoke-Tool (Join-Path $JavaBin 'javac.exe') @('--release', '8', '-cp', $androidJar, '-d', $classPath,
    (Join-Path $PSScriptRoot 'src/com/glassdeck/viewer/MainActivity.java'))
Invoke-Tool (Join-Path $JavaBin 'jar.exe') @('cf', $jar, '-C', $classPath, '.')
Invoke-Tool (Join-Path $BuildTools 'd8.bat') @('--lib', $androidJar, '--min-api', '24', '--output', $dexPath, $jar)

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::Open($unsigned, [IO.Compression.ZipArchiveMode]::Update)
try { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $dexPath 'classes.dex'), 'classes.dex') | Out-Null }
finally { $archive.Dispose() }
Invoke-Tool (Join-Path $BuildTools 'zipalign.exe') @('-f', '4', $unsigned, $aligned)

if (!(Test-Path -LiteralPath $key)) {
    $password = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
    Set-Content -LiteralPath $passwordFile -Value $password -NoNewline
    $env:GLASSDECK_LOCAL_SIGNING = $password
    try {
        Invoke-Tool (Join-Path $JavaBin 'keytool.exe') @('-genkeypair', '-keystore', $key, '-storetype', 'PKCS12',
            '-storepass:env', 'GLASSDECK_LOCAL_SIGNING', '-alias', 'glassdeck-local', '-keyalg', 'RSA',
            '-keysize', '3072', '-validity', '3650', '-dname', 'CN=GlassDeck Local Development', '-noprompt')
    } finally { Remove-Item Env:GLASSDECK_LOCAL_SIGNING }
}
$signer = Join-Path $BuildTools 'apksigner.bat'
$env:GLASSDECK_LOCAL_SIGNING = Get-Content -LiteralPath $passwordFile -Raw
try {
    Invoke-Tool $signer @('sign', '--ks', $key, '--ks-key-alias', 'glassdeck-local',
        '--ks-pass', 'env:GLASSDECK_LOCAL_SIGNING', '--out', $Apk, $aligned)
} finally { Remove-Item Env:GLASSDECK_LOCAL_SIGNING }
Invoke-Tool $signer @('verify', '--verbose', $Apk)
Invoke-Tool $aapt @('dump', 'badging', $Apk)
