#!/bin/bash
# Download Oracle ADB Wallet for PhotoSight Database
# Based on script from CLAUDE.md

DB_NAME="${1:-PhotoSight Database}"
COMPARTMENT_ID=$(oci iam tenancy get --tenancy-id $(oci iam compartment list --query "data[0].\"tenant-id\"" --raw-output 2>/dev/null) --query "data.id" --raw-output 2>/dev/null || echo "ocid1.tenancy.oc1..aaaaaaaauyznfhb6gmqrbjqzmj7lbakhgk6lgznmqdra7sr52ndyq7p6wjoq")

echo "Searching for database: $DB_NAME"
echo "Compartment ID: $COMPARTMENT_ID"

# Get ADB ID
ADB_ID=$(oci db autonomous-database list \
  --compartment-id "$COMPARTMENT_ID" \
  --query "data[?\"display-name\"=='$DB_NAME'].id | [0]" \
  --raw-output)

if [ -z "$ADB_ID" ] || [ "$ADB_ID" = "null" ]; then
  echo "❌ Database '$DB_NAME' not found"
  echo "Available databases:"
  oci db autonomous-database list \
    --compartment-id "$COMPARTMENT_ID" \
    --query "data[].\"display-name\"" \
    --output table
  exit 1
fi

echo "Found database: $ADB_ID"

# Create wallet directory for Lambda
WALLET_DIR="./lambda-wallet"
mkdir -p "$WALLET_DIR"

# Download wallet
echo "Downloading wallet..."
oci db autonomous-database generate-wallet \
  --autonomous-database-id "$ADB_ID" \
  --file "$WALLET_DIR/wallet.zip" \
  --password "WalletPassword123!" \
  --generate-type SINGLE

if [ $? -eq 0 ]; then
  cd "$WALLET_DIR"
  unzip -o wallet.zip
  rm wallet.zip
  echo "✅ Wallet downloaded and extracted to: $WALLET_DIR"
  ls -la
  cd ..
else
  echo "❌ Failed to download wallet"
  exit 1
fi