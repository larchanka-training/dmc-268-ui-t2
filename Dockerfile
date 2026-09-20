FROM node:24-alpine AS build

WORKDIR /app

RUN npm install --global pnpm@12.4.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

ENV HUSKY=0

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build


FROM nginx:1.28-alpine AS runtime

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
