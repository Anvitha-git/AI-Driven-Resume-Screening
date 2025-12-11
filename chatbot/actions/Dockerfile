FROM python:3.10-slim

WORKDIR /app

# Copy actions code
COPY . /app

# Install runtime dependencies
RUN pip install --upgrade pip
RUN pip install rasa-sdk

# If a requirements.txt exists, install it (keeps flexibility)
COPY requirements.txt /app/requirements.txt
RUN if [ -f /app/requirements.txt ]; then pip install -r /app/requirements.txt; fi

# Expose actions port
EXPOSE 5055

# Run the Rasa actions endpoint
CMD ["python", "-m", "rasa_sdk.endpoint", "--actions", "actions.actions", "--port", "5055"]
