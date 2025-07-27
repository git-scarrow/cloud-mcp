# AWS MCP Learning Path - Zero Cost Edition

## Phase 1: No AWS Account Needed (Current Setup)
Start here - these work immediately with zero setup:

1. **AWS Knowledge Server**
   - Ask: "How do I create an S3 bucket?"
   - Ask: "Explain AWS Lambda best practices"
   - Ask: "What's new in AWS?"

2. **AWS Documentation Server**
   - Search AWS docs offline
   - Learn service details without API calls

3. **CloudFormation Server**
   - Validate templates locally
   - Learn IaC without deploying

## Phase 2: Minimal AWS Access (Optional Future Step)
If you want to explore actual AWS resources:

1. Create IAM user with minimal policy (see iam-policies/)
2. Only use read operations
3. Monitor costs daily with ~/monitor-aws-costs.sh

## Phase 3: Free Tier Services (Advanced)
Services with generous free tiers:
- Lambda: 1M requests/month free
- DynamoDB: 25GB storage free
- CloudWatch Logs: 5GB free

## Safety Rules
1. Always start with Knowledge/Documentation servers
2. Never create resources without understanding costs
3. Set $0.01 billing alerts before adding credentials
4. Use read-only operations whenever possible
