console.log('🚀 بدء تشغيل سيرفر تيك توك...');

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// إعدادات أساسية
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// الراوت الرئيسي
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// راوت التحميل المبسط
app.post('/download', async (req, res) => {
    try {
        const { url, type = 'video' } = req.body;
        
        if (!url || !url.includes('tiktok.com')) {
            return res.json({ success: false, error: 'رابط تيك توك غير صالح' });
        }

        console.log('📥 طلب تحميل:', url);

        // استخدام API واحد فقط
        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
        
        const response = await axios.get(apiUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const data = response.data;

        if (data.code === 0 && data.data) {
            let downloadUrl, filename;

            if (type === 'video') {
                downloadUrl = data.data.play;
                filename = `tiktok_video_${Date.now()}.mp4`;
            } else if (type === 'mp3' && data.data.music) {
                downloadUrl = data.data.music;
                filename = `tiktok_audio_${Date.now()}.mp3`;
            } else {
                throw new Error('النوع غير مدعوم');
            }

            if (downloadUrl) {
                res.json({
                    success: true,
                    download: downloadUrl,
                    filename: filename
                });
                return;
            }
        }

        throw new Error('فشل في تحميل الفيديو');

    } catch (error) {
        console.error('❌ خطأ:', error.message);
        res.json({ 
            success: false, 
            error: 'فشل في التحميل: ' + error.message 
        });
    }
});

// راوت التحميل المباشر
app.get('/proxy-download', async (req, res) => {
    try {
        const { url, filename } = req.query;
        
        if (!url) {
            return res.status(400).send('رابط غير صالح');
        }

        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.tiktok.com/'
            }
        });

        const safeFilename = filename || 'tiktok_video.mp4';
        
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
        
        response.data.pipe(res);

    } catch (error) {
        console.error('❌ خطأ في التحميل:', error.message);
        res.status(500).send('فشل في التحميل');
    }
});

// تشغيل السيرفر
app.listen(PORT, () => {
    console.log('✅ سيرفر شغال على http://localhost:' + PORT);
});
