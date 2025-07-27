#!/usr/bin/env python3
"""
Oracle ADB Thin Mode Connection Module
"""

import os
import oracledb
from typing import Optional, Dict, Any

class OracleADBConnection:
    """Oracle ADB connection handler using thin mode"""
    
    def __init__(self):
        # Force thin mode
        self.wallet_location = os.path.expanduser("~/.oci/photosight_wallet2")
        self.user = "CLOUD_COMPARE"
        self.password = "CloudCompare2024!"
        self.service = "photosightdb_medium"
        self.connection = None
        
    def connect(self) -> oracledb.Connection:
        """Establish connection to Oracle ADB using thin mode"""
        
        if self.connection:
            return self.connection
            
        try:
            # Method 1: Simple thin mode connection
            self.connection = oracledb.connect(
                user=self.user,
                password=self.password,
                dsn=self.service,
                config_dir=self.wallet_location
            )
            return self.connection
            
        except Exception as e:
            # Method 2: Try with explicit connection parameters
            try:
                # Build connection string manually
                params = oracledb.ConnectParams(
                    user=self.user,
                    password=self.password,
                    host="adb.us-chicago-1.oraclecloud.com",
                    port=1522,
                    service_name="gfca71b2aacce62_photosightdb_medium.adb.oraclecloud.com",
                    ssl_server_cert_dn="*.oraclecloud.com",
                    ssl_server_dn_match=True,
                    config_dir=self.wallet_location,
                    wallet_location=self.wallet_location
                )
                
                self.connection = oracledb.connect(params=params)
                return self.connection
                
            except Exception as e2:
                # Method 3: Try with mTLS disabled (if wallet has issues)
                try:
                    # Read sqlnet.ora to check SSL settings
                    sqlnet_path = os.path.join(self.wallet_location, "sqlnet.ora")
                    
                    # Try connection with simplified parameters
                    self.connection = oracledb.connect(
                        user=self.user,
                        password=self.password,
                        dsn=f"{self.user.lower()}_high",  # Try high service
                        config_dir=self.wallet_location
                    )
                    return self.connection
                    
                except Exception as e3:
                    raise Exception(f"All connection methods failed: {e}, {e2}, {e3}")
    
    def execute_query(self, query: str, params: Optional[Dict] = None) -> list:
        """Execute a query and return results"""
        conn = self.connect()
        cursor = conn.cursor()
        
        try:
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
                
            if query.strip().upper().startswith('SELECT'):
                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()
                return [dict(zip(columns, row)) for row in rows]
            else:
                conn.commit()
                return {"rowcount": cursor.rowcount}
                
        finally:
            cursor.close()
    
    def test_connection(self) -> bool:
        """Test the database connection"""
        try:
            result = self.execute_query("SELECT 'OK' as status FROM dual")
            print(f"✅ Connection test successful: {result[0]['STATUS']}")
            return True
        except Exception as e:
            print(f"❌ Connection test failed: {e}")
            return False
    
    def close(self):
        """Close the database connection"""
        if self.connection:
            self.connection.close()
            self.connection = None

# Test the connection
if __name__ == "__main__":
    print("Testing Oracle ADB Thin Mode Connection...")
    print("=" * 50)
    
    db = OracleADBConnection()
    
    if db.test_connection():
        # Get user info
        result = db.execute_query("SELECT USER, SYS_CONTEXT('USERENV', 'DB_NAME') as DB FROM dual")
        print(f"User: {result[0]['USER']}")
        print(f"Database: {result[0]['DB']}")
        
        # Check existing tables
        result = db.execute_query("""
            SELECT table_name 
            FROM user_tables 
            WHERE table_name IN ('CLOUD_RESOURCES', 'CLOUD_METRICS', 'PROJECTS')
            ORDER BY table_name
        """)
        
        if result:
            print("\nExisting tables:")
            for row in result:
                print(f"  - {row['TABLE_NAME']}")
        else:
            print("\nNo Cloud-Ops tables found. Run setup_oracle_adb_schema.py to create them.")
        
        db.close()
    else:
        print("\n💡 Tip: If connection fails, you may need to:")
        print("1. Check your Oracle ADB is not paused in OCI Console")
        print("2. Verify the wallet files are not corrupted")
        print("3. Use Oracle Instant Client for thick mode instead")