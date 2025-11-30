# ZCash Payment Service using zingo-cli
# Deployed on Railway as a sidecar service
#
# Build: docker build -t zcash-service .
# Run: docker run -e SEED_PHRASE="your 24 word seed" -p 8080:8080 zcash-service

# Stage 1: Build zingo-cli from source
FROM rust:1.85-bullseye AS rust-builder

RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
RUN git clone --depth 1 https://github.com/zingolabs/zingolib.git .
RUN cargo build --release --package zingo-cli

# Stage 2: Runtime with Node.js
FROM node:20-bullseye-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl1.1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy zingo-cli binary from builder
COPY --from=rust-builder /build/target/release/zingo-cli /usr/local/bin/zingo-cli

# Create app and wallet directories
WORKDIR /app
RUN mkdir -p /data/wallets

# Copy Node.js app
COPY package.json .
RUN npm install --production

COPY server.js .

# Environment variables
ENV PORT=8080
ENV CHAIN=mainnet
ENV SERVER=https://mainnet.lightwalletd.com:9067
ENV WALLET_DIR=/data/wallets

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s \
    CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080

CMD ["node", "server.js"]

