#!/usr/bin/env python3
"""Test Oracle ADB with thick mode"""

import oracledb
import os
import platform

wallet_location = os.path.expanduser("~/.oci/photosight_wallet2")

print(f"Python version: {platform.python_version()}")
print(f"oracledb version: {oracledb.__version__}")
print(f"Wallet location: {wallet_location}")

# Check if Oracle Instant Client is installed
instant_client_paths = [
    "/usr/local/lib",
    "/opt/oracle/instantclient_19_8",
    "/opt/oracle/instantclient_21_6",
    os.path.expanduser("~/Downloads/instantclient_19_8")
]

instant_client = None
for path in instant_client_paths:
    if os.path.exists(path) and any("libclntsh" in f for f in os.listdir(path) if os.path.isfile(os.path.join(path, f))):
        instant_client = path
        break

if instant_client:
    print(f"✅ Found Oracle Instant Client at: {instant_client}")
    
    try:
        # Initialize thick mode
        oracledb.init_oracle_client(lib_dir=instant_client)
        print("✅ Initialized thick mode")
        
        # Try connection
        connection = oracledb.connect(
            user="CLOUD_COMPARE",
            password="CloudCompare2024!",
            dsn="photosightdb_medium",
            config_dir=wallet_location,
            wallet_location=wallet_location
        )
        
        cursor = connection.cursor()
        cursor.execute("SELECT 'Connected via thick mode!' FROM dual")
        result = cursor.fetchone()
        print(f"✅ {result[0]}")
        
        cursor.close()
        connection.close()
        
    except Exception as e:
        print(f"❌ Thick mode failed: {e}")
else:
    print("❌ Oracle Instant Client not found")
    print("To use Oracle ADB with wallet authentication, you may need to:")
    print("1. Download Oracle Instant Client from:")
    print("   https://www.oracle.com/database/technologies/instant-client/macos-intel-x86-downloads.html")
    print("2. Extract it to /usr/local/lib or ~/Downloads/")
    print("3. Run this script again")