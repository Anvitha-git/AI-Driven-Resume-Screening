<#
Azure Container Apps deployment script for AI-Driven-Resume-Screening

Usage:
  1. Install Azure CLI and Container Apps extension: https://learn.microsoft.com/cli/azure/
  2. Login: az login
  3. Edit variables below (RESOURCE_GROUP, LOCATION, ACR_NAME, IMAGE_NAME, CONTAINER_APP_NAME)
  4. Run: .\deploy_azure_containerapps.ps1

Notes:
 - This script uses `az acr build` to build and push the image to ACR.
 - It creates a Container Apps environment and a single container app for the backend.
 - Tune --memory to 4Gi/8Gi depending on your model's memory needs. Start with 4Gi for testing.
 - It will not remove Render; you can test Azure without touching Render.
 - Make sure to set your SUPABASE and RASA env variables below (or use Azure Key Vault).
 - Clean up with `az group delete --name $RESOURCE_GROUP --yes --no-wait` when finished.
#>

param(
    [string]$RESOURCE_GROUP = "ai-rs-test-rg",
    [string]$LOCATION = "eastus",
    [string]$ACR_NAME = "airesumescreenacr",
    [string]$IMAGE_NAME = "backend:latest",
    [string]$CONTAINER_APP_NAME = "ai-rs-backend",
    [string]$CONTAINERAPPS_ENV = "ai-rs-env",
    [string]$MEMORY = "4Gi",
    [string]$CPU = "1",
    [int]$PORT = 8000
)

Write-Host "Starting Azure Container Apps deployment"

# 1. Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# 2. Create ACR
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Standard --admin-enabled true
az acr login --name $ACR_NAME

# 3. Build & push image to ACR (requires Dockerfile in repository root)
#    This step builds in Azure and avoids local Docker login complexity.
$fullImage = "$($ACR_NAME).azurecr.io/$IMAGE_NAME"
az acr build --registry $ACR_NAME --image $fullImage .

# 4. Create Container Apps environment
az extension add --name containerapp --yes | Out-Null
az containerapp env create --name $CONTAINERAPPS_ENV --resource-group $RESOURCE_GROUP --location $LOCATION

# 5. Create Container App
az containerapp create `
  --name $CONTAINER_APP_NAME `
  --resource-group $RESOURCE_GROUP `
  --environment $CONTAINERAPPS_ENV `
  --image $fullImage `
  --cpu $CPU `
  --memory $MEMORY `
  --ingress 'external' `
  --target-port $PORT

Write-Host "Container App created. Setting environment variables..."

# 6. Configure required environment variables
# Read sensitive values from the process environment to avoid storing secrets in git.
# Export these in PowerShell before running the script, e.g.:
#   $env:SUPABASE_URL = 'https://...'
#   $env:SUPABASE_KEY = '...'
#   $env:EMAIL_HOST_PASSWORD = '...'

# Ensure required env vars are present
$required = @(
  'SUPABASE_URL', 'SUPABASE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY',
  'EMAIL_HOST_USER', 'EMAIL_HOST_PASSWORD'
)
$missing = $required | Where-Object { -not (Get-ChildItem env:$_) }
if ($missing.Count -gt 0) {
  Write-Error "Missing required environment variables: $($missing -join ', ')"
  Write-Error "Export them in PowerShell before running this script, e.g.:`n$env:SUPABASE_URL='https://...'"
  exit 1
}

# Build env map from process environment (use defaults for non-sensitive values)
$envVars = @{
  SUPABASE_URL = $env:SUPABASE_URL
  SUPABASE_KEY = $env:SUPABASE_KEY
  SUPABASE_SERVICE_ROLE_KEY = $env:SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_ANON_KEY = $env:SUPABASE_ANON_KEY
  CORS_ORIGINS = if ($env:CORS_ORIGINS) { $env:CORS_ORIGINS } else { "http://localhost:3000,http://localhost:8000" }
  RASA_URL = if ($env:RASA_URL) { $env:RASA_URL } else { "http://127.0.0.1:5005" }
  EMAIL_HOST = if ($env:EMAIL_HOST) { $env:EMAIL_HOST } else { "smtp.gmail.com" }
  EMAIL_PORT = if ($env:EMAIL_PORT) { $env:EMAIL_PORT } else { "587" }
  EMAIL_USE_TLS = if ($env:EMAIL_USE_TLS) { $env:EMAIL_USE_TLS } else { "True" }
  EMAIL_HOST_USER = $env:EMAIL_HOST_USER
  EMAIL_HOST_PASSWORD = $env:EMAIL_HOST_PASSWORD
  EMAIL_FROM_NAME = if ($env:EMAIL_FROM_NAME) { $env:EMAIL_FROM_NAME } else { "HR Team - AI Resume Screening System" }
}

# Convert hashtable into az formatted args
$envArgs = $envVars.GetEnumerator() | ForEach-Object { "${($_.Key)}=${($_.Value)}" }

az containerapp update --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --set-env-vars $envArgs

# 7. Show FQDN
$fqdn = az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv
Write-Host "Deployment complete. Backend URL: https://$fqdn"

Write-Host "To stream logs: az containerapp logs show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --follow"
Write-Host "When finished, cleanup with: az group delete --name $RESOURCE_GROUP --yes --no-wait"
