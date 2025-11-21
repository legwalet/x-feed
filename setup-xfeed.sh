#!/bin/bash

# Script to add xfeed to /etc/hosts

echo "Adding xfeed to /etc/hosts..."
echo "You will be prompted for your password."

# Check if xfeed already exists
if grep -q "xfeed" /etc/hosts; then
    echo "⚠️  xfeed already exists in /etc/hosts"
    echo "Current entry:"
    grep "xfeed" /etc/hosts
else
    echo "127.0.0.1 xfeed" | sudo tee -a /etc/hosts
    echo "✅ xfeed added to /etc/hosts"
    echo ""
    echo "You can now access the app at: http://xfeed:3300"
fi

echo ""
echo "To verify, run: ping -c 1 xfeed"

