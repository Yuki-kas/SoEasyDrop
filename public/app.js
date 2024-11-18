class FileUploader {
    constructor() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.qrSection = document.getElementById('qrSection');
        this.fileInfo = document.getElementById('fileInfo');
        this.uploadQueue = [];
        this.currentUploads = 0;
        this.maxSimultaneousUploads = 3; // 最大同时上传数
        this.resetButton = document.getElementById('resetButton');
        
        this.createProgressContainer();
        this.initializeEventListeners();
        this.crypto = window.crypto.subtle;
        this.uploadStartTimes = new Map(); // 存储每个文件的上传开始时间
        this.uploadedSizes = new Map();    // 存储每个文件的已上传大小
        this.lastUpdateTimes = new Map();  // 存储上次更新时间
    }

    createProgressContainer() {
        this.progressContainer = document.createElement('div');
        this.progressContainer.className = 'progress-container';
        this.progressContainer.style.display = 'none';
        this.dropZone.appendChild(this.progressContainer);
    }

    createProgressBar(file) {
        const progressWrapper = document.createElement('div');
        progressWrapper.className = 'progress-wrapper';
        
        const fileNameDiv = document.createElement('div');
        fileNameDiv.className = 'file-name';
        fileNameDiv.textContent = file.name;
        
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        
        const progressText = document.createElement('div');
        progressText.className = 'progress-text';
        progressText.textContent = '0%';
        
        progressWrapper.appendChild(fileNameDiv);
        progressWrapper.appendChild(progressBar);
        progressWrapper.appendChild(progressText);
        this.progressContainer.appendChild(progressWrapper);
        
        return { progressBar, progressText, progressWrapper };
    }

    initializeEventListeners() {
        // 拖拽事件
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

        // 点击上传
        this.dropZone.addEventListener('click', () => {
            this.fileInput.click();
        });

        this.fileInput.setAttribute('multiple', '');
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                this.handleFiles(Array.from(e.target.files));
            }
        });

        // 添加重新上传按钮事件
        this.resetButton.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止触发 dropZone 的点击事件
            this.resetForNewUpload();
        });
    }

    handleFiles(files) {
        this.progressContainer.style.display = 'block';
        const dropZoneContent = this.dropZone.querySelector('.drop-zone-content');
        if (dropZoneContent) {
            dropZoneContent.style.display = 'none';
        }
        
        // 显示重新上传按钮
        this.resetButton.style.display = 'flex';
        
        // 清除之前的上传记录
        if (this.uploadQueue.length === 0 && this.currentUploads === 0) {
            this.progressContainer.innerHTML = '';
        }
        
        files.forEach(file => {
            this.uploadQueue.push({
                file,
                ...this.createProgressBar(file)
            });
        });
        
        this.processQueue();
    }

    async processQueue() {
        while (this.uploadQueue.length > 0 && this.currentUploads < this.maxSimultaneousUploads) {
            const upload = this.uploadQueue.shift();
            this.currentUploads++;
            await this.uploadFile(upload);
            this.currentUploads--;
        }
        
        // 只有当所有文件都上传完成后，才考虑是否重置上传区域
        if (this.uploadQueue.length === 0 && this.currentUploads === 0) {
            // 检查是否所有文件都上传成功
            const allUploadsSuccessful = Array.from(this.progressContainer.children)
                .every(wrapper => wrapper.querySelector('.file-success'));
            
            if (allUploadsSuccessful) {
                // 不再调用 resetUploadZone
                this.fileInput.value = ''; // 只重置文件输入
            }
        } else if (this.uploadQueue.length > 0) {
            this.processQueue();
        }
    }

    async uploadFile({ file, progressBar, progressText, progressWrapper }) {
        try {
            const { file: encryptedFile, key, iv, isText } = await this.encryptFile(file);
            const formData = new FormData();
            formData.append('files', encryptedFile);
            formData.append('isText', isText);

            const xhr = new XMLHttpRequest();
            const uploadId = Date.now().toString(); // 生成唯一的上传ID
            
            // 初始化上传状态
            this.uploadStartTimes.set(uploadId, Date.now());
            this.uploadedSizes.set(uploadId, 0);
            this.lastUpdateTimes.set(uploadId, Date.now());

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = (event.loaded / event.total) * 100;
                    const speed = this.calculateSpeed(uploadId, event.loaded);
                    this.updateProgress(percent, progressBar, progressText, speed);
                    this.uploadedSizes.set(uploadId, event.loaded);
                }
            };

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

            if (response.success) {
                this.updateProgress(100, progressBar, progressText, '完成');
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const fileInfo = response.files[0];
                fileInfo.downloadUrl = `${fileInfo.downloadUrl}#key=${key}&iv=${iv}`;
                fileInfo.previewUrl = `${fileInfo.previewUrl}#key=${key}&iv=${iv}`;
                fileInfo.isText = isText;
                
                this.showFileSuccess(fileInfo, progressWrapper);
            }
        } catch (error) {
            console.error('Upload failed:', error);
            progressWrapper.classList.add('upload-error');
            progressText.textContent = '上传失败';
        }
    }

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

    resetUploadZone() {
        // 清除所有进度条
        this.progressContainer.innerHTML = '';
        this.progressContainer.style.display = 'none';
        
        // 重新显示上传区域
        const dropZoneContent = this.dropZone.querySelector('.drop-zone-content');
        if (dropZoneContent) {
            dropZoneContent.style.display = 'block';
        }
        
        // 重置文件输入
        this.fileInput.value = '';
    }

    showQRCode(downloadUrl) {
        // 清除之前的二维码（如果存在）
        const qrcodeElement = document.getElementById('qrcode');
        qrcodeElement.innerHTML = '';
        
        try {
            if (typeof QRCode === 'undefined') {
                throw new Error('QRCode library not loaded');
            }
            
            new QRCode(qrcodeElement, {
                text: downloadUrl,
                width: 128,
                height: 128,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
            this.qrSection.style.display = 'block';
        } catch (error) {
            console.error('QR Code generation failed:', error);
            // 显示备选方案
            qrcodeElement.innerHTML = `
                <div style="padding: 1rem;">
                    <p>下载链接：</p>
                    <a href="${downloadUrl}" target="_blank">${downloadUrl}</a>
                </div>
            `;
            this.qrSection.style.display = 'block';
        }
    }

    showFileInfo(file) {
        const size = this.formatFileSize(file.size);
        this.fileInfo.innerHTML = `
            <p>文件名：${file.name}</p>
            <p>大小：${size}</p>
            <p>链接有效期：24小时</p>
        `;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showFileSuccess(fileInfo, progressWrapper) {
        progressWrapper.innerHTML = `
            <div class="file-success">
                <div class="file-name-wrapper">
                    <div class="file-name">${fileInfo.originalName}</div>
                    ${fileInfo.originalName.length > 30 ? 
                        `<div class="file-name-tooltip">${fileInfo.originalName}</div>` : 
                        ''}
                </div>
                <div class="file-size">${this.formatFileSize(fileInfo.size)}</div>
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

    // 添加新方法用于重新开始上传
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
        
        // 重置文件输入
        this.fileInput.value = '';
        
        // 重置上传队列
        this.uploadQueue = [];
        this.currentUploads = 0;
    }

    // 生成加密密钥
    async generateEncryptionKey() {
        return await this.crypto.generateKey(
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );
    }

    // 加密文件
    async encryptFile(file) {
        try {
            const key = await this.generateEncryptionKey();
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            
            let arrayBuffer;
            const isTextFile = file.type.includes('text') || 
                              file.name.toLowerCase().endsWith('.txt') ||
                              file.type === 'application/json' ||
                              file.type === '';  // 处理无类型的文本文件

            if (isTextFile) {
                const text = await file.text();
                const encoder = new TextEncoder();
                arrayBuffer = encoder.encode(text).buffer;
            } else {
                arrayBuffer = await file.arrayBuffer();
            }

            const encryptedData = await this.crypto.encrypt(
                {
                    name: "AES-GCM",
                    iv: iv,
                    tagLength: 128
                },
                key,
                arrayBuffer
            );

            const exportedKey = await this.crypto.exportKey("raw", key);
            const keyBase64 = this.arrayBufferToBase64(exportedKey);
            const ivBase64 = this.arrayBufferToBase64(iv);

            // 确保文本文件使用正确的MIME类型
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

    // 将 ArrayBuffer 转换为 Base64
    arrayBufferToBase64(buffer) {
        // 使用 Uint8Array 来处理二进制数据
        const bytes = new Uint8Array(buffer);
        // 将字节数组转换为 Base64 字符串
        return btoa(String.fromCharCode.apply(null, bytes))
            .replace(/\+/g, '-')  // URL 安全的 Base64
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    // 添加计算速度的方法
    calculateSpeed(uploadId, currentSize) {
        const now = Date.now();
        const lastSize = this.uploadedSizes.get(uploadId) || 0;
        const lastTime = this.lastUpdateTimes.get(uploadId);
        const timeDiff = now - lastTime;
        
        if (timeDiff < 1000) return null; // 如果更新间隔小于1秒，不更新速度

        const sizeDiff = currentSize - lastSize;
        const speedBps = (sizeDiff * 1000) / timeDiff; // 字节/秒
        
        this.lastUpdateTimes.set(uploadId, now);
        
        return this.formatSpeed(speedBps);
    }

    // 添加速度格式化方法
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
}

// 修改预览函数
window.previewFile = async (previewUrl, fileType, fileName) => {
    try {
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

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch file');
        }

        const encryptedData = await response.arrayBuffer();
        const decryptedData = await decryptFile(encryptedData, key, iv);

        // 创建预览
        const modal = document.createElement('div');
        modal.className = 'preview-modal';
        
        let previewContent = '';
        let mediaType = '';

        if (fileType === 'text') {
            try {
                const decoder = new TextDecoder('utf-8', { fatal: true });
                const text = decoder.decode(decryptedData);
                previewContent = `
                    <div class="text-preview">
                        <pre>${escapeHtml(text)}</pre>
                    </div>`;
            } catch (error) {
                console.error('Text decode error:', error);
                throw new Error('文本解码失败，可能不是有效的文本文件');
            }
        } else {
            switch (fileType) {
                case 'image':
                    mediaType = 'image/jpeg';
                    previewContent = `<img src="${createObjectURL(decryptedData, mediaType)}" alt="${fileName}">`;
                    break;
                case 'audio':
                    mediaType = getAudioMimeType(fileName);
                    previewContent = `
                        <audio controls>
                            <source src="${createObjectURL(decryptedData, mediaType)}" type="${mediaType}">
                            您的浏览器不支持音频预览
                        </audio>`;
                    break;
                case 'video':
                    mediaType = getVideoMimeType(fileName);
                    previewContent = `
                        <video controls>
                            <source src="${createObjectURL(decryptedData, mediaType)}" type="${mediaType}">
                            您的浏览器不支持视频预览
                        </video>`;
                    break;
                case 'pdf':
                    mediaType = 'application/pdf';
                    const pdfUrl = createObjectURL(decryptedData, mediaType);
                    previewContent = `
                        <iframe src="${pdfUrl}" type="application/pdf" width="100%" height="100%">
                            <p>您的浏览器不支持PDF预览，<a href="${pdfUrl}" target="_blank">点击下载</a></p>
                        </iframe>`;
                    break;
                default:
                    previewContent = `<div class="no-preview">该文件类型暂不支持预览</div>`;
            }
        }

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

// 添加辅助函数，用于创建媒体URL
function createObjectURL(data, mimeType) {
    const blob = new Blob([data], { type: mimeType });
    return URL.createObjectURL(blob);
}

// 添加辅助函数，用于获取音频文件的MIME类型
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

// 添加辅助函数，用于获取视频文件的MIME类型
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

// 添加解密函数
async function decryptFile(encryptedData, keyBase64, ivBase64) {
    try {
        const crypto = window.crypto.subtle;
        
        const keyData = base64ToArrayBuffer(keyBase64);
        const iv = base64ToArrayBuffer(ivBase64);

        const key = await crypto.importKey(
            "raw",
            keyData,
            "AES-GCM",
            true,
            ["decrypt"]
        );

        const decryptedData = await crypto.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
                tagLength: 128  // 添加标签长度
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

// Base64 转 ArrayBuffer
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

// 添加HTML转义函数，防止XSS攻击
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 初始化上传器
new FileUploader(); 