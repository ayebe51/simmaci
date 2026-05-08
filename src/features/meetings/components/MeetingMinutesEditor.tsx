/**
 * MeetingMinutesEditor Component
 * Rich text editor for meeting minutes using TipTap
 */

import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo2,
  Redo2,
} from 'lucide-react';
import { toast } from 'sonner';
import '@/styles/editor.css';

interface MeetingMinutesEditorProps {
  initialContent?: string;
  onSave: (content: string) => void;
  isSaving?: boolean;
  isReadOnly?: boolean;
}

export const MeetingMinutesEditor: React.FC<MeetingMinutesEditorProps> = ({
  initialContent = '',
  onSave,
  isSaving = false,
  isReadOnly = false,
}) => {
  const [content, setContent] = useState(initialContent);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
      }),
      Image.configure({
        allowBase64: true,
      }),
    ],
    content: initialContent,
    editable: !isReadOnly,
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && initialContent && editor.getHTML() !== initialContent) {
      editor.commands.setContent(initialContent);
      setContent(initialContent);
    }
  }, [initialContent, editor]);

  if (!editor) {
    return <div className="p-4 text-center text-gray-500">Loading editor...</div>;
  }

  const handleAddLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  const handleAddImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event: any) => {
          editor.chain().focus().setImage({ src: event.target.result }).run();
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleSave = () => {
    onSave(content);
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      {!isReadOnly && (
        <>
          <div className="bg-gray-50 border-b p-3 flex flex-wrap gap-2">
            {/* Text Formatting */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={editor.isActive('bold') ? 'default' : 'outline'}
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant={editor.isActive('italic') ? 'default' : 'outline'}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-4 h-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-8" />

            {/* Headings */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'outline'}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                title="Heading 2"
              >
                <Heading2 className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'outline'}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                title="Heading 3"
              >
                <Heading3 className="w-4 h-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-8" />

            {/* Lists */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={editor.isActive('bulletList') ? 'default' : 'outline'}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant={editor.isActive('orderedList') ? 'default' : 'outline'}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                title="Ordered List"
              >
                <ListOrdered className="w-4 h-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-8" />

            {/* Media */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddLink}
                title="Add Link"
              >
                <LinkIcon className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddImage}
                title="Add Image"
              >
                <ImageIcon className="w-4 h-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-8" />

            {/* Undo/Redo */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().chain().focus().undo().run()}
                title="Undo"
              >
                <Undo2 className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().chain().focus().redo().run()}
                title="Redo"
              >
                <Redo2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Editor Content */}
      <div className="p-4 min-h-96 prose prose-sm max-w-none">
        <EditorContent editor={editor} />
      </div>

      {/* Save Button */}
      {!isReadOnly && (
        <div className="bg-gray-50 border-t p-3 flex justify-end gap-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Notulensi'}
          </Button>
        </div>
      )}
    </div>
  );
};
