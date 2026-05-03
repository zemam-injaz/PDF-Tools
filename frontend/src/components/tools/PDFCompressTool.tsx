
import React, { useState } from 'react';
import { api } from '../../lib/api';
import { Minimize2, FileDown } from 'lucide-react';

export const PDFCompressTool: React.FC = () => {
    const [inputPath, setInputPath] = useState('');
    const [outputPath, setOutputPath] = useState('');
    const [level, setLevel] = useState(2);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const handleCompress = async () => {
        if (!inputPath || !outputPath) return;
        setLoading(true);
        setStatus('Compressing...');
        const res = await api.compress(inputPath, outputPath, level);
        setLoading(false);
        if (res.success) {
            setStatus('Success!');
            setInputPath('');
            setOutputPath('');
        } else {
            setStatus('Error: ' + res.err);
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Minimize2 className="text-emerald-600" /> Compress PDF
            </h2>
            
            <div className="space-y-4">
                <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1">Input File</label>
                     <input 
                        type="text" 
                        value={inputPath} 
                        onChange={e => setInputPath(e.target.value)}
                        placeholder="Path to PDF file..." 
                        className="w-full p-2 border rounded" 
                    />
                </div>

                <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1">Compression Level</label>
                     <select 
                        value={level} 
                        onChange={e => setLevel(parseInt(e.target.value))}
                        className="w-full p-2 border rounded"
                     >
                         <option value={0}>None (0)</option>
                         <option value={1}>Clean (1)</option>
                         <option value={2}>Deflate (2) - Recommended</option>
                         <option value={3}>High (3)</option>
                         <option value={4}>Max (4)</option>
                     </select>
                </div>

                <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1">Output File</label>
                     <input 
                        type="text" 
                        value={outputPath} 
                        onChange={e => setOutputPath(e.target.value)}
                        placeholder="Path for compressed file..." 
                        className="w-full p-2 border rounded" 
                    />
                </div>

                <button 
                    onClick={handleCompress}
                    disabled={loading || !inputPath || !outputPath}
                    className="w-full py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                    {loading ? 'Processing...' : 'Compress PDF'}
                </button>
                
                {status && <div className="text-sm text-center font-medium mt-2">{status}</div>}
            </div>
        </div>
    );
};
