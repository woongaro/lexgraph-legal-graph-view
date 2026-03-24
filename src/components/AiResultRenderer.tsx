import React, { useEffect, useRef } from "react";
import { App, Component, MarkdownRenderer } from "obsidian";

interface AiResultRendererProps {
  app: App;
  text: string;
}

export function AiResultRenderer({ app, text }: AiResultRendererProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const componentRef = useRef<Component | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    componentRef.current?.unload();
    componentRef.current = new Component();
    container.innerHTML = "";
    void MarkdownRenderer.render(app, text, container, "", componentRef.current);

    return () => {
      componentRef.current?.unload();
      componentRef.current = null;
    };
  }, [app, text]);

  return <div ref={containerRef} className="markdown-preview-view text-sm leading-relaxed" />;
}
