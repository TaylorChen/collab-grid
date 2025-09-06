import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export default function InviteModal({ gridId, onClose }) {
    const [email, setEmail] = useState('');
    const [permission, setPermission] = useState('write');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const handleInvite = async () => {
        if (!email.trim()) {
            setMessage('请输入邮箱地址');
            return;
        }
        // 简单的邮箱格式验证
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setMessage('请输入有效的邮箱地址');
            return;
        }
        setIsLoading(true);
        setMessage('');
        try {
            // 获取token - 从userStore的存储格式中获取
            let token = null;
            try {
                const authData = localStorage.getItem('collabgrid_auth');
                if (authData) {
                    const parsed = JSON.parse(authData);
                    token = parsed.token;
                }
            }
            catch (e) {
                console.error('Failed to parse auth data:', e);
            }
            const apiBase = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
            if (!token) {
                setMessage('请先登录再邀请协作者');
                return;
            }
            console.log('👥 直接调用邀请API:', {
                gridId,
                email,
                permission,
                hasToken: !!token,
                tokenLength: token?.length,
                tokenPreview: token ? `${token.substring(0, 10)}...` : 'null',
                apiBase
            });
            const res = await fetch(`${apiBase}/api/grids/${gridId}/collaborators`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, permission })
            });
            const response = await res.json();
            console.log('👥 邀请API响应:', { status: res.status, response });
            if (res.ok && response.success) {
                setMessage(response.message || '邀请发送成功！');
                setTimeout(() => {
                    onClose();
                }, 2000);
            }
            else {
                // 处理错误响应，优先显示服务器返回的错误信息
                const errorMessage = response.error || `请求失败 (${res.status}: ${res.statusText})`;
                setMessage(errorMessage);
            }
        }
        catch (error) {
            console.error('邀请失败:', error);
            setMessage(error.message || '邀请发送失败，请重试');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleInvite();
        }
        else if (e.key === 'Escape') {
            onClose();
        }
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl w-96 max-w-90vw", children: [_jsxs("div", { className: "flex items-center justify-between p-6 border-b border-gray-200", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-800", children: "\uD83D\uDC65 \u9080\u8BF7\u534F\u4F5C\u8005" }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600 text-xl", children: "\u2715" })] }), _jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "\u90AE\u7BB1\u5730\u5740" }), _jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value), onKeyDown: handleKeyDown, placeholder: "\u8BF7\u8F93\u5165\u534F\u4F5C\u8005\u7684\u90AE\u7BB1\u5730\u5740", className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent", autoFocus: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "\u6743\u9650\u8BBE\u7F6E" }), _jsxs("select", { value: permission, onChange: (e) => setPermission(e.target.value), className: "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500", children: [_jsx("option", { value: "write", children: "\uD83D\uDCDD \u53EF\u7F16\u8F91 - \u53EF\u4EE5\u67E5\u770B\u548C\u7F16\u8F91\u8868\u683C" }), _jsx("option", { value: "read", children: "\uD83D\uDC41\uFE0F \u53EA\u8BFB - \u53EA\u80FD\u67E5\u770B\u8868\u683C\u5185\u5BB9" })] })] }), message && (_jsx("div", { className: `p-3 rounded-md text-sm ${message.includes('成功')
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-red-50 text-red-700 border border-red-200'}`, children: message })), _jsx("div", { className: "text-xs text-gray-500", children: "\uD83D\uDCA1 \u63D0\u793A\uFF1A\u88AB\u9080\u8BF7\u7684\u7528\u6237\u5FC5\u987B\u5DF2\u7ECF\u6CE8\u518C\u8D26\u53F7\uFF0C\u7CFB\u7EDF\u5C06\u6839\u636E\u90AE\u7BB1\u5730\u5740\u67E5\u627E\u7528\u6237\u3002" })] }), _jsxs("div", { className: "flex items-center justify-end gap-3 p-6 border-t border-gray-200", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50", disabled: isLoading, children: "\u53D6\u6D88" }), _jsx("button", { onClick: handleInvite, disabled: isLoading || !email.trim(), className: "px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed", children: isLoading ? '发送中...' : '发送邀请' })] })] }) }));
}
