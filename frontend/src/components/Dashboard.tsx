
import React, { useState } from 'react';
import { PDFMergeTool } from './tools/PDFMergeTool';
import { PDFSplitTool } from './tools/PDFSplitTool';
import { PDFCompressTool } from './tools/PDFCompressTool';
import { PDFExtractImagesTool } from './tools/PDFExtractImagesTool';
import { FileText, Files, Split, Minimize2, Image, LayoutDashboard } from 'lucide-react';

type Tool = 'merge' | 'split' | 'compress' | 'extract' | null;

export const Dashboard: React.FC = () => {
    const [activeTool, setActiveTool] = useState<Tool>(null);

    const renderTool = () => {
        switch (activeTool) {
            case 'merge': return <PDFMergeTool />;
            case 'split': return <PDFSplitTool />;
            case 'compress': return <PDFCompressTool />;
            case 'extract': return <PDFExtractImagesTool />;
            default: return null;
        }
    };

    if (activeTool) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <button 
                    onClick={() => setActiveTool(null)}
                    className="mb-4 flex items-center text-slate-500 hover:text-slate-700"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                </button>
                {renderTool()}
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <header className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-slate-800 flex items-center justify-center gap-3">
                    <FileText className="w-8 h-8 text-indigo-600" />
                    PDF Toolbox
                </h1>
                <p className="text-slate-500 mt-2">Simple, secure, and fast PDF manipulation tools.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ToolCard 
                    title="Merge PDFs" 
                    description="Combine multiple PDF files into one."
                    icon={Files}
                    color="bg-blue-500"
                    onClick={() => setActiveTool('merge')}
                />
                <ToolCard 
                    title="Split PDF" 
                    description="Split a PDF file into multiple parts."
                    icon={Split}
                    color="bg-indigo-500"
                    onClick={() => setActiveTool('split')}
                />
                <ToolCard 
                    title="Compress PDF" 
                    description="Reduce file size while maintaining quality."
                    icon={Minimize2}
                    color="bg-emerald-500"
                    onClick={() => setActiveTool('compress')}
                />
                <ToolCard 
                    title="Extract Images" 
                    description="Extract all images from a PDF."
                    icon={Image}
                    color="bg-purple-500"
                    onClick={() => setActiveTool('extract')}
                />
            </div>
        </div>
    );
};

interface ToolCardProps {
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
    onClick: () => void;
}

const ToolCard: React.FC<ToolCardProps> = ({ title, description, icon: Icon, color, onClick }) => {
    return (
        <button 
            onClick={onClick}
            className="flex items-start p-6 bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all text-left group"
        >
            <div className={`p-3 rounded-lg ${color} text-white mr-4 shadow-sm group-hover:scale-110 transition-transform`}>
                <Icon size={24} />
            </div>
            <div>
                <h3 className="font-bold text-lg text-slate-800 mb-1">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
            </div>
        </button>
    );
};

// Simple ArrowLeft component since I forgot to import it or Lucid might not export it directly as ArrowLeft? 
// Lucide exports ArrowLeft. I'll add it to imports.
import { ArrowLeft } from 'lucide-react';
