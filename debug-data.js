// ملف لفحص البيانات
const fs = require('fs');
const path = require('path');

console.log('فحص ملف student-guide.ts...');

try {
  const filePath = path.join(__dirname, 'data', 'student-guide.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  
  console.log(`حجم الملف: ${content.length} حرف`);
  console.log(`عدد الأسطر: ${content.split('\n').length}`);
  
  // البحث عن بداية المحتوى
  const contentStart = content.indexOf('export const studentGuideContent = `');
  if (contentStart !== -1) {
    console.log(`✅ تم العثور على بداية المحتوى في الموضع: ${contentStart}`);
    
    // البحث عن نهاية المحتوى
    const contentEnd = content.lastIndexOf('`');
    if (contentEnd !== -1 && contentEnd > contentStart) {
      const actualContent = content.substring(contentStart + 35, contentEnd);
      console.log(`✅ حجم المحتوى الفعلي: ${actualContent.length} حرف`);
      console.log(`✅ أول 200 حرف من المحتوى: ${actualContent.substring(0, 200)}...`);
    } else {
      console.log('❌ لم يتم العثور على نهاية المحتوى');
    }
  } else {
    console.log('❌ لم يتم العثور على بداية المحتوى');
  }
  
} catch (error) {
  console.error('❌ خطأ في قراءة الملف:', error);
}
