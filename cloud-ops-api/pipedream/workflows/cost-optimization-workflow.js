/**
 * Cost Optimization Workflow - Pipedream Template
 * Daily analysis of resource utilization and cost optimization opportunities
 */

export default {
  name: "Cloud-Ops Cost Optimization Workflow", 
  version: "0.1.0",
  props: {
    // Timer trigger - runs daily at 6:00 AM
    timer: {
      type: "$.interface.timer",
      default: {
        cron: "0 6 * * *" // Daily at 6:00 AM
      }
    },
    // Cloud-Ops API endpoint
    cloud_ops_api_url: {
      type: "string",
      label: "Cloud-Ops API URL",
      description: "Base URL for Cloud-Ops API",
      default: "http://localhost:5001"
    },
    // Notification settings
    email_recipient: {
      type: "string",
      label: "Report Email",
      description: "Email address for optimization reports"
    },
    // Notion integration
    notion_token: {
      type: "string",
      label: "Notion Integration Token",
      secret: true
    },
    notion_resources_db: {
      type: "string", 
      label: "Notion Resources Database ID"
    },
    // Optimization thresholds
    cpu_underutilized_threshold: {
      type: "integer",
      label: "CPU Underutilized Threshold (%)",
      description: "CPU usage below this % is considered underutilized",
      default: 20
    },
    memory_underutilized_threshold: {
      type: "integer",
      label: "Memory Underutilized Threshold (%)", 
      description: "Memory usage below this % is considered underutilized",
      default: 30
    },
    anomaly_score_threshold: {
      type: "number",
      label: "Anomaly Score Threshold",
      description: "Anomaly score above this value triggers optimization",
      default: 0.7
    }
  },

  async run({ steps, $ }) {
    // Step 1: Fetch current resource data from Cloud-Ops API
    console.log("Fetching resource analytics...");
    
    const resourcesResponse = await $.send.http({
      url: `${this.cloud_ops_api_url}/resources/batch`,
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const resources = resourcesResponse.data?.resources || [];
    console.log(`Found ${resources.length} resources to analyze`);

    // Step 2: Analyze resources for optimization opportunities
    const optimizationOpportunities = [];
    let totalPotentialSavings = 0;

    resources.forEach(resource => {
      const opportunities = [];
      let potentialSavings = 0;

      // CPU underutilization check
      if (resource.CPU_USAGE_PERCENT < this.cpu_underutilized_threshold) {
        opportunities.push({
          type: "cpu_underutilized",
          current_usage: resource.CPU_USAGE_PERCENT,
          threshold: this.cpu_underutilized_threshold,
          recommendation: "Consider right-sizing to smaller instance",
          potential_savings: resource.COST_MONTHLY * 0.3 // 30% savings estimate
        });
        potentialSavings += resource.COST_MONTHLY * 0.3;
      }

      // Memory underutilization check  
      if (resource.MEMORY_USAGE_PERCENT < this.memory_underutilized_threshold) {
        opportunities.push({
          type: "memory_underutilized",
          current_usage: resource.MEMORY_USAGE_PERCENT,
          threshold: this.memory_underutilized_threshold,
          recommendation: "Consider memory-optimized instance type",
          potential_savings: resource.COST_MONTHLY * 0.2 // 20% savings estimate
        });
        potentialSavings += resource.COST_MONTHLY * 0.2;
      }

      // Anomaly score check
      if (resource.ANOMALY_SCORE > this.anomaly_score_threshold) {
        opportunities.push({
          type: "anomaly_detected",
          anomaly_score: resource.ANOMALY_SCORE,
          threshold: this.anomaly_score_threshold,
          recommendation: "Investigate unusual usage patterns",
          potential_savings: resource.COST_MONTHLY * 0.1 // 10% savings estimate
        });
        potentialSavings += resource.COST_MONTHLY * 0.1;
      }

      // Provider-specific optimizations
      if (resource.PROVIDER === "AWS" && resource.COST_MONTHLY > 5) {
        opportunities.push({
          type: "aws_reserved_instance",
          current_cost: resource.COST_MONTHLY,
          recommendation: "Consider Reserved Instance for long-term savings",
          potential_savings: resource.COST_MONTHLY * 0.4 // 40% savings with RI
        });
        potentialSavings += resource.COST_MONTHLY * 0.4;
      }

      if (resource.PROVIDER === "GCP" && resource.STATUS === "TERMINATED") {
        opportunities.push({
          type: "terminated_resource_cleanup",
          recommendation: "Remove terminated resource from tracking",
          potential_savings: 0 // No cost savings but cleanup
        });
      }

      if (opportunities.length > 0) {
        optimizationOpportunities.push({
          resource_id: resource.RESOURCE_ID,
          resource_uuid: resource.RESOURCE_UUID,
          provider: resource.PROVIDER,
          resource_type: resource.RESOURCE_TYPE,
          current_cost: resource.COST_MONTHLY,
          opportunities,
          total_potential_savings: potentialSavings
        });
        totalPotentialSavings += potentialSavings;
      }
    });

    console.log(`Found ${optimizationOpportunities.length} resources with optimization opportunities`);
    console.log(`Total potential savings: $${totalPotentialSavings.toFixed(2)}/month`);

    // Step 3: Generate optimization report
    const report = {
      analysis_date: new Date().toISOString(),
      total_resources: resources.length,
      resources_with_opportunities: optimizationOpportunities.length,
      total_potential_savings_monthly: totalPotentialSavings,
      optimization_opportunities: optimizationOpportunities
    };

    // Step 4: Update high-impact opportunities in Notion
    if (this.notion_token && optimizationOpportunities.length > 0) {
      // Sort by potential savings, take top 5
      const topOpportunities = optimizationOpportunities
        .sort((a, b) => b.total_potential_savings - a.total_potential_savings)
        .slice(0, 5);

      for (const opportunity of topOpportunities) {
        if (opportunity.total_potential_savings > 1) { // Only create tasks for >$1/month savings
          try {
            await $.send.http({
              url: "https://api.notion.com/v1/pages",
              method: "POST",
              headers: {
                "Authorization": `Bearer ${this.notion_token}`,
                "Content-Type": "application/json", 
                "Notion-Version": "2022-06-28"
              },
              data: {
                parent: {
                  database_id: this.notion_resources_db
                },
                properties: {
                  "Name": {
                    title: [
                      {
                        text: {
                          content: `💰 Optimize ${opportunity.provider} ${opportunity.resource_type}`
                        }
                      }
                    ]
                  },
                  "Resource UUID": {
                    rich_text: [
                      {
                        text: {
                          content: opportunity.resource_uuid
                        }
                      }
                    ]
                  },
                  "Provider": {
                    select: {
                      name: opportunity.provider
                    }
                  },
                  "Status": {
                    select: {
                      name: "Optimization Needed"
                    }
                  },
                  "Monthly Cost": {
                    number: opportunity.current_cost
                  },
                  "Last Updated": {
                    date: {
                      start: new Date().toISOString()
                    }
                  }
                },
                children: [
                  {
                    object: "block",
                    type: "heading_2",
                    heading_2: {
                      rich_text: [
                        {
                          type: "text",
                          text: {
                            content: `Potential Savings: $${opportunity.total_potential_savings.toFixed(2)}/month`
                          }
                        }
                      ]
                    }
                  },
                  ...opportunity.opportunities.map(opp => ({
                    object: "block",
                    type: "bulleted_list_item",
                    bulleted_list_item: {
                      rich_text: [
                        {
                          type: "text",
                          text: {
                            content: `${opp.type}: ${opp.recommendation} (Save: $${(opp.potential_savings || 0).toFixed(2)}/month)`
                          }
                        }
                      ]
                    }
                  }))
                ]
              }
            });
            console.log(`Created Notion optimization task for ${opportunity.resource_id}`);
          } catch (error) {
            console.error(`Failed to create Notion task for ${opportunity.resource_id}:`, error);
          }
        }
      }
    }

    // Step 5: Send optimization report via email
    if (this.email_recipient) {
      const htmlReport = `
        <h2>Daily Cost Optimization Report</h2>
        <p><strong>Analysis Date:</strong> ${new Date().toLocaleDateString()}</p>
        
        <h3>Summary</h3>
        <ul>
          <li><strong>Total Resources:</strong> ${report.total_resources}</li>
          <li><strong>Resources with Opportunities:</strong> ${report.resources_with_opportunities}</li>
          <li><strong>Potential Monthly Savings:</strong> $${totalPotentialSavings.toFixed(2)}</li>
        </ul>

        <h3>Top Optimization Opportunities</h3>
        ${optimizationOpportunities.slice(0, 5).map(opp => `
          <div style="border: 1px solid #ddd; padding: 10px; margin: 10px 0;">
            <h4>${opp.provider} ${opp.resource_type} (${opp.resource_uuid})</h4>
            <p><strong>Current Cost:</strong> $${opp.current_cost}/month</p>
            <p><strong>Potential Savings:</strong> $${opp.total_potential_savings.toFixed(2)}/month</p>
            <ul>
              ${opp.opportunities.map(o => `<li>${o.recommendation}</li>`).join('')}
            </ul>
          </div>
        `).join('')}

        <p><em>This report was generated automatically by the Cloud-Ops Cost Optimization system.</em></p>
      `;

      await $.send.email({
        to: this.email_recipient,
        subject: `Cloud-Ops Optimization Report - $${totalPotentialSavings.toFixed(2)} potential savings`,
        html: htmlReport
      });
      console.log("Optimization report sent via email");
    }

    // Step 6: Return results
    return {
      success: true,
      report,
      actions_taken: [
        this.notion_token ? "notion_tasks_created" : null,
        this.email_recipient ? "email_report_sent" : null
      ].filter(Boolean)
    };
  }
};