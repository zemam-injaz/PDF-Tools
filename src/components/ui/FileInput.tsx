import { useRef } from 'react';
import { FolderOpen, File as FileIcon, X, UploadCloud } from 'lucide-react';
import { open, save } from '@tauri-apps/plugin-dialog';

interface FileInputProps {
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
  accept?: string;
  isDirectory?: boolean;
  isSave?: boolean;
  label?: string;
  filterName?: string;
}

export const FileInput: React.FC<FileInputProps> = ({
  value,
  onChange,
  placeholder = 'اختر ملف...',
  accept = '.pdf',
  isDirectory = false,
  isSave = false,
  label,
  filterName
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleBrowseClick = async () => {
    // Check if running in Tauri environment
    const isTauri = !!(window as any).__TAURI__ || !!(window as any).__TAURI_INTERNALS__;

    if (isTauri) {
      try {
        let selected;
        const filters = isDirectory ? undefined : [{
          name: filterName || (accept === 'image/*' ? 'Images' : (accept.includes('pdf') ? 'PDF Files' : 'Files')),
          extensions: accept === 'image/*'
            ? ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tiff']
            : accept.replace(/\./g, '').split(',').map(ext => ext.trim())
        }];

        if (isSave) {
          selected = await save({ filters });
        } else {
          selected = await open({
            directory: isDirectory,
            multiple: false,
            filters
          });
        }

        if (selected) {
          onChange(selected as string);
        }
      } catch (err) {
        console.error('Failed to open native dialog:', err);
        // Fallback to HTML input if native dialog fails
        inputRef.current?.click();
      }
    } else {
      // Fallback for web browser
      inputRef.current?.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const path = isDirectory 
        ? (file as any).webkitRelativePath?.split('/')[0] || file.name
        : file.name;
      
      onChange(path);
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-primary mb-2.5">{label}</label>
      )}
      <div className="relative group">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="input !pl-[6.5rem] pr-4 dir-ltr text-left font-mono text-sm truncate h-12" // Increased height, padding, and text-left
          readOnly
          title={value}
        />
        <div className="absolute left-1 top-1 bottom-1 flex w-24">
          <button
            type="button"
            onClick={handleBrowseClick}
            className="btn h-full w-full text-xs px-2 shadow-sm border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors rounded-md flex items-center justify-center gap-2"
            title={isDirectory ? 'اختر مجلد' : isSave ? 'حفظ باسم' : 'تصفح'}
          >
            <FolderOpen size={16} className="opacity-70" />
            <span className="font-medium">{isSave ? 'حفظ' : 'تصفح'}</span>
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
          {...(isDirectory ? { webkitdirectory: '', directory: '' } as any : {})}
        />
      </div>
    </div>
  );
};

interface MultiFileInputProps {
  values: string[];
  onChange: (paths: string[]) => void;
  placeholder?: string;
  accept?: string;
  label?: string;
  filterName?: string;
}

export const MultiFileInput: React.FC<MultiFileInputProps> = ({
  values,
  onChange,
  placeholder = 'اختر ملفات...',
  accept = '.pdf',
  label,
  filterName
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleBrowseClick = async () => {
    // Check if running in Tauri environment
    const isTauri = !!(window as any).__TAURI__ || !!(window as any).__TAURI_INTERNALS__;

    if (isTauri) {
      try {
        const selected = await open({
          multiple: true,
          filters: [{
            name: filterName || (accept === 'image/*' ? 'Images' : (accept.includes('pdf') ? 'PDF Files' : 'Files')),
            extensions: accept === 'image/*'
              ? ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tiff']
              : accept.replace(/\./g, '').split(',').map(ext => ext.trim())
          }]
        });

        if (selected) {
          const newPaths = Array.isArray(selected) ? selected : [selected];
          onChange([...values, ...newPaths]);
        }
      } catch (err) {
        console.error('Failed to open native dialog:', err);
        inputRef.current?.click();
      }
    } else {
      inputRef.current?.click();
    }
  };

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const paths = Array.from(files).map(f => f.name);
      onChange([...values, ...paths]);
    }
  };

  const removeFile = (index: number) => {
    const newValues = values.filter((_, i) => i !== index);
    onChange(newValues);
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-primary mb-3">{label}</label>
      )}
      
      <div
        onClick={handleBrowseClick}
        className="border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer group mb-4 text-center bg-gray-50/50"
      >
        <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
          <UploadCloud size={24} />
        </div>
        <p className="text-sm font-medium text-primary mb-1">انقر لاختيار الملفات</p>
        <p className="text-xs text-secondary">{placeholder}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleFilesSelect}
        className="hidden"
      />

      {values.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
          {values.map((path, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-white border border-border rounded-lg text-sm group hover:border-gray-300 transition-colors shadow-sm">
              <div className="p-2 bg-red-50 text-red-600 rounded-md">
                <FileIcon size={16} />
              </div>
              <span className="flex-1 truncate dir-ltr text-left font-medium text-gray-700">{path}</span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="text-gray-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="إزالة الملف"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
