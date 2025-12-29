# Claude Agent 分阶段 PPT 生成功能使用指南

## 概述

Slide Forge 现已支持由 Claude Agent 驱动的分阶段 PPT 生成功能，实现智能化的演示文稿创建流程。

## 核心功能

### 1. 分阶段工作流

- **大纲生成** → **用户确认** → **逐页生成** → **每页确认** → **导出**
- 每个阶段都可以根据用户反馈进行调整
- 支持多轮迭代优化

### 2. 智能图表生成

- 自动识别内容类型（流程、数据、对比、列表等）
- 使用 **AntV Infographic** 生成专业信息图
- 197+ 种模板自动选择
- 支持图标和插图（Iconify + unDraw）

### 3. 自动配图

- 集成 **Unsplash API** 自动搜索专业配图
- 智能匹配幻灯片主题
- 自动添加图片来源标注

### 4. 多格式导出

- **PNG** - 高清图片（ZIP 打包）
- **PPTX** - PowerPoint 格式
- **PDF** - 保留完整样式

## 工作流阶段

### 阶段 1: IDLE（待开始）
用户开始对话，描述需求。

**示例对话**:
```
User: "创建一个关于人工智能趋势的演示文稿"
Agent: "好的！我来帮你创建。请告诉我：
- 需要多少张幻灯片？
- 是否需要我搜索网络获取最新信息？
- 有什么特殊要求吗？"
```

### 阶段 2: OUTLINE_GENERATION（生成大纲）
Agent 根据需求生成结构化大纲。

**大纲格式**:
```markdown
# 封面：人工智能趋势
- 2025年展望
- 行业变革

# AI 技术演进
- 机器学习发展历程
- 深度学习突破
- 大模型时代

# 应用场景
- 医疗健康
- 金融科技
- 制造业
...
```

### 阶段 3: OUTLINE_CONFIRMATION（确认大纲）
用户审查大纲，可以：
- 确认：`"看起来不错，开始生成吧"`
- 修改：`"第3页改成AI安全与伦理"`
- 重新生成：`"重新生成一个更技术化的大纲"`

### 阶段 4: SLIDE_GENERATION（逐页生成）
Agent 逐页生成 HTML：

**每页生成时**:
1. 分析大纲内容
2. 判断是否需要 Infographic
3. 判断是否需要配图
4. 生成完整 HTML
5. 展示预览并等待确认

**Agent 会说**:
```
"正在生成第 1 张幻灯片（共 10 张）...

[显示预览]

这是封面页，我添加了一张专业的科技背景图。看起来如何？"
```

### 阶段 5: SLIDE_CONFIRMATION（确认幻灯片）
用户审查当前幻灯片：
- 确认：`"很好，下一张"`
- 修改：`"标题改成'AI的未来'"`
- 重新生成：`"重新设计这一页，风格更简洁"`

### 阶段 6: COMPLETED（完成）
所有幻灯片生成完毕，提供导出选项。

## Infographic 自动判断规则

Agent 会根据以下规则自动决定是否使用 Infographic：

### 1. 序列流程（Sequence）
**关键词**: 步骤、阶段、流程、时间线
**示例内容**:
```
# 产品开发流程
- 需求分析
- 设计
- 开发
- 测试
- 发布
```
**自动选择**: `sequence-horizontal-zigzag-underline-text`

### 2. 数据图表（Chart）
**关键词**: 百分比、份额、数据、统计
**示例内容**:
```
# 市场份额
- 苹果：35%
- 三星：28%
- 其他：37%
```
**自动选择**: `chart-pie-plain-text`

### 3. 对比分析（Compare）
**关键词**: vs、对比、优缺点
**示例内容**:
```
# 云服务对比
传统部署 vs 云原生
- 成本
- 灵活性
- 维护
```
**自动选择**: `compare-binary-horizontal-simple-fold`

### 4. 特性列表（List）
**关键词**: 功能、特性、优势
**示例内容**:
```
# 核心功能
- AI 助手
- 实时协作
- 云存储
- 数据分析
```
**自动选择**: `list-grid-badge-card`

## 技术架构

### 数据流

```
User Input → Agent Chat → Agent Service → Tools
                                            ↓
Database ← Session Manager ← Tool Results ←
   ↓
Frontend State (Zustand) → UI Components
```

### 关键文件

**后端**:
- `/src/lib/agent/tools/` - 7个核心工具
- `/src/lib/agent/agent-service.ts` - Agent 配置
- `/src/lib/agent/session-manager.ts` - 会话管理
- `/src/lib/agent/types/workflow.ts` - 类型定义

**前端**:
- `/src/components/presentation/agent/workflow/` - 工作流组件
- `/src/components/presentation/agent/slides/` - 幻灯片组件
- `/src/components/presentation/agent/export/` - 导出组件
- `/src/states/agent-state.ts` - 状态管理

**导出**:
- `/src/lib/presentation/export-to-png.ts`
- `/src/lib/presentation/export-to-pptx.ts`
- `/src/lib/presentation/export-to-pdf.ts`

## 环境配置

### 必需的环境变量

在 `.env.local` 中配置：

```env
# Unsplash API（必需）
UNSPLASH_ACCESS_KEY=your_unsplash_access_key_here

# 数据库（已有）
DATABASE_URL=postgresql://...

# AWS Bedrock（已有）
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-west-2
```

### 获取 Unsplash API Key

1. 访问 https://unsplash.com/developers
2. 注册开发者账号
3. 创建应用
4. 复制 Access Key
5. 添加到 `.env.local`

## 依赖包

已安装的关键依赖：

```json
{
  "@antv/infographic": "^0.2.1",
  "unsplash-js": "^7.0.20",
  "html2canvas-pro": "latest",
  "pptxgenjs": "latest",
  "jspdf": "^3.0.4",
  "jszip": "^3.10.1"
}
```

## 使用示例

### 示例 1: 创建技术演示文稿

```
User: "创建一个10页的云计算技术演示文稿，搜索最新信息"

Agent: "好的！让我为你创建..."

[Agent 生成大纲]

Agent: "这是大纲:
# 1. 云计算简介
- 定义和核心概念
- 发展历程

# 2. 主要云服务商
- AWS, Azure, GCP
- 市场份额对比

...

看起来如何？"

User: "很好，开始生成"

Agent: "正在生成第1页..."
[显示预览，包含时间线 Infographic]

User: "不错，继续"

[循环直到完成]

Agent: "太棒了！所有10页都完成了。要导出吗？"
```

### 示例 2: 修改和调整

```
Agent: "这是第5页 - 市场数据分析"
[显示包含饼图的幻灯片]

User: "图表改成柱状图，数据要用2024年的"

Agent: "好的，让我重新生成这一页..."
[使用 chart-column-simple 重新生成]

Agent: "更新后的第5页，使用了柱状图。这样可以吗？"
```

## 数据持久化

所有数据保存到数据库：

- **outline**: 大纲内容（JSON数组）
- **slides**: 所有幻灯片数据（JSON）
- **workflowState**: 完整工作流状态
- **modificationHistory**: 修改历史记录

支持：
- 会话中断后恢复
- 查看修改历史
- 多轮迭代优化

## 故障排除

### 问题 1: Infographic 不显示
**原因**: 图标加载失败
**解决**: 检查网络连接，Resource Loader 会自动重试

### 问题 2: Unsplash 图片加载失败
**原因**: API Key 未配置或无效
**解决**:
1. 检查 `.env.local` 中的 `UNSPLASH_ACCESS_KEY`
2. 确认 API Key 有效
3. 检查 API 配额

### 问题 3: 导出失败
**原因**: 浏览器限制或内存不足
**解决**:
1. 减少同时导出的幻灯片数量
2. 使用单页导出功能
3. 关闭其他浏览器标签页

### 问题 4: Agent 不响应
**原因**: 会话超时或网络问题
**解决**:
1. 刷新页面重新开始
2. 检查 AWS Bedrock 配置
3. 查看浏览器控制台日志

## 性能优化建议

1. **Infographic 渲染**: 首次加载图标较慢，后续有缓存
2. **导出大型 PPT**: 分批导出，避免内存溢出
3. **数据库查询**: 已添加索引优化查询性能

## 后续增强方向

- [ ] AI 图片生成（DALL·E 集成）
- [ ] 多主题模板系统
- [ ] 协作编辑功能
- [ ] 语音输入支持
- [ ] 智能布局建议

## 反馈和支持

如有问题或建议，请提交 Issue。

---

**Version**: 1.0.0
**Last Updated**: 2025-12-29
**Author**: Slide Forge Team
