#!/bin/bash
set -e

echo "Starting installation..."

# Update the system
echo "Updating the system..."
sudo apt-get -y update
sudo apt-get -y dist-upgrade

# Install Node.js
echo "Installing Node.js..."
sudo apt-get -y install kali-linux-headless nodejs npm

# Install 'n' and use it to install a specific version of node
echo "Installing 'n' and specific Node.js version..."
sudo npm install -g n
sudo n 16.17.0

# Remove older versions of nodejs and npm
echo "Removing old versions of Node.js and npm..."
sudo apt-get -y purge nodejs npm
sudo apt-get -y autoremove
sudo apt-get clean

# install echidna
echo "Installing echidna..."
cd lib
npm install
cd ../server/api_server
npm install

# Start the API server in the background
# echo "Starting the API server..."
# npm start &

cd ../web_server
npm install

# Start the web server in the background
# echo "Starting the web server..."
# npm run serve 

echo "Installation completed successfully!"
echo "To launch echidna, please execute the commands below."
echo "cd server/api_server && npm start"
echo "cd server/web_server && npm run serve"
echo "Then, please access to http://localhost:8080"
