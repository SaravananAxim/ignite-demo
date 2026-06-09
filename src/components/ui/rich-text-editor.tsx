import { useRef, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Enable extended formatting for contract templates (preserves Word/Docs styling) */
  extendedFormats?: boolean;
}

// Basic toolbar for simple descriptions
const basicModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['link'],
    ['clean']
  ],
  clipboard: {
    matchVisual: false,
  },
};

// Extended toolbar for contract templates with full formatting support
const extendedModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    [{ 'font': [] }],
    [{ 'size': ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'align': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
    ['blockquote'],
    ['link', 'image'],
    ['clean']
  ],
  clipboard: {
    matchVisual: false,
  },
};

const basicFormats = [
  'header',
  'bold', 'italic', 'underline',
  'list', 'bullet',
  'link'
];

// Extended formats to preserve Word/Google Docs styling
const extendedFormats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'align',
  'list', 'bullet', 'indent',
  'blockquote',
  'link', 'image'
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Enter description...',
  className,
  extendedFormats: useExtended = false,
}: RichTextEditorProps) {
  const quillRef = useRef<ReactQuill>(null);
  const [isFocused, setIsFocused] = useState(false);

  const modules = useExtended ? extendedModules : basicModules;
  const formats = useExtended ? extendedFormats : basicFormats;

  return (
    <div 
      className={cn(
        'rich-text-editor rounded-md border bg-background transition-colors',
        isFocused && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
        className
      )}
    >
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      <style>{`
        .rich-text-editor .ql-container {
          border: none !important;
          font-family: inherit;
          font-size: 0.875rem;
        }
        .rich-text-editor .ql-toolbar {
          border: none !important;
          border-bottom: 1px solid hsl(var(--border)) !important;
          background: hsl(var(--muted) / 0.3);
          border-radius: calc(var(--radius) - 2px) calc(var(--radius) - 2px) 0 0;
        }
        .rich-text-editor .ql-toolbar.ql-snow {
          flex-wrap: wrap;
        }
        .rich-text-editor .ql-editor {
          min-height: 120px;
          padding: 0.75rem;
        }
        .rich-text-editor .ql-editor.ql-blank::before {
          color: hsl(var(--muted-foreground));
          font-style: normal;
        }
        .rich-text-editor .ql-toolbar button:hover,
        .rich-text-editor .ql-toolbar button:focus,
        .rich-text-editor .ql-toolbar button.ql-active {
          color: hsl(var(--primary)) !important;
        }
        .rich-text-editor .ql-toolbar button:hover .ql-stroke,
        .rich-text-editor .ql-toolbar button:focus .ql-stroke,
        .rich-text-editor .ql-toolbar button.ql-active .ql-stroke {
          stroke: hsl(var(--primary)) !important;
        }
        .rich-text-editor .ql-toolbar button:hover .ql-fill,
        .rich-text-editor .ql-toolbar button:focus .ql-fill,
        .rich-text-editor .ql-toolbar button.ql-active .ql-fill {
          fill: hsl(var(--primary)) !important;
        }
        .rich-text-editor .ql-snow .ql-picker {
          color: hsl(var(--foreground));
        }
        .rich-text-editor .ql-snow .ql-picker-options {
          background: hsl(var(--background));
          border-color: hsl(var(--border));
        }
      `}</style>
    </div>
  );
}
