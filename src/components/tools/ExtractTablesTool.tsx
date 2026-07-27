import { useState } from 'react';
import { api } from '../../lib/api';
import { getDefaultOutputPath, openPath } from '../../lib/utils';
import { FileInput } from '../ui/FileInput';
import { Table2, CheckCircle, AlertCircle, FolderOpen, ArrowRight } from 'lucide-react';

const FORMATS = [
  { id: 'xlsx', label: 'Excel (XLSX)' },
  { id: 'csv', label: 'CSV (ZIP)' },
  { id: 'json', label: 'JSON' },
];

export const ExtractTablesTool: React.FC = () => {
  const [pdfPath, setPdfPath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [format, setFormat] = useState('xlsx');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [lastFolder, setLastFolder] = useState('');
  const [tableCount, setTableCount] = useState(0);

  const handleFileChange = (path: string) => {
    setPdfPath(path);
    const ext = format === 'xlsx' ? '.xlsx' : format === 'csv' ? '.zip' : '.json';
    if (!outputPath) setOutputPath(getDefaultOutputPath(path, '_tables').replace('.pdf', ext));
  };

  const handleFormatChange = (fmt: string) => {
    setFormat(fmt);
    if (outputPath) {
      const ext = fmt === 'xlsx' ? '.xlsx' : fmt === 'csv' ? '.zip' : '.json';
      const base = outputPath.replace(/\.(xlsx|zip|json)$/, '');
      setOutputPath(base + ext);
    }
  };

  const handleExtract = async () => {
    if (!pdfPath || !outputPath) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري استخراج الجداول...' });
    setLastFolder('');
    setTableCount(0);

    const folder = outputPath.substring(0, Math.max(outputPath.lastIndexOf('/'), outputPath.lastIndexOf('\\')));
    const res = await api.extractTables(pdfPath, outputPath, format);
    setLoading(false);

    if (res.success && res.data) {
      setTableCount(res.data.table_count || 0);
      setStatus({
        type: 'success',
        message: res.data.table_count > 0
          ? `تم استخراج ${res.data.table_count} جدول بنجاح!`
          : 'لم يتم العثور على جداول في الملف.',
      });
      if (res.data.table_count > 0) setLastFolder(folder);
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ' });
    }
  };

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-amber-50 text-amber-600 shadow-sm">
          <Table2 size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">استخراج الجداول</h2>
          <p className="text-secondary mt-1">تحويل جداول PDF إلى Excel أو CSV أو JSON.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-8 overflow-y-auto pr-1 custom-scrollbar">
        <section className="space-y-6">
          <FileInput
            value={pdfPath}
            onChange={handleFileChange}
            label="1. اختر ملف PDF"
            placeholder="حدد مسار الملف..."
            accept=".pdf"
          />

          <div>
            <label className="block text-sm font-semibold text-primary mb-3">2. صيغة التصدير</label>
            <div className="flex gap-3">
              {FORMATS.map(f => (
                <button
                  key={f.id}
                  onClick={() => handleFormatChange(f.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    format === f.id ? 'bg-amber-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-secondary mt-2">
              {format === 'xlsx' ? 'يتم إنشاء ورقة منفصلة لكل جدول.' :
               format === 'csv' ? 'يتم ضغط جداول CSV متعددة في ملف ZIP.' :
               'يتم تصدير البيانات بتنسيق JSON منظم.'}
            </p>
          </div>

          <FileInput
            value={outputPath}
            onChange={setOutputPath}
            label="3. مسار الحفظ"
            placeholder="حدد مسار الحفظ..."
            accept={`.${format === 'xlsx' ? 'xlsx' : format === 'csv' ? 'zip' : 'json'}`}
            isSave
          />

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">ملاحظة حول الملفات الممسوحة ضوئياً</p>
                <p className="text-xs text-blue-700 mt-1">
                  إذا كان الملف لا يحتوي على طبقة نصية (صور ممسوحة ضوئياً)، يرجى استخدام Tahweel (OCR) أولاً لاستخراج النص قبل محاولة استخراج الجداول.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-auto pt-4 pb-2">
          {status.message && (
            <div className={`mb-4 p-4 rounded-lg flex items-center justify-between gap-3 text-sm font-medium animate-fade-in ${
              status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
              status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' :
              'bg-zinc-50 text-zinc-600 border border-zinc-200'
            }`}>
              <div className="flex items-center gap-3">
                {status.type === 'success' ? <CheckCircle size={18} /> :
                  status.type === 'error' ? <AlertCircle size={18} /> :
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                <span>{status.message}</span>
                {status.type === 'success' && tableCount > 0 && (
                  <span className="bg-emerald-200 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">{tableCount}</span>
                )}
              </div>
              {status.type === 'success' && lastFolder && (
                <button onClick={() => openPath(lastFolder)} className="text-xs bg-white/50 hover:bg-white text-emerald-700 px-3 py-1.5 rounded-md transition-colors border border-emerald-200 flex items-center gap-2">
                  <FolderOpen size={14} /> فتح المجلد
                </button>
              )}
            </div>
          )}

          <button
            onClick={handleExtract}
            disabled={loading || !pdfPath || !outputPath}
            className="btn-enhanced w-full py-4 text-lg shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-amber-600 hover:bg-amber-700 text-white"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                استخراج الجداول <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
