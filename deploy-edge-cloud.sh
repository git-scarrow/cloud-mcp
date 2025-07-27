#!/bin/bash
# Edge-Cloud Deployment Script for Pi K3s Cluster (Remote Access)

set -e

echo "🚀 Deploying Edge-Cloud Architecture on Pi Cluster"

# Use Tailscale hostnames for cross-network access
MASTER_NODE="pifive0.dory-phrygian.ts.net"

# Function to run kubectl commands on pifive0
remote_kubectl() {
    ssh sam@$MASTER_NODE "sudo k3s kubectl $*"
}

# Copy the manifest to pifive0
echo "📤 Copying manifest to pifive0..."
scp edge-cloud-architecture.yaml sam@$MASTER_NODE:/tmp/

# Deploy the architecture
echo "📦 Applying edge-cloud manifests..."
remote_kubectl apply -f /tmp/edge-cloud-architecture.yaml

# Wait for deployments
echo "⏳ Waiting for pods to be ready..."
remote_kubectl wait --for=condition=ready pod -l app=edge-gateway -n edge-cloud --timeout=300s || true
remote_kubectl wait --for=condition=ready pod -l app=app-server -n edge-cloud --timeout=300s || true

# Check status
echo "📊 Deployment Status:"
remote_kubectl get all -n edge-cloud

# Setup AWS credentials on nodes (if not already done)
echo "🔐 Setting up AWS credentials on nodes..."
for node in pifive0 piiv piiv2; do
    echo "  Configuring $node..."
    ssh sam@$node.dory-phrygian.ts.net "mkdir -p ~/.aws && echo '[default]
region = us-east-1' > ~/.aws/config" || true
done

# Create helper scripts locally
cat > edge-cloud-helpers.sh << 'EOF'
#!/bin/bash

# Use Tailscale hostname
MASTER_NODE="pifive0.dory-phrygian.ts.net"

# Function to run kubectl remotely
remote_kubectl() {
    ssh sam@$MASTER_NODE "sudo k3s kubectl $*"
}

# Function to deploy to cloud
deploy_to_cloud() {
    local app_name=$1
    local image=$2
    
    echo "Deploying $app_name to AWS..."
    # Build and push to ECR
    aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPO
    docker build -t $app_name .
    docker tag $app_name:latest $ECR_REPO/$app_name:latest
    docker push $ECR_REPO/$app_name:latest
    
    # Update ECS service
    aws ecs update-service --cluster prod --service $app_name --force-new-deployment
}

# Function to sync edge to cloud
sync_edge_cloud() {
    echo "Syncing edge data to cloud..."
    remote_kubectl exec -n edge-cloud deployment/app-server -- tar czf - /data | \
        aws s3 cp - s3://edge-backups/$(date +%Y%m%d-%H%M%S).tar.gz
}

# Function to failover to cloud
failover_to_cloud() {
    echo "Failing over to cloud..."
    remote_kubectl patch service edge-gateway -n edge-cloud -p '{"spec":{"selector":{"app":"cloud-gateway"}}}'
}

# Function to monitor edge health
monitor_edge() {
    watch -n 5 'ssh sam@$MASTER_NODE "sudo k3s kubectl top nodes; echo \"---\"; sudo k3s kubectl get pods -n edge-cloud"'
}

# Function to get edge gateway URL
get_edge_url() {
    echo "Edge Gateway URL: http://$MASTER_NODE:31080"
}

# Export functions
export -f deploy_to_cloud sync_edge_cloud failover_to_cloud monitor_edge remote_kubectl get_edge_url
EOF

chmod +x edge-cloud-helpers.sh

echo "✅ Edge-Cloud deployment complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Access edge gateway: http://$MASTER_NODE:31080"
echo "2. Source helpers: source ./edge-cloud-helpers.sh"
echo "3. Monitor edge: monitor_edge"
echo "4. Sync to cloud: sync_edge_cloud"
echo ""
echo "💡 Tip: All kubectl commands are run remotely on $MASTER_NODE"