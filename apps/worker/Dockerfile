FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN corepack enable
CMD ["sh", "-c", "echo 'Worker container scaffold created. Install deps in monorepo root before runtime.'"]
