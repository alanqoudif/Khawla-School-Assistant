# نظام معرف المستخدم الفريد

## نظرة عامة
تم إضافة نظام معرف فريد لكل مستخدم في تطبيق مساعد القبول الموحد. هذا النظام يضمن تتبع كل مستخدم بشكل منفصل ويمنح كل جلسة معرف فريد.

## الميزات المضافة

### 1. توليد معرف فريد
- يتم توليد معرف فريد لكل مستخدم عند أول زيارة
- المعرف يتكون من: `user_` + نص عشوائي + timestamp
- مثال: `user_k3j9x2m1p_1k8n9x2m`

### 2. تخزين دائم
- يتم حفظ المعرف في `localStorage` للمتصفح
- المعرف يبقى ثابتاً حتى لو أغلقت المتصفح
- يتم إنشاء معرف جديد فقط عند مسح بيانات المتصفح

### 3. إرسال مع كل طلب
- يتم إرسال معرف المستخدم مع كل رسالة إلى API
- يتم تمرير المعرف إلى webhook n8n
- يمكن تتبع جميع رسائل المستخدم الواحد

## التغييرات التقنية

### Frontend (app/page.tsx)
```typescript
// دوال توليد المعرف
function generateUserId(): string {
  return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36)
}

function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return ''
  
  let userId = localStorage.getItem('admission_user_id')
  if (!userId) {
    userId = generateUserId()
    localStorage.setItem('admission_user_id', userId)
  }
  return userId
}
```

### API (app/api/chat/route.ts)
```typescript
// استقبال معرف المستخدم
const { messages, userId } = await req.json()

// إرسال المعرف إلى webhook
body: JSON.stringify({
  question: lastUserMessage.content,
  timestamp: new Date().toISOString(),
  userAgent: req.headers.get("user-agent") || "Unknown",
  ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "Unknown",
  userId: userId || "anonymous_user"
})
```

## البيانات المرسلة إلى n8n

الآن كل طلب يحتوي على:
- `question`: سؤال المستخدم
- `timestamp`: وقت إرسال السؤال
- `userAgent`: معلومات المتصفح
- `ip`: عنوان IP
- `userId`: **المعرف الفريد الجديد للمستخدم**

## الاستخدام في n8n

يمكنك الآن في n8n:
1. تتبع جميع رسائل المستخدم الواحد
2. إنشاء إحصائيات لكل مستخدم
3. حفظ تاريخ المحادثات لكل مستخدم
4. إرسال إشعارات مخصصة لكل مستخدم

## مثال على البيانات المستلمة

```json
{
  "question": "اشتراطات تخصص المحاسبه؟",
  "timestamp": "2025-10-12T04:58:13.838Z",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
  "ip": "2a02:2909:8c10:3488:b9eb:2dc1:58f0:93e8",
  "userId": "user_k3j9x2m1p_1k8n9x2m"
}
```

## الأمان والخصوصية

- المعرف لا يحتوي على معلومات شخصية
- لا يمكن ربط المعرف بهوية المستخدم الحقيقية
- يمكن للمستخدم مسح المعرف بمسح بيانات المتصفح
- المعرف محلي فقط ولا يتم تخزينه في قاعدة بيانات خارجية

## التطوير المستقبلي

يمكن إضافة:
- ربط المعرف بقاعدة بيانات للمستخدمين المسجلين
- إحصائيات مفصلة لكل مستخدم
- نظام إشعارات مخصص
- حفظ تفضيلات المستخدم
