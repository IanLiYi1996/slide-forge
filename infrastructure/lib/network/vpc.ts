import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { VPC_CONFIG } from '../common/constants';

export interface VpcConstructProps {
  stackName: string;
  maxAzs?: number;
  natGateways?: number;
}

export class VpcConstruct extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly ecsSecurityGroup: ec2.SecurityGroup;
  public readonly auroraSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: VpcConstructProps) {
    super(scope, id);

    // Create VPC with 3 availability zones
    this.vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: props.maxAzs || VPC_CONFIG.maxAzs,
      natGateways: props.natGateways || VPC_CONFIG.natGateways,

      // VPC Flow Logs for security auditing
      flowLogs: {
        'VpcFlowLogs': {
          trafficType: ec2.FlowLogTrafficType.ALL,
          destination: ec2.FlowLogDestination.toCloudWatchLogs(),
        },
      },

      // Subnet configuration
      subnetConfiguration: [
        {
          name: 'public-subnet',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'private-subnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'isolated-subnet', // For Aurora
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // VPC Endpoints (reduce NAT Gateway costs)
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    });

    this.vpc.addInterfaceEndpoint('ECREndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
    });

    this.vpc.addInterfaceEndpoint('ECRDockerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
    });

    // Security Groups

    // 1. ALB Security Group
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: false,
    });

    // Allow HTTP/HTTPS from anywhere for CloudFront VPC Origin access
    // CloudFront uses various IP ranges, so we need to allow 0.0.0.0/0
    // For production security, use AWS WAF and custom headers to restrict access
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'HTTP from CloudFront VPC Origin',
    );

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'HTTPS from CloudFront VPC Origin',
    );

    // 2. ECS Task Security Group
    this.ecsSecurityGroup = new ec2.SecurityGroup(this, 'ECSSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for ECS tasks',
      allowAllOutbound: true,
    });

    this.ecsSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(3000),
      'From ALB',
    );

    // Allow ALB to reach ECS
    this.albSecurityGroup.addEgressRule(
      this.ecsSecurityGroup,
      ec2.Port.tcp(3000),
      'To ECS tasks',
    );

    // 3. Aurora Security Group
    this.auroraSecurityGroup = new ec2.SecurityGroup(this, 'AuroraSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Aurora',
      allowAllOutbound: false,
    });

    this.auroraSecurityGroup.addIngressRule(
      this.ecsSecurityGroup,
      ec2.Port.tcp(5432),
      'PostgreSQL from ECS',
    );

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${props.stackName}-vpc-id`,
    });

    new cdk.CfnOutput(this, 'VpcCidr', {
      value: this.vpc.vpcCidrBlock,
      description: 'VPC CIDR Block',
    });
  }
}
