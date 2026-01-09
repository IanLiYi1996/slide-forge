# Prezi 风格演示功能完整指南

## 📖 概述

Slide Forge 现在支持两种演示模式：
1. **Traditional Mode（传统模式）**：经典的线性幻灯片
2. **Prezi Mode（Prezi 模式）**：动态画布，支持缩放路径和 3D 变换

本文档介绍 Prezi 模式的功能、架构和使用方法。

---

## 🎯 核心特性

### ✅ 已实现功能

#### 1. 无限画布编辑
- 3D 空间坐标系统（X, Y, Z）
- 自由放置元素（文本、图片）
- 拖拽、缩放、旋转、透明度控制
- 多选和批量编辑
- 撤销/重做（50 步历史记录）

#### 2. 路径动画系统
- 关键帧捕获（保存相机视图）
- GSAP 驱动的平滑动画
- 5 种缓动函数（linear, ease, ease-in, ease-out, ease-in-out）
- Catmull-Rom 样条曲线插值
- 循环播放支持
- 关键帧导航（上一个/下一个）

#### 3. 导出功能
- **PDF 导出**：每个关键帧生成一页（支持 A4, 16:9, 4:3）
- **交互式 HTML**：独立 HTML 文件（可配置控件和自动播放）
- **视频/GIF**：录制路径动画（支持 MP4, WebM, GIF）

#### 4. 用户界面
- 三模式切换（编辑/路径/导出）
- 工具栏（选择、平移、文本、图片工具）
- 属性面板（实时编辑元素）
- 图层面板（管理元素层级）
- 键盘快捷键系统
- 快捷键帮助对话框

---

## 🏗️ 技术架构

### 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React Three Fiber | 9.5.0 | Three.js React 渲染器 |
| @react-three/drei | 10.7.7 | Three.js 辅助组件 |
| GSAP | 3.14.2 | 路径动画 |
| @use-gesture/react | 10.3.1 | 拖拽手势 |
| Zustand | - | 状态管理 |
| jsPDF | 3.0.4 | PDF 生成 |
| html2canvas-pro | 1.5.11 | 画布截图 |
| gif.js | 0.2.0 | GIF 生成 |

### 目录结构

```
frontend/src/
├── types/
│   └── prezi-types.ts                 # 类型定义
├── states/
│   ├── presentation-state.ts          # 全局演示状态
│   └── prezi-editor-state.ts          # Prezi 编辑器状态
├── lib/presentation/prezi/
│   ├── camera-animator.ts             # GSAP 相机动画
│   ├── path-interpolator.ts           # 路径插值算法
│   └── demo-data.ts                   # 演示数据生成
├── components/presentation/
│   ├── ModeSelector.tsx               # 模式选择器
│   └── prezi/
│       ├── editor/
│       │   ├── PreziCanvas.tsx        # Three.js 场景
│       │   ├── PreziCamera.tsx        # 相机控制
│       │   ├── PreziElement.tsx       # 元素路由
│       │   ├── PreziEditor.tsx        # 主编辑器
│       │   └── elements/
│       │       ├── TextElement.tsx    # 文本元素
│       │       ├── ImageElement.tsx   # 图片元素
│       │       ├── ShapeElement.tsx   # 形状元素（占位）
│       │       ├── GroupElement.tsx   # 分组（占位）
│       │       └── EmbedElement.tsx   # 嵌入（占位）
│       ├── toolbar/
│       │   ├── PreziToolbar.tsx       # 主工具栏
│       │   ├── ElementProperties.tsx  # 属性面板
│       │   ├── LayerPanel.tsx         # 图层面板
│       │   └── KeyboardShortcuts.tsx  # 快捷键帮助
│       ├── path/
│       │   ├── PathEditor.tsx         # 路径编辑器
│       │   └── KeyframeList.tsx       # 关键帧列表
│       ├── player/
│       │   ├── PreziPlayer.tsx        # 全屏播放器
│       │   ├── PathPlayer.tsx         # 路径播放逻辑
│       │   └── PlayerControls.tsx     # 播放控制器
│       └── export/
│           ├── ExportPanel.tsx        # 导出面板
│           ├── PDFExporter.tsx        # PDF 导出
│           ├── HTMLExporter.tsx       # HTML 导出
│           └── VideoExporter.tsx      # 视频/GIF 导出
└── app/
    ├── presentation/
    │   ├── prezi-edit/[id]/page.tsx   # Prezi 编辑页面
    │   └── prezi-play/[id]/page.tsx   # Prezi 播放页面
    └── test-prezi/page.tsx            # 测试页面
```

### 数据模型

#### Prisma Schema
```prisma
enum PresentationMode {
  TRADITIONAL  // 传统幻灯片
  PREZI        // Prezi 画布
}

model Presentation {
  presentationMode  PresentationMode @default(TRADITIONAL)
  content           Json  // PreziCanvasData for PREZI mode
  // ... other fields
}
```

#### PreziCanvasData（存储在 Presentation.content）
```typescript
{
  version: "1.0",
  canvas: {
    backgroundColor: "#ffffff",
    gridEnabled: true,
    gridSize: 50
  },
  elements: {
    "elem-1": { type: "text", position: {...}, ... },
    "elem-2": { type: "image", position: {...}, ... }
  },
  paths: [{
    id: "path-1",
    name: "Main Path",
    keyframes: [
      { camera: {...}, duration: 3, transition: {...} },
      ...
    ],
    loop: false
  }],
  activePath: "path-1",
  camera: { defaultPosition: {...}, defaultZoom: 1 }
}
```

---

## 🚀 使用指南

### 方式 1：测试页面（开发）

访问 `http://localhost:3000/test-prezi`

**操作步骤**：
1. 选择演示类型（Full Demo 或 Minimal Demo）
2. 进入编辑器界面

**Full Demo 特性**：
- 7 个预设元素（标题、副标题、3 个功能卡片、图片、结论）
- 7 个预配置关键帧，展示完整的缩放路径
- 点击 Path 模式 → Play 按钮即可查看效果

**Minimal Demo 特性**：
- 1 个文本元素
- 空白路径（手动创建关键帧）
- 适合学习和实验

### 方式 2：数据库集成（生产）

#### 创建 Prezi 演示

```typescript
import { createPresentation } from "@/app/_actions/presentation/presentationActions";
import { createInitialCanvasData } from "@/states/prezi-editor-state";

const result = await createPresentation({
  title: "My Prezi Presentation",
  mode: "PREZI", // 🔑 关键参数
  content: createInitialCanvasData(), // 或自定义数据
  theme: "default",
  language: "en-US",
});

// 跳转到编辑页面
router.push(`/presentation/prezi-edit/${result.presentation.id}`);
```

#### 编辑页面
- URL: `/presentation/prezi-edit/[id]`
- 自动加载数据库中的 Prezi 数据
- 权限验证（只能编辑自己的演示）
- 模式验证（只能编辑 PREZI 模式的演示）

#### 播放页面
- URL: `/presentation/prezi-play/[id]`
- 全屏播放器
- 支持自动播放：`/presentation/prezi-play/[id]?autoplay=true`

---

## ⌨️ 键盘快捷键

### 工具切换
- `V` - 选择工具
- `H` - 平移工具
- `T` - 文本工具
- `I` - 图片工具

### 编辑操作
- `Ctrl + Z` - 撤销
- `Ctrl + Y` - 重做
- `Delete` / `Backspace` - 删除选中元素
- `Ctrl + Click` - 多选元素

### 相机控制
- `鼠标滚轮` - 缩放
- `右键拖拽` / `Pan 工具拖拽` - 平移画布
- `0` - 重置视图
- `+` - 放大
- `-` - 缩小

### 播放控制
- `Space` - 播放/暂停路径
- `←` - 上一个关键帧
- `→` - 下一个关键帧

---

## 📝 工作流程

### 1. 编辑模式（Edit）

**添加元素**：
1. 点击工具栏的工具（Text/Image）
2. 在画布上点击放置元素
3. 调整位置、大小、旋转等属性

**编辑元素**：
1. 用选择工具点击元素
2. 在右侧属性面板调整参数
3. 或直接拖拽元素移动

**管理图层**：
1. 左侧图层面板显示所有元素
2. 点击元素选中
3. 使用显示/隐藏、锁定、删除功能

### 2. 路径模式（Path）

**创建关键帧**：
1. 切换到 Path 模式
2. 在画布中调整相机视图（平移/缩放）
3. 点击 "Capture Current View" 捕获关键帧
4. 配置停留时长（Stay Duration）和过渡时长（Transition）
5. 重复步骤 2-4 创建更多关键帧

**播放路径**：
1. 点击底部播放控制器的 Play 按钮
2. 相机会按顺序访问所有关键帧
3. 使用 Previous/Next 按钮跳转到特定帧

**编辑路径**：
- 修改路径名称
- 切换循环播放
- 删除关键帧
- 调整关键帧顺序（拖拽）

### 3. 导出模式（Export）

**PDF 导出**：
1. 选择纸张尺寸（A4, 16:9, 4:3）
2. 点击 "Export PDF"
3. 每个关键帧生成一页 PDF

**HTML 导出**：
1. 配置选项：
   - 是否包含播放控件
   - 是否自动播放
2. 点击 "Export Interactive HTML"
3. 生成独立的 HTML 文件

**视频/GIF 导出**：
1. 选择格式（GIF, WebM, MP4）
2. 点击导出按钮
3. 系统自动播放路径并录制

---

## 🔧 开发指南

### 扩展元素类型

要添加新的元素类型（如 Shape、Group、Embed）：

1. **定义类型**（已在 `prezi-types.ts` 中）
2. **创建组件**：
   ```tsx
   // src/components/presentation/prezi/editor/elements/ShapeElement.tsx
   export default function ShapeElement({ element }: { element: PreziShapeElement }) {
     // 渲染逻辑
   }
   ```
3. **注册到 PreziElement.tsx**（已自动路由）

### 添加新的导出格式

1. 在 `src/components/presentation/prezi/export/` 创建新组件
2. 在 `ExportPanel.tsx` 添加新标签页
3. 实现导出逻辑

### 自定义动画

修改 `camera-animator.ts` 或 `path-interpolator.ts`：
- 添加新的缓动函数
- 实现自定义插值算法
- 添加动画效果

---

## 🎨 设计理念

### 坐标系统
- **原点**：画布中心 (0, 0, 0)
- **X 轴**：水平（左负右正）
- **Y 轴**：垂直（上负下正）
- **Z 轴**：深度（前正后负）

### 相机系统
- **位置（Position）**：相机在 3D 空间的位置
- **目标（Target）**：相机注视的点（lookAt）
- **缩放（Zoom）**：1 = 原始大小，<1 = 缩小，>1 = 放大

### 路径系统
- **关键帧（Keyframe）**：演示的每一"步"，保存相机状态
- **停留时长（Duration）**：在关键帧位置停留的时间
- **过渡动画（Transition）**：从一个关键帧到下一个的动画

---

## 🐛 已知限制

1. **元素类型**：目前仅支持文本和图片，形状/分组/嵌入为占位符
2. **拖拽**：拖拽功能基础实现，复杂变换需要手动输入
3. **HTML 导出**：独立 HTML 播放器为简化版，需要进一步完善
4. **性能**：大量元素（>100）可能影响性能，建议合理控制
5. **移动端**：主要针对桌面浏览器优化，移动端体验有限

---

## 📊 性能优化

### 已实施优化

1. **React.memo**：TextElement 和 ImageElement 使用 memo 减少重渲染
2. **自定义比较函数**：仅在关键属性变化时重渲染
3. **WebGL 渲染**：硬件加速的 Three.js 渲染
4. **历史记录限制**：撤销/重做最多 50 步

### 性能建议

- **元素数量**：建议 <50 个元素
- **图片优化**：使用压缩的图片（<1MB）
- **关键帧数量**：建议 <20 个关键帧
- **导出分辨率**：根据需求选择合适的分辨率

---

## 🧪 测试清单

### 功能测试

#### Edit 模式
- [ ] 点击选择元素
- [ ] Ctrl+点击多选元素
- [ ] 拖拽元素移动
- [ ] 属性面板实时更新
- [ ] 撤销/重做功能
- [ ] 删除元素（Delete 键）
- [ ] 图层面板显示正确
- [ ] 锁定/解锁元素

#### Path 模式
- [ ] 捕获当前视图为关键帧
- [ ] 关键帧列表显示
- [ ] 配置停留和过渡时长
- [ ] 播放路径动画
- [ ] 暂停/继续播放
- [ ] 上一个/下一个关键帧
- [ ] 循环播放开关

#### Export 模式
- [ ] PDF 导出成功
- [ ] 选择不同纸张尺寸
- [ ] HTML 导出生成文件
- [ ] GIF 导出（可能较慢）
- [ ] 视频导出（MP4/WebM）

### 兼容性测试

- [ ] Chrome（最新版）
- [ ] Firefox（最新版）
- [ ] Safari（最新版）
- [ ] Edge（最新版）

---

## 🔮 未来改进

### 短期（1-2 周）
- [ ] 实现形状元素（矩形、圆形、箭头）
- [ ] 实现分组功能
- [ ] 添加对齐辅助线（snap to grid）
- [ ] 优化拖拽体验（边界限制）
- [ ] 完善 HTML 导出（嵌入完整播放器）

### 中期（1-2 月）
- [ ] 文本富文本编辑（集成 Plate.js）
- [ ] 嵌入视频/iframe 支持
- [ ] 路径编辑器高级功能（拖拽排序、批量编辑）
- [ ] 自动布局建议（AI 生成）
- [ ] 移动端优化

### 长期（3+ 月）
- [ ] 协作编辑（多人实时编辑）
- [ ] 模板库（预设 Prezi 模板）
- [ ] 动画效果库（元素动画）
- [ ] 云端渲染（高质量导出）
- [ ] 演讲者注释

---

## 🆘 故障排除

### 问题：画布无法加载
- **原因**：canvasData 未初始化
- **解决**：检查 `createInitialCanvasData()` 是否调用

### 问题：拖拽不工作
- **原因**：元素未选中或已锁定
- **解决**：先选中元素，确保未锁定

### 问题：路径动画不流畅
- **原因**：关键帧过多或过渡时长过短
- **解决**：减少关键帧数量，增加过渡时长（≥1 秒）

### 问题：导出失败
- **原因**：浏览器权限或资源限制
- **解决**：
  - 检查浏览器控制台错误
  - 尝试减少元素数量
  - 使用较低的导出质量

### 问题：TypeScript 错误
- **原因**：类型定义不匹配
- **解决**：运行 `npm run build` 检查完整错误

---

## 📚 API 参考

### Zustand Store

```typescript
// 获取 store
import { usePreziEditorStore } from "@/states/prezi-editor-state";

// 使用方法
const canvasData = usePreziEditorStore(state => state.canvasData);
const addElement = usePreziEditorStore(state => state.addElement);

// Actions
addElement(element);           // 添加元素
updateElement(id, updates);    // 更新元素
deleteElement(id);             // 删除元素
selectElements([id1, id2]);    // 选择元素
setMode("select");             // 切换工具
updateCamera(cameraState);     // 更新相机
playPath(pathId);              // 播放路径
stopPlaying();                 // 停止播放
undo();                        // 撤销
redo();                        // 重做
```

### Helper Functions

```typescript
import {
  generateElementId,
  generateKeyframeId,
  generatePathId,
} from "@/states/prezi-editor-state";

const textId = generateElementId("text");
const keyframeId = generateKeyframeId();
const pathId = generatePathId();
```

### Camera Animator

```typescript
import { getCameraAnimator } from "@/lib/presentation/prezi/camera-animator";

const animator = getCameraAnimator();
animator.createTimeline(path, onUpdate, onComplete);
animator.play();
animator.pause();
animator.stop();
animator.jumpToKeyframe(index, path);
```

---

## 📄 License

本功能作为 Slide Forge 项目的一部分，遵循项目许可证。

---

## 🙋 支持

如有问题或建议，请联系开发团队或创建 Issue。

---

**版本**：1.0.0
**最后更新**：2026-01-08
**状态**：MVP 完成，持续改进中
