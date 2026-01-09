# SlideForge 部署指南

新功能部署说明（API配置、用量统计、配额管理等）

---

## 🚀 快速部署

### 1. 环境变量配置

生成必需的密钥：

```bash
# 生成API密钥加密密钥（32字节hex）
openssl rand -hex 32

# 生成Cron任务密钥
openssl rand -base64 32
```

添加到 `.env` 文件：

```bash
# API密钥加密（必需）
ENCRYPTION_KEY="<上面生成的hex密钥>"

# Cron任务认证（可选，用于远程触发）
CRON_SECRET="<上面生成的base64密钥>"
```

### 2. 安装依赖

```bash
pnpm install
```

新增依赖：
- bcryptjs（API密钥加密）
- node-cron（定时任务）
- @types/node-cron（TypeScript类型）

### 3. 数据库迁移

```bash
# 生成Prisma客户端
npx prisma generate

# 应用schema变更
npx prisma db push

# 为现有用户初始化配额
npx tsx scripts/initialize-quotas.ts
```

### 4. 启动应用

```bash
# 开发环境
pnpm dev

# 生产环境
pnpm build
pnpm start
```

### 5. 初始化Cron任务

应用启动后调用：

```bash
curl http://localhost:8080/api/cron/init
```

或在应用启动时自动调用（参见下方集成方法）。

---

## ⏰ Cron任务配置

系统使用 **node-cron** 进行定时任务，在进程内运行，无需外部依赖。

### 方式1：自动初始化（推荐）

在 `docker-entrypoint.sh` 或启动脚本中添加：

```bash
#!/bin/bash
# ... 其他初始化 ...

# 启动应用（后台）
npm start &

# 等待应用启动
sleep 5

# 初始化cron任务
curl http://localhost:8080/api/cron/init

# 前台运行（保持容器存活）
wait
```

### 方式2：Linux Crontab（备选）

如果prefer使用系统cron：

```bash
# 编辑crontab
crontab -e

# 添加每日凌晨0点重置配额
0 0 * * * curl http://localhost:8080/api/cron/reset-quotas
```

### 配置的定时任务

- **配额重置**：每日00:00 UTC
- **时区**：UTC（可在`src/services/cron-service.ts`中修改）

### 手动触发

```bash
# 本地触发（无需认证）
curl http://localhost:8080/api/cron/reset-quotas

# 远程触发（需要CRON_SECRET）
curl -X GET https://your-domain.com/api/cron/reset-quotas \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 🐳 Docker部署

### 更新docker-entrypoint.sh

```bash
#!/bin/bash
set -e

echo "Waiting for database..."
until npx prisma db push --skip-generate; do
  echo "Database not ready, retrying in 2s..."
  sleep 2
done

echo "Generating Prisma client..."
npx prisma generate

echo "Initializing quotas..."
npx tsx scripts/initialize-quotas.ts || echo "Quota initialization skipped or already done"

echo "Starting application..."
npm start &

echo "Waiting for app to start..."
sleep 5

echo "Initializing cron jobs..."
curl http://localhost:8080/api/cron/init || echo "Cron init failed, will retry on next restart"

echo "Application ready!"
wait
```

### docker-compose.yml

确保环境变量配置：

```yaml
services:
  app:
    environment:
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - CRON_SECRET=${CRON_SECRET}
```

---

## 📊 数据库变更

### 新增模型（4个）

- `ApiConfiguration` - API密钥管理
- `UsageLog` - 用量日志
- `UsageQuota` - 配额管理
- `QuotaPurchase` - 购买记录

### 新增枚举（4个）

- `ApiType` - 9种API类型
- `UsageType` - 8种用量类型
- `PeriodType` - 5种周期类型
- `PurchaseStatus` - 4种购买状态

### 修改模型（3个）

- `User` - 添加4个关联字段
- `Presentation` - 添加exportHistory字段
- `DocumentProcessorSession` - 添加导出追踪字段

---

## 🎯 Chat to Slide批量生成说明

### 设计理念

批量生成通过 **Agent Prompt约束** 实现，而非硬编码逻辑。

### Agent行为

当用户请求批量生成时，Agent会：

1. **解释限制**：
   > "I can only generate slides one at a time to ensure the best quality and give you a chance to review each one."

2. **提供方案**：
   > "However, I'm happy to help you generate them sequentially. I'll create each slide and wait for your approval before moving to the next."

3. **征求确认**：
   > "Would you like me to start with slide 1?"

4. **逐页生成**：
   - 生成一页
   - 等待用户确认
   - 继续下一页

### Prompt配置位置

文件：`src/lib/agent/agent-service.ts`

方法：`getWorkflowSystemPrompt()`（第198行）

关键部分：
```typescript
## Stage 3: Generate Slides (ONE AT A TIME)

**IMPORTANT CONSTRAINT**: You can ONLY generate slides one at a time...

### When user requests batch/bulk generation:
If the user asks to "generate all slides at once"...
```

---

## 🔧 维护与监控

### 检查Cron任务状态

```bash
# 查看应用日志中的cron执行记录
grep "Quota reset" /var/log/app.log

# 或使用pm2
pm2 logs --lines 100 | grep "quota reset"
```

### 手动重置配额

```bash
# 通过API手动触发
curl http://localhost:8080/api/cron/reset-quotas
```

### 数据库查询

```sql
-- 查看待重置的配额
SELECT * FROM "UsageQuota"
WHERE "resetAt" <= NOW();

-- 查看最近的配额重置
SELECT * FROM "UsageQuota"
ORDER BY "updatedAt" DESC
LIMIT 10;
```

---

## 🆘 故障排查

### Cron任务不执行

**检查**：
1. 应用是否调用了 `/api/cron/init`？
2. node-cron是否正确安装？
3. 应用进程是否一直运行？

**解决**：
```bash
# 检查cron服务
curl http://localhost:8080/api/cron/init

# 查看日志
pm2 logs slideforge | grep cron
```

### API密钥解密失败

**错误**：`Failed to decrypt API key`

**原因**：ENCRYPTION_KEY不匹配或格式错误

**解决**：
```bash
# 重新生成密钥
openssl rand -hex 32

# 更新.env并重启应用
# 注意：已保存的API配置需要重新添加
```

### 配额初始化失败

**检查数据库连接**：
```bash
# 测试数据库连接
npx prisma db pull

# 查看用户表
npx prisma studio
```

---

## 📈 升级现有系统

### 从旧版本升级

```bash
# 1. 备份数据库
pg_dump slide_forge > backup.sql

# 2. 拉取最新代码
git pull

# 3. 安装新依赖
pnpm install

# 4. 配置环境变量
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
echo "CRON_SECRET=$(openssl rand -base64 32)" >> .env

# 5. 数据库迁移
npx prisma db push

# 6. 初始化配额
npx tsx scripts/initialize-quotas.ts

# 7. 重启应用
pm2 restart slideforge

# 8. 初始化cron
curl http://localhost:8080/api/cron/init
```

---

## 🔐 安全建议

### 生产环境

1. **使用AWS Secrets Manager**：
   ```bash
   # 存储加密密钥
   aws secretsmanager create-secret \
     --name slideforge/encryption-key \
     --secret-string "$(openssl rand -hex 32)"

   # 在应用启动时获取
   export ENCRYPTION_KEY=$(aws secretsmanager get-secret-value \
     --secret-id slideforge/encryption-key \
     --query SecretString \
     --output text)
   ```

2. **启用HTTPS**：确保API密钥传输加密

3. **限制API访问**：
   - 使用防火墙规则
   - 启用速率限制
   - 实施IP白名单

4. **定期轮换密钥**：
   - 每季度更新ENCRYPTION_KEY
   - 重新加密所有API配置

---

## 🎯 功能验证清单

部署完成后验证：

- [ ] 访问 `/settings/api-config` - API配置页面加载
- [ ] 添加测试API密钥 - 保存成功且显示脱敏
- [ ] 测试API连接 - 连接测试功能正常
- [ ] 访问 `/settings/usage` - 统计数据正常显示
- [ ] 访问 `/settings/quota` - 配额信息正确
- [ ] 生成幻灯片 - 用量正确记录
- [ ] 导出PDF - Document Processor PDF导出正常
- [ ] Cron任务 - 配额自动重置（等待24小时或手动触发测试）

---

## 📝 性能优化建议

### 数据库索引

所有必需的索引已在schema中定义，确保：

```sql
-- 验证索引存在
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('UsageLog', 'UsageQuota', 'ApiConfiguration');
```

### 日志清理

设置定期清理任务：

```bash
# 添加到crontab（每周日凌晨2点）
0 2 * * 0 psql $DATABASE_URL -c "DELETE FROM \"UsageLog\" WHERE \"createdAt\" < NOW() - INTERVAL '90 days';"
```

---

## 📚 相关文档

- [FEATURES.md](./FEATURES.md) - 功能详细说明
- [Prisma Schema](./prisma/schema.prisma) - 数据库模型

部署完成后，访问 `/settings` 开始使用新功能！
