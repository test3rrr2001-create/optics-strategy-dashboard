$dest = "c:\Users\kaiha\.gemini\antigravity\scratch\optics-strategy-dashboard\auto_deploy.bat"
$text = "@echo off`r`ngit add .`r`ngit commit -m `"fix: improve RSS parsing for law-feed`"`r`ngit push origin main`r`necho.`r`necho Done! Check Vercel for deployment status.`r`npause`r`n"
[System.IO.File]::WriteAllText($dest, $text, [System.Text.Encoding]::GetEncoding(932))
Write-Host "auto_deploy.bat written successfully."
