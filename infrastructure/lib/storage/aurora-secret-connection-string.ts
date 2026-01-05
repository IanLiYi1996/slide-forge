/**
 * Aurora Secret ConnectionString Updater
 *
 * Automatically adds 'connectionString' field to Aurora-generated secrets.
 * RDS only generates: username, password, host, port, dbname, engine, dbClusterIdentifier
 * This Custom Resource adds: connectionString = postgresql://user:pass@host:port/dbname
 */

import * as cdk from 'aws-cdk-lib';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface AuroraSecretConnectionStringProps {
  /**
   * Aurora secret to update
   */
  secret: secretsmanager.ISecret;
}

export class AuroraSecretConnectionStringUpdater extends Construct {
  constructor(scope: Construct, id: string, props: AuroraSecretConnectionStringProps) {
    super(scope, id);

    // Inline Lambda code to add connectionString field
    const updateSecretCode = `
const { SecretsManagerClient, GetSecretValueCommand, PutSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  if (event.RequestType === 'Delete') {
    return { PhysicalResourceId: event.PhysicalResourceId };
  }

  const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
  const secretArn = event.ResourceProperties.SecretArn;

  try {
    // Get current secret value
    const getCommand = new GetSecretValueCommand({ SecretId: secretArn });
    const secretData = await client.send(getCommand);
    const secret = JSON.parse(secretData.SecretString);

    // Check if connectionString already exists
    if (secret.connectionString) {
      console.log('connectionString already exists, skipping update');
      return { PhysicalResourceId: secretArn };
    }

    // Build connectionString from individual fields
    const connectionString = \`postgresql://\${secret.username}:\${secret.password}@\${secret.host}:\${secret.port}/\${secret.dbname}\`;
    secret.connectionString = connectionString;

    // Update secret with connectionString field
    const putCommand = new PutSecretValueCommand({
      SecretId: secretArn,
      SecretString: JSON.stringify(secret),
    });
    await client.send(putCommand);

    console.log('Successfully added connectionString to secret');
    return { PhysicalResourceId: secretArn };
  } catch (error) {
    console.error('Error updating secret:', error);
    throw error;
  }
};
`;

    // Lambda function to update the secret
    const updateSecretFunction = new lambda.Function(this, 'UpdateSecretFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(updateSecretCode),
      timeout: cdk.Duration.seconds(30),
      // AWS_REGION is automatically provided by Lambda runtime
    });

    // Grant permissions to read and update the secret
    props.secret.grantRead(updateSecretFunction);
    props.secret.grantWrite(updateSecretFunction);

    // Custom Resource Provider
    const provider = new cr.Provider(this, 'Provider', {
      onEventHandler: updateSecretFunction,
    });

    // Custom Resource to trigger the update
    new cdk.CustomResource(this, 'Resource', {
      serviceToken: provider.serviceToken,
      properties: {
        SecretArn: props.secret.secretArn,
        // Add timestamp to force update on every deployment
        UpdateTimestamp: Date.now().toString(),
      },
    });

    new cdk.CfnOutput(this, 'SecretUpdaterStatus', {
      value: 'ConnectionString field will be automatically added to Aurora secret',
      description: 'Aurora Secret Updater Status',
    });
  }
}
