'use client';

import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import CodeMirror, { EditorView, keymap, Prec } from '@uiw/react-codemirror';
import { useTheme } from 'next-themes';
import { useMemo } from 'react';
import { toggleCodeBlockCommand } from '@/lib/code-block';

export interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
  /** Nhận EditorView khi editor tạo xong, để nút ngoài editor gọi được lệnh. */
  onView?: (view: EditorView) => void;
}

/** CodeMirror 6 viết Markdown thô, highlight cả code trong code fence. Chỉ chạy phía client. */
export default function CodeMirrorEditor({
  value,
  onChange,
  readOnly,
  placeholder,
  autoFocus,
  'aria-label': ariaLabel,
  onView,
}: CodeMirrorEditorProps) {
  const { resolvedTheme } = useTheme();
  const extensions = useMemo(
    () => [
      // Ctrl/Cmd+Shift+C như Slack; thêm Ctrl/Cmd+Alt+Shift+C (phím code block thật của Slack)
      // vì một số trình duyệt giữ Ctrl+Shift+C để mở DevTools khi chưa vào editor.
      Prec.highest(
        keymap.of([
          { key: 'Mod-Shift-c', run: toggleCodeBlockCommand },
          { key: 'Mod-Alt-Shift-c', run: toggleCodeBlockCommand },
        ]),
      ),
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
      onCreateEditor={onView}
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
