/**
 * 打字机管理器 - 实现逐字符流式显示效果
 * 模拟真实的打字体验，提升用户感知的响应速度
 */

type TypewriterCallback = (char: string) => void;

export class TypewriterManager {
  private queue: string[] = []; // 待显示的内容队列
  private isTyping: boolean = false;
  private callback: TypewriterCallback | null = null;
  private speed: number = 25; // 默认 25ms/字符
  private animationFrame: number | null = null;
  private lastTypedTime: number = 0;

  constructor(speed: number = 25) {
    this.speed = speed;

    // ✅ 监听页面可见性变化（处理标签页切换）
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && this.queue.length > 0 && !this.isTyping) {
          // 页面恢复可见时，如果有内容待显示且未在打字，重启
          console.log("[Typewriter] Page visible, restarting animation");
          this.startTyping();
        }
      });
    }
  }

  /**
   * 设置回调函数（每次显示一个字符时调用）
   */
  setCallback(callback: TypewriterCallback) {
    this.callback = callback;
  }

  /**
   * 添加内容到队列
   */
  enqueue(content: string) {
    if (!content) return;

    // 添加到队列
    this.queue.push(content);

    // 如果没在打字，开始打字
    if (!this.isTyping) {
      this.startTyping();
    }
  }

  /**
   * 开始打字动画
   */
  private startTyping() {
    if (this.isTyping) return;

    this.isTyping = true;
    // ✅ 设置为较早的时间，让第一个字符立即显示
    this.lastTypedTime = performance.now() - this.speed;
    this.type();
  }

  /**
   * 逐字符显示（使用 requestAnimationFrame）
   */
  private type() {
    const now = performance.now();

    // 控制速度：只有超过指定时间才显示下一个字符
    if (now - this.lastTypedTime < this.speed) {
      this.animationFrame = requestAnimationFrame(() => this.type());
      return;
    }

    // 如果队列为空，停止
    if (this.queue.length === 0) {
      this.isTyping = false;
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
      return;
    }

    // 取出队列第一个元素
    const currentChunk = this.queue[0];
    if (!currentChunk || currentChunk.length === 0) {
      this.queue.shift(); // 移除空字符串
      // ✅ 使用 requestAnimationFrame 避免同步递归
      this.animationFrame = requestAnimationFrame(() => this.type());
      return;
    }

    // 取出第一个字符（支持 emoji 和多字节字符）
    const char = this.getFirstChar(currentChunk);
    this.queue[0] = currentChunk.slice(char.length);

    // 如果当前块已空，移除
    if (this.queue[0].length === 0) {
      this.queue.shift();
    }

    // 调用回调显示字符
    if (this.callback) {
      this.callback(char);
    }

    this.lastTypedTime = now;

    // 继续下一个字符
    this.animationFrame = requestAnimationFrame(() => this.type());
  }

  /**
   * 获取第一个字符（正确处理 emoji 和多字节字符）
   * 使用 Array.from 确保 emoji 和组合字符不被拆分
   */
  private getFirstChar(str: string): string {
    // 使用 Array.from 正确分割 Unicode 字符
    const chars = Array.from(str);
    return chars[0] || "";
  }

  /**
   * 立即显示所有剩余内容（用户点击"跳过动画"）
   */
  skipAnimation() {
    if (!this.callback) return;

    // 取出队列中所有内容
    const remaining = this.queue.join("");
    this.queue = [];

    // 一次性显示
    if (remaining) {
      this.callback(remaining);
    }

    // 停止动画
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    this.isTyping = false;
  }

  /**
   * 清空队列和状态（用于会话切换或组件卸载）
   */
  clear() {
    this.queue = [];
    this.isTyping = false;

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * 设置打字速度
   */
  setSpeed(speed: number) {
    this.speed = Math.max(5, speed); // 最快 5ms/字符
  }

  /**
   * 检查是否正在打字（队列中还有内容或正在动画）
   */
  isActive(): boolean {
    return this.isTyping || this.queue.length > 0;
  }

  /**
   * 获取队列中剩余字符数
   */
  getRemainingLength(): number {
    return this.queue.reduce((sum, chunk) => sum + chunk.length, 0);
  }
}
