FROM node:20-alpine AS builder
WORKDIR /app

# Add this line to fix permission/read-only issues during npm install
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$PATH:/home/node/.npm-global/bin

# 1. Copy package files
COPY package*.json ./

# 2. Copy the prisma folder
COPY prisma ./prisma/

# 3. Install dependencies
RUN npm install --legacy-peer-deps

# 4. Copy the rest of your original code
COPY . .

# 5. Build the production app
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["npm", "start"]