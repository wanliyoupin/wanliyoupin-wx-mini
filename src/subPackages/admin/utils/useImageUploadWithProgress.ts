import { ref } from 'vue';
import { uploadFile } from '@/api/upload';

/**
 * 带实时进度条的图片上传（选择 + 上传，统一进度状态）
 * 置于 admin 分包，避免主包引入
 */
export function useImageUploadWithProgress() {
  const uploading = ref(false);
  const progress = ref(0);

  function chooseAndUploadImage(options: { ext?: string } = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      uni.chooseImage({
        count: 1,
        success: async (res) => {
          const tempFilePath = res.tempFilePaths[0];
          uploading.value = true;
          progress.value = 0;
          try {
            const url = await uploadFile(
              tempFilePath,
              (p) => {
                progress.value = p;
              },
              options.ext ?? '.jpg'
            );
            resolve(url);
          } catch (err: any) {
            reject(err);
          } finally {
            uploading.value = false;
            progress.value = 0;
          }
        },
        fail: (err) => {
          reject(new Error(err.errMsg || '取消选择'));
        },
      });
    });
  }

  async function uploadWithProgress(
    filePath: string,
    ext: string
  ): Promise<string> {
    uploading.value = true;
    progress.value = 0;
    try {
      const url = await uploadFile(
        filePath,
        (p) => {
          progress.value = p;
        },
        ext
      );
      return url;
    } finally {
      uploading.value = false;
      progress.value = 0;
    }
  }

  return {
    uploading,
    progress,
    chooseAndUploadImage,
    uploadWithProgress,
  };
}
