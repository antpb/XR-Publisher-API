#!/bin/bash

# Check if wrangler is installed
if ! command -v npx wrangler &> /dev/null
then
    echo "Wrangler is not installed. Please install it first."
    echo "You can install it using: npm install -g wrangler"
    exit 1
fi

echo "Creating items bucket..."
output=$(npx wrangler r2 bucket create "xr-publisher-items" 2>&1)
if [[ $output != *"Created bucket"* ]]; then
    echo "Error creating items R2 bucket: $output"
    exit 1
fi
echo "Items R2 bucket created successfully."

# Create CORS rules file
echo "Creating CORS rules..."
cat > cors-rules.json << EOL
{
  "cors_rules": [
    {
      "allowed_origins": ["*"],
      "allowed_methods": ["GET", "HEAD", "POST", "PUT", "DELETE"],
      "allowed_headers": ["*"],
      "max_age_seconds": 3600
    }
  ]
}
EOL

# Apply CORS rules
echo "Applying CORS rules to items bucket..."
output=$(npx wrangler r2 bucket cors put "xr-publisher-items" --rules ./cors-rules.json 2>&1)
if [[ $output == *"Error"* ]]; then
    echo "Error setting CORS rules for items bucket: $output"
    exit 1
fi
echo "CORS rules applied successfully."

echo "Adding bucket configuration to wrangler.toml..."
if grep -q "ITEMS_BUCKET" wrangler.toml; then
    echo "ITEMS_BUCKET configuration already exists in wrangler.toml"
else
    # Add the new configuration before [env.production]
    sed -i '' '/\[env\.production\]/i\
\
[[r2_buckets]]\
binding = "ITEMS_BUCKET"\
bucket_name = "xr-publisher-items"\
preview_bucket_name = "xr-publisher-items-preview"\
\
' wrangler.toml
fi

echo "Deploying worker with new configuration..."
output=$(npx wrangler deploy 2>&1)
if [[ $output == *"Error"* ]]; then
    echo "Error deploying worker: $output"
    exit 1
fi
echo "Worker deployed successfully."

echo "Items bucket setup complete!"
echo "1. R2 bucket 'xr-publisher-items' created"
echo "2. CORS rules applied"
echo "3. wrangler.toml updated with ITEMS_BUCKET configuration"
echo "4. Worker redeployed with new configuration" 