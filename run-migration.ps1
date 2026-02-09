# Script to run Prisma migration
# Usage: .\run-migration.ps1

Write-Host "Running Prisma Migration..." -ForegroundColor Cyan
Write-Host ""

# Check if .env.local exists
if (Test-Path .env.local) {
    Write-Host "✓ Found .env.local" -ForegroundColor Green
    
    # Load environment variables from .env.local
    Get-Content .env.local | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    
    # Check if DATABASE_URL is set
    $dbUrl = [Environment]::GetEnvironmentVariable("DATABASE_URL", "Process")
    if ($dbUrl) {
        Write-Host "✓ DATABASE_URL is set" -ForegroundColor Green
        Write-Host ""
        Write-Host "Running migration..." -ForegroundColor Yellow
        npx prisma migrate deploy
    } else {
        Write-Host "✗ DATABASE_URL not found in .env.local" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please ensure DATABASE_URL is set in .env.local" -ForegroundColor Yellow
        Write-Host "Example: DATABASE_URL=mysql://user:password@host:3306/database" -ForegroundColor Gray
    }
} else {
    Write-Host "✗ .env.local not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Migration is ready but cannot be run without DATABASE_URL" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To run migration manually:" -ForegroundColor Cyan
    Write-Host "  1. Set DATABASE_URL in .env.local" -ForegroundColor Gray
    Write-Host "  2. Run: npx prisma migrate deploy" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Or use MySQL client directly:" -ForegroundColor Cyan
    Write-Host "  mysql -u username -p database_name < prisma\migrations\20260127013910_fix_customer_notes_schema\migration.sql" -ForegroundColor Gray
}

Write-Host ""
