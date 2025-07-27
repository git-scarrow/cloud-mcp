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
