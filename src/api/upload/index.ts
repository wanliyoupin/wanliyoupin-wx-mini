import { projectConfig } from '@/project-config';

/**
 * 获取七牛云上传凭证
 * @param apiBaseUrl 后端 API 地址（可选，默认从 project-config 的 apiBaseUrl 读取）
 * @returns 上传凭证和配置信息
 */
export const get_upload_token = async (
  apiBaseUrl?: string
): Promise<{
  token: string;
  bucket: string;
  baseUrl?: string;
  dirPath?: string;
  uploadUrl: string;
}> => {
  const API_BASE_URL = apiBaseUrl ?? projectConfig.apiBaseUrl;
  
  const response = await uni.request({
    url: `${API_BASE_URL}/api/qiniu-upload/token`,
    method: 'GET',
    header: {
      'Content-Type': 'application/json',
    },
  });

  console.log('获取 token 响应:', {
    statusCode: response.statusCode,
    data: response.data,
  });

  const data = response.data as {
    success: boolean;
    message?: string;
    data: {
      token: string;
      bucket: string;
      baseUrl?: string;
      dirPath?: string;
      uploadUrl: string;
    };
  };

  if (response.statusCode !== 200 || !data?.success) {
    const errorMsg = data?.message || `获取上传凭证失败 (HTTP ${response.statusCode})`;
    console.error('获取 token 失败:', errorMsg, data);
    throw new Error(errorMsg);
  }

  if (!data.data?.token) {
    throw new Error('获取的上传凭证无效：token 为空');
  }

  return data.data;
};

/** 从路径中解析文件后缀（若有） */
function getExtensionFromPath(path: string): string {
  const match = path.match(/\.([a-zA-Z0-9]+)$/);
  return match ? '.' + match[1].toLowerCase() : '';
}

/** 规范化后缀：保证以 . 开头 */
function normalizeExt(ext: string | undefined): string {
  if (!ext) return '';
  const s = ext.trim().toLowerCase();
  return s.startsWith('.') ? s : '.' + s;
}

/**
 * 上传文件到七牛云（带进度）
 * @param filePath 文件路径
 * @param token 上传凭证
 * @param key 文件 key
 * @param uploadUrl 上传地址
 * @param onProgress 进度回调
 * @returns 上传结果
 */
/**
 * 上传文件（便捷方法）
 * @param filePath 本地临时路径
 * @param onProgress 进度回调（可选）
 * @param ext 文件后缀（可选，如 '.jpg' / 'mp4'），不传则尝试从 filePath 解析，保证返回的 URL 带后缀
 */
/** 无后缀时的默认后缀（多数上传为图片） */
const DEFAULT_SUFFIX = '.jpg';

export const uploadFile = async (
  filePath: string,
  onProgress?: (progress: number) => void,
  ext?: string
): Promise<string> => {
  const tokenInfo = await get_upload_token();
  const suffix = normalizeExt(ext) || getExtensionFromPath(filePath) || DEFAULT_SUFFIX;
  const key = `${tokenInfo.dirPath || ''}${Date.now()}_${Math.random().toString(36).substr(2, 9)}${suffix}`;
  const result = await upload_to_qiniu(filePath, tokenInfo.token, key, tokenInfo.uploadUrl, onProgress);
  if (tokenInfo.baseUrl) {
    const base = tokenInfo.baseUrl.replace(/\/$/, '');
    return `${base}/${result.key}`;
  }
  return result.key;
};

export const upload_to_qiniu = async (
  filePath: string,
  token: string,
  key: string,
  uploadUrl: string,
  onProgress?: (progress: number) => void
): Promise<{ url?: string; key: string }> => {
  return new Promise((resolve, reject) => {
    // 微信小程序等平台需在 UploadTask 上监听进度，不能通过 options 传入
    const uploadTask = uni.uploadFile({
      url: uploadUrl,
      filePath,
      name: 'file', // 七牛云上传接口要求文件字段名为 'file'
      formData: {
        token,
        key, // 文件在七牛云中的 key
      },
      success: (res) => {
        console.log('上传响应:', {
          statusCode: res.statusCode,
          data: res.data,
        });

        // 检查状态码
        if (res.statusCode !== 200) {
          try {
            const errorData = JSON.parse(res.data as string);
            const errorMsg =
              errorData.error ||
              errorData.message ||
              errorData.error_code ||
              `上传失败：HTTP ${res.statusCode}`;
            console.error('上传失败:', errorData);
            reject(new Error(errorMsg));
          } catch {
            reject(new Error(`上传失败：HTTP ${res.statusCode}`));
          }
          return;
        }

        try {
          const data = JSON.parse(res.data as string);
          console.log('解析后的响应数据:', data);
          
          // 七牛云成功响应会返回 { key: "xxx", hash: "xxx" } 格式
          if (data.key) {
            resolve({
              key: data.key,
              url: data.key, // 可以根据 baseUrl 拼接完整 URL
            });
          } else if (data.error) {
            // 处理错误响应
            const errorMsg = data.error || data.error_code || '上传失败';
            console.error('七牛云返回错误:', data);
            reject(new Error(errorMsg));
          } else {
            console.error('响应数据格式异常:', data);
            reject(new Error('上传失败：响应数据异常'));
          }
        } catch (error) {
          // 如果解析失败，可能是响应格式不对
          console.error('解析响应失败:', res.data, error);
          reject(new Error('解析响应数据失败'));
        }
      },
      fail: (error) => {
        console.error('上传请求失败:', error);
        reject(new Error(error.errMsg || '上传失败'));
      },
    });

    // 在 UploadTask 上监听进度（微信小程序等必须这样才能收到进度）
    if (onProgress && uploadTask && typeof (uploadTask as any).onProgressUpdate === 'function') {
      (uploadTask as any).onProgressUpdate((ev: { progress?: number; totalBytesSent?: number; totalBytesExpectedToSend?: number; totalBytesWritten?: number; totalBytesExpectedToWrite?: number }) => {
        let percent = 0;
        if (typeof ev.progress === 'number') {
          percent = ev.progress;
        } else if (ev.totalBytesExpectedToSend != null && ev.totalBytesExpectedToSend > 0 && ev.totalBytesSent != null) {
          percent = Math.round((ev.totalBytesSent / ev.totalBytesExpectedToSend) * 100);
        } else if (ev.totalBytesExpectedToWrite != null && ev.totalBytesExpectedToWrite > 0 && (ev as any).totalBytesWritten != null) {
          percent = Math.round(((ev as any).totalBytesWritten / ev.totalBytesExpectedToWrite) * 100);
        }
        onProgress(Math.min(100, percent));
      });
    }
  });
};
