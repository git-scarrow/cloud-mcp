#!/usr/bin/env python3
"""Test Oracle ADB connection with fresh wallet"""

import oracledb
import os

# Use the fresh wallet
wallet_location = os.path.expanduser("~/.oci/photosight_wallet_new")

print(f"Testing with fresh wallet at: {wallet_location}")

# Test 1: Simple connection
try:
    print("\nTest 1: Simple connection with auto-login wallet")
    connection = oracledb.connect(
        user="CLOUD_COMPARE",
        password="CloudCompare2024!",
        dsn="photosightdb_medium",
        config_dir=wallet_location
    )
    
    cursor = connection.cursor()
    cursor.execute("SELECT 'Success!' as result, USER, SYS_CONTEXT('USERENV', 'DB_NAME') as DB FROM dual")
    result = cursor.fetchone()
    print(f"✅ {result[0]} - User: {result[1]}, DB: {result[2]}")
    
    cursor.close()
    connection.close()
    
except Exception as e:
    print(f"❌ Failed: {e}")
    
    # Test 2: Check if it's the password
    print("\nLet me check the available services in tnsnames.ora:")
    with open(os.path.join(wallet_location, "tnsnames.ora"), 'r') as f:
        content = f.read()
        # Extract service names
        import re
        services = re.findall(r'^(\w+)\s*=', content, re.MULTILINE)
        print(f"Available services: {services}")
    
    # Test 3: Try different service
    if 'photosightdb_high' in services:
        try:
            print("\nTest 2: Trying with _high service")
            connection = oracledb.connect(
                user="CLOUD_COMPARE", 
                password="CloudCompare2024!",
                dsn="photosightdb_high",
                config_dir=wallet_location
            )
            print("✅ Connected with _high service!")
            connection.close()
        except Exception as e2:
            print(f"❌ Also failed with _high: {e2}")
            
            # Check sqlnet.ora
            print("\nChecking sqlnet.ora configuration:")
            with open(os.path.join(wallet_location, "sqlnet.ora"), 'r') as f:
                print(f.read())