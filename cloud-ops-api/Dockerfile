FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Oracle client
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    libaio1 \
    && rm -rf /var/lib/apt/lists/*

# Install Oracle Instant Client
RUN wget https://download.oracle.com/otn_software/linux/instantclient/2115000/instantclient-basic-linux.x64-21.15.0.0.0dbru.zip \
    && unzip instantclient-basic-linux.x64-21.15.0.0.0dbru.zip \
    && mv instantclient_21_15 /opt/oracle \
    && rm instantclient-basic-linux.x64-21.15.0.0.0dbru.zip

ENV LD_LIBRARY_PATH=/opt/oracle:$LD_LIBRARY_PATH

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .

EXPOSE 5000

CMD ["python", "app.py"]