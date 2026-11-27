param([ValidateSet('state','play','pause','next','previous')][string]$Action='state')
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$managerType=[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
$infoType=[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media.Control,ContentType=WindowsRuntime]
$adapter=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'} | Select-Object -First 1
function Await-Result($operation,[type]$type) {
 $task=$adapter.MakeGenericMethod($type).Invoke($null,@($operation))
 $task.GetAwaiter().GetResult()
}
$manager=Await-Result ($managerType::RequestAsync()) $managerType
$session=$manager.GetSessions() | Where-Object {$_.SourceAppUserModelId -match '^(Spotify($|\.|!)|SpotifyAB\.SpotifyMusic_)'} | Select-Object -First 1
if(!$session){'{"connected":false}';exit}
if($Action -ne 'state'){
 $operation=switch($Action){play{$session.TryPlayAsync()} pause{$session.TryPauseAsync()} next{$session.TrySkipNextAsync()} previous{$session.TrySkipPreviousAsync()}}
 if(!(Await-Result $operation ([bool]))){throw 'Control unavailable'}
}
$media=Await-Result ($session.TryGetMediaPropertiesAsync()) $infoType
$art=''
if($media.Thumbnail){
 try {
  $streamType=[Windows.Storage.Streams.IRandomAccessStreamWithContentType,Windows.Storage.Streams,ContentType=WindowsRuntime]
  $stream=Await-Result ($media.Thumbnail.OpenReadAsync()) $streamType
  if($stream){
   Add-Type -AssemblyName System.Drawing
   $source=[System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
   try{
    if($source.Length -gt 8388608){throw "Thumbnail too large"}
    $image=[Drawing.Image]::FromStream($source)
    try{
     $scale=[Math]::Min(1,480/[Math]::Max($image.Width,$image.Height))
     $cover=[Drawing.Bitmap]::new($image,[Math]::Max(1,[int]($image.Width*$scale)),[Math]::Max(1,[int]($image.Height*$scale)))
     $buffer=[IO.MemoryStream]::new()
     try{
      $cover.Save($buffer,[Drawing.Imaging.ImageFormat]::Jpeg)
      $art='data:image/jpeg;base64,'+[Convert]::ToBase64String($buffer.ToArray())
     }finally{$cover.Dispose();$buffer.Dispose()}
    }finally{$image.Dispose()}
   }finally{$source.Dispose()}
  }
 }catch{[Console]::Error.WriteLine('Spotify artwork: '+$_.Exception.Message)}
}
$timeline=$session.GetTimelineProperties()
$sample=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$playing=$session.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing'
$position=$timeline.Position.TotalSeconds
if($playing -and $timeline.LastUpdatedTime.Year -gt 2000){$position += [Math]::Max(0,([DateTimeOffset]::UtcNow-$timeline.LastUpdatedTime).TotalSeconds)}
@{position=$position;duration=$timeline.EndTime.TotalSeconds;sampledAt=$sample;connected=$true;title=$media.Title;artist=$media.Artist;album=$media.AlbumTitle;playing=($session.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing');art=$art}|ConvertTo-Json -Compress
