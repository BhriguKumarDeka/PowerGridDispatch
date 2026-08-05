#!/bin/sh
# Nginx startup script with multi-nameserver injection

# 1. Determine target backend host and port
BACKEND_HOST=${BACKEND_URL:-backend:8000}

# 2. Extract all nameservers from /etc/resolv.conf
# This ensures Nginx queries Render's private nameserver (typically 10.x.x.x)
# as well as any public fallbacks listed in system resolver
RESOLVER_IPS=$(awk '/nameserver/ {list=list $2 " "} END {sub(/ $/, "", list); print list}' /etc/resolv.conf)

if [ -z "$RESOLVER_IPS" ]; then
  RESOLVER_IPS="127.0.0.11"
fi

echo "Configuring Nginx with:"
echo "  - Backend Host:  ${BACKEND_HOST}"
echo "  - Resolver IPs:  ${RESOLVER_IPS}"

# 3. Inject variables into config placeholders
sed -i "s/BACKEND_HOST/${BACKEND_HOST}/g" /etc/nginx/conf.d/default.conf
sed -i "s/RESOLVER_IPS/${RESOLVER_IPS}/g" /etc/nginx/conf.d/default.conf

# 4. Start Nginx
exec nginx -g 'daemon off;'
