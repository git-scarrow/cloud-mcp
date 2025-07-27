#!/bin/bash
# Download fresh wallet for PhotoSight ADB

ADB_ID=$(oci db autonomous-database list \
  --compartment-id ocid1.tenancy.oc1..aaaaaaaauyznfhb6gmqrbjqzmj7lbakhgk6lgznmqdra7sr52ndyq7p6wjoq \
  --query "data[?\"display-name\"=='PhotoSight Database'].id | [0]" \
  --raw-output)

echo "ADB ID: $ADB_ID"

# Generate wallet with password
WALLET_DIR=~/.oci/photosight_wallet_new
mkdir -p $WALLET_DIR

echo "Downloading wallet to $WALLET_DIR..."

# Note: OCI CLI requires a password for wallet generation
oci db autonomous-database generate-wallet \
  --autonomous-database-id "$ADB_ID" \
  --file $WALLET_DIR/wallet.zip \
  --password "WalletPassword123!"

if [ $? -eq 0 ]; then
  echo "✅ Wallet downloaded successfully"
  
  # Unzip the wallet
  cd $WALLET_DIR
  unzip -o wallet.zip
  
  echo "✅ Wallet extracted"
  echo "Contents:"
  ls -la
else
  echo "❌ Failed to download wallet"
fi