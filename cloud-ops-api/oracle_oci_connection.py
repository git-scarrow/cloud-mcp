#!/usr/bin/env python3
"""
Oracle ADB Connection using OCI Database Tools
Alternative approach when direct wallet connection fails
"""

import os
import json
import subprocess
from typing import List, Dict, Any

class OracleOCIConnection:
    """Connect to Oracle ADB using OCI CLI and Database Tools"""
    
    def __init__(self):
        self.compartment_id = "ocid1.tenancy.oc1..aaaaaaaauyznfhb6gmqrbjqzmj7lbakhgk6lgznmqdra7sr52ndyq7p6wjoq"
        self.db_name = "PhotoSight Database"
        self.adb_id = None
        
    def get_adb_id(self):
        """Get Autonomous Database ID"""
        if not self.adb_id:
            cmd = [
                "oci", "db", "autonomous-database", "list",
                "--compartment-id", self.compartment_id,
                "--query", f"data[?\"display-name\"=='{self.db_name}'].id | [0]",
                "--raw-output"
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            self.adb_id = result.stdout.strip()
        return self.adb_id
    
    def execute_sql(self, sql: str) -> Dict[str, Any]:
        """Execute SQL using OCI Database Management"""
        # Note: This requires Database Management to be enabled on the ADB
        # For now, we'll return mock data
        
        print(f"Would execute: {sql}")
        
        # In production, you would use:
        # oci database-management managed-database execute-sql \
        #   --managed-database-id <id> \
        #   --sql-text "SELECT * FROM dual"
        
        # For development, return mock data
        if "FROM dual" in sql.upper():
            return {
                "columns": ["DUMMY"],
                "rows": [["X"]],
                "rowcount": 1
            }
        else:
            return {
                "columns": [],
                "rows": [],
                "rowcount": 0
            }
    
    def get_database_info(self):
        """Get database information via OCI CLI"""
        adb_id = self.get_adb_id()
        
        cmd = [
            "oci", "db", "autonomous-database", "get",
            "--autonomous-database-id", adb_id,
            "--query", "data"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            return json.loads(result.stdout)
        else:
            return {"error": result.stderr}

# Alternative: Use existing connection through another method
class AlternativeConnection:
    """Alternative connection methods for Oracle ADB"""
    
    @staticmethod
    def use_sql_developer_web():
        """Use SQL Developer Web REST API"""
        base_url = "https://GFCA71B2AACCE62-PHOTOSIGHTDB.adb.us-chicago-1.oraclecloudapps.com/ords/sql-developer"
        
        print(f"SQL Developer Web is available at:")
        print(f"{base_url}")
        print("\nYou can:")
        print("1. Open this URL in a browser")
        print("2. Login with CLOUD_COMPARE / CloudCompare2024!")
        print("3. Execute SQL queries directly")
        print("4. Use the REST API endpoints if enabled")
        
        return base_url
    
    @staticmethod
    def use_apex():
        """Use Oracle APEX"""
        apex_url = "https://GFCA71B2AACCE62-PHOTOSIGHTDB.adb.us-chicago-1.oraclecloudapps.com/ords/apex"
        
        print(f"\nOracle APEX is available at:")
        print(f"{apex_url}")
        print("\nYou can create REST services in APEX to:")
        print("1. Execute queries")
        print("2. Return JSON data")
        print("3. Integrate with your application")
        
        return apex_url

if __name__ == "__main__":
    print("🔧 Oracle ADB Connection Alternatives")
    print("=" * 50)
    
    # Try OCI CLI method
    oci_conn = OracleOCIConnection()
    print("\n1. Getting database info via OCI CLI...")
    db_info = oci_conn.get_database_info()
    
    if "error" not in db_info:
        print(f"✅ Database: {db_info.get('display-name')}")
        print(f"✅ State: {db_info.get('lifecycle-state')}")
        print(f"✅ OCPU Count: {db_info.get('ocpu-count', 'Auto-scaling')}")
        print(f"✅ Storage: {db_info.get('data-storage-size-in-gbs')} GB")
    
    # Show alternative methods
    print("\n2. Alternative Connection Methods:")
    AlternativeConnection.use_sql_developer_web()
    AlternativeConnection.use_apex()
    
    print("\n💡 Recommendation:")
    print("Since direct wallet connection is having issues, you can:")
    print("1. Use the development API with mock data (already running)")
    print("2. Access SQL Developer Web to run queries manually")
    print("3. Set up REST endpoints in APEX for programmatic access")
    print("4. Wait for Oracle Support to resolve the wallet connection issue")