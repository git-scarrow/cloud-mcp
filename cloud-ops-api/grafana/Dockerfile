FROM python:3.11-slim

WORKDIR /app

# Install Oracle client dependencies and build tools
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    libaio1 \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Oracle Instant Client
RUN wget https://download.oracle.com/otn_software/linux/instantclient/2115000/instantclient-basic-linux.x64-21.15.0.0.0dbru.zip \
    && unzip instantclient-basic-linux.x64-21.15.0.0.0dbru.zip \
    && mv instantclient_21_15 /opt/oracle \
    && rm instantclient-basic-linux.x64-21.15.0.0.0dbru.zip

ENV LD_LIBRARY_PATH=/opt/oracle:$LD_LIBRARY_PATH

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Oracle proxy application
COPY oracle_proxy.py .

EXPOSE 5000

CMD ["python", "oracle_proxy.py"]