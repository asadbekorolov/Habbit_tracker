/**
 * Claude API Integration Service for Deep Habit Analysis
 * Connects directly to Anthropic Messages API with safety headers for browser/mobile access.
 */

const API_KEY = import.meta.env.VITE_CLAUDE_API_KEY || "sk-ant-api03-d8RD2HfQ11IeLP6I_dxyqsRps9Ay1kiUTTrCeH-DfGnUjIi_s7IkdYvXkUcyNBSArZOcBPRBR83Y7gHDX65rKw-1xHTWQAA";

export async function requestClaudeHabitAnalysis(telemetryPayload: string): Promise<string> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        system: `Siz xatti-harakatlar psixologiyasi va yuqori unumdorlik (High-Performance Habit Coaching) bo'yicha yetakchi AI tahlilchisiz.
Sizga foydalanuvchining barcha odatlari va ko'rsatkichlari telemetriyasi taqdim etiladi.
Sizning vazifangiz shunchaki umumiy gaplar aytish emas, balki ANIQ RAQAMLAR, STATISTIK BOG'LIQLIKLAR va KELAJAK UCHUN AMALIY MASLAHATLAR bilan boyitilgan chuqur hisobot tuzish.

Tahlil tuzilmasi:
1. 📊 Aniq Raqamlar va Tendensiyalar (qaysi odatlar kuchli, qaysilari zaif, raqamlar bilan solishtirish).
2. ⚡ Uyqu va Salomatlikning Intizomga Ta'siri (uyqu soati va qadamlarning odatlarni bajarishga bog'liqligi).
3. 🎯 Kelgusi 7-14 Kunlik Strategik Reja (zaif odatlarni, masalan: ertalab yugurish yoki turnikni tiklash uchun qat'iy vaqt va trigger taklif qilish).

Javobni o'zbek tilida, professional, chuqur tahliliy va kuchli motivatsion ruhda yozing.`,
        messages: [
          {
            role: "user",
            content: telemetryPayload
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Claude API Error:", errorData);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || "Tahlilni yuklashda xatolik yuz berdi.";
  } catch (error) {
    console.warn("Claude API failed:", error);
    throw error;
  }
}
