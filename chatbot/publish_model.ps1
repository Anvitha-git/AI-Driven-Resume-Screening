param(
    [Parameter(Mandatory=$true)] [string] $ModelPath,
    [Parameter(Mandatory=$true)] [string] $ReleaseTag,
    [string] $ReleaseNotes = "Model release uploaded via script"
)

if (-not (Test-Path $ModelPath)) {
    Write-Error "Model file not found: $ModelPath"
    exit 1
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "gh (GitHub CLI) not found. Install from https://cli.github.com/ and authenticate with 'gh auth login'"
    exit 2
}

$repo = gh repo view --json nameWithOwner -q '.nameWithOwner'
Write-Output "Publishing $ModelPath to GitHub Releases for repo $repo with tag $ReleaseTag"

if (gh release view $ReleaseTag 2>$null) {
    Write-Output "Release $ReleaseTag exists — uploading asset"
} else {
    Write-Output "Creating release $ReleaseTag"
    gh release create $ReleaseTag -t $ReleaseTag -n $ReleaseNotes
}

Write-Output "Uploading asset..."
gh release upload $ReleaseTag $ModelPath --clobber

$asset = gh release view $ReleaseTag --json assets -q '.assets[0].url'
Write-Output "Upload complete. Release tag: $ReleaseTag"
Write-Output "Asset URL: $asset"
Write-Output "Use this URL as MODEL_URL in Render (or generate a signed URL if you need limited access)."
