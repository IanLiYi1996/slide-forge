# API配置使用指南

## 📖 概述

SlideForge的API配置系统支持两级配置：

1. **系统级配置**（.env文件）- 管理员配置的全局默认值
2. **用户级配置**（数据库）- 用户自定义的个人API密钥

**优先级**：用户配置 > 系统配置

---

## 🔧 配置方式

### 方式1：系统级配置（.env）

适用于：
- 统一管理所有用户的API密钥
- 测试环境快速配置
- 不需要用户自己配置API密钥的场景

**配置示例**：

```bash
# .env文件

# OpenAI (用于LLM和DALL-E)
LLM_API_KEY="sk-proj-..."
LLM_BASE_URL="https://api.openai.com/v1"

# Anthropic Claude
ANTHROPIC_API_KEY="sk-ant-api03-..."

# Unsplash (背景图搜索)
UNSPLASH_ACCESS_KEY="your-unsplash-access-key"

# Yunwu (文档处理)
YUNWU_API_KEY="your-yunwu-key"

# DashScope (阿里云AI)
DASHSCOPE_API_KEY="your-dashscope-key"
```

**特点**：
- ✅ 配置一次，所有用户共享
- ✅ 管理员统一管理
- ✅ 用户可在前端页面看到"System"标记
- ⚠️ 所有用户使用同一配额限制

---

### 方式2：用户级配置（前端页面）

适用于：
- 用户使用自己的API密钥
- 需要独立计费和配额管理
- 多租户场景

**配置步骤**：

1. **访问配置页面**
   ```
   Settings → API Configuration
   ```

2. **查看系统配置**
   - 如果.env中有配置，会显示在"System Configurations"区域
   - 标记为"System"徽章
   - 显示来源：`From .env: LLM_API_KEY`

3. **添加自定义配置**
   - 点击系统配置卡片的"Override with Custom Key"
   - 或点击右上角"Add Custom Key"
   - 选择API类型
   - 输入API密钥
   - 可选：自定义Base URL
   - 点击"Test Connection"验证
   - 保存

4. **配置生效**
   - 自定义配置立即生效
   - 覆盖系统默认配置
   - 标记为"Custom"徽章

---

## 🎯 使用场景示例

### 场景1：统一管理（推荐用于小团队）

**.env配置**：
```bash
LLM_API_KEY="sk-company-key"
UNSPLASH_ACCESS_KEY="company-unsplash-key"
YUNWU_API_KEY="company-yunwu-key"
```

**效果**：
- 所有用户自动使用公司统一的API密钥
- 用户无需配置，开箱即用
- 成本集中管理

### 场景2：用户自带密钥（推荐用于SaaS）

**.env配置**：
```bash
# 仅配置必需的系统服务
UNSPLASH_ACCESS_KEY="fallback-key"
```

**用户操作**：
- 用户在前端配置自己的OpenAI密钥
- 用户在前端配置自己的Yunwu密钥
- Unsplash使用系统默认（如果用户未配置）

**效果**：
- 用户独立计费
- 配额独立管理
- 灵活性高

### 场景3：混合模式

**.env配置**：
```bash
# 提供备用配置
LLM_API_KEY="fallback-openai-key"
UNSPLASH_ACCESS_KEY="system-unsplash-key"
```

**用户选择**：
- 高级用户：配置自己的密钥，享受更高配额
- 普通用户：使用系统默认，快速开始

---

## 🔍 配置查询逻辑

### 代码实现

```typescript
import { getApiConfig } from '@/lib/api-config-resolver';

// 在服务端使用
const config = await getApiConfig(userId, 'OPENAI');

if (config) {
  console.log(`Using ${config.source} config`); // 'user' or 'system'
  console.log(`API Key: ${config.apiKey}`);
  console.log(`Base URL: ${config.baseUrl}`);

  // 使用配置调用API
  const response = await fetch(`${config.baseUrl}/models`, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`
    }
  });
}
```

### 查询优先级

```
1. 查询数据库：ApiConfiguration表
   └─ WHERE userId = ? AND apiType = ? AND isActive = true

2. 如果找到 → 返回用户配置（解密）

3. 如果未找到 → 查询.env
   └─ process.env[ENV_KEY_MAPPING[apiType]]

4. 如果找到 → 返回系统配置

5. 如果都未找到 → 返回null
```

---

## 🎨 前端显示

### API配置页面布局

```
┌─────────────────────────────────────┐
│  Settings → API Configuration       │
├─────────────────────────────────────┤
│                                     │
│  System Configurations  (虚线边框)  │
│  ┌──────────┐ ┌──────────┐         │
│  │ OpenAI   │ │ Unsplash │         │
│  │ [System] │ │ [System] │         │
│  │ ✓ Available │ ✓ Available │      │
│  │ [Override] │ [Override]  │      │
│  └──────────┘ └──────────┘         │
│                                     │
│  Your Custom Configurations         │
│  ┌──────────┐ ┌──────────┐         │
│  │ Yunwu    │ │ DALL-E   │         │
│  │ [Custom] │ │ [Custom] │         │
│  │ sk-12**ef│ │ sk-ab**xy│         │
│  │ [Delete] │ │ [Delete] │         │
│  └──────────┘ └──────────┘         │
└─────────────────────────────────────┘
```

### 卡片样式区别

**系统配置**：
- 虚线边框（`border-dashed`）
- "System"徽章
- 显示环境变量名
- 只读，不可删除
- 按钮："Override with Custom Key"

**用户配置**：
- 实线边框
- "Custom"徽章
- 显示脱敏的API密钥
- 可编辑、可删除
- 按钮："Delete"

---

## 🛠️ 集成到现有代码

### 在Image Generation中使用

**修改前**：
```typescript
const apiKey = process.env.YUNWU_API_KEY;
```

**修改后**：
```typescript
import { getApiConfigOrThrow } from '@/lib/api-config-resolver';

const config = await getApiConfigOrThrow(userId, 'YUNWU');
const apiKey = config.apiKey;
const baseUrl = config.baseUrl;

console.log(`Using ${config.source} config`); // 记录来源
```

### 在Unsplash Search中使用

**修改前**：
```typescript
const unsplash = createApi({
  accessKey: process.env.UNSPLASH_ACCESS_KEY || "",
});
```

**修改后**：
```typescript
const config = await getApiConfig(userId, 'UNSPLASH');
const unsplash = createApi({
  accessKey: config?.apiKey || process.env.UNSPLASH_ACCESS_KEY || "",
});
```

---

## ⚙️ .env变量映射表

| API Type | .env Variable | 默认Base URL |
|----------|---------------|--------------|
| OPENAI | LLM_API_KEY | https://api.openai.com/v1 |
| CLAUDE | ANTHROPIC_API_KEY | https://api.anthropic.com/v1 |
| BEDROCK | AWS_ACCESS_KEY_ID | AWS SDK |
| UNSPLASH | UNSPLASH_ACCESS_KEY | https://api.unsplash.com |
| DALLE | OPENAI_API_KEY | https://api.openai.com/v1 |
| YUNWU | YUNWU_API_KEY | https://api.xiaomimimo.com/v1 |
| DASHSCOPE | DASHSCOPE_API_KEY | https://dashscope.aliyuncs.com/api/v1 |

**注意**：
- OPENAI和DALLE共享OpenAI密钥
- BEDROCK使用AWS凭证（支持多种认证方式）
- LLM_BASE_URL可自定义（支持本地模型）

---

## 🔐 安全考虑

### 系统配置（.env）

**优点**：
- 集中管理
- 不暴露给前端
- 适合内部使用

**注意**：
- .env文件不应提交到Git
- 使用环境变量管理工具（如AWS Secrets Manager）
- 定期轮换密钥

### 用户配置（数据库）

**安全措施**：
- AES-256-GCM加密存储
- 前端仅显示脱敏密钥
- 用户数据完全隔离
- 只能访问自己的配置

---

## 📊 配置状态查看

### 查看所有可用配置

```typescript
import { getApiConfigDisplay } from '@/lib/api-config-resolver';

const configs = await getApiConfigDisplay(userId);

configs.forEach(config => {
  console.log(`${config.label}: ${config.source}`);
  // 输出示例:
  // OpenAI: user
  // Unsplash: system
  // Yunwu: user
});
```

### 检查配置是否存在

```typescript
import { hasApiConfig } from '@/lib/api-config-resolver';

const hasOpenAI = await hasApiConfig(userId, 'OPENAI');
if (hasOpenAI) {
  // 可以使用OpenAI功能
}
```

---

## 🎯 最佳实践

### 1. 分层配置策略

```
生产环境：
├─ .env (系统级)
│  ├─ UNSPLASH_ACCESS_KEY  ← 所有用户共享
│  └─ YUNWU_API_KEY        ← 备用密钥
│
└─ 数据库 (用户级)
   ├─ User A: OPENAI       ← 用户自己的
   └─ User B: CLAUDE       ← 用户自己的
```

### 2. 配额管理

- 系统配置：共享配额
- 用户配置：独立配额

### 3. 成本优化

**免费/低成本服务** → 系统配置：
- Unsplash（免费，有限制）

**付费/高成本服务** → 用户配置：
- OpenAI GPT-4
- Claude Opus
- DALL-E 3

---

## 🚀 快速开始

### 初次配置

1. **配置.env**（管理员）
   ```bash
   # 必需：至少配置一个LLM
   LLM_API_KEY="sk-..."

   # 可选：其他服务
   UNSPLASH_ACCESS_KEY="..."
   YUNWU_API_KEY="..."
   ```

2. **重启应用**
   ```bash
   pnpm dev
   ```

3. **用户访问**
   - 打开 `/settings/api-config`
   - 看到"System Configurations"显示可用的系统配置
   - 如需自定义，点击"Override with Custom Key"

### 用户自定义流程

1. 访问 Settings → API Configuration
2. 在"System Configurations"区域看到可用的系统默认配置
3. 点击"Override with Custom Key"或"Add Custom Key"
4. 输入自己的API密钥
5. 测试连接
6. 保存

**结果**：
- 该用户的所有请求使用自定义密钥
- 不影响其他用户
- 可随时删除恢复使用系统默认

---

## 💡 提示

1. **首次部署建议**：
   - 在.env中配置所有API密钥
   - 让用户直接使用，无需额外配置
   - 后续根据需要开放用户自定义

2. **多租户SaaS建议**：
   - .env中只配置免费/低成本服务
   - 付费服务要求用户自己配置
   - 实现独立计费

3. **开发环境建议**：
   - .env中配置开发用的API密钥
   - 方便快速测试
   - 不需要数据库配置

---

## 🔍 故障排查

### 配置不生效

**检查步骤**：

1. 验证.env中的变量名是否正确
   ```bash
   cat .env | grep API_KEY
   ```

2. 重启应用（.env修改需要重启）
   ```bash
   pnpm dev
   ```

3. 检查变量映射
   - 参考 `src/lib/api-config-resolver.ts` 中的 `ENV_KEY_MAPPING`

### 用户配置覆盖失败

**原因**：可能是加密密钥问题

**检查**：
```bash
# 确认ENCRYPTION_KEY已配置
cat .env | grep ENCRYPTION_KEY
```

---

## 📝 总结

API配置系统现在支持灵活的两级配置：

- 🏢 **系统级**：快速统一配置
- 👤 **用户级**：个性化自定义
- 🔄 **智能回退**：用户配置优先，自动回退到系统配置
- 🎨 **清晰标识**：前端明确显示配置来源

这种设计兼顾了易用性和灵活性！
