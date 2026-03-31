FROM python:3.10-slim

# Install system dependencies for OpenCV and MediaPipe (libgl1 replaces libgl1-mesa-glx on newer Debian)
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0

WORKDIR /app
COPY requirements.txt .
# Install torch explicitly to get CPU version to save space
RUN pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip install -r requirements.txt

COPY . .

# Hugging Face Spaces expose port 7860 by default
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860"]
