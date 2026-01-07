# Chat to Slide 预览功能

## ✨ 功能概述

在Chat to Slide中新增了"预览所有幻灯片"功能，让用户可以：
- 🖼️ 以网格视图查看所有已生成的幻灯片
- 🔍 点击任意幻灯片查看全尺寸预览
- ◀️▶️ 使用导航按钮在幻灯片间切换
- 📊 实时查看生成进度

---

## 🎯 功能位置

### 位置1：工作流顶部（主要入口）

**显示时机**：有幻灯片生成后

**位置**：WorkflowContainer右侧顶部，WorkflowProgress旁边

**样式**：独立的"Preview All (N)"按钮

```
┌─────────────────────────────────────┐
│ [Workflow Progress] [Preview All(3)]│
├─────────────────────────────────────┤
│                                     │
│  (工作流内容区域)                    │
│                                     │
└─────────────────────────────────────┘
```

### 位置2：幻灯片生成阶段

**显示时机**：在生成过程中，有已完成的幻灯片时

**位置**：SlideGenerationStage的"Current Progress"卡片

**样式**：带图标的Badge，显示已完成数量

```
┌─────────────────────────────────────┐
│ Current Progress  [Preview (3)] [Slide 4 of 10] │
├─────────────────────────────────────┤
│ ▓▓▓░░░░░░░ (进度条)                 │
└─────────────────────────────────────┘
```

### 位置3：完成阶段

**显示时机**：所有幻灯片生成完成后

**位置**：CompletedStage的Actions卡片

**样式**：outline按钮，与导出按钮并列

```
┌─────────────────────────────────────┐
│ Actions                             │
├─────────────────────────────────────┤
│ [Preview All Slides] [Export...]    │
└─────────────────────────────────────┘
```

---

## 🖼️ 预览界面

### 网格视图（主界面）

```
┌───────────────────────────────────────────────┐
│ Presentation Preview                          │
│ 10 slides generated - Click any to view full │
├───────────────────────────────────────────────┤
│                                               │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐                    │
│  │ 1 │ │ 2 │ │ 3 │ │ 4 │ (缩略图网格)       │
│  └───┘ └───┘ └───┘ └───┘                    │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐                    │
│  │ 5 │ │ 6 │ │ 7 │ │ 8 │                    │
│  └───┘ └───┘ └───┘ └───┘                    │
│  ┌───┐ ┌───┐                                 │
│  │ 9 │ │10 │                                 │
│  └───┘ └───┘                                 │
│                                               │
└───────────────────────────────────────────────┘
```

**特性**：
- 响应式网格：2-4列（根据屏幕大小）
- 悬停效果：边框高亮 + 放大镜图标
- 幻灯片编号徽章
- 生成中状态显示

### 全屏视图（点击幻灯片后）

```
┌───────────────────────────────────────────────┐
│ [Slide 3] Title here...        3 of 10    [X]│
├───────────────────────────────────────────────┤
│                                               │
│                                               │
│         (全尺寸幻灯片预览)                     │
│                                               │
│                                               │
├───────────────────────────────────────────────┤
│ [◀ Previous]    ●●○○○○○○○○    [Next ▶]     │
└───────────────────────────────────────────────┘
```

**特性**：
- 全屏大图显示
- 左右导航按钮
- 点状进度指示器
- 幻灯片标题显示
- 键盘快捷键支持（待实现）

---

## 💻 技术实现

### 组件结构

**SlidesPreviewDialog.tsx**：
```typescript
interface SlidesPreviewDialogProps {
  slides: SlideData[];           // 所有幻灯片数据
  trigger?: React.ReactNode;     // 自定义触发按钮（可选）
}
```

### 状态管理

```typescript
const [open, setOpen] = useState(false);              // 对话框开关
const [selectedSlideIndex, setSelectedSlideIndex] = useState<number | null>(null);  // 当前查看的幻灯片
```

### 双层对话框设计

**外层对话框**：网格视图
- 显示条件：`open && selectedSlideIndex === null`
- 内容：缩略图网格

**内层对话框**：全屏视图
- 显示条件：`selectedSlideIndex !== null`
- 内容：单张幻灯片大图

### 幻灯片缩略图渲染

使用CSS transform缩放：

```typescript
<SlideHTMLRenderer
  html={slide.html}
  slideNumber={slideNumber}
  className="scale-[0.25] origin-top-left"
  style={{
    width: '400%',
    height: '400%',
    pointerEvents: 'none',  // 禁用交互
  }}
/>
```

**原理**：
- 原始尺寸：1280x720px
- 缩放到25%：320x180px
- 完美适配aspect-video容器

---

## 🎨 视觉设计

### 缩略图卡片

**正常状态**：
- 边框：2px solid border
- 圆角：rounded-lg
- 编号徽章：左上角

**悬停状态**：
- 边框：primary色
- 叠加层：黑色40%透明度
- 放大镜图标：居中显示

**选中状态**（全屏视图返回后）：
- 边框：primary色 + ring效果

### 状态指示

**生成中**：
- 右上角"Generating"徽章
- 加载动画图标

**已完成**：
- 仅显示幻灯片编号

**错误**：
- （当前未特殊标注，可后续增强）

---

## 🚀 使用方法

### 用户操作流程

1. **触发预览**
   - 方式A：点击顶部"Preview All (N)"按钮
   - 方式B：点击进度卡片中的"Preview (N)"徽章
   - 方式C：（完成后）点击"Preview All Slides"按钮

2. **网格视图**
   - 浏览所有幻灯片缩略图
   - 点击任意缩略图进入全屏视图

3. **全屏视图**
   - 查看单张幻灯片的完整内容
   - 使用"Previous/Next"按钮切换
   - 使用底部点状指示器快速跳转
   - 点击"X"关闭回到网格视图

4. **关闭预览**
   - 网格视图：点击外部区域或ESC键
   - 全屏视图：点击"X"回到网格，再次关闭回到主界面

---

## ⚙️ 集成位置

### 文件修改清单

**新建文件**：
- `src/components/presentation/agent/SlidesPreviewDialog.tsx`

**修改文件**：
1. `src/components/presentation/agent/workflow/WorkflowContainer.tsx`
   - 在右侧顶部添加预览按钮

2. `src/components/presentation/agent/workflow/SlideGenerationStage.tsx`
   - 在进度卡片添加预览徽章

3. `src/components/presentation/agent/workflow/CompletedStage.tsx`
   - 在Actions区域添加预览按钮

---

## 🎯 特性亮点

### 1. 智能显示

只在有幻灯片时显示预览按钮：

```typescript
{slides.length > 0 && slides.some((s) => s.html) && (
  <SlidesPreviewDialog slides={slides} />
)}
```

### 2. 灵活触发

支持自定义trigger：

```typescript
// 默认按钮
<SlidesPreviewDialog slides={slides} />

// 自定义trigger
<SlidesPreviewDialog
  slides={slides}
  trigger={<Button>Custom Trigger</Button>}
/>
```

### 3. 响应式布局

- 移动端：2列网格
- 平板：3列网格
- 桌面：4列网格

### 4. 性能优化

- 只渲染有内容的幻灯片
- 使用CSS transform而非重新渲染
- 禁用缩略图的pointer events

---

## 🔮 未来增强建议

### 短期（可选）

- [ ] 键盘快捷键（←→箭头切换幻灯片）
- [ ] 缩略图懒加载（大量幻灯片时）
- [ ] 拖拽排序功能
- [ ] 快速删除某张幻灯片

### 长期（可选）

- [ ] 缩略图实时更新（WebSocket）
- [ ] 批量编辑/修改
- [ ] 幻灯片备注功能
- [ ] 演讲者模式

---

## 📊 使用统计建议

可以添加预览操作的使用统计：

```typescript
// 在打开预览时追踪
await trackUsage('SLIDE_PREVIEW', 1, {
  slideCount: slides.length,
  sessionId,
});
```

---

## ✅ 测试清单

- [ ] 点击"Preview All"打开网格视图
- [ ] 网格正确显示所有幻灯片缩略图
- [ ] 点击缩略图打开全屏视图
- [ ] 全屏视图中使用Previous/Next切换正常
- [ ] 点状指示器可跳转到任意幻灯片
- [ ] 关闭对话框正常
- [ ] 响应式布局在不同屏幕尺寸下正常
- [ ] 生成中的幻灯片显示正确（有"Generating"徽章）

---

## 🎉 总结

Chat to Slide现在支持完整的预览功能：

✅ **多入口访问** - 3个位置可触发预览
✅ **网格视图** - 快速浏览所有幻灯片
✅ **全屏视图** - 查看完整幻灯片内容
✅ **流畅导航** - 左右切换 + 点状指示器
✅ **实时更新** - 生成过程中可随时预览已完成的幻灯片
✅ **响应式设计** - 适配各种屏幕尺寸

用户体验大幅提升！🚀
