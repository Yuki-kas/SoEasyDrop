const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

// 开发环境下添加日志
if (isDev) {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
        next();
    });
}

// 配置文件存储
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function(req, file, cb) {
        cb(null, uuidv4() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 100 // 限制文件大小为100MB
    }
});

// 静态文件服务
app.use(express.static('public'));

// 添加文件类型判断函数
function getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const videoExts = ['.mp4', '.webm', '.ogg'];
    const audioExts = ['.mp3', '.wav', '.ogg'];
    const textExts = ['.txt', '.md', '.js', '.css', '.html', '.json'];
    
    if (imageExts.includes(ext)) return 'image';
    if (ext === '.pdf') return 'pdf';
    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';
    if (textExts.includes(ext)) return 'text';
    return 'other';
}

// 修改文件上传路由，添加文件类型标记
app.post('/upload', upload.array('files', 10), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: '没有文件上传' });
    }

    const filesInfo = req.files.map(file => {
        const fileId = path.basename(file.filename, path.extname(file.originalname));
        const downloadUrl = `${req.protocol}://${req.get('host')}/download/${fileId}`;
        const previewUrl = `${req.protocol}://${req.get('host')}/preview/${fileId}`;
        const fileType = getFileType(file.originalname);

        // 设置24小时后删除文件
        setTimeout(() => {
            fs.unlink(file.path, (err) => {
                if (err && isDev) console.error('Error deleting file:', err);
            });
        }, 24 * 60 * 60 * 1000);

        if (isDev) {
            console.log(`File uploaded: ${file.originalname} (${file.size} bytes)`);
            console.log(`Type: ${fileType}`);
        }

        return {
            originalName: file.originalname,
            size: file.size,
            type: fileType,
            downloadUrl,
            previewUrl,
            mimeType: file.mimetype // 添加MIME类型
        };
    });

    res.json({
        success: true,
        files: filesInfo
    });
});

// 修改预览路由，改进文本文件处理
app.get('/preview/:fileId', (req, res) => {
    const files = fs.readdirSync('./uploads/');
    const file = files.find(f => f.startsWith(req.params.fileId));
    
    if (!file) {
        return res.status(404).send('文件不存在或已过期');
    }

    const filePath = path.join(__dirname, 'uploads', file);
    const fileType = getFileType(file);

    if (fileType === 'text') {
        // 直接发送文件，让客户端处理解密
        res.sendFile(filePath);
    } else {
        res.sendFile(filePath);
    }
});

// 文件下载路由
app.get('/download/:fileId', (req, res) => {
    const files = fs.readdirSync('./uploads/');
    const file = files.find(f => f.startsWith(req.params.fileId));
    
    if (!file) {
        if (isDev) console.log(`File not found: ${req.params.fileId}`);
        return res.status(404).send('文件不存在或已过期');
    }

    if (isDev) {
        console.log(`File download: ${file}`);
    }

    res.download(path.join(__dirname, 'uploads', file));
});

// 创建uploads目录（如果不存在）
if (!fs.existsSync('./uploads')){
    fs.mkdirSync('./uploads');
}

// 错误处理中间件
app.use((err, req, res, next) => {
    if (isDev) {
        console.error(err.stack);
    }
    res.status(500).json({ 
        success: false, 
        message: isDev ? err.message : '服务器内部错误'
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    if (isDev) {
        console.log('Development mode enabled - watching for file changes...');
    }
}); 