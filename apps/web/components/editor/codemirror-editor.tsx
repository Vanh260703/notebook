'use client';

import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';

export interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
}

/** CodeMirror 6 viết Markdown thô, highlight cả code trong code fence. Chỉ chạy phía client. */
export default function CodeMirrorEditor({
  value,
  onChange,
  readOnly,
  placeholder,
  autoFocus,
  'aria-label': ariaLabel,
}: CodeMirrorEditorProps) {
  const { resolvedTheme } = useTheme();
  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': ariaLabel ?? 'Nội dung Markdown' }),
    ],
    [ariaLabel],
  );
  return (
    <CodeMirror
      className="markdown-editor h-full"
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      readOnly={readOnly}
      // readOnly của CodeMirror vẫn để contenteditable: trên điện thoại chạm vào sẽ bật bàn phím ảo.
      editable={!readOnly}
      placeholder={placeholder}
      autoFocus={autoFocus}
      height="100%"
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
      }}
    />
  );
}
