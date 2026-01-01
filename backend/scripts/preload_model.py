import os
from sentence_transformers import SentenceTransformer

model_name = os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
print(f"Preloading SentenceTransformer model: {model_name}")
# This will download/cache the model into the build environment
SentenceTransformer(model_name)
print("Model preload complete.")
