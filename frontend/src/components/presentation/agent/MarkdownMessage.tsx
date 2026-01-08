/**
 * Markdown 消息渲染组件
 * 支持代码高亮、表格、列表等 markdown 特性
 * 特殊支持 html-slide 代码块的预览渲染
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { SlideHTMLPreview } from "./SlideHTMLPreview";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

/**
 * 检测是否包含 html-slide 代码块
 */
function hasHTMLSlide(content: string): boolean {
  return /```html-slide/i.test(content);
}

// ✅ 可折叠代码块组件
function CollapsibleCodeBlock({ language, children }: { language?: string; children: React.ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const codeText = String(children);
  const lines = codeText.split("\n");
  const shouldCollapse = lines.length > 5; // 超过5行才折叠

  if (!shouldCollapse) {
    // 短代码块不需要折叠
    return (
      <pre className="overflow-x-auto my-1 rounded bg-muted/50 border max-w-full">
        <div className="flex items-center justify-between px-1.5 py-1 border-b bg-muted/30">
          <span className="text-[10px] font-mono text-muted-foreground">{language || "code"}</span>
        </div>
        <code className="block p-1.5 text-[10px] font-mono whitespace-pre">
          {children}
        </code>
      </pre>
    );
  }

  const displayText = isExpanded ? codeText : lines.slice(0, 3).join("\n");

  return (
    <pre className="overflow-x-auto my-1 rounded bg-muted/50 border max-w-full">
      <div className="flex items-center justify-between px-1.5 py-1 border-b bg-muted/30">
        <span className="text-[10px] font-mono text-muted-foreground">{language || "code"}</span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Collapse
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Expand ({lines.length} lines)
            </>
          )}
        </button>
      </div>
      <code className="block p-1.5 text-[10px] font-mono whitespace-pre">
        {displayText}
        {!isExpanded && (
          <span className="block mt-1 text-muted-foreground italic">
            ... {lines.length - 3} more lines
          </span>
        )}
      </code>
    </pre>
  );
}

export function MarkdownMessage({ content, className = "" }: MarkdownMessageProps) {
  // 检测是否有 HTML slide 需要特殊渲染
  const hasSlide = useMemo(() => hasHTMLSlide(content), [content]);
  const slideNumber = useMemo(() => {
    const match = content.match(/[Ss]lide\s+(\d+)/);
    return match?.[1] ? parseInt(match[1]) : undefined;
  }, [content]);

  return (
    <div className={`overflow-hidden ${className}`}>
      {/* 如果有 HTML slide，先渲染预览 */}
      {hasSlide && <SlideHTMLPreview content={content} slideNumber={slideNumber} />}

      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        components={{
        // ✅ 自定义代码块样式（支持折叠）
        code({ node, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "";
          const isInline = !className;

          // 对于 html-slide，不渲染代码块（已在上方渲染预览）
          if (language === "html-slide") {
            return null;
          }

          return isInline ? (
            <code
              className="px-1 py-0.5 rounded bg-muted/50 text-[11px] font-mono border"
              {...props}
            >
              {children}
            </code>
          ) : (
            <CollapsibleCodeBlock language={language}>
              {children}
            </CollapsibleCodeBlock>
          );
        },
        // 自定义链接样式
        a({ node, children, ...props }) {
          return (
            <a
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          );
        },
        // 自定义列表样式
        ul({ node, children, ...props }) {
          return (
            <ul className="list-disc list-inside space-y-0 my-1 text-xs" {...props}>
              {children}
            </ul>
          );
        },
        ol({ node, children, ...props }) {
          return (
            <ol className="list-decimal list-inside space-y-0 my-1 text-xs" {...props}>
              {children}
            </ol>
          );
        },
        li({ node, children, ...props }) {
          return (
            <li className="ml-0.5 leading-snug" {...props}>
              {children}
            </li>
          );
        },
        // 自定义表格样式
        table({ node, children, ...props }) {
          return (
            <div className="overflow-x-auto my-1.5 max-w-full">
              <table className="divide-y divide-border text-[10px]" {...props}>
                {children}
              </table>
            </div>
          );
        },
        th({ node, children, ...props }) {
          return (
            <th className="px-1.5 py-0.5 bg-muted font-semibold text-left" {...props}>
              {children}
            </th>
          );
        },
        td({ node, children, ...props }) {
          return (
            <td className="px-1.5 py-0.5 border-t" {...props}>
              {children}
            </td>
          );
        },
        // 自定义标题样式
        h1({ node, children, ...props }) {
          return (
            <h1 className="text-sm font-bold mt-2 mb-1" {...props}>
              {children}
            </h1>
          );
        },
        h2({ node, children, ...props }) {
          return (
            <h2 className="text-xs font-semibold mt-1.5 mb-1" {...props}>
              {children}
            </h2>
          );
        },
        h3({ node, children, ...props }) {
          return (
            <h3 className="text-xs font-semibold mt-1.5 mb-0.5" {...props}>
              {children}
            </h3>
          );
        },
        // 自定义段落样式
        p({ node, children, ...props }) {
          return (
            <p className="my-1 leading-relaxed text-xs" {...props}>
              {children}
            </p>
          );
        },
        // 自定义引用样式
        blockquote({ node, children, ...props }) {
          return (
            <blockquote
              className="border-l-2 border-primary/40 pl-2 italic my-1.5 text-muted-foreground text-xs"
              {...props}
            >
              {children}
            </blockquote>
          );
        },
        // 自定义强调样式
        strong({ node, children, ...props }) {
          return (
            <strong className="font-semibold" {...props}>
              {children}
            </strong>
          );
        },
        em({ node, children, ...props }) {
          return (
            <em className="italic" {...props}>
              {children}
            </em>
          );
        },
        // 自定义分隔线
        hr({ node, ...props }) {
          return <hr className="my-1.5 border-border" {...props} />;
        },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
