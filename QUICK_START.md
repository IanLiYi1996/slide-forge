# 🚀 Slide Forge - 快速开始指南

## 一键安装和启动

### 方式 1: 完整安装（首次使用）

```bash
./scripts/install.sh
```

这个脚本会自动完成：
- ✅ 环境检查（Node.js, pnpm, Docker）
- ✅ 创建 .env.local 配置文件
- ✅ 安装所有依赖包
- ✅ 启动 Docker 数据库
- ✅ 数据库迁移
- ✅ TypeScript 类型检查
- ✅ 显示配置摘要
- ✅ 启动开发服务器

### 方式 2: 快速启动（已安装）

```bash
./scripts/start.sh
```

这个脚本用于已安装的项目，直接启动开发服务器。

---

## 📋 前置要求

### 必需
- **Node.js** 18+ ([下载](https://nodejs.org/))
- **Docker & Docker Compose** ([下载](https://docs.docker.com/get-docker/))
- 以下 API 至少配置一个文本生成服务：
  - **OpenAI API** 或
  - **OpenAI-Compatible API** (LM Studio, Ollama, yunwu.ai 等)

### 推荐
- **pnpm** (脚本会自动安装)
- **Git** (用于版本控制)
- **AWS Bedrock** (用于 Chat to Slides 功能)
- **Tavily API** (用于联网搜索)

---

## 🔧 详细安装步骤

### 步骤 1: 克隆项目（如果需要）

```bash
git clone <repository-url>
cd slide-forge
```

### 步骤 2: 运行安装脚本

```bash
./scripts/install.sh
```

### 步骤 3: 配置环境变量

脚本会自动创建 `.env.local`，你需要配置：

#### 必需配置

1. **数据库连接**（使用 Docker 默认值）
   ```env
   DATABASE_URL="postgresql://presentation_user:presentation_password@localhost:5432/slide_forge"
   ```
   ℹ️ 如果使用 docker-compose.yml，此值已正确配置

2. **NextAuth 密钥**
   ```bash
   # 生成密钥
   openssl rand -base64 32

   # 添加到 .env.local
   NEXTAUTH_SECRET="生成的密钥"
   ```

3. **文本生成 API（OpenAI 兼容配置）**

   ```env
   LLM_API_KEY="sk-..."              # 必填：API密钥
   LLM_BASE_URL=""                   # 可选：不填则使用OpenAI
   LLM_MODEL_NAME="gpt-4o-mini"      # 可选：默认 gpt-4o-mini
   ```

   **使用 OpenAI（默认）**:
   - 仅配置 `LLM_API_KEY`，获取密钥: https://platform.openai.com/api-keys
   - `LLM_BASE_URL` 留空或不配置

   **使用其他兼容服务**:
   - 配置 `LLM_API_KEY` 和 `LLM_BASE_URL`
   - 支持的服务：
     - LM Studio (本地): `http://localhost:1234/v1`
     - Ollama (本地): `http://localhost:11434/v1`
     - yunwu.ai (云端): `https://api.xiaomimimo.com/v1`

#### 推荐配置（功能增强）

4. **Claude Agent（Chat to Slides 功能）**

   **选项 A: AWS Profile（推荐）**
   ```env
   CLAUDE_CODE_USE_BEDROCK="1"
   ENABLE_CLAUDE_AGENT="true"
   AWS_PROFILE="default"
   AWS_REGION="us-east-1"
   ```

   **选项 B: 直接凭证**
   ```env
   CLAUDE_CODE_USE_BEDROCK="1"
   ENABLE_CLAUDE_AGENT="true"
   AWS_ACCESS_KEY_ID="AKIA..."
   AWS_SECRET_ACCESS_KEY="..."
   AWS_REGION="us-east-1"
   ```

   **设置步骤**:
   1. AWS Console > Bedrock > Model access
   2. 请求 Claude 3.5 Sonnet 访问权限
   3. 配置 IAM 权限（bedrock:InvokeModel）

5. **联网搜索（可选）**
   ```env
   TAVILY_API_KEY="tvly-..."
   ```
   获取: https://tavily.com

6. **自动配图（可选）**
   ```env
   UNSPLASH_ACCESS_KEY="your_access_key"
   ```
   获取: https://unsplash.com/developers

7. **文件存储（必需）**
   ```env
   UPLOADTHING_TOKEN="..."
   ```
   获取: https://uploadthing.com

### 步骤 4: 启动服务

安装脚本会自动启动，或者运行：

```bash
pnpm dev
```

### 步骤 5: 访问应用

打开浏览器访问：
- 主页: http://localhost:8080
- **Agent 页面**: http://localhost:8080/presentation/agent ← 开始这里！

---

## 🎯 快速测试 Agent 功能

### 1. 访问 Agent 页面

```
http://localhost:8080/presentation/agent
```

### 2. 创建新 Session

点击 **"New Session"** 或 **"Start Conversation"** 按钮

### 3. 输入测试指令

```
Create a 3-slide presentation about Transformer architecture in English
```

### 4. 跟随 Agent 引导

```
Agent: "How many slides... search web...?"
You: "3 slides, yes search"

Agent: [生成大纲]
Agent: "Does this outline look good?"
You: "Yes"

Agent: [生成 Slide 1 with preview]
You: "Continue"

Agent: [生成 Slide 2 with preview]
You: "Continue"

Agent: [生成 Slide 3 with preview]
You: "Continue"

Agent: "All slides completed!"
[绿色导出工具栏出现]

You: 点击 [HTML Files] 导出
[下载 ZIP]
```

### 5. 导出为 PDF

**推荐方式**（100% 可靠）：
1. 解压 HTML 文件
2. 在 Chrome 中打开 slide-01.html
3. 按 `Ctrl+P` (Windows) 或 `Cmd+P` (Mac)
4. 设置：
   - 目标: 另存为 PDF
   - 布局: **横向** ← 重要！
   - 边距: 无
   - 背景图形: 勾选 ← 重要！
5. 保存为 slide-01.pdf
6. 重复其他幻灯片

---

## 🛠️ 常用命令

### 开发

```bash
# 启动开发服务器
pnpm dev

# 或使用快速启动脚本
./scripts/start.sh
```

### 数据库

```bash
# 启动数据库
./db-start.sh

# 停止数据库
./db-stop.sh

# 查看数据库日志
docker logs slide-forge-db

# 连接到数据库
docker exec -it slide-forge-db psql -U presentation_user -d slide_forge

# 应用数据库更改
pnpm prisma db push

# 生成 Prisma Client
pnpm prisma generate

# 打开 Prisma Studio（数据库 GUI）
pnpm prisma studio
```

### 构建

```bash
# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start
```

### 代码质量

```bash
# TypeScript 类型检查
pnpm tsc --noEmit

# Lint 检查
pnpm lint

# 格式化代码
pnpm format
```

---

## 🐛 故障排除

### 问题 1: 端口 3000 被占用

**错误**: `Error: Port 3000 is already in use`

**解决**:
```bash
# 查找占用端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>

# 或使用其他端口
PORT=3001 pnpm dev
```

### 问题 2: 数据库连接失败

**错误**: `Can't reach database server`

**解决**:
1. 检查 Docker 数据库是否运行
   ```bash
   # 查看容器状态
   docker ps | grep slide-forge-db

   # 如果未运行，启动数据库
   ./db-start.sh
   # 或
   docker-compose up -d postgres
   ```

2. 检查 Docker daemon 是否运行
   ```bash
   docker info
   ```

3. 检查数据库日志
   ```bash
   docker logs slide-forge-db
   ```

4. 重启数据库容器
   ```bash
   docker-compose restart postgres
   ```

5. 测试数据库连接
   ```bash
   docker exec -it slide-forge-db psql -U presentation_user -d slide_forge
   ```

### 问题 3: pnpm 命令未找到

**错误**: `pnpm: command not found`

**解决**:
```bash
# 安装 pnpm
npm install -g pnpm

# 或使用 npm 替代
npm install
npm run dev
```

### 问题 4: Prisma 迁移失败

**错误**: `Migration failed`

**解决**:
```bash
# 手动运行迁移
pnpm prisma db push

# 查看数据库状态
pnpm prisma studio
```

### 问题 5: Agent 不响应 / Chat to Slides 无法使用

**可能原因**: AWS Bedrock 未配置或配置错误

**解决**:

1. **检查环境变量**
   ```bash
   # 查看当前配置
   cat .env.local | grep -E "CLAUDE|AWS|BEDROCK"
   ```

2. **验证 AWS 凭证**
   ```bash
   # 测试凭证是否有效
   aws sts get-caller-identity

   # 测试 Bedrock 访问
   aws bedrock list-foundation-models --region us-east-1
   ```

3. **检查 Bedrock 模型访问权限**
   - 访问 AWS Console > Amazon Bedrock > Model access
   - 确认 Claude 3.5 Sonnet 状态为 "Access granted"

4. **检查 IAM 权限**
   确保您的 IAM 用户/角色有以下权限：
   ```json
   {
     "Effect": "Allow",
     "Action": [
       "bedrock:InvokeModel",
       "bedrock:InvokeModelWithResponseStream"
     ],
     "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-*"
   }
   ```

5. **查看浏览器控制台错误**
   - 打开浏览器开发者工具 (F12)
   - 查看 Console 和 Network 标签
   - 寻找 AWS 或 Bedrock 相关错误

### 问题 6: 文本生成失败 / Outline 无法生成

**可能原因**: OpenAI API 或 LLM 服务未配置

**解决**:

1. **确认至少配置了一个文本生成服务**
   ```bash
   # 检查配置
   cat .env.local | grep -E "LLM_API_KEY|LLM_BASE_URL"
   ```

2. **如果使用 OpenAI API**:
   - 验证 API key 有效性
   - 检查账户余额
   - 确认 API key 有正确的权限

3. **如果使用 OpenAI-Compatible API**:
   - 确认服务正在运行（如 LM Studio、Ollama）
   - 测试 API 端点：
     ```bash
     curl http://localhost:1234/v1/models
     ```
   - 检查 LLM_MODEL_NAME 是否匹配可用模型

4. **切换到备用服务**:
   - 如果 OpenAI 失败，尝试 LLM_BASE_URL
   - 如果本地 LLM 失败，尝试云端服务（yunwu.ai）

### 问题 6: 导出 PDF 白屏

**推荐**: 使用 **HTML Files (Manual Print)** 选项

**步骤**:
1. 导出时选择蓝色的 "HTML Files" 按钮
2. 下载并解压 ZIP
3. 浏览器打开 HTML
4. Ctrl+P 打印为 PDF
5. 100% 成功 ✅

---

## 📚 功能文档

### 核心功能

1. **Claude Agent 对话式 PPT 生成**
   - 文档: `/docs/AGENT_WORKFLOW.md`
   - 页面: `/presentation/agent`

2. **分阶段交互式创建**
   - 大纲生成 → 确认 → 修改
   - 逐页生成 → 确认 → 调整
   - 多轮迭代优化

3. **智能 Infographic 集成**
   - 197+ 模板自动选择
   - 图标和配色自动匹配
   - 内容类型智能识别

4. **多格式导出**
   - PNG (ZIP) - 高清图片
   - PPTX - PowerPoint 格式
   - PDF - 完整样式
   - HTML - 手动打印（推荐）

### 技术文档

- **实施总结**: `/docs/IMPLEMENTATION_SUMMARY.md`
- **Bug 修复记录**: `/docs/BUGFIX_*.md`
- **优化记录**: `/docs/OPTIMIZATION_*.md`
- **调试指南**: `/docs/DEBUG_*.md`

---

## 🎨 特色功能

### 1. 实时预览
Agent 生成的每页幻灯片立即显示在聊天界面中，使用 iframe 安全渲染。

### 2. 智能图表
根据内容自动生成专业信息图：
- 流程图（序列）
- 数据图表（饼图、柱状图）
- 对比分析（左右对比）
- 特性列表（网格布局）

### 3. 自动配图
从 Unsplash 搜索专业摄影作品，自动匹配幻灯片主题。

### 4. 可靠导出
提供多种导出方式，包括 100% 可靠的 HTML 手动打印方案。

---

## 💡 使用技巧

### 1. 内容简洁原则
每页幻灯片保持 3-4 个要点，避免内容过多。

### 2. 明确指令
告诉 Agent 具体需求：
- ✅ "创建5页关于云计算的演示文稿，第2页包含市场份额饼图"
- ❌ "做个PPT"

### 3. 逐步确认
每页确认后再继续，确保质量。

### 4. 使用 HTML 导出
如果自动导出有问题，使用蓝色的 "HTML Files" 选项，100% 成功。

---

## 🔄 日常使用流程

### 每次启动

```bash
# 方式 1: 使用启动脚本
./scripts/start.sh

# 方式 2: 直接使用 pnpm
pnpm dev
```

### 更新依赖

```bash
# 更新所有依赖
pnpm update

# 更新特定包
pnpm update @antv/infographic
```

### 数据库操作

```bash
# 查看数据
pnpm prisma studio

# 重置数据库（谨慎！）
pnpm prisma db push --force-reset
```

---

## 🎓 学习资源

### 官方文档
- Next.js: https://nextjs.org/docs
- Claude Agent SDK: https://platform.claude.com/docs/agent-sdk
- AntV Infographic: https://infographic.antv.vision/

### 项目文档
- 使用指南: `/docs/AGENT_WORKFLOW.md`
- 实施文档: `/docs/IMPLEMENTATION_SUMMARY.md`
- 完整计划: `/.claude/plans/graceful-wandering-lemon.md`

### 参考示例
- Infographic 示例: `/resource/Infographic/`
- Agent SDK 示例: `/resource/claude-agent-sdk-demos/`

---

## 📞 获取帮助

### 常见问题
查看文档目录下的各种修复和优化文档：
- `BUGFIX_*.md` - Bug 修复说明
- `OPTIMIZATION_*.md` - 优化记录
- `DEBUG_*.md` - 调试指南

### 日志查看
浏览器控制台（F12）可以看到详细日志，包括：
- Agent 消息处理
- 工具调用日志
- 导出进度信息
- 错误堆栈

---

## 🎉 现在开始

运行安装脚本：

```bash
./scripts/install.sh
```

跟随提示完成配置，然后开始创建你的第一个 AI 生成的演示文稿！

**祝你使用愉快！** 🎨✨
