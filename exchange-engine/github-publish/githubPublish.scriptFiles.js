import fs from 'fs-extra';
import path from 'path';

// README content generation function
const readMEContent = (project, data) => {
  let domainName = project.domainName,
    apiDomainName = project.apiDomainName;

  if (data) {
    domainName = data.domainName;
    apiDomainName = data.apiDomainName;
  }

  return `
This installation guide is for Ubuntu 20.04 to 22.04 only

# Update your System
sudo apt update -y
sudo apt upgrade -y
sudo apt install ubuntu-restricted-extras -y

# Install important library
sudo apt install unzip zip nginx -y

# Install libraries before installing Mongo Database
sudo apt-get install libatk1.0-0 libnss3 libxss1 libasound2 libatk-bridge2.0-0 libgtk-3-0 -y

# Add missing library Mongo Database
# It's version might changed. 
wget http://security.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2.23_amd64.deb
sudo dpkg -i libssl1.1_1.1.1f-1ubuntu2.23_amd64.deb
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -

echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt-get update -y
sudo apt-get install -y mongodb-org -y
sudo systemctl start mongod

# Install Node JS
sudo apt-get install -y ca-certificates curl gnupg
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_16.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt-get update -y
sudo apt install nodejs -y
sudo apt-get install build-essential -y

# Install PM2
sudo npm install -g pm2

# Install SSL Library
sudo apt install certbot python3-certbot-nginx

# Install redis-server
sudo apt install redis-server -y

# Configure Redis
sudo vim /etc/redis/redis.conf
## Search for requirepass and add password
## Restart Redis
sudo systemctl restart redis.service

# Nginx Configuration
cd /etc/nginx/sites-available/

## Delete default config from available folder.
sudo rm -rf default

## Delete default config from enabled folder too.
cd ../sites-enabled
sudo rm -rf default

## Copy/Create config file in available folder
cd ../sites-available
sudo vim custom-domain.conf

## Now copy the content below into the file:

\`\`\`nginx
server {
    gzip on;
    gzip_types text/plain application/xml text/css application/javascript;
    gzip_min_length 1000;
    
    if ($http_x_forwarded_proto = "http") {
        rewrite ^ https://$host$request_uri? permanent;
    }
    
    location / {
        proxy_redirect off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 1m;
        proxy_http_version 1.1;
        proxy_connect_timeout 1m;
        proxy_pass http://localhost:8080;
    }
    
    server_name ${domainName};

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/${domainName}/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/${domainName}/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = ${domainName}) {
        return 301 https://$host$request_uri;
    } # managed by Certbot
    
    server_name ${domainName};
    listen 80;
    return 404; # managed by Certbot
}

server {
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    server_name ${apiDomainName};

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/${apiDomainName}/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/${apiDomainName}/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = ${apiDomainName}) {
        return 301 https://$host$request_uri;
    } # managed by Certbot
    
    server_name ${apiDomainName};
    listen 80;
    return 404; # managed by Certbot
}
\`\`\`

## Create soft-link of this file in enabled folder
cd ../sites-enabled
sudo ln -s /etc/nginx/sites-available/custom-domain.conf .

## Check Nginx Config is correct or not.
sudo nginx -t

## Restart Nginx 
sudo service nginx restart

# Generate SSL for Main Application
sudo certbot --nginx -d ${domainName}

# Generate SSL for API Application
sudo certbot --nginx -d ${apiDomainName}

# Create some important folder
sudo mkdir /efs
cd /
sudo chmod -R 777 efs
cd efs/
sudo mkdir project-build
cd project-build

# Move views folder from zip to here
cp -r path_where_/views /efs/project-build

cd ../../
sudo chmod 777 -R efs/

sudo mkdir /tmp/thumbnail
sudo mkdir /mnt/fileUploads/
cd /
sudo chmod 777 -R mnt
`;
};

// Create README file
export const createReadMeFile = async (destination, project, data) => {
  const readMeContent = `
# SERVER SETUP
${readMEContent(project, data)}

# Mongo Dump restore
cd where_dump_folder
mongorestore

# Edit Engine Environment file and fill all details properly
vim exchange-engine/.env

# Edit Surface Environment file and fill all details properly
vim exchange-surface/.env

# To start Engine
./engine-build.sh

# To start Surface
./surface-build.sh
  `;
  await fs.writeFile(path.join(destination, 'ReadME.md'), readMeContent);
};

// Create setup script file
export const createSetupScriptFile = async (destination) => {
  const content = `#!/bin/bash

# Taking user input for Redis password, main project folder, main application domain, and API domain
read -s -p "Enter the password you want to set for Redis: " redis_password
echo
read -p "Enter the path to the main project folder: " project_folder
read -p "Enter the domain for the main application (e.g., example.com): " main_domain
read -p "Enter the domain for the API application (e.g., api.example.com): " api_domain

# Setting the views_path according to project_folder
views_path="$project_folder/views"
echo "Views path is: $views_path"

# Function to check if a package is already installed
check_and_install_package() {
  local package=$1
  if ! dpkg -l | grep -q "$package"; then
    echo "Installing $package..."
    sudo apt install "$package" -y
  else
    echo "$package is already installed."
  fi
}

# Updating the System
echo "Updating system packages..."
sudo apt update -y
sudo apt upgrade -y

# Install essential packages
echo "Installing essential libraries..."
check_and_install_package unzip
check_and_install_package zip
check_and_install_package nginx
check_and_install_package ubuntu-restricted-extras
check_and_install_package libatk1.0-0
check_and_install_package libnss3
check_and_install_package libxss1
check_and_install_package libasound2
check_and_install_package libatk-bridge2.0-0
check_and_install_package libgtk-3-0

# Installing missing library for MongoDB
echo "Installing MongoDB dependencies..."
wget http://security.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2.23_amd64.deb
sudo dpkg -i libssl1.1_1.1.1f-1ubuntu2.23_amd64.deb
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "Adding MongoDB repository..."
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt-get update -y
check_and_install_package mongodb-org

# Start MongoDB service
echo "Starting MongoDB service..."
sudo systemctl start mongod

# Installing Node.js
echo "Installing Node.js..."
sudo apt-get install -y ca-certificates curl gnupg
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_16.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt-get update -y
sudo apt install nodejs -y
sudo apt-get install build-essential -y

# Installing PM2
echo "Installing PM2..."
sudo npm install -g pm2

# Installing Certbot and SSL library
check_and_install_package certbot
check_and_install_package python3-certbot-nginx

# Installing and configure Redis
echo "Configuring Redis..."
check_and_install_package redis-server
sudo sed -i "/^# requirepass/ s/^# //; s/requirepass .*/requirepass $redis_password/" /etc/redis/redis.conf
sudo systemctl restart redis.service

# Configure Nginx
echo "Configuring Nginx..."
sudo rm -rf /etc/nginx/sites-available/default
sudo rm -rf /etc/nginx/sites-enabled/default

# Creating required directories
echo "Creating required directories..."
sudo mkdir -p /efs/project-build
sudo chmod -R 777 /efs

# Copy views folder to project-build
if [ -d "$views_path" ]; then
  sudo cp -r "$views_path" /efs/project-build
else
  echo "The specified path for the 'views' folder does not exist."
  exit 1
fi

# Additional folders with permissions
sudo mkdir -p /tmp/thumbnail /mnt/fileUploads
sudo chmod 777 -R /mnt

# MongoDB Dump Restore
if [ -d "$project_folder" ]; then
  echo "Restoring MongoDB dump..."
  cd "$project_folder"
  mongorestore
else
  echo "The specified path for the main project folder does not exist."
  exit 1
fi

# Update .env files with Redis and project folder details
update_env_file() {
  local env_file=$1
  sed -i "s|REDIS_HOST=.*|REDIS_HOST=127.0.0.1|" "$env_file"
  sed -i "s|REDIS_PORT=.*|REDIS_PORT=6379|" "$env_file"
  sed -i "s|REDIS_PASSWORD=.*|REDIS_PASSWORD=$redis_password|" "$env_file"
  sed -i "s|BUILD_FOLDER=.*|BUILD_FOLDER=\${project_folder}/|" "$env_file"
}

echo "Updating .env files..."
if [ -f "$project_folder/exchange-engine/.env" ]; then
  update_env_file "$project_folder/exchange-engine/.env"
fi

if [ -f "$project_folder/exchange-surface/.env" ]; then
  update_env_file "$project_folder/exchange-surface/.env"
fi

# Generate SSL certificates
echo "Generating SSL certificates..."
sudo certbot --nginx -d "$main_domain"
sudo certbot --nginx -d "$api_domain"

# Add Nginx configuration
echo "Configuring Nginx..."
config_file="/etc/nginx/sites-available/custom-domain.conf"
sed -n '/#### BELOW THIS LINE ####/{n; :a; /#### ABOVE THIS LINE ####/!{p; n; ba}}' "$project_folder/ReadME.md" | sudo tee "$config_file" > /dev/null

# Create soft-link in sites-enabled
cd /etc/nginx/sites-enabled
sudo ln -s /etc/nginx/sites-available/custom-domain.conf .

# Check Nginx configuration
echo "Testing Nginx configuration..."
sudo nginx -t

# Restart Nginx
echo "Restarting Nginx..."
sudo service nginx restart

# Build and deploy exchange-engine
echo "Building exchange-engine..."
cd "$project_folder/exchange-engine"
npm install
npm run build
pm2 restart ecosystem.config.js

# Build and deploy exchange-surface
echo "Building exchange-surface..."
cd "$project_folder/exchange-surface"
npm install
npm run publish
pm2 restart ecosystem.config.js

echo "Setup completed successfully!";
`;

  await fs.writeFile(path.join(destination, 'setup.sh'), content);
  await fs.chmod(path.join(destination, 'setup.sh'), 0o755); // Make executable
};

// Create dump script file
export const createDumpScriptFile = async (destination) => {
  const content = `#!/bin/bash

echo "Enter the main folder location (without a trailing /):"
read main_folder

main_folder="$main_folder/"

if [[ ! -d "$main_folder" ]]; then
    echo "Error: Directory does not exist."
    exit 1
fi

zip_files=($(find "$main_folder" -maxdepth 1 -name "*.zip" | sort))

if [[ \${#zip_files[@]} -eq 0 ]]; then
    echo "Error: No zip files found in the given folder."
    exit 1
fi

echo "Found the following zip files:"
for i in "\${!zip_files[@]}"; do
    zip_name=$(basename "\${zip_files[$i]}")
    echo "$((i+1)): $zip_name"
done

echo "Enter the number of the zip file you want to restore:"
read zip_choice

if [[ ! "$zip_choice" =~ ^[0-9]+$ ]] || (( zip_choice < 1 )) || (( zip_choice > \${#zip_files[@]} )); then
    echo "Invalid choice. Please enter a valid number from the list."
    exit 1
fi

selected_zip="\${zip_files[$((zip_choice-1))]}"
zip_name=$(basename "$selected_zip" .zip)

echo "You selected: $selected_zip"

mkdir -p dump/"$zip_name"

echo "Extracting $selected_zip to dump/$zip_name..."
unzip "$selected_zip" -d dump/"$zip_name"

if [[ $? -ne 0 ]]; then
    echo "Error: Failed to extract the zip file."
    exit 1
fi

echo "Running mongorestore command for the extracted dump..."
mongorestore --drop

if [[ $? -ne 0 ]]; then
    echo "Error: Failed to restore MongoDB dump."
    exit 1
else
    echo "MongoDB restore completed successfully."
fi
`;

  await fs.writeFile(path.join(destination, 'dumpRestore.sh'), content);
  await fs.chmod(path.join(destination, 'dumpRestore.sh'), 0o755);
};

// Create deploy Docker script
export const createDeployDockerScript = async (destination) => {
  const content = `#!/bin/bash

error_exit() {
    echo "Error: $1" >&2
    exit 1
}

deploy_docker() {
    echo "Building Docker image..."
    if ! sudo docker build -t codeexport .; then
        error_exit "Docker Build Failed"
    fi
    echo "Running Docker container in interactive mode..."
    if ! sudo docker run --network host codeexport; then
        error_exit "Exited out of Docker"
    fi
}

main() {
    deploy_docker
}

main
`;

  await fs.writeFile(path.join(destination, 'startDocker.sh'), content);
  await fs.chmod(path.join(destination, 'startDocker.sh'), 0o755);
};

// Create Dockerfile
export const createDockerFile = async (destination) => {
  const content = `# Use Node.js base image
FROM node:20

# Install PM2 globally
RUN npm install pm2 -g

# Set working directory
WORKDIR /app

# Copy code from the current directory to the container
COPY . .

# Create a startup script
RUN echo '#!/bin/bash\\n\
  set -e\\n\
  \\n\
  # Print the current working directory\\n\
  echo "Current working directory: $(pwd)"\\n\
  \\n\
  # Start exchange-engine if available\\n\
  if [ -d "./exchange-engine" ]; then\\n\
  cd exchange-engine\\n\
  echo "Installing and starting exchange-engine..."\\n\
  npm install && npm run build\\n\
  pm2 start ecosystem.config.js || echo "PM2 start failed for exchange-engine"\\n\
  cd ..\\n\
  else\\n\
  echo "Warning: exchange-engine directory not found!"\\n\
  fi\\n\
  \\n\
  # Start exchange-surface if available\\n\
  if [ -d "./exchange-surface" ]; then\\n\
  cd exchange-surface\\n\
  echo "Installing and starting exchange-surface..."\\n\
  npm install && npm run publish\\n\
  pm2 start ecosystem.config.js || echo "PM2 start failed for exchange-surface"\\n\
  cd ..\\n\
  else\\n\
  echo "Warning: exchange-surface directory not found!"\\n\
  fi\\n\
  \\n\
  # Wait for all background processes to finish\\n\
  wait\\n\
  \\n\
  # Show logs\\n\
  pm2 logs' > /app/start-apps.sh

# Make the script executable
RUN chmod +x /app/start-apps.sh

# Expose necessary ports
EXPOSE 8080 5000

# Set the entry point to the shell script
CMD ["/bin/bash", "/app/start-apps.sh"]
`;

  await fs.writeFile(path.join(destination, 'Dockerfile'), content);
};

// Create Docker README
export const createDockerReadme = async (destination) => {
  const content = `# Docker Setup Guide

## Prerequisites

1. Have your project folder path ready (without a trailing \`/\`).

---

## Steps to Set Up the Project

1. **Set up permissions for the setup script**:  
   Run the following command to make the \`setupWithDocker.sh\` script executable:

   sudo chmod +x setupWithDocker.sh

2. **Run the setup script**:  
   Execute the setup script:

   ./setupWithDocker.sh
   
   Follow the prompts to provide the following information:
   - Redis password
   - Project folder path
   - Domain for the main application
   - Domain for the API application

   Ensure the script completes successfully without any errors.

3. **Set permissions for the start script**:  
   After the setup is complete, make the \`startDocker.sh\` script executable:

   sudo chmod +x startDocker.sh

4. **Start the application**:  
   Run the following command to start both the frontend and backend services using Docker:

   ./startDocker.sh

---

## Useful Docker Commands

- **View running containers**:  

  sudo docker ps

- **Stop a specific container**:  

  sudo docker stop <container_id>

- **View all containers (including stopped ones)**:  

  sudo docker ps -a

- **Remove a container**:  

  sudo docker rm <container_id>

- **View Docker logs for a container**:  

  sudo docker logs <container_id>

- **Stop all running containers**:  

  sudo docker stop $(docker ps -q)

---
`;

  await fs.writeFile(path.join(destination, 'DockerReadme.md'), content);
};

// Create setup with Docker script
export const createSetupWithDockerScript = async (destination) => {
  const content = `#!/bin/bash

error_exit() {
    echo "Error: $1" >&2
    exit 1
}

# Taking user input for Redis password, main project folder, main application domain, and API domain
read -s -p "Enter the password you want to set for Redis: " redis_password
echo
read -p "Enter the path to the main project folder: " project_folder
read -p "Enter the domain for the main application (e.g., example.com): " main_domain
read -p "Enter the domain for the API application (e.g., api.example.com): " api_domain

# Setting the views_path according to project_folder
views_path="$project_folder/views"
echo "Views path is: $views_path"

# Function to check if a package is already installed
check_and_install_package() {
    local package=$1
    if ! dpkg -l | grep -q "$package"; then
        echo "Installing $package..."
        sudo apt install "$package" -y
    else
        echo "$package is already installed."
    fi
}

# Function to check and install Docker
install_docker() {
    if ! command -v docker &> /dev/null; then
        echo "Docker is not installed. Installing Docker..."
        sudo apt-get update -y
        sudo apt-get install -y \\
            ca-certificates \\
            curl \\
            gnupg \\
            lsb-release
        sudo mkdir -p /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        echo \\
            "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \\
            $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        sudo apt-get update -y
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
        echo "Docker installed successfully."
    else
        echo "Docker is already installed."
    fi
}

# Updating the system
echo "Updating system packages..."
sudo apt update -y
sudo apt upgrade -y

# Check and install essential packages
echo "Checking and installing essential libraries..."
check_and_install_package unzip
check_and_install_package zip
check_and_install_package nginx
check_and_install_package ubuntu-restricted-extras
check_and_install_package libatk1.0-0
check_and_install_package libnss3
check_and_install_package libxss1
check_and_install_package libasound2
check_and_install_package libatk-bridge2.0-0
check_and_install_package libgtk-3-0

# Install Docker
install_docker

# Installing missing library for MongoDB
echo "Checking and installing MongoDB dependencies..."
wget http://security.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2.23_amd64.deb
sudo dpkg -i libssl1.1_1.1.1f-1ubuntu2.23_amd64.deb
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -

# Add MongoDB repository
if ! dpkg -l | grep -q "mongodb-org"; then
    echo "Adding MongoDB repository..."
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
fi
sudo apt-get update -y
check_and_install_package mongodb-org

# Start MongoDB service if not running
if ! systemctl is-active --quiet mongod; then
    echo "Starting MongoDB service..."
    sudo systemctl start mongod
fi

# Installing Node.js if not installed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    sudo apt-get install -y ca-certificates curl gnupg
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_16.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
    sudo apt-get update -y
    sudo apt install nodejs -y
else
    echo "Node.js is already installed."
fi

# Installing PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
else
    echo "PM2 is already installed."
fi

# Installing Certbot and SSL library if not installed
check_and_install_package certbot
check_and_install_package python3-certbot-nginx

# Installing and configuring Redis if not installed
if ! command -v redis-server &> /dev/null; then
    echo "Installing Redis server..."
    sudo apt install redis-server -y
fi
sudo sed -i "/^# requirepass/ s/^# //; s/requirepass .*/requirepass $redis_password/" /etc/redis/redis.conf
sudo systemctl restart redis.service

# Configure Nginx
echo "Configuring Nginx..."
sudo rm -rf /etc/nginx/sites-available/default
sudo rm -rf /etc/nginx/sites-enabled/default

# Creating required directories
echo "Creating required directories..."
sudo mkdir -p /efs/project-build
sudo chmod -R 777 /efs

# Copy views folder to project-build
if [ -d "$views_path" ]; then
    sudo cp -r "$views_path" /efs/project-build
else
    echo "The specified path for the 'views' folder does not exist."
    exit 1
fi

# Additional folders with permissions
sudo mkdir -p /tmp/thumbnail /mnt/fileUploads
sudo chmod 777 -R /mnt

# MongoDB Dump Restore
if [ -d "$project_folder" ]; then
    echo "Restoring MongoDB dump..."
    cd "$project_folder"
    mongorestore
else
    echo "The specified path for the main project folder does not exist."
    exit 1
fi

# Update .env files with Redis and project folder details
update_env_file() {
    local env_file=$1
    sed -i "s|REDIS_HOST=.*|REDIS_HOST=127.0.0.1|" "$env_file"
    sed -i "s|REDIS_PORT=.*|REDIS_PORT=6379|" "$env_file"
    sed -i "s|REDIS_PASSWORD=.*|REDIS_PASSWORD=$redis_password|" "$env_file"
    sed -i "s|BUILD_FOLDER=.*|BUILD_FOLDER=/app/|" "$env_file"
}

echo "Updating .env files..."
if [ -f "$project_folder/exchange-engine/.env" ]; then
    update_env_file "$project_folder/exchange-engine/.env"
fi

if [ -f "$project_folder/exchange-surface/.env" ]; then
    update_env_file "$project_folder/exchange-surface/.env"
fi

# Generate SSL certificates
echo "Generating SSL certificates..."
sudo certbot --nginx -d "$main_domain"
sudo certbot --nginx -d "$api_domain"

# Add Nginx configuration
echo "Configuring Nginx..."
config_file="/etc/nginx/sites-available/custom-domain.conf"
sed -n '/#### BELOW THIS LINE ####/{n; :a; /#### ABOVE THIS LINE ####/!{p; n; ba}}' "$project_folder/ReadME.md" | sudo tee "$config_file" > /dev/null

# Create soft-link in sites-enabled
cd /etc/nginx/sites-enabled
sudo ln -s /etc/nginx/sites-available/custom-domain.conf .

# Check Nginx configuration
echo "Testing Nginx configuration..."
sudo nginx -t

# Restart Nginx
echo "Restarting Nginx..."
sudo service nginx restart

echo "Setup completed successfully!";
`;

  await fs.writeFile(path.join(destination, 'setupWithDocker.sh'), content);
  await fs.chmod(path.join(destination, 'setupWithDocker.sh'), 0o755);
};

export const sampleEnvContent = (type, project, data) => {
  const seoName = project.seoName || '';
  let domainName = project.domainName || '';
  let apiDomainName = project.apiDomainName || '';

  if (data) {
    domainName = data.domainName || domainName;
    apiDomainName = data.apiDomainName || apiDomainName;
  }

  if (type === 'exchange-engine') {
    return `
#Port where application will run
APP_PORT=5000

# Application host/domain name
PROJECT_HOSTNAME=${apiDomainName}

# Mongo Database connection detail for items (records)
ITEM_DB_HOST=127.0.0.1:27017
ITEM_DB_USERNAME=
ITEM_DB_PASSWORD=
ITEM_DB_AUTH_DB=admin

# Fix drapcode domain used when no custom domain has been assigned
EXCHANGE_ENGINE_DOMAIN=api.drapcode.io
EXCHANGE_SURFACE_DOMAIN=drapcode.io

# AWS Configuration for S3 to store files in the given bucket
AWS_SECRET_ACCESS_KEY=AWS_SECRET_ACCESS_KEY
AWS_ACCESS_KEY_ID=AWS_ACCESS_KEY_ID
AWS_S3_BUCKET=AWS_S3_BUCKET
AWS_S3_REGION=AWS_S3_REGION
S3_BUCKET_URL=S3_BUCKET_URL
AWS_S3_IMAGE_URL_PREFIX=AWS_S3_IMAGE_URL_PREFIX

# AWS Configuration for SES (Email Service) to send email
AWS_SES_SECRET_ACCESS_KEY=AWS_SES_SECRET_ACCESS_KEY
AWS_SES_SECRET_SECRET_KEY=AWS_SES_SECRET_SECRET_KEY
AWS_SES_REGION=AWS_SES_REGION

# AWS need a from email
AWS_SES_ADMIN_FROM_EMAIL_NAME=AWS_SES_ADMIN_FROM_EMAIL_NAME

# Email, to send email to Admin for different actions
AWS_SES_ADMIN_EMAIL=AWS_SES_ADMIN_EMAIL

# A path where we have views folder
BUILD_FOLDER=path_where_zip_exported/${seoName}/views

# Fix value, please don't change
APP_ENV=production
NODE_ENV=production

# We used redis for session storage
REDIS_HOST=REDIS_HOST
REDIS_PORT=REDIS_PORT
REDIS_PASSWORD=REDIS_PASSWORD

# Location where file upload will be saved while moving to S3
FILE_UPLOAD_PATH=/mnt/fileUploads/

LOGS_PATH=/home/.pm2/logs
APP_NAME=PROD-HGA:Exchange-Engine-Build
`;
  }

  if (type === 'exchange-surface') {
    return `
APP_PORT=8080
APP_ENV=production

#Application Domain Name
PROJECT_HOSTNAME=${domainName}
EXCHANGE_SURFACE_DOMAIN=drapcode.io

# Mongo Database connection detail for items (records)
ITEM_DB_HOST=127.0.0.1:27017
ITEM_DB_USERNAME=
ITEM_DB_PASSWORD=

# We used redis for session storage
REDIS_HOST=REDIS_HOST
REDIS_PORT=REDIS_PORT
REDIS_PASSWORD=REDIS_PASSWORD

# Environment value
NODE_ENV=production

#AWS S3 details
S3_BUCKET_URL=https://drapcode-upload.s3.amazonaws.com
AWS_S3_IMAGE_URL_PREFIX=https://drapcode-upload.s3.amazonaws.com/

# A path where we have views folder
BUILD_FOLDER=path_where_zip_exported/${seoName}/views
`;
  }

  return '';
};

export const engineStartScript = `FOLDER=exchange-engine
echo "******* Making Build *************"
cd $FOLDER
npm install
echo "**** Make Build ****"
npm run build

pm2 restart ecosystem.config.js
pm2 logs exchange-engine
`;

export const surfaceStartScript = `FOLDER=exchange-surface
echo "******* Making Build *************"
cd $FOLDER
npm install
echo "**** Make Build ****"
npm run publish

pm2 restart ecosystem.config.js
pm2 logs exchange-surface
`;

export const engineStopScript = `FOLDER=exchange-engine
pm2 stop exchange-engine
`;

export const surfaceStopScript = `FOLDER=exchange-surface
pm2 stop exchange-surface
`;
