FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
ENV DIRECT_URL=postgresql://build:build@localhost:5432/build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY 种子数据.xlsx ./种子数据.xlsx
COPY china_mainland_universities.json ./china_mainland_universities.json
RUN npm run prisma:generate -w @guess-salary/api && npm run build -w @guess-salary/shared && npm run build -w @guess-salary/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/data apps/api/data
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/种子数据.xlsx ./种子数据.xlsx
COPY --from=build /app/china_mainland_universities.json ./china_mainland_universities.json
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/seed-production.js && node apps/api/dist/server.js"]
