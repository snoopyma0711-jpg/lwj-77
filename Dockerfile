# 第一阶段：构建前端
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# 第二阶段：后端服务
FROM node:18-alpine

WORKDIR /app

COPY backend/package.json ./
RUN npm install --production

COPY backend/ ./

# 复制前端构建产物
COPY --from=frontend-build /app/frontend/dist ./public

# 创建数据目录
RUN mkdir -p /app/data

# 启动脚本
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
