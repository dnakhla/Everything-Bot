#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# --- Default Values ---
DEFAULT_REGION="us-east-1"
ZIP_FILE_NAME="factchecker-lambda.zip"
DEPLOY_DIR="lambda-deployment"

# --- Variables ---
LAMBDA_FUNCTION_NAME=""
# Use AWS_REGION env var if set, otherwise default
AWS_REGION="${AWS_REGION:-$DEFAULT_REGION}"
DO_DEPLOY=false
DO_SET_ENV=false
# New flag: create a new Lambda function
DO_CREATE=false

# --- Helper Functions ---
usage() {
    echo "Usage: $0 [--function-name <n>] [--region <region>] [--telegram-token <token>] [--openai-key <key>] [--s3-bucket <bucket>] [--serper-key <key>] [--brave-key <key>] [--deploy] [--set-env] [--create] [--role <role>] [--account-id <id>]"
    echo "  --function-name  : AWS Lambda function name (required for --deploy and --set-env)"
    echo "  --region         : AWS Region (optional, default: $DEFAULT_REGION)"
    echo "  --telegram-token : Telegram Bot Token (required for --set-env)"
    echo "  --openai-key     : OpenAI API Key (required for --set-env)"
    echo "  --s3-bucket      : S3 Bucket Name (required for --set-env)"
    echo "  --serper-key     : Google Serper API Key (for web search functionality)"
    echo "  --brave-key      : Brave Search API Key (for web search functionality)"
    echo "  --deploy         : Flag to deploy the zip file to AWS Lambda"
    echo "  --set-env        : Flag to set environment variables on AWS Lambda"
    echo "  --create         : Flag to create a new AWS Lambda function"
    echo "  --role           : IAM role name for Lambda (required for --create)"
    echo "  --account-id     : AWS Account ID (required for --create)"
    exit 1
}

# --- Simple argument parsing ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --function-name)
            LAMBDA_FUNCTION_NAME="$2"
            shift 2
            ;;
        --region)
            AWS_REGION="$2"
            shift 2
            ;;
        --telegram-token)
            TELEGRAM_TOKEN="$2"
            shift 2
            ;;
        --openai-key)
            OPENAI_KEY="$2"
            shift 2
            ;;
        --s3-bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        --serper-key)
            SERPER_API_KEY="$2"
            shift 2
            ;;
        --brave-key)
            BRAVE_API_KEY="$2"
            shift 2
            ;;
        --create)
            DO_CREATE=true
            shift
            ;;
        --role)
            LAMBDA_ROLE="$2"
            shift 2
            ;;
        --account-id)
            AWS_ACCOUNT_ID="$2"
            shift 2
            ;;
        --deploy)
            DO_DEPLOY=true
            shift
            ;;
        --set-env)
            DO_SET_ENV=true
            shift
            ;;
        --help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# --- Start Script ---
echo -e "${YELLOW}Starting deployment process...${NC}"

# --- Fallback to environment variables if flags not provided ---
if [ -z "$TELEGRAM_TOKEN" ] && [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    TELEGRAM_TOKEN="$TELEGRAM_BOT_TOKEN"
fi
if [ -z "$OPENAI_KEY" ] && [ -n "$OPENAI_API_KEY" ]; then
    OPENAI_KEY="$OPENAI_API_KEY"
fi
if [ -z "$S3_BUCKET" ] && [ -n "$S3_BUCKET_NAME" ]; then
    S3_BUCKET="$S3_BUCKET_NAME"
fi
# Note: SERPER_API_KEY and BRAVE_API_KEY are taken from environment if not overridden by flags

# 1. Create deployment directory and copy files
echo -e "Creating deployment directory: ${GREEN}$DEPLOY_DIR${NC}"
rm -rf $DEPLOY_DIR

# 5a. Create new AWS Lambda function (Conditional)
if [ "$DO_CREATE" = true ]; then
    echo -e "${YELLOW}--- AWS Lambda Creation ---${NC}"
    if [ -z "$LAMBDA_FUNCTION_NAME" ]; then
        echo -e "${RED}Error: Lambda function name (--function-name) is required for creation.${NC}"
        usage
    fi
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}Error: AWS CLI not found. Cannot create function.${NC}"
        exit 1
    fi
    if [ -z "$AWS_ACCOUNT_ID" ] || [ -z "$LAMBDA_ROLE" ]; then
        echo -e "${RED}Error: --account-id and --role are required for --create.${NC}"
        usage
    fi
    ROLE_ARN="arn:aws:iam::$AWS_ACCOUNT_ID:role/$LAMBDA_ROLE"
    echo -e "Creating Lambda function: ${GREEN}$LAMBDA_FUNCTION_NAME${NC} with role ${GREEN}$ROLE_ARN${NC} in region ${GREEN}$AWS_REGION${NC}..."
    aws lambda create-function \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --runtime nodejs16.x \
        --role "$ROLE_ARN" \
        --handler index.handler \
        --zip-file "fileb://$ZIP_FILE_NAME" \
        --layers "arn:aws:lambda:us-east-1:734788133199:layer:ffmpeg:1" \
        --environment "Variables={TELEGRAM_BOT_TOKEN=$TELEGRAM_TOKEN,OPENAI_API_KEY=$OPENAI_KEY,S3_BUCKET_NAME=$S3_BUCKET,SERPER_API_KEY=${SERPER_API_KEY:-},BRAVE_API_KEY=${BRAVE_API_KEY:-}}" \
        --memory-size 512 \
        --region "$AWS_REGION"
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Lambda function created successfully!${NC}"
    else
        echo -e "${RED}Failed to create Lambda function.${NC}"
        exit 1
    fi
fi
mkdir -p $DEPLOY_DIR
mkdir -p $DEPLOY_DIR/services
mkdir -p $DEPLOY_DIR/src
mkdir -p $DEPLOY_DIR/utils

echo -e "${YELLOW}Copying project files...${NC}"
cp index.js config.js package.json package-lock.json $DEPLOY_DIR/
cp services/*.js $DEPLOY_DIR/services/
cp src/*.js $DEPLOY_DIR/src/
cp utils/*.js $DEPLOY_DIR/utils/

# 2. Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
cd $DEPLOY_DIR || exit 1 # Exit if cd fails
npm install --omit=dev --no-fund --no-audit --progress=false # Added flags for cleaner output
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to install dependencies.${NC}"
    cd ..
    rm -rf $DEPLOY_DIR
    exit 1
fi
cd ..

# 3. Create zip file
echo -e "${YELLOW}Creating deployment package...${NC}"
rm -f "$ZIP_FILE_NAME"
cd $DEPLOY_DIR || exit 1 # Exit if cd fails
zip -r "../$ZIP_FILE_NAME" . > /dev/null # Suppress zip output
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to create zip package.${NC}"
    cd ..
    rm -rf $DEPLOY_DIR
    exit 1
fi
cd ..
echo -e "${GREEN}Deployment package created: $ZIP_FILE_NAME ($(du -h $ZIP_FILE_NAME | cut -f1))${NC}"

# 4. Cleanup deployment directory
rm -rf $DEPLOY_DIR

# 5. Deploy to AWS (Conditional)
if [ "$DO_DEPLOY" = true ]; then
    echo -e "${YELLOW}--- AWS Deployment ---${NC}"
    if [ -z "$LAMBDA_FUNCTION_NAME" ]; then
        echo -e "${RED}Error: Lambda function name (--function-name) is required for deployment.${NC}"
        usage
    fi
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}Error: AWS CLI not found. Cannot deploy.${NC}"
        exit 1
    fi

    echo -e "Deploying to AWS Lambda function: ${GREEN}$LAMBDA_FUNCTION_NAME${NC} in region ${GREEN}$AWS_REGION${NC}..."
    aws lambda update-function-code \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --zip-file "fileb://$ZIP_FILE_NAME" \
        --region "$AWS_REGION"
    
    # Update timeout to 5 minutes (300 seconds) and memory to 512MB
    echo -e "Updating Lambda configuration..."
    aws lambda update-function-configuration \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --timeout 300 \
        --memory-size 512 \
        --layers "arn:aws:lambda:us-east-1:734788133199:layer:ffmpeg:1" \
        --region "$AWS_REGION"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Deployment to Lambda successful!${NC}"
    else
        echo -e "${RED}Deployment to Lambda failed.${NC}"
        # Don't exit here, maybe user still wants to set env vars if deployment exists
    fi
fi

# 6. Set Environment Variables (Conditional)
if [ "$DO_SET_ENV" = true ]; then
    echo -e "${YELLOW}--- AWS Environment Variables ---${NC}"
    if [ -z "$LAMBDA_FUNCTION_NAME" ]; then
        echo -e "${RED}Error: Lambda function name (--function-name) is required for setting environment variables.${NC}"
        usage
    fi
     if [ -z "$TELEGRAM_TOKEN" ] || [ -z "$OPENAI_KEY" ] || [ -z "$S3_BUCKET" ]; then
        echo -e "${RED}Error: --telegram-token, --openai-key, and --s3-bucket are required for --set-env.${NC}"
        usage
    fi
     if ! command -v aws &> /dev/null; then
        echo -e "${RED}Error: AWS CLI not found. Cannot set environment variables.${NC}"
        exit 1
    fi

    echo -e "Setting environment variables for Lambda function: ${GREEN}$LAMBDA_FUNCTION_NAME${NC}..."
    ENV_VARIABLES="Variables={TELEGRAM_BOT_TOKEN=$TELEGRAM_TOKEN,OPENAI_API_KEY=$OPENAI_KEY,S3_BUCKET_NAME=$S3_BUCKET,SERPER_API_KEY=${SERPER_API_KEY:-},BRAVE_API_KEY=${BRAVE_API_KEY:-},GPT_MODEL=${GPT_MODEL:-gpt-4.1}}"

    aws lambda update-function-configuration \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --environment "$ENV_VARIABLES" \
        --region "$AWS_REGION"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Environment variables set successfully!${NC}"
    else
        echo -e "${RED}Failed to set environment variables.${NC}"
    fi
fi

# --- Cleanup old deployment files ---
echo -e "${YELLOW}Cleaning up old deployment files...${NC}"
# Only remove the zip file if we're not deploying (keep it for verification if we are)
if [ -f "factchecker-lambda.zip" ] && [ "$DO_DEPLOY" = true ]; then
    echo -e "Keeping latest zip file for deployment verification..."
else
    echo -e "Removing old deployment zip file..."
    rm -f factchecker-lambda.zip
fi

# Clean up any temporary deployment directories that might still exist
if [ -d "$DEPLOY_DIR" ]; then
    echo -e "Removing temporary deployment directory..."
    rm -rf $DEPLOY_DIR
fi

# --- Completion ---
echo -e "${GREEN}Deployment script finished.${NC}"
if [ "$DO_DEPLOY" = false ]; then
    echo -e "${YELLOW}To deploy the package, run again with the --deploy flag and required arguments.${NC}"
fi
if [ "$DO_SET_ENV" = false ]; then
    echo -e "${YELLOW}To set environment variables, run again with the --set-env flag and required arguments.${NC}"
fi