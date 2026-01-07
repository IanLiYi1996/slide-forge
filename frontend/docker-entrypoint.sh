#!/bin/sh
set -e

echo "Initializing database schema..."
npx prisma@6.13.0 db push --accept-data-loss

echo "Starting Next.js application..."
exec node server.js
