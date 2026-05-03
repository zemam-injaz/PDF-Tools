
import React, { useState } from 'react';
import { api } from '../../lib/api';
import { Split, FolderOpen, ArrowRight } from 'lucide-react';

export const PDFSplitTool: React.FC = () => {
    const [inputPath, setInputPath] = useState('');
    const [splitPages, setSplitPages] = useState('');
    const [outputDir, setOutputDir] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const handleSplit = async () => {
        if (!inputPath || !splitPages || !outputDir) return;
        
        const pages = splitPages.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
        if (pages.length === 0) {
            setStatus('Invalid page numbers');
            return;
        }

        setLoading(true);
        setStatus('Splitting...');
        const res = await api.split(inputPath, pages, outputDir);
        setLoading(false);
        
        if (res.success) {
            setStatus(`Success! Created ${res.data?.files.length} files.`);
            setInputPath('');
            setSplitPages('');
        } else {
            setStatus('Error: ' + res.err);
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Split className="text-indigo-600" /> Split PDF
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
                     <label className="block text-sm font-medium text-slate-700 mb-1">Split at Pages (e.g. 5, 10)</label>
                     <input 
                        type="text" 
                        value={splitPages} 
                        onChange={e => setSplitPages(e.target.value)}
                        placeholder="Comma separated page numbers" 
                        className="w-full p-2 border rounded" 
                    />
                    <p className="text-xs text-slate-500 mt-1">Files will be split AT these pages (starting new file).</p>
                </div>

                <div>
                     <label className="block text-sm font-medium text-slate-700 mb-1">Output Directory</label>
                     <input 
                        type="text" 
                        value={outputDir} 
                        onChange={e => setOutputDir(e.target.value)}
                        placeholder="Directory to save split files..." 
                        className="w-full p-2 border rounded" 
                    />
                </div>

                <button 
                    onClick={handleSplit}
                    disabled={loading || !inputPath || !splitPages || !outputDir}
                    className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                    {loading ? 'Processing...' : 'Split PDF'}
                </button>
                
                {status && <div className="text-sm text-center font-medium mt-2">{status}</div>}
            </div>
        </div>
    );
};
