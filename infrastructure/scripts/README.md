# 部署脚本使用说明

## 📜 可用脚本

### 1. `configure.sh` - 配置环境变量

**功能**: 交互式创建 `.env` 配置文件

**使用**:
```bash
./scripts/configure.sh
```

**流程**:
1. 选择认证方式（Bedrock 或 Anthropic API）
2. 输入 API Keys（可选服务）
3. 自动生成 `.env` 文件

**适用场景**: 首次部署或重新配置

---

### 2. `deploy.sh` - 完整部署流程

**功能**: 配置 + 构建 + 部署一键完成

**使用**:
```bash
# 交互式模式（推荐首次使用）
./scripts/deploy.sh

# 使用现有 .env 部署
./scripts/deploy.sh --non-interactive

# 自定义 Stack 名称
./scripts/deploy.sh --stack-name my-slides --environment prod

# 只检查配置，不部署
./scripts/deploy.sh --check-only
```

**参数**:
- `-h, --help` - 显示帮助
- `-n, --non-interactive` - 使用现有 .env
- `-s, --stack-name NAME` - 自定义 Stack 名称
- `-e, --environment ENV` - 环境（dev/prod）
- `--check-only` - 只验证配置

**流程**:
1. 检查前置条件（AWS CLI, Docker, 等）
2. 配置环境变量（交互式或读取 .env）
3. 显示配置摘要
4. 构建前端应用
5. 执行 CDK 部署
6. 显示部署结果和访问地址

---

### 3. `validate.sh` - 验证配置

**功能**: 检查配置和环境是否准备好部署

**使用**:
```bash
./scripts/validate.sh
```

**检查项**:
- ✓ .env 文件是否存在
- ✓ 必需的环境变量
- ✓ AWS 凭证和权限
- ✓ Bedrock 模型访问
- ✓ Docker 状态
- ✓ CDK Bootstrap
- ✓ 依赖安装

**适用场景**: 部署前检查，排查问题

---

### 4. `status.sh` - 查看部署状态

**功能**: 显示已部署资源的运行状态

**使用**:
```bash
# 使用默认名称
./scripts/status.sh

# 指定 stack name 和环境
./scripts/status.sh my-slides prod
```

**显示信息**:
- CloudFormation Stack 状态
- ECS Service 运行状态
- Aurora 数据库状态
- CloudFront URL
- 实用命令提示

---

### 5. `logs.sh` - 查看实时日志

**功能**: 查看 ECS 容器日志

**使用**:
```bash
# 使用默认名称
./scripts/logs.sh

# 指定 stack name 和环境
./scripts/logs.sh my-slides prod
```

**按 Ctrl+C 退出**

---

### 6. `destroy.sh` - 销毁资源

**功能**: 删除所有 AWS 资源

**使用**:
```bash
# 需要两次确认
./scripts/destroy.sh [stack-name] [environment]
```

**警告**:
- ⚠️ 会删除所有数据
- ⚠️ 不可恢复
- ⚠️ 需要输入 "DELETE" 确认

---

## 🚀 快速开始

### 完整部署流程

```bash
cd /home/ubuntu/research/slide-forge/infrastructure

# 方式 1: 使用脚本（推荐）
./scripts/configure.sh      # 配置环境变量
./scripts/validate.sh       # 验证配置
./scripts/deploy.sh -n      # 执行部署

# 方式 2: 使用 pnpm 命令
pnpm configure              # 配置环境变量
pnpm validate              # 验证配置
pnpm deploy:quick          # 执行部署
```

### 日常操作

```bash
# 查看部署状态
pnpm status

# 查看实时日志
pnpm logs

# 重新部署（更新代码后）
./scripts/deploy.sh --non-interactive

# 只检查配置
./scripts/deploy.sh --check-only
```

## 📝 pnpm 命令别名

在 `package.json` 中已配置以下别名：

```bash
pnpm configure          # = ./scripts/configure.sh
pnpm validate          # = ./scripts/validate.sh
pnpm deploy:interactive # = ./scripts/deploy.sh
pnpm deploy:quick      # = ./scripts/deploy.sh --non-interactive
pnpm status           # = ./scripts/status.sh
pnpm logs             # = ./scripts/logs.sh
```

## 🔧 高级用法

### 部署到多个环境

```bash
# 开发环境
./scripts/deploy.sh -s slide-forge -e dev

# 生产环境
./scripts/deploy.sh -s slide-forge -e prod
```

### 使用不同的 Stack 名称

```bash
# 部署多个独立实例
./scripts/deploy.sh -s demo-slides -e dev
./scripts/deploy.sh -s prod-slides -e prod
```

### CI/CD 集成

```bash
# 在 CI/CD 管道中使用
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION=us-east-1
export TAVILY_API_KEY=$SECRET_TAVILY_KEY

./scripts/deploy.sh --non-interactive --stack-name ci-slides
```

## 📋 环境变量参考

### 必需（二选一）

```bash
# 选项 A: AWS Bedrock
CLAUDE_CODE_USE_BEDROCK=1
AWS_REGION=us-east-1

# 选项 B: Anthropic API
ANTHROPIC_API_KEY=sk-ant-api03-...
AWS_REGION=us-east-1
```

### 可选

```bash
# 网络搜索
TAVILY_API_KEY=tvly-...

# 文件上传
UPLOADTHING_TOKEN=eyJ...

# 图片服务
UNSPLASH_ACCESS_KEY=...

# 其他 LLM
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL_NAME=gpt-4o-mini
```

## 🐛 故障排查

### 脚本权限问题

```bash
chmod +x scripts/*.sh
```

### .env 文件格式问题

```bash
# 检查文件内容
cat .env

# 重新生成
./scripts/configure.sh
```

### AWS 凭证问题

```bash
# 检查凭证
aws sts get-caller-identity

# 配置凭证
aws configure
```

## 📚 相关文档

- `QUICK_DEPLOY.md` - 快速部署指南
- `DEPLOYMENT_GUIDE.md` - 详细部署文档
- `../.env.example` - 环境变量模板

---

**提示**: 所有脚本都支持 `--help` 参数查看详细说明
