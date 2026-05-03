
import React, { useState } from 'react';
import { api } from '../../lib/api';
import { Image, FolderInput } from 'lucide-react';

export const PDFExtractImagesTool: React.FC = () => {
    const [inputPath, setInputPath] = useState('');
    const [outputDir, setOutputDir] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const handleExtract = async () => {
        if (!inputPath || !outputDir) return;
        setLoading(true);
        setStatus('Extracting...');
        const res = await api.extractImages(inputPath, outputDir);
        setLoading(false);
        if (res.success) {
            setStatus(`Success! Extracted ${res.data?.files.length} images.`);
            setInputPath('');
        } else {
            setStatus('Error: ' + res.err);
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Image className="text-purple-600" /> Extract Images
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
                     <label className="block text-sm font-medium text-slate-700 mb-1">Output Directory</label>
                     <input 
                        type="text" 
                        value={outputDir} 
                        onChange={e => setOutputDir(e.target.value)}
                        placeholder="Directory to save images..." 
                        className="w-full p-2 border rounded" 
                    />
                </div>

                <button 
                    onClick={handleExtract}
                    disabled={loading || !inputPath || !outputDir}
                    className="w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                    {loading ? 'Processing...' : 'Extract Images'}
                </button>
                
                {status && <div className="text-sm text-center font-medium mt-2">{status}</div>}
            </div>
        </div>
    );
};
