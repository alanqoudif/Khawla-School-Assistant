// ملف اختبار لفحص API
const fetch = require('node-fetch');

async function testAPI() {
  try {
    console.log('اختبار API...');
    
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'ما هي شروط القبول في الجامعة؟'
          }
        ]
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ API يعمل بشكل صحيح');
      console.log('الرد:', data.response);
    } else {
      console.log('❌ خطأ في API:', data.error);
    }
    
  } catch (error) {
    console.error('❌ خطأ في الاتصال:', error.message);
  }
}

testAPI();
