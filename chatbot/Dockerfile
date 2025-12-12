FROM rasa/rasa:3.6.21

# Pin the image to the Rasa version that the model was trained with
# (see model `metadata.json`: `rasa_open_source_version: 3.6.21`).
# Using a matching runtime avoids component/format incompatibilities.

# Set working directory
WORKDIR /app

# Reduce CPU thread usage to lower memory footprint during model load
# Many numerical libraries (OpenBLAS, MKL, OMP) spawn threads which increase
# memory usage: limit them to 1 by default. These can be overridden via env
# vars on Render if you need to tune them later.
ENV OMP_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV VECLIB_MAXIMUM_THREADS=1
ENV NUMEXPR_NUM_THREADS=1

# TensorFlow/Rasa tuning: lower inter/intra op threads and reduce logs
ENV TF_NUM_INTRAOP_THREADS=1
ENV TF_NUM_INTEROP_THREADS=1
ENV TF_CPP_MIN_LOG_LEVEL=2
ENV TF_FORCE_GPU_ALLOW_GROWTH=true
ENV RASA_TELEMETRY_ENABLED=false
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
