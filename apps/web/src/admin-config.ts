const fallbackAdminPath = '/review-7k3m2p';

function getAdminPath() {
  const configuredPath = import.meta.env.VITE_ADMIN_PATH?.trim() || fallbackAdminPath;
  const normalizedPath = configuredPath.startsWith('/')
    ? configuredPath.replace(/\/+$/, '')
    : `/${configuredPath.replace(/\/+$/, '')}`;

  if (!/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(normalizedPath)) {
    throw new Error('VITE_ADMIN_PATH 必须是由字母、数字、短横线或下划线组成的 URL 路径。');
  }

  return normalizedPath;
}

export const adminPath = getAdminPath();
