console.log('🚀 بدء تشغيل سيرفر تيك توك...');

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔒 إعدادات الحماية
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://www.tikwm.com", "https://api.tiklydown.eu.org"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// 🔒 منع التحميل الزائد
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 دقيقة
    max: 50, // 50 طلب كحد أقصى لكل IP
    message: {
        success: false,
        error: 'تم تجاوز عدد الطلبات المسموح بها. يرجى المحاولة بعد دقيقة.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(limiter);

// 🔒 إعدادات CORS
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// 🔒 تحقق من صحة الرابط
function isValidTikTokUrl(url) {
    const tiktokPatterns = [
        /https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
        /https?:\/\/(vm|vt)\.tiktok\.com\/[\w\d]+\//,
        /https?:\/\/tiktok\.com\/@[\w.-]+\/video\/\d+/,
        /https?:\/\/(www\.)?tiktok\.com\/t\/[\w\d]+\//
    ];
    
    return tiktokPatterns.some(pattern => pattern.test(url));
}

// 🔒 تنظيف المدخلات
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, '');
}

// الراوت الرئيسي
app.get('/', (req, res) => {
    console.log('📥 طلب على الصفحة الرئيسية من IP:', req.ip);
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 🔒 راوت التحميل مع إصلاح المشكلة
app.post('/download', async (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    console.log('📥 طلب تحميل جديد من IP:', clientIP);
    
    try {
        let { url, type = 'video' } = req.body;
        
        // 🔒 تنظيف المدخلات
        url = sanitizeInput(url);
        type = sanitizeInput(type);
        
        if (!url) {
            console.log('❌ طلب بدون رابط من IP:', clientIP);
            return res.status(400).json({ success: false, error: 'الرجاء إدخال رابط' });
        }

        if (!isValidTikTokUrl(url)) {
            console.log('❌ رابط غير صالح من IP:', clientIP, 'الرابط:', url);
            return res.status(400).json({ success: false, error: 'رابط تيك توك غير صالح' });
        }

        // 🔒 التحقق من نوع التحميل المسموح
        const allowedTypes = ['video', 'mp3', 'story'];
        if (!allowedTypes.includes(type)) {
            type = 'video';
        }

        console.log('🔗 جاري تحميل من IP:', clientIP, 'الرابط:', url, 'النوع:', type);
        
        // استخدام API TikTok مع إصلاح المشكلة
        const apiUrls = [
            `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`,
            `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`
        ];

        let data = null;
        let apiUsed = '';

        // تجربة عدة APIs مع تحسين معالجة الأخطاء
        for (const apiUrl of apiUrls) {
            try {
                console.log(`🔄 جرب API: ${apiUrl}`);
                const response = await axios.get(apiUrl, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'application/json',
                        'Referer': 'https://www.tiktok.com/',
                        'Origin': 'https://www.tiktok.com'
                    },
                    validateStatus: function (status) {
                        return status >= 200 && status < 500;
                    }
                });
                
                // تحقق من أن الاستجابة JSON
                if (response.headers['content-type'] && response.headers['content-type'].includes('application/json')) {
                    data = response.data;
                    apiUsed = apiUrl;
                    console.log('✅ API نجح:', apiUrl);
                    break;
                } else {
                    console.log(`❌ API لم يرجع JSON: ${apiUrl}`);
                    continue;
                }
            } catch (apiError) {
                console.log(`❌ API فشل: ${apiUrl}`, apiError.message);
                continue;
            }
        }

        if (!data) {
            console.log('❌ جميع APIs فشلت من IP:', clientIP);
            return res.status(500).json({ success: false, error: 'جميع الخوادم مشغولة، حاول لاحقاً' });
        }

        console.log('📦 استجابة API:', apiUsed);

        // معالجة البيانات من مختلف APIs
        let downloadUrl, filename;

        if (apiUsed.includes('tiklydown')) {
            if (data.videos && data.videos.download) {
                downloadUrl = data.videos.download;
                filename = `tiktok_video_${Date.now()}.mp4`;
            } else if (data.video && data.video.download) {
                downloadUrl = data.video.download;
                filename = `tiktok_video_${Date.now()}.mp4`;
            }
        } else if (apiUsed.includes('tikwm')) {
            if (data.data) {
                if (data.data.play) {
                    downloadUrl = data.data.play;
                    filename = `tiktok_video_${Date.now()}.mp4`;
                }
                
                if (type === 'mp3' && data.data.music) {
                    downloadUrl = data.data.music;
                    filename = `tiktok_audio_${Date.now()}.mp3`;
                }
            }
        }

        if (downloadUrl) {
            console.log('✅ تم تجهيز الرابط لـ IP:', clientIP);
            
            // إرجاع رابط التحميل المباشر من السيرفر
            const proxyDownloadUrl = `/proxy-download?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(filename)}`;
            
            res.json({
                success: true,
                download: downloadUrl,
                proxy_url: proxyDownloadUrl,
                filename: filename,
                title: data.title || data.data?.title || 'فيديو تيك توك'
            });
        } else {
            console.log('❌ لم نتمكن من استخراج الرابط لـ IP:', clientIP);
            res.status(500).json({ success: false, error: 'لم نتمكن من تحميل الفيديو' });
        }
    } catch (error) {
        console.error('❌ خطأ من IP:', clientIP, ':', error.message);
        res.status(500).json({ success: false, error: 'حدث خطأ في الخادم' });
    }
});

// 🔒 راوت التحميل المباشر مع إصلاح المشكلة
app.get('/proxy-download', async (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    try {
        let { url, filename } = req.query;
        
        // 🔒 تنظيف المدخلات
        url = sanitizeInput(url);
        filename = sanitizeInput(filename);
        
        if (!url) {
            console.log('❌ تحميل مباشر بدون رابط من IP:', clientIP);
            return res.status(400).send('رابط غير صالح');
        }

        console.log('📥 تحميل مباشر من IP:', clientIP, 'الرابط:', url);

        // جلب الملف من الرابط
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.tiktok.com/',
                'Origin': 'https://www.tiktok.com',
                'Accept': '*/*'
            },
            validateStatus: function (status) {
                return status < 400;
            }
        });

        // إعداد headers للتحميل المباشر
        const safeFilename = filename || `tiktok_video_${Date.now()}.mp4`;
        
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
        res.setHeader('Cache-Control', 'no-cache');
        
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }

        // إرسال الملف كتحميل مباشر
        response.data.pipe(res);

        response.data.on('error', (error) => {
            console.error('❌ خطأ في Stream لـ IP:', clientIP, ':', error);
            if (!res.headersSent) {
                res.status(500).send('خطأ في التحميل');
            }
        });

        res.on('close', () => {
            console.log('✅ اكتمل التحميل لـ IP:', clientIP);
        });

    } catch (error) {
        console.error('❌ خطأ في التحميل المباشر من IP:', clientIP, ':', error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'فشل التحميل: ' + error.message });
        }
    }
});

// 🔒 راوت الصحة
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 🔒 معالجة الأخطاء غير المتوقعة
app.use((err, req, res, next) => {
    console.error('🛑 خطأ غير متوقع:', err);
    if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'حدث خطأ غير متوقع' });
    }
});

// 🔒 منع الوصول إلى الملفات الحساسة
app.get('/package.json', (req, res) => {
    res.status(403).send('Access Forbidden');
});

app.get('/server.js', (req, res) => {
    res.status(403).send('Access Forbidden');
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'الصفحة غير موجودة' });
});

// تشغيل السيرفر
app.listen(PORT, () => {
    console.log('🎉 =================================');
    console.log('✅ سيرفر تيك توك شغال على http://localhost:' + PORT);
    console.log('🔒 الوضع: ' + (process.env.NODE_ENV || 'development'));
    console.log('🎉 =================================');
});

// معالجة الأخطاء
process.on('uncaughtException', (error) => {
    console.log('🛑 خطأ غير متوقع:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log('🛑 خطأ في الوعد:', reason);
});
