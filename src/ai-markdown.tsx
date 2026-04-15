import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const AI_REMARK_PLUGINS = [remarkGfm];

/** Style cho câu trả lời AI (GFM: bảng, gạch đầu dòng, code). */
export const AI_MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc ml-4 my-1.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal ml-4 my-1.5">{children}</ol>,
  li: ({ children }) => <li className="my-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  h1: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>,
  h2: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>,
  h3: ({ children }) => <h4 className="text-sm font-semibold mt-1.5 mb-0.5">{children}</h4>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2 max-w-full rounded-lg border border-neutral-200 dark:border-neutral-600">
      <table className="min-w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-neutral-100 dark:bg-neutral-700/80">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-neutral-200 dark:divide-neutral-600">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="border border-neutral-200 dark:border-neutral-600 px-2 py-1.5 text-left font-semibold whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-neutral-200 dark:border-neutral-600 px-2 py-1.5 align-top">{children}</td>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-lg p-2 my-2 max-w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-600 text-xs">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code
          className={`block font-mono whitespace-pre-wrap break-words bg-transparent p-0 ${className ?? ""}`}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className="bg-neutral-200 dark:bg-neutral-600 px-1 rounded text-[0.8rem]" {...props}>
        {children}
      </code>
    );
  },
};

export function AiMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={AI_REMARK_PLUGINS} components={AI_MARKDOWN_COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
