#!/bin/sh
# Advanced Nginx startup launcher with dynamic FQDN resolution detection

# 1. Parse target backend host and port (default to docker compose alias)
BACKEND_HOST=${BACKEND_URL:-backend:8000}
BACKEND_NAME=$(echo "$BACKEND_HOST" | cut -d':' -f1)
BACKEND_PORT=$(echo "$BACKEND_HOST" | grep -o ':[0-9]*$' | cut -d':' -f2)
if [ -z "$BACKEND_PORT" ]; then
  BACKEND_PORT="8000"
fi

echo "Verifying backend DNS resolution..."
echo "  - Raw Hostname: ${BACKEND_NAME}"
echo "  - Port:         ${BACKEND_PORT}"

RESOLVED_HOST=""
retries=0
max_retries=60

# 2. Loop until we resolve either the short name or the FQDN
while [ $retries -lt $max_retries ]; do
  for host in "$BACKEND_NAME" "${BACKEND_NAME}.private.render.com" "${BACKEND_NAME}.render.internal"; do
    if getent hosts "$host" >/dev/null 2>&1 || nslookup "$host" >/dev/null 2>&1 || ping -c 1 -W 1 "$host" >/dev/null 2>&1; then
      RESOLVED_HOST="$host"
      break 2
    fi
  done
  echo "Waiting for backend DNS to propagate... (attempt $((retries+1))/$max_retries)"
  retries=$((retries+1))
  sleep 2
done

# 3. Handle resolution outcome
if [ -n "$RESOLVED_HOST" ]; then
  echo "Success: Resolved backend to internal host: ${RESOLVED_HOST}"
  TARGET_UPSTREAM="${RESOLVED_HOST}:${BACKEND_PORT}"
else
  echo "Warning: DNS resolution timed out. Defaulting to raw hostname: ${BACKEND_HOST}"
  TARGET_UPSTREAM="${BACKEND_HOST}"
fi

# 4. Inject resolved host into Nginx config
echo "Configuring Nginx proxy_pass upstream to: http://${TARGET_UPSTREAM}"
sed -i "s|http://backend:8000|http://${TARGET_UPSTREAM}|g" /etc/nginx/conf.d/default.conf

# 5. Launch Nginx
exec nginx -g 'daemon off;'
