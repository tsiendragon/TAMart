# DEPLOY_PLAYBOOK — 后端部署手册

## 部署架构

```
本地 / CI  →  Docker Hub / Registry  →  生产服务器
                                          ├── docker-compose.prod.yml
                                          ├── FastAPI + Uvicorn (Gunicorn)
                                          ├── MySQL 8 + Redis
                                          └── Nginx（反向代理）
```

## 环境变量（生产）

```bash
# .env.prod（不入 git，在服务器上手动创建或通过 CI secrets 注入）
DATABASE_URL=mysql+pymysql://user:password@db:3306/appdb
JWT_SECRET_KEY=<strong-random-secret>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
ENVIRONMENT=production
```

## docker-compose.prod.yml 参考

```yaml
# backend/docker-compose.prod.yml（实际文件由 DevOps 在项目中维护）
version: "3.9"
services:
  api:
    image: <registry>/<app>:${TAG:-latest}
    environment:
      - DATABASE_URL
      - JWT_SECRET_KEY
      - ENVIRONMENT=production
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "8000:8000"
    restart: unless-stopped

  db:
    image: mysql:8.0
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_0900_ai_ci
    environment:
      MYSQL_DATABASE: appdb
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
    volumes:
      - mysqldata:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${DB_ROOT_PASSWORD}"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  mysqldata:
```

## 部署步骤

```bash
# 1. 拉取最新镜像
docker compose -f backend/docker-compose.prod.yml pull api

# 2. 运行 Alembic 迁移（先于重启）
docker compose -f backend/docker-compose.prod.yml run --rm api \
  alembic upgrade head

# 3. 滚动重启
docker compose -f backend/docker-compose.prod.yml up -d api

# 4. 健康检查
sleep 30
curl -sf https://<domain>/health && echo "✅ OK" || echo "❌ FAILED"

# 5. 查看日志
docker compose -f backend/docker-compose.prod.yml logs api --tail 50
```

## 回滚

```bash
# 方法 A: 回退到上一个镜像 tag
docker compose -f backend/docker-compose.prod.yml stop api
docker tag <registry>/<app>:<prev-tag> <registry>/<app>:latest
docker compose -f backend/docker-compose.prod.yml up -d api

# 方法 B: Alembic 数据库回滚（谨慎操作）
docker compose -f backend/docker-compose.prod.yml run --rm api \
  alembic downgrade -1
```

## 部署记录

| 日期 | 版本 | 功能/范围 | 状态 |
|------|------|----------|------|
| YYYY-MM-DD | v0.1.0 | Initial deployment | DEPLOYED |
