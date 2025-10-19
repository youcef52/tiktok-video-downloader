console.log('🎯 بدء الاختبار...');

const http = require('http');

const server = http.createServer((req, res) => {
    console.log('📥 Request:', req.url);
    res.end('<h1>Hello! السيرفر شغال</h1>');
});

server.listen(3000, () => {
    console.log('✅ السيرفر شغال على port 3000');
    console.log('📱 افتح http://localhost:3000');
});

// منع الإغلاق
setInterval(() => {
    console.log('❤️ السيرفر شغال...', new Date().toLocaleTimeString());
}, 5000);