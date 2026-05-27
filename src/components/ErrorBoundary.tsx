import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', padding: 40, flexDirection: 'column', gap: 12,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--color-down-bg)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 20, color: 'var(--color-down)',
          }}>!</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>模块加载异常</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', maxWidth: 400, textAlign: 'center' }}>
            {this.state.error?.message ?? '未知错误'}
          </div>
          <button
            className="btn btn-sm"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: 8 }}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
