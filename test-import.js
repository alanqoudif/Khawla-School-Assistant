// ملف اختبار لفحص استيراد البيانات
console.log('اختبار استيراد البيانات...');

try {
  // محاولة قراءة الملف مباشرة
  const fs = require('fs');
  const path = require('path');
  
  const filePath = path.join(__dirname, 'data', 'student-guide.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // البحث عن المحتوى
  const contentMatch = content.match(/export const studentGuideContent = `([\s\S]*?)`/);
  
  if (contentMatch) {
    const guideContent = contentMatch[1];
    console.log(`✅ تم استخراج المحتوى بنجاح`);
    console.log(`حجم المحتوى: ${guideContent.length} حرف`);
    console.log(`أول 200 حرف: ${guideContent.substring(0, 200)}...`);
    
    // البحث عن كلمات مفتاحية
    const keywords = ['جامعة السلطان قابوس', 'شروط القبول', 'المعدل التنافسي'];
    keywords.forEach(keyword => {
      if (guideContent.includes(keyword)) {
        console.log(`✅ تم العثور على الكلمة المفتاحية: "${keyword}"`);
      } else {
        console.log(`❌ لم يتم العثور على الكلمة المفتاحية: "${keyword}"`);
      }
    });
    
  } else {
    console.log('❌ لم يتم العثور على المحتوى في الملف');
  }
  
} catch (error) {
  console.error('❌ خطأ في قراءة الملف:', error);
}
