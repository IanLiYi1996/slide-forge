# API配置系统 - 最终设计

## 🎯 设计理念

**双层配置架构**：
1. **系统默认配置**（.env）- 管理员在部署时配置，所有用户可用
2. **用户自定义配置**（数据库）- 用户在前端配置，覆盖系统默认

**优先级**：用户配置 > 系统配置（.env）

---

## ⚙️ 工作原理

### API类型定义

**文件**：`src/lib/api-types-config.ts`

```typescript
export const API_TYPES = [
  {
    apiName: 'LLM_API_KEY',           // 对应.env中的变量名
    displayName: 'LLM Provider',       // 前端显示名称
    description: 'Language model API', // 描述
    category: 'llm',                   // 分类
    defaultBaseUrl: 'https://api.openai.com/v1',
    placeholder: 'sk-proj-...',
  },
  // ... 更多API类型
];
```

### 配置解析流程

```
用户请求API配置 (userId, apiName)
    ↓
查询数据库: ApiConfiguration
    ├─ 找到用户配置 → 解密并返回 (source: 'user')
    └─ 未找到
        ↓
    查询process.env[apiName]
        ├─ 找到 → 返回.env值 (source: 'system')
        └─ 未找到 → 返回null
```

---

## 🚀 使用场景

### 场景1：完全系统配置

**.env**:
```bash
LLM_API_KEY="sk-system-openai-key"
UNSPLASH_ACCESS_KEY="system-unsplash-key"
YUNWU_API_KEY="system-yunwu-key"
```

**效果**：
- ✅ 所有用户自动使用系统配置
- ✅ 无需用户操作，开箱即用
- ✅ 前端显示"System Defaults"区域（虚线边框）
- ✅ 用户可以选择"Override with Custom Key"覆盖

### 场景2：用户自带密钥

**.env**:
```bash
# 仅配置免费/基础服务
UNSPLASH_ACCESS_KEY="free-unsplash-key"
```

**效果**：
- ✅ Unsplash使用系统默认
- ✅ 其他API要求用户自己配置
- ✅ 用户配置后独立计费

### 场景3：混合模式（推荐）

**.env**:
```bash
# 提供基础服务
LLM_API_KEY="basic-openai-key"
UNSPLASH_ACCESS_KEY="system-unsplash"

# 不配置高级服务（让用户自己配）
# ANTHROPIC_API_KEY=""
# YUNWU_API_KEY=""
```

**效果**：
- ✅ 新用户可用基础LLM和Unsplash
- ✅ 高级用户配置Claude和Yunwu获得更好体验
- ✅ 灵活且成本可控

---

## 🖥️ 前端UI展示

### 页面布局

```
┌─────────────────────────────────────────────────┐
│  Settings → API Configuration                   │
│                                                 │
│  [Tab: Language Models] [Image] [Search] ...   │
├─────────────────────────────────────────────────┤
│                                                 │
│  📍 System Defaults (虚线边框)                  │
│  ┌─────────────────┐  ┌─────────────────┐     │
│  │ LLM Provider    │  │ Unsplash        │     │
│  │ [System] badge  │  │ [System] badge  │     │
│  │ ✓ Available     │  │ ✓ Available     │     │
│  │ From: LLM_API_KEY│ │ From: UNSPLASH...│    │
│  │ [Override...]   │  │ [Override...]   │     │
│  └─────────────────┘  └─────────────────┘     │
│                                                 │
│  👤 Your Custom Configurations (实线边框)       │
│  ┌─────────────────┐  ┌─────────────────┐     │
│  │ Yunwu AI        │  │ Claude          │     │
│  │ [Custom] badge  │  │ [Custom] badge  │     │
│  │ [Active] badge  │  │ [Active] badge  │     │
│  │ sk-12****ef     │  │ sk-an****xyz    │     │
│  │ [Delete]        │  │ [Delete]        │     │
│  └─────────────────┘  └─────────────────┘     │
└─────────────────────────────────────────────────┘
```

### 视觉区别

**系统配置卡片**：
- 虚线边框（`border-dashed border-2`）
- "System"徽章（outline样式）
- 绿色勾选 "✓ Available"
- 显示.env变量名
- 按钮：灰色"Override with Custom Key"

**用户配置卡片**：
- 实线边框
- "Custom"徽章（default样式）
- "Active/Inactive"状态
- 显示脱敏API密钥
- 按钮：红色"Delete"

---

## 💻 代码集成示例

### 在现有代码中使用

```typescript
import { getApiConfig, getApiConfigOrThrow } from '@/lib/api-config-resolver';

// 示例1：带错误处理
async function generateImage(userId: string) {
  const config = await getApiConfig(userId, 'YUNWU_API_KEY');

  if (!config) {
    throw new Error('Please configure Yunwu API in Settings');
  }

  console.log(`Using ${config.source} config`); // 'user' or 'system'

  const response = await fetch(`${config.baseUrl}/generate`, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`
    },
    // ...
  });
}

// 示例2：直接使用（会自动抛出错误）
async function searchImages(userId: string, query: string) {
  const config = await getApiConfigOrThrow(userId, 'UNSPLASH_ACCESS_KEY');

  // config一定存在，否则上面已经抛出错误
  const response = await fetch(`${config.baseUrl}/search/photos`, {
    headers: {
      'Authorization': `Client-ID ${config.apiKey}`
    },
    // ...
  });
}
```

### Helper函数

```typescript
import {
  getLLMConfig,
  getUnsplashConfig,
  getYunwuConfig
} from '@/lib/api-config-resolver';

// 快捷获取常用配置
const llmConfig = await getLLMConfig(userId);
const unsplashConfig = await getUnsplashConfig(userId);
```

---

## 📝 添加新的API类型

只需修改 `src/lib/api-types-config.ts`：

```typescript
export const API_TYPES: ApiTypeDefinition[] = [
  // ... 现有类型 ...

  // 添加新类型
  {
    apiName: 'MY_NEW_API_KEY',        // .env变量名
    displayName: 'My New API',        // 前端显示
    description: 'Description here',  // 说明
    category: 'other',                // 分类: llm/image/search/storage/other
    defaultBaseUrl: 'https://api.mynewapi.com',
    placeholder: 'api-key-...',
    docUrl: 'https://docs.mynewapi.com',
  },
];
```

**无需修改**：
- ❌ 数据库Schema（使用动态字符串）
- ❌ API端点（自动支持）
- ❌ 前端页面（自动显示新类型）

**只需重启**应用即可生效！

---

## 🔄 配置优先级示例

### 示例1：LLM_API_KEY

**.env配置**：
```bash
LLM_API_KEY="sk-system-key-123"
```

**用户A**：未配置
- ✅ 使用系统默认：`sk-system-key-123`
- ✅ 前端显示"System"徽章

**用户B**：配置了自己的密钥
```
apiName: LLM_API_KEY
apiKey: "sk-user-b-key-456" (加密存储)
```
- ✅ 使用用户配置：`sk-user-b-key-456`
- ✅ 前端显示"Custom"徽章
- ✅ 不显示在"System Defaults"区域（已被覆盖）

### 示例2：YUNWU_API_KEY

**.env配置**：
```bash
# 未配置YUNWU_API_KEY
```

**用户A**：未配置
- ❌ 无可用配置
- ❌ 调用时抛出错误："Please configure Yunwu API"

**用户B**：配置了
- ✅ 使用用户配置
- ✅ 功能正常

---

## 🎨 前端分类Tab显示

**Language Models** Tab:
- System: LLM_API_KEY, ANTHROPIC_API_KEY
- Custom: （用户添加的）

**Image Generation** Tab:
- System: YUNWU_API_KEY, DASHSCOPE_API_KEY
- Custom: （用户添加的）

**Search & Discovery** Tab:
- System: UNSPLASH_ACCESS_KEY, TAVILY_API_KEY
- Custom: （用户添加的）

**File Storage** Tab:
- System: UPLOADTHING_TOKEN
- Custom: （用户添加的）

---

## ✅ 验证配置

### 1. 查看所有可用配置

访问：`/settings/api-config`

### 2. 系统配置验证

在.env中添加：
```bash
LLM_API_KEY="test-key"
UNSPLASH_ACCESS_KEY="test-unsplash"
```

刷新页面，应该在对应Tab的"System Defaults"区域看到这些配置。

### 3. 用户覆盖测试

1. 点击系统配置的"Override with Custom Key"
2. 输入自己的密钥
3. 点击"Test Connection"
4. 保存后，该配置移到"Your Custom Configurations"区域

### 4. 优先级验证

```typescript
// 在代码中测试
const config = await getApiConfig(userId, 'LLM_API_KEY');
console.log(config?.source); // 'user' 或 'system'
```

---

## 🎉 最终效果

- ✅ API类型基于.env变量名（动态，可扩展）
- ✅ 支持.env系统默认值
- ✅ 用户可覆盖系统默认
- ✅ 前端清晰显示配置来源
- ✅ 分类Tab组织
- ✅ 完全加密存储
- ✅ 智能回退机制

完美支持你的需求！🚀
