import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, FileCheck2 } from 'lucide-react';
import { PDFMergeTool } from './components/tools/PDFMergeTool';
import { PDFSplitTool } from './components/tools/PDFSplitTool';
import { PDFCompressTool } from './components/tools/PDFCompressTool';
import { PDFExtractImagesTool } from './components/tools/PDFExtractImagesTool';
import { TextExtractTool } from './components/tools/TextExtractTool';
import { BookmarkTool } from './components/tools/BookmarkTool';
import { RotatePagesTool } from './components/tools/RotatePagesTool';
import { DeletePagesTool } from './components/tools/DeletePagesTool';
import { ExtractPagesTool } from './components/tools/ExtractPagesTool';
import { WatermarkTool } from './components/tools/WatermarkTool';
import { RemoveSecurityTool } from './components/tools/RemoveSecurityTool';
import { BookLibraryTool } from './components/tools/BookLibraryTool';
import { CommentsTool } from './components/tools/CommentsTool';
import { ChapterWeightTool } from './components/tools/ChapterWeightTool';
import { ReadingSpeedTool } from './components/tools/ReadingSpeedTool';
import { ImagesToPDFTool } from './components/tools/ImagesToPDFTool';
import { PDFToImagesTool } from './components/tools/PDFToImagesTool';
import { MetadataTool } from './components/tools/MetadataTool';
import { TahweelTool } from './components/tools/TahweelTool';
import { CleanPDFTool } from './components/tools/CleanPDFTool';
import { InvertColorsTool } from './components/tools/InvertColorsTool';
import { CropPDFTool } from './components/tools/CropPDFTool';
import { PageNumbersTool } from './components/tools/PageNumbersTool';
import { RedactPDFTool } from './components/tools/RedactPDFTool';
import { ExtractTablesTool } from './components/tools/ExtractTablesTool';
import { MarkdownToPDFTool } from './components/tools/MarkdownToPDFTool';
import { PrivacyPolicy } from './components/legal/PrivacyPolicy';
import { TermsOfService } from './components/legal/TermsOfService';
import { Header } from './components/layout/Header';
import { Sidebar, type WorkspaceView } from './components/layout/Sidebar';
import { TaskMonitor } from './components/layout/TaskMonitor';
import { HomeWorkspace } from './components/workspace/HomeWorkspace';
import { ToolsDirectory } from './components/workspace/ToolsDirectory';
import { TaskHistory } from './components/workspace/TaskHistory';
import { SettingsWorkspace } from './components/workspace/SettingsWorkspace';
import { useTaskManager } from './hooks/useTaskManager';
import { useRecentFiles } from './hooks/useRecentFiles';
import { getToolDefinition, type Tool, type ToolId } from './lib/toolCatalog';

function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>('home');
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [selectedFile, setSelectedFile] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('warraq_sidebar_collapsed') === 'true');
  const { tasks, activeTasks, completedTasks, refresh } = useTaskManager();
  const { recentFiles, addRecentFile } = useRecentFiles();

  const navigate = (view: WorkspaceView) => {
    setActiveView(view);
    if (view !== 'tool') setActiveTool(null);
  };

  const selectTool = (tool: ToolId) => {
    if (selectedFile) addRecentFile(selectedFile, getToolDefinition(tool)?.label || 'فتح أداة');
    setActiveTool(tool);
    setActiveView('tool');
  };

  const chooseFile = (path: string) => {
    setSelectedFile(path);
    addRecentFile(path);
  };

  const toggleSidebar = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
    localStorage.setItem('warraq_sidebar_collapsed', String(collapsed));
  };

  const renderTool = () => {
    switch (activeTool) {
      case 'tahweel': return <TahweelTool initialPath={selectedFile} />;
      case 'merge': return <PDFMergeTool initialFiles={selectedFile ? [selectedFile] : []} />;
      case 'split': return <PDFSplitTool initialPath={selectedFile} />;
      case 'compress': return <PDFCompressTool initialPath={selectedFile} />;
      case 'extract': return <PDFExtractImagesTool />;
      case 'text': return <TextExtractTool initialPath={selectedFile} />;
      case 'bookmark': return <BookmarkTool />;
      case 'rotate': return <RotatePagesTool />;
      case 'delete': return <DeletePagesTool />;
      case 'extract-pages': return <ExtractPagesTool />;
      case 'watermark': return <WatermarkTool />;
      case 'security': return <RemoveSecurityTool />;
      case 'library': return <BookLibraryTool />;
      case 'comments': return <CommentsTool />;
      case 'chapter-weight': return <ChapterWeightTool onNavigate={(tool) => tool && selectTool(tool as ToolId)} />;
      case 'reading-speed': return <ReadingSpeedTool />;
      case 'images-to-pdf': return <ImagesToPDFTool />;
      case 'markdown-to-pdf': return <MarkdownToPDFTool />;
      case 'pdf-to-images': return <PDFToImagesTool initialPath={selectedFile} />;
      case 'metadata': return <MetadataTool />;
      case 'clean-pdf': return <CleanPDFTool />;
      case 'invert-colors': return <InvertColorsTool />;
      case 'crop-pdf': return <CropPDFTool />;
      case 'page-numbers': return <PageNumbersTool />;
      case 'redact-pdf': return <RedactPDFTool />;
      case 'extract-tables': return <ExtractTablesTool />;
      default: return null;
    }
  };

  const renderWorkspace = () => {
    if (activeView === 'home') {
      return (
        <HomeWorkspace
          selectedFile={selectedFile}
          recentFiles={recentFiles}
          activeTasks={activeTasks}
          completedTasks={completedTasks}
          onFileChosen={chooseFile}
          onClearFile={() => setSelectedFile('')}
          onSelectTool={selectTool}
          onOpenTools={() => navigate('tools')}
          onOpenTasks={() => navigate('tasks')}
        />
      );
    }
    if (activeView === 'tools') {
      return <ToolsDirectory query={searchQuery} onQueryChange={setSearchQuery} selectedFile={selectedFile} onClearSelectedFile={() => setSelectedFile('')} onSelectTool={selectTool} />;
    }
    if (activeView === 'library') return <div className="workspace-page library-page"><BookLibraryTool /></div>;
    if (activeView === 'tasks') return <TaskHistory tasks={tasks} onRefresh={() => void refresh()} />;
    if (activeView === 'settings') return <SettingsWorkspace onOpenPrivacy={() => navigate('privacy')} onOpenTerms={() => navigate('terms')} />;
    if (activeView === 'privacy') return <div className="workspace-page legal-page"><PrivacyPolicy onBack={() => navigate('settings')} /></div>;
    if (activeView === 'terms') return <div className="workspace-page legal-page"><TermsOfService onBack={() => navigate('settings')} /></div>;

    const definition = getToolDefinition(activeTool);
    return (
      <div className="workspace-page tool-page">
        <div className="tool-workspace-header">
          <button type="button" onClick={() => navigate('tools')}><ArrowRight size={16} /> دليل الأدوات</button>
          <div>
            <h1>{definition?.label || 'أداة PDF'}</h1>
            {selectedFile && <span><FileCheck2 size={15} /><code dir="ltr">{selectedFile}</code></span>}
          </div>
        </div>
        <div className="tool-workspace-content" key={`${activeTool}-${selectedFile}`}>{renderTool()}</div>
      </div>
    );
  };

  return (
    <div className="workspace-app" dir="rtl">
      <Header
        searchValue={searchQuery}
        onSearchChange={(value) => { setSearchQuery(value); if (value) navigate('tools'); }}
        onSearchFocus={() => navigate('tools')}
        activeTaskCount={activeTasks.length}
        onOpenTasks={() => navigate('tasks')}
        onOpenSettings={() => navigate('settings')}
        onToggleNavigation={() => setIsMobileSidebarOpen(true)}
      />
      <div className="workspace-shell">
        <Sidebar
          activeView={activeView}
          onNavigate={navigate}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={toggleSidebar}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
        <main className="workspace-main">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeView}-${activeTool || ''}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
            >
              {renderWorkspace()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <TaskMonitor activeTasks={activeTasks} completedTasks={completedTasks} onOpenTasks={() => navigate('tasks')} />
    </div>
  );
}

export default App;
