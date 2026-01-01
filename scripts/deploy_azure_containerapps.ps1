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
# Replace the placeholder values below with real values before running the script
$envVars = @{
  SUPABASE_URL = "https://exbmjznbphjujgngtnrz.supabase.co"
  SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4Ym1qem5icGhqdWpnbmd0bnJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODAyOTMwMCwiZXhwIjoyMDczNjA1MzAwfQ.jxObxiiMAmAGph2BG0sczni2cdRiz_buAPee0zIywl8"
  SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4Ym1qem5icGhqdWpnbmd0bnJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODAyOTMwMCwiZXhwIjoyMDczNjA1MzAwfQ.jxObxiiMAmAGph2BG0sczni2cdRiz_buAPee0zIywl8"
  SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4Ym1qem5icGhqdWpnbmd0bnJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwMjkzMDAsImV4cCI6MjA3MzYwNTMwMH0.AlH9vDHVOLdJuvo78ogkjTdHbZWUusJHhYAvdr_5chE"
  CORS_ORIGINS = "https://ai-driven-resume-screening.vercel.app,http://localhost:3000"
  RASA_URL = "http://127.0.0.1:5005"
  EMAIL_HOST = "smtp.gmail.com"
  EMAIL_PORT = "587"
  EMAIL_USE_TLS = "True"
  EMAIL_HOST_USER = "airesumescreening@gmail.com"
  EMAIL_HOST_PASSWORD = "flwonmlqvwtodbnv"
  EMAIL_FROM_NAME = "HR Team - AI Resume Screening System"
}

# Convert hashtable into az formatted args
$envArgs = $envVars.GetEnumerator() | ForEach-Object { "${($_.Key)}=${($_.Value)}" }

az containerapp update --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --set-env-vars $envArgs

# 7. Show FQDN
$fqdn = az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv
Write-Host "Deployment complete. Backend URL: https://$fqdn"

Write-Host "To stream logs: az containerapp logs show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --follow"
Write-Host "When finished, cleanup with: az group delete --name $RESOURCE_GROUP --yes --no-wait"
