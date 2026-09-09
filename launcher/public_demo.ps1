$ErrorActionPreference = "Stop"

$pythonLauncher = Get-Command py -ErrorAction SilentlyContinue
if ($pythonLauncher) {
    & $pythonLauncher.Path -3 (Join-Path $PSScriptRoot "start_public_demo.py")
    exit $LASTEXITCODE
}

if (Get-Command python -ErrorAction SilentlyContinue) {
    & python (Join-Path $PSScriptRoot "start_public_demo.py")
    exit $LASTEXITCODE
}

throw "Python was not found in PATH."
