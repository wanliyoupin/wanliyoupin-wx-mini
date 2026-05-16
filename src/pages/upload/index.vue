<template>
  <view class="container">
    <view class="upload-section">
      <view class="title">文件上传示例</view>
      <view class="tips">支持图片、视频等文件上传，使用七牛云客户端直传</view>

      <!-- 文件选择 -->
      <view class="upload-area" @click="chooseFile">
        <view v-if="!selectedFile" class="upload-placeholder">
          <text class="upload-icon">📁</text>
          <text class="upload-text">点击选择文件</text>
        </view>
        <view v-else class="file-info">
          <text class="file-name">{{ selectedFile.name }}</text>
          <text class="file-size">{{ formatFileSize(selectedFile.size) }}</text>
        </view>
      </view>

      <!-- 上传进度 -->
      <view v-if="uploading" class="progress-section">
        <view class="progress-bar">
          <view
            class="progress-fill"
            :style="{ width: uploadProgress + '%' }"
          ></view>
        </view>
        <text class="progress-text">{{ uploadProgress }}%</text>
      </view>

      <!-- 上传按钮 -->
      <button
        class="upload-btn"
        :disabled="!selectedFile || uploading"
        @click="handleUpload"
      >
        {{ uploading ? '上传中...' : '开始上传' }}
      </button>

      <!-- 上传结果 -->
      <view v-if="uploadResult" class="result-section">
        <view class="result-title">上传成功</view>
        <view class="result-item">
          <text class="result-label">文件 Key:</text>
          <text class="result-value">{{ uploadResult.key }}</text>
        </view>
        <view v-if="uploadResult.url" class="result-item">
          <text class="result-label">访问地址:</text>
          <text class="result-value">{{ uploadResult.url }}</text>
        </view>
        <view v-if="uploadResult.imageUrl" class="preview-section">
          <image
            :src="uploadResult.imageUrl"
            mode="aspectFit"
            class="preview-image"
          />
        </view>
      </view>

      <!-- 错误信息 -->
      <view v-if="errorMessage" class="error-section">
        <text class="error-text">{{ errorMessage }}</text>
      </view>
    </view>
  </view>
</template>

<script lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { get_upload_token, upload_to_qiniu } from '@/api/upload';

interface UploadResult {
  key: string;
  url?: string;
  imageUrl?: string;
}

export default {
  setup() {
    const selectedFile = ref<{ name: string; path: string; size: number } | null>(
      null
    );
    const uploading = ref(false);
    const uploadProgress = ref(0);
    const uploadResult = ref<UploadResult | null>(null);
    const errorMessage = ref('');

    // 选择文件
    const chooseFile = () => {
      // 使用 uni.chooseImage 选择图片，或使用 uni.chooseVideo 选择视频
      // 如果需要选择其他类型文件，可以使用 uni.chooseFile（需要 H5 或 App 环境）
      uni.chooseImage({
        count: 1,
        sizeType: ['original'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const files = Array.isArray(res.tempFiles) ? res.tempFiles : [res.tempFiles];
          const file = files[0];
          if (file && 'path' in file) {
            const filePath = file.path;
            selectedFile.value = {
              name: `image_${Date.now()}.${filePath.split('.').pop() || 'jpg'}`,
              path: filePath,
              size: file.size || 0,
            };
            uploadResult.value = null;
            errorMessage.value = '';
          }
        },
        fail: (error) => {
          console.error('选择文件失败:', error);
          uni.showToast({
            title: '选择文件失败',
            icon: 'none',
          });
        },
      });
    };

    // 格式化文件大小
    const formatFileSize = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    // 生成文件 key
    const generateKey = (filename: string, dirPath?: string): string => {
      const ext = filename?.split('.').pop() || 'file';
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const path = dirPath || '';
      return `${path}${timestamp}-${random}.${ext}`;
    };

    // 处理上传
    const handleUpload = async () => {
      if (!selectedFile.value) {
        uni.showToast({
          title: '请先选择文件',
          icon: 'none',
        });
        return;
      }

      uploading.value = true;
      uploadProgress.value = 0;
      errorMessage.value = '';
      uploadResult.value = null;

      try {
        // 1. 获取上传凭证
        const tokenData = await get_upload_token();
        console.log('获取上传凭证成功:', {
          bucket: tokenData.bucket,
          uploadUrl: tokenData.uploadUrl,
          dirPath: tokenData.dirPath,
          tokenLength: tokenData.token.length,
        });

        // 2. 生成文件 key（确保 key 格式正确）
        let dirPath = tokenData.dirPath || 'uploads/';
        // 确保 dirPath 以斜杠结尾，但不以斜杠开头
        if (dirPath && !dirPath.endsWith('/')) {
          dirPath = dirPath + '/';
        }
        if (dirPath.startsWith('/')) {
          dirPath = dirPath.substring(1);
        }
        
        const fileKey = generateKey(selectedFile.value.name, dirPath);

        console.log('准备上传文件:', {
          filePath: selectedFile.value.path,
          key: fileKey,
          uploadUrl: tokenData.uploadUrl,
          bucket: tokenData.bucket,
        });

        // 3. 上传文件到七牛云
        const result = await upload_to_qiniu(
          selectedFile.value.path,
          tokenData.token,
          fileKey,
          tokenData.uploadUrl,
          (progress) => {
            uploadProgress.value = progress;
          }
        );

        // 4. 处理上传结果
        const imageUrl = tokenData.baseUrl
          ? `${tokenData.baseUrl}/${result.key}`
          : result.url;

        uploadResult.value = {
          key: result.key,
          url: imageUrl,
          imageUrl: imageUrl, // 如果是图片，显示预览
        };

        uni.showToast({
          title: '上传成功',
          icon: 'success',
        });
      } catch (error) {
        console.error('上传失败:', error);
        let errorMsg = '上传失败';
        if (error instanceof Error) {
          errorMsg = error.message;
          // 针对常见错误提供更友好的提示
          if (errorMsg.includes('bad token') || errorMsg.includes('BadToken')) {
            errorMsg = '上传凭证无效，请检查后端配置（QINIU_ACCESS_KEY、QINIU_SECRET_KEY、QINIU_BUCKET）';
          } else if (errorMsg.includes('获取上传凭证失败')) {
            errorMsg = '无法获取上传凭证，请检查后端服务是否正常运行';
          }
        }
        errorMessage.value = errorMsg;
        uni.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 3000,
        });
      } finally {
        uploading.value = false;
      }
    };

    return {
      selectedFile,
      uploading,
      uploadProgress,
      uploadResult,
      errorMessage,
      chooseFile,
      formatFileSize,
      handleUpload,
    };
  },
};
</script>

<style>
.container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 32rpx;
}

.upload-section {
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
}

.title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 16rpx;
}

.tips {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 32rpx;
}

.upload-area {
  border: 2rpx dashed #ddd;
  border-radius: 12rpx;
  padding: 60rpx 32rpx;
  text-align: center;
  background: #fafafa;
  margin-bottom: 32rpx;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.upload-icon {
  font-size: 64rpx;
}

.upload-text {
  font-size: 28rpx;
  color: #666;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.file-name {
  font-size: 28rpx;
  color: #333;
  word-break: break-all;
}

.file-size {
  font-size: 24rpx;
  color: #999;
}

.progress-section {
  margin-bottom: 32rpx;
}

.progress-bar {
  width: 100%;
  height: 8rpx;
  background: #eee;
  border-radius: 4rpx;
  overflow: hidden;
  margin-bottom: 16rpx;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4caf50, #8bc34a);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 24rpx;
  color: #666;
  text-align: center;
  display: block;
}

.upload-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(90deg, #4caf50, #8bc34a);
  color: #fff;
  border-radius: 12rpx;
  font-size: 32rpx;
  border: none;
  margin-bottom: 32rpx;
}

.upload-btn[disabled] {
  background: #ccc;
  color: #999;
}

.result-section {
  margin-top: 32rpx;
  padding: 24rpx;
  background: #f0f9ff;
  border-radius: 12rpx;
}

.result-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #4caf50;
  margin-bottom: 16rpx;
}

.result-item {
  display: flex;
  margin-bottom: 12rpx;
  font-size: 24rpx;
}

.result-label {
  color: #666;
  min-width: 120rpx;
}

.result-value {
  color: #333;
  flex: 1;
  word-break: break-all;
}

.preview-section {
  margin-top: 24rpx;
  text-align: center;
}

.preview-image {
  max-width: 100%;
  max-height: 400rpx;
  border-radius: 8rpx;
}

.error-section {
  margin-top: 32rpx;
  padding: 24rpx;
  background: #fff3f3;
  border-radius: 12rpx;
}

.error-text {
  font-size: 24rpx;
  color: #f44336;
}
</style>
