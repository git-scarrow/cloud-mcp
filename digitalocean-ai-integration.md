# DigitalOcean Serverless AI Integration

## Overview
DigitalOcean's Serverless Inference platform provides on-demand access to foundation models without infrastructure management. This can augment your edge-cloud architecture with AI capabilities while staying within budget.

## Key Features
- **Pay-per-token billing**: Only pay for what you use
- **Multiple models**: Access to Llama 3.3 70B and other models
- **No infrastructure**: Serverless execution
- **Simple API**: OpenAI-compatible endpoints

## Integration with Your Architecture

### 1. Edge AI Processing
Add intelligent decision-making to your Raspberry Pi devices:

```javascript
// edge-ai-processor.js
const DO_INFERENCE_URL = 'https://inference.do-ai.run/v1';
const MODEL_ACCESS_KEY = process.env.DO_MODEL_ACCESS_KEY;

async function analyzeMetrics(deviceMetrics) {
    const response = await fetch(`${DO_INFERENCE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${MODEL_ACCESS_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama3.3-70b-instruct',
            messages: [{
                role: 'system',
                content: 'Analyze IoT device metrics and identify anomalies. Be concise.'
            }, {
                role: 'user',
                content: `Device: ${deviceMetrics.id}\nCPU: ${deviceMetrics.cpu}%\nMemory: ${deviceMetrics.memory}%\nDisk: ${deviceMetrics.disk}%\nIdentify any issues.`
            }],
            temperature: 0.3,
            max_tokens: 100
        })
    });
    
    return await response.json();
}
```

### 2. Cost-Aware AI Usage
With your $15/month budget, implement smart AI usage:

```javascript
// cost-aware-ai.js
const AI_DAILY_BUDGET = 0.10; // $3/month for AI
let dailyTokensUsed = 0;

async function costAwareInference(prompt, priority = 'low') {
    // Estimate tokens (rough: 1 token ≈ 4 chars)
    const estimatedTokens = prompt.length / 4;
    
    // Check budget
    if (priority !== 'critical' && dailyTokensUsed > AI_DAILY_BUDGET) {
        return { error: 'Daily AI budget exceeded', fallback: true };
    }
    
    // Use shorter max_tokens for non-critical requests
    const maxTokens = priority === 'critical' ? 200 : 50;
    
    // Make request...
    dailyTokensUsed += estimatedTokens;
}
```

### 3. Pipedream Workflow Integration
Add AI analysis to your alert processing:

```javascript
// In Pipedream workflow - AI Analysis Step
export default defineComponent({
  async run({ steps, $ }) {
    const alert = steps.input_validation.$return_value;
    
    // Only use AI for critical alerts to save costs
    if (alert.severity !== 'Critical') {
      return { ai_analysis: 'Skipped - non-critical alert' };
    }
    
    const response = await fetch('https://inference.do-ai.run/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DO_MODEL_ACCESS_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3.3-70b-instruct',
        messages: [{
          role: 'system',
          content: 'You are a DevOps expert. Analyze this alert and suggest immediate actions.'
        }, {
          role: 'user',
          content: `Alert: ${alert.message}\nType: ${alert.alert_type}\nDevice: ${alert.resource_id}`
        }],
        temperature: 0.3,
        max_tokens: 150
      })
    });
    
    const aiResponse = await response.json();
    
    $.export("ai_analysis", {
      recommendation: aiResponse.choices[0].message.content,
      tokens_used: aiResponse.usage.total_tokens,
      model: 'llama3.3-70b-instruct'
    });
    
    return aiResponse;
  }
});
```

### 4. Local Edge Intelligence
Cache AI responses to minimize API calls:

```bash
#!/bin/bash
# edge-ai-cache.sh
CACHE_DIR="/var/cache/edge-ai"
CACHE_TTL=3600  # 1 hour

get_ai_analysis() {
    local query_hash=$(echo -n "$1" | md5sum | cut -d' ' -f1)
    local cache_file="$CACHE_DIR/$query_hash"
    
    # Check cache
    if [ -f "$cache_file" ]; then
        local age=$(($(date +%s) - $(stat -c %Y "$cache_file")))
        if [ $age -lt $CACHE_TTL ]; then
            cat "$cache_file"
            return 0
        fi
    fi
    
    # Make API call
    local response=$(curl -s https://inference.do-ai.run/v1/chat/completions \
        -H "Authorization: Bearer $DO_MODEL_ACCESS_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"model\": \"llama3.3-70b-instruct\",
            \"messages\": [{\"role\": \"user\", \"content\": \"$1\"}],
            \"max_tokens\": 50
        }")
    
    # Cache response
    echo "$response" > "$cache_file"
    echo "$response"
}
```

## Cost Optimization Strategies

### 1. Batch Processing
Combine multiple queries into single requests:

```javascript
const batchAnalysis = {
    messages: [{
        role: 'user',
        content: `Analyze these devices:
1. ${device1.metrics}
2. ${device2.metrics}
3. ${device3.metrics}
Identify issues for each.`
    }]
};
```

### 2. Tiered Intelligence
- **Level 1**: Local rule-based checks (free)
- **Level 2**: Cached AI insights (minimal cost)
- **Level 3**: Real-time AI analysis (for critical issues only)

### 3. Token Budget Management
```javascript
const TOKEN_PRICING = {
    input: 0.00015,   // per 1K tokens
    output: 0.0006    // per 1K tokens
};

const MONTHLY_AI_BUDGET = 3.00;  // $3 of your $15 budget
const DAILY_TOKEN_LIMIT = Math.floor((MONTHLY_AI_BUDGET / 30) / TOKEN_PRICING.output * 1000);
```

## Implementation Steps

1. **Get DO Access Key**:
   ```bash
   # Store in 1Password
   op item create --category="API Credential" \
     --title="DigitalOcean AI Access Key" \
     --vault="Personal" \
     credential="your-access-key"
   ```

2. **Test Connection**:
   ```bash
   curl https://inference.do-ai.run/v1/models \
     -H "Authorization: Bearer $DO_MODEL_ACCESS_KEY"
   ```

3. **Deploy to Edge Devices**:
   ```bash
   # Add to edge monitoring script
   for device in pifive0 piiv piiv2; do
     ssh $device "echo 'export DO_MODEL_ACCESS_KEY=xxx' >> ~/.bashrc"
   done
   ```

4. **Monitor Usage**:
   Track token usage in your cost optimization workflow to stay within budget.

## Use Cases for Your Setup

1. **Anomaly Explanation**: When CPU spikes occur, get AI analysis of potential causes
2. **Log Analysis**: Summarize error logs intelligently
3. **Predictive Maintenance**: Analyze trends to predict failures
4. **Cost Optimization**: AI suggestions for reducing resource usage
5. **Incident Response**: Automated root cause analysis

## Budget-Friendly Configuration

With $3/month for AI ($0.10/day):
- ~166K input tokens/month
- ~5K output tokens/month
- ~150-200 intelligent analyses/month
- Perfect for critical alerts only

This serverless AI integration adds intelligence to your edge-cloud architecture without breaking your $15/month budget!