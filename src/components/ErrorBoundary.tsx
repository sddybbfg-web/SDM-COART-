import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let friendly = 'अपेक्षित तकनीकी त्रुटि हुई। कृपया पृष्ठ को पुनः लोड करें।';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.error) {
        if (String(parsed.error).toLowerCase().includes('quota')) {
          friendly = 'दैनिक डेटाबेस सीमा (Quota) पूरी हो गई है। यह कल पुनः रीसेट हो जाएगी।';
        } else if (String(parsed.error).toLowerCase().includes('permission')) {
          friendly = `अनुमति अस्वीकृत (${parsed.operationType || 'read'}): आपके पास इस रिकॉर्ड को देखने या बदलने का अधिकार नहीं है।`;
        } else {
          friendly = parsed.error;
        }
      }
    } catch {
      if (error?.message) friendly = error.message;
    }
    return { hasError: true, message: friendly };
  }

  componentDidCatch(error: Error) {
    console.error('App ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[#0B1D3A] mb-2">
              कुछ त्रुटि हुई है
            </h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B1D3A] text-white text-sm font-medium hover:bg-[#132C54] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              पुनः प्रयास करें
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
