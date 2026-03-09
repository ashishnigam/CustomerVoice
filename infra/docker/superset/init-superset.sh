#!/bin/sh
set -eu

export SUPERSET_CONFIG_PATH="${SUPERSET_CONFIG_PATH:-/app/pythonpath/superset_config.py}"

until superset db upgrade; do
  echo "Waiting for Superset metadata database..."
  sleep 5
done

superset fab create-admin \
  --username "${SUPERSET_ADMIN_USERNAME:-admin}" \
  --firstname "${SUPERSET_ADMIN_FIRSTNAME:-CustomerVoice}" \
  --lastname "${SUPERSET_ADMIN_LASTNAME:-Admin}" \
  --email "${SUPERSET_ADMIN_EMAIL:-admin@customervoice.local}" \
  --password "${SUPERSET_ADMIN_PASSWORD:-admin}" || true

superset init

exec superset run -h 0.0.0.0 -p 8088
