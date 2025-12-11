Publishing a trained Rasa model (GitHub Releases)
===============================================

This repo includes helper scripts to publish a trained Rasa model (.tar.gz) to GitHub Releases so Render can download it at container startup.

Quick steps (recommended)
1. Train and export your model locally using a Rasa version compatible with the container image (check Rasa version in the logs, e.g. 3.6.x).
2. From the repo root, run one of the helper scripts:

# Bash (Linux / WSL / Git Bash):
```
cd chatbot
./publish_model.sh ./models/20251117-192557-fundamental-geometry.tar.gz v1.0 "Model for production"
```

# PowerShell (Windows):
```
cd chatbot
.\publish_model.ps1 -ModelPath .\models\20251117-192557-fundamental-geometry.tar.gz -ReleaseTag v1.0 -ReleaseNotes "Model for production"
```

3. The script creates (or uses) the release tag and uploads the model asset. It prints an asset URL.
4. In Render, open your Rasa service → Environment → add `MODEL_URL` with the asset URL returned above. Save and redeploy.

Notes & tips
- Ensure the `gh` CLI is installed and authenticated (`gh auth login`) before running helpers.
- For private models prefer S3 + presigned URL (see alternative approach in main README). A signed URL gives more control.
- Make sure the model was trained with the same Rasa minor version as the Docker image (mismatched versions often cause load failures).
