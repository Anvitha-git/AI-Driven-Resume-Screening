FROM rasa/rasa:3.7.6-full

# Set working directory
WORKDIR /app

# Copy chatbot project files
COPY . /app

# Expose Rasa port
EXPOSE 5005

# Run Rasa server with API enabled and CORS open
CMD ["rasa", "run", "--enable-api", "--cors", "*", "--port", "5005"]
