FROM rasa/rasa:3.6.21

# Pin the image to the Rasa version that the model was trained with
# (see model `metadata.json`: `rasa_open_source_version: 3.6.21`).
# Using a matching runtime avoids component/format incompatibilities.

# Set working directory
WORKDIR /app

# Try to reduce memory usage by limiting BLAS/OMP threads and suppressing
# some TensorFlow verbosity. These don't change model memory footprint
# drastically but can reduce peak memory usage during startup.
ENV OMP_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV TF_CPP_MIN_LOG_LEVEL=2
ENV PYTHONUNBUFFERED=1

# Copy chatbot project files
COPY . /app

# Expose Rasa port
EXPOSE 5005

# Copy and use startup script which can fetch models from MODEL_URL
COPY start.sh /app/start.sh
# Some Rasa base images set an ENTRYPOINT of `rasa`, which would
# prepend `rasa` to any CMD and cause the runtime command to be
# interpreted as a rasa subcommand (e.g. `rasa sh ...`). To avoid
# that, override the entrypoint to run the shell script directly.
ENTRYPOINT ["sh", "/app/start.sh"]
