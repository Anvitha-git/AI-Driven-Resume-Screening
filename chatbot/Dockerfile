FROM rasa/rasa:latest

# NOTE: Using `latest` for now because the specific tag previously used
# (`3.7.6-full`) was not available on Docker Hub during the Render build.
# For reproducible builds pin a known-good tag (e.g. `rasa/rasa:3.8.x`).

# Set working directory
WORKDIR /app

# Copy chatbot project files
COPY . /app

# Expose Rasa port
EXPOSE 5005

# Copy and use startup script which can fetch models from MODEL_URL
COPY start.sh /app/start.sh
# Some base images (including certain Rasa images) run as non-root
# which prevents changing file permissions at build time. Instead of
# attempting `chmod`, invoke the script through the shell at runtime.
CMD ["sh", "/app/start.sh"]
