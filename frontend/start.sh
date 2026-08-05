#!/bin/sh
# Nginx startup script with DNS validation loop

# 1. Determine target backend host and port (default to local Compose name)
BACKEND_HOST=${BACKEND_URL:-backend:8000}

# Extract host name without port for DNS query
BACKEND_NAME=$(echo "$BACKEND_HOST" | cut -d':' -f1)

echo "Verifying backend DNS resolution for: ${BACKEND_NAME}..."

# 2. Block startup until backend hostname is resolvable in DNS
# This prevents Nginx from crashing at boot time if the backend service is still initializing
retries=0
max_retries=60
while [ $retries -lt $max_retries ]; do
  if getent hosts "$BACKEND_NAME" >/dev/null 2>&1 || nslookup "$BACKEND_NAME" >/dev/null 2>&1 || ping -c 1 -W 1 "$BACKEND_NAME" >/dev/null 2>&1; then
    echo "Success: Backend DNS resolved."
    break
  fi
  echo "Waiting for backend DNS to become active... (attempt $((retries+1))/$max_retries)"
  retries=$((retries+1))
  sleep 2
done

if [ $retries -eq $max_retries ]; then
  echo "Warning: Backend DNS resolution timed out. Starting Nginx anyway..."
fi

# 3. Inject actual backend host into Nginx config
echo "Configuring Nginx upstream to: ${BACKEND_HOST}"
sed -i "s|http://backend:8000|http://${BACKEND_HOST}|g" /etc/nginx/conf.d/default.conf

# 4. Hand off execution to Nginx
exec nginx -g 'daemon off;'
