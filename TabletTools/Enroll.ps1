$adb=Join-Path $PSScriptRoot 'adb.exe'
$root=Split-Path $PSScriptRoot
$devices=@(& $adb devices | ForEach-Object {if($_ -match '^(\S+)\s+device$'){$Matches[1]}})
if($devices.Count -ne 1){throw 'Connect one tablet by USB, enable USB debugging, and approve this computer on the tablet.'}
$id=$devices[0]
& $adb -s $id install -r (Join-Path $root 'GlassDeck Display.apk')
if($LASTEXITCODE){throw 'Installation failed'}
& $adb -s $id reverse tcp:38422 tcp:38422
if($LASTEXITCODE){throw 'USB forwarding failed'}
Set-Content (Join-Path $PSScriptRoot 'tablet-id.txt') $id
& $adb -s $id shell am start -n com.glassdeck.viewer/.MainActivity
& $adb -s $id shell am start -a android.settings.HOME_SETTINGS
