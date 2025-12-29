# Document Processor 调试指南

## 问题排查步骤

### 1. 打开浏览器开发者工具

在访问 `/document-processor` 页面时：
1. 按 F12 或右键 -> "检查"
2. 切换到 "Console" (控制台) 标签

### 2. 尝试上传文件

上传文件后，控制台应该显示类似以下的日志：

```
=== handleFileInput called ===
Selected file: example.pdf
=== handleFile called ===
File: example.pdf Type: application/pdf Size: 123456
Calling processUploadedFile...
Processing uploaded file: example.pdf type: application/pdf size: 123456
File identified as PDF, converting to images...
Starting PDF conversion for: example.pdf size: 123456
PDF.js worker initialized: https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.530/pdf.worker.min.js
ArrayBuffer created, loading PDF document...
PDF loaded successfully. Pages: 10
Processing page 1/10
Page 1 converted successfully
...
All 10 pages converted successfully
processUploadedFile completed, images: 10
Calling onImagesLoaded callback...
=== handleImagesLoaded called ===
Loaded images count: 10
State updated, should now show ProcessingView
Success toast shown
=== handleFile completed ===
```

### 3. 常见问题及解决方案

#### 问题 1: 没有任何日志输出
**可能原因**: 文件选择器没有被触发
**解决方案**:
- 检查点击事件是否正常工作
- 尝试刷新页面
- 检查浏览器控制台是否有其他错误

#### 问题 2: 出现 CORS 错误
**错误信息**: `CORS policy: No 'Access-Control-Allow-Origin' header`
**解决方案**:
- 这通常与 PDF.js worker 加载有关
- 检查网络连接是否正常
- 可能需要等待几秒钟让 CDN 加载

#### 问题 3: PDF.js worker 加载失败
**错误信息**: `Failed to load worker script`
**解决方案**:
1. 检查网络连接
2. 尝试手动访问: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.530/pdf.worker.min.js`
3. 如果无法访问，可能需要配置代理或使用本地 worker

#### 问题 4: 文件上传后卡住
**症状**: 显示 "Processing file..." 但一直不完成
**解决方案**:
1. 检查控制台是否有错误信息
2. 尝试使用较小的文件（< 1MB）
3. 确认文件类型正确（PDF 或图片）

#### 问题 5: Toast 通知不显示
**症状**: 没有成功/错误提示
**解决方案**:
- 检查 Toaster 组件是否正确渲染
- 查看控制台是否有 useToast 相关错误

### 4. 测试建议

1. **先测试图片上传**: 从简单的图片文件开始（PNG/JPG）
2. **然后测试小PDF**: 使用 1-2 页的小PDF文件
3. **最后测试大PDF**: 使用多页PDF文件

### 5. 获取详细错误信息

如果遇到问题，请提供：
1. 完整的控制台日志（从点击上传到错误发生）
2. 错误信息截图
3. 使用的文件类型和大小
4. 浏览器类型和版本

## 快速测试命令

在浏览器控制台运行以下命令测试 PDF.js 是否正常：

```javascript
// 测试 PDF.js 版本
import('pdfjs-dist').then(pdfjsLib => {
  console.log('PDF.js version:', pdfjsLib.version);
  console.log('Worker URL:', pdfjsLib.GlobalWorkerOptions.workerSrc);
});
```

## 已知限制

1. **文件大小**: 大型PDF（> 50MB）可能会导致浏览器卡顿
2. **浏览器兼容性**: 需要现代浏览器支持 Canvas API
3. **Worker 加载**: 首次加载需要从 CDN 下载 worker 脚本
4. **内存使用**: 多页PDF会占用较多内存

## 联系支持

如果问题依然存在，请提供：
- 浏览器信息
- 完整的控制台日志
- 尝试的文件类型和大小
- 错误截图
