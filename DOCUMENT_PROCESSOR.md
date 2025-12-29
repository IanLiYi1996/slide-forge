# Document Processor Module

这是一个用于处理PDF和图片的全新模块，支持逐页处理和AI增强功能。

## 功能特性

### 1. 文件上传
- 支持PDF文件上传（自动转换为图片）
- 支持图片文件上传（PNG, JPG, JPEG, WEBP）
- 拖拽上传或点击选择文件

### 2. 逐页处理
- 将PDF的每一页转换为独立的图片
- 每次处理一张图片
- 支持自定义处理指令（通过Yunwu API）
- 实时预览原图和处理后的图片

### 3. 导航和确认
- 可以浏览所有页面
- 页码指示器显示处理进度
- 确认当前页面后自动进入下一页
- 支持重新处理已处理的页面

### 4. 批量导出
- 导出所有处理完成的图片
- 支持两种导出格式：
  - **ZIP压缩包**: 将所有图片打包为单个ZIP文件
  - **单独下载**: 逐个下载每张处理后的图片

## 使用方法

### 1. 环境配置

确保在 `.env` 文件中配置了 `YUNWU_API_KEY`:

```env
# Yunwu API for AI image generation
YUNWU_API_KEY="your-api-key-here"
```

### 2. 访问模块

通过以下方式访问文档处理模块：
- 从首页点击 "Document Processor" 卡片
- 从侧边栏点击 "Document Processor" 按钮
- 直接访问 `/document-processor` 路由

### 3. 上传文件

1. 拖拽PDF或图片文件到上传区域
2. 或点击上传区域选择文件
3. 系统会自动处理并显示所有页面

### 4. 处理图片

1. 在输入框中输入处理指令（例如："增强颜色"、"添加边框"、"提取文字"等）
2. 点击"Process Image"按钮
3. 等待AI处理完成
4. 查看处理结果
5. 确认满意后点击"Confirm & Next"进入下一页

### 5. 导出结果

所有页面处理完成后：
1. 点击右上角的"Export All"按钮
2. 选择导出格式（ZIP或单独下载）
3. 点击"Export"完成导出

## 技术架构

### 前端组件
- `DocumentProcessorPage.tsx` - 主页面组件
- `DocumentUploader.tsx` - 文件上传组件
- `ProcessingView.tsx` - 图片处理视图
- `ExportDialog.tsx` - 导出对话框

### 工具库
- `pdf-utils.ts` - PDF转图片工具（基于pdfjs-dist）
- `yunwu-api.ts` - Yunwu API集成

### API路由
- `/api/document-processor/process` - 图片处理API

## 依赖包

- `pdfjs-dist` - PDF渲染和转换
- `jszip` - ZIP文件生成
- `file-saver` - 文件下载

## 注意事项

1. **API配置**: 确保已正确配置 `YUNWU_API_KEY`
2. **文件大小**: 大型PDF文件可能需要较长的加载时间
3. **浏览器兼容性**: 需要支持Canvas API的现代浏览器
4. **处理时间**: AI处理每张图片可能需要几秒钟时间

## 后续改进建议

- [ ] 支持批量处理指令（对所有页面应用相同指令）
- [ ] 添加图片编辑功能（裁剪、旋转等）
- [ ] 支持更多导出格式（PDF、DOCX等）
- [ ] 添加处理历史记录
- [ ] 支持撤销/重做操作
- [ ] 优化大文件处理性能
- [ ] 添加处理模板库
