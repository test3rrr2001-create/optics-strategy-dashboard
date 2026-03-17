$GeminiKey = (Get-Content .env | Select-String "GEMINI_API_KEY" | ForEach-Object { $_.ToString().Split('=')[1].Trim() })

if (-not $GeminiKey) {
    Write-Host "Error: GEMINI_API_KEY not found in .env" -ForegroundColor Red
    exit
}

Write-Host "Testing Gemini API Connectivity..."
$Uri = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GeminiKey"
$Body = @{
    contents = @(
        @{
            parts = @(
                @{ text = "Hello, are you working?" }
            )
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $Response = Invoke-RestMethod -Uri $Uri -Method Post -Body $Body -ContentType "application/json"
    Write-Host "Success! Response received:" -ForegroundColor Green
    $Response.candidates[0].content.parts[0].text
} catch {
    Write-Host "Error occurred:" -ForegroundColor Red
    $_.ErrorDetails.Message | ConvertFrom-Json | ConvertTo-Json
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
}
