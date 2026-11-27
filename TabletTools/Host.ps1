$root=Split-Path $PSScriptRoot
$adb=Join-Path $PSScriptRoot 'adb.exe'
while($true){
  if(!(Get-NetTCPConnection -LocalPort 38422 -State Listen -ErrorAction SilentlyContinue)){
    Start-Process node -ArgumentList 'node_modules/next/dist/bin/next start -H 127.0.0.1 -p 38422' -WorkingDirectory (Join-Path $root 'Frontend') -WindowStyle Hidden
    Start-Sleep 3
  }
  if(!(Get-NetTCPConnection -LocalPort 38423 -State Listen -ErrorAction SilentlyContinue)){
    Start-Process node -ArgumentList 'wifi.cjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
  }
  Start-Sleep 8
}
