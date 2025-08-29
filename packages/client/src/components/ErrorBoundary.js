import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('Error caught by ErrorBoundary:', error);
        console.error('Error Info:', errorInfo);
        this.setState({ error, errorInfo });
    }
    render() {
        if (this.state.hasError) {
            return (_jsxs("div", { className: "p-8 bg-red-50 border border-red-200 rounded-lg", children: [_jsx("h2", { className: "text-xl font-bold text-red-800 mb-4", children: "\u7EC4\u4EF6\u9519\u8BEF" }), _jsxs("div", { className: "text-red-700 mb-4", children: [_jsx("p", { className: "mb-2", children: "\u9519\u8BEF\u4FE1\u606F\uFF1A" }), _jsx("pre", { className: "bg-red-100 p-3 rounded text-sm overflow-auto", children: this.state.error?.toString() })] }), this.state.errorInfo && (_jsxs("div", { className: "text-red-700", children: [_jsx("p", { className: "mb-2", children: "\u9519\u8BEF\u5806\u6808\uFF1A" }), _jsx("pre", { className: "bg-red-100 p-3 rounded text-sm overflow-auto max-h-64", children: this.state.errorInfo.componentStack })] })), _jsx("button", { onClick: () => this.setState({ hasError: false, error: undefined, errorInfo: undefined }), className: "mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700", children: "\u91CD\u8BD5" })] }));
        }
        return this.props.children;
    }
}
export default ErrorBoundary;
