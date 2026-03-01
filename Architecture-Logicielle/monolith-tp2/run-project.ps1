$ErrorActionPreference = "Stop"

$jdkRoot = "C:\Program Files\Eclipse Adoptium"
$jdk = Get-ChildItem -Path $jdkRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "jdk-17*" } |
    Sort-Object Name -Descending |
    Select-Object -First 1

if (-not $jdk) {
    throw "JDK 17 not found under '$jdkRoot'. Install Temurin/OpenJDK 17 first."
}

$env:JAVA_HOME = $jdk.FullName
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

Write-Host "Using JAVA_HOME=$env:JAVA_HOME"
Write-Host "Starting Spring Boot..."

& ".\mvnw.cmd" clean spring-boot:run
