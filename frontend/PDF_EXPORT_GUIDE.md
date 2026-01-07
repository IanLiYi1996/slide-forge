# PDF导出功能说明

## 📄 Document Processor PDF导出

### 核心特性

**保持原始图片尺寸** ✅

- ✅ 每个PDF页面大小 = 对应图片的实际像素尺寸
- ✅ 1:1比例，无缩放
- ✅ 保持图片质量
- ✅ 不同页面可以有不同尺寸

### 工作原理

#### 尺寸转换

**像素 → 毫米转换**：
```
标准DPI: 96
转换公式: mm = px × (25.4 / 96)

示例：
1200px × 800px 图片
→ 317.5mm × 211.67mm PDF页面
```

#### PDF生成流程

```
1. 读取第一张图片
   ├─ 获取尺寸：1200px × 800px
   ├─ 转换为mm：317.5mm × 211.67mm
   └─ 创建PDF，页面大小 = 图片大小

2. 添加图片到页面
   ├─ 位置：(0, 0)
   ├─ 尺寸：填满整个页面
   └─ 缩放：1:1（无缩放）

3. 处理第二张图片
   ├─ 获取尺寸：800px × 1000px
   ├─ 转换为mm：211.67mm × 264.58mm
   ├─ 添加新页面，大小 = 该图片大小
   └─ 添加图片（1:1）

4. 重复直到所有图片
5. 生成PDF文件
```

---

## ⚙️ 配置选项

### preserveOriginalSize (默认: true)

**true（推荐）**：
- 保持原始图片尺寸
- 每页大小可能不同
- 适合Document Processor

**false（兼容模式）**：
- 统一使用A4页面
- 图片缩放适配
- 适合打印场景

### 使用示例

```typescript
// 保持原始尺寸（默认）
const pdf = await generatePDFFromImages(images, processedImages, {
  quality: 'medium',
  preserveOriginalSize: true,
});

// 适配A4打印
const pdf = await generatePDFFromImages(images, processedImages, {
  quality: 'high',
  preserveOriginalSize: false,
  orientation: 'portrait',
});
```

---

## 📊 对比

### 原始尺寸模式 (New)

**优点**：
- ✅ 保持图片清晰度
- ✅ 无失真
- ✅ 适合数字查看
- ✅ 适合后续处理

**特点**：
- 每页可以不同尺寸
- PDF文件可能较大
- 不适合直接打印（页面尺寸不标准）

**适用场景**：
- 文档归档
- 数字分享
- 图片保存
- 后续编辑

### A4适配模式 (Legacy)

**优点**：
- ✅ 统一页面大小
- ✅ 适合打印
- ✅ 文件较小

**缺点**：
- ⚠️ 可能缩放失真
- ⚠️ 可能改变比例

**适用场景**：
- 打印输出
- 标准文档
- 存档（物理）

---

## 🎯 使用方法

### Document Processor导出

1. 完成文档处理
2. 点击"Export"按钮
3. 选择"PDF Document"
4. 点击"Export"

**自动行为**：
- 自动保持原始图片尺寸
- 每个图片创建对应尺寸的PDF页
- 高质量输出

### 验证尺寸保持

**方法1：查看PDF属性**
```
打开PDF → 文件属性 → 页面大小
应该看到各页面尺寸对应原图
```

**方法2：在PDF查看器中**
```
放大到100%
图片应该是原始分辨率，非常清晰
```

---

## 💻 技术细节

### DPI转换

**标准**：96 DPI（Web标准）
```
1 英寸 = 25.4 毫米 = 96 像素
1 像素 = 25.4 / 96 毫米 ≈ 0.2646 毫米
```

**常见尺寸示例**：

| 图片尺寸(px) | PDF页面(mm) | 近似(inch) |
|-------------|------------|-----------|
| 1200 × 800 | 317.5 × 211.7 | 12.5 × 8.3 |
| 2400 × 3200 | 635 × 846.7 | 25 × 33.3 |
| 800 × 600 | 211.7 × 158.8 | 8.3 × 6.25 |

### 方向自动判断

```typescript
orientation: imgWidthPx > imgHeightPx ? 'landscape' : 'portrait'
```

- 宽>高 → 横向 (landscape)
- 高>宽 → 纵向 (portrait)
- 每页独立判断

---

## 🔧 自定义配置

### 如果需要A4模式

修改ExportDialog.tsx：

```typescript
const pdfBlob = await generatePDFFromImages(
  images,
  processedImages,
  {
    quality: 'high',
    preserveOriginalSize: false,  // 改为false
    orientation: 'portrait',       // 指定方向
  }
);
```

### 质量选项

**low**：
- 启用压缩
- 文件更小
- 适合预览

**medium**（默认）：
- 平衡质量和大小
- 推荐日常使用

**high**：
- 最高质量
- 文件较大
- 适合专业用途

---

## 📈 性能考虑

### 原始尺寸模式

**优点**：
- 处理速度快（无缩放计算）
- 保持最高质量

**注意**：
- 大图片会产生大PDF
- 建议单次导出<50页

### 优化建议

**对于超大图片**：
```typescript
// 可选：添加最大尺寸限制
const maxDimension = 4000; // 4000px
if (imgWidthPx > maxDimension || imgHeightPx > maxDimension) {
  // 缩放到最大尺寸
}
```

---

## ✅ 测试验证

### 测试步骤

1. **上传不同尺寸的图片**
   - 小图：800×600
   - 中图：1200×900
   - 大图：2400×1600

2. **处理并导出PDF**

3. **验证结果**
   - 在PDF查看器中检查页面尺寸
   - 放大到100%查看清晰度
   - 确认无缩放失真

### 预期结果

**800×600图片**：
- PDF页面：211.67mm × 158.75mm
- 图片清晰，无损失

**1200×900图片**：
- PDF页面：317.5mm × 238.13mm
- 保持原始质量

---

## 🎉 总结

Document Processor的PDF导出现在：

- ✅ **保持原始尺寸**（默认行为）
- ✅ **1:1比例**（无缩放）
- ✅ **高质量输出**
- ✅ **每页独立尺寸**
- ✅ **自动方向判断**
- ✅ **进度实时显示**

图片质量得到完美保留！🎯
