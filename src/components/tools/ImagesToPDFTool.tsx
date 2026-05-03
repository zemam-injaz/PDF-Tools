import { useState } from 'react';
import { api } from '../../lib/api';
import { Image as ImageIcon, ArrowRight, CheckCircle, AlertCircle, X, GripVertical, FileImage } from 'lucide-react';
import { FileInput, MultiFileInput } from '../ui/FileInput';

export const ImagesToPDFTool: React.FC = () => {
  const [images, setImages] = useState<string[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });

  const handleCreate = async () => {
    if (images.length === 0 || !outputPath) return;
    setLoading(true);
    setStatus({ type: '', message: 'جاري إنشاء ملف PDF...' });
    
    // Validate output path has .pdf extension
    let finalPath = outputPath;
    if (!finalPath.toLowerCase().endsWith('.pdf')) {
      finalPath += '.pdf';
    }

    const res = await api.createFromImages(images, finalPath);
    setLoading(false);
    
    if (res.success) {
      setStatus({ type: 'success', message: '✅ تم إنشاء ملف PDF بنجاح!' });
      setImages([]);
      setOutputPath('');
    } else {
      setStatus({ type: 'error', message: res.error || 'حدث خطأ أثناء الإنشاء' });
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= images.length) return;
    const newImages = [...images];
    const [moved] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, moved);
    setImages(newImages);
  };

  return (
    <div className="card h-full flex flex-col animate-fade-in">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
        <div className="p-4 rounded-xl bg-pink-50 text-pink-600 shadow-sm">
          <ImageIcon size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary">صور إلى PDF</h2>
          <p className="text-secondary mt-1">تجميع عدة صور في ملف PDF واحد.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-8 overflow-y-auto pr-1 custom-scrollbar">
        <section className="space-y-6">
          <MultiFileInput
            values={images}
            onChange={setImages}
            label="1. اختر الصور"
            placeholder="اسحب الصور هنا أو انقر للاختيار (PNG, JPG, BMP...)"
            accept="image/*"
            filterName="Image Files"
          />

          {images.length > 0 && (
            <div className="space-y-3">
               <label className="block text-sm font-semibold text-primary">ترتيب الصور ({images.length})</label>
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                 {images.map((img, index) => (
                   <div key={index + img} className="group relative bg-white border border-border rounded-xl p-3 shadow-sm hover:shadow-md transition-all flex flex-col gap-2">
                      <div className="absolute top-2 left-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                           onClick={() => removeImage(index)}
                           className="p-1.5 bg-white text-red-500 rounded-lg shadow-sm hover:bg-red-50"
                           title="حذف"
                         >
                            <X size={14} />
                         </button>
                      </div>
                      
                      <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg h-24 overflow-hidden relative">
                          <FileImage className="text-gray-300" size={32} />
                          {/* We could try to show preview if we had access to read file blob, but path is string only currently */}
                          <div className="absolute bottom-1 right-2 text-[10px] text-gray-500 bg-white/80 px-1.5 py-0.5 rounded">
                            #{index + 1}
                          </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-1">
                          <button 
                             onClick={() => moveImage(index, index - 1)} 
                             disabled={index === 0}
                             className="text-gray-400 hover:text-primary disabled:opacity-20"
                          >
                             <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-current" />
                          </button>
                          <button 
                             onClick={() => moveImage(index, index + 1)} 
                             disabled={index === images.length - 1}
                             className="text-gray-400 hover:text-primary disabled:opacity-20"
                          >
                             <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-current" />
                          </button>
                        </div>
                        <span className="text-xs text-gray-600 truncate dir-ltr flex-1" title={img}>
                          {img.split(/[/\\]/).pop()}
                        </span>
                        <GripVertical size={14} className="text-gray-300 cursor-grab active:cursor-grabbing" />
                      </div>
                   </div>
                 ))}
               </div>
            </div>
          )}

          <FileInput
            value={outputPath}
            onChange={setOutputPath}
            label="2. مسار الملف الناتج"
            placeholder="اختر مكان الحفظ..."
            accept=".pdf"
            isSave
            filterName="PDF Files"
          />
        </section>

        <section className="mt-auto pt-4 pb-2">
          {status.message && (
            <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 text-sm font-medium animate-fade-in ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                status.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' :
                  'bg-zinc-50 text-zinc-600 border border-zinc-200'
              }`}>
              {status.type === 'success' ? <CheckCircle size={18} /> :
                status.type === 'error' ? <AlertCircle size={18} /> :
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {status.message}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={loading || images.length === 0 || !outputPath}
            className="btn btn-primary w-full py-4 text-lg shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 transition-all disabled:opacity-50 disabled:shadow-none bg-pink-600 hover:bg-pink-700 border-transparent focus:ring-pink-500"
          >
            {loading ? 'جاري المعالجة...' : (
              <span className="flex items-center justify-center gap-2">
                إنشاء PDF
                <ArrowRight size={20} className="rtl:rotate-180" />
              </span>
            )}
          </button>
        </section>
      </div>
    </div>
  );
};
