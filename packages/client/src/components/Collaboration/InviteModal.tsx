import React, { useState } from 'react';

interface InviteModalProps {
  gridId: string;
  onClose: () => void;
}

export default function InviteModal({ gridId, onClose }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'read' | 'write'>('write');
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
      let token: string | null = null;
      try {
        const authData = localStorage.getItem('collabgrid_auth');
        if (authData) {
          const parsed = JSON.parse(authData);
          token = parsed.token;
        }
      } catch (e) {
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
      } else {
        // 处理错误响应，优先显示服务器返回的错误信息
        const errorMessage = response.error || `请求失败 (${res.status}: ${res.statusText})`;
        setMessage(errorMessage);
      }
    } catch (error: any) {
      console.error('邀请失败:', error);
      setMessage(error.message || '邀请发送失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInvite();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-96 max-w-90vw">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            👥 邀请协作者
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ✕
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              邮箱地址
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请输入协作者的邮箱地址"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              权限设置
            </label>
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as 'read' | 'write')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="write">📝 可编辑 - 可以查看和编辑表格</option>
              <option value="read">👁️ 只读 - 只能查看表格内容</option>
            </select>
          </div>

          {message && (
            <div className={`p-3 rounded-md text-sm ${
              message.includes('成功') 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <div className="text-xs text-gray-500">
            💡 提示：被邀请的用户必须已经注册账号，系统将根据邮箱地址查找用户。
          </div>
        </div>

        {/* 按钮区 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={isLoading}
          >
            取消
          </button>
          <button
            onClick={handleInvite}
            disabled={isLoading || !email.trim()}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '发送中...' : '发送邀请'}
          </button>
        </div>
      </div>
    </div>
  );
}
