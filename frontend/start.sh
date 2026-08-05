#!/bin/sh
# Replace the backend hostname in nginx.conf with the BACKEND_URL env var
# Default to 'backend:8000' for docker-compose (local) compatibility

BACKEND_HOST=${BACKEND_URL:-backend:8000}

echo "Configuring nginx to proxy API requests to: ${BACKEND_HOST}"

# Replace backend:8000 with the actual backend URL
sed -i "s|http://backend:8000|http://${BACKEND_HOST}|g" /etc/nginx/conf.d/default.conf

# Start nginx
exec nginx -g 'daemon off;'
