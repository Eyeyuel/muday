FROM node:24-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL
ARG VITE_ALLOW_LOCAL_DEV_AUTH=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_ALLOW_LOCAL_DEV_AUTH=$VITE_ALLOW_LOCAL_DEV_AUTH
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/miniapp/package.json apps/miniapp/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci
COPY apps/miniapp apps/miniapp
RUN npm run build --workspace @mezgeb/miniapp

FROM nginx:1.30.4-alpine
COPY apps/miniapp/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/miniapp/dist /usr/share/nginx/html
EXPOSE 8080
