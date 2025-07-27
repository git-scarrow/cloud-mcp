#!/usr/bin/env python3
"""Test Oracle ADB connection"""

import oracledb
import os
from pathlib import Path

# Wallet configuration
wallet_location = os.path.expanduser("~/.oci/photosight_wallet2")
wallet_password = "gmw-gbq1rkf9jrf9WVP"

print(f"Wallet location: {wallet_location}")
print(f"Wallet exists: {Path(wallet_location).exists()}")
print(f"TNS file: {Path(wallet_location + '/tnsnames.ora').exists()}")

# Set TNS_ADMIN
os.environ['TNS_ADMIN'] = wallet_location

# Try different connection methods
print("\n" + "="*50)

# Method 1: Thin mode with wallet
try:
    print("Method 1: Thin mode with wallet")
    connection = oracledb.connect(
        user="CLOUD_COMPARE",
        password="CloudCompare2024!",
        dsn="photosightdb_medium",
        config_dir=wallet_location,
        wallet_location=wallet_location,
        wallet_password=wallet_password
    )
    cursor = connection.cursor()
    cursor.execute("SELECT 'Connected!' FROM dual")
    result = cursor.fetchone()
    print(f"✅ Success: {result[0]}")
    cursor.close()
    connection.close()
except Exception as e:
    print(f"❌ Failed: {e}")

print("\n" + "="*50)

# Method 2: Try without wallet password
try:
    print("Method 2: Without wallet password")
    connection = oracledb.connect(
        user="CLOUD_COMPARE",
        password="CloudCompare2024!",
        dsn="photosightdb_medium",
        config_dir=wallet_location,
        wallet_location=wallet_location
    )
    cursor = connection.cursor()
    cursor.execute("SELECT 'Connected!' FROM dual")
    result = cursor.fetchone()
    print(f"✅ Success: {result[0]}")
    cursor.close()
    connection.close()
except Exception as e:
    print(f"❌ Failed: {e}")

print("\n" + "="*50)

# Method 3: Check wallet contents
print("Wallet contents:")
for file in os.listdir(wallet_location):
    print(f"  - {file}")

# Check sqlnet.ora
sqlnet_path = os.path.join(wallet_location, "sqlnet.ora")
if os.path.exists(sqlnet_path):
    print("\nsqlnet.ora contents:")
    with open(sqlnet_path, 'r') as f:
        print(f.read())