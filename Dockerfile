FROM node:23.3.0-slim AS builder

# Combine RUN commands to reduce layers
RUN npm install -g pnpm@9.12.3 && \
    apt-get update && \
    apt-get install -y git python3 make g++ && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    ln -s /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json ./

# Install dependencies before copying source for better caching
RUN pnpm install --frozen-lockfile

# Copy source files
COPY agent ./agent
COPY packages ./packages
COPY scripts ./scripts
COPY characters ./characters

# Build and prune
RUN pnpm build && pnpm prune --prod

FROM node:23.3.0-slim

RUN npm install -g pnpm@9.12.3 && \
    apt-get update && \
    apt-get install -y git python3 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy files from builder
COPY --from=builder /app ./

CMD ["pnpm", "start", "--non-interactive"]
