
import React, { useState } from 'react';
import { api } from '../../lib/api';
import { FileText, FileUp, Files, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

export const PDFMergeTool: React.FC = () => {
    const [files, setFiles] = useState<string[]>([]);
    const [outputPath, setOutputPath] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const addFile = (e: React.FormEvent) => {
        e.preventDefault();
        const input = document.getElementById('file-input') as HTMLInputElement;
        if (input.value) {
            setFiles([...files, input.value]);
            input.value = '';
        }
    };

    const handleMerge = async () => {
        if (files.length < 2 || !outputPath) return;
        setLoading(true);
        setStatus('Merging...');
        const res = await api.merge(files, outputPath);
        setLoading(false);
        if (res.success) {
            setStatus('Success!');
            setFiles([]);
            setOutputPath('');
        } else {
            setStatus('Error: ' + res.err);
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Files className="text-blue-600" /> Merge PDFs
            </h2>
            
            <div className="space-y-4">
                <form onSubmit={addFile} className="flex gap-2">
                    <input id="file-input" type="text" placeholder="Path to PDF file..." className="flex-1 p-2 border rounded" />
                    <button type="submit" className="px-4 py-2 bg-slate-100 rounded hover:bg-slate-200">Add</button>
                </form>

                <div className="space-y-2">
                    {files.map((f, i) => (
                        <div key={i} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                            <span className="truncate flex-1">{f}</span>
                            <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-red-500"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                     <input 
                        type="text" 
                        value={outputPath} 
                        onChange={e => setOutputPath(e.target.value)}
                        placeholder="Output file path (e.g. C:\merged.pdf)" 
                        className="flex-1 p-2 border rounded" 
                    />
                </div>

                <button 
                    onClick={handleMerge}
                    disabled={loading || files.length < 2 || !outputPath}
                    className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? 'Processing...' : 'Merge Files'}
                </button>
                
                {status && <div className="text-sm text-center font-medium mt-2">{status}</div>}
            </div>
        </div>
    );
};
