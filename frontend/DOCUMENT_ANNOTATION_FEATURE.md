# Document Processor 画圈标注功能

## ✨ 功能概述

为Document Processor添加了图像标注功能，允许用户在图片上画圈来标记需要AI关注的区域。

**核心特性**：
- 🎨 在图片上自由画圈
- 🎯 标记重点区域给AI
- 🤖 AI自动去除圆圈并处理图片
- 🔄 可随时切换回原图

---

## 🎯 使用场景

### 场景1：突出重点区域
用户想让AI处理图片中的某个特定部分：
1. 点击"Draw Circles"按钮
2. 在需要关注的区域画圈
3. 输入处理指令："增强这个区域的清晰度"
4. AI会关注圈出的区域，然后自动去除圆圈

### 场景2：标记多个元素
用户需要AI处理多个分散的元素：
1. 画多个圆圈标记不同位置
2. 输入："提取这些圈出的文字"
3. AI识别所有圈出区域并处理

### 场景3：排除干扰
用户想让AI忽略某些区域：
1. 画圈标记要保留的区域
2. 输入："只保留圈内内容，去除其他"
3. AI专注于圈内区域

---

## 🖱️ 操作方法

### 进入标注模式

**触发方式**：
- 点击"Draw Circles"按钮（原图卡片右上角）

**界面变化**：
- 原图区域切换为Canvas画布
- 显示标注工具栏
- 鼠标变为十字准星

### 画圈操作

**步骤**：
1. **按住鼠标左键** - 确定圆心位置
2. **拖动鼠标** - 实时预览圆圈大小
3. **释放鼠标** - 完成一个圆圈

**技巧**：
- 从圆心向外拖动
- 半径会根据拖动距离自动调整
- 可以画多个圆圈

### 标注工具

**颜色选择**：
- 🔴 红色（默认）
- 🟢 绿色
- 🔵 蓝色
- 🟡 黄色
- 🟣 紫色

点击色块切换颜色。

**线条粗细**：
- 滑块调节：1-10px
- 默认：3px
- 实时显示当前粗细值

**操作按钮**：
- **Undo** - 撤销最后一个圆圈
- **Clear** - 清除所有圆圈
- **Use Annotated Image** - 完成标注并使用

### 完成标注

点击"Use Annotated Image (N)"按钮：
- N表示画了几个圆圈
- 退出标注模式
- 显示标注后的图片
- "Annotated"徽章出现

### 使用标注图片

1. 输入处理指令
2. 点击"Process Image"
3. **AI自动执行**：
   - 理解圆圈标记的区域
   - 按指令处理图片
   - **自动去除圆圈**
   - 返回干净的处理结果

### 切换回原图

**方式1**：点击标注图片右上角的"Use Original"按钮
**方式2**：点击"Re-annotate"重新标注

---

## 💻 技术实现

### 组件架构

```
ProcessingView (主组件)
├─ Original Image Card
│  ├─ [Normal Mode] <img> 显示原图/标注图
│  └─ [Annotation Mode] ImageAnnotationCanvas
│     ├─ Canvas绘图区
│     ├─ 颜色选择器
│     ├─ 粗细滑块
│     └─ 操作按钮
└─ Processed Image Card
   └─ 处理控件
```

### ImageAnnotationCanvas组件

**核心功能**：
- Canvas绘图API
- 鼠标事件处理
- 圆圈数据存储
- 图像合成

**Props**：
```typescript
interface ImageAnnotationCanvasProps {
  imageDataUrl: string;              // 原图data URL
  onAnnotationComplete: (annotatedImageDataUrl: string) => void;  // 完成回调
  width?: number;                    // Canvas宽度
  height?: number;                   // Canvas高度
}
```

**状态管理**：
```typescript
const [circles, setCircles] = useState<CircleAnnotation[]>([]);  // 所有圆圈
const [currentCircle, setCurrentCircle] = useState<...>();       // 正在画的圆
const [circleColor, setCircleColor] = useState('#FF0000');       // 颜色
const [lineWidth, setLineWidth] = useState(3);                   // 粗细
```

### 绘图流程

```
1. 加载原图到Canvas
   ↓
2. 用户画圈（鼠标事件）
   ├─ onMouseDown: 记录起点
   ├─ onMouseMove: 实时预览圆圈
   └─ onMouseUp: 保存圆圈到数组
   ↓
3. 重绘Canvas
   ├─ 清空画布
   ├─ 绘制原图
   └─ 绘制所有圆圈
   ↓
4. 导出为Data URL
   canvas.toDataURL('image/png')
```

### API调用增强

**修改位置**：`ProcessingView.tsx:76-78`

```typescript
const finalInstruction = annotatedImageUrl
  ? `${instruction.trim()}\n\nIMPORTANT: Remove any drawn circles or annotations from the image.`
  : instruction.trim();
```

**效果**：
- 如果使用了标注图片，自动在prompt末尾添加去除圆圈的指令
- AI会先理解圆圈标记的含义
- 然后在输出时自动去除圆圈

---

## 🎨 UI设计

### 标注模式工具栏

```
┌────────────────────────────────────────────────────┐
│ Color: [🔴][🟢][🔵][🟡][🟣]   Thickness: ━━━━ 3px │
│ [Undo] [Clear] [Use Annotated Image (2)]           │
└────────────────────────────────────────────────────┘
```

### 视觉状态

**未标注**：
- "Draw Circles" outline按钮
- 显示原始图片

**标注中**：
- Canvas占据整个区域
- 十字准星光标
- 工具栏完全展开

**已标注**：
- "Annotated"徽章显示
- "Re-annotate"按钮（secondary样式）
- 右上角"Use Original"按钮可移除标注

---

## 🔄 状态流转

```
[原图]
  ↓ 点击"Draw Circles"
[标注模式] - Canvas绘图
  ↓ 画圈 + "Use Annotated Image"
[已标注] - 显示带圈图片
  ↓ "Process Image"
[处理中] - 发送到API (prompt包含"去除圆圈")
  ↓
[已处理] - 显示干净的处理结果（无圆圈）
```

**随时可切换**：
- [已标注] → "Use Original" → [原图]
- [已标注] → "Re-annotate" → [标注模式]

---

## 🤖 AI处理逻辑

### Prompt增强

**用户指令**：
```
增强图片清晰度
```

**实际发送给API**：
```
增强图片清晰度

IMPORTANT: Remove any drawn circles or annotations from the image.
```

### AI理解流程

1. **识别圆圈**：AI看到图片中的红色/彩色圆圈
2. **理解意图**：判断圆圈标记的是需要关注的区域
3. **执行处理**：根据用户指令处理圆圈区域
4. **清理标注**：去除所有绘制的圆圈
5. **返回结果**：干净的处理后图片

---

## 📊 Canvas技术细节

### 坐标系统

**Canvas坐标**：
- 逻辑像素：width x height (如1200x800)
- 物理像素：由浏览器缩放

**坐标转换**：
```typescript
const rect = canvas.getBoundingClientRect();
const scaleX = canvas.width / rect.width;
const scaleY = canvas.height / rect.height;

const canvasX = (mouseX - rect.left) * scaleX;
const canvasY = (mouseY - rect.top) * scaleY;
```

### 绘制性能优化

**每次鼠标移动**：
1. 清空画布
2. 重绘原图
3. 重绘所有已保存的圆圈
4. 绘制当前正在画的圆圈（预览）

**优化点**：
- 使用requestAnimationFrame（可选增强）
- 只在鼠标事件时重绘
- 缓存图片对象

---

## ⚙️ 配置参数

### Canvas尺寸计算

```typescript
width={1200}  // 固定宽度
height={Math.round((1200 * imgHeight) / imgWidth)}  // 按比例计算高度
```

保持原图宽高比。

### 最小圆圈半径

```typescript
if (radius > 5) {  // 只保存半径>5px的圆圈
  setCircles([...circles, newCircle]);
}
```

避免误触产生的小点。

---

## 🎯 使用提示

### 最佳实践

1. **精确标注**：
   - 圆圈尽量贴合目标区域
   - 不要画太大的圆（覆盖无关区域）
   - 不要画太小的圆（AI可能忽略）

2. **清晰指令**：
   ```
   好：提取圈出的表格数据
   不好：处理一下
   ```

3. **多区域标注**：
   - 可以画多个圆圈
   - 每个圆圈标记一个区域
   - AI会综合理解所有标记

4. **颜色选择**：
   - 红色：最常用，对比度高
   - 其他颜色：根据图片背景选择

---

## 🔮 未来增强

### 可选功能

- [ ] 支持矩形标注
- [ ] 支持箭头标注
- [ ] 支持文字标注
- [ ] 撤销/重做历史栈
- [ ] 保存标注配置
- [ ] 键盘快捷键（Ctrl+Z撤销等）
- [ ] 触摸屏支持

---

## 📝 代码示例

### 基本使用

```typescript
import { ImageAnnotationCanvas } from './ImageAnnotationCanvas';

function MyComponent() {
  const [annotatedImage, setAnnotatedImage] = useState<string | null>(null);

  return (
    <ImageAnnotationCanvas
      imageDataUrl={originalImage}
      onAnnotationComplete={(annotatedUrl) => {
        setAnnotatedImage(annotatedUrl);
        // 使用annotatedUrl发送给API
      }}
      width={1200}
      height={900}
    />
  );
}
```

### 在ProcessingView中的集成

```typescript
// 切换到标注模式
<Button onClick={() => setAnnotationMode(true)}>
  Draw Circles
</Button>

// 显示标注Canvas或普通图片
{annotationMode ? (
  <ImageAnnotationCanvas
    imageDataUrl={currentPage.dataUrl}
    onAnnotationComplete={handleAnnotationComplete}
  />
) : (
  <img src={annotatedImageUrl || currentPage.dataUrl} />
)}

// 处理时使用标注图片
const imageToProcess = annotatedImageUrl || currentPage.dataUrl;
const finalInstruction = annotatedImageUrl
  ? `${instruction}\n\nIMPORTANT: Remove any drawn circles...`
  : instruction;
```

---

## ✅ 功能清单

- [x] Canvas绘图实现
- [x] 鼠标拖动画圈
- [x] 多圆圈支持
- [x] 颜色选择（5种）
- [x] 线条粗细调节
- [x] 撤销功能
- [x] 清除所有
- [x] 导出标注图片
- [x] 集成到ProcessingView
- [x] 切换标注/原图
- [x] API prompt自动增强（去除圆圈）
- [x] 状态徽章显示

---

## 🎉 总结

Document Processor现在支持：
- ✅ **可视化标注** - 画圈标记重点
- ✅ **智能处理** - AI理解标注意图
- ✅ **自动清理** - 输出无标注的干净图片
- ✅ **灵活切换** - 随时启用/禁用标注

用户体验大幅提升，可以更精确地指导AI处理图片！🚀
