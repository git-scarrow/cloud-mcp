#!/usr/bin/env python3
"""Simple Oracle ADB connection test"""

import oracledb
import os

# Use auto-login wallet (cwallet.sso)
wallet_location = os.path.expanduser("~/.oci/photosight_wallet2")

try:
    # Simple connection with auto-login wallet
    connection = oracledb.connect(
        user="CLOUD_COMPARE",
        password="CloudCompare2024!",
        dsn="photosightdb_medium",
        config_dir=wallet_location,
        wallet_location=wallet_location
    )
    
    cursor = connection.cursor()
    cursor.execute("SELECT 'Connected to Oracle ADB!' as message FROM dual")
    result = cursor.fetchone()
    print(f"✅ {result[0]}")
    
    # Check user and database info
    cursor.execute("SELECT USER, SYS_CONTEXT('USERENV', 'DB_NAME') FROM dual")
    user, db = cursor.fetchone()
    print(f"✅ User: {user}, Database: {db}")
    
    cursor.close()
    connection.close()
    
except Exception as e:
    print(f"❌ Connection failed: {e}")
    print(f"\nDebug info:")
    print(f"- Wallet location: {wallet_location}")
    print(f"- Wallet exists: {os.path.exists(wallet_location)}")
    print(f"- Auto-login wallet: {os.path.exists(os.path.join(wallet_location, 'cwallet.sso'))}")