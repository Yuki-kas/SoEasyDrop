/**
 * 文件上传器类
 * 处理文件上传、预览、加密等功能
 */
class FileUploader {
    /**
     * 构造函数：初始化文件上传器
     */
    constructor() {
        // DOM 元素初始化
        this.dropZone = document.getElementById('dropZone');          // 拖拽区域
        this.fileInput = document.getElementById('fileInput');        // 文件输入框
        this.qrSection = document.getElementById('qrSection');        // 二维码区域
        this.fileInfo = document.getElementById('fileInfo');          // 文件信息显示区域
        this.expirySelect = document.getElementById('expiryTime');    // 过期时间选择器
        
        // 上传队列管理
        this.uploadQueue = [];                    // 待上传文件队列
        this.currentUploads = 0;                  // 当前正在上传的文件数
        this.maxSimultaneousUploads = 3;         // 最大同时上传数量
        
        // 重新上传按钮
        this.resetButton = document.getElementById('resetButton');
        
        // Web Crypto API 用于文件加密
        this.crypto = window.crypto.subtle;
        
        // 上传速度计算相关
        this.uploadStartTimes = new Map();        // 存储每个文件的上传开始时间
        this.uploadedSizes = new Map();           // 存储每个文件的已上传大小
        this.lastUpdateTimes = new Map();         // 存储上次更新时间
        
        // 初始化组件和事件监听
        this.createProgressContainer();
        this.initializeEventListeners();
    }

    /**
     * 创建进度条容器
     * 用于显示文件上传进度
     */
    createProgressContainer() {
        this.progressContainer = document.createElement('div');
        this.progressContainer.className = 'progress-container';
        this.progressContainer.style.display = 'none';
        this.dropZone.appendChild(this.progressContainer);
    }

    /**
     * 为单个文件创建进度条
     * @param {File} file - 要上传的文件对象
     * @returns {Object} 包含进度条相关DOM元素的对象
     */
    createProgressBar(file) {
        // 创建进度条包装器
        const progressWrapper = document.createElement('div');
        progressWrapper.className = 'progress-wrapper';
        
        // 创建文件名显示
        const fileNameDiv = document.createElement('div');
        fileNameDiv.className = 'file-name';
        fileNameDiv.textContent = file.name;
        
        // 创建进度条
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        
        // 创建进度文本
        const progressText = document.createElement('div');
        progressText.className = 'progress-text';
        progressText.textContent = '0%';
        
        // 组装进度条组件
        progressWrapper.appendChild(fileNameDiv);
        progressWrapper.appendChild(progressBar);
        progressWrapper.appendChild(progressText);
        this.progressContainer.appendChild(progressWrapper);
        
        return { progressBar, progressText, progressWrapper };
    }

    /**
     * 初始化所有事件监听器
     * 包括拖拽、点击上传和重新上传按钮事件
     */
    initializeEventListeners() {
        // 拖拽相关事件
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('drag-over');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files);
            if (files.length) {
                this.handleFiles(files);
            }
        });

        // 点击上传事件
        this.dropZone.addEventListener('click', (e) => {
            // 如果点击的是 expiry-selector 或其子元素，不触发文件选择
            if (!e.target.closest('.expiry-selector')) {
                this.fileInput.click();
            }
        });

        // 启用多文件选择
        this.fileInput.setAttribute('multiple', '');
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                this.handleFiles(Array.from(e.target.files));
            }
        });

        // 重新上传按钮事件
        this.resetButton.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止触发 dropZone 的点击事件
            this.resetForNewUpload();
        });

        // 为下拉框添加交互效果（添加空值检查）
        if (this.expirySelect) {
            this.expirySelect.addEventListener('change', (e) => {
                e.stopPropagation();
                // 可以在这里添加选择后的效果
            });
        }

        // 防止事件冒泡（添加空值检查）
        const expirySelector = document.querySelector('.expiry-selector');
        if (expirySelector) {
            expirySelector.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
        }
    }

    /**
     * 处理选中的文件
     * @param {File[]} files - 用户选择的文件数组
     */
    handleFiles(files) {
        // 显示进度条容器
        this.progressContainer.style.display = 'block';
        const dropZoneContent = this.dropZone.querySelector('.drop-zone-content');
        if (dropZoneContent) {
            dropZoneContent.style.display = 'none';
        }
        
        // 显示重新上传按钮
        this.resetButton.style.display = 'flex';
        
        // 清除之前的上传记录（如果没有正在进行的上传）
        if (this.uploadQueue.length === 0 && this.currentUploads === 0) {
            this.progressContainer.innerHTML = '';
        }
        
        // 为每个文件创建进度条并添加到上传队列
        files.forEach(file => {
            this.uploadQueue.push({
                file,
                ...this.createProgressBar(file)
            });
        });
        
        // 开始处理上传队列
        this.processQueue();
    }

    /**
     * 处理上传队列
     * 控制同时上传的文件数量
     */
    async processQueue() {
        // 当队列中有文件且未达到最大同时上传数时，继续上传
        while (this.uploadQueue.length > 0 && this.currentUploads < this.maxSimultaneousUploads) {
            const upload = this.uploadQueue.shift();
            this.currentUploads++;
            await this.uploadFile(upload);
            this.currentUploads--;
        }
        
        // 检查是否所有文件都已上传完成
        if (this.uploadQueue.length === 0 && this.currentUploads === 0) {
            // 检查是否所有文件都上传成功
            const allUploadsSuccessful = Array.from(this.progressContainer.children)
                .every(wrapper => wrapper.querySelector('.file-success'));
            
            if (allUploadsSuccessful) {
                this.fileInput.value = ''; // 重置文件输入框
            }
        } else if (this.uploadQueue.length > 0) {
            this.processQueue(); // 继续处理队列
        }
    }

    /**
     * 上传单个文件
     * @param {Object} param0 - 包含文件和进度条元素的对象
     * @param {File} param0.file - 要上传的文件
     * @param {HTMLElement} param0.progressBar - 进度条元素
     * @param {HTMLElement} param0.progressText - 进度文本元素
     * @param {HTMLElement} param0.progressWrapper - 进度��容器元素
     */
    async uploadFile({ file, progressBar, progressText, progressWrapper }) {
        try {
            // 加密文件
            const { file: encryptedFile, key, iv, isText } = await this.encryptFile(file);
            const formData = new FormData();
            formData.append('files', encryptedFile);
            formData.append('isText', isText);
            // 添加过期时间（添加空值检查）
            if (this.expirySelect) {
                formData.append('expiryHours', this.expirySelect.value);
            } else {
                formData.append('expiryHours', '24'); // 默认24小时
            }

            // 创建 XMLHttpRequest 对象用于文件上传
            const xhr = new XMLHttpRequest();
            const uploadId = Date.now().toString(); // 生成唯一的上传ID
            
            // 初始化上传状态，用于计算上传速度
            this.uploadStartTimes.set(uploadId, Date.now());
            this.uploadedSizes.set(uploadId, 0);
            this.lastUpdateTimes.set(uploadId, Date.now());

            // 监听上传进度
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = (event.loaded / event.total) * 100;
                    const speed = this.calculateSpeed(uploadId, event.loaded);
                    this.updateProgress(percent, progressBar, progressText, speed);
                    this.uploadedSizes.set(uploadId, event.loaded);
                }
            };

            // 发送上传请求
            const response = await new Promise((resolve, reject) => {
                xhr.onload = () => {
                    // 清理上传状态
                    this.uploadStartTimes.delete(uploadId);
                    this.uploadedSizes.delete(uploadId);
                    this.lastUpdateTimes.delete(uploadId);

                    if (xhr.status === 200) {
                        resolve(JSON.parse(xhr.response));
                    } else {
                        reject(new Error('Upload failed'));
                    }
                };
                xhr.onerror = () => reject(new Error('Upload failed'));
                
                xhr.open('POST', '/upload', true);
                xhr.send(formData);
            });

            // 处理上传成功的响应
            if (response.success) {
                this.updateProgress(100, progressBar, progressText, '完成');
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 添加加密参数到URL
                const fileInfo = response.files[0];
                fileInfo.downloadUrl = `${fileInfo.downloadUrl}#key=${key}&iv=${iv}`;
                fileInfo.previewUrl = `${fileInfo.previewUrl}#key=${key}&iv=${iv}`;
                fileInfo.isText = isText;
                
                // 显示文件信息和下载选项
                this.showFileSuccess(fileInfo, progressWrapper);
            }
        } catch (error) {
            console.error('Upload failed:', error);
            progressWrapper.classList.add('upload-error');
            progressText.textContent = '上传失败';
        }
    }

    /**
     * 生成加密密钥
     * 使用 AES-GCM 算法生成 256 位密钥
     * @returns {Promise<CryptoKey>} 生成的加密密钥
     */
    async generateEncryptionKey() {
        return await this.crypto.generateKey(
            {
                name: "AES-GCM",
                length: 256
            },
            true,  // 可导出，用于生成分享链接
            ["encrypt", "decrypt"]  // 允许加密和解密操作
        );
    }

    /**
     * 加密文件
     * @param {File} file - 要加密的文件
     * @returns {Promise<Object>} 包含加密文件和密钥信息的对象
     */
    async encryptFile(file) {
        try {
            const key = await this.generateEncryptionKey();
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            
            // 判断是否为文本文件
            const isTextFile = file.type.includes('text') || 
                             file.name.toLowerCase().endsWith('.txt') ||
                             file.type === 'application/json' ||
                             file.type === '';

            // 处理文本文件
            let arrayBuffer;
            if (isTextFile) {
                const text = await file.text();
                const encoder = new TextEncoder();
                arrayBuffer = encoder.encode(text).buffer;
            } else {
                arrayBuffer = await file.arrayBuffer();
            }

            // 加密数据
            const encryptedData = await this.crypto.encrypt(
                {
                    name: "AES-GCM",
                    iv: iv,
                    tagLength: 128
                },
                key,
                arrayBuffer
            );

            // 导出密钥并转换为Base64格式
            const exportedKey = await this.crypto.exportKey("raw", key);
            const keyBase64 = this.arrayBufferToBase64(exportedKey);
            const ivBase64 = this.arrayBufferToBase64(iv);

            // 创建加密后的文件对象
            const encryptedFile = new File([encryptedData], file.name, {
                type: isTextFile ? 'text/plain' : file.type
            });

            return {
                file: encryptedFile,
                key: keyBase64,
                iv: ivBase64,
                isText: isTextFile
            };
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('File encryption failed');
        }
    }

    /**
     * 将 ArrayBuffer 转换为 Base64 字符串
     * @param {ArrayBuffer} buffer - 要转换的 ArrayBuffer
     * @returns {string} Base64 编码的字符串
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        return btoa(String.fromCharCode.apply(null, bytes))
            .replace(/\+/g, '-')  // URL 安全的 Base64
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    /**
     * 计算上传速度
     * @param {string} uploadId - 上传ID
     * @param {number} currentSize - 当前上传的字节数
     * @returns {string|null} 格式化的速度字符串或 null
     */
    calculateSpeed(uploadId, currentSize) {
        const now = Date.now();
        const lastSize = this.uploadedSizes.get(uploadId) || 0;
        const lastTime = this.lastUpdateTimes.get(uploadId);
        const timeDiff = now - lastTime;
        
        if (timeDiff < 1000) return null; // 每秒更新一次

        const sizeDiff = currentSize - lastSize;
        const speedBps = (sizeDiff * 1000) / timeDiff;
        
        this.lastUpdateTimes.set(uploadId, now);
        
        return this.formatSpeed(speedBps);
    }

    /**
     * 格式化速度显示
     * @param {number} speedBps - 每秒传输的字节数
     * @returns {string} 格式化的速度字符串
     */
    formatSpeed(speedBps) {
        if (speedBps === null) return '';
        
        if (speedBps < 1024) {
            return `${speedBps.toFixed(1)} B/s`;
        } else if (speedBps < 1024 * 1024) {
            return `${(speedBps / 1024).toFixed(1)} KB/s`;
        } else {
            return `${(speedBps / (1024 * 1024)).toFixed(1)} MB/s`;
        }
    }

    /**
     * 更新上传进度
     * @param {number} percent - 上传进度百分比
     * @param {HTMLElement} progressBar - 进度条元素
     * @param {HTMLElement} progressText - 进度文本元素
     * @param {string} speed - 上传速度
     */
    updateProgress(percent, progressBar, progressText, speed) {
        const roundedPercent = Math.round(percent);
        progressBar.style.width = `${roundedPercent}%`;
        
        // 显示进度和速度
        if (speed) {
            progressText.innerHTML = `${roundedPercent}% <span class="upload-speed">${speed}</span>`;
        } else {
            progressText.textContent = `${roundedPercent}%`;
        }
    }

    /**
     * 显示文件上传成功信息
     * @param {Object} fileInfo - 文件信息对象
     * @param {HTMLElement} progressWrapper - 进度条容器元素
     */
    showFileSuccess(fileInfo, progressWrapper) {
        // 计算过期时间
        const expiryDate = new Date(Date.now() + fileInfo.expiryHours * 60 * 60 * 1000);
        const expiryString = expiryDate.toLocaleString();

        progressWrapper.innerHTML = `
            <div class="file-success">
                <div class="file-name-wrapper">
                    <div class="file-name">${fileInfo.originalName}</div>
                    ${fileInfo.originalName.length > 30 ? 
                        `<div class="file-name-tooltip">${fileInfo.originalName}</div>` : 
                        ''}
                        (<span class="file-size">${this.formatFileSize(fileInfo.size)}</span>)
                </div>
                <div class="file-info-group">
                    <div class="expiry-info">
                        过期时间：${expiryString}
                    </div>
                </div>
                <div class="qr-code" id="qr-${encodeURIComponent(fileInfo.downloadUrl)}"></div>
                <div class="action-buttons">
                    <button class="preview-button" onclick="event.stopPropagation(); window.previewFile('${fileInfo.previewUrl}', '${fileInfo.type}', '${fileInfo.originalName}')">
                        <svg class="preview-icon" viewBox="0 0 24 24">
                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                        </svg>
                        预览
                    </button>
                    <a href="${fileInfo.downloadUrl}" target="_blank" class="download-link" onclick="event.stopPropagation()">
                        <svg class="download-icon" viewBox="0 0 24 24">
                            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                        </svg>
                        下载
                    </a>
                </div>
            </div>
        `;
        
        // 生成二维码
        try {
            new QRCode(document.getElementById(`qr-${encodeURIComponent(fileInfo.downloadUrl)}`), {
                text: fileInfo.downloadUrl,
                width: 80,
                height: 80,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H,
                margin: 2
            });
        } catch (error) {
            console.error('QR Code generation failed:', error);
        }
    }

    /**
     * 重置上传界面
     */
    resetForNewUpload() {
        // 清除所有进度条
        this.progressContainer.innerHTML = '';
        this.progressContainer.style.display = 'none';
        
        // 隐藏重新上传按钮
        this.resetButton.style.display = 'none';
        
        // 重新显示上传区域
        const dropZoneContent = this.dropZone.querySelector('.drop-zone-content');
        if (dropZoneContent) {
            dropZoneContent.style.display = 'block';
        }
        
        // 重置文件输入框
        this.fileInput.value = '';
        
        // 重置上传队列
        this.uploadQueue = [];
        this.currentUploads = 0;
    }

    /**
     * 格式化文件大小显示
     * @param {number} bytes - 文件大小（字节）
     * @returns {string} 格式化后的文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 初始化上传器
new FileUploader();

/**
 * 文件预览功能
 * @param {string} previewUrl - 预览URL
 * @param {string} fileType - 文件类型
 * @param {string} fileName - 文件名
 */
window.previewFile = async (previewUrl, fileType, fileName) => {
    try {
        // 从URL中提取加密参数
        const [url, hash] = previewUrl.split('#');
        if (!hash) {
            throw new Error('Missing encryption parameters');
        }

        const params = new URLSearchParams(hash);
        const key = params.get('key');
        const iv = params.get('iv');

        if (!key || !iv) {
            throw new Error('Invalid encryption parameters');
        }

        // 获取加密文件
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch file');
        }

        // 解密文件
        const encryptedData = await response.arrayBuffer();
        const decryptedData = await decryptFile(encryptedData, key, iv);

        // 创建预览内容
        const modal = document.createElement('div');
        modal.className = 'preview-modal';
        
        let previewContent = '';
        let mediaType = '';

        // 根据文件类型生成预览内容
        switch (fileType) {
            case 'image':
                mediaType = 'image/jpeg';
                previewContent = `<img src="${createObjectURL(decryptedData, mediaType)}" alt="${fileName}">`;
                break;
            case 'audio':
                mediaType = getAudioMimeType(fileName);
                previewContent = `
                    <div class="audio-preview">
                        <audio controls>
                            <source src="${createObjectURL(decryptedData, mediaType)}" type="${mediaType}">
                            您的浏览器不支持音频预览
                        </audio>
                        <p class="audio-name">${fileName}</p>
                    </div>`;
                break;
            case 'video':
                mediaType = getVideoMimeType(fileName);
                previewContent = `
                    <div class="video-preview">
                        <video controls>
                            <source src="${createObjectURL(decryptedData, mediaType)}" type="${mediaType}">
                            您的浏览器不支持视频预览
                        </video>
                    </div>`;
                break;
            case 'pdf':
                mediaType = 'application/pdf';
                previewContent = `
                    <iframe src="${createObjectURL(decryptedData, mediaType)}" type="application/pdf">
                        <p>您的浏览器不支持PDF预览，<a href="${createObjectURL(decryptedData, mediaType)}" target="_blank">点击下载</a></p>
                    </iframe>`;
                break;
            case 'text':
                try {
                    const decoder = new TextDecoder('utf-8', { fatal: true });
                    const text = decoder.decode(decryptedData);
                    previewContent = `
                        <div class="text-preview">
                            <pre>${escapeHtml(text)}</pre>
                        </div>`;
                } catch (error) {
                    throw new Error('文本解码失败，可能不是有效的文本文件');
                }
                break;
            default:
                previewContent = `<div class="no-preview">该文件类型暂不支持预</div>`;
        }

        // 创建预览模态框
        modal.innerHTML = `
            <div class="preview-content">
                <div class="preview-header">
                    <span class="preview-title">${fileName}</span>
                    <button class="close-preview">&times;</button>
                </div>
                <div class="preview-body">
                    ${previewContent}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // 添加关闭事件
        const cleanup = () => {
            document.body.removeChild(modal);
            // 清理创建的 URL
            const mediaElement = modal.querySelector('audio, video, img, iframe');
            if (mediaElement && mediaElement.src) {
                URL.revokeObjectURL(mediaElement.src);
            }
        };

        modal.querySelector('.close-preview').onclick = cleanup;
        modal.onclick = (e) => {
            if (e.target === modal) {
                cleanup();
            }
        };
    } catch (error) {
        console.error('Preview failed:', error);
        alert(`文件预览失败: ${error.message}`);
    }
};

/**
 * 创建媒体URL
 * @param {ArrayBuffer} data - 解密后的文件数据
 * @param {string} mimeType - MIME类型
 * @returns {string} 媒体URL
 */
function createObjectURL(data, mimeType) {
    const blob = new Blob([data], { type: mimeType });
    return URL.createObjectURL(blob);
}

/**
 * HTML转义
 * @param {string} unsafe - 不安全的HTML字符串
 * @returns {string} 转义后的安全字符串
 */
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * 解密文件数据
 * @param {ArrayBuffer} encryptedData - 加密的文件数据
 * @param {string} keyBase64 - Base64 编码的密钥
 * @param {string} ivBase64 - Base64 编码的初始化向量
 * @returns {Promise<ArrayBuffer>} 解密后的文件数据
 */
async function decryptFile(encryptedData, keyBase64, ivBase64) {
    try {
        const crypto = window.crypto.subtle;
        
        // 将 Base64 转换回 ArrayBuffer
        const keyData = base64ToArrayBuffer(keyBase64);
        const iv = base64ToArrayBuffer(ivBase64);

        // 导入密钥
        const key = await crypto.importKey(
            "raw",
            keyData,
            "AES-GCM",
            true,
            ["decrypt"]
        );

        // 解密数据
        const decryptedData = await crypto.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
                tagLength: 128
            },
            key,
            encryptedData
        );

        return decryptedData;
    } catch (error) {
        console.error('Decryption error:', error);
        if (error.name === 'OperationError') {
            throw new Error('解密失败：密钥或数据可能已损坏');
        }
        throw new Error('文件解密失败');
    }
}

/**
 * Base64 转 ArrayBuffer
 * @param {string} base64 - Base64 编码的字符串
 * @returns {ArrayBuffer} 转换后的 ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
    // 还原 URL 安全的 Base64
    base64 = base64
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    
    // 添加回填充字符
    while (base64.length % 4) {
        base64 += '=';
    }

    try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    } catch (error) {
        console.error('Base64 decode error:', error);
        throw new Error('Invalid encryption key');
    }
}

/**
 * 获取音频文件的MIME类型
 * @param {string} fileName - 文件名
 * @returns {string} MIME类型
 */
function getAudioMimeType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const mimeTypes = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'm4a': 'audio/mp4',
        'aac': 'audio/aac'
    };
    return mimeTypes[ext] || 'audio/mpeg';
}

/**
 * 获取视频文件的MIME类型
 * @param {string} fileName - 文件名
 * @returns {string} MIME类型
 */
function getVideoMimeType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const mimeTypes = {
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'ogg': 'video/ogg',
        'mov': 'video/quicktime'
    };
    return mimeTypes[ext] || 'video/mp4';
} 