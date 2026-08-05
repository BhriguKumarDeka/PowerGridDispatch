#!/bin/sh
# Dynamic Nginx resolver and backend configuration script

# 1. Resolve backend host (default to docker network alias for local use)
BACKEND_HOST=${BACKEND_URL:-backend:8000}

# 2. Extract DNS resolver IP from system configuration
RESOLVER_IP=$(awk '/nameserver/ {print $2; exit}' /etc/resolv.conf)
if [ -z "$RESOLVER_IP" ]; then
  RESOLVER_IP="127.0.0.11"
fi

echo "Configuring Nginx with:"
echo "  - Backend Host: ${BACKEND_HOST}"
echo "  - Resolver IP:  ${RESOLVER_IP}"

# 3. Inject variables into config placeholders
sed -i "s/BACKEND_HOST/${BACKEND_HOST}/g" /etc/nginx/conf.d/default.conf
sed -i "s/RESOLVER_IP/${RESOLVER_IP}/g" /etc/nginx/conf.d/default.conf

# 4. Start Nginx
exec nginx -g 'daemon off;'
