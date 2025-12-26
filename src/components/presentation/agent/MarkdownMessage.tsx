/**
 * Markdown 消息渲染组件
 * 支持代码高亮、表格、列表等 markdown 特性
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

export function MarkdownMessage({ content, className = "" }: MarkdownMessageProps) {
  return (
    <div className={`overflow-hidden ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        components={{
        // 自定义代码块样式
        code({ node, inline, className, children, ...props }) {
          return inline ? (
            <code
              className="px-1 py-0.5 rounded bg-muted/50 text-[11px] font-mono border"
              {...props}
            >
              {children}
            </code>
          ) : (
            <pre className="overflow-x-auto my-1 rounded bg-muted/50 border max-w-full">
              <code
                className="block p-1.5 text-[10px] font-mono whitespace-pre"
                {...props}
              >
                {children}
              </code>
            </pre>
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
