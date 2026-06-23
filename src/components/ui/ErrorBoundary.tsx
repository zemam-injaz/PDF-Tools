import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCw, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
    showDetails: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    // Clear state and reload the window to completely recover the app state
    window.location.reload();
  };

  private handleCopy = async () => {
    if (!this.state.error) return;
    const textToCopy = `Error: ${this.state.error.message}\n\nStack:\n${this.state.error.stack || ''}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack || ''}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans dir-rtl" dir="rtl">
          {/* Decorative Background Glows */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-purple-600/10 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none"></div>

          <div className="w-full max-w-2xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col items-center text-center">
              {/* Icon Container */}
              <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center mb-6 shadow-inner animate-pulse">
                <AlertOctagon size={32} />
              </div>

              {/* Arabic Copywriting */}
              <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-3">
                عذراً، حدث خطأ غير متوقع
              </h1>
              <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-lg mb-8">
                واجه وراق مشكلة أثناء تشغيل هذه الصفحة. يمكنك محاولة إعادة تحميل التطبيق لاستعادة الجلسة ومتابعة عملك.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 justify-center w-full mb-8">
                <button
                  onClick={this.handleReload}
                  className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/35 transition-all duration-200 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0 group"
                >
                  <RotateCw size={18} className="group-hover:rotate-45 transition-transform duration-300" />
                  <span>إعادة تحميل التطبيق</span>
                </button>
              </div>
            </div>

            {/* Error Details Section */}
            {this.state.error && (
              <div className="border-t border-slate-800/80 pt-6 mt-2">
                <button
                  onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                  className="flex items-center justify-between w-full text-slate-400 hover:text-slate-200 text-xs font-bold transition-colors py-2 px-3 hover:bg-slate-800/40 rounded-xl"
                >
                  <span className="flex items-center gap-2">
                    <span>التفاصيل التقنية للخطأ</span>
                    {this.state.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">
                    {this.state.error.name}
                  </span>
                </button>

                {this.state.showDetails && (
                  <div className="mt-4 animate-slide-down">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-slate-500 font-bold">يرجى نسخ هذا الخطأ ومشاركته مع الدعم الفني:</span>
                      <button
                        onClick={this.handleCopy}
                        className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2.5 py-1.5 rounded-lg border border-indigo-500/20 transition-all"
                      >
                        {this.state.copied ? (
                          <>
                            <Check size={12} className="text-emerald-400" />
                            <span className="text-emerald-400">تم النسخ!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>نسخ التفاصيل</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="bg-slate-950/80 border border-slate-800/60 rounded-2xl p-4 overflow-x-auto max-h-60 custom-scrollbar text-left dir-ltr">
                      <pre className="text-rose-400 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                        {this.state.error.toString()}
                        {'\n\n'}
                        {this.state.error.stack}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
