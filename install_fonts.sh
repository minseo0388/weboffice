#!/bin/bash
# Oracle Cloud Ubuntu Font Installation Script

set -e

echo "Updating system and installing base font packages..."
sudo apt-get update
sudo apt-get install -y fontconfig curl unzip

echo "Installing Open Source Alternative Fonts (Nanum, Unfonts)..."
sudo apt-get install -y fonts-nanum fonts-nanum-coding fonts-nanum-extra 
sudo apt-get install -y fonts-unfonts-core fonts-unfonts-extra

# Create a local font directory for proprietary/commercial fonts if required
FONT_DIR="/usr/share/fonts/truetype/custom"
sudo mkdir -p $FONT_DIR

# Note: You can copy your commercial TTF fonts to $FONT_DIR here before caching
# sudo cp ./proprietary_fonts/*.ttf $FONT_DIR/

echo "Updating font cache for the system..."
sudo fc-cache -f -v

echo "Fonts successfully installed and cache updated. hwplib can now calculate metrics accurately."
