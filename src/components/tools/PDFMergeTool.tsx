import { useState } from 'react';
import { api } from '../../lib/api';
import { getDefaultOutputPath, openPath } from '../../lib/utils';
import { Files, ArrowRight, CheckCircle, AlertCircle, FolderOpen } from 'lucide-react';
import { MultiFileInput, FileInput } from '../ui/FileInput';

export const PDFMergeTool: React.FC = () => {
  const [files, setFiles] = useState<string[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [customFilename, setCustomFilename] = useState('');
  const [lastOutputFolder, setLastOutputFolder] = useState('');

  // Auto-set output path based on first file
  const handleFilesChange = (newFiles: string[]) => {
    setFiles(newFiles);
    if (!outputPath && newFiles.length > 0) {
      setOutputPath(getDefaultOutputPath(newFiles[0], '_merged'));
    }
  };

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });

  const handleMerge = async () => {
    if (files.length < 2 || !outputPath) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري الدمج...' });
    setLastOutputFolder('');

    // Logic to determine final output path
    let finalPath = outputPath;

    // If custom filename is provided, we need to construct the path carefully
    if (customFilename.trim()) {
      // Get directory from the selected outputPath (or default)
      const separator = outputPath.includes('\\') ? '\\' : '/';
      const lastSep = outputPath.lastIndexOf(separator);
      const dir = lastSep > 0 ? outputPath.substring(0, lastSep) : '.';

      // Ensure extension is pdf
      let name = customFilename.trim();
      if (!name.toLowerCase().endsWith('.pdf')) {
        name += '.pdf';
      }

      finalPath = `${dir}${separator}${name}`;
    }

    // Extract folder path for opening later
    const lastSlash = Math.max(finalPath.lastIndexOf('/'), finalPath.lastIndexOf('\\'));
    const folderPath = lastSlash > 0 ? finalPath.substring(0, lastSlash) : '.';

    const res = await api.merge(files, finalPath);
    setLoading(false);
    if (res.success) {
      setStatus({ type: 'success', message: 'تم دمج الملفات بنجاح!' });
      setLastOutputFolder(folderPath);
      setFiles([]);
      setOutputPath('');
      setCustomFilename('');
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ' });
    }
  };

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-blue-50 text-blue-600 shadow-sm">
          <Files size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">دمج ملفات PDF</h2>
          <p className="text-secondary mt-1">قم بدمج عدة ملفات في ملف واحد مرتب.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-8 overflow-y-auto pr-1 custom-scrollbar">
        {/* Input Section */}
        <section className="space-y-6">
          <MultiFileInput
            values={files}
            onChange={handleFilesChange}
            label="1. اختر الملفات المراد دمجها"
            placeholder="اسحب الملفات هنا أو انقر للاختيار"
            accept=".pdf"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-primary mb-2.5">2. اسم الملف الناتج (اختياري)</label>
              <input
                type="text"
                value={customFilename}
                onChange={e => setCustomFilename(e.target.value)}
                placeholder="اسم الملف بدون امتداد"
                className="input"
              />
            </div>

            <div>
              <FileInput
                value={outputPath}
                onChange={setOutputPath}
                label="3. مجلد الحفظ (أو ملف الحفظ الكامل)"
                placeholder="حدد مسار الحفظ..."
                accept=".pdf"
                isSave
              />
            </div>
          </div>
          <p className="text-xs text-secondary -mt-4 mr-1">
            {customFilename ? 'سيتم استخدام مجلد الحفظ مع الاسم المخصص.' : 'سيتم استخدام المسار الكامل المحدد في الحقل 3.'}
          </p>
        </section>

        {/* Action Section */}
        <section className="mt-auto pt-4 pb-2">
          {status.message && (
            <div className={`mb-4 p-4 rounded-lg flex items-center justify-between gap-3 text-sm font-medium animate-fade-in ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' :
                  'bg-zinc-50 text-zinc-600 border border-zinc-200'
              }`}>
              <div className="flex items-center gap-3">
                {status.type === 'success' ? <CheckCircle size={18} /> :
                  status.type === 'error' ? <AlertCircle size={18} /> :
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {status.message}
              </div>
              {status.type === 'success' && lastOutputFolder && (
                <button
                  onClick={() => openPath(lastOutputFolder)}
                  className="text-xs bg-white/50 hover:bg-white text-emerald-700 px-3 py-1.5 rounded-md transition-colors border border-emerald-200 flex items-center gap-2"
                >
                  <FolderOpen size={14} />
                  فتح المجلد
                </button>
              )}
            </div>
          )}

          <button
            onClick={handleMerge}
            disabled={loading || files.length < 2 || !outputPath}
            className="btn-enhanced w-full py-4 text-lg shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                بدء عملية الدمج
                <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
