const CONTENT_REFERENCE_START = "";
const CITATION_PREFIX = "cite";
const COMPLETE_CITATION = /cite(?:[^]*)?/gu;

type MarkdownNode = {
  children?: MarkdownNode[];
  type?: string;
  value?: string;
};

function stripIncompleteCitation(value: string): string {
  const markerStart = value.lastIndexOf(CONTENT_REFERENCE_START);
  if (markerStart === -1) return value;

  const suffix = value.slice(markerStart);
  return CITATION_PREFIX.startsWith(suffix) ||
    suffix.startsWith(CITATION_PREFIX)
    ? value.slice(0, markerStart)
    : value;
}

function stripCitationMarkers(value: string): string {
  return stripIncompleteCitation(value.replace(COMPLETE_CITATION, ""));
}

function stripCitationsFromNode(node: MarkdownNode): void {
  if (node.type === "code" || node.type === "inlineCode") return;

  if (node.type === "text" && typeof node.value === "string") {
    node.value = stripCitationMarkers(node.value);
  }
  node.children?.forEach(stripCitationsFromNode);
}

/** Removes unresolved internal citation markers before Markdown is rendered. */
export function remarkAssistantCitations() {
  return stripCitationsFromNode;
}
