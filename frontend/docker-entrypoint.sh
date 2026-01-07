#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma@6.13.0 migrate deploy

echo "Starting Next.js application..."
exec node server.js
