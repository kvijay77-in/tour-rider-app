# Deployment Guide

[← Back to README](../README.md)

This guide covers deploying the AWS resources (Cognito User Pool) required by the Tour Rider App.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [AWS Resources Created](#aws-resources-created)
- [One-Time Setup](#one-time-setup)
- [Deploy via GitHub Actions](#deploy-via-github-actions)
- [Deploy via CLI](#deploy-via-cli)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Tour-Data-API Integration](#tour-data-api-integration)
- [Stack Management](#stack-management)

---

## Overview

The Tour Rider App deployment process varies based on the subscription mode:

**Single Subscription Mode** (recommended for individual tour operators):
- App is tied to a specific subscription at build time
- No invitation codes required
- Dedicated AWS resources per organizer
- See [Subscription Packaging Guide](subscription-packaging-guide.md) for detailed configuration

**Multi Subscription Mode** (for SaaS platforms):
- App supports multiple organizers via invitation URLs
- Dynamic configuration per organizer
- Requires additional infrastructure for invitation management

This guide primarily covers **AWS resource deployment** (Cognito User Pool). For subscription-specific app builds, see the [Subscription Packaging Guide](subscription-packaging-guide.md).

---

## Subscription Mode Considerations

The Tour Rider App uses a **dedicated Cognito User Pool** for each organizer's riders, separate from the tour-mgmt-app (Check-In App) staff pool. This provides:

- **User isolation** — Riders and staff in separate pools
- **Independent security controls** — Password policies and MFA tailored for riders
- **Simplified access** — All users in this pool are riders (no group-based RBAC needed)
- **Self-registration** — Riders can create their own accounts

The deployment creates these Cognito resources via a CloudFormation stack. The app itself (React Native / Expo) is not deployed through this process — it runs on user devices.

## Prerequisites

- **AWS CLI** v2 installed and configured
- **AWS Account** with permissions to create CloudFormation stacks and Cognito resources
- **GitHub repository** access (for GitHub Actions deployment)

## AWS Resources Created

The `cloudformation/rider-cognito.yaml` template creates:

| Resource | Type | Description |
|----------|------|-------------|
| `RiderUserPool` | Cognito User Pool | Dedicated pool for rider authentication |
| `RiderUserPoolClient` | Cognito User Pool Client | App client (no secret, for mobile/web) |

### User Pool Configuration

- **Sign-in**: Email-based
- **Self-registration**: Enabled (riders can sign up)
- **Email verification**: Required (verification code)
- **Password policy**: Min 8 chars, uppercase, lowercase, numbers required
- **Custom attributes**: `custom:profileId` (links to RiderProfile in tour-data-api)
- **Account recovery**: Via verified email

### Naming Convention

Resources are named per environment:
- Stack: `tour-rider-cognito-{env}` (e.g., `tour-rider-cognito-dev`)
- User Pool: `tour-rider-{env}-users`
- Client: `tour-rider-{env}-app-client`

## One-Time Setup

### 1. Set Up GitHub OIDC (Recommended)

This enables GitHub Actions to deploy to AWS without static access keys. Skip this if your AWS account already has a GitHub OIDC provider (e.g., from tour-data-api setup).

```bash
# If GitHub OIDC provider already exists (from tour-data-api):
aws cloudformation deploy \
  --template-file cloudformation/github-oidc.yaml \
  --stack-name tour-rider-app-github-oidc \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    GitHubOrg=<your-github-org-or-username> \
    GitHubRepo=tour-rider-app \
    CreateOIDCProvider=false

# If this is the first OIDC setup in the account:
aws cloudformation deploy \
  --template-file cloudformation/github-oidc.yaml \
  --stack-name tour-rider-app-github-oidc \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    GitHubOrg=<your-github-org-or-username> \
    GitHubRepo=tour-rider-app \
    CreateOIDCProvider=true
```

### 2. Configure GitHub Secrets

After deploying the OIDC stack, get the Role ARN from the outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name tour-rider-app-github-oidc \
  --query "Stacks[0].Outputs[?OutputKey=='DeployRoleArn'].OutputValue" \
  --output text
```

Add this as a GitHub repository secret:
- **Secret name**: `AWS_DEPLOY_ROLE_ARN`
- **Secret value**: The Role ARN from the output above

## Deploy via GitHub Actions

1. Go to the repository's **Actions** tab
2. Select the **Deploy Cognito Resources** workflow
3. Click **Run workflow**
4. Select the target environment (dev / test / prod)
5. Click **Run workflow**

The workflow will deploy the CloudFormation stack and print the Cognito resource IDs in the job output.

## Deploy via CLI

For manual deployments or local development:

```bash
# Deploy to dev environment
aws cloudformation deploy \
  --template-file cloudformation/rider-cognito.yaml \
  --stack-name tour-rider-cognito-dev \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides Environment=dev

# Deploy to test environment
aws cloudformation deploy \
  --template-file cloudformation/rider-cognito.yaml \
  --stack-name tour-rider-cognito-test \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides Environment=test

# Deploy to production
aws cloudformation deploy \
  --template-file cloudformation/rider-cognito.yaml \
  --stack-name tour-rider-cognito-prod \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides Environment=prod
```

### Get Stack Outputs

After deployment, retrieve the Cognito resource IDs:

```bash
STACK_NAME=tour-rider-cognito-dev

# User Pool ID
aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='RiderUserPoolId'].OutputValue" \
  --output text

# App Client ID
aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='RiderUserPoolClientId'].OutputValue" \
  --output text
```

## Post-Deployment Configuration

After deploying the Cognito stack, update the app's environment configuration:

### 1. Update `.env` File

```bash
# Get the values from stack outputs
STACK_NAME=tour-rider-cognito-dev

USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='RiderUserPoolId'].OutputValue" \
  --output text)

CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='RiderUserPoolClientId'].OutputValue" \
  --output text)

echo "EXPO_PUBLIC_AWS_USER_POOL_ID=${USER_POOL_ID}"
echo "EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID=${CLIENT_ID}"
```

Copy these values into your `.env` file.

### 2. Verify Configuration

Start the development server and check the Amplify configuration log:

```bash
npx expo start
```

Look for the log message: `[Amplify] Configured for pool <your-pool-id>`

## Tour-Data-API Integration

The tour-data-api backend must be configured to accept JWT tokens from the rider user pool. This requires updating the API Gateway authorizer to trust both user pools.

### Provide These Values to the Tour-Data-API Team

After deploying the Cognito stack, share these details:

```bash
STACK_NAME=tour-rider-cognito-dev

# User Pool ARN (needed for API Gateway authorizer)
aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='RiderUserPoolArn'].OutputValue" \
  --output text

# App Client ID (needed for JWT audience validation)
aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='RiderUserPoolClientId'].OutputValue" \
  --output text
```

The tour-data-api team will need to add these as additional trusted issuers/audiences in their API Gateway JWT authorizer configuration.

## Stack Management

### View Stack Status

```bash
aws cloudformation describe-stacks \
  --stack-name tour-rider-cognito-dev \
  --query "Stacks[0].StackStatus" \
  --output text
```

### View All Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name tour-rider-cognito-dev \
  --query "Stacks[0].Outputs" \
  --output table
```

### Delete a Stack

> **Warning**: Deleting a stack will remove the User Pool and all user accounts in it. This action is irreversible.

```bash
aws cloudformation delete-stack --stack-name tour-rider-cognito-dev
```

---

For more information, see:
- [Subscription Packaging Guide](subscription-packaging-guide.md) — Build app for specific subscription
- [Development Guide](development-guide.md) — Local development setup
- [Solution Design](SolutionDesign.md) — Architecture and authentication design
- [Requirements](Requirements.md) — Functional requirements
