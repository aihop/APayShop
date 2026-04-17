FROM node:20-alpine

# 2. 设置容器内的工作目录
WORKDIR /var/www/apayshop

COPY package*.json ./

RUN npm install

COPY . .

RUN npm install entities
RUN npm install libsql
RUN npm install parse5
RUN npm run build


ENV HOST=0.0.0.0
ENV PORT=3000

CMD ["node", ".output/server/index.mjs"]