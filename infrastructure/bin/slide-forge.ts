#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SlideForgeStack } from '../lib/slide-forge-stack';

const app = new cdk.App();

// Get environment from context or use default
const environment = app.node.tryGetContext('environment') || process.env.ENVIRONMENT || 'development';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Create the stack
new SlideForgeStack(app, `SlideForgeStack-${environment}`, {
  stackName: `slide-forge-${environment}`,
  environment,

  env: {
    account,
    region,
  },

  description: `Slide-Forge infrastructure for ${environment} environment`,

  // Stack termination protection (enable for production)
  terminationProtection: environment === 'production',

  // Stack tags
  tags: {
    Project: 'Slide-Forge',
    Environment: environment,
    ManagedBy: 'AWS CDK',
    Repository: 'slide-forge',
  },
});

// Synthesize the CloudFormation template
app.synth();
