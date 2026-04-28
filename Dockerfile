FROM node:20-alpine

# 2. 设置容器内的工作目录
WORKDIR /var/www/apayshop

COPY package*.json ./

RUN npm install

COPY . .

RUN npm install entities
RUN npm install libsql
RUN npm install parse5
ARG DB_DIALECT=sqlite
RUN if [ "$DB_DIALECT" = "postgresql" ]; then npm run build-pg; else npm run build; fi


ENV HOST=0.0.0.0
ENV PORT=3000

CMD ["node", ".output/server/index.mjs"]
