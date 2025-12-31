# 📜 Slide Forge - 脚本使用指南

## 🎯 可用脚本总览

| 脚本 | 用途 | 使用场景 |
|------|------|---------|
| `scripts/install.sh` | 完整安装 | 首次安装或重新配置 |
| `scripts/start.sh` | 快速启动 | 日常启动开发服务器 |
| `scripts/check-env.sh` | 环境检查 | 诊断配置问题 |

---

## 📦 scripts/install.sh - 完整安装脚本

### 功能

自动完成从零到启动的所有步骤：

1. ✅ **环境检查**
   - Node.js 版本（需要 18+）
   - pnpm 包管理器（自动安装）
   - PostgreSQL 数据库
   - Git 版本控制

2. ✅ **环境变量配置**
   - 创建 .env.local（从 .env.example）
   - 提示配置必需项
   - 可选打开编辑器配置

3. ✅ **依赖安装**
   - 使用 pnpm 安装所有依赖
   - 包括开发和生产依赖
   - 显示安装进度

4. ✅ **数据库设置**
   - 运行 Prisma 迁移
   - 生成 Prisma Client
   - 创建必需的表结构

5. ✅ **代码检查**
   - TypeScript 类型检查
   - 显示潜在问题（不阻止启动）

6. ✅ **配置摘要**
   - 显示已配置的服务
   - 标注缺失的可选配置
   - 提供配置建议

7. ✅ **启动服务**
   - 启动 Next.js 开发服务器
   - 显示访问地址

### 使用方法

```bash
# 首次安装
./scripts/install.sh

# 脚本会引导你完成所有步骤
```

### 预期输出

```
╔════════════════════════════════════════════════════════╗
║                                                        ║
║           Slide Forge - AI PPT Generator              ║
║              One-Click Installation                    ║
║                                                        ║
╚════════════════════════════════════════════════════════╝

[INFO] Checking environment...
[SUCCESS] Node.js v22.21.1 detected
[SUCCESS] pnpm 10.17.0 detected
[SUCCESS] PostgreSQL detected

[INFO] Setting up environment variables...
[SUCCESS] .env.local created

⚠️  IMPORTANT: Please configure the following in .env.local:
  1. DATABASE_URL - Your PostgreSQL connection string
  2. NEXTAUTH_SECRET - Run: openssl rand -base64 32
  3. UNSPLASH_ACCESS_KEY - Get from: https://unsplash.com/developers
  ...

[INFO] Installing dependencies with pnpm...
[SUCCESS] Dependencies installed

[INFO] Setting up database...
[SUCCESS] Database setup completed

[INFO] Checking TypeScript compilation...
[SUCCESS] No TypeScript errors in main codebase

════════════════ Configuration Summary ════════════════

📄 Environment File: .env.local ✅
🗄️  Database: PostgreSQL configured ✅
🖼️  Unsplash: Configured ✅
☁️  AWS Bedrock: Configured ✅

📦 Dependencies: Installed ✅
🎨 Frontend: Next.js 15 + React 19
🤖 Agent: Claude Agent SDK + Amazon Bedrock
📊 Charts: AntV Infographic

Ready to start? Press Enter to continue...

════════════════ Starting Slide Forge ════════════════

🚀 Starting development server...

Access the app at:
  ➜  Local:   http://localhost:8080
  ➜  Agent:   http://localhost:8080/presentation/agent

Press Ctrl+C to stop the server
```

### 何时使用

- 🆕 **首次安装项目**
- 🔄 **重新配置环境**
- 🛠️ **依赖出现问题需要重装**
- 🗄️ **数据库需要重新迁移**

---

## 🚀 scripts/start.sh - 快速启动脚本

### 功能

快速启动已安装的项目：

1. ✅ 检查是否在项目目录
2. ✅ 检查依赖是否已安装
3. ✅ 如果未安装，自动调用 scripts/install.sh
4. ✅ 启动开发服务器

### 使用方法

```bash
# 日常启动（最常用）
./scripts/start.sh
```

### 预期输出

```
╔════════════════════════════════════════════╗
║         Slide Forge - Quick Start         ║
╚════════════════════════════════════════════╝

🚀 Starting development server...

Access the app at:
  ➜  Local:   http://localhost:8080
  ➜  Agent:   http://localhost:8080/presentation/agent

Press Ctrl+C to stop the server

════════════════════════════════════════════════════════

> slide-forge@0.1.0 dev
> next dev

  ▲ Next.js 15.x.x
  - Local:        http://localhost:8080
  - Environments: .env.local

✓ Starting...
✓ Ready in 2.3s
```

### 何时使用

- 📅 **每天开始工作时**
- 🔄 **服务器停止后重启**
- 🧪 **测试功能时**

---

## 🔍 scripts/check-env.sh - 环境检查脚本

### 功能

详细检查系统环境和配置状态：

1. ✅ 验证运行环境
   - Node.js 版本
   - pnpm 安装
   - PostgreSQL 可用性

2. ✅ 检查配置文件
   - .env.local 存在性
   - 必需变量是否配置
   - 可选变量状态

3. ✅ 验证依赖
   - node_modules 目录
   - Prisma Client 生成

4. ✅ 生成诊断报告
   - 错误数量
   - 警告数量
   - 具体建议

### 使用方法

```bash
# 检查环境
./scripts/check-env.sh

# 或
bash scripts/check-env.sh
```

### 预期输出

```
╔════════════════════════════════════════════╗
║     Slide Forge Environment Check         ║
╚════════════════════════════════════════════╝

🟢 Node.js: v22.21.1 ✓
🟢 pnpm: v10.17.0 ✓
🟢 PostgreSQL: 16.2 ✓

Configuration Files:
  📄 .env.local: Exists ✓

Environment Variables:
  🗄️  DATABASE_URL: Configured ✓
  🔐 NEXTAUTH_SECRET: Configured ✓
  🖼️  UNSPLASH_ACCESS_KEY: Not configured (auto-images disabled)
  ☁️  AWS_ACCESS_KEY_ID: Configured ✓

Dependencies:
  📦 node_modules: Installed ✓
  🗃️  Prisma Client: Generated ✓

════════════════════════════════════════════

⚠️  1 warning(s) detected.
You can start the app, but some features may be limited.

Run: ./start.sh
```

### 退出码

- `0` - 无错误（可以启动）
- `非0` - 有错误（需要修复）

### 何时使用

- 🐛 **遇到启动问题时**
- ❓ **不确定配置是否正确**
- 📋 **部署前验证环境**
- 🔧 **调试配置问题**

---

## 🎯 典型使用场景

### 场景 1: 全新安装

```bash
# 1. 克隆项目
git clone <repo-url>
cd slide-forge

# 2. 一键安装
./scripts/install.sh

# 3. 配置环境变量（脚本会提示）
# 编辑 .env.local

# 4. 访问应用
# http://localhost:8080
```

### 场景 2: 日常开发

```bash
# 早上开始工作
./scripts/start.sh

# 开发...

# 晚上停止（Ctrl+C）
```

### 场景 3: 环境问题诊断

```bash
# 遇到启动错误
./scripts/check-env.sh

# 查看输出，修复标记的问题

# 重新启动
./scripts/start.sh
```

### 场景 4: 更新依赖后

```bash
# 拉取新代码
git pull

# 重新安装（确保依赖最新）
./scripts/install.sh

# 或只更新依赖
pnpm install
pnpm prisma generate
```

---

## 🔧 手动命令对照

如果不想使用脚本，可以手动执行：

### install.sh 等同于

```bash
# 检查环境
node -v
pnpm -v

# 创建配置
cp .env.example .env.local
nano .env.local

# 安装依赖
pnpm install

# 数据库迁移
pnpm prisma db push
pnpm prisma generate

# 类型检查
pnpm tsc --noEmit

# 启动
pnpm dev
```

### start.sh 等同于

```bash
pnpm dev
```

### check-env.sh 等同于

```bash
# 手动检查各项
node -v
pnpm -v
psql --version
ls .env.local
ls -d node_modules
```

---

## 📝 环境变量配置指南

### 必需配置（应用无法启动）

```env
# 数据库连接
DATABASE_URL="postgresql://user:pass@localhost:5432/slide_forge"

# NextAuth 密钥（生成方式见下）
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:8080"
```

### 生成 NEXTAUTH_SECRET

```bash
# Linux/Mac
openssl rand -base64 32

# 或在线生成
# https://generate-secret.vercel.app/32
```

### 推荐配置（启用完整功能）

```env
# Unsplash - 自动配图
UNSPLASH_ACCESS_KEY="your_unsplash_key"
# 获取: https://unsplash.com/developers

# AWS Bedrock - Claude Agent
AWS_ACCESS_KEY_ID="your_aws_key"
AWS_SECRET_ACCESS_KEY="your_aws_secret"
AWS_REGION="us-west-2"
# 配置: AWS Console > IAM > Users

# LLM API - 文本生成（OpenAI 兼容）
LLM_API_KEY="sk-..."
# LLM_BASE_URL=""  # 可选，不填则使用 OpenAI
# 获取: https://platform.openai.com/api-keys (OpenAI) 或其他提供商
```

### 可选配置（增强功能）

```env
# Tavily - 网络搜索
TAVILY_API_KEY="your_tavily_key"
# 获取: https://tavily.com/

# Cognito - 用户认证
COGNITO_CLIENT_ID="your_client_id"
COGNITO_CLIENT_SECRET="your_secret"
COGNITO_ISSUER="https://cognito-idp.region.amazonaws.com/pool-id"
```

---

## 🐛 故障排除

### 脚本权限问题

**错误**: `Permission denied`

**解决**:
```bash
chmod +x install.sh start.sh scripts/check-env.sh
```

### pnpm 未找到

**错误**: `pnpm: command not found`

**解决**:
```bash
# 安装 pnpm
npm install -g pnpm

# 或修改脚本使用 npm
# 将脚本中的 pnpm 替换为 npm
```

### 数据库连接失败

**错误**: `Can't reach database server`

**解决**:
```bash
# 1. 检查 PostgreSQL 是否运行
sudo systemctl status postgresql

# 2. 测试连接
psql "postgresql://user:pass@localhost:5432/dbname"

# 3. 修改 .env.local 中的 DATABASE_URL
```

### 端口占用

**错误**: `Port 3000 is already in use`

**解决**:
```bash
# 查找占用进程
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 或使用其他端口
PORT=3001 ./start.sh
```

---

## 💡 最佳实践

### 1. 首次使用流程

```bash
git clone <repo>
cd slide-forge
./scripts/install.sh          # 一键安装
# 配置 .env.local
./scripts/start.sh            # 启动
```

### 2. 日常开发流程

```bash
./scripts/start.sh            # 启动服务器
# 开发...
Ctrl+C                # 停止服务器
```

### 3. 遇到问题时

```bash
./scripts/check-env.sh   # 诊断环境
# 根据提示修复问题
./scripts/start.sh               # 重新启动
```

### 4. 更新代码后

```bash
git pull
pnpm install          # 更新依赖
pnpm prisma generate  # 更新 Prisma Client
./scripts/start.sh           # 启动
```

---

## 📋 脚本输出说明

### 颜色编码

- 🟢 **绿色** - 成功/正常
- 🟡 **黄色** - 警告/可选项缺失
- 🔴 **红色** - 错误/必需项缺失
- 🔵 **蓝色** - 信息提示

### 状态符号

- ✓ (✅) - 检查通过
- ✗ (❌) - 检查失败
- ⚠️ - 警告提示

### 日志前缀

- `[INFO]` - 信息消息
- `[SUCCESS]` - 成功消息
- `[WARNING]` - 警告消息
- `[ERROR]` - 错误消息

---

## 🔄 脚本更新和维护

### 修改脚本

脚本位置：
- `/scripts/install.sh` - 主安装脚本
- `/scripts/start.sh` - 快速启动脚本
- `/scripts/check-env.sh` - 环境检查脚本

可以根据项目需要自定义：
- 添加更多检查项
- 修改配置提示
- 调整启动选项

### 脚本依赖

所有脚本都是纯 Bash，无外部依赖，只需要：
- Bash 4.0+（Linux/Mac 默认）
- 基本 Unix 命令（echo, grep, sed 等）

---

## 📚 相关文档

- **快速开始**: `/QUICK_START.md`
- **详细安装**: README.md "Getting Started" 部分
- **环境配置**: README.md "Prerequisites" 部分
- **故障排除**: 本文档 "故障排除" 部分

---

## 🎉 快速参考卡

```bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎨 Slide Forge - 快速命令参考
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 安装和启动
./scripts/install.sh         # 完整安装（首次）
./scripts/start.sh           # 快速启动（日常）

# 诊断
./scripts/check-env.sh   # 环境检查

# 数据库
pnpm prisma db push      # 应用迁移
pnpm prisma generate     # 生成 Client
pnpm prisma studio       # 打开 GUI

# 开发
pnpm dev                 # 启动开发服务器
pnpm build              # 构建生产版本
pnpm start              # 启动生产服务器

# 代码质量
pnpm tsc --noEmit       # 类型检查
pnpm lint               # Lint 检查

# 清理和重置
rm -rf node_modules     # 删除依赖
pnpm install            # 重新安装

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

**使用愉快！** 🚀

如有问题，查看故障排除部分或检查项目文档。
