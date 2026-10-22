import React from 'react';

// Menangkap error render supaya halaman tidak jadi hitam kosong.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Halaman crash:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505] text-white p-6 text-center">
        <h1 className="text-xl font-bold mb-2">Terjadi kesalahan di halaman ini</h1>
        <p className="text-sm text-gray-400 mb-1 max-w-md">Data Anda aman. Muat ulang halaman untuk melanjutkan.</p>
        <p className="text-xs text-gray-600 mb-6 max-w-md break-words">{String(this.state.error?.message || this.state.error)}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-lg bg-[#D90429] hover:bg-[#A50320] text-sm font-semibold transition-colors"
        >
          Muat ulang
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
