import { Children, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { openLink } from "../../state/link-routing";
import { remarkAssistantCitations } from "./assistant-citations";
import { MarkdownTable } from "./MarkdownTable";

function childText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }
      if (typeof child === "object" && child !== null && "props" in child) {
        return childText(
          (child as { props: { children?: ReactNode } }).props.children,
        );
      }
      return "";
    })
    .join("");
}

export function AssistantMarkdown({ text }: { text: string }) {
  return (
    <Markdown
      components={{
        a: ({ children, href }) => (
          <a
            href={href}
            onClick={(event) => {
              event.preventDefault();
              if (href) openLink(href);
            }}
          >
            {children}
          </a>
        ),
        ol: ({ children, start }) => (
          <ol dir="auto" start={start}>
            {children}
          </ol>
        ),
        p: ({ children }) => <p dir="auto">{children}</p>,
        table: ({ children, node }) => {
          const start = node?.position?.start.offset;
          const end = node?.position?.end.offset;
          const source =
            typeof start === "number" && typeof end === "number"
              ? text.slice(start, end)
              : childText(children);
          return <MarkdownTable source={source}>{children}</MarkdownTable>;
        },
        tbody: ({ children }) => (
          <tbody className="markdown-table-body">{children}</tbody>
        ),
        td: ({ children }) => (
          <td
            className={`markdown-table-cell${
              /^\d+$/.test(childText(children)) ? " is-numeric" : ""
            }${Children.count(children) === 1 ? " has-single-child" : ""}`}
            dir="auto"
          >
            {children}
          </td>
        ),
        th: ({ children }) => (
          <th
            className={`markdown-table-header-cell${
              Children.count(children) === 1 ? " has-single-child" : ""
            }`}
            dir="auto"
          >
            {children}
          </th>
        ),
        tr: ({ children }) => (
          <tr className="markdown-table-row">{children}</tr>
        ),
        ul: ({ children }) => <ul dir="auto">{children}</ul>,
      }}
      remarkPlugins={[remarkGfm, remarkAssistantCitations]}
    >
      {text}
    </Markdown>
  );
}
