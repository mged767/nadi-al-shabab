// المكان بالضبط: netlify/functions/debug.js
// أداة تشخيص مؤقتة فقط — تتأكد هل المتغيّر مرئي للـ Function أو لا
// (لا تعرض قيمة المفتاح، فقط تتأكد من وجوده وطوله)

export default async () => {
  const key = process.env.API_FOOTBALL_KEY;
  const info = {
    key_exists: !!key,
    key_length: key ? key.length : 0,
    key_preview: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : null,
    all_env_names_containing_API: Object.keys(process.env).filter((k) =>
      k.toUpperCase().includes("API")
    ),
  };
  return new Response(JSON.stringify(info, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
