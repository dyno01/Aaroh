import React, { useMemo } from 'react';
import katex from 'katex';

/**
 * Cleanly renders textbook-grade mathematical equations and code formatting.
 * Supports:
 *  - Display math: $$...$$ or \[...\]
 *  - Inline math: $...$ or \(...\)
 *  - Explicit LaTeX commands: \frac, \sqrt, \sum, \int, \times, etc.
 *  - Code blocks: ```...```
 *  - Inline code: `...`
 *  - C / System code patterns: #define, #include, void, int, pointers, etc.
 */

function renderLatex(rawExpr, displayMode = false) {
  try {
    return katex.renderToString(rawExpr.trim(), {
      throwOnError: false,
      displayMode,
      output: 'htmlAndMathml'
    });
  } catch (err) {
    console.warn('KaTeX render error:', err);
    return rawExpr;
  }
}

// Simple highlighter for C/C++/SQL tokens in code options
function highlightCode(codeStr) {
  const tokens = [];
  // Tokenize comments, preprocessor directives, keywords, strings, numbers, identifiers
  const regex = /(#\w+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:int|char|float|double|void|return|if|else|for|while|switch|case|break|default|struct|typedef|static|const|sizeof|printf|scanf|SELECT|FROM|WHERE|JOIN|GROUP|BY|ORDER)\b|[0-9]+|\w+|[^\s\w]+|\s+)/g;
  let m;
  let i = 0;
  while ((m = regex.exec(codeStr)) !== null) {
    const part = m[0];
    if (part.startsWith('#')) {
      tokens.push(<span key={i++} className="mt-kw" style={{ color: '#D97706', fontWeight: 600 }}>{part}</span>);
    } else if (part.startsWith('"') || part.startsWith("'")) {
      tokens.push(<span key={i++} className="mt-str" style={{ color: '#059669' }}>{part}</span>);
    } else if (/^(int|char|float|double|void|return|if|else|for|while|switch|case|break|default|struct|typedef|static|const|sizeof|printf|scanf|SELECT|FROM|WHERE|JOIN)$/.test(part)) {
      tokens.push(<span key={i++} className="mt-kw" style={{ color: '#5B45EA', fontWeight: 600 }}>{part}</span>);
    } else if (/^[0-9]+$/.test(part)) {
      tokens.push(<span key={i++} className="mt-num" style={{ color: '#2563EB' }}>{part}</span>);
    } else if (/^[()\[\]{}]/.test(part)) {
      tokens.push(<span key={i++} className="mt-paren" style={{ color: '#4B5563', fontWeight: 600 }}>{part}</span>);
    } else if (/^[+\-*\/%=&|<>!^~]/.test(part)) {
      tokens.push(<span key={i++} className="mt-op" style={{ color: '#DC2626', fontWeight: 600 }}>{part}</span>);
    } else {
      tokens.push(<span key={i++}>{part}</span>);
    }
  }
  return tokens;
}

// Tests if an entire string looks like a code line/option (e.g. #define SQ(x) ((x)*(x)))
function isCodeLine(str) {
  const trimmed = str.trim();
  if (trimmed.startsWith('#define') || trimmed.startsWith('#include') || trimmed.startsWith('typedef ')) return true;
  if (/^([a-zA-Z_]\w*)\s*\([^)]*\)\s*\{?/.test(trimmed) && trimmed.includes(';')) return true;
  if (/^(int|char|float|double|void|return|printf)\b/.test(trimmed)) return true;
  if (/^[A-Za-z0-9_]+\s*[*+\-\/%]\s*[A-Za-z0-9_]+$/.test(trimmed)) return true; // e.g. x*x, x+x
  if (/^\([A-Za-z0-9_]+\s*[*+\-\/%]\s*[A-Za-z0-9_]+\)$/.test(trimmed)) return true; // e.g. (x*x)
  if (/^\(\([A-Za-z0-9_]+\)\s*[*+\-\/%]\s*\([A-Za-z0-9_]+\)\)$/.test(trimmed)) return true; // e.g. ((x)*(x))
  return false;
}

// Tests if string is purely LaTeX math without $ signs (e.g. \frac{a}{b}, x^2, \sqrt{...})
function isPureLatex(str) {
  const trimmed = str.trim();
  return /\\(frac|sqrt|sum|int|times|cdot|le|ge|leq|geq|neq|approx|infty|alpha|beta|gamma|theta|pi|partial|nabla)\b/.test(trimmed);
}

export default function MathText({ text, className = '', style = {}, inline = false }) {
  if (text === null || text === undefined) return null;
  const str = String(text);

  // If the entire text is a code statement (like an option in C debugging: #define SQ(x) ((x)*(x)) or x*x)
  if (isCodeLine(str) && !str.includes('$')) {
    return (
      <code
        className={`math-code-pill ${className}`}
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: '0.94em',
          letterSpacing: '0.01em',
          background: 'rgba(91, 69, 234, 0.05)',
          padding: '3px 8px',
          borderRadius: 6,
          border: '1px solid rgba(91, 69, 234, 0.15)',
          display: inline ? 'inline-block' : 'inline-block',
          color: '#1A1612',
          wordBreak: 'break-word',
          ...style
        }}
      >
        {highlightCode(str)}
      </code>
    );
  }

  // If pure LaTeX without $ delimiters
  if (isPureLatex(str) && !str.includes('$')) {
    const html = renderLatex(str, !inline && str.length > 30);
    return (
      <span
        className={`math-rendered ${className}`}
        style={{ fontStyle: 'normal', ...style }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // Tokenize text into:
  // 1. Display math: $$...$$ or \[...\]
  // 2. Inline math: $...$ or \(...\)
  // 3. Code blocks: ```...```
  // 4. Inline code: `...`
  // 5. Normal text segments
  const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^\$\n]+?\$|\\\([\s\S]*?\\\)```[\s\S]*?```|`[^`\n]+`)/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: str.substring(lastIndex, match.index)
      });
    }

    const token = match[0];
    if (token.startsWith('$$') && token.endsWith('$$')) {
      parts.push({
        type: 'math-display',
        content: token.slice(2, -2)
      });
    } else if (token.startsWith('\\[') && token.endsWith('\\]')) {
      parts.push({
        type: 'math-display',
        content: token.slice(2, -2)
      });
    } else if (token.startsWith('$') && token.endsWith('$')) {
      parts.push({
        type: 'math-inline',
        content: token.slice(1, -1)
      });
    } else if (token.startsWith('\\(') && token.endsWith('\\)')) {
      parts.push({
        type: 'math-inline',
        content: token.slice(2, -2)
      });
    } else if (token.startsWith('```') && token.endsWith('```')) {
      const inner = token.slice(3, -3).replace(/^[a-z0-9_-]*\n/i, '');
      parts.push({
        type: 'code-block',
        content: inner
      });
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push({
        type: 'code-inline',
        content: token.slice(1, -1)
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < str.length) {
    parts.push({
      type: 'text',
      content: str.substring(lastIndex)
    });
  }

  if (parts.length === 0) {
    return <span className={className} style={style}>{str}</span>;
  }

  return (
    <span className={`math-text-wrap ${className}`} style={{ ...style }}>
      {parts.map((p, idx) => {
        if (p.type === 'math-display') {
          const html = renderLatex(p.content, true);
          return (
            <div
              key={idx}
              className="math-block"
              style={{ margin: '8px 0', overflowX: 'auto', textAlign: 'center' }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        if (p.type === 'math-inline') {
          const html = renderLatex(p.content, false);
          return (
            <span
              key={idx}
              className="math-inline"
              style={{ display: 'inline-block', margin: '0 2px' }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }
        if (p.type === 'code-block') {
          return (
            <pre
              key={idx}
              className="math-code-block"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                background: '#1A1612',
                color: '#F4EFE6',
                padding: '12px 16px',
                borderRadius: 10,
                fontSize: 13,
                overflowX: 'auto',
                margin: '10px 0',
                lineHeight: 1.5
              }}
            >
              {highlightCode(p.content)}
            </pre>
          );
        }
        if (p.type === 'code-inline') {
          return (
            <code
              key={idx}
              className="math-code-inline"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                background: 'rgba(91, 69, 234, 0.08)',
                color: '#1A1612',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: '0.9em',
                fontWeight: 600,
                border: '1px solid rgba(91, 69, 234, 0.15)'
              }}
            >
              {highlightCode(p.content)}
            </code>
          );
        }
        return <span key={idx}>{p.content}</span>;
      })}
    </span>
  );
}
