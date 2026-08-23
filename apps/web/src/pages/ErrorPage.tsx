import { AlertTriangle, RefreshCw } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

export function ErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.status === 404
      ? '这个页面不存在。'
      : '页面暂时无法打开。'
    : '页面暂时无法打开。';
  return (
    <main className="empty-state" id="main-content">
      <AlertTriangle size={36} aria-hidden="true" />
      <h1>{message}</h1>
      <p>可以返回游戏首页，或刷新后再试一次。</p>
      <a className="btn-primary" href="/">
        <RefreshCw size={18} /> 返回首页
      </a>
    </main>
  );
}
