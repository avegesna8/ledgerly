#!/bin/zsh

set -u
unsetopt BG_NICE 2>/dev/null || true

PROJECT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
APP_URL="http://localhost:3000"
SERVER_PID=""

cd "$PROJECT_DIR" || exit 1

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null
  fi
}
trap cleanup EXIT INT TERM

echo ""
echo "Starting Ledgerly..."
echo ""

if curl --silent --fail --max-time 2 "$APP_URL" >/dev/null 2>&1; then
  echo "Ledgerly is already running. Opening it now."
  open "$APP_URL"
  exit 0
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required but was not found."
  echo "Install it from https://brew.sh and try again."
  read "?Press Return to close..."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but was not found."
  echo "Run: brew install node"
  read "?Press Return to close..."
  exit 1
fi

if ! pg_isready -q >/dev/null 2>&1; then
  echo "Starting PostgreSQL..."
  brew services start postgresql@14
fi

for attempt in {1..20}; do
  pg_isready -q >/dev/null 2>&1 && break
  sleep 1
done

if ! pg_isready -q >/dev/null 2>&1; then
  echo "PostgreSQL did not become ready."
  read "?Press Return to close..."
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "The .env file is missing."
  echo "Copy .env.example to .env and add your local credentials first."
  read "?Press Return to close..."
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Installing project dependencies..."
  npm install || {
    read "?Dependency installation failed. Press Return to close..."
    exit 1
  }
fi

echo "Checking the database..."
npx prisma migrate deploy || {
  read "?Database setup failed. Press Return to close..."
  exit 1
}

echo "Preparing the app..."

# Build on the first launch and whenever application source is newer than the
# last successful build. Normal later launches can reuse the production build.
NEEDS_BUILD="false"
if [[ ! -f .next/BUILD_ID ]]; then
  NEEDS_BUILD="true"
elif find app components lib prisma types \
  next.config.ts package.json package-lock.json tsconfig.json \
  -newer .next/BUILD_ID -print -quit 2>/dev/null | grep -q .; then
  NEEDS_BUILD="true"
fi

if [[ "$NEEDS_BUILD" == "true" ]]; then
  echo "Refreshing the generated Next.js cache..."
  rm -rf -- "$PROJECT_DIR/.next"
  echo "Building Ledgerly (the first launch can take about a minute)..."
  npm run build || {
    read "?Ledgerly could not be built. Review the error above, then press Return to close..."
    exit 1
  }
else
  echo "Using the existing Ledgerly build."
fi

echo "Starting Ledgerly..."
npm run start &
SERVER_PID=$!

for attempt in {1..60}; do
  if curl --silent --fail --max-time 2 "$APP_URL" >/dev/null 2>&1; then
    echo ""
    echo "Ledgerly is ready at $APP_URL"
    echo "Keep this window open while using Ledgerly."
    echo "Press Control-C here when you want to stop it."
    open "$APP_URL"
    wait "$SERVER_PID"
    exit $?
  fi

  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Ledgerly stopped before it became ready. Review the error above."
    read "?Press Return to close..."
    exit 1
  fi

  sleep 1
done

echo "Ledgerly took too long to start. Review the messages above."
read "?Press Return to close..."
exit 1
