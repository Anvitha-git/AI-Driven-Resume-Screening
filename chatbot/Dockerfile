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

# Run Rasa server with API enabled and CORS open
CMD ["rasa", "run", "--enable-api", "--cors", "*", "--port", "5005"]
