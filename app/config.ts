export const config = {
  // ให้ใช้ค่าจาก Environment Variable ก่อน ถ้าไม่มี (เช่นตอนรันในเครื่อง) ค่อยใช้ localhost
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "https://sailom-api.vercel.app",
};
// export const config = {
//   apiUrl: "http://localhost:5000",
// };